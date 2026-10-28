import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Card, Eyebrow, PrimaryButton, Screen, Wordmark } from '@/components/ui';
import { useTalentIQ } from '@/state/TalentIQContext';
import { UserRole } from '@/data/talentiq';

export default function RoleSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const { role, setRole, isUserSignedIn } = useTalentIQ();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const choose = (nextRole: UserRole) => {
    setRole(nextRole);
    if (isUserSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.push('/(auth)/sign-up');
    }
  };

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.topRow}>
        <Pressable onPress={handleBack} style={styles.backButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Wordmark />
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.intro}>
        <Eyebrow>ONE PLATFORM, TWO PERSPECTIVES</Eyebrow>
        <Text style={[styles.title, { color: colors.foreground }]}>How will you use TalentIQ?</Text>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          Choose your primary view. You can customize your preferences anytime.
        </Text>
      </View>
      <RoleCard
        title="I’m looking for work"
        subtitle="Discover roles, find your strengths, and track your next steps."
        icon="compass"
        selected={role === 'candidate'}
        onPress={() => setRole('candidate')}
      />
      <RoleCard
        title="I’m hiring talent"
        subtitle="Build a better shortlist and keep your hiring process moving."
        icon="briefcase"
        selected={role === 'recruiter'}
        onPress={() => setRole('recruiter')}
      />
      <PrimaryButton label="Continue to Sign Up" icon="arrow-right" onPress={() => choose(role)} />
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Create your verified account to start receiving AI-scored matches.
      </Text>
    </Screen>
  );
}

function RoleCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress}>
      <Card
        style={[
          styles.roleCard,
          selected && { borderColor: colors.primary, backgroundColor: colors.accent },
        ]}
      >
        <View style={[styles.roleIcon, { backgroundColor: selected ? colors.card : colors.secondary }]}>
          <Feather name={icon} size={19} color={colors.primary} />
        </View>
        <View style={styles.roleCopy}>
          <Text style={[styles.roleTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.roleSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
        <Feather
          name={selected ? 'check-circle' : 'circle'}
          size={20}
          color={selected ? colors.primary : colors.border}
        />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: 18 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingRight: 10,
  },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  intro: { gap: 10, marginTop: 14, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 31, lineHeight: 37, letterSpacing: -1.25 },
  copy: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  roleCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16 },
  roleIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  roleCopy: { flex: 1, gap: 5 },
  roleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  roleSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 10 },
});
