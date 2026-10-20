package io.github.intsheep.eguitaromitrix;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/** Explicit user-selected document export. No storage permission or background file writes. */
@CapacitorPlugin(name = "ExportFile")
public class ExportFilePlugin extends Plugin {
    private boolean exporting = false;

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "");
        String data = call.getString("data", "");
        if (exporting) { call.reject("请先完成当前文件保存"); return; }
        if (!name.matches("eguitar-practice\\.json|practice\\.gp|practice\\.musicxml") || data.length() > 128 * 1024 * 1024) {
            call.reject("导出文件无效或过大"); return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(name.endsWith(".json") ? "application/json" : "application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, name);
        exporting = true;
        try { startActivityForResult(call, intent, "documentSelected"); }
        catch (Exception error) { exporting = false; call.reject("无法打开系统文件保存窗口"); }
    }

    @ActivityCallback
    private void documentSelected(PluginCall call, ActivityResult result) {
        exporting = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("cancelled", true)); return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
            if (out == null) throw new IllegalStateException("No output stream");
            out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            out.flush();
        } catch (Exception error) {
            call.reject("文件保存失败，请重试");
            return;
        }
        call.resolve(new JSObject().put("saved", true));
    }
}
