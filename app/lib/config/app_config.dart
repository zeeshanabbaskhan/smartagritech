/// App-wide compile-time flags.
class AppConfig {
  AppConfig._();

  /// Enable with: `flutter run --dart-define=USE_DUMMY_DATA=true`
  /// Or flip [forceDummyData] below for local dev without a define.
  static const bool useDummyData =
      bool.fromEnvironment('USE_DUMMY_DATA', defaultValue: false);

  /// Set to `false` so the app connects to the live backend API.
  static const bool forceDummyData = false;

  static bool get isDummyMode => forceDummyData || useDummyData;
}
