import 'package:flutter/material.dart';
import '../../app_theme.dart';

enum EmsStatColor { primary, success, danger, warning, info, neutral }

class EmsStatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final IconData? icon;
  final EmsStatColor color;
  final double? trend;
  final List<double>? sparklineData;

  const EmsStatCard({
    super.key,
    required this.label,
    required this.value,
    this.sub,
    this.icon,
    this.color = EmsStatColor.primary,
    this.trend,
    this.sparklineData,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color accentColor;
    Color iconBg;

    switch (color) {
      case EmsStatColor.primary:
      case EmsStatColor.warning:
        accentColor = kEmsPrimary;
        iconBg = isDark ? const Color(0x33F5A623) : const Color(0x33FEF3C7);
        break;
      case EmsStatColor.success:
        accentColor = kEmsSuccess;
        iconBg = isDark ? const Color(0x3316A34A) : const Color(0x33DCFCE7);
        break;
      case EmsStatColor.danger:
        accentColor = kEmsDanger;
        iconBg = isDark ? const Color(0x33DC2626) : const Color(0x33FEE2E2);
        break;
      case EmsStatColor.info:
        accentColor = kEmsInfo;
        iconBg = isDark ? const Color(0x332563EB) : const Color(0x33DBEAFE);
        break;
      case EmsStatColor.neutral:
        accentColor = isDark ? kEmsBorderDark : kEmsBorderLightDarker;
        iconBg = isDark ? kEmsSurface800Dark : kEmsSurface100Light;
        break;
    }

    return Container(
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          top: BorderSide(color: accentColor, width: 2.5),
          left: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorderLight),
          right: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorderLight),
          bottom: BorderSide(color: isDark ? kEmsBorderDark : kEmsBorderLight),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            offset: const Offset(0, 2),
            blurRadius: 4,
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top row: Label + Icon
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: const TextStyle(
                    color: kEmsTextMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (icon != null) ...[
                const SizedBox(width: 8),
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: accentColor.withOpacity(0.25), width: 1),
                  ),
                  child: Icon(icon, size: 16, color: accentColor),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          // Value
          Text(
            value,
            style: TextStyle(
              color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 12),
          // Bottom row: Trend / Subtitle + Sparkline
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: trend != null
                    ? Row(
                        children: [
                          Icon(
                            trend! >= 0 ? Icons.trending_up : Icons.trending_down,
                            size: 14,
                            color: trend! >= 0 ? kEmsSuccess : kEmsDanger,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${trend! >= 0 ? '+' : ''}${trend!.toStringAsFixed(1)}%',
                            style: TextStyle(
                              color: trend! >= 0 ? kEmsSuccess : kEmsDanger,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'vs last mo',
                            style: TextStyle(color: kEmsTextMuted, fontSize: 11),
                          ),
                        ],
                      )
                    : Text(
                        sub ?? '',
                        style: const TextStyle(color: kEmsTextMuted, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
              ),
              if (sparklineData != null && sparklineData!.length > 1) ...[
                const SizedBox(width: 8),
                SizedBox(
                  width: 70,
                  height: 24,
                  child: CustomPaint(
                    painter: _SparklinePainter(
                      data: sparklineData!,
                      color: accentColor,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> data;
  final Color color;

  _SparklinePainter({required this.data, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    double minVal = data.reduce((a, b) => a < b ? a : b);
    double maxVal = data.reduce((a, b) => a > b ? a : b);
    double range = maxVal - minVal;
    if (range == 0) range = 1.0;

    final path = Path();
    for (int i = 0; i < data.length; i++) {
      final x = (i / (data.length - 1)) * size.width;
      final y = size.height - 2 - ((data[i] - minVal) / range) * (size.height - 4);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) => true;
}
