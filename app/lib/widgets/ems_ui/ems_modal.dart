import 'package:flutter/material.dart';
import '../../app_theme.dart';
import 'ems_button.dart';

class EmsModal extends StatelessWidget {
  final String title;
  final Widget content;
  final String confirmLabel;
  final VoidCallback? onConfirm;
  final String cancelLabel;
  final VoidCallback? onCancel;
  final double maxWidth;

  const EmsModal({
    super.key,
    required this.title,
    required this.content,
    this.confirmLabel = 'Confirm',
    this.onConfirm,
    this.cancelLabel = 'Cancel',
    this.onCancel,
    this.maxWidth = 460,
  });

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    required Widget content,
    String confirmLabel = 'Confirm',
    VoidCallback? onConfirm,
    String cancelLabel = 'Cancel',
    VoidCallback? onCancel,
  }) {
    return showDialog<T>(
      context: context,
      barrierColor: Colors.black.withOpacity(0.55),
      builder: (ctx) => EmsModal(
        title: title,
        content: content,
        confirmLabel: confirmLabel,
        onConfirm: onConfirm != null
            ? () {
                onConfirm();
                Navigator.of(ctx).pop();
              }
            : null,
        cancelLabel: cancelLabel,
        onCancel: onCancel ?? () => Navigator.of(ctx).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: maxWidth,
          margin: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: isDark ? kEmsCardDark : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? kEmsBorderDark : kEmsBorderLight,
              width: 1,
            ),
            boxShadow: const [
              BoxShadow(
                color: Colors.black38,
                blurRadius: 24,
                offset: Offset(0, 10),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18, color: kEmsTextMuted),
                      onPressed: onCancel ?? () => Navigator.of(context).pop(),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    ),
                  ],
                ),
              ),
              Divider(
                height: 1,
                color: isDark ? kEmsBorderDark : kEmsBorderLight,
              ),

              // Body
              Padding(
                padding: const EdgeInsets.all(20),
                child: content,
              ),

              // Footer
              Divider(
                height: 1,
                color: isDark ? kEmsBorderDark : kEmsBorderLight,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    EmsButton(
                      label: cancelLabel,
                      variant: EmsButtonVariant.secondary,
                      onPressed: onCancel ?? () => Navigator.of(context).pop(),
                    ),
                    if (onConfirm != null) ...[
                      const SizedBox(width: 10),
                      EmsButton(
                        label: confirmLabel,
                        variant: EmsButtonVariant.primary,
                        onPressed: onConfirm,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
