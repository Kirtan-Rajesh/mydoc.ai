import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models.dart';
import '../../providers.dart';

final documentDetailProvider =
    FutureProvider.autoDispose.family<DocumentModel, String>(
  (ref, id) => ref.watch(apiClientProvider).getDocument(id),
);

class DocumentDetailScreen extends ConsumerWidget {
  const DocumentDetailScreen({super.key, required this.documentId});

  final String documentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(documentDetailProvider(documentId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Document'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Delete document?'),
                  content: const Text('This will remove it from your vault.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel')),
                    FilledButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Delete')),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                await ref.read(apiClientProvider).deleteDocument(documentId);
                ref.invalidate(documentsProvider);
                if (context.mounted) Navigator.pop(context);
              }
            },
          ),
        ],
      ),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) =>
            Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(e.toString()))),
        data: (doc) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(doc.fileName, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Wrap(
              spacing: 8,
              children: [
                if (doc.documentType != null) Chip(label: Text(doc.documentType!)),
                if (doc.reportDate != null) Chip(label: Text(doc.reportDate!)),
                if (doc.labName != null) Chip(label: Text(doc.labName!)),
              ],
            ),
            const SizedBox(height: 16),
            if (doc.isProcessing)
              const Card(
                child: ListTile(
                  leading: SizedBox(
                      height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)),
                  title: Text('The AI is reading this document…'),
                ),
              ),
            if (doc.status == 'failed')
              Card(
                child: ListTile(
                  leading: Icon(Icons.error_outline,
                      color: Theme.of(context).colorScheme.error),
                  title: const Text('Processing failed'),
                  subtitle: const Text('Pull to refresh or re-upload the document.'),
                ),
              ),
            if (doc.summary != null) ...[
              Text('Summary', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Card(
                child: Padding(padding: const EdgeInsets.all(16), child: Text(doc.summary!)),
              ),
              const SizedBox(height: 16),
            ],
            if (doc.structuredData != null && doc.structuredData!.isNotEmpty) ...[
              Text('Key values', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Card(
                child: Column(
                  children: doc.structuredData!.entries
                      .map((e) => ListTile(
                            dense: true,
                            title: Text(e.key),
                            trailing: Text(e.value.toString(),
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                          ))
                      .toList(),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
