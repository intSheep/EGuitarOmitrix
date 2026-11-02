package io.github.intsheep.eguitaromitrix;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Installed-package updates only; never downloads executable web content. */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String RELEASES = "https://api.github.com/repos/intSheep/EGuitarOmitrix/releases/latest";
    private static final long MAX_APK = UpdatePolicy.MAX_APK;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean busy;
    private volatile boolean destroyed;
    private volatile boolean cancelDownload;
    private AlertDialog dialog;

    private void ui(Runnable action) {
        if (!destroyed) getActivity().runOnUiThread(() -> {
            if (!destroyed && !getActivity().isFinishing()) action.run();
        });
    }
    private void done(PluginCall call) { busy = false; call.resolve(); }
    private void fail(PluginCall call, Exception error) {
        ui(() -> { busy = false; call.reject("更新未完成，当前版本仍可使用：" + error.getMessage()); });
    }
    private InputStream open(String value) throws Exception {
        for (int redirects = 0; redirects < 6; redirects++) {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null || uri.getPort() != -1 || host == null ||
                !(host.equals("api.github.com") || host.equals("github.com") || host.endsWith(".githubusercontent.com")))
                throw new IOException("更新地址无效");
            HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "EGuitarOmitrix-Android");
            int status = connection.getResponseCode();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = connection.getHeaderField("Location"); connection.disconnect();
                if (location == null) throw new IOException("下载地址缺失");
                value = uri.resolve(location).toString(); continue;
            }
            if (status != 200) { connection.disconnect(); throw new IOException("服务器返回 " + status); }
            return new FilterInputStream(connection.getInputStream()) {
                @Override public void close() throws IOException { try { super.close(); } finally { connection.disconnect(); } }
            };
        }
        throw new IOException("下载重定向过多");
    }
    private JSONObject json(String url) throws Exception {
        try (InputStream input = open(url); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192]; int n;
            while ((n = input.read(bytes)) != -1) {
                if (output.size() + n > 2 * 1024 * 1024) throw new IOException("版本信息过大");
                output.write(bytes, 0, n);
            }
            return new JSONObject(output.toString("UTF-8"));
        }
    }
    private String asset(JSONObject release, String name) throws Exception {
        JSONArray assets = release.getJSONArray("assets");
        for (int i = 0; i < assets.length(); i++) {
            JSONObject item = assets.getJSONObject(i);
            if (name.equals(item.getString("name"))) return item.getString("browser_download_url");
        }
        throw new IOException("该版本缺少 Android 更新文件");
    }
    private static long packageVersion(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }
    @PluginMethod
    public void check(PluginCall call) {
        ui(() -> {
            if (busy) { call.reject("正在处理更新，请稍候"); return; }
            busy = true;
            worker.execute(() -> {
                try {
                    JSONObject release = json(RELEASES);
                    if (release.getBoolean("draft") || release.getBoolean("prerelease")) throw new IOException("没有可用的正式版本");
                    String version = release.getString("tag_name").replaceFirst("^v", "");
                    long code = UpdatePolicy.versionCode(version);
                    PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
                    if (code <= packageVersion(installed)) {
                        ui(() -> { dialog = new AlertDialog.Builder(getActivity()).setTitle("已是最新版本")
                            .setMessage("当前版本 " + installed.versionName).setPositiveButton("好的", (d,w) -> {})
                            .setOnDismissListener(d -> done(call)).show(); }); return;
                    }
                    JSONObject manifest = json(asset(release, "android-manifest.json"));
                    if (!version.equals(manifest.getString("version")) || !"android".equals(manifest.getString("platform")))
                        throw new IOException("更新清单与版本不匹配");
                    JSONArray artifacts = manifest.getJSONArray("artifacts");
                    JSONObject apk = null;
                    for (int i = 0; i < artifacts.length(); i++) {
                        JSONObject item = artifacts.getJSONObject(i);
                        if (item.getString("name").matches("EGuitarOmitrix-" + java.util.regex.Pattern.quote(version) + "-android.*\\.apk")) {
                            if (apk != null) throw new IOException("更新文件不唯一"); apk = item;
                        }
                    }
                    if (apk == null || !UpdatePolicy.validMetadata(apk.getLong("bytes"), apk.getString("sha256")))
                        throw new IOException("更新文件信息无效");
                    JSONObject target = apk;
                    String url = asset(release, apk.getString("name"));
                    ui(() -> {
                        dialog = new AlertDialog.Builder(getActivity()).setTitle("发现新版本 " + version)
                            .setMessage("下载后会校验文件和签名，安装前会保存并暂停练习。不会自动退出应用。")
                            .setNegativeButton("稍后", (d,w) -> done(call))
                            .setPositiveButton("下载更新", (d,w) -> download(call, target, url, code))
                            .setOnCancelListener(d -> done(call)).show();
                    });
                } catch (Exception error) { fail(call, error); }
            });
        });
    }
    private void download(PluginCall call, JSONObject target, String url, long code) {
        cancelDownload = false;
        dialog = new AlertDialog.Builder(getActivity()).setTitle("正在下载更新")
            .setMessage("下载中…可继续使用当前版本，安装会再次询问。")
            .setCancelable(false).setNegativeButton("取消下载", (d,w) -> { cancelDownload = true; }).show();
        worker.execute(() -> {
            File file = new File(getContext().getCacheDir(), "app-update.apk");
            try {
                long total = 0, expected = target.getLong("bytes"); int lastPercent = -1;
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream input = open(url); OutputStream output = new FileOutputStream(file)) {
                    byte[] buffer = new byte[65536]; int n;
                    while ((n = input.read(buffer)) != -1) {
                        if (destroyed || cancelDownload || Thread.currentThread().isInterrupted()) throw new IOException("下载已停止");
                        total += n; if (total > expected || total > MAX_APK) throw new IOException("文件大小不匹配");
                        output.write(buffer, 0, n); digest.update(buffer, 0, n);
                        int percent = (int) (total * 100 / expected);
                        if (percent != lastPercent) { lastPercent = percent; ui(() -> dialog.setMessage("已下载 " + percent + "%")); }
                    }
                }
                if (cancelDownload) throw new IOException("下载已取消");
                StringBuilder hash = new StringBuilder();
                for (byte b : digest.digest()) hash.append(String.format("%02x", b & 255));
                UpdatePolicy.verifyIntegrity(total, expected, hash.toString(), target.getString("sha256"));
                verifyPackage(file, code);
                ui(() -> {
                    dialog.dismiss();
                    dialog = new AlertDialog.Builder(getActivity()).setTitle("更新已下载并校验")
                        .setMessage("保存并暂停练习后，打开系统安装窗口。练习记录会保留。")
                        .setNegativeButton("稍后", (d,w) -> done(call))
                        .setPositiveButton("保存并安装", (d,w) -> install(call, file))
                        .setOnCancelListener(d -> done(call)).show();
                });
            } catch (Exception error) {
                file.delete(); ui(() -> { if(dialog != null) dialog.dismiss(); });
                if (cancelDownload) ui(() -> done(call)); else fail(call, error);
            }
        });
    }
    private void verifyPackage(File file, long code) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = pm.getPackageArchiveInfo(file.getPath(), flags);
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        if (candidate == null || !installed.packageName.equals(candidate.packageName) || packageVersion(candidate) != code ||
            code <= packageVersion(installed))
            throw new IOException("安装包身份或版本无效");
        Signature[] current = Build.VERSION.SDK_INT >= 28 && installed.signingInfo != null ? installed.signingInfo.getApkContentsSigners() : installed.signatures;
        Signature[] incoming = Build.VERSION.SDK_INT >= 28 && candidate.signingInfo != null ? candidate.signingInfo.getApkContentsSigners() : candidate.signatures;
        if (current == null || incoming == null || current.length == 0) throw new IOException("签名信息缺失");
        // Stable release key required. Do not uninstall or erase data to bypass mismatch.
        if (!UpdatePolicy.sameSigners(current, incoming))
            throw new IOException("签名不匹配，已阻止更新；请先导出备份，勿卸载应用");
    }
    private void install(PluginCall call, File file) {
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(getActivity()).setTitle("需要允许安装更新")
                .setMessage("请在系统设置中允许此应用安装更新，然后返回重新检查更新。")
                .setNegativeButton("稍后", (d,w) -> done(call))
                .setPositiveButton("前往设置", (d,w) -> {
                    try { getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()))); done(call); }
                    catch (Exception error) { fail(call, error); }
                }).setOnCancelListener(d -> done(call)).show(); return;
        }
        pendingInstall = file; pendingCall = call;
        bridge.getWebView().evaluateJavascript("(async()=>{try{return await window.eguitarPrepareForUpdate()===true}catch(e){return false}})().then(ok=>window.Capacitor.Plugins.AppUpdate.prepared({ok}))", null);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (pendingCall == call) { pendingCall = null; pendingInstall = null; fail(call, new IOException("练习保存确认超时，请重试")); }
        }, 15000);
    }
    private File pendingInstall;
    private PluginCall pendingCall;
    @PluginMethod
    public void prepared(PluginCall response) {
        ui(() -> {
            File file = pendingInstall; PluginCall call = pendingCall;
            pendingInstall = null; pendingCall = null;
            if (file == null || call == null) { response.reject("没有待安装更新"); return; }
            response.resolve();
            if (!Boolean.TRUE.equals(response.getBoolean("ok"))) { fail(call, new IOException("请先保存或关闭当前编辑和观看记录")); return; }
            try {
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(intent); done(call);
            } catch (Exception error) { fail(call, error); }
        });
    }
    @Override
    protected void handleOnDestroy() {
        destroyed = true; worker.shutdownNow(); if (dialog != null) dialog.dismiss();
        super.handleOnDestroy();
    }
}
