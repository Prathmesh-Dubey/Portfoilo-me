package com.prathmesh.reuseme;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.BridgeActivity;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import org.json.JSONObject;

/**
 * The ReuseMe app is the website (https://reuseme-zeta.vercel.app) in a WebView. WebViews ignore file downloads, so:
 *  - normal download links (e.g. "Download resume") are handed to Android's DownloadManager, with the site's cookies;
 *  - files the page makes itself (the resume builder's PDF, admin backups) come through window.ReuseMeApp.saveFile().
 * Both end up in the phone's Downloads folder.
 *
 * Google also refuses its web sign-in inside app WebViews, so "Continue with Google" uses Android's own account picker
 * (Credential Manager) via window.ReuseMeApp.googleSignIn(webClientId). The resulting Google ID token is handed back to
 * the page (window.__reuseMeGoogle), which sends it to /api/auth/google exactly like the website's Google button does.
 */
public class MainActivity extends BridgeActivity {

    private static final int MAX_FILE_BYTES = 15 * 1024 * 1024;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new FileBridge(), "ReuseMeApp");
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url.startsWith("http://") || url.startsWith("https://")) download(url, userAgent, contentDisposition, mimeType);
        });
    }

    private void download(String url, String userAgent, String contentDisposition, String mimeType) {
        try {
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .setMimeType(mimeType)
                .addRequestHeader("User-Agent", userAgent)
                .setTitle(fileName)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            } else {
                // older Android needs a storage permission for the public folder; the app's own folder needs none
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);
            }
            ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
            toast("Downloading " + fileName);
        } catch (Exception e) {
            toast("Couldn't download the file");
        }
    }

    /** Called from the page as window.ReuseMeApp.saveFile(...) and window.ReuseMeApp.googleSignIn(...). */
    private class FileBridge {

        @JavascriptInterface
        public void googleSignIn(String webClientId) {
            if (webClientId == null || !webClientId.endsWith(".apps.googleusercontent.com")) {
                sendGoogleResult("error", "Google sign-in isn't set up");
                return;
            }
            runOnUiThread(() -> startGoogleSignIn(webClientId));
        }

        @JavascriptInterface
        public void saveFile(String base64, String fileName, String mimeType) {
            try {
                String mime = "application/json".equals(mimeType) ? "application/json" : "application/pdf";
                String name = fileName == null ? "" : fileName.replaceAll("[^\\w .-]", "_");
                if (name.isEmpty()) name = "ReuseMe-file";
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (data.length == 0 || data.length > MAX_FILE_BYTES) throw new IllegalArgumentException("bad size");

                Uri saved;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    values.put(MediaStore.Downloads.MIME_TYPE, mime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    saved = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (saved == null) throw new IllegalStateException("no uri");
                    try (OutputStream out = getContentResolver().openOutputStream(saved)) {
                        out.write(data);
                    }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File file = new File(dir, name);
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(data);
                    }
                    saved = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                }
                toast("Saved to Downloads: " + name);
                open(saved, mime);
            } catch (Exception e) {
                toast("Couldn't save the file");
            }
        }
    }

    private void startGoogleSignIn(String webClientId) {
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(webClientId).build())
            .build();
        CredentialManager.create(this).getCredentialAsync(
            this,
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(this),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential credential = response.getCredential();
                    if (credential instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        sendGoogleResult("ok", GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken());
                    } else {
                        sendGoogleResult("error", "Unexpected sign-in result");
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    // Show Google's exact reason: a misconfigured OAuth client often comes back looking like a cancel.
                    String detail = e.getClass().getSimpleName() + ": " + e.getMessage();
                    toast("Google sign-in: " + detail);
                    sendGoogleResult(e instanceof GetCredentialCancellationException ? "cancel" : "error", detail);
                }
            }
        );
    }

    private void sendGoogleResult(String status, String value) {
        String js = "window.__reuseMeGoogle && window.__reuseMeGoogle(" + JSONObject.quote(status) + "," + JSONObject.quote(value) + ")";
        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    /** Opens the saved file (e.g. in a PDF viewer) when the phone has an app for it. */
    private void open(Uri uri, String mime) {
        runOnUiThread(() -> {
            try {
                Intent view = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(view);
            } catch (ActivityNotFoundException ignored) {
                // saved anyway; nothing to open it with
            }
        });
    }

    private void toast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }
}
