import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../app_theme.dart';

class EmsChartSeries {
  final String id;
  final String name;
  final Color color;
  final List<double> values;
  final String? unit;

  const EmsChartSeries({
    required this.id,
    required this.name,
    required this.color,
    required this.values,
    this.unit,
  });
}

class EmsHistoryChart extends StatefulWidget {
  final String title;
  final String? subtitle;
  final String unit;
  final List<String> timeLabels;
  final List<EmsChartSeries> series;
  final double height;
  final bool isArea;
  final Function(String seriesId)? onLegendTap;

  const EmsHistoryChart({
    super.key,
    required this.title,
    this.subtitle,
    this.unit = 'kW',
    required this.timeLabels,
    required this.series,
    this.height = 260,
    this.isArea = true,
    this.onLegendTap,
  });

  @override
  State<EmsHistoryChart> createState() => _EmsHistoryChartState();
}

class _EmsHistoryChartState extends State<EmsHistoryChart> {
  int? _hoveredIndex;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? kEmsBorderDark : kEmsBorder,
          width: 1,
        ),
        boxShadow: kEmsCardShadow,
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Title
          Text(
            widget.title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isDark ? kEmsTextMainDark : kEmsTextMain,
            ),
          ),
          if (widget.subtitle != null && widget.subtitle!.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              widget.subtitle!,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
          const SizedBox(height: 16),

          // Interactive Chart Canvas
          if (widget.series.isEmpty || widget.timeLabels.isEmpty)
            Container(
              height: widget.height,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark ? kEmsBorderDark : kEmsBorder,
                  style: BorderStyle.solid,
                ),
              ),
              child: Text(
                'No readings available for the selected period.',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          else
            GestureDetector(
              onHorizontalDragUpdate: (details) => _updateHover(details.localPosition),
              onHorizontalDragEnd: (_) => setState(() => _hoveredIndex = null),
              onTapDown: (details) => _updateHover(details.localPosition),
              onTapUp: (_) => setState(() => _hoveredIndex = null),
              child: Stack(
                children: [
                  SizedBox(
                    height: widget.height,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: _ChartPainter(
                        series: widget.series,
                        timeLabels: widget.timeLabels,
                        unit: widget.unit,
                        hoveredIndex: _hoveredIndex,
                        isDark: isDark,
                        isArea: widget.isArea,
                      ),
                    ),
                  ),

                  // Floating Interactive Tooltip
                  if (_hoveredIndex != null &&
                      _hoveredIndex! >= 0 &&
                      _hoveredIndex! < widget.timeLabels.length)
                    _buildTooltip(isDark),
                ],
              ),
            ),
          const SizedBox(height: 14),

          // Legend Pills
          if (widget.series.isNotEmpty)
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 6,
              children: widget.series.map((s) {
                return InkWell(
                  onTap: () => widget.onLegendTap?.call(s.id),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: s.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          '${s.name} (${widget.unit})',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: isDark ? kEmsTextMainDark : kEmsTextMain,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  void _updateHover(Offset localPos) {
    if (widget.timeLabels.isEmpty) return;
    const leftPad = 48.0;
    const rightPad = 12.0;
    final chartWidth = MediaQuery.of(context).size.width - 72.0 - leftPad - rightPad;
    if (chartWidth <= 0) return;

    final x = (localPos.dx - leftPad).clamp(0.0, chartWidth);
    final count = widget.timeLabels.length;
    final idx = ((x / chartWidth) * (count - 1)).round().clamp(0, count - 1);
    setState(() => _hoveredIndex = idx);
  }

  Widget _buildTooltip(bool isDark) {
    final idx = _hoveredIndex!;
    final timeStr = widget.timeLabels[idx];

    return Positioned(
      top: 8,
      right: 12,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: const BoxConstraints(maxWidth: 240),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.12),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              timeStr,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white70 : Colors.black87,
              ),
            ),
            const SizedBox(height: 4),
            ...widget.series.map((s) {
              final val = idx < s.values.length ? s.values[idx] : 0.0;
              return Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        '${s.name}: ',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white60 : Colors.black54,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '${val.toStringAsFixed(1)} ${s.unit ?? widget.unit}',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _ChartPainter extends CustomPainter {
  final List<EmsChartSeries> series;
  final List<String> timeLabels;
  final String unit;
  final int? hoveredIndex;
  final bool isDark;
  final bool isArea;

  _ChartPainter({
    required this.series,
    required this.timeLabels,
    required this.unit,
    required this.hoveredIndex,
    required this.isDark,
    required this.isArea,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const leftPad = 48.0;
    const rightPad = 12.0;
    const bottomPad = 26.0;
    const topPad = 10.0;

    final drawWidth = size.width - leftPad - rightPad;
    final drawHeight = size.height - topPad - bottomPad;

    if (drawWidth <= 0 || drawHeight <= 0) return;

    // Find max value across all series
    double maxVal = 10.0;
    for (final s in series) {
      for (final v in s.values) {
        if (v > maxVal) maxVal = v;
      }
    }
    // Round maxVal to nice boundary
    maxVal = (maxVal * 1.15).ceilToDouble();
    if (maxVal == 0) maxVal = 10.0;

    final gridLinePaint = Paint()
      ..color = isDark ? const Color(0xFF1E293B) : const Color(0xFFECEEE6)
      ..strokeWidth = 1.0;

    final textStyle = TextStyle(
      fontSize: 9,
      color: isDark ? const Color(0xFF64748B) : const Color(0xFF9AA09A),
      fontWeight: FontWeight.w600,
    );

    // Draw horizontal grid lines and Y-axis labels (4 steps)
    const ySteps = 4;
    for (int i = 0; i <= ySteps; i++) {
      final yRatio = i / ySteps;
      final y = topPad + drawHeight * (1.0 - yRatio);
      canvas.drawLine(Offset(leftPad, y), Offset(leftPad + drawWidth, y), gridLinePaint);

      final valLabel = (maxVal * yRatio).toStringAsFixed(maxVal > 100 ? 0 : 1);
      final textSpan = TextSpan(text: '$valLabel $unit', style: textStyle);
      final textPainter = TextPainter(text: textSpan, textDirection: TextDirection.ltr);
      textPainter.layout();
      textPainter.paint(canvas, Offset(leftPad - textPainter.width - 6, y - textPainter.height / 2));
    }

    // Draw time labels along X axis
    final count = timeLabels.length;
    if (count > 1) {
      // Step to show roughly 6 labels evenly spaced
      final step = math.max(1, (count / 6).floor());
      for (int i = 0; i < count; i += step) {
        final x = leftPad + (i / (count - 1)) * drawWidth;
        final label = timeLabels[i];
        final textSpan = TextSpan(text: label, style: textStyle);
        final textPainter = TextPainter(text: textSpan, textDirection: TextDirection.ltr);
        textPainter.layout();
        textPainter.paint(canvas, Offset(x - textPainter.width / 2, size.height - bottomPad + 8));
      }
    }

    // Draw each series line & gradient fill
    for (final s in series) {
      if (s.values.length < 2) continue;

      final linePath = Path();
      final fillPath = Path();

      final pts = <Offset>[];
      for (int i = 0; i < s.values.length; i++) {
        final x = leftPad + (i / (s.values.length - 1)) * drawWidth;
        final v = s.values[i].clamp(0.0, maxVal);
        final y = topPad + drawHeight * (1.0 - (v / maxVal));
        pts.add(Offset(x, y));
      }

      linePath.moveTo(pts.first.dx, pts.first.dy);
      fillPath.moveTo(pts.first.dx, topPad + drawHeight);
      fillPath.lineTo(pts.first.dx, pts.first.dy);

      for (int i = 0; i < pts.length - 1; i++) {
        final p0 = pts[i];
        final p1 = pts[i + 1];
        final midX = (p0.dx + p1.dx) / 2;
        linePath.cubicTo(midX, p0.dy, midX, p1.dy, p1.dx, p1.dy);
        fillPath.cubicTo(midX, p0.dy, midX, p1.dy, p1.dx, p1.dy);
      }

      fillPath.lineTo(pts.last.dx, topPad + drawHeight);
      fillPath.close();

      // Area gradient
      if (isArea) {
        final fillPaint = Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              s.color.withValues(alpha: 0.35),
              s.color.withValues(alpha: 0.0),
            ],
          ).createShader(Rect.fromLTWH(leftPad, topPad, drawWidth, drawHeight));
        canvas.drawPath(fillPath, fillPaint);
      }

      // Line stroke
      final strokePaint = Paint()
        ..color = s.color
        ..strokeWidth = 2.0
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      canvas.drawPath(linePath, strokePaint);
    }

    // Draw vertical scrubber line if hovered
    if (hoveredIndex != null && hoveredIndex! >= 0 && hoveredIndex! < count) {
      final x = leftPad + (hoveredIndex! / (count - 1)) * drawWidth;
      final scrubberPaint = Paint()
        ..color = isDark ? Colors.white38 : Colors.black26
        ..strokeWidth = 1.0;
      canvas.drawLine(Offset(x, topPad), Offset(x, topPad + drawHeight), scrubberPaint);

      // Draw point dots on each series at this index
      for (final s in series) {
        if (hoveredIndex! < s.values.length) {
          final v = s.values[hoveredIndex!].clamp(0.0, maxVal);
          final y = topPad + drawHeight * (1.0 - (v / maxVal));
          final dotPaint = Paint()..color = s.color;
          final borderPaint = Paint()
            ..color = Colors.white
            ..strokeWidth = 2.0
            ..style = PaintingStyle.stroke;
          canvas.drawCircle(Offset(x, y), 4, dotPaint);
          canvas.drawCircle(Offset(x, y), 4, borderPaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ChartPainter oldDelegate) {
    return oldDelegate.hoveredIndex != hoveredIndex ||
        oldDelegate.series != series ||
        oldDelegate.isDark != isDark;
  }
}
