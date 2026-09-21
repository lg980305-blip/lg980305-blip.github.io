package kr.topikasia.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * TOPIK ASIA — 앱 안에 담긴 웹앱(assets/index.html)을 여는 껍데기.
 *
 * 서버를 찾지 않고 곧바로 내장 파일을 연다. AI 요청은 웹앱(direct.js)이
 * Gemini 에 직접 보내며, API 키는 사용자가 처음 한 번 입력해 폰에만 저장된다.
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "file:///android_asset/index.html";
    private static final String[] MEDIA_PERMS = {
            Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO };
    private static final int REQ_MEDIA = 41;

    private WebView web;
    private PermissionRequest pendingRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F2F4F1"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);              // localStorage: 키 · 일일 한도 · 학습 기록
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true); // file:// 에서 Gemini API 호출 허용
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.setWebViewClient(new WebViewClient() {
            /* 앱 안의 페이지는 그대로, 바깥 링크(aistudio 등)는 브라우저로 */
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            /* 웹앱이 마이크·카메라를 요청하면 안드로이드 권한을 확인한 뒤 허용 */
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (hasMediaPermissions()) {
                        request.grant(request.getResources());
                    } else {
                        pendingRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this, MEDIA_PERMS, REQ_MEDIA);
                    }
                });
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        /* 복원에 실패하면(예: 저장 상태가 비어 있음) 빈 화면이 남지 않도록 처음부터 연다 */
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(START_URL);
        }
    }

    private boolean hasMediaPermissions() {
        for (String p : MEDIA_PERMS) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) return false;
        }
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MEDIA || pendingRequest == null) return;
        PermissionRequest req = pendingRequest;
        pendingRequest = null;
        if (hasMediaPermissions()) req.grant(req.getResources());
        else req.deny();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
