import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api.dart';
import '../../models.dart';
import '../../providers.dart';
import '../../services/upload.dart';
import '../../theme.dart';
import '../home_shell.dart';
import 'document_detail_screen.dart';

class DocumentsScreen extends ConsumerStatefulWidget {
  const DocumentsScreen({super.key});

  @override
  ConsumerState<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends ConsumerState<DocumentsScreen> {
  bool _uploading = false;
  Timer? _pollTimer;

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _maybePoll(List<DocumentModel> docs) {
    final processing = docs.any((d) => d.isProcessing);
    if (processing && (_pollTimer == null || !_pollTimer!.isActive)) {
      _pollTimer = Timer(const Duration(seconds: 4), () {
        if (mounted) ref.invalidate(documentsProvider);
      });
    }
  }

  Future<void> _upload() async {
    try {
      setState(() => _uploading = true);
      final doc = await pickAndUploadDocument(context, ref);
      if (doc != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Uploaded — I am reading it now…'),
          action: SnackBarAction(
            label: 'Ask AI',
            onPressed: () => openChat(ref,
                documentId: doc.id, prefill: 'What does this report say?'),
          ),
        ));
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final docs = ref.watch(documentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Health Records')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading ? null : _upload,
        icon: _uploading
            ? const SizedBox(
                height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.document_scanner_outlined),
        label: Text(_uploading ? 'Uploading…' : 'Scan / add'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(documentsProvider),
        child: docs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            Padding(padding: const EdgeInsets.all(24), child: Text(e.toString()))
          ]),
          data: (list) {
            _maybePoll(list);
            if (list.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 80),
                  Icon(Icons.folder_open,
                      size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  Text('Your health vault is empty',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    'Scan lab reports, prescriptions and scans.\nEverything is read, classified and explained by your AI doctor.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade600, height: 1.45),
                  ),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              itemCount: list.length,
              itemBuilder: (context, i) => _DocumentCard(doc: list[i]),
            );
          },
        ),
      ),
    );
  }
}

class _DocumentCard extends ConsumerWidget {
  const _DocumentCard({required this.doc});

  final DocumentModel doc;

  (IconData, String, Color) _badge(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return switch (doc.documentType) {
      'blood_report' => (Icons.bloodtype_outlined, 'Blood report', Colors.red.shade400),
      'urine_report' => (Icons.science_outlined, 'Urine report', Colors.amber.shade700),
      'prescription' => (Icons.medication_outlined, 'Prescription', scheme.primary),
      'scan' => (Icons.image_search_outlined, 'Scan', Colors.blue.shade400),
      'vaccination' => (Icons.vaccines_outlined, 'Vaccination', Colors.purple.shade400),
      'discharge_summary' => (
          Icons.local_hospital_outlined,
          'Discharge summary',
          Colors.teal.shade400
        ),
      _ => (Icons.description_outlined, 'Document', scheme.primary),
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (icon, label, color) = _badge(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: softShadow(context),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: doc.isProcessing
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(icon, color: color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.fileName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                    const SizedBox(height: 3),
                    Text(
                      doc.isProcessing
                          ? 'Analysing…'
                          : doc.status == 'failed'
                              ? 'Processing failed — tap for details'
                              : (doc.summary ?? label),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: Colors.grey.shade600, fontSize: 12.5, height: 1.35),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _MiniChip(text: label, color: color),
                        if (doc.reportDate != null) ...[
                          const SizedBox(width: 6),
                          _MiniChip(text: doc.reportDate!, color: Colors.grey.shade500),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniChip extends StatelessWidget {
  const _MiniChip({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
