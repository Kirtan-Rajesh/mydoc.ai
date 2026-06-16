import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getMe, getToken } from '../lib/api';
import { useAppStore } from '../lib/store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { auth, setUser, setToken, setAuthLoading } = useAppStore();

  // Bootstrap auth on first mount
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setAuthLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setAuthLoading(false);
          }
          return;
        }
        setToken(token);
        const user = await getMe();
        if (!cancelled) {
          setUser(user);
        }
      } catch {
        // Token invalid/expired – stay logged out
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect based on auth state once loading is done
  useEffect(() => {
    if (auth.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (auth.token && auth.user) {
      if (!inTabsGroup) {
        router.replace('/(tabs)/today');
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    }
  }, [auth.isLoading, auth.token, auth.user, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="document/[id]"
            options={{ headerShown: true, title: 'Document', headerBackTitle: 'Back' }}
          />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
