# TOPIK ASIA 안드로이드 앱 (원본 프로젝트)

`app/src/main/assets/` 의 웹앱을 WebView 로 여는 얇은 껍데기입니다.
AI 요청은 `direct.js` 가 중계 서버(Vercel `api/gemini.mjs`)로 보내며, 서버 주소는
`https://lg980305-blip.github.io/apk/config.json` 에서 읽습니다. 사용자는 키를 몰라도 됩니다.
서버 설정은 `server/README.md` 의 "TOPIK ASIA 안드로이드 앱 연결" 항목을 보세요.

## 빌드 (자동)

GitHub 저장소 → **Actions** → **Build TOPIK APK** → **Run workflow**.
끝나면 `apk/topikasia.apk` 가 새 버전으로 바뀌고 다운로드 페이지의 체크섬도 갱신됩니다.
`topik-android/` 아래 파일을 고쳐 푸시해도 자동으로 빌드됩니다.

## 빌드 (로컬)

Android Studio 로 이 폴더를 열고 ▶ Run. 또는:

```bash
gradle -p topik-android assembleRelease
```

## 서명

빌드 워크플로는 uber-apk-signer 에 내장된 디버그 키로 서명합니다. 매번 같은 키라
이전 버전 위에 업데이트 설치가 됩니다. 플레이스토어에 올릴 때는 별도 키가 필요합니다.
