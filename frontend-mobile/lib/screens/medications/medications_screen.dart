import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api.dart';
import '../../models.dart';
import '../../providers.dart';
import '../../services/notifications.dart';
import '../../theme.dart';

class MedicationsScreen extends ConsumerWidget {
  const MedicationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meds = ref.watch(medicationsProvider);

    // Keep device reminders in sync with the medication plan.
    ref.listen(medicationsProvider, (_, next) {
      next.whenData((list) => ReminderService.instance.syncFromMedications(list));
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Medicines')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (_) => const _AddMedicationSheet(),
        ),
        icon: const Icon(Icons.add),
        label: const Text('Add medicine'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(medicationsProvider);
          ref.invalidate(todayDosesProvider);
        },
        child: meds.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            Padding(padding: const EdgeInsets.all(24), child: Text(e.toString()))
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 80),
                  Icon(Icons.medication_outlined, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  Text('No medicines yet',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    'Add your medicines and times — I will remind you daily and track your adherence.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade600, height: 1.45),
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
    final scheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: softShadow(context),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.medication, color: scheme.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${med.name} ${med.dosage}'.trim(),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                if (med.instructions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(med.instructions,
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5)),
                  ),
                if (med.times.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final t in med.times)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: scheme.primary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.alarm, size: 13, color: scheme.primary),
                                const SizedBox(width: 4),
                                Text(t,
                                    style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                        color: scheme.primary)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (value) async {
              if (value == 'taken') {
                await ref
                    .read(apiClientProvider)
                    .logDose(med.id, DateTime.now().toUtc(), 'taken');
                ref.invalidate(todayDosesProvider);
                if (context.mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('Dose recorded')));
                }
              } else if (value == 'delete') {
                await ref.read(apiClientProvider).deleteMedication(med.id);
                ref.invalidate(medicationsProvider);
                ref.invalidate(todayDosesProvider);
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'taken', child: Text('Mark dose taken')),
              PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
        ],
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
      ref.invalidate(todayDosesProvider);
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
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text('Add medicine', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
                labelText: 'Medicine name', errorText: _error, filled: true,
                fillColor: Theme.of(context).colorScheme.surface),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _dosageController,
                  decoration: InputDecoration(
                      labelText: 'Dosage (500mg)',
                      filled: true,
                      fillColor: Theme.of(context).colorScheme.surface),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _instructionsController,
                  decoration: InputDecoration(
                      labelText: 'After food…',
                      filled: true,
                      fillColor: Theme.of(context).colorScheme.surface),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ..._times.map((t) => Chip(
                    avatar: const Icon(Icons.alarm, size: 16),
                    label: Text(t),
                    onDeleted: () => setState(() => _times.remove(t)),
                  )),
              ActionChip(
                avatar: const Icon(Icons.add_alarm, size: 18),
                label: const Text('Add reminder time'),
                onPressed: _pickTime,
              ),
            ],
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save & set reminders'),
          ),
        ],
      ),
    );
  }
}
