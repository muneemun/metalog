#!/bin/bash
set -e

echo "=== Building MetaLog Android Standalone APK ==="

REPO_DIR="/Users/muneemun/Documents/GitHub/MetaLog"
BUILD_DIR="/tmp/metalog-apk-build"
SDK_DIR="/Users/muneemun/Library/Android/sdk"
BUILD_TOOLS="$SDK_DIR/build-tools/34.0.0"
PLATFORM="$SDK_DIR/platforms/android-34/android.jar"
JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
JAVAC="$JAVA_HOME/bin/javac"
KEYTOOL="$JAVA_HOME/bin/keytool"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/obj" "$BUILD_DIR/compiled_res" "$BUILD_DIR/assets" "$BUILD_DIR/res/values" "$BUILD_DIR/res/mipmap-xxhdpi"

# 1. Prepare assets
echo "1. Copying web assets to APK assets folder..."
cp "$REPO_DIR/index.html" "$BUILD_DIR/assets/"
cp "$REPO_DIR/app.js" "$BUILD_DIR/assets/"
cp "$REPO_DIR/data.js" "$BUILD_DIR/assets/"
cp "$REPO_DIR/tailwind.min.js" "$BUILD_DIR/assets/"
cp "$REPO_DIR/manifest.json" "$BUILD_DIR/assets/"
cp "$REPO_DIR/icon-192.png" "$BUILD_DIR/assets/"
cp "$REPO_DIR/icon-512.png" "$BUILD_DIR/assets/"
cp "$REPO_DIR/favicon.svg" "$BUILD_DIR/assets/"
cp "$REPO_DIR/icon-192.png" "$BUILD_DIR/res/mipmap-xxhdpi/ic_launcher.png"

# In assets/index.html, ensure tailwind is local
sed -i '' 's|https://cdn.tailwindcss.com|tailwind.min.js|g' "$BUILD_DIR/assets/index.html"

# 2. Write Android resources
cat << 'EOF' > "$BUILD_DIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">메타로그</string>
</resources>
EOF

cat << 'EOF' > "$BUILD_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.metalog.app"
    android:versionCode="1"
    android:versionName="1.1.6">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:allowBackup="true"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# 3. Write MainActivity.java
mkdir -p "$BUILD_DIR/src/com/metalog/app"
cat << 'EOF' > "$BUILD_DIR/src/com/metalog/app/MainActivity.java"
package com.metalog.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        // Load self-contained local webapp from assets
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
EOF

# 4. Compile resources with aapt2
echo "2. Compiling resources with aapt2..."
"$BUILD_TOOLS/aapt2" compile --dir "$BUILD_DIR/res" -o "$BUILD_DIR/compiled_res.zip"

echo "3. Linking APK with aapt2..."
"$BUILD_TOOLS/aapt2" link "$BUILD_DIR/compiled_res.zip" \
    -I "$PLATFORM" \
    --manifest "$BUILD_DIR/AndroidManifest.xml" \
    -A "$BUILD_DIR/assets" \
    --java "$BUILD_DIR/gen" \
    -o "$BUILD_DIR/app-unaligned.apk" \
    --min-sdk-version 24 \
    --target-sdk-version 34

# 5. Compile Java source
echo "4. Compiling Java sources..."
"$JAVAC" -encoding UTF-8 \
    -classpath "$PLATFORM" \
    -d "$BUILD_DIR/obj" \
    "$BUILD_DIR/gen/com/metalog/app/R.java" \
    "$BUILD_DIR/src/com/metalog/app/MainActivity.java"

# 6. Convert bytecode to Dalvik (classes.dex) with d8
echo "5. Converting to Dalvik DEX with d8..."
"$BUILD_TOOLS/d8" \
    --lib "$PLATFORM" \
    --output "$BUILD_DIR" \
    "$BUILD_DIR"/obj/com/metalog/app/*.class

# 7. Add classes.dex to the unaligned APK
echo "6. Adding classes.dex to APK..."
cd "$BUILD_DIR"
jar -uf app-unaligned.apk classes.dex

# 8. Align APK with zipalign
echo "7. Aligning APK with zipalign..."
"$BUILD_TOOLS/zipalign" -f -v 4 app-unaligned.apk app-aligned.apk > /dev/null

# 9. Sign APK with debug keystore
echo "8. Signing APK..."
if [ ! -f "$REPO_DIR/debug.keystore" ]; then
    "$KEYTOOL" -genkeypair -v \
        -keystore "$REPO_DIR/debug.keystore" \
        -storepass android \
        -alias androiddebugkey \
        -keypass android \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US"
fi

"$BUILD_TOOLS/apksigner" sign \
    --ks "$REPO_DIR/debug.keystore" \
    --ks-pass pass:android \
    --ks-key-alias androiddebugkey \
    --key-pass pass:android \
    --out "$REPO_DIR/metalog.apk" \
    app-aligned.apk

# Verify signature
"$BUILD_TOOLS/apksigner" verify "$REPO_DIR/metalog.apk"

echo "=== SUCCESS! Standalone APK built at: $REPO_DIR/metalog.apk ==="
ls -lh "$REPO_DIR/metalog.apk"
