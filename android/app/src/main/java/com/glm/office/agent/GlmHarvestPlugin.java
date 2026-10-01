package com.glm.office.agent;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 极简 Capacitor 插件：让 WebView 内的 renderer 能打开原生
 * TokenHarvestActivity（window.glmHarvest()，见 api-shim.ts）。
 */
@CapacitorPlugin(name = "GlmHarvest")
public class GlmHarvestPlugin extends Plugin {

    @PluginMethod
    public void openHarvest(PluginCall call) {
        Intent i = new Intent(getContext(), TokenHarvestActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve(new JSObject().put("opened", true));
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("running", GlmServerService.isRunning());
        r.put("state", GlmServerService.getState().name());
        r.put("lastError", GlmServerService.getLastError());
        Integer tc = GlmServerService.getTokenCount();
        r.put("tokenCount", tc == null ? -1 : tc.intValue());
        call.resolve(r);
    }
}
