class AppUser {
  AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.organizationId,
    required this.status,
    this.organization,
  });

  final String id;
  final String fullName;
  final String email;
  final String role;
  final String? organizationId;
  final String status;
  final Map<String, dynamic>? organization;

  bool get isOrgAdmin => role == 'ORG_ADMIN' || role == 'org';
  bool get isUser => role == 'USER' || role == 'user';
  bool get canManageOrg => isOrgAdmin;
  bool get isActive => status.toUpperCase() == 'ACTIVE';

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String get roleLabel {
    final r = role.toUpperCase();
    switch (r) {
      case 'ORG':
      case 'ORG_ADMIN':
        return 'Org Admin';
      case 'USER':
      case 'CUSTOMER':
        return 'User';
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'Super Admin';
      default:
        return role;
    }
  }

  static String normalizeRole(String? raw) {
    if (raw == null) return 'USER';
    final upper = raw.toUpperCase();
    if (upper == 'ORG' || upper == 'ORG_ADMIN') return 'ORG_ADMIN';
    if (upper == 'ADMIN' || upper == 'SUPER_ADMIN') return 'SUPER_ADMIN';
    return 'USER';
  }

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: (json['id'] ?? '').toString(),
        fullName: (json['fullName'] ?? json['name'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        role: normalizeRole(json['role']?.toString()),
        organizationId: (json['organizationId'] ?? json['orgId'] ?? json['org_id'])?.toString(),
        status: (json['status'] ?? 'ACTIVE').toString(),
        organization: json['organization'] as Map<String, dynamic>?,
      );
}
