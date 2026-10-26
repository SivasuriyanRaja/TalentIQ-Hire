import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TalentIQProvider } from '@/state/TalentIQContext';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useTalentIQ } from '@/state/TalentIQContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function resolveApiBaseUrl(): string {
  const publicDomain = process.env.EXPO_PUBLIC_DOMAIN;

  // 1. If an explicit remote or IP URL is configured (e.g. ngrok, production domain, or explicit IP)
  if (
    publicDomain &&
    !publicDomain.includes('localhost') &&
    !publicDomain.includes('127.0.0.1')
  ) {
    return publicDomain.startsWith('http://') || publicDomain.startsWith('https://')
      ? publicDomain
      : `https://${publicDomain}`;
  }

  // 2. On Web: localhost:5000 works directly in browser
  if (Platform.OS === 'web') {
    return 'http://localhost:5000';
  }

  // 3. On Mobile (Expo Go on physical device):
  // Dynamically extract packager host IP from Constants.expoConfig?.hostUri (e.g. "192.168.29.120:8081")
  const hostUri = Constants.expoConfig?.hostUri;
  const packagerIp = hostUri ? hostUri.split(':')[0] : null;

  if (packagerIp && packagerIp !== 'localhost' && packagerIp !== '127.0.0.1') {
    return `http://${packagerIp}:5000`;
  }

  // 4. Android Emulator loopback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  return 'http://localhost:5000';
}

const apiBaseUrl = resolveApiBaseUrl();
setBaseUrl(apiBaseUrl);

function RootLayoutNav() {
  const { getToken } = useAuth();
  const { isUserSignedIn, authMode, isLoaded: contextLoaded } = useTalentIQ();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!contextLoaded) return;

    const rootSegment = segments[0] as string | undefined;
    const inAuthGroup = rootSegment === '(auth)';
    const inProtected =
      rootSegment === '(tabs)' ||
      rootSegment === 'hr-dashboard' ||
      rootSegment === 'create-job';

    // If completely unauthenticated (neither signed in nor guest), CANNOT be in protected routes
    if (!isUserSignedIn && authMode === 'unauthenticated' && inProtected) {
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/');
    }

    // If signed in and on (auth) modals, dismiss them and send to tabs
    if (isUserSignedIn && inAuthGroup) {
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/(tabs)');
    }
  }, [isUserSignedIn, authMode, contextLoaded, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)/sign-in" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(auth)/sign-up" options={{ presentation: 'modal' }} />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="assessment" />
      <Stack.Screen name="create-job" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="ai-insights" />
      <Stack.Screen name="hr-dashboard" />
    </Stack>
  );
}

function AppProviders({ isClerkConfigured }: { isClerkConfigured: boolean }) {
  const content = (
    <SafeAreaProvider>
      <TalentIQProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </TalentIQProvider>
    </SafeAreaProvider>
  );

  // If a real Clerk key is present, wait for ClerkLoaded.
  // Otherwise, render immediately so the app can be explored in dev/guest mode.
  if (isClerkConfigured) {
    return <ClerkLoaded>{content}</ClerkLoaded>;
  }

  return content;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const rawKey =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    '';
  const isClerkConfigured =
    Boolean(rawKey) &&
    !rawKey.includes('REPLACE_WITH_YOUR') &&
    !rawKey.includes('dGFsZW50aXEuY2xlcmsuYWNjb3VudHMuZGV2JA');

  const publishableKey = isClerkConfigured
    ? rawKey
    : 'pk_test_dGFsZW50aXEuY2xlcmsuYWNjb3VudHMuZGV2JA';

  if (!isClerkConfigured) {
    console.warn(
      '[TalentIQ] Running in Guest/Dev Mode (no real Clerk key). To enable full Clerk authentication, add your CLERK_PUBLISHABLE_KEY from https://dashboard.clerk.com to artifacts/talentiq-mobile/.env'
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined}
    >
      <AppProviders isClerkConfigured={isClerkConfigured} />
    </ClerkProvider>
  );
}
