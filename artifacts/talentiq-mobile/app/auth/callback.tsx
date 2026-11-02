import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';
import {
  validateOAuthState,
  getGoogleOAuthRedirectUri,
  OAUTH_VERIFIER_KEY,
} from '@/lib/googleAuth';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleAuthCallbackScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    token?: string;
    error?: string;
    error_description?: string;
  }>();
  const { loginWithGoogle, loginWithSessionToken } = useTalentIQ();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Verifying with Google identity services...');

  useEffect(() => {
    let isMounted = true;

    async function processAuth() {
      try {
        // 1. Check if user or Google reported an error (e.g. access_denied)
        if (params.error) {
          const description =
            params.error === 'access_denied'
              ? 'Google sign-in was cancelled.'
              : params.error_description || params.error;
          if (isMounted) setErrorMsg(description);
          return;
        }

        // 2. Case A: Backend redirected with issued session token
        if (params.token && typeof params.token === 'string') {
          if (isMounted) setStatusText('Finalizing your TalentIQ session...');
          const token = params.token.trim();

          const result = await loginWithSessionToken(token);
          if (!result.success) {
            throw new Error(result.error || 'Could not establish session from authorization token.');
          }
          return;
        }

        // 3. Case B: Authorization code returned directly to frontend
        const code =
          typeof params.code === 'string'
            ? params.code
            : Platform.OS === 'web' && typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('code')
              : null;

        const stateParam =
          typeof params.state === 'string'
            ? params.state
            : Platform.OS === 'web' && typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('state')
              : null;

        if (code) {
          if (isMounted) setStatusText('Exchanging authorization code with secure server...');

          // Validate CSRF state parameter
          const stateValidation = await validateOAuthState(stateParam || '');
          if (!stateValidation.valid) {
            throw new Error('OAuth security state check failed. Possible CSRF or expired session.');
          }

          // Retrieve PKCE code_verifier
          let verifier = stateValidation.verifier || '';
          if (!verifier) {
            verifier =
              (Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem(OAUTH_VERIFIER_KEY)
                : null) || (await AsyncStorage.getItem(OAUTH_VERIFIER_KEY)) || '';
          }

          // Exchange code on backend at /api/auth/google/callback
          const result = await loginWithGoogle({
            code,
            code_verifier: verifier,
            state: stateParam || undefined,
            redirect_uri: getGoogleOAuthRedirectUri(),
            role: stateValidation.role || 'candidate',
            intent: stateValidation.intent || 'sign-in',
          });

          if (!result.success) {
            throw new Error(result.error || 'Failed to complete Google authentication on server.');
          }
          return;
        }

        throw new Error('No authorization code or session token received from Google OAuth.');
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || 'Unexpected error completing Google authentication.');
        }
      }
    }

    void processAuth();

    return () => {
      isMounted = false;
    };
  }, [params, router, loginWithGoogle, loginWithSessionToken]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconCircle}>
          <GoogleIcon size={34} />
        </View>

        {errorMsg ? (
          <>
            <Text style={[styles.title, { color: colors.destructive }]}>
              Authentication Failed
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {errorMsg}
            </Text>
            <Pressable
              onPress={() => router.replace('/(auth)/sign-in')}
              style={[styles.returnButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.returnButtonText, { color: colors.primaryForeground }]}>
                Return to Sign In
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              Connecting to Google Identity
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {statusText}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    padding: 36,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  spinner: {
    marginVertical: 12,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  returnButton: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  returnButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
