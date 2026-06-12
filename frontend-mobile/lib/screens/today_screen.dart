import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../providers.dart';
import '../services/upload.dart';
import '../theme.dart';
import 'documents/document_detail_screen.dart';
import 'home_shell.dart';

/// AI-first home: greeting, ask-bar, today's doses, recent reports.
class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final doses = ref.watch(todayDosesProvider);
    final docs = ref.watch(documentsProvider);
    final firstName = (auth.user?.name ?? '').trim().split(' ').first;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(todayDosesProvider);
          ref.invalidate(documentsProvider);
        },
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _Header(
                greeting: firstName.isEmpty ? _greeting : '$_greeting, $firstName',
                onScan: () => _scan(context, ref),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _SectionTitle(
                    title: "Today's medicines",
                    action: doses.maybeWhen(
                      data: (d) => d.isEmpty ? null : null,
                      orElse: () => null,
                    ),
                  ),
                  const SizedBox(height: 10),
                  doses.when(
                    loading: () => const _LoadingCard(),
                    error: (e, _) => _InfoCard(
                        icon: Icons.error_outline, text: 'Could not load doses: $e'),
                    data: (list) => list.isEmpty
                        ? const _InfoCard(
                            icon: Icons.medication_outlined,
                            text: 'No medicines scheduled. Add them in the Meds tab '
                                'and I will remind you every day.',
                          )
                        : Column(
                            children:
                                list.map((d) => _DoseTile(dose: d)).toList(),
                          ),
                  ),
                  const SizedBox(height: 28),
                  const _SectionTitle(title: 'Recent reports'),
                  const SizedBox(height: 10),
                  docs.when(
                    loading: () => const _LoadingCard(),
                    error: (e, _) =>
                        _InfoCard(icon: Icons.error_outline, text: e.toString()),
                    data: (list) => list.isEmpty
                        ? _ScanCta(onScan: () => _scan(context, ref))
                        : SizedBox(
                            height: 150,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: list.length.clamp(0, 8),
                              separatorBuilder: (_, __) => const SizedBox(width: 12),
                              itemBuilder: (context, i) =>
                                  _ReportCard(doc: list[i]),
                            ),
                          ),
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _scan(BuildContext context, WidgetRef ref) async {
    try {
      final doc = await pickAndUploadDocument(context, ref);
      if (doc != null) {
        openChat(ref,
            documentId: doc.id,
            prefill: 'I just scanned this report — what does it say?');
      }
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.greeting, required this.onScan});

  final String greeting;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        gradient: Brand.heroGradient,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 24, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  greeting,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.6,
                  ),
                ),
              ),
              const Icon(Icons.health_and_safety, color: Colors.white70, size: 30),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Your personal doctor is here.',
            style: TextStyle(color: Colors.white70, fontSize: 14.5),
          ),
          const SizedBox(height: 20),
          // Ask bar -> chat tab
          GestureDetector(
            onTap: () => openChat(ref),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: softShadow(context),
              ),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, color: Theme.of(context).colorScheme.primary, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Ask anything about your health…',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 15),
                    ),
                  ),
                  const Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.grey),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _HeaderAction(
                  icon: Icons.document_scanner_outlined,
                  label: 'Scan report',
                  onTap: onScan,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeaderAction(
                  icon: Icons.medication_outlined,
                  label: 'My medicines',
                  onTap: () => ref.read(navIndexProvider.notifier).state = 3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeaderAction extends StatelessWidget {
  const _HeaderAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.16),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 19),
              const SizedBox(width: 8),
              Text(label,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if (action != null) action!,
      ],
    );
  }
}

class _DoseTile extends ConsumerWidget {
  const _DoseTile({required this.dose});

  final TodayDose dose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final taken = dose.status == 'taken';
    final scheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: softShadow(context),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        leading: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: (taken ? scheme.primary : scheme.tertiary).withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          alignment: Alignment.center,
          child: Text(dose.time,
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 12.5,
                  color: taken ? scheme.primary : Brand.ink)),
        ),
        title: Text(dose.medicationName,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              decoration: taken ? TextDecoration.lineThrough : null,
              color: taken ? Colors.grey : Brand.ink,
            )),
        subtitle: dose.dosage.isEmpty ? null : Text(dose.dosage),
        trailing: taken
            ? Icon(Icons.check_circle, color: scheme.primary)
            : FilledButton.tonal(
                style: FilledButton.styleFrom(
                  minimumSize: const Size(72, 38),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                ),
                onPressed: () async {
                  await ref
                      .read(apiClientProvider)
                      .logDose(dose.medicationId, dose.scheduledFor, 'taken');
                  ref.invalidate(todayDosesProvider);
                },
                child: const Text('Take'),
              ),
      ),
    );
  }
}

class _ReportCard extends ConsumerWidget {
  const _ReportCard({required this.doc});

  final DocumentModel doc;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
      ),
      child: Container(
        width: 210,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: softShadow(context),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.description_outlined, color: scheme.primary, size: 20),
                const Spacer(),
                if (doc.isProcessing)
                  const SizedBox(
                      width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
              ],
            ),
            const SizedBox(height: 10),
            Text(doc.fileName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
            const SizedBox(height: 4),
            Expanded(
              child: Text(
                doc.summary ?? (doc.isProcessing ? 'Analysing…' : 'Tap to view'),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12, height: 1.35),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanCta extends StatelessWidget {
  const _ScanCta({required this.onScan});

  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: softShadow(context),
      ),
      child: Column(
        children: [
          const Text(
            'Photograph your first lab report or prescription — I will read it, '
            'organise it, and explain it to you.',
            textAlign: TextAlign.center,
            style: TextStyle(height: 1.4),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: onScan,
            icon: const Icon(Icons.document_scanner_outlined),
            label: const Text('Scan a report'),
          ),
        ],
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 84,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Center(
          child: SizedBox(
              width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: softShadow(context),
      ),
      child: Row(
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 14),
          Expanded(child: Text(text, style: const TextStyle(height: 1.4))),
        ],
      ),
    );
  }
}
