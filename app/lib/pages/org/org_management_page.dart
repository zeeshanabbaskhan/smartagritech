import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/ems_mock_data.dart';
import '../../widgets/ems_ui/ems_data_table.dart';
import '../../widgets/ems_ui/ems_badge.dart';
import '../../widgets/ems_ui/ems_button.dart';
import '../../widgets/ems_ui/ems_modal.dart';

class OrgManagementPage extends StatefulWidget {
  const OrgManagementPage({super.key});

  @override
  State<OrgManagementPage> createState() => _OrgManagementPageState();
}

class _OrgManagementPageState extends State<OrgManagementPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        Container(
          color: isDark ? kEmsCardDark : Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            labelColor: kEmsPrimary,
            unselectedLabelColor: kEmsTextMuted,
            indicatorColor: kEmsPrimary,
            indicatorWeight: 2.5,
            labelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
            unselectedLabelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
            tabs: const [
              Tab(text: 'Organizations'),
              Tab(text: 'Team Users'),
              Tab(text: 'IoT Gateways'),
            ],
          ),
        ),
        Divider(height: 1, color: isDark ? kEmsBorderDark : kEmsBorderLight),

        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildOrganizationsTab(isDark),
              _buildUsersTab(isDark),
              _buildGatewaysTab(isDark),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOrganizationsTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Registered Organizations',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              EmsButton(
                label: 'New Organization',
                icon: Icons.add,
                onPressed: () {
                  EmsModal.show(
                    context: context,
                    title: 'Create Organization',
                    confirmLabel: 'Create',
                    content: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(decoration: InputDecoration(hintText: 'Organization Name')),
                        SizedBox(height: 12),
                        TextField(decoration: InputDecoration(hintText: 'Org Code (e.g. SAT-04)')),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 14),
          EmsDataTable(
            columns: [
              EmsTableColumn(
                key: 'name',
                label: 'Organization',
                flex: 3,
                cellBuilder: (val, row) => Text(
                  val.toString(),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
              EmsTableColumn(key: 'code', label: 'Code', flex: 1),
              EmsTableColumn(key: 'deviceCount', label: 'Devices', flex: 1),
              EmsTableColumn(key: 'gatewayCount', label: 'Gateways', flex: 1),
              EmsTableColumn(key: 'contactEmail', label: 'Contact', flex: 2),
              EmsTableColumn(
                key: 'status',
                label: 'Status',
                flex: 1,
                cellBuilder: (val, _) => const EmsBadge(label: 'Active', variant: EmsBadgeVariant.success),
              ),
            ],
            data: EmsMockData.organizations,
          ),
        ],
      ),
    );
  }

  Widget _buildUsersTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Platform Users & Access',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              EmsButton(
                label: 'Invite User',
                icon: Icons.person_add_outlined,
                onPressed: () {},
              ),
            ],
          ),
          const SizedBox(height: 14),
          EmsDataTable(
            columns: [
              EmsTableColumn(
                key: 'fullName',
                label: 'Name',
                flex: 2,
                cellBuilder: (val, _) => Text(
                  val.toString(),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
              EmsTableColumn(key: 'email', label: 'Email', flex: 2),
              EmsTableColumn(key: 'orgName', label: 'Organization', flex: 2),
              EmsTableColumn(
                key: 'roleLabel',
                label: 'Role',
                flex: 2,
                cellBuilder: (val, _) => EmsBadge(label: val.toString(), variant: EmsBadgeVariant.info),
              ),
              EmsTableColumn(
                key: 'status',
                label: 'Status',
                flex: 1,
                cellBuilder: (val, _) => const EmsBadge(label: 'Active', variant: EmsBadgeVariant.success),
              ),
            ],
            data: EmsMockData.users,
          ),
        ],
      ),
    );
  }

  Widget _buildGatewaysTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'IoT Field Gateways',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              EmsButton(
                label: 'Register Gateway',
                icon: Icons.add,
                onPressed: () {},
              ),
            ],
          ),
          const SizedBox(height: 14),
          EmsDataTable(
            columns: [
              EmsTableColumn(
                key: 'name',
                label: 'Gateway Name',
                flex: 2,
                cellBuilder: (val, _) => Text(
                  val.toString(),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
              EmsTableColumn(key: 'ipAddress', label: 'IP Address', flex: 2),
              EmsTableColumn(key: 'macAddress', label: 'MAC Address', flex: 2),
              EmsTableColumn(key: 'port', label: 'Port', flex: 1),
              EmsTableColumn(key: 'connectedDevices', label: 'Devices', flex: 1),
              EmsTableColumn(
                key: 'status',
                label: 'Status',
                flex: 1,
                cellBuilder: (val, _) => const EmsBadge(label: 'Online', variant: EmsBadgeVariant.success),
              ),
            ],
            data: EmsMockData.gateways,
          ),
        ],
      ),
    );
  }
}
