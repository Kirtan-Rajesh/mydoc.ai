import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'providers.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home_shell.dart';
import 'services/notifications.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = await ApiClient.create();
  // Fire-and-forget: permission prompt + timezone setup for reminders.
  ReminderService.instance.init();
  runApp(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MyDocApp(),
    ),
  );
}

class MyDocApp extends ConsumerWidget {
  const MyDocApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return MaterialApp(
      title: 'mydoc.ai',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: auth.loggedIn ? const HomeShell() : const LoginScreen(),
    );
  }
}
