import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api.dart';
import '../../providers.dart';

const _languages = {
  'en': 'English',
  'hi': 'हिन्दी',
  'ta': 'தமிழ்',
  'te': 'తెలుగు',
  'kn': 'ಕನ್ನಡ',
  'ml': 'മലയാളം',
  'mr': 'मराठी',
  'gu': 'ગુજરાતી',
  'bn': 'বাংলা',
  'pa': 'ਪੰਜਾਬੀ',
  'or': 'ଓଡ଼ିଆ',
};

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final profile = ref.watch(profileProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                child: Text(user?.name.isNotEmpty == true
                    ? user!.name[0].toUpperCase()
                    : '?'),
              ),
              title: Text(user?.name ?? '—'),
              subtitle: Text(user?.phone ?? ''),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.translate),
              title: const Text('Language'),
              subtitle: Text(_languages[user?.languagePref] ?? 'English'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final code = await showModalBottomSheet<String>(
                  context: context,
                  builder: (ctx) => SafeArea(
                    child: ListView(
                      shrinkWrap: true,
                      children: _languages.entries
                          .map((e) => ListTile(
                                title: Text(e.value),
                                onTap: () => Navigator.pop(ctx, e.key),
                              ))
                          .toList(),
                    ),
                  ),
                );
                if (code != null) {
                  await ref.read(apiClientProvider).updateMe(languagePref: code);
                  await ref.read(authProvider.notifier).refreshUser();
                }
              },
            ),
          ),
          const SizedBox(height: 8),
          profile.when(
            loading: () => const Card(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()))),
            error: (e, _) => Card(
                child: Padding(padding: const EdgeInsets.all(16), child: Text(e.toString()))),
            data: (p) => Card(
              child: Column(
                children: [
                  const ListTile(
                    leading: Icon(Icons.favorite_outline),
                    title: Text('Health profile'),
                  ),
                  if (p.bloodGroup != null)
                    ListTile(dense: true, title: const Text('Blood group'), trailing: Text(p.bloodGroup!)),
                  if (p.heightCm != null)
                    ListTile(dense: true, title: const Text('Height'), trailing: Text('${p.heightCm} cm')),
                  if (p.weightKg != null)
                    ListTile(dense: true, title: const Text('Weight'), trailing: Text('${p.weightKg} kg')),
                  if (p.conditions.isNotEmpty)
                    ListTile(
                        dense: true,
                        title: const Text('Conditions'),
                        trailing: Flexible(child: Text(p.conditions.join(', ')))),
                  if (p.allergies.isNotEmpty)
                    ListTile(
                        dense: true,
                        title: const Text('Allergies'),
                        trailing: Flexible(child: Text(p.allergies.join(', ')))),
                  ListTile(
                    dense: true,
                    title: Text('Edit health details',
                        style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => _EditProfileSheet(initial: p),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: Icon(Icons.logout, color: Theme.of(context).colorScheme.error),
              title: const Text('Log out'),
              onTap: () => ref.read(authProvider.notifier).logout(),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'mydoc.ai is not a substitute for professional medical advice, diagnosis or treatment.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _EditProfileSheet extends ConsumerStatefulWidget {
  const _EditProfileSheet({required this.initial});

  final dynamic initial;

  @override
  ConsumerState<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<_EditProfileSheet> {
  late final TextEditingController _height;
  late final TextEditingController _weight;
  late final TextEditingController _conditions;
  late final TextEditingController _allergies;
  String? _bloodGroup;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _height = TextEditingController(text: widget.initial.heightCm?.toString() ?? '');
    _weight = TextEditingController(text: widget.initial.weightKg?.toString() ?? '');
    _conditions = TextEditingController(text: (widget.initial.conditions as List).join(', '));
    _allergies = TextEditingController(text: (widget.initial.allergies as List).join(', '));
    _bloodGroup = widget.initial.bloodGroup;
  }

  @override
  void dispose() {
    _height.dispose();
    _weight.dispose();
    _conditions.dispose();
    _allergies.dispose();
    super.dispose();
  }

  List<String> _splitList(String raw) => raw
      .split(',')
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(apiClientProvider).updateProfile({
        if (_bloodGroup != null) 'blood_group': _bloodGroup,
        if (_height.text.isNotEmpty) 'height_cm': double.tryParse(_height.text),
        if (_weight.text.isNotEmpty) 'weight_kg': double.tryParse(_weight.text),
        'medical_conditions': _splitList(_conditions.text),
        'allergies': _splitList(_allergies.text),
      });
      ref.invalidate(profileProvider);
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
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
          Text('Health details', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: groups.contains(_bloodGroup) ? _bloodGroup : null,
            decoration: const InputDecoration(labelText: 'Blood group'),
            items: groups
                .map((g) => DropdownMenuItem(value: g, child: Text(g)))
                .toList(),
            onChanged: (v) => setState(() => _bloodGroup = v),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _height,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Height (cm)'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _weight,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Weight (kg)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _conditions,
            decoration: const InputDecoration(
                labelText: 'Conditions (comma separated)',
                hintText: 'diabetes, hypertension'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _allergies,
            decoration: const InputDecoration(
                labelText: 'Allergies (comma separated)', hintText: 'penicillin'),
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
