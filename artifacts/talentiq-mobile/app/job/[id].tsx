import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useAnalyzeTalentMatch } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card, Chip, IconButton, PrimaryButton, Screen } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { estimateMatch } from '@/data/talentiq';
import { useTalentIQ } from '@/state/TalentIQContext';

export default function JobDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs, role, profile, applications, savedJobIds, toggleSavedJob, applyToJob, isUserSignedIn } = useTalentIQ();
  const analysis = useAnalyzeTalentMatch();
  const [notice, setNotice] = React.useState('');
  const job = jobs.find((item) => item.id === id);

  if (!job) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.foreground }]}>This role is no longer available.</Text>
      </Screen>
    );
  }

  const isApplied = applications.some((item) => item.jobId === job.id);
  const isSaved = savedJobIds.includes(job.id);
  const previewScore = estimateMatch(job, profile.skills);

  const runAnalysis = async () => {
    if (!isUserSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }
    setNotice('');
    try {
      await analysis.mutateAsync({
        data: {
          candidateName: profile.name,
          yearsExperience: profile.yearsExperience,
          candidateSkills: profile.skills,
          jobTitle: job.title,
          company: job.company,
          description: job.description,
          requiredSkills: job.skills,
        },
      });
    } catch {
      setNotice('We could not finish your analysis. Check your connection and try again.');
    }
  };

  const startAssessment = () => {
    if (!isUserSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }
    router.push({ pathname: '/assessment', params: { jobId: job.id } });
  };

  const apply = () => {
    if (isApplied) {
      setNotice('You have already applied for this role.');
      return;
    }
    applyToJob(job.id, job.title, job.company, previewScore);
    setNotice(`Application sent to ${job.company}. You can track it in Activity.`);
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Role details</Text>
        </Pressable>
        <IconButton
          icon={isSaved ? 'bookmark' : 'bookmark'}
          accessibilityLabel={isSaved ? 'Unsave role' : 'Save role'}
          color={isSaved ? colors.primary : colors.foreground}
          onPress={() => toggleSavedJob(job.id)}
        />
      </View>

      <View style={styles.jobHeader}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Text style={[styles.logoText, { color: colors.accentForeground }]}>{job.company.slice(0, 1)}</Text>
        </View>
        <Text style={[styles.company, { color: colors.mutedForeground }]}>{job.company}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{job.title}</Text>
        <View style={styles.details}>
          <Detail icon="map-pin" label={job.location} />
          <Detail icon="briefcase" label={job.workMode} />
          <Detail icon="clock" label={job.employment} />
        </View>
      </View>

      <Card style={styles.salaryCard}>
        <View>
          <Text style={[styles.salaryLabel, { color: colors.mutedForeground }]}>COMPENSATION</Text>
          <Text style={[styles.salary, { color: colors.foreground }]}>{job.salary}</Text>
        </View>
        <View style={[styles.salaryIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="trending-up" size={17} color={colors.secondaryForeground} />
        </View>
      </Card>

      {role === 'candidate' ? (
        <Card style={styles.fitCard}>
          <View style={styles.fitTop}>
            <View style={styles.fitCopy}>
              <Text style={[styles.fitTitle, { color: colors.foreground }]}>Your fit, at a glance</Text>
              <Text style={[styles.fitSubtitle, { color: colors.mutedForeground }]}>
                Skill overlap preview
              </Text>
            </View>
            <View style={styles.ringWrap}>
              <Svg width={54} height={54} viewBox="0 0 54 54">
                <Circle cx="27" cy="27" r="22" stroke={colors.secondary} strokeWidth="5" fill="none" />
                <Circle
                  cx="27"
                  cy="27"
                  r="22"
                  stroke={colors.primary}
                  strokeWidth="5"
                  strokeDasharray={`${(previewScore / 100) * 138} 138`}
                  strokeLinecap="round"
                  fill="none"
                  rotation="-90"
                  origin="27, 27"
                />
              </Svg>
              <Text style={[styles.ringText, { color: colors.foreground }]}>{previewScore}</Text>
            </View>
          </View>
          <Text style={[styles.fitNote, { color: colors.mutedForeground }]}>
            A quick skills overlap—not an AI assessment. Ask TalentIQ for a role-specific analysis.
          </Text>
          <View style={styles.aiActions}>
            <PrimaryButton
              label="Full AI insights"
              icon="zap"
              onPress={() => router.push({ pathname: '/ai-insights', params: { jobId: job.id } })}
            />
            <Pressable
              onPress={runAnalysis}
              disabled={analysis.isPending}
              style={({ pressed }) => [styles.quickAnalysis, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              {analysis.isPending ? (
                <Text style={[styles.quickAnalysisText, { color: colors.mutedForeground }]}>Analysing…</Text>
              ) : (
                <>
                  <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.quickAnalysisText, { color: colors.mutedForeground }]}>Quick check</Text>
                </>
              )}
            </Pressable>
          </View>
          {analysis.data ? (
            <View style={styles.analysisBlock}>
              <View style={styles.analysisHeader}>
                <Text style={[styles.analysisScore, { color: colors.foreground }]}>
                  {analysis.data.matchScore}% match
                </Text>
                <Text style={[styles.analysisCaption, { color: colors.mutedForeground }]}>
                  AI-assisted fit estimate
                </Text>
              </View>
              <ScoreRow label="Skills" value={analysis.data.skillMatch} />
              <ScoreRow label="Experience" value={analysis.data.experienceMatch} />
              <ScoreRow label="Role fit" value={analysis.data.roleFit} />
              <Text style={[styles.recommendation, { color: colors.foreground }]}>
                {analysis.data.recommendation}
              </Text>
              {analysis.data.strengths.map((strength) => (
                <View key={strength} style={styles.insight}>
                  <Feather name="check" size={14} color={colors.primary} />
                  <Text style={[styles.insightText, { color: colors.mutedForeground }]}>{strength}</Text>
                </View>
              ))}
              {analysis.data.missingSkills.length ? (
                <View style={styles.gaps}>
                  <Text style={[styles.gapHeading, { color: colors.foreground }]}>Skills to build</Text>
                  <View style={styles.gapChips}>
                    {analysis.data.missingSkills.map((skill) => <Chip key={skill} label={skill} />)}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionHeading, { color: colors.foreground }]}>About the role</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{job.description}</Text>
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionHeading, { color: colors.foreground }]}>What you’ll bring</Text>
        <View style={styles.skillChips}>
          {job.skills.map((skill) => <Chip key={skill} label={skill} />)}
        </View>
      </View>
      {notice ? (
        <View style={[styles.notice, { backgroundColor: colors.accent }]}>
          <Feather name={isApplied ? 'check-circle' : 'info'} size={16} color={colors.accentForeground} />
          <Text style={[styles.noticeText, { color: colors.accentForeground }]}>{notice}</Text>
        </View>
      ) : null}
      {role === 'candidate' ? (
        <>
          <PrimaryButton
            label={isApplied ? 'Application sent' : 'Apply for this role'}
            icon={isApplied ? 'check' : 'arrow-up-right'}
            tone={isApplied ? 'light' : 'primary'}
            disabled={isApplied}
            onPress={apply}
          />
          <Pressable onPress={startAssessment} style={styles.assessmentLink}>
            <Feather name="zap" size={15} color={colors.primary} />
            <Text style={[styles.assessmentLinkText, { color: colors.primary }]}>
              Try a role-specific assessment
            </Text>
          </Pressable>
        </>
      ) : (
        <PrimaryButton
          label="Review candidate pipeline"
          icon="users"
          onPress={() => router.push('/(tabs)/applications')}
        />
      )}
      {notice && !analysis.data ? null : null}
      {analysis.error ? (
        <Text style={[styles.error, { color: colors.destructive }]}>{notice || 'AI insights are temporarily unavailable.'}</Text>
      ) : null}
    </Screen>
  );
}

function Detail({ icon, label }: { icon: 'map-pin' | 'briefcase' | 'clock'; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.detail}>
      <Feather name={icon} size={12} color={colors.mutedForeground} />
      <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: colors.secondary }]}>
        <View style={[styles.progress, { backgroundColor: colors.primary, width: `${value}%` }]} />
      </View>
      <Text style={[styles.scoreLabel, { color: colors.foreground }]}>{value}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aiActions: { gap: 10 },
  quickAnalysis: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickAnalysisText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  jobHeader: { alignItems: 'flex-start', gap: 9 },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  company: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 35, letterSpacing: -0.9 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 3 },
  detail: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  detailText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  salaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  salaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.9 },
  salary: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 5 },
  salaryIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fitCard: { gap: 14 },
  fitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fitCopy: { gap: 5 },
  fitTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  fitSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  ringWrap: { width: 54, height: 54, justifyContent: 'center', alignItems: 'center' },
  ringText: { position: 'absolute', fontFamily: 'Inter_700Bold', fontSize: 13 },
  fitNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  analysisBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6E6DE', paddingTop: 14, gap: 11 },
  analysisHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  analysisScore: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  analysisCaption: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  scoreLabel: { width: 65, fontFamily: 'Inter_500Medium', fontSize: 10 },
  track: { height: 6, borderRadius: 999, flex: 1, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 999 },
  recommendation: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginTop: 3 },
  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  insightText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  gaps: { gap: 8, marginTop: 2 },
  gapHeading: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  gapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  section: { gap: 10 },
  sectionHeading: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
  skillChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  assessmentLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8 },
  assessmentLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 11, textAlign: 'center' },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 20 },
});
