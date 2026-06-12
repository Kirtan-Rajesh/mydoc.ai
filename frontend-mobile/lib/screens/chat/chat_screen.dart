import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api.dart';
import '../../models.dart';
import '../../providers.dart';
import '../../services/upload.dart';
import '../../theme.dart';

/// The AI doctor conversation. Reports can be scanned/attached inline:
/// upload -> processing -> the AI analyses them in the same thread.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  String? _conversationId;
  bool _busy = false;

  static const _suggestions = [
    'Explain my latest report',
    'What should I eat for low hemoglobin?',
    'What is this medicine for?',
    'Build me a simple daily routine',
  ];

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// Consume a pending cross-tab intent (attached report / prefill).
  void _consumeIntent() {
    final intent = ref.read(chatIntentProvider);
    if (intent == null) return;
    ref.read(chatIntentProvider.notifier).state = null;
    if (intent.documentId != null) {
      _send(intent.prefill ?? 'I attached a report — what does it say?',
          documentId: intent.documentId);
    } else if (intent.prefill != null) {
      _inputController.text = intent.prefill!;
    }
  }

  Future<void> _send(String text, {String? documentId}) async {
    if (text.trim().isEmpty || _busy) return;
    _inputController.clear();

    final assistantMsg = ChatMessage(role: 'assistant', content: '', streaming: true);
    setState(() {
      _messages.add(ChatMessage(role: 'user', content: text.trim()));
      _messages.add(assistantMsg);
      _busy = true;
    });
    _scrollToBottom();

    try {
      // If a report was just attached, wait until extraction completes so the
      // AI actually sees its content.
      if (documentId != null) {
        await ref.read(apiClientProvider).waitUntilProcessed(documentId);
      }
      final stream = ref.read(apiClientProvider).sendMessage(
            text.trim(),
            conversationId: _conversationId,
            documentId: documentId,
          );
      await for (final event in stream) {
        if (!mounted) return;
        switch (event.type) {
          case 'meta':
            _conversationId = event.conversationId;
          case 'token':
            setState(() => assistantMsg.content += event.content ?? '');
            _scrollToBottom();
          case 'done':
            setState(() => assistantMsg.streaming = false);
        }
      }
      ref.invalidate(conversationsProvider);
    } on ApiException catch (e) {
      if (mounted) setState(() => assistantMsg.content = e.message);
    } finally {
      if (mounted) {
        setState(() {
          assistantMsg.streaming = false;
          _busy = false;
        });
      }
    }
  }

  Future<void> _attach() async {
    try {
      final doc = await pickAndUploadDocument(context, ref);
      if (doc == null) return;
      setState(() {
        _messages.add(ChatMessage(role: 'user', content: '📎 Attached: ${doc.fileName}'));
      });
      await _send('I just attached "${doc.fileName}" — please analyse it for me.',
          documentId: doc.id);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _openHistory() async {
    final selected = await showModalBottomSheet<Conversation>(
      context: context,
      builder: (_) => const _HistorySheet(),
    );
    if (selected == null) return;
    final messages = await ref.read(apiClientProvider).getMessages(selected.id);
    if (!mounted) return;
    setState(() {
      _conversationId = selected.id;
      _messages
        ..clear()
        ..addAll(messages);
    });
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(chatIntentProvider, (_, intent) {
      if (intent != null) _consumeIntent();
    });
    // Handle an intent that was set before this tab was ever built.
    WidgetsBinding.instance.addPostFrameCallback((_) => _consumeIntent());

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                gradient: Brand.heroGradient,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 10),
            const Text('MyDoc AI'),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.history), onPressed: _openHistory),
          IconButton(
            icon: const Icon(Icons.add_comment_outlined),
            onPressed: () => setState(() {
              _conversationId = null;
              _messages.clear();
            }),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? _EmptyChat(
                    suggestions: _suggestions,
                    onSuggestion: (s) => _send(s),
                    onScan: _attach,
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) => _Bubble(message: _messages[i]),
                  ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton.filledTonal(
                    onPressed: _busy ? null : _attach,
                    icon: const Icon(Icons.document_scanner_outlined),
                    tooltip: 'Scan or attach a report',
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (v) => _send(v),
                      decoration: const InputDecoration(
                        hintText: 'Ask your doctor…',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _busy ? null : () => _send(_inputController.text),
                    icon: const Icon(Icons.arrow_upward_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    final scheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 30,
              height: 30,
              decoration:
                  const BoxDecoration(gradient: Brand.heroGradient, shape: BoxShape.circle),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 15),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isUser ? scheme.primary : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isUser ? 18 : 6),
                  bottomRight: Radius.circular(isUser ? 6 : 18),
                ),
                boxShadow: isUser ? null : softShadow(context),
              ),
              child: message.streaming && message.content.isEmpty
                  ? const _TypingDots()
                  : SelectableText(
                      message.content,
                      style: TextStyle(
                        color: isUser ? Colors.white : Brand.ink,
                        height: 1.45,
                        fontSize: 14.5,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingDots extends StatefulWidget {
  const _TypingDots();

  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
        ..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final t = ((_c.value * 3) - i).clamp(0.0, 1.0);
            final scale = 0.6 + 0.4 * (1 - (t - 0.5).abs() * 2).clamp(0.0, 1.0);
            return Container(
              width: 7,
              height: 7,
              margin: const EdgeInsets.symmetric(horizontal: 2.5),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.4 + 0.5 * scale),
                shape: BoxShape.circle,
              ),
            );
          }),
        );
      },
    );
  }
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat(
      {required this.suggestions, required this.onSuggestion, required this.onScan});

  final List<String> suggestions;
  final ValueChanged<String> onSuggestion;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 24),
        Container(
          width: 72,
          height: 72,
          decoration:
              const BoxDecoration(gradient: Brand.heroGradient, shape: BoxShape.circle),
          child: const Icon(Icons.auto_awesome, color: Colors.white, size: 32),
        ),
        const SizedBox(height: 18),
        Text('How can I help you today?',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'I know your reports, medicines and health profile.\nAsk me anything — or scan a new report.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey.shade600, height: 1.45),
        ),
        const SizedBox(height: 24),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final s in suggestions)
              ActionChip(label: Text(s), onPressed: () => onSuggestion(s)),
            ActionChip(
              avatar: const Icon(Icons.document_scanner_outlined, size: 17),
              label: const Text('Scan a report'),
              onPressed: onScan,
            ),
          ],
        ),
        const SizedBox(height: 32),
        Text(
          'I give information and guidance, not diagnosis. Always consult your doctor for medical decisions.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _HistorySheet extends ConsumerWidget {
  const _HistorySheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider);
    return SafeArea(
      child: conversations.when(
        loading: () => const Padding(
            padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
        error: (e, _) =>
            Padding(padding: const EdgeInsets.all(24), child: Text(e.toString())),
        data: (list) => list.isEmpty
            ? const Padding(padding: EdgeInsets.all(32), child: Text('No past conversations.'))
            : ListView.builder(
                shrinkWrap: true,
                itemCount: list.length,
                itemBuilder: (context, i) => ListTile(
                  leading: const Icon(Icons.chat_bubble_outline),
                  title: Text(list[i].title, maxLines: 1, overflow: TextOverflow.ellipsis),
                  onTap: () => Navigator.pop(context, list[i]),
                ),
              ),
      ),
    );
  }
}
