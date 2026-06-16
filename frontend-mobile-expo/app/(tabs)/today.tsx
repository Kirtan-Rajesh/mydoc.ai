import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDocuments, getTodayDoses, logDose, type TodayDose, type DocumentModel } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Card, Chip } from '../../components/ui';

const BRAND = '#10B981';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function DoseCard({ dose }: { dose: TodayDose }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => logDose(dose.medication_id, dose.scheduled_for, 'taken'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['today-doses'] }),
  });

  const taken = dose.status === 'taken';

  return (
    <Card style={[styles.doseCard, taken && styles.doseCardTaken]}>
      <View style={styles.doseRow}>
        <View style={styles.doseInfo}>
          <Text style={[styles.doseName, taken && styles.doseNameTaken]}>
            {dose.medication_name}
          </Text>
          <Text style={styles.doseMeta}>
            {dose.dosage} · {dose.time}
          </Text>
        </View>
        {!taken ? (
          <TouchableOpacity
            style={styles.takeBtn}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.takeBtnText}>Take</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.takenBadge}>
            <Text style={styles.takenBadgeText}>✓ Done</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function DocThumbnail({ doc }: { doc: DocumentModel }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.docThumb}
      onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })}
    >
      <View style={styles.docThumbIcon}>
        <Text style={styles.docThumbEmoji}>
          {doc.document_type === 'lab_report' ? '🧪' : doc.document_type === 'prescription' ? '📋' : '📄'}
        </Text>
      </View>
      <Text style={styles.docThumbName} numberOfLines={2}>
        {doc.file_name}
      </Text>
      {doc.status === 'processing' && (
        <Chip label="Processing" color="#FEF3C7" textColor="#92400E" />
      )}
      {doc.status === 'ready' && (
        <Chip label="Ready" color="#D1FAE5" textColor="#065F46" />
      )}
    </TouchableOpacity>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { auth, setChatIntent, setNavIndex } = useAppStore();
  const qc = useQueryClient();

  const {
    data: doses,
    isLoading: dosesLoading,
    refetch: refetchDoses,
  } = useQuery({
    queryKey: ['today-doses'],
    queryFn: getTodayDoses,
  });

  const {
    data: docs,
    isLoading: docsLoading,
    refetch: refetchDocs,
  } = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchDoses(), refetchDocs()]);
    setRefreshing(false);
  }

  const recentDocs = (docs ?? []).slice(0, 8);
  const userName = auth.user?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
            colors={[BRAND]}
          />
        }
      >
        {/* Gradient Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{userName} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => {
              setChatIntent({ prefill: '' });
              setNavIndex(2);
              router.push('/(tabs)/chat');
            }}
          >
            <Text style={styles.searchPlaceholder}>✨ Ask AI anything…</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/records')}
            >
              <Text style={styles.quickActionEmoji}>📷</Text>
              <Text style={styles.quickActionLabel}>Scan Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/medications')}
            >
              <Text style={styles.quickActionEmoji}>💊</Text>
              <Text style={styles.quickActionLabel}>My Medicines</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/records')}
            >
              <Text style={styles.quickActionEmoji}>📁</Text>
              <Text style={styles.quickActionLabel}>My Records</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.quickActionEmoji}>👤</Text>
              <Text style={styles.quickActionLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Medications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Medications</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/medications')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {dosesLoading ? (
            <ActivityIndicator color={BRAND} style={styles.loader} />
          ) : !doses || doses.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💊</Text>
              <Text style={styles.emptyText}>No medications scheduled for today</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/medications')}>
                <Text style={styles.emptyLink}>Add medications →</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            doses.map((dose) => (
              <DoseCard key={`${dose.medication_id}-${dose.scheduled_for}`} dose={dose} />
            ))
          )}
        </View>

        {/* Recent Reports */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/records')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {docsLoading ? (
            <ActivityIndicator color={BRAND} style={styles.loader} />
          ) : recentDocs.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📄</Text>
              <Text style={styles.emptyText}>No reports uploaded yet</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/records')}>
                <Text style={styles.emptyLink}>Upload a report →</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.docsScroll}
            >
              {recentDocs.map((doc) => (
                <DocThumbnail key={doc.id} doc={doc} />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16,
  },
  greeting: {
    fontSize: 15,
    color: '#D1FAE5',
    fontWeight: '500',
  },
  userName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchPlaceholder: {
    color: '#ECFDF5',
    fontSize: 14,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: BRAND,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  loader: {
    marginVertical: 20,
  },
  doseCard: {
    marginBottom: 10,
  },
  doseCardTaken: {
    opacity: 0.6,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doseInfo: {
    flex: 1,
    gap: 3,
  },
  doseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  doseNameTaken: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  doseMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  doseInstructions: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  takeBtn: {
    backgroundColor: BRAND,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  takeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  takenBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  takenBadgeText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyLink: {
    color: BRAND,
    fontWeight: '600',
    fontSize: 14,
  },
  docsScroll: {
    paddingRight: 16,
    gap: 12,
  },
  docThumb: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  docThumbIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docThumbEmoji: {
    fontSize: 22,
  },
  docThumbName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 16,
  },
});
