import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#F9FAFB' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
