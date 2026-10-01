package com.glm.office.agent;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GlmHarvestPlugin.class);
        super.onCreate(savedInstanceState);
        ensureNotificationPermission();
        startGlmForegroundService();
    }

    /**
     * Go 服务生命周期交给前台服务管理（保活 + 常驻通知 + 采集入口），
     * 不再挂在 Activity 上——Activity 被回收不影响服务。
     */
    private void startGlmForegroundService() {
        Intent i = new Intent(this, GlmServerService.class);
        i.setAction(GlmServerService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(i);
        } else {
            startService(i);
        }
    }

    private void ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            Toast.makeText(this, "建议允许通知：前台服务保活与采集入口依赖通知栏",
                    Toast.LENGTH_LONG).show();
        }
    }
}
