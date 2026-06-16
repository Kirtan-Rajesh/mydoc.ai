import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createMedication,
  deleteMedication,
  getMedications,
  type Medication,
} from '../../lib/api';
import { Button, Card, Chip, EmptyState } from '../../components/ui';

const BRAND = '#10B981';

// ─── Notification helpers ─────────────────────────────────────────────────────

async function scheduleMedNotifications(med: Medication) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  for (const timeStr of med.times) {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr ?? '0', 10);
    if (isNaN(hour) || isNaN(minute)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${med.name}`,
        body: `${med.dosage}${med.instructions ? ' · ' + med.instructions : ''}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
}

// ─── Time tag editor ──────────────────────────────────────────────────────────

const PRESET_TIMES = [
  '06:00', '07:00', '08:00', '09:00', '12:00',
  '14:00', '18:00', '20:00', '21:00', '22:00',
];

function TimeEditor({
  times,
  onChange,
}: {
  times: string[];
  onChange: (t: string[]) => void;
}) {
  const [customTime, setCustomTime] = useState('');

  function toggle(t: string) {
    if (times.includes(t)) {
      onChange(times.filter((x) => x !== t));
    } else {
      onChange([...times, t].sort());
    }
  }

  function addCustom() {
    const match = customTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      Alert.alert('Invalid time', 'Use HH:MM format, e.g. 13:30');
      return;
    }
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h > 23 || m > 59) {
      Alert.alert('Invalid time', 'Hours 0-23, minutes 0-59');
      return;
    }
    const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!times.includes(t)) onChange([...times, t].sort());
    setCustomTime('');
  }

  return (
    <View style={teStyles.container}>
      <Text style={teStyles.label}>Times</Text>
      <View style={teStyles.presets}>
        {PRESET_TIMES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[teStyles.preset, times.includes(t) && teStyles.presetActive]}
            onPress={() => toggle(t)}
          >
            <Text
              style={[
                teStyles.presetText,
                times.includes(t) && teStyles.presetTextActive,
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={teStyles.customRow}>
        <TextInput
          style={teStyles.customInput}
          placeholder="HH:MM"
          placeholderTextColor="#9CA3AF"
          value={customTime}
          onChangeText={setCustomTime}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          returnKeyType="done"
          onSubmitEditing={addCustom}
        />
        <TouchableOpacity style={teStyles.addBtn} onPress={addCustom}>
          <Text style={teStyles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      {times.length > 0 && (
        <View style={teStyles.selected}>
          {times.map((t) => (
            <TouchableOpacity key={t} onPress={() => toggle(t)}>
              <Chip label={`${t} ✕`} color={BRAND} textColor="#FFFFFF" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const teStyles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  presetActive: { backgroundColor: '#ECFDF5', borderColor: BRAND },
  presetText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  presetTextActive: { color: BRAND, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: 8 },
  customInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
  },
  addBtn: {
    backgroundColor: BRAND,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  selected: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ─── Add Medication Modal ─────────────────────────────────────────────────────

interface AddMedModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function AddMedModal({ visible, onClose, onAdded }: AddMedModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [times, setTimes] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      createMedication({ name: name.trim(), dosage: dosage.trim(), instructions: instructions.trim(), times }),
    onSuccess: async (med) => {
      await scheduleMedNotifications(med);
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['today-doses'] });
      onAdded();
      // Reset
      setName('');
      setDosage('');
      setInstructions('');
      setTimes([]);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to add medication';
      Alert.alert('Error', message);
    },
  });

  const canSubmit = name.trim() && dosage.trim() && times.length > 0 && !mutation.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modalStyles.safe}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={modalStyles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modalStyles.title}>Add Medication</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          contentContainerStyle={modalStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={modalStyles.fieldLabel}>Medication Name *</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Metformin"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />

          <Text style={modalStyles.fieldLabel}>Dosage *</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. 500 mg"
            placeholderTextColor="#9CA3AF"
            value={dosage}
            onChangeText={setDosage}
          />

          <Text style={modalStyles.fieldLabel}>Instructions</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. After meals"
            placeholderTextColor="#9CA3AF"
            value={instructions}
            onChangeText={setInstructions}
          />

          <TimeEditor times={times} onChange={setTimes} />

          <Button
            title="Add Medication"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
            style={modalStyles.saveBtn}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cancel: { color: '#6B7280', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 20, gap: 14 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  saveBtn: { marginTop: 8 },
});

// ─── Med Card ─────────────────────────────────────────────────────────────────

function MedCard({
  med,
  onDelete,
}: {
  med: Medication;
  onDelete: (id: string) => void;
}) {
  function confirmDelete() {
    Alert.alert(
      'Delete Medication',
      `Remove ${med.name} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(med.id) },
      ],
    );
  }

  return (
    <Card style={mcStyles.card}>
      <View style={mcStyles.row}>
        <View style={mcStyles.iconWrap}>
          <Text style={mcStyles.icon}>💊</Text>
        </View>
        <View style={mcStyles.info}>
          <Text style={mcStyles.name}>{med.name}</Text>
          <Text style={mcStyles.dosage}>{med.dosage}</Text>
          {med.instructions ? (
            <Text style={mcStyles.instructions}>{med.instructions}</Text>
          ) : null}
          <View style={mcStyles.times}>
            {med.times.map((t) => (
              <Chip key={t} label={t} color="#F0FDF4" textColor={BRAND} />
            ))}
          </View>
        </View>
        <TouchableOpacity onPress={confirmDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={mcStyles.deleteBtn}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const mcStyles = StyleSheet.create({
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dosage: { fontSize: 14, color: '#6B7280' },
  instructions: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  deleteBtn: { fontSize: 20, padding: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: meds, isLoading, error, refetch } = useQuery({
    queryKey: ['medications'],
    queryFn: getMedications,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMedication,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['today-doses'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Delete failed';
      Alert.alert('Error', message);
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Medications</Text>
        </View>
        <ActivityIndicator color={BRAND} style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Medications</Text>
        </View>
        <EmptyState
          icon="⚠️"
          title="Failed to load medications"
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
        <Text style={styles.headerTitle}>Medications</Text>
        <Text style={styles.headerCount}>
          {meds?.length ?? 0} med{meds?.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {!meds || meds.length === 0 ? (
        <EmptyState
          icon="💊"
          title="No medications added"
          description="Add your daily medications and mydoc.ai will send you reminders and track your doses."
          ctaLabel="Add Medication"
          onCta={() => setShowModal(true)}
        />
      ) : (
        <FlatList
          data={meds}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MedCard
              med={item}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <AddMedModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdded={() => setShowModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
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
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerCount: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  loader: { marginTop: 60 },
  list: { padding: 16, paddingBottom: 100 },
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
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
