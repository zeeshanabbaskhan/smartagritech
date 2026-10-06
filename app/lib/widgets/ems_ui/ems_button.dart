import 'package:flutter/material.dart';
import '../../app_theme.dart';

enum EmsButtonVariant { primary, secondary, danger, ghost }

class EmsButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final EmsButtonVariant variant;
  final bool isLoading;
  final double? width;

  const EmsButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.variant = EmsButtonVariant.primary,
    this.isLoading = false,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color bg;
    Color fg;
    BorderSide border = BorderSide.none;

    switch (variant) {
      case EmsButtonVariant.primary:
        bg = kEmsPrimary;
        fg = const Color(0xFF0A0D14);
        break;
      case EmsButtonVariant.secondary:
        bg = isDark ? kEmsCardDark : Colors.white;
        fg = isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight;
        border = BorderSide(color: isDark ? kEmsBorderDark : kEmsBorderLightDarker);
        break;
      case EmsButtonVariant.danger:
        bg = isDark ? const Color(0x33DC2626) : const Color(0xFFFEE2E2);
        fg = const Color(0xFFDC2626);
        border = const BorderSide(color: Color(0x4DDC2626));
        break;
      case EmsButtonVariant.ghost:
        bg = Colors.transparent;
        fg = isDark ? kEmsTextSecondaryDark : kEmsTextSecondaryLight;
        break;
    }

    Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isLoading)
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: fg,
            ),
          )
        else if (icon != null) ...[
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 7),
        ],
        Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );

    return SizedBox(
      width: width,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: border,
        ),
        child: InkWell(
          onTap: isLoading ? null : onPressed,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: content,
          ),
        ),
      ),
    );
  }
}
