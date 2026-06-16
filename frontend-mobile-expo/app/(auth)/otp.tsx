import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setToken, verifyOtp } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Button } from '../../components/ui';
import { getMe } from '../../lib/api';

const BRAND = '#10B981';
const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; dev_otp: string }>();
  const { phone, dev_otp } = params;

  const { setUser, setToken: storeSetToken } = useAppStore();

  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isComplete = otp.length === OTP_LENGTH;

  async function handleVerify() {
    if (!isComplete) return;
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp, name.trim() || undefined);
      const token = res.access_token;

      // Persist token
      await setToken(token);
      storeSetToken(token);

      // Fetch user
      const user = await getMe();
      setUser(user);

      router.replace('/(tabs)/today');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid OTP';
      Alert.alert('Verification Failed', message);
    } finally {
      setLoading(false);
    }
  }

  // Render digit boxes from the hidden input value
  const digits = otp.split('');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>🩺 mydoc.ai</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter OTP</Text>
            <Text style={styles.cardSubtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.phoneHighlight}>{phone}</Text>
            </Text>

            {/* Hidden real input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
              autoFocus
            />

            {/* Visual digit boxes */}
            <TouchableOpacity
              style={styles.digitRow}
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
            >
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    otp.length === i && styles.digitBoxActive,
                    otp.length > i && styles.digitBoxFilled,
                  ]}
                >
                  <Text style={styles.digitText}>{digits[i] ?? ''}</Text>
                </View>
              ))}
            </TouchableOpacity>

            {/* Dev hint */}
            {!!dev_otp && (
              <View style={styles.devHint}>
                <Text style={styles.devHintText}>
                  Dev OTP: <Text style={styles.devHintCode}>{dev_otp}</Text>
                </Text>
              </View>
            )}

            {/* Optional name */}
            <Text style={styles.nameLabel}>
              Your name{' '}
              <Text style={styles.optional}>(optional — for first-time setup)</Text>
            </Text>
            <TextInput
              style={styles.nameInput}
              placeholder="e.g. Priya Sharma"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />

            <Button
              title="Verify & Continue"
              onPress={handleVerify}
              loading={loading}
              disabled={!isComplete}
              style={styles.btn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BRAND,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 24,
  },
  backText: {
    color: '#D1FAE5',
    fontSize: 15,
    fontWeight: '600',
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  phoneHighlight: {
    color: BRAND,
    fontWeight: '600',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  digitBox: {
    flex: 1,
    aspectRatio: 0.9,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  digitBoxActive: {
    borderColor: BRAND,
    backgroundColor: '#F0FDF4',
  },
  digitBoxFilled: {
    borderColor: BRAND,
    backgroundColor: '#ECFDF5',
  },
  digitText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  devHint: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  devHintText: {
    fontSize: 13,
    color: '#92400E',
  },
  devHintCode: {
    fontWeight: '700',
    letterSpacing: 2,
  },
  nameLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  optional: {
    fontWeight: '400',
    color: '#9CA3AF',
  },
  nameInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  btn: {
    marginTop: 4,
  },
});
