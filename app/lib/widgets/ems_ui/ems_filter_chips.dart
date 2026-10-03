import 'package:flutter/material.dart';
import '../../app_theme.dart';

class EmsFilterChips extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelected;

  const EmsFilterChips({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: options.map((opt) {
        final isActive = opt == selected;
        return InkWell(
          onTap: () => onSelected(opt),
          borderRadius: BorderRadius.circular(999),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: isActive
                  ? kEmsPrimary
                  : (isDark ? kEmsSurface800Dark : Colors.white),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: isActive
                    ? kEmsPrimary
                    : (isDark ? kEmsBorderDark : kEmsBorderLightDarker),
                width: 1,
              ),
            ),
            child: Text(
              opt,
              style: TextStyle(
                color: isActive
                    ? const Color(0xFF0A0D14)
                    : (isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight),
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
