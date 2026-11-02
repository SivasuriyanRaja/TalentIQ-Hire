import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleAuthCallbackScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { loginWithGoogle } = useTalentIQ();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function processAuth() {
      try {
        let token: string | null = null;

        // 1. Check local search params from router
        if (typeof params.access_token === 'string') {
          token = params.access_token;
        } else if (typeof params.id_token === 'string') {
          token = params.id_token;
        }

        // 2. On Web, parse window.location hash fragment (#access_token=...)
        if (!token && Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash && hash.length > 1) {
            const hashParams = new URLSearchParams(hash.substring(1));
            token = hashParams.get('access_token') || hashParams.get('id_token');
          }
        }

        if (!token) {
          setErrorMsg('No Google authentication token was received from the redirect.');
          return;
        }

        // 3. Authenticate with TalentIQ backend
        const result = await loginWithGoogle({
          email: '',
          token,
          intent: 'sign-in',
        });

        if (!result.success) {
          setErrorMsg(result.error || 'Failed to complete Google sign-in.');
          return;
        }

        // Success - navigate into main application
        router.replace('/(tabs)');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Unexpected error completing Google authentication.');
      }
    }

    void processAuth();
  }, [params, loginWithGoogle, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconCircle}>
          <GoogleIcon size={32} />
        </View>

        {errorMsg ? (
          <>
            <Text style={[styles.title, { color: colors.destructive }]}>
              Authentication Failed
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {errorMsg}
            </Text>
            <Text
              onPress={() => router.replace('/(auth)/sign-in')}
              style={[styles.link, { color: colors.primary }]}
            >
              Return to Sign In
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              Connecting your Google Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Verifying credentials with TalentIQ AI...
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
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  spinner: {
    marginVertical: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 12,
  },
});
