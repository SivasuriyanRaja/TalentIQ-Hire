import React, { useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Screen, Wordmark } from '@/components/ui';
import { useTalentIQ } from '@/state/TalentIQContext';

export default function WelcomeScreen() {
  const colors = useColors();
  const { isUserSignedIn, isLoaded, authMode } = useTalentIQ();
  const router = useRouter();

  // Prevent hardware back button from popping back into signed-in routes or previous screens
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, []),
  );

  if (isLoaded && isUserSignedIn && authMode === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.topRow}>
        <Wordmark />
        <Pressable onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={[styles.signIn, { color: colors.foreground }]}>Sign in</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.hero || '#182321' }]}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroBadge}>
          <Feather name="zap" size={13} color="#F0A895" />
          <Text style={[styles.heroBadgeText, { color: '#F0A895' }]}>HIRING, REIMAGINED</Text>
        </View>
        <Text style={[styles.heroTitle, { color: '#FFFFFF' }]}>
          Find the{'\n'}work you’re{'\n'}
          <Text style={{ color: '#F0A895' }}>made for.</Text>
        </Text>
        <Text style={[styles.heroCopy, { color: 'rgba(255, 255, 255, 0.8)' }]}>
          More signal. Better conversations. A match that makes sense for everyone.
        </Text>
        <View style={styles.matchPreview}>
          <View style={styles.matchAvatar}>
            <Image source={require('@/assets/images/icon.png')} style={styles.previewIcon} />
          </View>
          <View style={styles.matchTextBlock}>
            <Text style={[styles.matchTitle, { color: '#FFFFFF' }]}>Your next great fit</Text>
            <Text style={[styles.matchSub, { color: 'rgba(255, 255, 255, 0.7)' }]}>AI-powered, human-first</Text>
          </View>
          <View style={styles.matchScore}>
            <Text style={[styles.matchPercent, { color: '#182321' }]}>94</Text>
          </View>
        </View>
      </View>

      <View style={styles.below}>
        <View style={styles.valueRow}>
          <Value icon="target" title="Find your fit" body="Role insights built around you" />
          <Value icon="message-circle" title="Show your skills" body="Proof, not just keywords" />
        </View>
        <Pressable
          onPress={() => router.push('/onboarding')}
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.86 : 1 },
          ]}
        >
          <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>Get started</Text>
          <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          style={({ pressed }) => [
            styles.signInButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.86 : 1 },
          ]}
        >
          <Feather name="log-in" size={16} color={colors.foreground} />
          <Text style={[styles.signInButtonText, { color: colors.foreground }]}>Sign in to your account</Text>
        </Pressable>
        <View style={styles.registerRow}>
          <Text style={[styles.registerPrompt, { color: colors.mutedForeground }]}>
            New to TalentIQ?
          </Text>
          <Pressable onPress={() => router.push('/(auth)/sign-up')} hitSlop={6}>
            <Text style={[styles.registerLink, { color: colors.primary }]}>
              Create an account
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          Thoughtful hiring starts with a clearer picture.
        </Text>
      </View>
    </Screen>
  );
}

function Value({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.valueItem}>
      <Feather name={icon} size={17} color={colors.primary} />
      <Text style={[styles.valueTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.valueBody, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  topRow: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signIn: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  hero: { minHeight: 464, borderRadius: 30, padding: 25, overflow: 'hidden', justifyContent: 'flex-start' },
  heroOrbLarge: { position: 'absolute', width: 270, height: 270, borderRadius: 135, right: -110, top: 18, backgroundColor: '#394A43' },
  heroOrbSmall: { position: 'absolute', width: 148, height: 148, borderRadius: 74, right: 12, top: 120, backgroundColor: '#53655A', opacity: 0.5 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#405247', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  heroBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.05 },
  heroTitle: { marginTop: 24, fontFamily: 'Inter_700Bold', fontSize: 42, lineHeight: 45, letterSpacing: -2 },
  heroCopy: { marginTop: 14, maxWidth: 280, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, opacity: 0.76 },
  matchPreview: { marginTop: 24, padding: 12, borderRadius: 18, backgroundColor: '#263630', flexDirection: 'row', alignItems: 'center', gap: 11 },
  matchAvatar: { width: 38, height: 38, borderRadius: 14, overflow: 'hidden', backgroundColor: '#DCEBE3' },
  previewIcon: { width: 38, height: 38 },
  matchTextBlock: { flex: 1, gap: 3 },
  matchTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  matchSub: { fontFamily: 'Inter_400Regular', fontSize: 10, opacity: 0.64 },
  matchScore: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#F0A895', alignItems: 'center', justifyContent: 'center' },
  matchPercent: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  below: { gap: 17 },
  valueRow: { flexDirection: 'row', gap: 10 },
  valueItem: { flex: 1, gap: 7, paddingVertical: 7 },
  valueTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  valueBody: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  createButton: { minHeight: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  createButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  signInButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  signInButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  registerPrompt: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  registerLink: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  legal: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 1 },
});
