import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDocuments, streamChat, type DocumentModel } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { LoadingDots } from '../../components/ui';

const BRAND = '#10B981';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const SUGGESTIONS = [
  'What do my recent lab results mean?',
  'Explain my cholesterol levels',
  'Am I taking my medications correctly?',
  'What should I eat based on my health profile?',
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>✨</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          msg.isStreaming && styles.bubbleStreaming,
        ]}
      >
        {msg.isStreaming && msg.content === '' ? (
          <LoadingDots />
        ) : (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {msg.content}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { chatIntent, setChatIntent } = useAppStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>();
  const [showDocPicker, setShowDocPicker] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const { data: docs } = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
  });

  // Handle chatIntent from other screens
  useEffect(() => {
    if (!chatIntent) return;
    if (chatIntent.documentId) {
      setSelectedDocId(chatIntent.documentId);
    }
    if (chatIntent.prefill) {
      setInput(chatIntent.prefill);
    }
    setChatIntent(null);
  }, [chatIntent, setChatIntent]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    setInput('');
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    scrollToBottom();

    try {
      const stream = await streamChat(text, conversationId, selectedDocId);
      const reader = stream.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const parsed = JSON.parse(raw);
              // Support both {text} and {delta} and {content} shapes
              const chunk: string =
                parsed.text ??
                parsed.delta ??
                parsed.content ??
                parsed.choices?.[0]?.delta?.content ??
                '';
              if (parsed.conversation_id && !conversationId) {
                setConversationId(parsed.conversation_id);
              }
              if (chunk) {
                fullText += chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: fullText, isStreaming: true }
                      : m,
                  ),
                );
                scrollToBottom();
              }
            } catch {
              // Not JSON — treat raw line as plain text chunk
              if (raw && raw !== '[DONE]') {
                fullText += raw;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: fullText, isStreaming: true }
                      : m,
                  ),
                );
              }
            }
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, isStreaming: false } : m,
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: `Error: ${message}`, isStreaming: false }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      readerRef.current = null;
      scrollToBottom();
    }
  }

  function handleStop() {
    readerRef.current?.cancel();
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  }

  const selectedDoc = docs?.find((d) => d.id === selectedDocId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ask AI</Text>
          <Text style={styles.headerSubtitle}>Powered by mydoc.ai</Text>
        </View>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={() => {
            setMessages([]);
            setConversationId(undefined);
            setSelectedDocId(undefined);
          }}
        >
          <Text style={styles.newChatText}>New chat</Text>
        </TouchableOpacity>
      </View>

      {/* Attached doc indicator */}
      {selectedDoc && (
        <View style={styles.attachedDoc}>
          <Text style={styles.attachedDocText}>
            📎 {selectedDoc.name}
          </Text>
          <TouchableOpacity onPress={() => setSelectedDocId(undefined)}>
            <Text style={styles.attachedDocRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>✨ Ask me anything</Text>
            <Text style={styles.emptySubtitle}>
              About your health records, medications, or general health questions
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(s)}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble msg={item} />}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          />
        )}

        {/* Doc picker modal */}
        {showDocPicker && (
          <View style={styles.docPicker}>
            <View style={styles.docPickerHeader}>
              <Text style={styles.docPickerTitle}>Attach a document</Text>
              <TouchableOpacity onPress={() => setShowDocPicker(false)}>
                <Text style={styles.docPickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {!docs || docs.length === 0 ? (
              <Text style={styles.docPickerEmpty}>No documents uploaded yet</Text>
            ) : (
              docs.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.docPickerItem}
                  onPress={() => {
                    setSelectedDocId(doc.id);
                    setShowDocPicker(false);
                  }}
                >
                  <Text style={styles.docPickerItemText}>{doc.name}</Text>
                  {doc.id === selectedDocId && (
                    <Text style={styles.docPickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setShowDocPicker((v) => !v)}
          >
            <Text style={styles.attachBtnText}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about your health…"
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          {streaming ? (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>⏹</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim()}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  newChatBtn: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  newChatText: {
    color: BRAND,
    fontSize: 13,
    fontWeight: '600',
  },
  attachedDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  attachedDocText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '500',
    flex: 1,
  },
  attachedDocRemove: {
    color: '#6B7280',
    fontSize: 14,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  suggestions: {
    marginTop: 8,
    gap: 10,
    width: '100%',
  },
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  messageList: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  bubbleRowUser: {
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiAvatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: BRAND,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleStreaming: {
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  bubbleText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  docPicker: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    maxHeight: 220,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  docPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  docPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  docPickerClose: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  docPickerEmpty: {
    color: '#9CA3AF',
    fontSize: 14,
    paddingBottom: 12,
  },
  docPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  docPickerItemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  docPickerCheck: {
    color: BRAND,
    fontWeight: '700',
    fontSize: 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  attachBtnText: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  stopBtnText: {
    fontSize: 18,
  },
});
