/// Build-time configuration.
///
/// Override per environment:
///   flutter run --dart-define=API_BASE_URL=https://api.mydoc.ai
/// Android emulator reaches the host machine at 10.0.2.2.
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  static const String apiV1 = '/api/v1';
}
