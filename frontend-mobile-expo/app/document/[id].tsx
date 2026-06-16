import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteDocument, getDocument } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Button, Card, Chip } from '../../components/ui';

const BRAND = '#10B981';

function docTypeLabel(t: string | null) {
  switch (t) {
    case 'lab_report':
      return '🧪 Lab Report';
    case 'prescription':
      return '📋 Prescription';
    case 'imaging':
      return '🩻 Imaging';
    case 'discharge_summary':
      return '🏥 Discharge Summary';
    default:
      return '📄 Document';
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'ready':
      return { bg: '#D1FAE5', text: '#065F46' };
    case 'processing':
      return { bg: '#FEF3C7', text: '#92400E' };
    case 'failed':
      return { bg: '#FEE2E2', text: '#991B1B' };
    case 'uploaded':
      return { bg: '#EDE9FE', text: '#5B21B6' };
    default:
      return { bg: '#F3F4F6', text: '#374151' };
  }
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { setChatIntent, setNavIndex } = useAppStore();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'processing' || data?.status === 'uploaded' ? 4000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Delete failed';
      Alert.alert('Error', message);
    },
  });

  function handleDelete() {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to permanently delete "${doc?.file_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  }

  function handleAskAI() {
    if (!doc) return;
    setChatIntent({
      documentId: doc.id,
      prefill: `Tell me about this document: ${doc.file_name}`,
    });
    setNavIndex(2);
    router.push('/(tabs)/chat');
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator style={styles.loader} color={BRAND} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !doc) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Document not found</Text>
          <Text style={styles.errorMsg}>
            {error ? (error as Error).message : 'This document may have been deleted.'}
          </Text>
          <Button title="Go Back" onPress={() => router.back()} style={styles.goBackBtn} />
        </View>
      </SafeAreaView>
    );
  }

  const sc = statusColor(doc.status);
  const structuredEntries = doc.structured_data
    ? Object.entries(doc.structured_data)
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Document header card */}
        <Card style={styles.headerCard}>
          <View style={styles.docIconWrap}>
            <Text style={styles.docIcon}>
              {doc.document_type === 'lab_report'
                ? '🧪'
                : doc.document_type === 'prescription'
                  ? '📋'
                  : doc.document_type === 'imaging'
                    ? '🩻'
                    : '📄'}
            </Text>
          </View>
          <Text style={styles.docName}>{doc.file_name}</Text>
          <View style={styles.headerMeta}>
            <Chip
              label={docTypeLabel(doc.document_type)}
              color="#F0FDF4"
              textColor={BRAND}
            />
            <Chip
              label={doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
              color={sc.bg}
              textColor={sc.text}
            />
          </View>

          {doc.status === 'processing' && (
            <View style={styles.processingBanner}>
              <ActivityIndicator size="small" color="#92400E" />
              <Text style={styles.processingText}>
                AI is analysing this document…
              </Text>
            </View>
          )}
        </Card>

        {/* Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Document Details</Text>
          {doc.lab_name && (
            <DetailRow label="Lab / Hospital" value={doc.lab_name} />
          )}
          {doc.report_date && (
            <DetailRow
              label="Report Date"
              value={new Date(doc.report_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            />
          )}
          <DetailRow
            label="Uploaded"
            value={new Date(doc.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          />
        </Card>

        {/* Summary */}
        {doc.summary && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>AI Summary</Text>
            <Text style={styles.summaryText}>{doc.summary}</Text>
          </Card>
        )}

        {/* Structured Data */}
        {structuredEntries.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Report Values</Text>
            {structuredEntries.map(([key, value]) => (
              <DetailRow key={key} label={key} value={value} />
            ))}
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="✨ Ask AI about this"
            onPress={handleAskAI}
            style={styles.askAiBtn}
          />
          <Button
            title="Delete Document"
            variant="danger"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
            style={styles.deleteBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={drStyles.row}>
      <Text style={drStyles.label}>{label}</Text>
      <Text style={drStyles.value}>{value}</Text>
    </View>
  );
}

const drStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  label: { fontSize: 14, color: '#6B7280', flex: 1 },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { marginTop: 80 },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorEmoji: { fontSize: 48 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  errorMsg: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  goBackBtn: { marginTop: 8 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  headerCard: { alignItems: 'center', gap: 12 },
  docIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIcon: { fontSize: 36 },
  docName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  processingText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  section: { gap: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  actions: { gap: 12 },
  askAiBtn: {},
  deleteBtn: {},
});
