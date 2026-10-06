import 'package:flutter/material.dart';

enum EmsBadgeVariant { success, danger, warning, info, neutral }

class EmsBadge extends StatelessWidget {
  final String label;
  final EmsBadgeVariant variant;
  final IconData? icon;

  const EmsBadge({
    super.key,
    required this.label,
    this.variant = EmsBadgeVariant.neutral,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color bg;
    Color text;
    Color border;

    switch (variant) {
      case EmsBadgeVariant.success:
        bg = isDark ? const Color(0x3316A34A) : const Color(0x66DCFCE7);
        text = isDark ? const Color(0xFF86EFAC) : const Color(0xFF15803D);
        border = const Color(0x4D16A34A);
        break;
      case EmsBadgeVariant.danger:
        bg = isDark ? const Color(0x33DC2626) : const Color(0x66FEE2E2);
        text = isDark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C);
        border = const Color(0x4DDC2626);
        break;
      case EmsBadgeVariant.warning:
        bg = isDark ? const Color(0x33F5A623) : const Color(0x66FEF3C7);
        text = isDark ? const Color(0xFFFCD34D) : const Color(0xFFD97706);
        border = const Color(0x4DF5A623);
        break;
      case EmsBadgeVariant.info:
        bg = isDark ? const Color(0x332563EB) : const Color(0x66DBEAFE);
        text = isDark ? const Color(0xFF93C5FD) : const Color(0xFF1D4ED8);
        border = const Color(0x4D2563EB);
        break;
      case EmsBadgeVariant.neutral:
        bg = isDark ? const Color(0xFF1F2937) : const Color(0xFFECEEE6);
        text = isDark ? const Color(0xFFD1D5C8) : const Color(0xFF374151);
        border = isDark ? const Color(0xFF374151) : const Color(0xFFD1D5C8);
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: text),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
