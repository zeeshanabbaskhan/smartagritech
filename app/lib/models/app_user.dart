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

  bool get isOrgAdmin => role == 'ORG_ADMIN';
  bool get isUser => role == 'USER';
  bool get canManageOrg => isOrgAdmin;
  bool get isActive => status == 'ACTIVE';

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String get roleLabel {
    switch (role) {
      case 'ORG_ADMIN':
        return 'Org Admin';
      case 'USER':
        return 'User';
      default:
        return role;
    }
  }

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        email: json['email'] as String? ?? '',
        role: json['role'] as String? ?? 'USER',
        organizationId: json['organizationId'] as String?,
        status: json['status'] as String? ?? 'ACTIVE',
        organization: json['organization'] as Map<String, dynamic>?,
      );
}
