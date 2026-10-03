import 'package:flutter/material.dart';
import '../../app_theme.dart';

class EmsMetricRangeCard extends StatefulWidget {
  final IconData? icon;
  final String title;
  final String value;
  final String? unit;
  final Map<String, List<Map<String, dynamic>>>? data;
  final String defaultRange;

  const EmsMetricRangeCard({
    super.key,
    this.icon,
    required this.title,
    required this.value,
    this.unit,
    this.data,
    this.defaultRange = '1h',
  });

  @override
  State<EmsMetricRangeCard> createState() => _EmsMetricRangeCardState();
}

class _EmsMetricRangeCardState extends State<EmsMetricRangeCard> {
  late String _currentRange;
  static const List<String> _ranges = ['1h', '24h', '7d', '30d'];

  @override
  void initState() {
    super.initState();
    _currentRange = widget.defaultRange;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentSeries = widget.data?[_currentRange] ?? [];

    return Container(
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? kEmsBorderDark : kEmsBorderLight,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            offset: const Offset(0, 1),
            blurRadius: 3,
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Icon + Title
          Row(
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 14, color: kEmsPrimary),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  widget.title,
                  style: TextStyle(
                    color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Range pills (1h, 24h, 7d, 30d)
          Row(
            children: _ranges.map((r) {
              final isActive = r == _currentRange;
              return Padding(
                padding: const EdgeInsets.only(right: 5),
                child: InkWell(
                  onTap: () => setState(() => _currentRange = r),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isActive
                          ? kEmsPrimary
                          : (isDark ? kEmsSurface800Dark : kEmsSurface100Light),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      r,
                      style: TextStyle(
                        color: isActive
                            ? const Color(0xFF0A0D14)
                            : (isDark ? kEmsTextSecondaryDark : kEmsTextSecondaryLight),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),

          // Big value & unit
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                widget.value,
                style: TextStyle(
                  color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
              if (widget.unit != null && widget.unit!.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(
                  widget.unit!,
                  style: const TextStyle(
                    color: kEmsTextMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),

          // Interactive Chart Canvas with amber gradient
          SizedBox(
            height: 70,
            width: double.infinity,
            child: CustomPaint(
              painter: _AreaChartPainter(
                series: currentSeries,
                lineColor: kEmsPrimary,
                gridColor: isDark ? kEmsBorderDark : kEmsBorderLight,
                isDark: isDark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AreaChartPainter extends CustomPainter {
  final List<Map<String, dynamic>> series;
  final Color lineColor;
  final Color gridColor;
  final bool isDark;

  _AreaChartPainter({
    required this.series,
    required this.lineColor,
    required this.gridColor,
    required this.isDark,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Draw 2 subtle horizontal dashed grid lines
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1.0;

    canvas.drawLine(Offset(0, size.height * 0.33), Offset(size.width, size.height * 0.33), gridPaint);
    canvas.drawLine(Offset(0, size.height * 0.66), Offset(size.width, size.height * 0.66), gridPaint);

    if (series.isEmpty) return;

    final values = series.map((e) => (e['v'] as num?)?.toDouble() ?? 0.0).toList();
    if (values.length < 2) return;

    double minV = values.reduce((a, b) => a < b ? a : b);
    double maxV = values.reduce((a, b) => a > b ? a : b);
    double diff = maxV - minV;
    if (diff == 0) diff = 1.0;

    final linePath = Path();
    final fillPath = Path();

    for (int i = 0; i < values.length; i++) {
      final x = (i / (values.length - 1)) * size.width;
      final y = size.height - 4 - ((values[i] - minV) / diff) * (size.height - 8);

      if (i == 0) {
        linePath.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        linePath.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    // Area fill with gradient
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          lineColor.withOpacity(isDark ? 0.35 : 0.25),
          lineColor.withOpacity(0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    canvas.drawPath(fillPath, fillPaint);

    // Stroke line
    final linePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    canvas.drawPath(linePath, linePaint);
  }

  @override
  bool shouldRepaint(covariant _AreaChartPainter oldDelegate) => true;
}
