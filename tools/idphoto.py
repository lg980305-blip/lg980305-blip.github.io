#!/usr/bin/env python3
"""
AMF 모델 사진 -> 증명사진 규격 일괄 정리 도구.

사용법:
  python3 tools/idphoto.py <입력폴더> <출력폴더> [--size 600x800] [--bg white|none] [--format webp|jpg]

동작:
  1. 얼굴을 찾아 얼굴 중심으로 3:4 비율 크롭 (머리 위 여백, 어깨선까지 포함)
  2. 모든 사진을 같은 크기로 리사이즈
  3. 자동 화이트밸런스, 부드러운 노이즈 제거, 대비/선명도 보정
  4. --bg white 이면 배경을 흰색으로 교체 (GrabCut 기반)
  5. 결과 목록(contact sheet)을 함께 저장
"""
import argparse, os, sys, glob
import cv2
import numpy as np
from PIL import Image

EXTS = ('*.jpg', '*.jpeg', '*.png', '*.webp', '*.JPG', '*.JPEG', '*.PNG', '*.WEBP')


def load(path):
    im = Image.open(path).convert('RGB')
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)


def detect_face(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = []
    for name in ('haarcascade_frontalface_default.xml', 'haarcascade_frontalface_alt2.xml', 'haarcascade_profileface.xml'):
        casc = cv2.CascadeClassifier(cv2.data.haarcascades + name)
        found = casc.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=5, minSize=(max(30, bgr.shape[1] // 20),) * 2)
        if len(found):
            faces.extend(found.tolist())
    if not faces:
        return None
    # 가장 큰 얼굴 하나 사용
    return max(faces, key=lambda f: f[2] * f[3])


def crop_box(bgr, face, ratio=3 / 4):
    """얼굴을 기준으로 증명사진 구도의 크롭 박스를 계산 (w/h = ratio)."""
    H, W = bgr.shape[:2]
    if face is None:
        # 얼굴 미검출: 상단 중앙 기준으로 최대 3:4 크롭
        h = H
        w = int(h * ratio)
        if w > W:
            w = W
            h = int(w / ratio)
        x = (W - w) // 2
        return x, 0, w, h
    fx, fy, fw, fh = face
    cx = fx + fw / 2
    cy = fy + fh / 2
    # 증명사진 규격: 얼굴 높이가 전체 높이의 약 42%
    h = fh / 0.42
    w = h * ratio
    # 얼굴 중심이 세로 기준 약 40% 지점에 오도록
    y = cy - h * 0.40
    x = cx - w / 2
    # 경계 보정
    x = max(0, min(x, W - w))
    y = max(0, min(y, H - h))
    if w > W or h > H:
        # 원본이 작으면 가능한 최대 크기로
        scale = min(W / w, H / h)
        w, h = w * scale, h * scale
        x = max(0, min(cx - w / 2, W - w))
        y = max(0, min(cy - h * 0.40, H - h))
    return int(x), int(y), int(w), int(h)


def white_balance(bgr):
    result = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    avg_a = np.mean(result[:, :, 1])
    avg_b = np.mean(result[:, :, 2])
    result[:, :, 1] -= (avg_a - 128) * (result[:, :, 0] / 255.0) * 1.1
    result[:, :, 2] -= (avg_b - 128) * (result[:, :, 0] / 255.0) * 1.1
    return cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def enhance(bgr):
    out = white_balance(bgr)
    # 부드러운 노이즈 제거 (피부 결 유지)
    out = cv2.bilateralFilter(out, d=5, sigmaColor=25, sigmaSpace=5)
    # 약한 대비 보정
    lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.4, tileGridSize=(8, 8))
    l = clahe.apply(l)
    out = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
    # 살짝 밝게
    out = cv2.convertScaleAbs(out, alpha=1.03, beta=6)
    # 언샤프 마스크
    blur = cv2.GaussianBlur(out, (0, 0), 1.2)
    out = cv2.addWeighted(out, 1.35, blur, -0.35, 0)
    return out


def replace_background(bgr, face, color=(255, 255, 255)):
    H, W = bgr.shape[:2]
    mask = np.zeros((H, W), np.uint8)
    # 인물이 있을 법한 영역을 사각형으로 초기화
    if face is not None:
        fx, fy, fw, fh = face
        rect = (max(0, int(fx - fw * 0.9)), max(0, int(fy - fh * 0.5)), min(W, int(fw * 2.8)), H)
    else:
        rect = (int(W * 0.1), int(H * 0.05), int(W * 0.8), int(H * 0.95))
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(bgr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return bgr
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
    # 가장 큰 덩어리만 남기고 가장자리 부드럽게
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        fg = (labels == big).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    alpha = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 2.0)[..., None]
    bg = np.full_like(bgr, color, dtype=np.uint8)
    return (bgr * alpha + bg * (1 - alpha)).astype(np.uint8)


def process(path, size, bg, fmt, outdir):
    bgr = load(path)
    face = detect_face(bgr)
    x, y, w, h = crop_box(bgr, face)
    crop = bgr[y:y + h, x:x + w]
    face_local = None
    if face is not None:
        fx, fy, fw, fh = face
        face_local = (fx - x, fy - y, fw, fh)
    if bg == 'white':
        crop = replace_background(crop, face_local)
    crop = cv2.resize(crop, size, interpolation=cv2.INTER_AREA if crop.shape[1] > size[0] else cv2.INTER_CUBIC)
    crop = enhance(crop)
    name = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(outdir, f'{name}.{fmt}')
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(out, quality=92)
    return out, face is not None


def contact_sheet(paths, size, outdir, cols=6):
    if not paths:
        return
    tw, th = size[0] // 3, size[1] // 3
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + 12) + 12, rows * (th + 12) + 12), (240, 240, 240))
    for i, p in enumerate(paths):
        im = Image.open(p).resize((tw, th))
        sheet.paste(im, (12 + (i % cols) * (tw + 12), 12 + (i // cols) * (th + 12)))
    sheet.save(os.path.join(outdir, '_contact_sheet.jpg'), quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('indir')
    ap.add_argument('outdir')
    ap.add_argument('--size', default='600x800', help='가로x세로 (기본 600x800, 3:4)')
    ap.add_argument('--bg', default='none', choices=['none', 'white'], help='배경 흰색 교체 여부')
    ap.add_argument('--format', default='webp', choices=['webp', 'jpg', 'png'])
    a = ap.parse_args()
    size = tuple(int(v) for v in a.size.lower().split('x'))
    os.makedirs(a.outdir, exist_ok=True)
    files = sorted(sum((glob.glob(os.path.join(a.indir, e)) for e in EXTS), []))
    if not files:
        print('입력 폴더에 이미지가 없습니다:', a.indir)
        sys.exit(1)
    outs, nofaces = [], []
    for f in files:
        out, ok = process(f, size, a.bg, a.format, a.outdir)
        outs.append(out)
        if not ok:
            nofaces.append(os.path.basename(f))
        print(('OK   ' if ok else 'NOFC ') + os.path.basename(f) + ' -> ' + os.path.basename(out))
    contact_sheet(outs, size, a.outdir)
    print(f'\n완료: {len(outs)}장, 얼굴 미검출 {len(nofaces)}장', nofaces if nofaces else '')


if __name__ == '__main__':
    main()
