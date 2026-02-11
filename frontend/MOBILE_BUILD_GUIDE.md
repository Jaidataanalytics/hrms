# Sharda HR — Android APK Build Guide

## Prerequisites
- **Node.js** 18+ (recommend 20+)
- **Android Studio** with Android SDK (API 33+)
- **Java JDK** 17+

---

## Step 1: Clone & Setup

```bash
# Clone the repo (or download from Emergent)
cd frontend

# Install dependencies
yarn install
```

## Step 2: Firebase Setup (for Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project called "Sharda HR"
3. Add an **Android app** with package name: `com.shardahr.app`
4. Download `google-services.json`
5. Go to **Project Settings > Cloud Messaging** tab
6. Copy the **Server Key** (Legacy) — you'll need this for the backend

### Add Server Key to Backend
Add to your backend `.env` file:
```
FIREBASE_SERVER_KEY=your_server_key_here
```

## Step 3: Build the Web App

```bash
cd frontend
yarn build
```

## Step 4: Initialize Capacitor Android

```bash
npx cap add android
npx cap sync
```

## Step 5: Place Firebase Config

Copy the downloaded `google-services.json` to:
```
frontend/android/app/google-services.json
```

## Step 6: Android Permissions

The permissions are auto-configured by Capacitor plugins, but verify in:
`android/app/src/main/AndroidManifest.xml`

Should include:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Step 7: Build APK

### Option A: Using Android Studio
1. Open `frontend/android` in Android Studio
2. Wait for Gradle sync to complete
3. **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B: Command Line
```bash
cd android
./gradlew assembleDebug
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## Step 8: Install on Phone

```bash
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or share the APK file directly via WhatsApp/email
```

---

## How It Works

- The app is a **WebView wrapper** around `https://shardahrms.com`
- Native plugins handle: **push notifications** (FCM), **GPS geolocation**, **status bar**
- The bottom navigation bar appears on mobile screens automatically
- All data comes from the same backend — nothing changes server-side
- The app auto-registers its FCM token on login → backend sends push notifications

## Customization

### App Icon
Replace `android/app/src/main/res/mipmap-*/ic_launcher.png` with your logo

### Splash Screen
Configured in `capacitor.config.json` — dark background matching the login screen

---

## Troubleshooting

**White screen on app launch:**
- Ensure `https://shardahrms.com` is accessible
- Check Android allows cleartext if using http (not needed for https)

**Push notifications not working:**
- Verify `google-services.json` is in `android/app/`
- Check `FIREBASE_SERVER_KEY` is set in backend `.env`
- Ensure the device has Google Play Services

**GPS not working:**
- Check location permission is granted in Android Settings
- Enable GPS on the device
