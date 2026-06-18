import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';

const _navy = Color(0xFF0D1B3E);
const _blue = Color(0xFF4A90D9);
const _orange = Color(0xFFE8A820);
const _bg = Color(0xFFF2F4F8);

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _loading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await AuthService.instance.login(
        _emailController.text,
        _passwordController.text,
      );
    } catch (e) {
      if (mounted) {
        final msg = e is ApiException ? e.message : 'Login failed';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 5),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;
    return Scaffold(
      backgroundColor: _bg,
      body: Stack(
        children: [
          const _BackgroundDecoration(),
          SafeArea(
            child: SingleChildScrollView(
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 60),
                    // ── Logo ──
                    SizedBox(
                      width: double.infinity,
                      height: screenH * 0.24,
                      child: Image.asset(
                        'assets/logo-removebg-preview.png',
                        fit: BoxFit.fill,
                      ),
                    ),
                    const SizedBox(height: 0),
                    // ── Form ──
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _FieldLabel('Email'),
                          const SizedBox(height: 8),
                          _InputField(
                            controller: _emailController,
                            hint: 'you@example.com',
                            prefixIcon: Icons.email_outlined,
                            prefixIconColor: _navy,
                            keyboardType: TextInputType.emailAddress,
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) return 'Email is required';
                              if (!v.contains('@')) return 'Enter a valid email';
                              return null;
                            },
                          ),
                          const SizedBox(height: 22),
                          const _FieldLabel('Password'),
                          const SizedBox(height: 8),
                          _InputField(
                            controller: _passwordController,
                            hint: 'Enter your password',
                            prefixIcon: Icons.lock_outline,
                            prefixIconColor: _blue,
                            obscureText: _obscurePassword,
                            suffixIcon: GestureDetector(
                              onTap: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                              child: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                color: Colors.grey.shade500,
                                size: 20,
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Password is required';
                              if (v.length < 6) return 'Minimum 6 characters';
                              return null;
                            },
                          ),
                          const SizedBox(height: 10),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () {},
                              style: TextButton.styleFrom(
                                foregroundColor: _orange,
                                padding: EdgeInsets.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: const Text(
                                'Forgot password?',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 30),
                          SizedBox(
                            height: 56,
                            child: ElevatedButton(
                              onPressed: _loading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _navy,
                                disabledBackgroundColor:
                                    _navy.withValues(alpha: 0.5),
                                foregroundColor: Colors.white,
                                elevation: 6,
                                shadowColor: _navy.withValues(alpha: 0.35),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: _loading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'Sign In',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 56,
                            child: OutlinedButton(
                              onPressed: () {},
                              style: OutlinedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: _navy,
                                side: BorderSide(
                                  color: _navy.withValues(alpha: 0.65),
                                  width: 1.5,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                elevation: 0,
                              ),
                              child: const Text(
                                'Create Account',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 44),
                          Center(
                            child: Text(
                              '© 2025 EmbedAIoT · Smarter Solutions',
                              style: TextStyle(
                                color: _orange.withValues(alpha: 0.85),
                                fontSize: 12,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: _navy,
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  const _InputField({
    required this.controller,
    required this.hint,
    required this.prefixIcon,
    required this.prefixIconColor,
    this.keyboardType,
    this.obscureText = false,
    this.suffixIcon,
    this.validator,
  });

  final TextEditingController controller;
  final String hint;
  final IconData prefixIcon;
  final Color prefixIconColor;
  final TextInputType? keyboardType;
  final bool obscureText;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      validator: validator,
      style: const TextStyle(
        color: _navy,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: Colors.grey.shade400,
          fontSize: 14,
          fontWeight: FontWeight.w400,
        ),
        prefixIcon: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Icon(prefixIcon, color: prefixIconColor, size: 20),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 52),
        suffixIcon: suffixIcon != null
            ? Padding(
                padding: const EdgeInsets.only(right: 14),
                child: suffixIcon,
              )
            : null,
        suffixIconConstraints: const BoxConstraints(minWidth: 48),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.6),
        contentPadding: const EdgeInsets.symmetric(vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: _navy.withValues(alpha: 0.7), width: 1.2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: _navy.withValues(alpha: 0.55), width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _navy, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.red.shade400, width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.red.shade400, width: 1.8),
        ),
        errorStyle: const TextStyle(fontSize: 12),
      ),
    );
  }
}

class _BackgroundDecoration extends StatelessWidget {
  const _BackgroundDecoration();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _CircuitPainter(),
      size: Size.infinite,
    );
  }
}

class _CircuitPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = const Color(0xFF0D1B3E).withValues(alpha: 0.1)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final dot = Paint()
      ..color = const Color(0xFF0D1B3E).withValues(alpha: 0.14)
      ..style = PaintingStyle.fill;

    void node(double x, double y, {double r = 4}) {
      canvas.drawCircle(Offset(x, y), r, dot);
      canvas.drawCircle(Offset(x, y), r, stroke);
    }

    void line(List<Offset> pts) {
      final path = Path()..moveTo(pts[0].dx, pts[0].dy);
      for (var i = 1; i < pts.length; i++) {
        path.lineTo(pts[i].dx, pts[i].dy);
      }
      canvas.drawPath(path, stroke);
    }

    final w = size.width;
    final h = size.height;

    line([Offset(0, h * 0.08), Offset(w * 0.22, h * 0.08)]);
    line([Offset(w * 0.22, h * 0.08), Offset(w * 0.22, h * 0.15)]);
    node(w * 0.22, h * 0.08);

    line([Offset(0, h * 0.14), Offset(w * 0.12, h * 0.14)]);
    line([Offset(w * 0.12, h * 0.14), Offset(w * 0.12, h * 0.22)]);
    line([Offset(w * 0.12, h * 0.22), Offset(w * 0.26, h * 0.22)]);
    node(w * 0.12, h * 0.14);
    node(w * 0.26, h * 0.22, r: 3.5);

    line([Offset(0, h * 0.20), Offset(w * 0.07, h * 0.20)]);
    line([Offset(w * 0.07, h * 0.20), Offset(w * 0.07, h * 0.27)]);
    node(w * 0.07, h * 0.20, r: 3);

    final rx = w * 0.72, ry = h * 0.01, rw = w * 0.27, rh = h * 0.07;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          Rect.fromLTWH(rx, ry, rw, rh), const Radius.circular(6)),
      stroke,
    );
    node(rx + rw * 0.5, ry + rh, r: 3.5);

    line([Offset(w, h * 0.76), Offset(w * 0.78, h * 0.76)]);
    line([Offset(w * 0.78, h * 0.76), Offset(w * 0.78, h * 0.83)]);
    node(w * 0.78, h * 0.76, r: 3.5);

    line([Offset(w, h * 0.83), Offset(w * 0.68, h * 0.83)]);
    node(w * 0.68, h * 0.83, r: 3.5);

    line([Offset(w, h * 0.89), Offset(w * 0.82, h * 0.89)]);
    line([Offset(w * 0.82, h * 0.89), Offset(w * 0.82, h * 0.95)]);
    node(w * 0.82, h * 0.95, r: 3);

    node(w * 0.28, h * 0.97, r: 3.5);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
