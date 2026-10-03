import 'package:flutter/material.dart';
import '../../app_theme.dart';

class EmsTableColumn {
  final String key;
  final String label;
  final int flex;
  final Widget Function(dynamic val, Map<String, dynamic> row)? cellBuilder;

  const EmsTableColumn({
    required this.key,
    required this.label,
    this.flex = 1,
    this.cellBuilder,
  });
}

class EmsDataTable extends StatefulWidget {
  final List<EmsTableColumn> columns;
  final List<Map<String, dynamic>> data;
  final bool searchable;
  final String searchPlaceholder;
  final int pageSize;
  final Widget? trailingToolbar;

  const EmsDataTable({
    super.key,
    required this.columns,
    required this.data,
    this.searchable = true,
    this.searchPlaceholder = 'Search records...',
    this.pageSize = 6,
    this.trailingToolbar,
  });

  @override
  State<EmsDataTable> createState() => _EmsDataTableState();
}

class _EmsDataTableState extends State<EmsDataTable> {
  String _query = '';
  int _currentPage = 1;
  String? _sortKey;
  bool _sortAsc = true;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Filter
    final filtered = widget.data.where((row) {
      if (_query.isEmpty) return true;
      final q = _query.toLowerCase();
      return widget.columns.any((col) {
        final val = row[col.key]?.toString().toLowerCase() ?? '';
        return val.contains(q);
      });
    }).toList();

    // Sort
    if (_sortKey != null) {
      filtered.sort((a, b) {
        final av = a[_sortKey]?.toString() ?? '';
        final bv = b[_sortKey]?.toString() ?? '';
        return _sortAsc ? av.compareTo(bv) : bv.compareTo(av);
      });
    }

    // Pagination
    final totalPages = (filtered.length / widget.pageSize).ceil().clamp(1, 9999);
    if (_currentPage > totalPages) _currentPage = totalPages;
    final startIdx = ((_currentPage - 1) * widget.pageSize).clamp(0, filtered.length);
    final endIdx = (startIdx + widget.pageSize).clamp(0, filtered.length);
    final pageItems = filtered.sublist(startIdx, endIdx);

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
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Toolbar: Search + Trailing
          if (widget.searchable || widget.trailingToolbar != null) ...[
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  if (widget.searchable)
                    Expanded(
                      child: SizedBox(
                        height: 38,
                        child: TextField(
                          onChanged: (val) => setState(() {
                            _query = val;
                            _currentPage = 1;
                          }),
                          decoration: InputDecoration(
                            prefixIcon: const Icon(Icons.search, size: 16, color: kEmsTextMuted),
                            hintText: widget.searchPlaceholder,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                            fillColor: isDark ? kEmsBgDark : kEmsSurface100Light,
                          ),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    ),
                  if (widget.trailingToolbar != null) ...[
                    const SizedBox(width: 10),
                    widget.trailingToolbar!,
                  ],
                ],
              ),
            ),
            Divider(
              height: 1,
              color: isDark ? kEmsBorderDark : kEmsBorderLight,
            ),
          ],

          // Table Header
          Container(
            color: isDark ? kEmsBgDark : kEmsSurface100Light,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: widget.columns.map((col) {
                final isSorted = _sortKey == col.key;
                return Expanded(
                  flex: col.flex,
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        if (_sortKey == col.key) {
                          _sortAsc = !_sortAsc;
                        } else {
                          _sortKey = col.key;
                          _sortAsc = true;
                        }
                      });
                    },
                    child: Row(
                      children: [
                        Text(
                          col.label.toUpperCase(),
                          style: TextStyle(
                            color: isDark ? kEmsTextSecondaryDark : kEmsTextSecondaryLight,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          isSorted
                              ? (_sortAsc ? Icons.arrow_upward : Icons.arrow_downward)
                              : Icons.unfold_more,
                          size: 12,
                          color: isSorted ? kEmsPrimary : kEmsTextMuted.withOpacity(0.5),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          Divider(
            height: 1,
            color: isDark ? kEmsBorderDark : kEmsBorderLight,
          ),

          // Table Body
          if (pageItems.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.inbox_outlined, size: 36, color: kEmsTextMuted.withOpacity(0.5)),
                    const SizedBox(height: 8),
                    const Text(
                      'No records found',
                      style: TextStyle(color: kEmsTextMuted, fontSize: 13),
                    ),
                  ],
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: pageItems.length,
              separatorBuilder: (ctx, i) => Divider(
                height: 1,
                color: isDark ? kEmsBorderDark : kEmsBorderLight,
              ),
              itemBuilder: (ctx, i) {
                final row = pageItems[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: widget.columns.map((col) {
                      final val = row[col.key];
                      return Expanded(
                        flex: col.flex,
                        child: col.cellBuilder != null
                            ? col.cellBuilder!(val, row)
                            : Text(
                                val?.toString() ?? '',
                                style: TextStyle(
                                  color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                                  fontSize: 13,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                      );
                    }).toList(),
                  ),
                );
              },
            ),

          // Pagination Footer
          Divider(
            height: 1,
            color: isDark ? kEmsBorderDark : kEmsBorderLight,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  filtered.isEmpty
                      ? 'Showing 0 results'
                      : 'Showing ${startIdx + 1} to $endIdx of ${filtered.length} results',
                  style: const TextStyle(color: kEmsTextMuted, fontSize: 11),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left, size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                      onPressed: _currentPage > 1
                          ? () => setState(() => _currentPage--)
                          : null,
                    ),
                    Text(
                      '$_currentPage / $totalPages',
                      style: TextStyle(
                        color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right, size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                      onPressed: _currentPage < totalPages
                          ? () => setState(() => _currentPage++)
                          : null,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
