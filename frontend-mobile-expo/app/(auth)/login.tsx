import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestOtp } from '../../lib/api';
import { Button } from '../../components/ui';

const BRAND = '#10B981';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = /^\d{10}$/.test(phone.trim());

  async function handleSendOtp() {
    if (!isValid) return;
    setLoading(true);
    try {
      const fullPhone = `+91${phone.trim()}`;
      const res = await requestOtp(fullPhone);
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: fullPhone, dev_otp: res.dev_otp ?? '' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🩺 mydoc.ai</Text>
        <Text style={styles.tagline}>Your personal health assistant</Text>
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
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>
              Enter your mobile number to continue
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>

            <Button
              title="Send OTP"
              onPress={handleSendOtp}
              loading={loading}
              disabled={!isValid}
              style={styles.btn}
            />

            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#D1FAE5',
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
  },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  prefix: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1.5,
    borderRightColor: '#E5E7EB',
  },
  prefixText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  btn: {
    marginTop: 8,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
