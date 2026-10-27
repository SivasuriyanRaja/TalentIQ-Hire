import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkLoaded, ClerkProvider, useAuth, isClerkConfigured } from '@/lib/authBridge';
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
import { Platform } from 'react-native';
import { useTalentIQ } from '@/state/TalentIQContext';
import { getApiBaseUrl } from '@/utils/apiConfig';

// Universal Web Reset: Eliminate browser default focus outlines / white selection boxes
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'talentiq-web-input-focus-reset';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      input, textarea, select, [contenteditable="true"] {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        outline-color: transparent !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus,
      input:focus-visible, textarea:focus-visible {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        outline-color: transparent !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const apiBaseUrl = getApiBaseUrl();
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

  return (
    <ClerkProvider
      tokenCache={tokenCache}
      proxyUrl={process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined}
    >
      <AppProviders isClerkConfigured={isClerkConfigured} />
    </ClerkProvider>
  );
}
