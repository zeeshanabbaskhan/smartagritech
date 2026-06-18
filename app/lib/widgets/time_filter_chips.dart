import 'package:flutter/material.dart';
import '../app_theme.dart';

class TimeFilterChips extends StatefulWidget {
  final ValueChanged<String>? onChanged;
  const TimeFilterChips({super.key, this.onChanged});

  @override
  State<TimeFilterChips> createState() => _TimeFilterChipsState();
}

class _TimeFilterChipsState extends State<TimeFilterChips> {
  String _selected = '1h';
  static const _filters = ['1h', '24h', '7d', '30d'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: _filters.map((f) => Padding(
        padding: const EdgeInsets.only(right: 4),
        child: GestureDetector(
          onTap: () {
            setState(() => _selected = f);
            widget.onChanged?.call(f);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(
              color: _selected == f ? kBlue : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              f,
              style: TextStyle(
                color: _selected == f ? Colors.white : Colors.grey.shade600,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      )).toList(),
    );
  }
}
