/// Shared "scan or pick a document" flow used by chat, home and records.
library;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../models.dart';
import '../providers.dart';

/// Shows the source sheet, uploads the chosen file, and returns the created
/// document (still processing). Returns null if the user cancelled.
Future<DocumentModel?> pickAndUploadDocument(
  BuildContext context,
  WidgetRef ref, {
  bool allowCamera = true,
}) async {
  final source = await showModalBottomSheet<String>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            if (allowCamera && !kIsWeb)
              ListTile(
                leading: const CircleAvatar(child: Icon(Icons.camera_alt_outlined)),
                title: const Text('Scan with camera'),
                subtitle: const Text('Photograph a report or prescription'),
                onTap: () => Navigator.pop(ctx, 'camera'),
              ),
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.photo_outlined)),
              title: const Text('Choose a photo'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.picture_as_pdf_outlined)),
              title: const Text('Pick a PDF'),
              onTap: () => Navigator.pop(ctx, 'pdf'),
            ),
          ],
        ),
      ),
    ),
  );
  if (source == null) return null;

  String fileName;
  String mimeType = 'image/jpeg';
  String? path;
  List<int>? bytes;

  if (source == 'camera' || source == 'gallery') {
    final shot = await ImagePicker().pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2400,
    );
    if (shot == null) return null;
    fileName = shot.name.isEmpty ? 'scan.jpg' : shot.name;
    if (kIsWeb) {
      bytes = await shot.readAsBytes();
    } else {
      path = shot.path;
    }
    if (fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png';
  } else {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      withData: kIsWeb,
    );
    if (result == null) return null;
    final f = result.files.single;
    fileName = f.name;
    if (kIsWeb) {
      bytes = f.bytes;
      if (bytes == null) return null;
    } else {
      path = f.path;
      if (path == null) return null;
    }
    final ext = fileName.split('.').last.toLowerCase();
    mimeType = switch (ext) {
      'pdf' => 'application/pdf',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
  }

  final doc = await ref.read(apiClientProvider).uploadDocument(
        filePath: path,
        bytes: bytes,
        fileName: fileName,
        mimeType: mimeType,
      );
  ref.invalidate(documentsProvider);
  return doc;
}
