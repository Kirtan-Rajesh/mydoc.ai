import 'package:flutter/material.dart';

/// Brand palette — calm, clinical-but-warm.
class Brand {
  static const seed = Color(0xFF10B981); // emerald
  static const ink = Color(0xFF0B1B2B); // deep navy text
  static const gradientStart = Color(0xFF047857);
  static const gradientEnd = Color(0xFF10B981);

  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradientStart, gradientEnd],
  );
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.seed,
    surface: const Color(0xFFF7FAF9),
  );

  const radius16 = BorderRadius.all(Radius.circular(16));
  const radius20 = BorderRadius.all(Radius.circular(20));

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: AppBarTheme(
      centerTitle: false,
      backgroundColor: scheme.surface,
      foregroundColor: Brand.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: const TextStyle(
        color: Brand.ink,
        fontSize: 22,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
      ),
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.8, color: Brand.ink),
      headlineSmall: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.5, color: Brand.ink),
      titleLarge: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.4, color: Brand.ink),
      titleMedium: TextStyle(fontWeight: FontWeight.w600, letterSpacing: -0.2, color: Brand.ink),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: const OutlineInputBorder(borderRadius: radius16, borderSide: BorderSide.none),
      filled: true,
      fillColor: Colors.white,
      hintStyle: TextStyle(color: Colors.grey.shade500),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        shape: const RoundedRectangleBorder(borderRadius: radius16),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    cardTheme: const CardThemeData(
      elevation: 0,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: radius20),
      margin: EdgeInsets.zero,
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: BorderSide(color: Colors.grey.shade200),
      backgroundColor: Colors.white,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: scheme.primary.withValues(alpha: 0.12),
      elevation: 0,
      height: 68,
      labelTextStyle: const WidgetStatePropertyAll(
        TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    dividerTheme: DividerThemeData(color: Colors.grey.shade100),
  );
}

/// Soft drop shadow used on cards sitting on the tinted surface.
List<BoxShadow> softShadow(BuildContext context) => [
      BoxShadow(
        color: Brand.ink.withValues(alpha: 0.06),
        blurRadius: 24,
        offset: const Offset(0, 8),
      ),
    ];
