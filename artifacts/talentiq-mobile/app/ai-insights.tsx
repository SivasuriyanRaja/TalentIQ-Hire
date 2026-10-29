import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAnalyzeTalentMatch } from '@workspace/api-client-react';
import { Screen, Chip, PrimaryButton, Wordmark } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

// ── Animated ring component ───────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [displayScore, setDisplayScore] = useState(0);
  const [animatedOffset, setAnimatedOffset] = useState(circumference);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1100;
    const targetOffset = circumference - (score / 100) * circumference;
    let animFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setDisplayScore(Math.round(score * easeOut));
      setAnimatedOffset(circumference - (circumference - targetOffset) * easeOut);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [score, circumference]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}
      >
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
            <Stop offset="100%" stopColor="#F0A895" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated SVG Circle without Animated.createAnimatedComponent to avoid DOM collapsable warning */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringScore, { color: '#FFFFFF' }]}>
          {displayScore}
        </Text>
        <Text style={[styles.ringLabel, { color: 'rgba(255, 255, 255, 0.72)' }]}>/ 100</Text>
      </View>
    </View>
  );
}

// ── Score bar component ───────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: number;
  delay?: number;
}) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start();
  }, [value, delay, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: 'rgba(255, 255, 255, 0.85)' }]}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
        <Animated.View
          style={[styles.barFill, { width, backgroundColor: colors.primary }]}
        />
      </View>
      <Text style={[styles.barValue, { color: '#FFFFFF' }]}>{value}%</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AIInsightsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs, profile, isUserSignedIn } = useTalentIQ();
  const analysis = useAnalyzeTalentMatch();
  const [ran, setRan] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const job = jobs.find((j) => j.id === jobId);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (job?.id) {
      router.replace(`/job/${job.id}`);
    } else {
      router.replace('/(tabs)/jobs');
    }
  };

  // Auto-run on mount if signed in and we have a job
  useEffect(() => {
    if (!ran && job && isUserSignedIn && profile.skills.length > 0) {
      setRan(true);
      void runAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, isUserSignedIn]);

  // Fade in result when ready
  useEffect(() => {
    if (analysis.data) {
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [analysis.data, fadeIn]);

  const runAnalysis = async () => {
    if (!isUserSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }
    if (!job) return;
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
      // error shown below
    }
  };

  if (!job) {
    return (
      <Screen>
        <Pressable onPress={handleBack} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Select a job first.
        </Text>
        <PrimaryButton label="Browse roles" onPress={() => router.replace('/(tabs)/jobs')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Nav */}
      <Pressable onPress={handleBack} style={styles.back}>
        <Feather name="arrow-left" size={18} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Back to role</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.pageHeader}>
        <Wordmark />
        <View style={styles.headerMeta}>
          <View style={[styles.aiBadge, { backgroundColor: colors.accent }]}>
            <Feather name="zap" size={11} color={colors.accentForeground} />
            <Text style={[styles.aiBadgeText, { color: colors.accentForeground }]}>
              AI INSIGHTS
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.jobSummary}>
        <Text style={[styles.jobTitle, { color: colors.foreground }]}>{job.title}</Text>
        <Text style={[styles.jobCompany, { color: colors.mutedForeground }]}>{job.company}</Text>
      </View>

      {/* Loading state */}
      {analysis.isPending ? (
        <View style={[styles.loadingCard, { backgroundColor: colors.hero || '#162521' }]}>
          <View style={[styles.loadingOrb, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
          <ActivityIndicator size="large" color="#F0A895" style={{ marginTop: 8 }} />
          <Text style={[styles.loadingTitle, { color: '#FFFFFF' }]}>
            Analyzing your profile
          </Text>
          <Text style={[styles.loadingBody, { color: 'rgba(255, 255, 255, 0.75)' }]}>
            TalentIQ is measuring your skill overlap, experience depth, and role fit against{' '}
            {job.title} at {job.company}.
          </Text>
          <View style={styles.loadingSteps}>
            {['Comparing skills', 'Assessing experience', 'Generating insights'].map(
              (step, i) => (
                <View key={step} style={styles.loadingStep}>
                  <ActivityIndicator size="small" color="#F0A895" />
                  <Text style={[styles.loadingStepText, { color: 'rgba(255, 255, 255, 0.85)' }]}>{step}</Text>
                </View>
              ),
            )}
          </View>
        </View>
      ) : null}

      {/* Error / not-signed-in prompt */}
      {!analysis.isPending && !analysis.data && !analysis.error ? (
        <View style={[styles.promptCard, { backgroundColor: colors.hero || '#162521' }]}>
          <View style={[styles.promptIcon, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
            <Feather name="zap" size={22} color="#F0A895" />
          </View>
          <Text style={[styles.promptEyebrow, { color: '#F0A895' }]}>TALENTIQ AI</Text>
          <Text style={[styles.promptTitle, { color: '#FFFFFF' }]}>
            Get your full match report.
          </Text>
          <Text style={[styles.promptBody, { color: 'rgba(255, 255, 255, 0.75)' }]}>
            Understand exactly how your profile aligns with this role — and what to focus on
            next.
          </Text>
          <PrimaryButton
            label={isUserSignedIn ? 'Run AI analysis' : 'Sign in to analyse'}
            icon="zap"
            onPress={runAnalysis}
          />
        </View>
      ) : null}

      {analysis.error ? (
        <View style={[styles.errorCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="wifi-off" size={16} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Could not complete the analysis. Check your connection and try again.
          </Text>
          <PrimaryButton label="Retry" icon="refresh-cw" onPress={runAnalysis} />
        </View>
      ) : null}

      {/* Results */}
      {analysis.data ? (
        <Animated.View style={{ opacity: fadeIn, gap: 18 }}>
          {/* Overall score ring */}
          <View style={[styles.scoreCard, { backgroundColor: colors.hero || '#162521' }]}>
            <View style={[styles.scoreOrnament, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
            <Text style={[styles.scoreEyebrow, { color: '#F0A895' }]}>OVERALL MATCH</Text>
            <View style={styles.scoreRingRow}>
              <ScoreRing score={analysis.data.matchScore} size={130} strokeWidth={11} />
              <View style={styles.scoreBreakdown}>
                <ScoreBar label="Skills" value={analysis.data.skillMatch} delay={200} />
                <ScoreBar label="Experience" value={analysis.data.experienceMatch} delay={350} />
                <ScoreBar label="Role fit" value={analysis.data.roleFit} delay={500} />
              </View>
            </View>
          </View>

          {/* Recommendation */}
          <View style={[styles.recCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.recHeader}>
              <View style={[styles.recIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="message-square" size={15} color={colors.accentForeground} />
              </View>
              <Text style={[styles.recTitle, { color: colors.foreground }]}>AI Recommendation</Text>
            </View>
            <Text style={[styles.recText, { color: colors.foreground, opacity: 0.88 }]}>
              {analysis.data.recommendation}
            </Text>
          </View>

          {/* Strengths */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={15} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Your strengths
              </Text>
            </View>
            {analysis.data.strengths.map((strength, i) => (
              <View key={i} style={[styles.strengthRow, { borderLeftColor: colors.primary }]}>
                <Text style={[styles.strengthText, { color: colors.foreground }]}>
                  {strength}
                </Text>
              </View>
            ))}
          </View>

          {/* Missing skills */}
          {analysis.data.missingSkills.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="trending-up" size={15} color={colors.mutedForeground} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Skills to develop
                </Text>
              </View>
              <View style={styles.chipRow}>
                {analysis.data.missingSkills.map((skill) => (
                  <View
                    key={skill}
                    style={[styles.gapChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Feather name="plus" size={11} color={colors.primary} />
                    <Text style={[styles.gapChipText, { color: colors.foreground }]}>
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* CTA */}
          <PrimaryButton
            label="Take role assessment"
            icon="zap"
            onPress={() => router.push({ pathname: '/assessment', params: { jobId: job.id } })}
          />
          <PrimaryButton
            label="Re-run analysis"
            icon="refresh-cw"
            tone="light"
            onPress={runAnalysis}
          />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerMeta: { flexDirection: 'row', gap: 9 },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  aiBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.9 },
  jobSummary: { gap: 5 },
  jobTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.8 },
  jobCompany: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },

  // Loading
  loadingCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    minHeight: 340,
    justifyContent: 'center',
  },
  loadingOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    right: -70,
  },
  loadingTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.6, textAlign: 'center' },
  loadingBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', opacity: 0.72, maxWidth: 280 },
  loadingSteps: { gap: 9, alignSelf: 'stretch', marginTop: 8 },
  loadingStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingStepText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(240,168,149,0.7)' },

  // Prompt
  promptCard: {
    borderRadius: 28,
    padding: 26,
    gap: 14,
    overflow: 'hidden',
  },
  promptIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1 },
  promptTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 31, letterSpacing: -0.8 },
  promptBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, opacity: 0.72 },

  // Error
  errorCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    alignItems: 'flex-start',
  },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, flex: 1 },

  // Score card
  scoreCard: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    gap: 16,
  },
  scoreOrnament: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -60,
    top: -50,
  },
  scoreEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  scoreRingRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  scoreBreakdown: { flex: 1, gap: 13 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -1 },
  ringLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },

  // Bar
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  barLabel: { width: 68, fontFamily: 'Inter_500Medium', fontSize: 10 },
  barTrack: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 30, fontFamily: 'Inter_700Bold', fontSize: 10, textAlign: 'right' },

  // Recommendation
  recCard: { borderRadius: 22, borderWidth: 1, padding: 17, gap: 13 },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  recText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },

  // Sections
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  strengthRow: {
    borderLeftWidth: 2.5,
    paddingLeft: 13,
    paddingVertical: 6,
  },
  strengthText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  gapChipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
