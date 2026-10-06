import 'dart:async';
import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/theme_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoggingIn = false;
  bool _isTransitioning = false;
  String? _errorMessage;

  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _emailController.text = 'org@cfsmartems.com';
    _passwordController.text = 'password123';
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _fillDemo(String email, String password) {
    setState(() {
      _emailController.text = email;
      _passwordController.text = password;
      _errorMessage = null;
    });
  }

  Future<void> _handleSignIn() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoggingIn = true;
      _errorMessage = null;
    });

    try {
      await AuthService.instance.login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;
      setState(() => _isTransitioning = true);
      await Future.delayed(const Duration(milliseconds: 900));
    } catch (e) {
      if (mounted) {
        final msg = e is ApiException ? e.message : 'Invalid email or password';
        setState(() {
          _isLoggingIn = false;
          _isTransitioning = false;
          _errorMessage = msg;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeService.instance;
    final isDark = theme.isDark;
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width >= 860;

    Widget mobileLoginCard = Container(
      color: isDark ? kEmsCardDark : Colors.white,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top App Header: Theme Toggle
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: kEmsPrimary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.bolt, size: 12, color: kEmsPrimaryDark),
                              SizedBox(width: 4),
                              Text(
                                'MOBILE EMS APP',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: kEmsPrimaryDark,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => theme.toggleTheme(),
                          icon: Icon(
                            isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                            size: 19,
                            color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF4B5563),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // App Logo
                    Center(
                      child: Container(
                        width: 72,
                        height: 72,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                          boxShadow: [
                            BoxShadow(
                              color: kEmsPrimary.withValues(alpha: 0.22),
                              blurRadius: 18,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.asset(
                            'assets/elsa_logo.jpeg',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Brand Title
                    Center(
                      child: Column(
                        children: [
                          Text(
                            'Elsa Energy',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                              color: isDark ? Colors.white : kEmsTextHeading,
                            ),
                          ),
                          const SizedBox(height: 3),
                          const Text(
                            'Next-generation IoT energy management.',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF9AA09A),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Sign in Header
                    Text(
                      'Sign in',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : kEmsTextHeading,
                        letterSpacing: -0.4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Enter your credentials to access the platform',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                      ),
                    ),
                    const SizedBox(height: 22),

                    // Email Field
                    Text(
                      'Email address',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isDark ? kEmsTextMainDark : kEmsTextMain,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: TextStyle(fontSize: 13, color: isDark ? Colors.white : kEmsTextHeading),
                      decoration: InputDecoration(
                        hintText: 'you@example.com',
                        hintStyle: TextStyle(fontSize: 12, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                        filled: true,
                        fillColor: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorder),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: kEmsPrimary, width: 1.8),
                        ),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Email is required';
                        if (!v.contains('@')) return 'Enter a valid email';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password Field
                    Text(
                      'Password',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isDark ? kEmsTextMainDark : kEmsTextMain,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: TextStyle(fontSize: 13, color: isDark ? Colors.white : kEmsTextHeading),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        hintStyle: TextStyle(fontSize: 12, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                        filled: true,
                        fillColor: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorder),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: kEmsPrimary, width: 1.8),
                        ),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                            size: 17,
                            color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Password is required';
                        if (v.length < 6) return 'Minimum 6 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    // Error Message
                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: kEmsDanger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: kEmsDanger.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber_rounded, color: kEmsDanger, size: 15),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(color: kEmsDanger, fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Quick Live Account Fill (matching Login.jsx DEMO_CREDENTIALS)
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.bolt, size: 13, color: kEmsPrimary),
                              SizedBox(width: 4),
                              Text(
                                'Seeded Demo Accounts (Login.jsx)',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => _fillDemo(
                                    'orgadmin@ems.com',
                                    'Admin@123456',
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 7),
                                    decoration: BoxDecoration(
                                      color: kEmsPrimary.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: kEmsPrimary.withValues(alpha: 0.4)),
                                    ),
                                    alignment: Alignment.center,
                                    child: const Text(
                                      'Org Admin',
                                      style: TextStyle(
                                        color: kEmsPrimaryDark,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: InkWell(
                                  onTap: () => _fillDemo(
                                    'org@cfsmartems.com',
                                    'password123',
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 7),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.35)),
                                    ),
                                    alignment: Alignment.center,
                                    child: const Text(
                                      'Ambition',
                                      style: TextStyle(
                                        color: Color(0xFF059669),
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => _fillDemo(
                                    'user@ems.com',
                                    'User@123456',
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 7),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
                                    ),
                                    alignment: Alignment.center,
                                    child: const Text(
                                      'User',
                                      style: TextStyle(
                                        color: Color(0xFF3B82F6),
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: InkWell(
                                  onTap: () => _fillDemo(
                                    'superadmin@ems.com',
                                    'Admin@123456',
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 7),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
                                    ),
                                    alignment: Alignment.center,
                                    child: const Text(
                                      'Super Admin',
                                      style: TextStyle(
                                        color: Color(0xFF7C3AED),
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Sign In Button
                    SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        onPressed: _isLoggingIn ? null : _handleSignIn,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kEmsPrimary,
                          foregroundColor: Colors.white,
                          elevation: 2,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                        child: _isLoggingIn
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'SIGN IN',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.2,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Forgot Password
                    Center(
                      child: TextButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Password reset instructions will be sent to your email.')),
                          );
                        },
                        child: const Text(
                          'Forgot password?',
                          style: TextStyle(color: kEmsPrimaryDark, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),
                    // Feature chips at bottom of mobile screen
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      alignment: WrapAlignment.center,
                      children: [
                        _buildMobileFeatureChip('IoT Telemetry', isDark),
                        _buildMobileFeatureChip('AI Analytics', isDark),
                        _buildMobileFeatureChip('Real-Time Control', isDark),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );

    // If running on desktop, render the exact Login.jsx split-screen layout
    if (isDesktop) {
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF0A0D14) : const Color(0xFFFEFEF8),
        body: Stack(
          children: [
            Row(
              children: [
                // Left Panel: Hero matching Login.jsx
                Expanded(
                  flex: 5,
                  child: Container(
                    color: const Color(0xFF141828), // surface-900
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: Opacity(
                            opacity: 0.15,
                            child: Image.asset(
                              'assets/embedded_bg.png',
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(44.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Top Brand
                              Row(
                                children: [
                                  Container(
                                    width: 42,
                                    height: 42,
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.asset('assets/elsa_logo.jpeg', fit: BoxFit.contain),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  const Text(
                                    'Elsa Energy',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                              // Hero Copy & Checkpoints
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Next-generation IoT energy management.',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 26,
                                      fontWeight: FontWeight.w800,
                                      height: 1.25,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  const Text(
                                    'Optimize power factor, isolate load imbalances, and monitor consumption patterns across multi-org architectures in real-time.',
                                    style: TextStyle(
                                      color: Color(0xFF9AA09A),
                                      fontSize: 13.5,
                                      height: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 28),
                                  _buildHeroBullet(
                                    'IoT Device Monitoring',
                                    'Keep track of gateways and active endpoints in real-time.',
                                  ),
                                  const SizedBox(height: 16),
                                  _buildHeroBullet(
                                    'AI-Driven Analytics',
                                    'Detect consumption anomalies and voltage fluctuations instantly.',
                                  ),
                                  const SizedBox(height: 16),
                                  _buildHeroBullet(
                                    'Role-Based Dashboards',
                                    'Granular control workflows for admins, orgs, and end-users.',
                                  ),
                                ],
                              ),
                              // Footer
                              const Text(
                                '© 2026 Elsa Energy. All rights reserved.',
                                style: TextStyle(
                                  color: Color(0xFF6B7280),
                                  fontSize: 11.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Right Panel: Form
                Expanded(
                  flex: 5,
                  child: Container(
                    color: isDark ? const Color(0xFF0A0D14) : Colors.white,
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 24),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 420),
                          child: mobileLoginCard,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (_isTransitioning) _buildTransitionOverlay(isDark),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: isDark ? kEmsBgDark : kEmsBgLight,
      body: Stack(
        children: [
          mobileLoginCard,
          if (_isTransitioning) _buildTransitionOverlay(isDark),
        ],
      ),
    );
  }

  Widget _buildMobileFeatureChip(String label, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isDark ? kEmsBgDark : kEmsSurfaceAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check, size: 10, color: Color(0xFF22C55E)),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF9AA09A)),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroBullet(String title, String desc) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.check_circle_rounded, size: 18, color: kEmsPrimary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: const TextStyle(
                  color: Color(0xFF9AA09A),
                  fontSize: 12,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTransitionOverlay(bool isDark) {
    return Positioned.fill(
      child: Container(
        color: isDark ? kEmsBgDark : Colors.white,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ScaleTransition(
                scale: _pulseAnimation,
                child: Container(
                  width: 90,
                  height: 90,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(26),
                    boxShadow: [
                      BoxShadow(
                        color: kEmsPrimary.withValues(alpha: 0.28),
                        blurRadius: 24,
                        spreadRadius: 3,
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset('assets/elsa_logo.jpeg', fit: BoxFit.contain),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              Text(
                'ELSA ENERGY',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.0,
                  color: isDark ? Colors.white : kEmsTextHeading,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'OPENING MOBILE APP...',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2.5,
                  color: Color(0xFF9AA09A),
                ),
              ),
              const SizedBox(height: 20),
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: kEmsPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
