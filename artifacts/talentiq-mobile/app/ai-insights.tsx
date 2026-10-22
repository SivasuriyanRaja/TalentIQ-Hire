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
import { useAuth } from '@clerk/expo';
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
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: score,
      duration: 1200,
      useNativeDriver: false,
    }).start();
    const id = setInterval(() => {
      animValue.addListener(({ value }) => setDisplayScore(Math.round(value)));
    }, 16);
    return () => {
      clearInterval(id);
      animValue.removeAllListeners();
    };
  }, [score, animValue]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
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
          stroke={colors.secondary}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
      {/* Animated foreground using plain View since AnimatedCircle is complex */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
      >
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset as unknown as number}
          strokeLinecap="round"
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringScore, { color: colors.foreground }]}>
          {displayScore}
        </Text>
        <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>/ 100</Text>
      </View>
    </View>
  );
}

// Animated.createAnimatedComponent doesn't work on Svg Circle out of the box
// so we use a plain Circle and animate via JS
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
      <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
        <Animated.View
          style={[styles.barFill, { width, backgroundColor: colors.primary }]}
        />
      </View>
      <Text style={[styles.barValue, { color: colors.foreground }]}>{value}%</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AIInsightsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { isSignedIn } = useAuth();
  const { jobs, profile } = useTalentIQ();
  const analysis = useAnalyzeTalentMatch();
  const [ran, setRan] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const job = jobs.find((j) => j.id === jobId);

  // Auto-run on mount if signed in and we have a job
  useEffect(() => {
    if (!ran && job && isSignedIn && profile.skills.length > 0) {
      setRan(true);
      void runAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, isSignedIn]);

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
    if (!isSignedIn) {
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
        <Pressable onPress={() => router.back()} style={styles.back}>
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
      <Pressable onPress={() => router.back()} style={styles.back}>
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
        <View style={[styles.loadingCard, { backgroundColor: colors.foreground }]}>
          <View style={[styles.loadingOrb, { backgroundColor: '#3A4B43' }]} />
          <ActivityIndicator size="large" color="#F0A895" style={{ marginTop: 8 }} />
          <Text style={[styles.loadingTitle, { color: colors.background }]}>
            Analyzing your profile
          </Text>
          <Text style={[styles.loadingBody, { color: colors.background }]}>
            TalentIQ is measuring your skill overlap, experience depth, and role fit against{' '}
            {job.title} at {job.company}.
          </Text>
          <View style={styles.loadingSteps}>
            {['Comparing skills', 'Assessing experience', 'Generating insights'].map(
              (step, i) => (
                <View key={step} style={styles.loadingStep}>
                  <ActivityIndicator size="small" color="rgba(240,168,149,0.6)" />
                  <Text style={styles.loadingStepText}>{step}</Text>
                </View>
              ),
            )}
          </View>
        </View>
      ) : null}

      {/* Error / not-signed-in prompt */}
      {!analysis.isPending && !analysis.data && !analysis.error ? (
        <View style={[styles.promptCard, { backgroundColor: colors.foreground }]}>
          <View style={[styles.promptIcon, { backgroundColor: '#3A4B43' }]}>
            <Feather name="zap" size={22} color="#F0A895" />
          </View>
          <Text style={[styles.promptEyebrow, { color: '#F0A895' }]}>TALENIQ AI</Text>
          <Text style={[styles.promptTitle, { color: colors.background }]}>
            Get your full match report.
          </Text>
          <Text style={[styles.promptBody, { color: colors.background }]}>
            Understand exactly how your profile aligns with this role — and what to focus on
            next.
          </Text>
          <PrimaryButton
            label={isSignedIn ? 'Run AI analysis' : 'Sign in to analyse'}
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
          <View style={[styles.scoreCard, { backgroundColor: colors.foreground }]}>
            <View style={[styles.scoreOrnament, { backgroundColor: '#3A4B43' }]} />
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
            <Text style={[styles.recText, { color: colors.mutedForeground }]}>
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
                    style={[styles.gapChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  >
                    <Feather name="plus" size={10} color={colors.mutedForeground} />
                    <Text style={[styles.gapChipText, { color: colors.mutedForeground }]}>
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
