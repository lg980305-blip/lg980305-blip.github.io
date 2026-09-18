#!/usr/bin/env python3
"""amf-models/models.json + photos -> amf-models/AMF_모델명단.xlsx

사용법: python3 tools/build_models_xlsx.py
"""
import json, os
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'amf-models')
rows = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'AMF_모델명단.xlsx')
TMP = os.path.join(ROOT, '_xlsx_tmp')
os.makedirs(TMP, exist_ok=True)

FONT = 'Arial'
head_font = Font(name=FONT, bold=True, color='FFFFFF', size=10)
head_fill = PatternFill('solid', fgColor='0B3A6F')
body_font = Font(name=FONT, size=10)
thin = Side(style='thin', color='D0D7E2')
border = Border(left=thin, right=thin, top=thin, bottom=thin)
center = Alignment(horizontal='center', vertical='center', wrap_text=True)
left = Alignment(horizontal='left', vertical='center', wrap_text=True)

wb = Workbook()
ws = wb.active
ws.title = 'AMF 인물'
headers = ['번호', '사진', '구분', '이름', '국가/지역', '성별', '키(cm)', '몸무게(kg)', '가슴(cm)', '허리(cm)', '엉덩이(cm)', '신발(mm)', '연도', '비고']
widths = [6, 14, 11, 22, 20, 6, 8, 10, 9, 9, 10, 9, 7, 26]
ws.append(headers)
for i, w in enumerate(widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w
for c in ws[1]:
    c.font = head_font; c.fill = head_fill; c.alignment = center; c.border = border
ws.row_dimensions[1].height = 22
ws.freeze_panes = 'C2'

PH_W, PH_H = 90, 120  # px, 3:4
for r in rows:
    ws.append([r['no'], None, r['cat'], r['name'], r['country'], r['sex'] or None,
               r.get('height_cm'), r.get('weight_kg'), r.get('chest_cm'), r.get('waist_cm'), r.get('hip_cm'), r.get('shoe_mm'),
               r.get('year') or None, r.get('note') or None])
    ridx = ws.max_row
    ws.row_dimensions[ridx].height = PH_H * 0.75 + 6  # pt
    for c in ws[ridx]:
        c.font = body_font; c.border = border
        c.alignment = left if c.column in (4, 5, 14) else center
    src = os.path.join(ROOT, r['photo'])
    png = os.path.join(TMP, f"{r['no']:03d}.png")
    Image.open(src).convert('RGB').resize((PH_W, PH_H), Image.LANCZOS).save(png)
    img = XLImage(png)
    img.width, img.height = PH_W, PH_H
    ws.add_image(img, f'B{ridx}')
ws.auto_filter.ref = f'A1:{get_column_letter(len(headers))}{ws.max_row}'
last = ws.max_row

# 국가별 요약 (수식)
ws2 = wb.create_sheet('국가별 요약')
ws2.append(['국가/지역', '합계', '모델', '역대 수상자', '평균 키(cm)'])
for c in ws2[1]:
    c.font = head_font; c.fill = head_fill; c.alignment = center; c.border = border
for i, w in enumerate([22, 8, 8, 12, 12], 1):
    ws2.column_dimensions[get_column_letter(i)].width = w
countries = sorted({r['country'] for r in rows})
for i, cn in enumerate(countries, 2):
    ws2.append([cn,
                f"=COUNTIF('AMF 인물'!$E$2:$E${last},$A{i})",
                f"=COUNTIFS('AMF 인물'!$E$2:$E${last},$A{i},'AMF 인물'!$C$2:$C${last},\"모델\")",
                f"=COUNTIFS('AMF 인물'!$E$2:$E${last},$A{i},'AMF 인물'!$C$2:$C${last},\"역대 수상자\")",
                f"=IFERROR(ROUND(AVERAGEIF('AMF 인물'!$E$2:$E${last},$A{i},'AMF 인물'!$G$2:$G${last}),1),\"\")"])
tot = len(countries) + 2
ws2.append(['합계', f'=SUM(B2:B{tot-1})', f'=SUM(C2:C{tot-1})', f'=SUM(D2:D{tot-1})', f"=ROUND(AVERAGE('AMF 인물'!$G$2:$G${last}),1)"])
for row in ws2.iter_rows(min_row=2, max_row=tot):
    for c in row:
        c.font = body_font; c.border = border
        c.alignment = left if c.column == 1 else center
for c in ws2[tot]:
    c.font = Font(name=FONT, bold=True, size=10); c.fill = PatternFill('solid', fgColor='EAF1FA')
ws2.freeze_panes = 'A2'

# 안내
ws3 = wb.create_sheet('안내')
lines = ['AMF 인물 정리 — 모델 + 역대 수상자', '',
         '출처: https://amfoc.org/amf-models/ · https://amfoc.org/foa_winners/   |   수집일: 2026-09-18', '',
         f'구성: 모델 {sum(1 for r in rows if r["cat"]=="모델")}명 + 역대 수상자 {sum(1 for r in rows if r["cat"]!="모델")}명 = {len(rows)}명', '',
         '사진: 얼굴 중심 3:4 증명사진 규격(240×320)으로 통일. 원본 썸네일이 작아 확대 화질에 한계가 있음.',
         '사진은 셀 위에 떠 있는 개체라 일부 웹 미리보기에서는 보이지 않을 수 있음. Excel·Numbers에서 열면 표시됨.', '',
         "'국가별 요약' 시트의 숫자는 'AMF 인물' 시트를 참조하는 수식이므로 인물 데이터를 고치면 자동 갱신됨.",
         '데이터 원본: amf-models/models.json · 생성 스크립트: tools/build_models_xlsx.py']
for l in lines:
    ws3.append([l])
ws3.column_dimensions['A'].width = 110
ws3['A1'].font = Font(name=FONT, bold=True, size=13)
for row in ws3.iter_rows(min_row=2):
    row[0].font = body_font

wb.save(OUT)
import shutil; shutil.rmtree(TMP)
print('saved', OUT, 'rows', last - 1)
