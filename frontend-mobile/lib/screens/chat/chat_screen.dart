import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api.dart';
import '../../models.dart';
import '../../providers.dart';

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
  bool _sending = false;

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

  Future<void> _send() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _sending) return;
    _inputController.clear();

    final assistantMsg = ChatMessage(role: 'assistant', content: '', streaming: true);
    setState(() {
      _messages.add(ChatMessage(role: 'user', content: text));
      _messages.add(assistantMsg);
      _sending = true;
    });
    _scrollToBottom();

    try {
      final stream = ref
          .read(apiClientProvider)
          .sendMessage(text, conversationId: _conversationId);
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
      if (mounted) {
        setState(() {
          assistantMsg.content = e.message;
          assistantMsg.streaming = false;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          assistantMsg.streaming = false;
          _sending = false;
        });
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

  void _newChat() {
    setState(() {
      _conversationId = null;
      _messages.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ask MyDoc AI'),
        actions: [
          IconButton(icon: const Icon(Icons.history), onPressed: _openHistory),
          IconButton(icon: const Icon(Icons.add_comment_outlined), onPressed: _newChat),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? const _EmptyChat()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) => _Bubble(message: _messages[i]),
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Ask about your reports, symptoms, medicines…',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: const Icon(Icons.arrow_upward),
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
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        decoration: BoxDecoration(
          color: isUser ? scheme.primary : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: message.streaming && message.content.isEmpty
            ? const SizedBox(
                height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
            : Text(
                message.content,
                style: TextStyle(color: isUser ? scheme.onPrimary : scheme.onSurface),
              ),
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.health_and_safety_outlined,
                size: 64, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            const Text(
              'Ask anything about your health records.\n\n“Explain my latest blood report”\n“Is my vitamin D low?”\n“What is this medicine for?”',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(
              'MyDoc AI gives information, not medical advice. Always consult a doctor for decisions.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
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
