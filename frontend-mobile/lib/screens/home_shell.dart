import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'chat/chat_screen.dart';
import 'documents/documents_screen.dart';
import 'medications/medications_screen.dart';
import 'profile/profile_screen.dart';
import 'today_screen.dart';

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(navIndexProvider);

    return Scaffold(
      body: IndexedStack(
        index: index,
        children: const [
          TodayScreen(),
          DocumentsScreen(),
          ChatScreen(),
          MedicationsScreen(),
          ProfileScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => ref.read(navIndexProvider.notifier).state = i,
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.wb_sunny_outlined), selectedIcon: Icon(Icons.wb_sunny), label: 'Today'),
          NavigationDestination(
              icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder), label: 'Records'),
          NavigationDestination(
              icon: Icon(Icons.auto_awesome_outlined),
              selectedIcon: Icon(Icons.auto_awesome),
              label: 'Ask AI'),
          NavigationDestination(
              icon: Icon(Icons.medication_outlined),
              selectedIcon: Icon(Icons.medication),
              label: 'Meds'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

/// Helper for any screen: jump to the Ask AI tab with optional context.
void openChat(WidgetRef ref, {String? documentId, String? prefill}) {
  ref.read(chatIntentProvider.notifier).state =
      ChatIntent(documentId: documentId, prefill: prefill);
  ref.read(navIndexProvider.notifier).state = 2;
}
