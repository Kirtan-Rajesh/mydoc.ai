import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../api.dart';
import '../../models.dart';
import '../../providers.dart';
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

  /// Refresh the list every few seconds while any document is processing.
  void _maybePoll(List<DocumentModel> docs) {
    final processing = docs.any((d) => d.isProcessing);
    if (processing && (_pollTimer == null || !_pollTimer!.isActive)) {
      _pollTimer = Timer(const Duration(seconds: 4), () {
        if (mounted) ref.invalidate(documentsProvider);
      });
    }
  }

  Future<void> _upload({required bool fromCamera}) async {
    String? path;
    String? name;
    String mime = 'image/jpeg';

    try {
      if (fromCamera) {
        final shot = await ImagePicker()
            .pickImage(source: ImageSource.camera, imageQuality: 85, maxWidth: 2400);
        if (shot == null) return;
        path = shot.path;
        name = shot.name;
      } else {
        final result = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        );
        if (result == null || result.files.single.path == null) return;
        path = result.files.single.path!;
        name = result.files.single.name;
        final ext = name.split('.').last.toLowerCase();
        mime = switch (ext) {
          'pdf' => 'application/pdf',
          'png' => 'image/png',
          'webp' => 'image/webp',
          _ => 'image/jpeg',
        };
      }

      setState(() => _uploading = true);
      await ref
          .read(apiClientProvider)
          .uploadDocument(filePath: path, fileName: name, mimeType: mime);
      ref.invalidate(documentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Uploaded — analysing your document…')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _showUploadSheet() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Scan with camera'),
              onTap: () {
                Navigator.pop(ctx);
                _upload(fromCamera: true);
              },
            ),
            ListTile(
              leading: const Icon(Icons.upload_file_outlined),
              title: const Text('Choose PDF or image'),
              onTap: () {
                Navigator.pop(ctx);
                _upload(fromCamera: false);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final docs = ref.watch(documentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Health Records')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading ? null : _showUploadSheet,
        icon: _uploading
            ? const SizedBox(
                height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.add),
        label: Text(_uploading ? 'Uploading…' : 'Add record'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(documentsProvider),
        child: docs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              Padding(padding: const EdgeInsets.all(24), child: Text(e.toString())),
            ],
          ),
          data: (list) {
            _maybePoll(list);
            if (list.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Icon(Icons.folder_open, size: 64, color: Colors.grey),
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'Your health vault is empty.\nUpload lab reports, prescriptions and scans — the AI will read and organise them.',
                      textAlign: TextAlign.center,
                    ),
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

  (IconData, String) get _typeBadge => switch (doc.documentType) {
        'blood_report' => (Icons.bloodtype_outlined, 'Blood report'),
        'urine_report' => (Icons.science_outlined, 'Urine report'),
        'prescription' => (Icons.medication_outlined, 'Prescription'),
        'scan' => (Icons.image_search_outlined, 'Scan'),
        'vaccination' => (Icons.vaccines_outlined, 'Vaccination'),
        'discharge_summary' => (Icons.local_hospital_outlined, 'Discharge summary'),
        _ => (Icons.description_outlined, 'Document'),
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (icon, label) = _typeBadge;
    final subtitle = doc.isProcessing
        ? 'Analysing…'
        : doc.status == 'failed'
            ? 'Processing failed — tap for details'
            : (doc.summary ?? label);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: doc.isProcessing
            ? const SizedBox(
                height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2))
            : Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(doc.fileName, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: doc.reportDate != null
            ? Text(doc.reportDate!, style: Theme.of(context).textTheme.bodySmall)
            : null,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
        ),
      ),
    );
  }
}
