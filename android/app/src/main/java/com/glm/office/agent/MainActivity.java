package com.glm.office.agent;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "GLM";
    private static final int PORT = 18080;
    private Process glmProcess;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startGlmService();
    }

    /**
     * 从 nativeLibraryDir 启动内嵌的 GLM-Free-API（Go）。
     * 二进制以 libglmfreeapi.so 形式打进 APK（Android 仅允许执行
     * nativeLibraryDir 下 lib 前缀的文件），监听 127.0.0.1:18080。
     * WebView 内通过 window.electronAPI 的 HTTP shim（api-shim.ts）访问。
     */
    private void startGlmService() {
        try {
            String binPath = getApplicationInfo().nativeLibraryDir + "/libglmfreeapi.so";
            if (!new File(binPath).exists()) {
                Log.e(TAG, "libglmfreeapi.so not found in nativeLibraryDir");
                return;
            }

            File dbFile = new File(getFilesDir(), "tokens.sqlite");
            // 首次启动时从 assets 解出预置的 tokens.sqlite（如有）
            try (InputStream is = getAssets().open("tokens.sqlite")) {
                if (!dbFile.exists()) {
                    try (FileOutputStream fos = new FileOutputStream(dbFile)) {
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) > 0) fos.write(buf, 0, n);
                    }
                    Log.i(TAG, "tokens.sqlite copied from assets");
                }
            } catch (Exception ignored) {
                // assets 无预置 db —— 需用户自行放置（adb push 到 filesDir）
            }

            List<String> args = new ArrayList<>();
            args.add(binPath);
            args.add("-agent-mode");
            if (dbFile.exists()) {
                args.add("-db-path");
                args.add(dbFile.getAbsolutePath());
            }

            ProcessBuilder pb = new ProcessBuilder(args);
            pb.environment().put("PORT", String.valueOf(PORT));
            pb.environment().put("HOST", "127.0.0.1");
            pb.redirectErrorStream(true);
            glmProcess = pb.start();

            // 转发服务日志到 logcat
            Thread logPump = new Thread(() -> {
                try (InputStream in = glmProcess.getInputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    StringBuilder line = new StringBuilder();
                    while ((n = in.read(buf)) > 0) {
                        line.append(new String(buf, 0, n));
                        int idx;
                        while ((idx = line.indexOf("\n")) >= 0) {
                            Log.i(TAG, line.substring(0, idx));
                            line.delete(0, idx + 1);
                        }
                    }
                } catch (Exception ignored) {
                }
            });
            logPump.setDaemon(true);
            logPump.start();

            Log.i(TAG, "GLM-Free-API starting on 127.0.0.1:" + PORT);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start GLM-Free-API", e);
        }
    }

    @Override
    public void onDestroy() {
        if (glmProcess != null) {
            glmProcess.destroy();
            glmProcess = null;
        }
        super.onDestroy();
    }
}
