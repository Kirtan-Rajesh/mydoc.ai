import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api.dart';
import '../../models.dart';
import '../../providers.dart';

class MedicationsScreen extends ConsumerWidget {
  const MedicationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meds = ref.watch(medicationsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Medications')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (_) => const _AddMedicationSheet(),
        ),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(medicationsProvider),
        child: meds.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            Padding(padding: const EdgeInsets.all(24), child: Text(e.toString()))
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Icon(Icons.medication_outlined, size: 64, color: Colors.grey),
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'No medications added.\nTrack medicines and mark doses as taken.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              itemCount: list.length,
              itemBuilder: (context, i) => _MedicationCard(med: list[i]),
            );
          },
        ),
      ),
    );
  }
}

class _MedicationCard extends ConsumerWidget {
  const _MedicationCard({required this.med});

  final Medication med;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('${med.name} ${med.dosage}'.trim(),
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                PopupMenuButton<String>(
                  onSelected: (value) async {
                    if (value == 'taken') {
                      await ref
                          .read(apiClientProvider)
                          .logDose(med.id, DateTime.now(), 'taken');
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Dose marked as taken')));
                      }
                    } else if (value == 'delete') {
                      await ref.read(apiClientProvider).deleteMedication(med.id);
                      ref.invalidate(medicationsProvider);
                    }
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'taken', child: Text('Mark dose taken')),
                    PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
              ],
            ),
            if (med.instructions.isNotEmpty)
              Text(med.instructions, style: Theme.of(context).textTheme.bodySmall),
            if (med.times.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  spacing: 8,
                  children: med.times
                      .map((t) => Chip(
                            avatar: const Icon(Icons.schedule, size: 16),
                            label: Text(t),
                            visualDensity: VisualDensity.compact,
                          ))
                      .toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AddMedicationSheet extends ConsumerStatefulWidget {
  const _AddMedicationSheet();

  @override
  ConsumerState<_AddMedicationSheet> createState() => _AddMedicationSheetState();
}

class _AddMedicationSheetState extends ConsumerState<_AddMedicationSheet> {
  final _nameController = TextEditingController();
  final _dosageController = TextEditingController();
  final _instructionsController = TextEditingController();
  final List<String> _times = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _dosageController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (picked != null) {
      final formatted =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      setState(() {
        if (!_times.contains(formatted)) _times.add(formatted);
        _times.sort();
      });
    }
  }

  Future<void> _save() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Medicine name is required');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).createMedication(
            name: _nameController.text.trim(),
            dosage: _dosageController.text.trim(),
            instructions: _instructionsController.text.trim(),
            times: _times,
          );
      ref.invalidate(medicationsProvider);
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Add medication', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            decoration: InputDecoration(labelText: 'Medicine name', errorText: _error),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _dosageController,
            decoration: const InputDecoration(labelText: 'Dosage (e.g. 500mg)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _instructionsController,
            decoration: const InputDecoration(labelText: 'Instructions (e.g. after food)'),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ..._times.map((t) => Chip(
                    label: Text(t),
                    onDeleted: () => setState(() => _times.remove(t)),
                  )),
              ActionChip(
                avatar: const Icon(Icons.add_alarm, size: 18),
                label: const Text('Add time'),
                onPressed: _pickTime,
              ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
    );
  }
}
