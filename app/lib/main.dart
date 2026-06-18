import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'pages/login_page.dart';
import 'pages/main_shell.dart';
import 'services/auth_service.dart';
import 'services/app_state.dart';
import 'services/cache_service.dart';
import 'services/local_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await CacheService.instance.init();
  await LocalNotificationService.instance.init();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: AuthService.instance),
        ChangeNotifierProvider.value(value: AppState.instance),
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

  @override
  void initState() {
    super.initState();
    _auth.addListener(_onAuthChange);
    _auth.init();
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChange);
    super.dispose();
  }

  void _onAuthChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EmbedAIoT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0D1B3E),
          primary: const Color(0xFF0D1B3E),
          secondary: const Color(0xFFE8A820),
          tertiary: const Color(0xFF4A90D9),
        ),
        useMaterial3: true,
        // Orange on progress indicators & toggles
        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: Color(0xFFE8A820),
        ),
        // Orange focus ring on text fields globally
        inputDecorationTheme: InputDecorationTheme(
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(10)),
            borderSide: BorderSide(color: Color(0xFFE8A820), width: 1.8),
          ),
        ),
        // Orange ripple on chips and buttons
        chipTheme: ChipThemeData(
          selectedColor: Color(0xFFE8A820),
          labelStyle: TextStyle(fontWeight: FontWeight.w600),
        ),
        // Badge background → orange
        badgeTheme: BadgeThemeData(
          backgroundColor: Color(0xFFE8A820),
          textColor: Colors.white,
        ),
      ),
      home: _auth.isLoading
          ? const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            )
          : _auth.isAuthenticated
              ? const MainShell()
              : const LoginPage(),
    );
  }
}
