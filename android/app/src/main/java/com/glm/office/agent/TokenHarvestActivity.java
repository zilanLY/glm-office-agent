package com.glm.office.agent;

import android.app.Activity;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 应用内 device token 采集器。
 *
 * 原理：WebView 加载 chat.z.ai，页面自带的 z_um 反爬 SDK 就绪后调用
 * window.z_um.getToken() 生成 device token；JS 侧把结果推进
 * window.__glmTokens 数组，Android 侧轮询读取并直接写入
 * filesDir/tokens.sqlite（表 tokens(id, token, batch)，与 Go 服务端
 * modernc/sqlite 的 schema 一致，WAL 模式跨进程共享）。
 *
 * 风控策略：保留真机真实环境（真机即合法用户），仅移除 WebView UA 的
 * "; wv" 标记，让 UA 与普通 Chrome 一致。
 *
 * 采集完成后 Go 服务端无需重启：db 持有层按查询实时读库，/health 的
 * token 计数有 5s TTL 缓存，稍后自行刷新。
 */
public class TokenHarvestActivity extends Activity {

    private static final String TARGET_URL = "https://chat.z.ai";
    private static final int MAX_SDK_WAIT_MS = 45000;
    /** 与 Go 端 zbridge/db.go 的 schema 保持一致 */
    private static final String SQL_CREATE =
            "CREATE TABLE IF NOT EXISTS tokens (" +
            " id INTEGER PRIMARY KEY AUTOINCREMENT," +
            " token TEXT NOT NULL," +
            " batch INTEGER NOT NULL)";

    private WebView webView;
    private TextView statusText;
    private TextView resultText;
    private ProgressBar progress;
    private Button btnStart;
    private Button btnClose;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean harvesting = false;
    private final List<String> collected = new ArrayList<>();
    private int failCount = 0;
    private long batchId;
    private int target = 50;
    private int sdkWaitLoops = 0;
    private final Random random = new Random();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        batchId = System.currentTimeMillis() / 1000L;
        buildUi();
        setupWebView();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);

        statusText = new TextView(this);
        statusText.setText("正在加载 " + TARGET_URL + " …");
        statusText.setTextSize(14);
        root.addView(statusText);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        resultText = new TextView(this);
        resultText.setText("已采集: 0 · 失败: 0");
        resultText.setTextSize(16);
        root.addView(resultText);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        btnStart = new Button(this);
        btnStart.setText("开始采集");
        btnStart.setEnabled(false);
        btnStart.setOnClickListener(v -> {
            target = 50;
            startHarvest();
        });
        row.addView(btnStart, new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        btnClose = new Button(this);
        btnClose.setText("完成并关闭");
        btnClose.setOnClickListener(v -> finish());
        row.addView(btnClose, new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        root.addView(row);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        lp.setMargins(0, pad / 2, 0, 0);
        root.addView(new TextView(this), lp);

        setContentView(root);
    }

    private void setupWebView() {
        webView = new WebView(this);
        // 容器不放进布局树也必须先初始化；采集过程用全屏覆盖，返回键/关闭按钮退出
        addContentView(webView, new ViewGroup.LayoutParams(1, 1));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setBlockNetworkImage(true); // 只要 SDK 跑起来，无需渲染图片，省流量
        // 去掉 WebView 指纹："; wv" 标记 + Engine 名称对齐 Chrome
        String ua = s.getUserAgentString();
        if (ua != null) {
            s.setUserAgentString(ua.replace("; wv", ""));
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                injectProbe();
            }
        });
        webView.loadUrl(TARGET_URL);
    }

    /** 注入采集桥：SDK 就绪探测 + token 收集数组 + Android 回调桥 */
    private void injectProbe() {
        webView.evaluateJavascript(
            "(function(){" +
            " window.__glmTokens = window.__glmTokens || [];" +
            " if (!window.__glmBridge) {" +
            "   window.__glmBridge = true;" +
            "   try {" +
            "     function glmPush(){" +
            "       try {" +
            "         if (window.z_um && typeof window.z_um.getToken === 'function') {" +
            "           var r = window.z_um.getToken();" +
            "           Promise.resolve(r).then(function(t){" +
            "             if (t) window.__glmTokens.push(String(t));" +
            "           }).catch(function(){});" +
            "         }" +
            "       } catch(e) {}" +
            "       setTimeout(glmPush, 250 + Math.random()*400);" +
            "     }" +
            "     glmPush();" +
            "   } catch(e) {}" +
            " }" +
            " return window.z_um ? 'sdk-ready' : 'sdk-missing';" +
            "})()", value -> {
                String v = value != null ? value.replace("\"", "") : "";
                if ("sdk-ready".equals(v)) {
                    runOnUiThread(() -> {
                        statusText.setText("z_um SDK 就绪，点\"开始采集\"批量获取 device token");
                        btnStart.setEnabled(true);
                    });
                } else {
                    sdkWaitLoops++;
                    if (sdkWaitLoops * 1500 < MAX_SDK_WAIT_MS) {
                        handler.postDelayed(this::injectProbe, 1500);
                    } else {
                        runOnUiThread(() -> statusText.setText(
                                "z_um SDK 未就绪（可能被风控或页面改版）。请检查网络后重试。"));
                    }
                }
            });
    }

    private void startHarvest() {
        if (harvesting) return;
        harvesting = true;
        failCount = 0;
        btnStart.setEnabled(false);
        statusText.setText("采集中…（目标 " + target + " 个）");
        collectLoop(0);
    }

    private void collectLoop(final int got) {
        if (!harvesting || got >= target) {
            finishHarvest(got);
            return;
        }
        webView.evaluateJavascript(
            "JSON.stringify(window.__glmTokens || [])", value -> {
                List<String> fresh = new ArrayList<>();
                if (value != null && value.length() > 2) {
                    String json = value;
                    if (json.startsWith("\"") && json.endsWith("\"")) {
                        json = json.substring(1, json.length() - 1)
                                .replace("\\\"", "\"").replace("\\\\", "\\");
                    }
                    try {
                        org.json.JSONArray arr = new org.json.JSONArray(json);
                        for (int i = 0; i < arr.length(); i++) {
                            fresh.add(arr.getString(i));
                        }
                    } catch (Exception ignored) {
                    }
                }
                final List<String> batch = fresh;
                handler.post(() -> {
                    if (!batch.isEmpty()) {
                        webView.evaluateJavascript("window.__glmTokens = [];", null);
                        int written = writeToDb(batch);
                        collected.addAll(batch);
                        progress.setProgress((collected.size() * 100) / Math.max(target, 1));
                        resultText.setText("已采集: " + collected.size() + " · 失败: " + failCount);
                        collectLoop(collected.size());
                    } else {
                        failCount++;
                        resultText.setText("已采集: " + collected.size() + " · 失败: " + failCount);
                        handler.postDelayed(() -> collectLoop(got), 900);
                    }
                });
            });
    }

    private int writeToDb(List<String> tokens) {
        File db = new File(getFilesDir(), "tokens.sqlite");
        try (SQLiteDatabase s = SQLiteDatabase.openOrCreateDatabase(db, null)) {
            s.execSQL(SQL_CREATE);
            s.beginTransaction();
            int n = 0;
            try {
                for (String t : tokens) {
                    if (t == null || t.trim().isEmpty()) continue;
                    s.execSQL("INSERT INTO tokens (token, batch) VALUES (?, ?)",
                            new Object[]{t.trim(), batchId});
                    n++;
                }
                s.setTransactionSuccessful();
            } finally {
                s.endTransaction();
            }
            return n;
        } catch (Exception e) {
            Toast.makeText(this, "写入 tokens.sqlite 失败: " + e.getMessage(),
                    Toast.LENGTH_LONG).show();
            return 0;
        }
    }

    private void finishHarvest(int got) {
        harvesting = false;
        runOnUiThread(() -> {
            btnStart.setEnabled(true);
            if (got > 0) {
                statusText.setText("完成：本次写入 " + got + " 个 token（batch " + batchId + "）。"
                        + "服务端自动读取，/health 计数约 5 秒后刷新。");
                Toast.makeText(this, "采集完成 +" + got, Toast.LENGTH_SHORT).show();
            } else {
                statusText.setText("未采集到新 token（失败 " + failCount + " 次）。"
                        + "可稍后重试，或检查网络/风控状态。");
            }
        });
    }

    /** JS 桥备用接口（冗余通道，便于调试） */
    public class Bridge {
        @JavascriptInterface
        public void pushToken(String token) {
            if (token != null && !token.trim().isEmpty()) {
                handler.post(() -> {
                    if (writeToDb(java.util.Collections.singletonList(token.trim())) > 0) {
                        collected.add(token.trim());
                    }
                });
            }
        }
    }

    @Override
    protected void onDestroy() {
        harvesting = false;
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
