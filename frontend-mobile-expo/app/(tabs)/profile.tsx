import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearToken,
  getHealthProfile,
  getMe,
  updateHealthProfile,
  updateMe,
  type HealthProfile,
} from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Button, Card } from '../../components/ui';

const BRAND = '#10B981';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ─── Health Profile Edit Modal ────────────────────────────────────────────────

interface EditHealthModalProps {
  visible: boolean;
  profile: HealthProfile;
  onClose: () => void;
  onSaved: () => void;
}

function EditHealthModal({
  visible,
  profile,
  onClose,
  onSaved,
}: EditHealthModalProps) {
  const qc = useQueryClient();
  const [bloodGroup, setBloodGroup] = useState(profile.blood_group ?? '');
  const [height, setHeight] = useState(profile.height_cm?.toString() ?? '');
  const [weight, setWeight] = useState(profile.weight_kg?.toString() ?? '');
  const [conditions, setConditions] = useState(
    profile.medical_conditions.join(', '),
  );
  const [allergies, setAllergies] = useState(profile.allergies.join(', '));

  const mutation = useMutation({
    mutationFn: () =>
      updateHealthProfile({
        blood_group: bloodGroup || null,
        height_cm: height ? parseFloat(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        medical_conditions: conditions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        allergies: allergies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-profile'] });
      onSaved();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Update failed';
      Alert.alert('Error', message);
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={ehStyles.safe}>
        <View style={ehStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={ehStyles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={ehStyles.title}>Health Profile</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          contentContainerStyle={ehStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Blood Group */}
          <Text style={ehStyles.label}>Blood Group</Text>
          <View style={ehStyles.bloodRow}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[
                  ehStyles.bloodBtn,
                  bloodGroup === bg && ehStyles.bloodBtnActive,
                ]}
                onPress={() => setBloodGroup(bg === bloodGroup ? '' : bg)}
              >
                <Text
                  style={[
                    ehStyles.bloodBtnText,
                    bloodGroup === bg && ehStyles.bloodBtnTextActive,
                  ]}
                >
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={ehStyles.row}>
            <View style={ehStyles.half}>
              <Text style={ehStyles.label}>Height (cm)</Text>
              <TextInput
                style={ehStyles.input}
                placeholder="e.g. 170"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={height}
                onChangeText={setHeight}
              />
            </View>
            <View style={ehStyles.half}>
              <Text style={ehStyles.label}>Weight (kg)</Text>
              <TextInput
                style={ehStyles.input}
                placeholder="e.g. 65"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
          </View>

          <Text style={ehStyles.label}>Medical Conditions</Text>
          <TextInput
            style={[ehStyles.input, ehStyles.multiline]}
            placeholder="e.g. Diabetes, Hypertension (comma-separated)"
            placeholderTextColor="#9CA3AF"
            value={conditions}
            onChangeText={setConditions}
            multiline
          />

          <Text style={ehStyles.label}>Allergies</Text>
          <TextInput
            style={[ehStyles.input, ehStyles.multiline]}
            placeholder="e.g. Penicillin, Pollen (comma-separated)"
            placeholderTextColor="#9CA3AF"
            value={allergies}
            onChangeText={setAllergies}
            multiline
          />

          <Button
            title="Save Health Profile"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            style={ehStyles.saveBtn}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const ehStyles = StyleSheet.create({
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
  content: { padding: 20, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
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
  multiline: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
  bloodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  bloodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  bloodBtnActive: { backgroundColor: '#ECFDF5', borderColor: BRAND },
  bloodBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  bloodBtnTextActive: { color: BRAND },
  saveBtn: { marginTop: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { auth, logout } = useAppStore();
  const qc = useQueryClient();
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['health-profile'],
    queryFn: getHealthProfile,
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => updateMe({ name }),
    onSuccess: (user) => {
      useAppStore.getState().setUser(user);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Update failed';
      Alert.alert('Error', message);
    },
  });

  const updateLangMutation = useMutation({
    mutationFn: (language_pref: string) => updateMe({ language_pref }),
    onSuccess: (user) => {
      useAppStore.getState().setUser(user);
    },
  });

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          logout();
        },
      },
    ]);
  }

  function handleEditName() {
    setNameInput(auth.user?.name ?? '');
    setShowNameModal(true);
  }

  const user = auth.user;
  const initial = user?.name?.[0]?.toUpperCase() ?? '?';
  const currentLang = LANGUAGES.find((l) => l.code === user?.language_pref);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{user?.name ?? 'User'}</Text>
            <Text style={styles.phone}>{user?.phone ?? ''}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={handleEditName}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Language Preference */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Language Preference</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langBtn,
                  user?.language_pref === lang.code && styles.langBtnActive,
                ]}
                onPress={() => updateLangMutation.mutate(lang.code)}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    user?.language_pref === lang.code && styles.langBtnTextActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Health Profile */}
        <Card style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Health Profile</Text>
            <TouchableOpacity onPress={() => setShowHealthModal(true)}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          {profileLoading ? (
            <ActivityIndicator color={BRAND} />
          ) : profile ? (
            <View style={styles.healthGrid}>
              <HealthRow label="Blood Group" value={profile.blood_group ?? '—'} />
              <HealthRow
                label="Height"
                value={profile.height_cm ? `${profile.height_cm} cm` : '—'}
              />
              <HealthRow
                label="Weight"
                value={profile.weight_kg ? `${profile.weight_kg} kg` : '—'}
              />
              <HealthRow
                label="BMI"
                value={
                  profile.height_cm && profile.weight_kg
                    ? (
                        profile.weight_kg /
                        Math.pow(profile.height_cm / 100, 2)
                      ).toFixed(1)
                    : '—'
                }
              />
              {profile.medical_conditions.length > 0 && (
                <View style={styles.healthConditions}>
                  <Text style={styles.healthConditionsLabel}>
                    Medical Conditions
                  </Text>
                  <View style={styles.chips}>
                    {profile.medical_conditions.map((c) => (
                      <View key={c} style={styles.conditionChip}>
                        <Text style={styles.conditionChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {profile.allergies.length > 0 && (
                <View style={styles.healthConditions}>
                  <Text style={styles.healthConditionsLabel}>Allergies</Text>
                  <View style={styles.chips}>
                    {profile.allergies.map((a) => (
                      <View
                        key={a}
                        style={[styles.conditionChip, styles.allergyChip]}
                      >
                        <Text
                          style={[
                            styles.conditionChipText,
                            styles.allergyChipText,
                          ]}
                        >
                          {a}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noProfile}>
              No health details added yet. Tap Edit to add your information.
            </Text>
          )}
        </Card>

        {/* App Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>mydoc.ai</Text>
          </View>
        </Card>

        {/* Logout */}
        <Button
          title="Logout"
          variant="danger"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {profile && (
        <EditHealthModal
          visible={showHealthModal}
          profile={profile}
          onClose={() => setShowHealthModal(false)}
          onSaved={() => setShowHealthModal(false)}
        />
      )}

      {/* Edit name modal */}
      <Modal visible={showNameModal} animationType="fade" transparent>
        <View style={styles.nameModalOverlay}>
          <View style={styles.nameModalBox}>
            <Text style={styles.nameModalTitle}>Edit Name</Text>
            <TextInput
              style={styles.nameModalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <View style={styles.nameModalActions}>
              <TouchableOpacity
                style={styles.nameModalCancel}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={styles.nameModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nameModalSave}
                onPress={() => {
                  if (nameInput.trim()) updateNameMutation.mutate(nameInput.trim());
                  setShowNameModal(false);
                }}
              >
                <Text style={styles.nameModalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={hrStyles.row}>
      <Text style={hrStyles.label}>{label}</Text>
      <Text style={hrStyles.value}>{value}</Text>
    </View>
  );
}

const hrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: { fontSize: 14, color: '#6B7280' },
  value: { fontSize: 14, fontWeight: '600', color: '#111827' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', color: '#111827' },
  phone: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  editBtnText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  section: { gap: 12 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  editLink: { color: BRAND, fontWeight: '600', fontSize: 14 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  langBtnActive: { backgroundColor: '#ECFDF5', borderColor: BRAND },
  langBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  langBtnTextActive: { color: BRAND, fontWeight: '700' },
  healthGrid: { gap: 0 },
  healthConditions: { marginTop: 8, gap: 6 },
  healthConditionsLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  conditionChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  conditionChipText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  allergyChip: { backgroundColor: '#FEE2E2' },
  allergyChipText: { color: '#991B1B' },
  noProfile: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  logoutBtn: { marginTop: 8 },
  nameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  nameModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    gap: 16,
  },
  nameModalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  nameModalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  nameModalActions: { flexDirection: 'row', gap: 12 },
  nameModalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  nameModalCancelText: { color: '#6B7280', fontWeight: '600' },
  nameModalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: 'center',
  },
  nameModalSaveText: { color: '#FFFFFF', fontWeight: '700' },
});
