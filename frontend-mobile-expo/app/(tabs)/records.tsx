import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDocuments, uploadDocument, type DocumentModel } from '../../lib/api';
import { Card, Chip, EmptyState } from '../../components/ui';

const BRAND = '#10B981';

function statusChip(status: DocumentModel['status']) {
  switch (status) {
    case 'processing':
      return <Chip label="⏳ Processing" color="#FEF3C7" textColor="#92400E" />;
    case 'ready':
      return <Chip label="✓ Ready" color="#D1FAE5" textColor="#065F46" />;
    case 'uploaded':
      return <Chip label="⏫ Uploaded" color="#EDE9FE" textColor="#5B21B6" />;
    case 'failed':
      return <Chip label="⚠ Failed" color="#FEE2E2" textColor="#991B1B" />;
  }
}

function typeLabel(doc_type: string | null): string {
  switch (doc_type) {
    case 'lab_report':
      return '🧪 Lab Report';
    case 'prescription':
      return '📋 Prescription';
    case 'imaging':
      return '🩻 Imaging';
    case 'discharge_summary':
      return '🏥 Discharge';
    default:
      return '📄 Document';
  }
}

function DocCard({ doc }: { doc: DocumentModel }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() =>
        router.push({ pathname: '/document/[id]', params: { id: doc.id } })
      }
    >
      <Card style={styles.docCard}>
        <View style={styles.docRow}>
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
          <View style={styles.docMeta}>
            <Text style={styles.docName} numberOfLines={2}>
              {doc.file_name}
            </Text>
            <Text style={styles.docType}>{typeLabel(doc.document_type)}</Text>
            {doc.lab_name ? (
              <Text style={styles.docLab}>{doc.lab_name}</Text>
            ) : null}
            {doc.report_date ? (
              <Text style={styles.docDate}>
                {new Date(doc.report_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            ) : null}
          </View>
          <View style={styles.docStatus}>{statusChip(doc.status)}</View>
        </View>
        {doc.summary ? (
          <Text style={styles.docSummary} numberOfLines={2}>
            {doc.summary}
          </Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}

export default function RecordsScreen() {
  const qc = useQueryClient();
  const [uploading, setUploading] = React.useState(false);

  const { data: docs, isLoading, error, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
  });

  // Poll while any doc is processing
  const hasProcessing = (docs ?? []).some(
    (d) => d.status === 'processing' || d.status === 'uploaded',
  );
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    }, 4000);
    return () => clearInterval(interval);
  }, [hasProcessing, qc]);

  async function handleUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading(true);
      await uploadDocument(
        asset.uri,
        asset.name,
        asset.mimeType ?? 'application/octet-stream',
      );
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload Error', message);
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Records</Text>
        </View>
        <ActivityIndicator style={styles.loader} color={BRAND} size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Records</Text>
        </View>
        <EmptyState
          icon="⚠️"
          title="Failed to load records"
          description={(error as Error).message}
          ctaLabel="Retry"
          onCta={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Records</Text>
        <Text style={styles.headerCount}>
          {docs?.length ?? 0} document{docs?.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {!docs || docs.length === 0 ? (
        <EmptyState
          icon="📂"
          title="No health records yet"
          description="Upload your lab reports, prescriptions, or any health document and AI will analyse them for you."
          ctaLabel="Upload Document"
          onCta={handleUpload}
        />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DocCard doc={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.fabIcon}>+</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  headerCount: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  loader: {
    marginTop: 60,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  docCard: {
    gap: 10,
  },
  docRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  docIconWrap: {
    width: 48,
    height: 48,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIcon: {
    fontSize: 24,
  },
  docMeta: {
    flex: 1,
    gap: 3,
  },
  docName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
  },
  docType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  docLab: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  docDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  docStatus: {
    alignItems: 'flex-end',
  },
  docSummary: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabDisabled: {
    opacity: 0.6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
