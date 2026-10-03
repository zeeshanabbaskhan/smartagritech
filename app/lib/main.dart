import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_theme.dart';
import 'pages/login_page.dart';
import 'pages/main_shell.dart';
import 'services/auth_service.dart';
import 'services/app_state.dart';
import 'services/cache_service.dart';
import 'services/local_notification_service.dart';
import 'services/theme_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await CacheService.instance.init();
  await LocalNotificationService.instance.init();
  await ThemeService.instance.init();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: AuthService.instance),
        ChangeNotifierProvider.value(value: AppState.instance),
        ChangeNotifierProvider.value(value: ThemeService.instance),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _auth = AuthService.instance;
  final _theme = ThemeService.instance;

  @override
  void initState() {
    super.initState();
    _auth.addListener(_onStateChange);
    _theme.addListener(_onStateChange);
    _auth.init();
  }

  @override
  void dispose() {
    _auth.removeListener(_onStateChange);
    _theme.removeListener(_onStateChange);
    super.dispose();
  }

  void _onStateChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Elsa Energy - EmbedAIoT EMS',
      debugShowCheckedModeBanner: false,
      theme: buildEmsTheme(isDark: false),
      darkTheme: buildEmsTheme(isDark: true),
      themeMode: _theme.themeMode,
      home: _auth.isLoading
          ? const Scaffold(
              body: Center(
                child: CircularProgressIndicator(color: kEmsPrimary),
              ),
            )
          : _auth.isAuthenticated
              ? const MainShell()
              : const LoginPage(),
    );
  }
}
