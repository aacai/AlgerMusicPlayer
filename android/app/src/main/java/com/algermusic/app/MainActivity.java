package com.algermusic.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 直接把 APK assets 里的 Web 产物以 https://appassets.androidplatform.net 虚拟源提供给 WebView。
 * 之所以不能用 file://，是因为构建产物使用 ES Module，file:// 会被 CORS 策略拦截导致白屏。
 */
public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String API_HOST = "app.api.local";
    private static final String ASSET_PREFIX = "/assets/";
    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/www/index.html";

    private WebView webView;
    private long lastBackAt = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 窄屏设备（手机）只支持竖屏，平板仍可旋转
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // edge-to-edge：系统栏透明，由 fitsSystemWindows 的容器消费 safe drawing insets
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        } else {
            getWindow().setStatusBarColor(Color.WHITE);
            getWindow().setNavigationBarColor(Color.WHITE);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setFitsSystemWindows(true);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return null;
                if (API_HOST.equals(uri.getHost())) {
                    return NeteaseApi.handle(uri);
                }
                if (!ASSET_HOST.equals(uri.getHost())) {
                    return null;
                }
                String path = uri.getPath();
                if (path == null || !path.startsWith(ASSET_PREFIX)) {
                    return null;
                }
                return serveAsset(path.substring(ASSET_PREFIX.length()));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    // 外部链接交给系统浏览器，避免把 JS 桥暴露给第三方页面
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }
        });

        webView.addJavascriptInterface(new MusicSourceBridge(), "algerNative");

        setContentView(root);
        registerBackHandler();
        webView.loadUrl(START_URL);
    }

    /**
     * 注册物理返回键处理。
     * Android 13+ 的预测性返回（predictive back）在 targetSdk >= 34 时默认开启，
     * 系统会在窗口层直接把返回动作转交给 OnBackInvokedDispatcher，
     * 此时 Activity.onBackPressed() 与 onKeyDown() 都不会被调用，
     * 必须注册 OnBackInvokedCallback 才能拦截。
     */
    private void registerBackHandler() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    () -> handleBack());
        }
    }

    private WebResourceResponse serveAsset(String assetPath) {
        try {
            InputStream input = getAssets().open(assetPath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-cache");
            WebResourceResponse response =
                    new WebResourceResponse(mimeTypeOf(assetPath), "utf-8", input);
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException e) {
            return null;
        }
    }

    private String mimeTypeOf(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".eot")) return "application/vnd.ms-fontobject";
        if (lower.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Android 14+ 已注册 OnBackInvokedCallback，这里再拦截会和它重复触发，
        // 导致一次按键回退两层；只有旧系统才走按键分发兜底。
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                handleBack();
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onBackPressed() {
        // Android 14+ 已由 OnBackInvokedCallback 接管，避免重复回退
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            handleBack();
        }
    }

    private void handleBack() {
        long now = SystemClock.elapsedRealtime();
        // 预测性返回与按键分发可能同时触发，做一次去抖避免一次按键回退两层
        if (now - lastBackAt < 400) {
            return;
        }
        lastBackAt = now;
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript(
                "(function(){return typeof window.__algerBack === 'function' && window.__algerBack()})()",
                value -> {
                    if (!"true".equals(value)) {
                        runOnUiThread(this::finish);
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** 给 LX 音源脚本用的原生 HTTP 通道，绕开 WebView 的 CORS 限制 */
    public static class MusicSourceBridge {
        @JavascriptInterface
        public String lxHttpRequest(String url, String optionsJson) {
            HttpURLConnection connection = null;
            try {
                JSONObject options = new JSONObject(optionsJson == null ? "{}" : optionsJson);
                String method = options.optString("method", "GET").toUpperCase(Locale.ROOT);
                String requestUrl = url;

                JSONObject params = options.optJSONObject("params");
                if (params != null && params.length() > 0) {
                    StringBuilder builder = new StringBuilder(requestUrl);
                    builder.append(requestUrl.contains("?") ? "&" : "?");
                    Iterator<String> keys = params.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        builder.append(URLEncoder.encode(key, "UTF-8"))
                                .append("=")
                                .append(URLEncoder.encode(String.valueOf(params.get(key)), "UTF-8"))
                                .append("&");
                    }
                    requestUrl = builder.toString();
                }

                connection = (HttpURLConnection) new URL(requestUrl).openConnection();
                connection.setRequestMethod(method);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(20000);
                connection.setInstanceFollowRedirects(true);

                JSONObject headers = options.optJSONObject("headers");
                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        connection.setRequestProperty(key, String.valueOf(headers.get(key)));
                    }
                }

                String body = null;
                if (options.has("body")) {
                    body = String.valueOf(options.get("body"));
                } else if (options.has("form")) {
                    JSONObject form = options.getJSONObject("form");
                    StringBuilder builder = new StringBuilder();
                    Iterator<String> keys = form.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        if (builder.length() > 0) builder.append("&");
                        builder.append(URLEncoder.encode(key, "UTF-8"))
                                .append("=")
                                .append(URLEncoder.encode(String.valueOf(form.get(key)), "UTF-8"));
                    }
                    body = builder.toString();
                    connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                } else if (options.has("data") && !"GET".equals(method) && !"HEAD".equals(method)) {
                    Object data = options.get("data");
                    body = data instanceof String ? (String) data : String.valueOf(data);
                }
                if (body != null) {
                    connection.setDoOutput(true);
                    connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
                    connection.getOutputStream().close();
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String text = readAll(stream);

                JSONObject responseHeaders = new JSONObject();
                for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
                    if (entry.getKey() != null && !entry.getValue().isEmpty()) {
                        responseHeaders.put(entry.getKey(), entry.getValue().get(0));
                    }
                }
                JSONObject result = new JSONObject();
                result.put("statusCode", status);
                result.put("headers", responseHeaders);
                result.put("body", text);
                return result.toString();
            } catch (Exception e) {
                JSONObject error = new JSONObject();
                try {
                    error.put("statusCode", 0);
                    error.put("headers", new JSONObject());
                    error.put("body", "");
                    error.put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {
                }
                return error.toString();
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        private static String readAll(InputStream stream) throws IOException {
            if (stream == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) != -1) out.write(buffer, 0, count);
            stream.close();
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
