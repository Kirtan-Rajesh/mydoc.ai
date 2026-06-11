# mydoc.ai — Flutter app (iOS + Android)

Phone-OTP login, document vault with AI analysis, streaming AI chat,
medication tracking, health profile. Talks to the FastAPI backend.

## First-time setup

The repo ships only `lib/` + `pubspec.yaml`; generate the platform folders
once on a machine with the Flutter SDK:

```bash
cd frontend-mobile
flutter create . --org ai.mydoc --project-name mydoc_mobile --platforms android,ios
flutter pub get
```

## Run against a local backend

```bash
# Android emulator (10.0.2.2 = host machine) — this is the default
flutter run

# iOS simulator / physical device
flutter run --dart-define=API_BASE_URL=http://localhost:8000      # iOS sim
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:8000  # device
```

In dev mode the backend returns the OTP in the API response and the app
auto-fills it — no SMS account needed.

## Release builds

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.mydoc.ai
flutter build ipa --release --dart-define=API_BASE_URL=https://api.mydoc.ai
```

Android needs `android.permission.CAMERA` + photo permissions for the scan
flow (image_picker adds these), and iOS needs `NSCameraUsageDescription` /
`NSPhotoLibraryUsageDescription` in `ios/Runner/Info.plist`.

## Structure

```
lib/
├── main.dart            # entry; auth-gated routing
├── config.dart          # API_BASE_URL via --dart-define
├── api.dart             # dio client, bearer auth, SSE chat stream
├── models.dart          # API models (manual JSON, no codegen)
├── providers.dart       # Riverpod state
├── theme.dart           # Material 3 theme
└── screens/
    ├── auth/            # phone OTP login
    ├── home_shell.dart  # bottom navigation
    ├── dashboard_screen.dart
    ├── documents/       # vault, upload (camera/file), detail
    ├── chat/            # streaming AI chat + history
    ├── medications/     # CRUD + dose logging
    └── profile/         # user, language, health profile
```
