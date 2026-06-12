import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../home_shell.dart';

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
        title: const Text('Report'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Delete this record?'),
                  content: const Text('It will be removed from your vault.'),
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
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: FilledButton.icon(
            icon: const Icon(Icons.auto_awesome),
            label: const Text('Ask AI about this report'),
            onPressed: () {
              Navigator.pop(context);
              openChat(ref,
                  documentId: documentId,
                  prefill: 'Explain this report to me in simple words.');
            },
          ),
        ),
      ),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Padding(padding: const EdgeInsets.all(24), child: Text(e.toString()))),
        data: (doc) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(doc.fileName, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (doc.documentType != null)
                  Chip(label: Text(doc.documentType!.replaceAll('_', ' '))),
                if (doc.reportDate != null) Chip(label: Text(doc.reportDate!)),
                if (doc.labName != null) Chip(label: Text(doc.labName!)),
              ],
            ),
            const SizedBox(height: 18),
            if (doc.isProcessing)
              const _Panel(
                child: Row(
                  children: [
                    SizedBox(
                        height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 14),
                    Expanded(child: Text('Your AI doctor is reading this document…')),
                  ],
                ),
              ),
            if (doc.status == 'failed')
              _Panel(
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error),
                    const SizedBox(width: 14),
                    const Expanded(
                        child:
                            Text('Processing failed. Try re-uploading a clearer photo.')),
                  ],
                ),
              ),
            if (doc.summary != null) ...[
              Text('Summary', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              _Panel(child: Text(doc.summary!, style: const TextStyle(height: 1.5))),
              const SizedBox(height: 18),
            ],
            if (doc.structuredData != null && doc.structuredData!.isNotEmpty) ...[
              Text('Key values', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              _Panel(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final (i, e) in doc.structuredData!.entries.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            Expanded(child: Text(e.key)),
                            Text(e.value.toString(),
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.padding = const EdgeInsets.all(16)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: softShadow(context),
      ),
      child: child,
    );
  }
}
