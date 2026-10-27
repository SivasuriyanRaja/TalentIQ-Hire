import React from 'react';
import { Feather } from '@expo/vector-icons';
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
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';
import { sampleCandidates, ApplicationStatus } from '@/data/talentiq';

export default function HRDashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobs, customJobs, candidateStatuses, setCandidateStatus } = useTalentIQ();

  const openRoles = customJobs.length || jobs.length;
  const shortlisted = sampleCandidates.filter(
    (c) => candidateStatuses[c.name] === 'Shortlisted',
  ).length;
  const inInterview = sampleCandidates.filter(
    (c) => candidateStatuses[c.name] === 'Interview',
  ).length;
  const totalApplicants = sampleCandidates.length;
  const isDark = colors.background === '#111A19';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen>
      {/* Back button */}
      <Pressable onPress={handleBack} style={styles.back}>
        <Feather name="arrow-left" size={18} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Wordmark />
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Recruiter workspace
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <Avatar initials="HR" size={42} />
        </Pressable>
      </View>

      {/* Hero banner */}
      <View style={[styles.hero, { backgroundColor: colors.foreground }]}>
        <View style={styles.heroOrb} />
        <Eyebrow color={isDark ? colors.background : '#8EE3C3'}>TALENT PIPELINE OVERVIEW</Eyebrow>
        <Text style={[styles.heroTitle, { color: colors.background }]}>
          Your hiring{'\n'}at a glance.
        </Text>
        <Text style={[styles.heroBody, { color: colors.background }]}>
          Track every open role, shortlisted candidate, and upcoming interview — all in one view.
        </Text>
        <PrimaryButton
          label="Post a new role"
          icon="plus"
          tone="light"
          onPress={() => router.push('/create-job')}
        />
      </View>

      {/* Pipeline metrics */}
      <View style={styles.metrics}>
        <Metric
          icon="briefcase"
          value={String(openRoles).padStart(2, '0')}
          label="Open roles"
          accent={colors.accent}
          accentFg={colors.accentForeground}
        />
        <Metric
          icon="users"
          value={String(totalApplicants).padStart(2, '0')}
          label="Candidates"
          accent={colors.accent}
          accentFg={colors.accentForeground}
        />
        <Metric
          icon="check-circle"
          value={String(shortlisted).padStart(2, '0')}
          label="Shortlisted"
          accent={colors.accent}
          accentFg={colors.accentForeground}
        />
        <Metric
          icon="calendar"
          value={String(inInterview).padStart(2, '0')}
          label="Interviews"
          accent={colors.accent}
          accentFg={colors.accentForeground}
        />
      </View>

      {/* Open roles */}
      <View style={styles.section}>
        <SectionTitle
          title="Open roles"
          action="+ New role"
          onAction={() => router.push('/create-job')}
        />
        {jobs.slice(0, 3).map((job) => (
          <Pressable
            key={job.id}
            onPress={() => router.push('/(tabs)/applications')}
            style={({ pressed }) => [
              styles.roleRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors.accent }]}>
              <Feather name="briefcase" size={15} color={colors.accentForeground} />
            </View>
            <View style={styles.roleCopy}>
              <Text style={[styles.roleTitle, { color: colors.foreground }]}>{job.title}</Text>
              <Text style={[styles.roleSub, { color: colors.mutedForeground }]}>
                {job.company} · {job.location}
              </Text>
            </View>
            <View style={styles.roleRight}>
              <View style={[styles.candidateCount, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.candidateCountText, { color: colors.secondaryForeground }]}>
                  {Math.floor(Math.random() * 8) + 3}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
        ))}
      </View>

      {/* Top matches */}
      <View style={styles.section}>
        <SectionTitle
          title="Top matches"
          action="View pipeline"
          onAction={() => router.push('/(tabs)/applications')}
        />
        {sampleCandidates.map((candidate) => {
          const status = (candidateStatuses[candidate.name] ?? 'Applied') as ApplicationStatus;
          const statusColor =
            status === 'Interview'
              ? colors.primary
              : status === 'Shortlisted'
              ? colors.accentForeground
              : colors.mutedForeground;

          const nextStatus: Record<ApplicationStatus, ApplicationStatus> = {
            Applied: 'Shortlisted',
            Shortlisted: 'Interview',
            Interview: 'Offer',
            Offer: 'Rejected',
            Rejected: 'Applied',
          };

          return (
            <Card key={candidate.name} style={styles.candidateCard}>
              <View style={styles.candidateTop}>
                <Avatar initials={candidate.initials} size={46} />
                <View style={styles.candidateInfo}>
                  <Text style={[styles.candidateName, { color: colors.foreground }]}>
                    {candidate.name}
                  </Text>
                  <Text style={[styles.candidateMeta, { color: colors.mutedForeground }]}>
                    {candidate.title} · {candidate.experience}
                  </Text>
                </View>
                <View style={[styles.matchBadge, { backgroundColor: colors.accent }]}>
                  <Feather name="zap" size={10} color={colors.accentForeground} />
                  <Text style={[styles.matchText, { color: colors.accentForeground }]}>
                    {candidate.score}%
                  </Text>
                </View>
              </View>

              {/* Skills */}
              <View style={styles.skillRow}>
                {candidate.skills.map((skill) => (
                  <View key={skill} style={[styles.skill, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.skillText, { color: colors.secondaryForeground }]}>
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Stage row */}
              <View style={styles.stageRow}>
                <View style={[styles.stagePill, { backgroundColor: colors.muted }]}>
                  <View style={[styles.stageDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.stageText, { color: colors.foreground }]}>{status}</Text>
                </View>
                <Pressable
                  onPress={() => setCandidateStatus(candidate.name, nextStatus[status])}
                  style={[styles.advanceBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.advanceBtnText, { color: colors.secondaryForeground }]}>
                    Advance
                  </Text>
                  <Feather name="arrow-right" size={11} color={colors.secondaryForeground} />
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>

      {/* Integrity notice */}
      <View style={[styles.noticeCard, { backgroundColor: colors.secondary }]}>
        <Feather name="shield" size={15} color={colors.secondaryForeground} />
        <Text style={[styles.noticeText, { color: colors.secondaryForeground }]}>
          Assessment integrity scores and focus-loss events are logged per candidate and visible
          in the pipeline.
        </Text>
      </View>
    </Screen>
  );
}

function Metric({
  icon,
  value,
  label,
  accent,
  accentFg,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  label: string;
  accent: string;
  accentFg: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: accent }]}>
        <Feather name={icon} size={13} color={accentFg} />
      </View>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { gap: 4 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },

  // Hero
  hero: {
    borderRadius: 28,
    padding: 22,
    gap: 13,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -80,
    top: -60,
    backgroundColor: '#3A4B43',
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  heroBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.72,
    maxWidth: 285,
  },

  // Metrics grid
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 7,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },

  section: { gap: 13 },

  // Role rows
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  roleIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCopy: { flex: 1, gap: 4 },
  roleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  roleSub: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  roleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  candidateCount: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateCountText: { fontFamily: 'Inter_700Bold', fontSize: 12 },

  // Candidate cards
  candidateCard: { gap: 13 },
  candidateTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  candidateInfo: { flex: 1, gap: 4 },
  candidateName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  candidateMeta: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  matchText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  skillText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  stageDot: { width: 7, height: 7, borderRadius: 999 },
  stageText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  advanceBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },

  // Notice
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 14,
    borderRadius: 16,
  },
  noticeText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
});
