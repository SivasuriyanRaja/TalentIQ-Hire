import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { Screen, Wordmark } from '@/components/ui';

export default function WelcomeScreen() {
  const colors = useColors();
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  if (isLoaded && isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.topRow}>
        <Wordmark />
        <Pressable onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={[styles.signIn, { color: colors.foreground }]}>Sign in</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.foreground }]}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroBadge}>
          <Feather name="zap" size={13} color={colors.primaryForeground} />
          <Text style={[styles.heroBadgeText, { color: colors.primaryForeground }]}>HIRING, REIMAGINED</Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.background }]}>
          Find the{'\n'}work you’re{'\n'}
          <Text style={{ color: '#F0A895' }}>made for.</Text>
        </Text>
        <Text style={[styles.heroCopy, { color: colors.background }]}>
          More signal. Better conversations. A match that makes sense for everyone.
        </Text>
        <View style={styles.matchPreview}>
          <View style={styles.matchAvatar}>
            <Image source={require('@/assets/images/icon.png')} style={styles.previewIcon} />
          </View>
          <View style={styles.matchTextBlock}>
            <Text style={[styles.matchTitle, { color: colors.background }]}>Your next great fit</Text>
            <Text style={[styles.matchSub, { color: colors.background }]}>AI-powered, human-first</Text>
          </View>
          <View style={styles.matchScore}>
            <Text style={[styles.matchPercent, { color: colors.foreground }]}>94</Text>
          </View>
        </View>
      </View>

      <View style={styles.below}>
        <View style={styles.valueRow}>
          <Value icon="target" title="Find your fit" body="Role insights built around you" />
          <Value icon="message-circle" title="Show your skills" body="Proof, not just keywords" />
        </View>
        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.86 : 1 },
          ]}
        >
          <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>Get started</Text>
          <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/role-select')}
          style={styles.guestButton}
        >
          <Text style={[styles.guestText, { color: colors.mutedForeground }]}>Explore the app first</Text>
        </Pressable>
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
  guestButton: { alignItems: 'center', padding: 3 },
  guestText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  legal: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 1 },
});
