# TalentIQ Mobile - Full Setup & Build Process

This guide takes the project from Expo web to a real mobile app installable via an app icon on iOS and Android devices.

## 1. What changed (already applied)

| File | Change |
|------|--------|
| `app.json` | Added iOS bundle ID, Android package, splash screen config, adaptive icon, permissions, deep-link intent filters, `expo-splash-screen` plugin |
| `eas.json` | EAS Build / Submit profiles for development, preview, and production |
| `package.json` | Added `dev:android`, `dev:ios`, `build:android`, `build:ios`, `submit` scripts |
| `assets/images/splash.png` | Splash screen image (placeholder — replace with your design) |
| `assets/images/adaptive-icon.png` | Android adaptive icon foreground (placeholder — replace with your design) |
| `data/talentiq.ts` | `initialProfile.skills` changed from 6 hardcoded skills to `[]` (real user data only) |

## 2. Prerequisites

Install these once on your machine:

```bash
# Node.js (LTS) + pnpm
# Then:
pnpm install
pnpm exec eas login        # log into your Expo account (create one at expo.dev)
```

You need an **Expo account** to build native binaries via EAS (Expo Application Services).

## 3. Run on a real device / emulator (development)

### Option A: Expo Go (fastest, no build)

```bash
# Start the dev server
pnpm dev

# On your phone, install "Expo Go" from the App Store / Play Store,
# scan the QR code shown in the terminal.
```

The app opens inside Expo Go with its own icon. Good for testing, but not a standalone app icon on the home screen.

### Option B: Development client (real app icon, hot reloading)

```bash
# Install expo-dev-client (one-time)
pnpm add -D expo-dev-client

# Build and install a dev client on your device
pnpm dev:android      # Android
pnpm dev:ios          # iOS (needs macOS + Xcode)
```

This installs a debug build with the TalentIQ icon on your home screen. Code changes update live via the dev server.

## 4. Build a standalone release APK / AAB (Android)

```bash
# Preview build (APK — installable directly, not signed for Play Store)
pnpm build:android

# Production build (AAB — for Google Play Store)
eas build --platform android --profile production
```

The build runs on Expo's servers. When done, you get a download URL for the `.apk` or `.aab`.

Install the APK on any Android device:
- Transfer the `.apk` to the phone
- Open it → "Install" (enable "Install from unknown sources" if prompted)
- The app appears with the TalentIQ icon on the home screen

## 5. Build a standalone release IPA (iOS)

Requires a Mac with Xcode and an Apple Developer account.

```bash
eas build --platform ios --profile production
```

Then upload to TestFlight / App Store Connect via:

```bash
eas submit --platform ios
```

## 6. Submit to app stores

### Google Play Store

1. Build the production AAB: `eas build --platform android --profile production`
2. In the EAS dashboard, download the `.aab`
3. Go to [Play Console](https://play.google.com/console) → create release → upload the `.aab`
4. Or use: `eas submit --platform android` (configure a service account key first)

### Apple App Store

1. Build: `eas build --platform ios --profile production`
2. Submit: `eas submit --platform ios`
3. Release via App Store Connect

## 7. Deep links / OAuth callbacks (already configured)

`app.json` configures the `talentiq-mobile://` scheme and an `https` intent filter for `/auth/callback`. This lets Google OAuth and Clerk open the app directly after login.

Update the host in `app.json` → `android.intentFilters` to match your actual production domain.

## 8. Replace placeholder assets

The current `splash.png` and `adaptive-icon.png` are copies of `icon.png`. Before releasing, replace them:

- `assets/images/icon.png` — 1024×1024 PNG (app icon, used everywhere)
- `assets/images/splash.png` — 1242×2208 PNG (launch screen)
- `assets/images/adaptive-icon.png` — 1024×1024 PNG (Android adaptive foreground, keep logo centered with padding)

Then rebuild.

## 9. Environment variables for mobile

The `.env` file is **not** bundled into the native app. Set these in your Expo dashboard (project settings) or via `eas secret`:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_DOMAIN
EXPO_PUBLIC_GOOGLE_CLIENT_ID
EXPO_PUBLIC_GOOGLE_REDIRECT_URI
```

Access them in code via `process.env.EXPO_PUBLIC_*` (already used in `app/_layout.tsx`).

## 10. Quick commands summary

```bash
pnpm install
pnpm exec eas login
pnpm dev                # start dev server (web + tunnel QR)
pnpm dev:android        # start dev server, open on Android
pnpm build:android      # build release APK
eas build --platform ios --profile production   # build release IPA (Mac only)
eas submit              # submit to app stores
```
