package com.algermusic.app;

import android.net.Uri;
import android.util.Base64;
import android.webkit.WebResourceResponse;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** 把项目里 Node 版 netease-cloud-music-api-alger 的最小接口集移植到 APK 内部 */
final class NeteaseApi {
    private static final String API_DOMAIN = "https://interface.music.163.com";
    private static final String EAPI_KEY = "e82ckenh8dichen8";
    private static final String PRESET_KEY = "0CoJUm6Qyw8W8jud";
    private static final String IV = "0102030405060708";
    private static final String BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final String PUBLIC_KEY =
            "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB";
    private static final String UA_API =
            "NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)";
    private static final String UA_WEAPI =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    private NeteaseApi() {
    }

    static WebResourceResponse handle(Uri uri) {
        String path = uri.getPath();
        if (path == null) return null;
        try {
            JSONObject result;
            switch (path) {
                case "/cloudsearch":
                    result = cloudsearch(uri);
                    break;
                case "/personalized":
                    result = personalized(uri);
                    break;
                case "/recommend/songs":
                    result = recommendSongs();
                    break;
                case "/song/url":
                    result = songUrl(uri);
                    break;
                case "/lyric/new":
                    result = lyricNew(uri);
                    break;
                default:
                    result = new JSONObject().put("code", 404).put("msg", "unsupported api");
            }
            byte[] bytes = result.toString().getBytes(StandardCharsets.UTF_8);
            WebResourceResponse response =
                    new WebResourceResponse(
                            "application/json",
                            "utf-8",
                            new ByteArrayInputStream(bytes));
            java.util.Map<String, String> headers = new java.util.HashMap<>();
            headers.put("Access-Control-Allow-Origin", "https://appassets.androidplatform.net");
            headers.put("Access-Control-Allow-Credentials", "true");
            response.setResponseHeaders(headers);
            return response;
        } catch (Exception e) {
            android.util.Log.e("AlgerApi", "handle failed " + uri, e);
            byte[] bytes = errorJson(String.valueOf(e.getMessage()))
                    .toString()
                    .getBytes(StandardCharsets.UTF_8);
            return new WebResourceResponse(
                    "application/json", "utf-8", new ByteArrayInputStream(bytes));
        }
    }

    private static JSONObject errorJson(String message) {
        try {
            return new JSONObject().put("code", 500).put("msg", message);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private static JSONObject cloudsearch(Uri uri) throws Exception {
        JSONObject data = new JSONObject()
                .put("s", param(uri, "keywords", ""))
                .put("type", intParam(uri, "type", 1))
                .put("limit", intParam(uri, "limit", 30))
                .put("offset", intParam(uri, "offset", 0))
                .put("total", true);
        return request("/api/cloudsearch/pc", data, "eapi");
    }

    private static JSONObject personalized(Uri uri) throws Exception {
        JSONObject data = new JSONObject()
                .put("limit", intParam(uri, "limit", 30))
                .put("total", true)
                .put("n", 1000);
        return request("/api/personalized/playlist", data, "eapi");
    }

    private static JSONObject recommendSongs() throws Exception {
        return request("/api/v3/discovery/recommend/songs", new JSONObject(), "eapi");
    }

    private static JSONObject songUrl(Uri uri) throws Exception {
        String idParam = param(uri, "id", "");
        String[] ids = idParam.split(",");
        JSONArray idArray = new JSONArray();
        for (String id : ids) idArray.put(id);
        JSONObject data = new JSONObject()
                .put("ids", idArray.toString())
                .put("br", intParam(uri, "br", 999000));
        JSONObject result = request("/api/song/enhance/player/url", data, "eapi");
        JSONArray songs = result.optJSONArray("data");
        if (songs != null) {
            List<JSONObject> sorted = new ArrayList<>();
            for (int i = 0; i < songs.length(); i++) sorted.add(songs.getJSONObject(i));
            final List<String> order = new ArrayList<>();
            for (String id : ids) order.add(id);
            Collections.sort(sorted, (a, b) -> {
                int ia = order.indexOf(String.valueOf(a.optLong("id")));
                int ib = order.indexOf(String.valueOf(b.optLong("id")));
                return Integer.compare(ia < 0 ? 999 : ia, ib < 0 ? 999 : ib);
            });
            result.put("data", new JSONArray(sorted));
        }
        return result;
    }

    private static JSONObject lyricNew(Uri uri) throws Exception {
        JSONObject data = new JSONObject()
                .put("id", longParam(uri, "id", 0))
                .put("cp", false)
                .put("tv", 0).put("lv", 0).put("rv", 0).put("kv", 0)
                .put("yv", 0).put("ytv", 0).put("yrv", 0);
        return request("/api/song/lyric/v1", data, "eapi");
    }

    private static JSONObject request(String path, JSONObject data, String crypto) throws Exception {
        String url;
        String body;
        String ua;
        if ("weapi".equals(crypto)) {
            data.put("csrf_token", "");
            url = "https://music.163.com/weapi/" + path.substring(5);
            body = weapi(data);
            ua = UA_WEAPI;
        } else {
            data.put("header", apiHeader());
            url = API_DOMAIN + "/eapi/" + path.substring(5);
            body = eapi(path, data);
            ua = UA_API;
        }

        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        connection.setRequestProperty("User-Agent", ua);
        connection.setRequestProperty("Referer", "https://music.163.com");
        connection.setRequestProperty("Cookie", cookieHeader());
        try (OutputStream out = connection.getOutputStream()) {
            out.write(body.getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String text = readAll(stream);
        connection.disconnect();
        try {
            return new JSONObject(text);
        } catch (Exception e) {
            return new JSONObject().put("code", 500).put("msg", "bad upstream json: " + text.substring(0, Math.min(120, text.length())));
        }
    }

    private static JSONObject apiHeader() throws Exception {
        return new JSONObject()
                .put("osver", "14")
                .put("deviceId", UUID.randomUUID().toString())
                .put("os", "android")
                .put("appver", "8.20.20.231215173437")
                .put("versioncode", "140")
                .put("mobilename", "")
                .put("buildver", String.valueOf(System.currentTimeMillis()).substring(0, 10))
                .put("resolution", "1920x1080")
                .put("__csrf", "")
                .put("channel", "xiaomi")
                .put("requestId", System.currentTimeMillis() + "_0001");
    }

    private static String cookieHeader() throws Exception {
        JSONObject header = apiHeader();
        StringBuilder builder = new StringBuilder();
        java.util.Iterator<String> keys = header.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            if (builder.length() > 0) builder.append("; ");
            builder.append(key).append('=').append(header.opt(key));
        }
        return builder.toString();
    }

    private static String eapi(String path, JSONObject data) throws Exception {
        String text = data.toString();
        String digest = md5Hex("nobody" + path + "use" + text + "md5forencrypt");
        String payload = path + "-36cd479b6b5-" + text + "-36cd479b6b5-" + digest;
        return "params=" + URLEncoder.encode(aesEcbHex(payload, EAPI_KEY), "UTF-8");
    }

    private static String weapi(JSONObject data) throws Exception {
        String text = data.toString();
        String first = aesCbcBase64(text, PRESET_KEY);
        String secret = randomBase62(16);
        String params = aesCbcBase64(first, secret);
        String encSecKey = rsaHex(new StringBuilder(secret).reverse().toString());
        return "params=" + URLEncoder.encode(params, "UTF-8")
                + "&encSecKey=" + URLEncoder.encode(encSecKey, "UTF-8");
    }

    private static String aesCbcBase64(String text, String key) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE,
                new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES"),
                new IvParameterSpec(IV.getBytes(StandardCharsets.UTF_8)));
        return Base64.encodeToString(cipher.doFinal(text.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
    }

    private static String aesEcbHex(String text, String key) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES"));
        return hex(cipher.doFinal(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String rsaHex(String text) throws Exception {
        byte[] der = Base64.decode(PUBLIC_KEY, Base64.DEFAULT);
        java.security.PublicKey key = KeyFactory.getInstance("RSA")
                .generatePublic(new X509EncodedKeySpec(der));
        Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return hex(cipher.doFinal(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String md5Hex(String text) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return hex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String hex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) builder.append(String.format(Locale.ROOT, "%02X", b & 0xff));
        return builder.toString();
    }

    private static String randomBase62(int length) {
        SecureRandom random = new SecureRandom();
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) builder.append(BASE62.charAt(random.nextInt(BASE62.length())));
        return builder.toString();
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.read(buffer)) != -1) out.write(buffer, 0, count);
        stream.close();
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String param(Uri uri, String key, String fallback) {
        String value = uri.getQueryParameter(key);
        return value == null ? fallback : value;
    }

    private static int intParam(Uri uri, String key, int fallback) {
        try {
            return Integer.parseInt(param(uri, key, String.valueOf(fallback)));
        } catch (Exception e) {
            return fallback;
        }
    }

    private static long longParam(Uri uri, String key, long fallback) {
        try {
            return Long.parseLong(param(uri, key, String.valueOf(fallback)));
        } catch (Exception e) {
            return fallback;
        }
    }
}
