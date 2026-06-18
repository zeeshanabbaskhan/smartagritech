import 'package:flutter/material.dart';
import '../app_theme.dart';
import 'time_filter_chips.dart';

class MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final String unit;
  final Widget? chart;
  final Widget? extra;
  final bool showTimeFilter;
  final VoidCallback? onTap;

  const MetricCard({
    super.key,
    required this.title,
    required this.value,
    this.unit = '',
    this.chart,
    this.extra,
    this.showTimeFilter = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: onTap != null
              ? Border(left: BorderSide(color: kOrange, width: 3))
              : null,
          boxShadow: [
            BoxShadow(
              color: kNavy.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: kNavy,
                )),
            if (showTimeFilter) ...[
              const SizedBox(height: 6),
              const TimeFilterChips(),
            ],
            const SizedBox(height: 8),
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: value,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: kNavy,
                    ),
                  ),
                  if (unit.isNotEmpty)
                    TextSpan(
                      text: ' $unit',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade500,
                      ),
                    ),
                ],
              ),
            ),
            if (chart != null) ...[
              const SizedBox(height: 8),
              chart!,
            ],
            if (extra != null) ...[
              const SizedBox(height: 8),
              extra!,
            ],
          ],
        ),
      ),
    );
  }
}

class DetailTile extends StatelessWidget {
  final String title;
  final String value;
  final String unit;

  const DetailTile({
    super.key,
    required this.title,
    required this.value,
    required this.unit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade500,
                fontWeight: FontWeight.w500,
              )),
          const SizedBox(height: 4),
          Text(
            '$value $unit',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: kNavy,
            ),
          ),
        ],
      ),
    );
  }
}
