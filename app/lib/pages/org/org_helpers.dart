import 'package:flutter/material.dart';
import '../../app_theme.dart';

// ── Snackbar ──────────────────────────────────────────────────────────────────
SnackBar orgSnack(String msg, {bool error = false}) => SnackBar(
      content: Text(msg),
      backgroundColor: error ? kRed : kGreen,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );

// ── Stat chip ─────────────────────────────────────────────────────────────────
class StatChip extends StatelessWidget {
  const StatChip(this.label, this.count, this.color, {super.key});
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('$count',
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: color)),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
      ],
    );
  }
}

// ── Modal shell ───────────────────────────────────────────────────────────────
class ModalShell extends StatelessWidget {
  const ModalShell({super.key, required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: kNavy)),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            child,
          ],
        ),
      ),
    );
  }
}

// ── Modal text field ──────────────────────────────────────────────────────────
class ModalField extends StatelessWidget {
  const ModalField(this.label, this.ctrl,
      {super.key, this.hint, this.keyboard, this.validator, this.maxLines = 1, this.enabled = true});
  final String label;
  final TextEditingController ctrl;
  final String? hint;
  final TextInputType? keyboard;
  final String? Function(String?)? validator;
  final int maxLines;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          enabled: enabled,
          keyboardType: keyboard,
          validator: validator,
          maxLines: maxLines,
          style: const TextStyle(fontSize: 14, color: kNavy),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
            filled: true,
            fillColor: kBg,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kOrange, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kRed, width: 1.2),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kRed, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Modal dropdown ────────────────────────────────────────────────────────────
class ModalDropdown extends StatelessWidget {
  const ModalDropdown(this.label, this.value, this.items, this.onChanged,
      {super.key});
  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: value,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 14, color: kNavy),
          decoration: InputDecoration(
            filled: true,
            fillColor: kBg,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kOrange, width: 1.5),
            ),
          ),
          items: items
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
        ),
      ],
    );
  }
}

// ── Modal save/cancel row ─────────────────────────────────────────────────────
class ModalActions extends StatelessWidget {
  const ModalActions({super.key, required this.onCancel, required this.onSave,
      this.saveLabel = 'Save'});
  final VoidCallback onCancel;
  final VoidCallback onSave;
  final String saveLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: onCancel,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.grey.shade600,
              side: BorderSide(color: Colors.grey.shade300),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: const Text('Cancel'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton(
            onPressed: onSave,
            style: ElevatedButton.styleFrom(
              backgroundColor: kOrange,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: Text(saveLabel,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}

// ── Table card wrapper ────────────────────────────────────────────────────────
class TableCard extends StatelessWidget {
  const TableCard({
    super.key,
    required this.cols,
    required this.widths,
    required this.header,
    required this.rows,
    required this.count,
  });
  final List<String> cols;
  final List<double> widths;
  final Widget header;
  final List<Widget> rows;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: kNavy.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    header,
                    ...rows,
                  ],
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
                border:
                    Border(top: BorderSide(color: Colors.grey.shade100))),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Showing 1 to $count of $count entries',
                style:
                    TextStyle(color: Colors.grey.shade500, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Widget tableHeader(List<String> cols, List<double> widths) {
  return Container(
    padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
    decoration: BoxDecoration(
      color: kNavy.withValues(alpha: 0.04),
      borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
      border: Border(
        bottom: BorderSide(color: const Color(0xFFE0E0E0)),
        left: BorderSide(color: kOrange, width: 3),
      ),
    ),
    child: Row(
      children: List.generate(
        cols.length,
        (i) => SizedBox(
          width: widths[i],
          child: Text(cols[i],
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700, color: kNavy)),
        ),
      ),
    ),
  );
}

Widget deleteConfirmDialog({
  required BuildContext context,
  required String title,
  required String message,
  required VoidCallback onConfirm,
}) {
  return AlertDialog(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    title: Text(title,
        style: const TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
    content: Text(message),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child:
            Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
      ),
      ElevatedButton(
        onPressed: () {
          Navigator.pop(context);
          onConfirm();
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: kRed,
          foregroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: const Text('Delete'),
      ),
    ],
  );
}
