import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/auth_service.dart';
import '../services/ems_api.dart';

class SubscriptionPage extends StatefulWidget {
  const SubscriptionPage({super.key});

  @override
  State<SubscriptionPage> createState() => _SubscriptionPageState();
}

class _SubscriptionPageState extends State<SubscriptionPage> {
  String? _selectedPlan;
  bool _annual = false;
  bool _submitting = false;

  static final _plans = [
    {
      'name': 'Starter',
      'subtitle': 'Up to 10 devices',
      'price': 4999,
      'features': ['10 devices', 'Basic alerts', 'Email support'],
    },
    {
      'name': 'Professional',
      'subtitle': 'Up to 50 devices',
      'price': 14999,
      'popular': true,
      'features': ['50 devices', 'AI analytics', 'Priority support'],
    },
    {
      'name': 'Enterprise',
      'subtitle': 'Unlimited scale',
      'price': 0,
      'custom': true,
      'features': ['Unlimited devices', 'Dedicated support', 'Custom integrations'],
    },
  ];

  @override
  Widget build(BuildContext context) {
    final plans = _plans;
    final orgName = AuthService.instance.user?.organization?['name'] as String?;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Subscription Plans',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Intro banner — request a plan / contact sales
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [kNavy, Color(0xFF1A3A6B)]),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.workspace_premium_outlined, color: Color(0xFFE8A820), size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(orgName != null ? 'Plans for $orgName' : 'Upgrade your plan',
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 3),
                Text('Pick a plan below and our team will reach out to set it up.',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
              ])),
            ]),
          ),
          const SizedBox(height: 24),

          // Billing toggle
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Choose Your Plan',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kNavy)),
            Row(children: [
              Text('Monthly', style: TextStyle(fontSize: 12,
                  color: _annual ? Colors.grey.shade500 : kNavy, fontWeight: FontWeight.w600)),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => setState(() => _annual = !_annual),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 44, height: 24,
                  decoration: BoxDecoration(
                      color: _annual ? kGreen : Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(12)),
                  child: AnimatedAlign(
                    duration: const Duration(milliseconds: 200),
                    alignment: _annual ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.all(3),
                      width: 18, height: 18,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Text('Annual', style: TextStyle(fontSize: 12,
                  color: _annual ? kGreen : Colors.grey.shade500, fontWeight: FontWeight.w600)),
              if (_annual) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: kGreen.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
                  child: const Text('20% OFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kGreen)),
                ),
              ],
            ]),
          ]),
          const SizedBox(height: 16),

          // Plan cards
          ...plans.map((plan) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _PlanCard(
              plan: plan,
              isCurrentPlan: false,
              isSelected: _selectedPlan == plan['name'],
              annual: _annual,
              onSelect: () => setState(() => _selectedPlan = plan['name'] as String),
            ),
          )),

          // Request button
          if (_selectedPlan != null)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting
                    ? null
                    : () {
                        final plan = _plans.firstWhere(
                          (p) => p['name'] == _selectedPlan,
                          orElse: () => _plans.first,
                        );
                        _subscribe(plan);
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kNavy, foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text('Request $_selectedPlan Plan'),
              ),
            ),
          const SizedBox(height: 12),
          Center(child: Text('All plans include 24/7 support · Cancel anytime',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500))),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }

  Future<void> _subscribe(Map<String, dynamic> plan) async {
    setState(() => _submitting = true);
    try {
      final user = AuthService.instance.user;
      await EmsApi.instance.submitSubscription({
        'name': user?.fullName ?? 'User',
        'email': user?.email ?? '',
        if (user?.organizationId != null) 'organizationId': user!.organizationId,
        'description': 'Interest in ${plan['name']} plan',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Request submitted! Our team will contact you shortly.'),
          backgroundColor: Color(0xFF34A853),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: Color(0xFFE53935),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrentPlan,
    required this.isSelected,
    required this.annual,
    required this.onSelect,
  });
  final Map<String, dynamic> plan;
  final bool isCurrentPlan, isSelected, annual;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final isPop = plan['popular'] == true;
    final borderColor = isSelected ? kNavy : (isPop ? kBlue : Colors.grey.shade200);
    final features = plan['features'] as List<dynamic>;
    final price = plan['price'] as int;
    final isCustom = price == 0;
    final displayPrice = annual && !isCustom ? (price * 0.8).round() : price;

    return GestureDetector(
      onTap: onSelect,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor, width: isSelected ? 2 : 1.2),
          boxShadow: [
            if (isSelected) BoxShadow(color: kNavy.withValues(alpha: 0.12), blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              color: isCurrentPlan ? kNavy.withValues(alpha: 0.05) : (isPop ? kBlue.withValues(alpha: 0.05) : Colors.transparent),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
            ),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(plan['name'] as String,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kNavy)),
                  if (isPop) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: kBlue, borderRadius: BorderRadius.circular(20)),
                      child: const Text('Popular', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                  ],
                  if (isCurrentPlan) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: kGreen, borderRadius: BorderRadius.circular(20)),
                      child: const Text('Current', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ]),
                const SizedBox(height: 2),
                Text(plan['subtitle'] as String,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(isCustom ? 'Custom' : 'PKR $displayPrice',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kNavy)),
                  if (!isCustom)
                    Text('/mo', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ]),
                if (annual && price > 0)
                  Text('Was PKR $price/mo',
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade400,
                          decoration: TextDecoration.lineThrough)),
              ]),
            ]),
          ),
          Divider(height: 1, color: Colors.grey.shade100),
          // Features
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: features.map<Widget>((f) => Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(children: [
                  const Icon(Icons.check_circle, size: 16, color: kGreen),
                  const SizedBox(width: 8),
                  Expanded(child: Text(f as String,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
                ]),
              )).toList(),
            ),
          ),
          if (!isCurrentPlan)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: onSelect,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isSelected ? Colors.white : kNavy,
                    backgroundColor: isSelected ? kNavy : Colors.transparent,
                    side: BorderSide(color: isSelected ? kNavy : Colors.grey.shade300),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: Text(isSelected ? 'Selected' : 'Select Plan',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}
