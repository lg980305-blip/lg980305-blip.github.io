# 앱으로 배포하기 — 링크 공유용 가이드

목업 단계이므로 **구글 플레이 등록 없이 링크만으로 배포**하는 방법을 정리했습니다.
방법은 두 가지이고, **1번은 지금 당장 됩니다.**

---

## 방법 1. 웹 링크 공유 (빌드 불필요 · 지금 바로 가능) ⭐ 권장

이 사이트는 이미 **PWA(설치형 웹앱)** 로 만들어 두었습니다.
아래 링크를 카톡이나 문자로 보내기만 하면, 받는 사람이 앱처럼 설치할 수 있습니다.

```
https://lg980305-blip.github.io
```

**안드로이드 (Chrome)**
링크 열기 → 하단에 뜨는 **"앱 설치"** 배너를 탭
(배너가 안 뜨면 우측 상단 ⋮ → **홈 화면에 추가**)

**아이폰 (Safari)**
링크 열기 → 하단 **공유 버튼(⬆︎)** → **홈 화면에 추가**

설치하면 이렇게 됩니다.
- 홈 화면에 블랙홀맨 아이콘 생성
- 주소창 없이 전체화면으로 실행 (앱과 구분이 안 됨)
- 한 번 본 페이지는 **비행기 모드에서도** 열림
- 아이콘 길게 누르면 CHARACTERS / AI LAB / ARCADE 바로가기

> 목업 시연이나 투자자·파트너 공유용으로는 이 방법이 가장 빠르고 확실합니다.
> 설치 거부감도 없고, 내용을 수정하면 **다음에 열 때 자동으로 최신 버전**이 됩니다.

---

## 방법 2. `.apk` 파일 만들어 링크로 배포

"안드로이드 설치 파일을 직접 주고 싶다"면 이 방법입니다.

### 준비물 (최초 1회)

| 필요한 것 | 설치 방법 |
|---|---|
| Node.js 18 이상 | <https://nodejs.org> 에서 LTS 버전 |
| JDK 17 | <https://adoptium.net> 에서 Temurin 17 |
| Bubblewrap | 아래 명령어 |

```bash
npm install -g @bubblewrap/cli
```

Android SDK는 Bubblewrap이 첫 실행 때 알아서 내려받습니다. (약 1GB, 5~10분)

### 빌드 (3단계)

```bash
# 1. 이 저장소를 받아 폴더로 이동
git clone https://github.com/lg980305-blip/lg980305-blip.github.io.git
cd lg980305-blip.github.io

# 2. 초기화 — 저장소에 twa-manifest.json 이 이미 있으므로 값은 그대로 엔터
bubblewrap init --manifest https://lg980305-blip.github.io/site.webmanifest

# 3. 빌드
bubblewrap build
```

2번에서 **서명키(keystore)를 만들지 물어봅니다. "yes"** 를 누르고 비밀번호를 정하세요.

> ⚠️ 만들어진 `android.keystore` 파일과 비밀번호는 **반드시 안전한 곳에 백업**하세요.
> 잃어버리면 나중에 같은 앱으로 업데이트를 낼 수 없습니다.
> 이 파일은 **절대 GitHub에 올리면 안 됩니다** (`.gitignore`에 이미 등록해 두었습니다).

빌드가 끝나면 폴더에 `app-release-signed.apk` 가 생깁니다. **이 파일을 공유하면 됩니다.**

### 링크로 배포하기

셋 중 편한 방법을 고르세요.

| 방법 | 절차 |
|---|---|
| **GitHub Releases** (권장) | 저장소 → Releases → Draft a new release → apk 파일 첨부 → Publish. 생성된 다운로드 링크를 공유 |
| **구글 드라이브** | 업로드 → 링크 복사 → "링크가 있는 모든 사용자"로 권한 변경 |
| **Vercel** | 저장소에 `public/app.apk` 로 넣고 배포 → `https://<프로젝트>.vercel.app/app.apk` |

### 받는 사람 안내 문구 (그대로 복사해 쓰세요)

> 링크를 눌러 파일을 받은 뒤 열어 주세요.
> "출처를 알 수 없는 앱"이라는 경고가 뜨면 **설정 → 이 출처 허용**을 켠 뒤 설치하시면 됩니다.
> (플레이스토어에 아직 올리지 않은 테스트 버전이라 나오는 정상적인 안내입니다.)

---

## 주소창을 없애려면 — assetlinks.json 설정

방법 2로 만든 APK는 처음엔 화면 위에 **주소창이 얇게 보입니다.**
"이 앱이 정말 이 사이트의 공식 앱이 맞다"는 증명을 붙여야 사라집니다.

```bash
# 1. 지문(fingerprint) 확인
keytool -list -v -keystore android.keystore -alias blackholemanbros
```

출력에서 `SHA256:` 뒤의 긴 값(`AA:BB:CC:...`)을 복사합니다.

```bash
# 2. 저장소의 .well-known/assetlinks.json 을 열어
#    "REPLACE_WITH_YOUR_SHA256_FINGERPRINT" 자리에 붙여넣고 커밋·푸시
```

푸시 후 <https://lg980305-blip.github.io/.well-known/assetlinks.json> 이 열리는지 확인하고,
APK를 다시 설치하면 주소창이 사라집니다.

> Bubblewrap이 `bubblewrap fingerprint` 명령으로 이 값을 대신 뽑아 주기도 합니다.

---

## 나중에 구글 플레이에 올릴 때

- 개발자 등록비 **$25 (최초 1회)**
- `bubblewrap build` 로 나온 **`app-release-bundle.aab`** 파일을 업로드 (apk가 아닙니다)
- 필요 서류: 개인정보처리방침 URL — 이미 준비되어 있습니다
  → <https://lg980305-blip.github.io/privacy.html>
- 심사는 보통 1~3일

> **주의**: 구글 플레이는 "웹사이트를 그대로 감싸기만 한 앱"을 반려합니다.
> 아케이드 미니게임과 AI LAB의 캐릭터 대화처럼 **앱에서 직접 즐길 거리**가
> 앞에 나와 있어야 통과됩니다. 지금 구조가 그렇게 잡혀 있습니다.

---

## 아이폰(iOS) 앱은?

애플은 TWA 방식을 지원하지 않고, 앱스토어 등록에는 **연 $99 개발자 계정**과
맥 컴퓨터가 필요합니다. 목업 단계에서는 **방법 1(홈 화면에 추가)** 로 충분하며,
아이폰에서도 전체화면·아이콘·오프라인이 모두 동일하게 동작합니다.
