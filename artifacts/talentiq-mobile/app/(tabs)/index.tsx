import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Avatar,
  Card,
  Eyebrow,
  PrimaryButton,
  Screen,
  SectionTitle,
  Wordmark,
} from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { estimateMatch } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useUser();
  const {
    role,
    profile,
    jobs,
    applications,
    savedJobIds,
    toggleSavedJob,
    isLoaded,
  } = useTalentIQ();
  const displayName = user?.firstName || profile.name.split(' ')[0];

  if (role === 'recruiter') {
    return (
      <RecruiterHome
        onCreate={() => router.push('/create-job')}
        onCandidates={() => router.push('/(tabs)/applications')}
        onDiscover={() => router.push('/(tabs)/jobs')}
      />
    );
  }

  const featured = jobs[0];
  const recommended = jobs.slice(1, 4);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Wordmark />
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good morning, {displayName}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <Avatar initials={displayName.slice(0, 1).toUpperCase()} size={42} />
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.foreground }]}>
        <View style={styles.heroOrnament} />
        <View style={styles.heroTop}>
          <View style={styles.heroPill}>
            <Feather name="zap" size={12} color="#F0A895" />
            <Text style={styles.heroPillText}>YOUR TALENT, IN FOCUS</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.background }]}>A closer match starts here.</Text>
          <Text style={[styles.heroBody, { color: colors.background }]}>
            See where your strengths stand out and what to bring to your next role.
          </Text>
        </View>
        <Pressable
          style={[styles.searchPill, { backgroundColor: colors.card }]}
          onPress={() => router.push('/(tabs)/jobs')}
        >
          <Feather name="search" size={17} color={colors.primary} />
          <Text style={[styles.searchText, { color: colors.mutedForeground }]}>Role, skill, or company</Text>
          <Feather name="arrow-right" size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.metrics}>
        <Metric value={isLoaded ? String(applications.length).padStart(2, '0') : '—'} label="Applications" />
        <Metric value={String(savedJobIds.length).padStart(2, '0')} label="Saved roles" />
        <Metric value={String(profile.skills.length).padStart(2, '0')} label="Core skills" />
      </View>

      <View style={styles.sectionWrap}>
        <SectionTitle
          title="A thoughtful fit"
          action="See all roles"
          onAction={() => router.push('/(tabs)/jobs')}
        />
        {featured ? (
          <JobCard
            job={featured}
            matchScore={estimateMatch(featured, profile.skills)}
            saved={savedJobIds.includes(featured.id)}
            onToggleSaved={() => toggleSavedJob(featured.id)}
            onPress={() => router.push(`/job/${featured.id}`)}
          />
        ) : null}
      </View>

      <View style={styles.sectionWrap}>
        <SectionTitle title="Picked for your path" />
        {recommended.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            saved={savedJobIds.includes(job.id)}
            onToggleSaved={() => toggleSavedJob(job.id)}
            onPress={() => router.push(`/job/${job.id}`)}
            compact
          />
        ))}
      </View>
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.metric, { borderRightColor: colors.border }]}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function RecruiterHome({
  onCreate,
  onCandidates,
  onDiscover,
}: {
  onCreate: () => void;
  onCandidates: () => void;
  onDiscover: () => void;
}) {
  const colors = useColors();
  const { jobs, customJobs } = useTalentIQ();
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Wordmark />
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Recruiter workspace</Text>
        </View>
        <Pressable onPress={onDiscover}>
          <Avatar initials="HR" size={42} />
        </Pressable>
      </View>
      <View style={[styles.recruiterHero, { backgroundColor: colors.foreground }]}>
        <Eyebrow>YOUR TALENT PIPELINE</Eyebrow>
        <Text style={[styles.recruiterTitle, { color: colors.background }]}>Make the next great hire.</Text>
        <Text style={[styles.heroBody, { color: colors.background }]}>
          Find stronger signals, keep candidates moving, and spend more time in meaningful conversations.
        </Text>
        <PrimaryButton label="Post a new role" icon="plus" onPress={onCreate} />
      </View>
      <View style={styles.metrics}>
        <Metric value={String(customJobs.length || 4).padStart(2, '0')} label="Open roles" />
        <Metric value="12" label="In review" />
        <Metric value="04" label="Interviews" />
      </View>
      <View style={styles.sectionWrap}>
        <SectionTitle title="Your open roles" action="Manage" onAction={onDiscover} />
        {jobs.slice(0, 2).map((job) => (
          <Pressable
            key={job.id}
            onPress={onCandidates}
            style={[styles.roleRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.roleRowIcon, { backgroundColor: colors.accent }]}>
              <Feather name="briefcase" size={16} color={colors.accentForeground} />
            </View>
            <View style={styles.roleRowCopy}>
              <Text style={[styles.roleRowTitle, { color: colors.foreground }]}>{job.title}</Text>
              <Text style={[styles.roleRowSub, { color: colors.mutedForeground }]}>{job.company} · 8 candidates</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
      <View style={styles.sectionWrap}>
        <SectionTitle title="Promising matches" action="View pipeline" onAction={onCandidates} />
        <Card style={styles.candidateCard}>
          <View style={styles.candidateHead}>
            <Avatar initials="JL" size={45} />
            <View style={styles.candidateInfo}>
              <Text style={[styles.candidateName, { color: colors.foreground }]}>Jordan Lee</Text>
              <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>Product Designer · 6 yrs</Text>
            </View>
            <View style={[styles.candidateScore, { backgroundColor: colors.accent }]}>
              <Text style={[styles.scoreNumber, { color: colors.accentForeground }]}>96%</Text>
            </View>
          </View>
          <Text style={[styles.aiNote, { color: colors.mutedForeground }]}>
            Strong design-system experience and user research skills match your Senior Product Designer role.
          </Text>
          <Pressable onPress={onCandidates} style={styles.candidateAction}>
            <Text style={[styles.candidateActionText, { color: colors.primary }]}>Review profile</Text>
            <Feather name="arrow-right" size={14} color={colors.primary} />
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { gap: 4 },
  greeting: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  hero: { padding: 21, borderRadius: 28, minHeight: 244, justifyContent: 'space-between', overflow: 'hidden' },
  heroOrnament: { position: 'absolute', height: 170, width: 170, borderRadius: 90, top: -92, right: -30, borderWidth: 28, borderColor: '#3A4B43' },
  heroTop: { gap: 10 },
  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#33443C', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  heroPillText: { color: '#F0A895', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.8 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 31, letterSpacing: -0.85, maxWidth: 280 },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, opacity: 0.72, maxWidth: 285 },
  searchPill: { minHeight: 48, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12 },
  metrics: { flexDirection: 'row', paddingVertical: 4 },
  metric: { flex: 1, borderRightWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 4 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5 },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  sectionWrap: { gap: 13 },
  recruiterHero: { borderRadius: 27, padding: 20, gap: 12 },
  recruiterTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.8 },
  roleRow: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleRowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  roleRowCopy: { flex: 1, gap: 4 },
  roleRowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  roleRowSub: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  candidateCard: { gap: 13 },
  candidateHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  candidateInfo: { flex: 1, gap: 3 },
  candidateName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  candidateSub: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  candidateScore: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  scoreNumber: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  aiNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  candidateAction: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  candidateActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
