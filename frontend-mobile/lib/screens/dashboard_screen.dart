import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final docs = ref.watch(documentsProvider);
    final meds = ref.watch(medicationsProvider);
    final name = auth.user?.name.split(' ').first ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(name.isEmpty ? 'Welcome' : 'Namaste, $name'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(documentsProvider);
          ref.invalidate(medicationsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    icon: Icons.folder,
                    label: 'Documents',
                    value: docs.maybeWhen(
                        data: (d) => d.length.toString(), orElse: () => '—'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    icon: Icons.medication,
                    label: 'Active meds',
                    value: meds.maybeWhen(
                        data: (m) => m.length.toString(), orElse: () => '—'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text('Recent documents', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            docs.when(
              loading: () => const Center(
                  child: Padding(
                      padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
              error: (e, _) => _ErrorTile(message: e.toString()),
              data: (list) {
                if (list.isEmpty) {
                  return const Card(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                          'No documents yet. Upload your first lab report or prescription from the Records tab.'),
                    ),
                  );
                }
                return Column(
                  children: list.take(3).map((doc) {
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.description_outlined),
                        title: Text(doc.fileName,
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text(doc.summary ?? doc.status,
                            maxLines: 2, overflow: TextOverflow.ellipsis),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 24),
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: const Padding(
                padding: EdgeInsets.all(20),
                child: Row(
                  children: [
                    Icon(Icons.tips_and_updates_outlined),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                          'Tip: Ask the AI about any report — "What does my hemoglobin value mean?"'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ErrorTile extends StatelessWidget {
  const _ErrorTile({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error),
        title: Text(message),
      ),
    );
  }
}
