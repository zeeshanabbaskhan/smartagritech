import 'package:flutter/material.dart';

// ─── EMS Brand Primary Tokens (from Tailwind & index.css) ─────────────────────
const kEmsPrimary = Color(0xFFF5A623);       // --brand-primary #F5A623
const kEmsPrimaryLight = Color(0xFFF5B830);  // --elsa-primary-light
const kEmsPrimaryDark = Color(0xFFCB7E12);   // --elsa-primary-dark

// ─── Surfaces & Backgrounds ──────────────────────────────────────────────────
const kEmsBgLight = Color(0xFFFEFEF8);       // surface-50: lemon-white page bg
const kEmsSurfaceAlt = Color(0xFFF7F7EE);    // surface-100: very soft lemon for alternates
const kEmsBgDark = Color(0xFF0A0D14);        // surface-950: deepest dark

// ─── Sidebar & Elevation Surfaces ────────────────────────────────────────────
const kEmsSidebarBg = Color(0xFF141828);     // surface-900: signature dark navy sidebar
const kEmsSidebarDark = Color(0xFF0A0D14);   // surface-950
const kEmsCardLight = Colors.white;
const kEmsCardDark = Color(0xFF141828);

// ─── Borders & Dividers ──────────────────────────────────────────────────────
const kEmsBorder = Color(0xFFECEEE6);        // surface-200
const kEmsBorderDark = Color(0xFF1F2937);    // surface-800
const kEmsDivider = Color(0xFFD1D5C8);       // surface-300

// ─── Typography & Neutrals ───────────────────────────────────────────────────
const kEmsTextMain = Color(0xFF1F2937);      // surface-800
const kEmsTextMainDark = Color(0xFFECEEE6);  // surface-200
const kEmsTextMuted = Color(0xFF6B7280);     // surface-500
const kEmsTextMutedDark = Color(0xFF9AA09A); // surface-400
const kEmsTextHeading = Color(0xFF111827);   // surface-900

// ─── Semantic Colors ─────────────────────────────────────────────────────────
const kEmsSuccess = Color(0xFF16A34A);       // success-600
const kEmsSuccessBg = Color(0xFFDCFCE7);     // success-100
const kEmsWarning = Color(0xFFF5A623);       // warning-600
const kEmsWarningBg = Color(0xFFFEF3C7);     // warning-100
const kEmsDanger = Color(0xFFDC2626);        // danger-600
const kEmsDangerBg = Color(0xFFFEE2E2);      // danger-100
const kEmsInfo = Color(0xFF2563EB);          // info-600
const kEmsInfoBg = Color(0xFFDBEAFE);        // info-100

// ─── Energy Flow Sources ─────────────────────────────────────────────────────
const kEmsSourceGrid = Color(0xFF3B82F6);    // Grid Blue
const kEmsSourceSolar = Color(0xFFF5A623);   // Solar Amber/Gold
const kEmsSourceGen = Color(0xFF22C55E);     // Generator Green
const kEmsSourceBattery = Color(0xFF8B5CF6); // Battery Purple

// ─── Extended Aliases for UI Widgets ──────────────────────────────────────────
const kEmsBorderLight = kEmsBorder;
const kEmsBorderLightDarker = Color(0xFFD1D5C8);
const kEmsTextPrimaryLight = kEmsTextMain;
const kEmsTextPrimaryDark = kEmsTextMainDark;
const kEmsTextSecondaryLight = kEmsTextMuted;
const kEmsTextSecondaryDark = kEmsTextMutedDark;
const kEmsTextMutedLight = kEmsTextMuted;
const kEmsSurface100Light = kEmsSurfaceAlt;
const kEmsSurface800Dark = Color(0xFF1F2937);
const kEmsSurface900Dark = kEmsSidebarBg;

// ─── Legacy Aliases (Backwards Compatibility) ────────────────────────────────
const kNavy = kEmsSidebarBg;
const kBg = kEmsBgLight;
const kBlue = kEmsInfo;
const kGreen = kEmsSuccess;
const kOrange = kEmsPrimary;
const kRed = kEmsDanger;
const kCard = kEmsCardLight;

const kTitleStyle = TextStyle(
  color: kEmsTextHeading,
  fontSize: 20,
  fontWeight: FontWeight.w700,
  letterSpacing: -0.3,
);

const kSubtitleStyle = TextStyle(
  color: kEmsTextMuted,
  fontSize: 13,
);

// ─── Card Shadow (shadow-card in Tailwind) ────────────────────────────────────
List<BoxShadow> get kEmsCardShadow => [
  BoxShadow(
    color: Colors.black.withValues(alpha: 0.05),
    blurRadius: 4,
    offset: const Offset(0, 1),
  ),
  BoxShadow(
    color: Colors.black.withValues(alpha: 0.03),
    blurRadius: 2,
    offset: const Offset(0, 1),
  ),
];

// ─── Elevated Shadow (shadow-elevated in Tailwind) ────────────────────────────
List<BoxShadow> get kEmsElevatedShadow => [
  BoxShadow(
    color: Colors.black.withValues(alpha: 0.08),
    blurRadius: 8,
    offset: const Offset(0, 4),
  ),
  BoxShadow(
    color: Colors.black.withValues(alpha: 0.04),
    blurRadius: 3,
    offset: const Offset(0, 2),
  ),
];

// ─── Theme Data Definition ───────────────────────────────────────────────────
ThemeData buildEmsTheme({bool isDark = false}) {
  final bg = isDark ? kEmsBgDark : kEmsBgLight;
  final card = isDark ? kEmsCardDark : kEmsCardLight;
  final border = isDark ? kEmsBorderDark : kEmsBorder;
  final textMain = isDark ? kEmsTextMainDark : kEmsTextMain;
  final textMuted = isDark ? kEmsTextMutedDark : kEmsTextMuted;

  return ThemeData(
    useMaterial3: true,
    brightness: isDark ? Brightness.dark : Brightness.light,
    scaffoldBackgroundColor: bg,
    primaryColor: kEmsPrimary,
    colorScheme: ColorScheme(
      brightness: isDark ? Brightness.dark : Brightness.light,
      primary: kEmsPrimary,
      onPrimary: Colors.white,
      secondary: kEmsPrimaryLight,
      onSecondary: Colors.white,
      error: kEmsDanger,
      onError: Colors.white,
      surface: card,
      onSurface: textMain,
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: border, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    dividerTheme: DividerThemeData(
      color: border,
      thickness: 1,
      space: 1,
    ),
    textTheme: TextTheme(
      headlineMedium: TextStyle(
        color: isDark ? Colors.white : kEmsTextHeading,
        fontSize: 22,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
      titleLarge: TextStyle(
        color: isDark ? Colors.white : kEmsTextHeading,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
      titleMedium: TextStyle(
        color: textMain,
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
      bodyMedium: TextStyle(
        color: textMain,
        fontSize: 13,
      ),
      bodySmall: TextStyle(
        color: textMuted,
        fontSize: 12,
      ),
    ),
  );
}
