package com.glm.office.agent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 前台服务：以子进程方式运行打包在 jniLibs 中的 GLM-Free-API Go 服务端
 * （libglmfreeapi.so，实为 android/arm64 可执行文件），监听 127.0.0.1:18080。
 *
 * 为什么不用 Activity 直接管理进程：Activity 退后台/被回收后子进程失去
 * 归属，随时可能被 LMK 连带清理。前台服务 + 常驻通知 + WakeLock 让系统
 * 将本应用视为用户可感知的前台任务，进程存活率大幅提升。
 */
public class GlmServerService extends Service {

    public static final String ACTION_START = "com.glm.office.agent.START";
    public static final String ACTION_STOP = "com.glm.office.agent.STOP";

    private static final String TAG = "GLM";
    private static final String CHANNEL_ID = "glm_server";
    private static final int NOTIF_ID = 1001;
    private static final int PORT = 18080;

    public enum State { STOPPED, STARTING, RUNNING }

    // 进程级单例状态（与 Activity 同进程，静态共享，UI 直接读）
    private static volatile State state = State.STOPPED;
    private static volatile Process process;
    private static volatile long startedAt = 0L;
    private static volatile String lastError = "";
    private static final AtomicReference<Integer> tokenCount = new AtomicReference<>(null);

    private PowerManager.WakeLock wakeLock;

    public static State getState() { return state; }
    public static long getStartedAt() { return startedAt; }
    public static String getLastError() { return lastError; }
    public static Integer getTokenCount() { return tokenCount.get(); }

    public static boolean isRunning() {
        Process p = process;
        return state == State.RUNNING && p != null && p.isAlive();
    }

    /** UI 定时器调用：进程已死但状态未纠正时自愈，避免状态显示卡死。 */
    public static void reconcile() {
        Process p = process;
        if (state != State.STOPPED && (p == null || !p.isAlive())) {
            state = State.STOPPED;
            if (p != null && lastError.isEmpty()) {
                try {
                    lastError = "process exited, code=" + p.exitValue();
                } catch (IllegalThreadStateException ignored) {
                }
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "glm:server");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopServer();
            return START_NOT_STICKY;
        }
        startAsForeground();
        if (!isRunning()) {
            startGoServer();
        }
        return START_STICKY;
    }

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID,
                    "GLM 本地服务", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("GLM-Free-API 本地代理服务运行状态");
            nm.createNotificationChannel(ch);
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // 通知栏直达入口：应用内 WebView 采集 device token
        PendingIntent harvestIntent = PendingIntent.getActivity(this, 1,
                new Intent(this, TokenHarvestActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Action harvestAction = new Notification.Action.Builder(
                null, "采集 Token", harvestIntent).build();
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notif = b
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("GLM Office Agent")
                .setContentText("本地模型服务运行中 · 127.0.0.1:" + PORT)
                .setContentIntent(contentIntent)
                .addAction(harvestAction)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, notif);
        }
    }

    private void startGoServer() {
        try {
            lastError = "";
            state = State.STARTING;

            String binPath = getApplicationInfo().nativeLibraryDir + "/libglmfreeapi.so";
            if (!new File(binPath).exists()) {
                lastError = "libglmfreeapi.so not found in nativeLibraryDir";
                Log.e(TAG, lastError);
                state = State.STOPPED;
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
                // assets 无预置 db —— 可通过通知栏"采集 Token"生成
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
            final Process p = pb.start();
            process = p;
            startedAt = System.currentTimeMillis();

            // 转发服务日志到 logcat；流结束 = 进程退出，记录退出码
            Thread logPump = new Thread(() -> {
                try (InputStream in = p.getInputStream()) {
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
                try {
                    lastError = "process exited, code=" + p.exitValue();
                } catch (IllegalThreadStateException ignored) {
                }
                if (process == p) {
                    state = State.STOPPED;
                }
            });
            logPump.setDaemon(true);
            logPump.start();

            state = State.RUNNING;
            Log.i(TAG, "GLM-Free-API starting on 127.0.0.1:" + PORT);
        } catch (Exception e) {
            lastError = e.getMessage() == null ? e.toString() : e.getMessage();
            Log.e(TAG, "Failed to start GLM-Free-API", e);
            state = State.STOPPED;
        }
    }

    private void stopServer() {
        Process p = process;
        if (p != null) {
            p.destroy();
            process = null;
        }
        state = State.STOPPED;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        Process p = process;
        if (p != null) {
            p.destroy();
            process = null;
        }
        state = State.STOPPED;
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
