import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

// ── Mini bar chart (for dashboard cards) ──────────────────────────────────────

class MiniBarChart extends StatelessWidget {
  const MiniBarChart({
    super.key,
    required this.data,
    required this.color,
    this.height = 75,
  });

  final List<double> data;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return SizedBox(height: height);
    final maxY = data.reduce((a, b) => a > b ? a : b);
    return SizedBox(
      height: height,
      child: BarChart(
        BarChartData(
          barGroups: data.asMap().entries.map((e) => BarChartGroupData(
            x: e.key,
            barRods: [
              BarChartRodData(
                toY: e.value,
                color: color,
                width: 4,
                borderRadius: BorderRadius.circular(2),
              ),
            ],
          )).toList(),
          maxY: maxY == 0 ? 1 : maxY * 1.2,
          minY: 0,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          titlesData: const FlTitlesData(show: false),
          barTouchData: BarTouchData(enabled: false),
        ),
        duration: const Duration(milliseconds: 300),
      ),
    );
  }
}

// ── Mini line / area chart ────────────────────────────────────────────────────

class MiniLineChart extends StatelessWidget {
  const MiniLineChart({
    super.key,
    required this.data,
    required this.color,
    this.height = 75,
  });

  final List<double> data;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return SizedBox(height: height);
    final spots = data.asMap().entries
        .map((e) => FlSpot(e.key.toDouble(), e.value))
        .toList();
    final minY = data.reduce((a, b) => a < b ? a : b);
    final maxY = data.reduce((a, b) => a > b ? a : b);
    final range = maxY - minY;
    return SizedBox(
      height: height,
      child: LineChart(
        LineChartData(
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: color,
              barWidth: 2,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                color: color.withValues(alpha: 0.12),
              ),
            ),
          ],
          minY: range == 0 ? minY - 1 : minY - range * 0.1,
          maxY: range == 0 ? maxY + 1 : maxY + range * 0.1,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          titlesData: const FlTitlesData(show: false),
          lineTouchData: LineTouchData(enabled: false),
        ),
        duration: const Duration(milliseconds: 300),
      ),
    );
  }
}

// ── Full bar chart with x-axis labels ────────────────────────────────────────

class FullBarChart extends StatelessWidget {
  final List<double> data;
  final List<String> xLabels;
  final Color color;
  final double height;
  const FullBarChart({
    super.key,
    required this.data,
    required this.xLabels,
    required this.color,
    this.height = 180,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height + 24,
      child: CustomPaint(
        size: Size.infinite,
        painter: _FullBarPainter(data, xLabels, color),
      ),
    );
  }
}

class _FullBarPainter extends CustomPainter {
  final List<double> data;
  final List<String> xLabels;
  final Color color;
  _FullBarPainter(this.data, this.xLabels, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;
    const bottomPad = 24.0;
    final chartH = size.height - bottomPad;
    final max = data.reduce((a, b) => a > b ? a : b);
    if (max == 0) return;

    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 0.5;
    const steps = 4;
    for (int i = 0; i <= steps; i++) {
      final y = chartH * (1 - i / steps);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
      final lbl = (max * i / steps).toStringAsFixed(1);
      _drawText(canvas, lbl, Offset(0, y - 10), 9, Colors.grey.shade500);
    }

    final slotW = size.width / data.length;
    final barW = slotW * 0.55;
    final barPaint = Paint()..color = color;

    for (int i = 0; i < data.length; i++) {
      final bh = data[i] / max * chartH;
      final x = i * slotW + (slotW - barW) / 2;
      final y = chartH - bh;
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barW, bh),
          topLeft: const Radius.circular(3),
          topRight: const Radius.circular(3),
        ),
        barPaint,
      );
      if (i < xLabels.length && i % 3 == 0) {
        _drawText(canvas, xLabels[i], Offset(x, chartH + 6), 8, Colors.grey.shade500);
      }
    }
  }

  void _drawText(Canvas canvas, String text, Offset offset, double size, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: size)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

// ── Full line chart with axes ─────────────────────────────────────────────────

class FullLineChart extends StatelessWidget {
  final List<double> data;
  final List<String> xLabels;
  final Color color;
  final bool filled;
  final bool showDots;
  final double height;
  const FullLineChart({
    super.key,
    required this.data,
    required this.xLabels,
    required this.color,
    this.filled = true,
    this.showDots = false,
    this.height = 180,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height + 24,
      child: CustomPaint(
        size: Size.infinite,
        painter: _FullLinePainter(data, xLabels, color, filled, showDots),
      ),
    );
  }
}

class _FullLinePainter extends CustomPainter {
  final List<double> data;
  final List<String> xLabels;
  final Color color;
  final bool filled;
  final bool showDots;
  _FullLinePainter(this.data, this.xLabels, this.color, this.filled, this.showDots);

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;
    const bottomPad = 24.0;
    final chartH = size.height - bottomPad;

    final max = data.reduce((a, b) => a > b ? a : b);
    final min = data.reduce((a, b) => a < b ? a : b);
    final range = (max - min).clamp(0.001, double.infinity);
    final pad = range * 0.2;
    final eMin = min - pad;
    final eMax = max + pad;
    final eRange = eMax - eMin;

    Offset pt(int i) {
      final x = i / (data.length - 1) * size.width;
      final y = chartH - (data[i] - eMin) / eRange * chartH;
      return Offset(x, y);
    }

    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 0.5;
    const steps = 4;
    for (int i = 0; i <= steps; i++) {
      final y = chartH * (1 - i / steps);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
      final val = eMin + eRange * i / steps;
      _drawText(canvas, val.toStringAsFixed(1), Offset(2, y - 10), 9, Colors.grey.shade500);
    }

    final pts = List.generate(data.length, pt);

    if (filled) {
      final fill = Path()..moveTo(pts.first.dx, chartH);
      for (final p in pts) {
        fill.lineTo(p.dx, p.dy);
      }
      fill..lineTo(pts.last.dx, chartH)..close();
      canvas.drawPath(fill, Paint()
        ..color = color.withValues(alpha: 0.12)
        ..style = PaintingStyle.fill);
    }

    final line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (int i = 1; i < pts.length; i++) {
      line.lineTo(pts[i].dx, pts[i].dy);
    }
    canvas.drawPath(line, Paint()
      ..color = color
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round);

    if (showDots) {
      final dotPaint = Paint()
        ..color = color
        ..style = PaintingStyle.fill;
      for (final p in pts) {
        canvas.drawCircle(p, 3, dotPaint);
        canvas.drawCircle(p, 3, Paint()
          ..color = Colors.white
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5);
      }
    }

    for (int i = 0; i < xLabels.length; i++) {
      final x = i / (xLabels.length - 1) * size.width;
      if (i % 3 == 0) {
        _drawText(canvas, xLabels[i], Offset(x - 10, chartH + 6), 8, Colors.grey.shade500);
      }
    }
  }

  void _drawText(Canvas canvas, String text, Offset offset, double size, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: size)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

// ── Horizontal bar chart (for anomalies issues breakdown) ────────────────────

class HBarItem {
  final String label;
  final int value;
  final Color color;
  const HBarItem(this.label, this.value, this.color);
}

class HorizontalBarChart extends StatelessWidget {
  final List<HBarItem> items;
  const HorizontalBarChart({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    final maxVal = items.map((e) => e.value).reduce((a, b) => a > b ? a : b);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: items.map((item) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.label,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            LayoutBuilder(builder: (_, constraints) {
              final barW = (item.value / maxVal * (constraints.maxWidth - 40))
                  .clamp(0.0, constraints.maxWidth - 40);
              return Row(
                children: [
                  Container(
                    width: barW,
                    height: 22,
                    decoration: BoxDecoration(
                      color: item.color,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${item.value}',
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700)),
                ],
              );
            }),
          ],
        ),
      )).toList(),
    );
  }
}

List<HBarItem> buildAnomalyBars(int overvoltage, int lowPF, int overload) => [
  HBarItem('Overvoltage (Voltage)', overvoltage, const Color(0xFFE53935)),
  HBarItem('Low Power Factor (Power Factor)', lowPF, const Color(0xFFFFCA28)),
  HBarItem('Overload (Current)', overload, const Color(0xFFFF9800)),
];
