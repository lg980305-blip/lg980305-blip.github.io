# BLACKHOLEMAN BROS

주식회사 블랙홀맨브로스 공식 웹사이트. GitHub Pages에서 동작하는 정적 사이트입니다.

🔗 <https://lg980305-blip.github.io>

[![Vercel로 배포](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flg980305-blip%2Flg980305-blip.github.io&project-name=blackholemanbros&repository-name=blackholemanbros&env=GEMINI_API_KEY,ALLOWED_ORIGIN&envDescription=GEMINI_API_KEY%EB%8A%94%20AI%20Studio%EC%97%90%EC%84%9C%20%EB%B0%9C%EA%B8%89%ED%95%9C%20%ED%82%A4%2C%20ALLOWED_ORIGIN%EC%9D%80%20%ED%97%88%EC%9A%A9%ED%95%A0%20%EC%82%AC%EC%9D%B4%ED%8A%B8%20%EC%A3%BC%EC%86%8C&envLink=https%3A%2F%2Fgithub.com%2Flg980305-blip%2Flg980305-blip.github.io%2Fblob%2Fmain%2Fserver%2FREADME.md)

---

## 페이지 구성

### 한국어 (루트)
| 파일 | 내용 |
|---|---|
| `index.html` | 홈 |
| `about.html` | 회사소개 · 비전 · 창업자 · 특허 · 로드맵 · 파트너 · **문의(`#contact`)** |
| `characters.html` | 캐릭터 (블랙홀맨 · 홀독 · 홀캣 · T-Man · T-Bird) |
| `technology.html` | Character Evolution Engine 기술 |
| `ai.html` | **AI LAB** — 캐릭터 대화 · 문의 봇 · 진화 데모 · 스토리 생성 |
| `contents.html` | 게임 · 웹툰 · 뮤직 · 모션 · 갤러리 |
| `community.html` | 커뮤니티 (준비 중) |
| `goods.html` | 굿즈 프리뷰 (출시 전) |
| `games/` | 아케이드 — 룰렛, 추첨기, 사다리, 주사위, 카드, 대진표 |
| `evolution/` | **반응 주입 연재기** 목업 — 독자 반응 → 진화 결정(특허 10-2837572) → 회차 기획·집필·기억 |
| `privacy.html` · `terms.html` | 개인정보처리방침 · 이용약관 |
| `404.html` · `offline.html` | 오류 / 오프라인 페이지 |

### English
`en/` 아래에 동일한 7개 페이지. 헤더의 **KO / EN** 버튼으로 전환합니다.

---

## 공통 파일

| 파일 | 역할 |
|---|---|
| `assets/site.css` | 헤더 우측 컨트롤, 모바일 메뉴, 포커스 스타일, 공통 푸터 |
| `assets/site.js` | 모바일 메뉴 동작, 서비스 워커 등록 |
| `assets/ai.css` · `assets/ai.js` | AI LAB 화면과 동작 |
| `assets/legal.css` | 개인정보처리방침 · 이용약관 페이지 |
| `sw.js` | 오프라인 캐시 (PWA) |
| `site.webmanifest` | 앱 설치 정보 |
| `sitemap.xml` · `robots.txt` | 검색엔진용 |

**페이지를 새로 만들 때**는 기존 페이지의 `<head>`, `<header>`, `<footer>`,
그리고 `</body>` 직전의 `.sitemenu` 블록을 그대로 복사한 뒤 `<nav>`의 `active` 위치만 바꾸면 됩니다.

---

## 사업자 정보

- 법인명: 주식회사 블랙홀맨브로스
- 대표자: 조미숙
- 사업자등록번호: 717-81-03443
- 주소: 서울특별시 강남구 선릉로 529, 5층 5249호(역삼동, 함양재빌딩)
- 특허: 등록번호 10-2837572

> 법인등록번호는 공개 Footer에서 제외했습니다.

---

## ⚠️ 아직 바꿔야 하는 값

| 위치 | 현재 값 | 해야 할 일 |
|---|---|---|
| 전체 (푸터 · 문의 · 알림 신청) | `contact@blackholemanbros.com` | **실제 이메일 주소로 교체** |
| 전 페이지 `<head>`의 GA4 주석 | `G-XXXXXXXXXX` | 방문자 통계를 쓰려면 측정 ID를 넣고 주석 해제 |
| Gemini 연동 | 자동 감지 (현재 데모 모드) | Vercel 배포 + `GEMINI_API_KEY` 환경변수만 설정하면 자동 연결 (→ `server/README.md`) |
| `.well-known/assetlinks.json` | `REPLACE_WITH_YOUR_...` | APK 빌드 후 서명 지문 (→ `APK.md`) |

이메일은 아래 명령 한 줄로 전부 바꿀 수 있습니다.

```bash
grep -rl "contact@blackholemanbros.com" --include="*.html" --include="*.md" . \
  | xargs sed -i 's/contact@blackholemanbros\.com/실제주소@도메인.com/g'
```

---

## Gemini 연동 (AI LAB)

`ai.html`은 서버 없이도 **데모 모드**로 동작합니다.
실제 Gemini를 붙이려면 API 키를 보관할 중계 서버가 하나 필요합니다.
브라우저 코드에 키를 넣으면 누구나 볼 수 있으므로 절대 그렇게 하지 마세요.

`assets/ai.js` 는 같은 도메인의 `/api/gemini` 를 자동으로 찾습니다.
Vercel 에 배포하면 `api/gemini.mjs` 가 함께 올라가므로 **코드를 고칠 필요가 없습니다.**
GitHub Pages 처럼 서버가 없는 곳에서는 자동으로 데모 모드가 됩니다.

- 배포 가이드: **[`server/README.md`](server/README.md)**
- Cloudflare Workers 용: `server/cloudflare-worker.js` (무료 · 상업적 사용 가능)
- Vercel 용: `api/gemini.mjs` (무료 Hobby 플랜은 비상업용 한정)

---

## 앱(APK)으로 배포

- 가이드: **[`APK.md`](APK.md)**
- 지금 당장 되는 방법: 사이트 링크를 공유하고 **"홈 화면에 추가"** (안드로이드·아이폰 모두 지원)
- `.apk` 파일이 필요하면 Bubblewrap으로 빌드 (`twa-manifest.json` 준비되어 있음)

> `android.keystore`는 절대 커밋하지 마세요. `.gitignore`에 등록해 두었습니다.

---

## 로컬에서 확인하기

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

서비스 워커는 HTTPS에서만 등록되므로, 로컬에서는 오프라인 기능이 동작하지 않는 것이 정상입니다.

---

## 이미지 최적화 규칙

전체 이미지는 WebP로, 긴 변 최대 1400px입니다. 새 이미지를 추가할 때도 같은 기준을 지켜 주세요.

```bash
python3 -c "
from PIL import Image
im = Image.open('원본.png')
s = min(1, 1400/max(im.size))
if s < 1: im = im.resize((round(im.width*s), round(im.height*s)), Image.LANCZOS)
im.save('assets/새이름.webp', 'WEBP', quality=82, method=6)"
```

`<img>` 태그에는 `alt`, `loading="lazy"`, `width`, `height`를 반드시 넣어 주세요.
(첫 화면에 보이는 이미지만 `loading` 대신 `fetchpriority="high"`)

---

## GitHub Pages 설정

Settings → Pages → Deploy from a branch → `main` / `/ (root)`
