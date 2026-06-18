import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../widgets/api_state_views.dart';

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key});

  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  final _search = TextEditingController();
  String _query = '';
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getProducts();
      setState(() => _products = raw.map(ApiMappers.product).toList());
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_query.isEmpty) return _products;
    final q = _query.toLowerCase();
    return _products.where((p) {
      return (p['name'] as String).toLowerCase().contains(q) ||
          (p['description'] as String).toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(backgroundColor: kBg, body: LoadingView());
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: kBg,
        body: ErrorView.fromError(_error!, onRetry: _load),
      );
    }

    final products = _filtered;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Product Catalog',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
      ),
      body: Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(children: [
            TextField(
              controller: _search,
              onChanged: (v) => setState(() => _query = v),
              style: const TextStyle(fontSize: 14, color: kNavy),
              decoration: InputDecoration(
                hintText: 'Search products...',
                hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                prefixIcon: Icon(Icons.search, size: 20, color: Colors.grey.shade400),
                filled: true, fillColor: kBg,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ]),
        ),
        Expanded(
          child: products.isEmpty
              ? _empty()
              : Padding(
                  padding: const EdgeInsets.all(16),
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.72,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: products.length,
                    itemBuilder: (_, i) => _ProductCard(product: products[i]),
                  ),
                ),
        ),
      ]),
    );
  }

  Widget _empty() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.inventory_2_outlined, size: 60, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No products found', style: TextStyle(color: Colors.grey.shade500, fontSize: 15)),
        ]),
      );
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final Map<String, dynamic> product;

  @override
  Widget build(BuildContext context) {
    final p = product;
    final imageUrl = p['imageUrl'] as String?;
    final price = (p['price'] as String?) ?? '0';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: kNavy.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Image / icon area — show product image when available, else a generic icon
        Container(
          height: 110,
          decoration: BoxDecoration(
            color: kNavy.withValues(alpha: 0.06),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
          ),
          clipBehavior: Clip.antiAlias,
          child: imageUrl != null && imageUrl.isNotEmpty
              ? Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  errorBuilder: (context, error, stack) => const Center(
                      child: Icon(Icons.inventory_2_outlined, size: 48, color: kBlue)),
                )
              : const Center(
                  child: Icon(Icons.inventory_2_outlined, size: 48, color: kBlue)),
        ),
        // Details
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p['name'] as String,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kNavy),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 4),
            Text(p['description'] as String,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            Text(price == '0' ? 'Free' : 'PKR $price',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kOrange)),
          ]),
        ),
      ]),
    );
  }
}
