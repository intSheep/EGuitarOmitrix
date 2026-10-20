package io.github.intsheep.eguitaromitrix;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExportFilePlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                String[] resources = request.getResources();
                if (!"https://localhost".equals(request.getOrigin().toString().replaceAll("/$", "")) ||
                    resources.length != 1 || !PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resources[0])) {
                    request.deny();
                    return;
                }
                // Capacitor requests Android's runtime microphone permission on this explicit call.
                super.onPermissionRequest(request);
            }
        });
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
    }

    @Override
    public void onPause() {
        if (bridge != null) bridge.getWebView().evaluateJavascript("window.eguitarPauseForBackground?.()", null);
        super.onPause();
    }
}
