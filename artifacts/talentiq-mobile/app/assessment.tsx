import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  AssessmentGenerationRequestAssessmentType,
  AssessmentGenerationResponse,
  AssessmentQuestion,
  useGenerateTalentAssessment,
} from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Card, Chip, Eyebrow, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';
import { getApiEndpoint } from '@/utils/apiConfig';

interface AntiProxyAudit {
  proxyRiskScore: number;
  proxyRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  focusLosses: number;
  speedAnomalies: number;
  clipboardViolations: number;
  identityPledgeSigned: boolean;
  verdict: string;
}

interface EvaluationPayload {
  score: number;
  total: number;
  percentage: number;
  readinessRating: string;
  integrityStatus: string;
  proxyRiskScore?: number;
  proxyRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  antiProxyAudit?: AntiProxyAudit;
  skillsBreakdown: Array<{ skill: string; score: number }>;
  feedback: string;
  strengths: string[];
  growthAreas: string[];
}

export default function AssessmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs, completeAssessment, isUserSignedIn, authUser, profile } = useTalentIQ();
  const mutation = useGenerateTalentAssessment();

  const isDark = colors.background === '#111A19';
  const candidateName = authUser?.name || profile?.name || 'Alexander Morgan';
  const candidateInitials =
    candidateName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AM';

  const job = jobs.find((item) => item.id === jobId);

  const handleBackToRole = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (job?.id) {
      router.replace(`/job/${job.id}`);
    } else {
      router.replace('/(tabs)/jobs');
    }
  };

  // Assessment setup state
  const [assessmentType, setAssessmentType] =
    useState<AssessmentGenerationRequestAssessmentType>(
      AssessmentGenerationRequestAssessmentType.MCQ,
    );
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Active quiz state
  const [quiz, setQuiz] = useState<AssessmentGenerationResponse | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());

  // Anti-Proxy & Proctoring state
  const [identityPledgeSigned, setIdentityPledgeSigned] = useState<boolean>(false);
  const [showPledgeModal, setShowPledgeModal] = useState<boolean>(false);
  const [speedAnomalies, setSpeedAnomalies] = useState<number>(0);
  const [clipboardViolations, setClipboardViolations] = useState<number>(0);
  const [watermarkToken, setWatermarkToken] = useState<string>('');
  const [integrityToastMessage, setIntegrityToastMessage] = useState<string>('');
  const questionStartTimeRef = useRef<number>(Date.now());

  // Proctoring & timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [focusLosses, setFocusLosses] = useState<number>(0);
  const [showIntegrityToast, setShowIntegrityToast] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Result & review state
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [reviewExpanded, setReviewExpanded] = useState<boolean>(true);
  const [message, setMessage] = useState<string>('');

  // ── Focus Loss & Anti-Proxy Monitoring ────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        if (quiz && !evaluation) {
          setFocusLosses((prev) => {
            const next = prev + 1;
            const alertMsg =
              next === 1
                ? '⚠️ Focus Lost (Strike 1): Window switch detected. Logged for recruiter audit.'
                : next === 2
                  ? '⚠️ Focus Lost (Strike 2): Continued tab switches increase Proxy Risk score.'
                  : `🚨 Anti-Proxy Alert (Strike ${next}): High external activity detected.`;
            setIntegrityToastMessage(alertMsg);
            setShowIntegrityToast(true);
            setTimeout(() => setShowIntegrityToast(false), 5000);
            return next;
          });
        }
      }
    });
    return () => subscription.remove();
  }, [quiz, evaluation]);

  // ── Countdown Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!quiz || evaluation) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quiz, evaluation]);

  const handleAutoSubmit = () => {
    Alert.alert(
      'Time Expired',
      'The allotted time for this assessment has finished. Your answers have been recorded.',
      [{ text: 'View AI Evaluation', onPress: () => void evaluateAndFinish() }],
    );
  };

  // ── Anti-Copy / Clipboard Interception ───────────────────────────────────
  const handleClipboardAttempt = () => {
    setClipboardViolations((prev) => prev + 1);
    setIntegrityToastMessage('🔒 Anti-Proxy Shield: Question copying is disabled. Incident logged.');
    setShowIntegrityToast(true);
    setTimeout(() => setShowIntegrityToast(false), 4500);
  };

  // ── Answer Selection with Speed Anomaly Detection ────────────────────────
  const handleSelectOption = (option: string) => {
    const elapsedMs = Date.now() - questionStartTimeRef.current;
    if (elapsedMs < 2000 && !answers[currentIdx]) {
      // Answered in under 2 seconds: potential proxy script / bot automation
      setSpeedAnomalies((prev) => prev + 1);
    }
    setAnswers((prev) => ({ ...prev, [currentIdx]: option }));
  };

  const handleGoToQuestion = (idx: number) => {
    questionStartTimeRef.current = Date.now();
    setCurrentIdx(idx);
  };

  // ── Generate Assessment ───────────────────────────────────────────────────
  const generate = async () => {
    if (!isUserSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }
    if (!identityPledgeSigned) {
      setMessage('Please sign the Anti-Proxy Honor Pledge to begin.');
      return;
    }
    if (!job) return;
    setMessage('');

    try {
      const response = await mutation.mutateAsync({
        data: {
          jobTitle: job.title,
          requiredSkills: job.skills,
          assessmentType,
          questionCount,
        },
      });

      if (response && response.questions?.length > 0) {
        // Anti-Collusion: dynamically shuffle options per attempt so options cannot be copied across candidates
        const randomizedQuestions = (response.questions || []).map((q) => {
          const shuffledOpts = [...q.options].sort(() => Math.random() - 0.5);
          return { ...q, options: shuffledOpts };
        });

        // Generate tamper-resistant Anti-Proxy watermark token
        const token = `APX-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        setWatermarkToken(token);

        setQuiz({ ...response, questions: randomizedQuestions });
        setAnswers({});
        setCurrentIdx(0);
        setFocusLosses(0);
        setSpeedAnomalies(0);
        setClipboardViolations(0);
        setMarkedForReview(new Set());
        setEvaluation(null);
        questionStartTimeRef.current = Date.now();
        const durationSec = (response.durationMinutes || 15) * 60;
        setSecondsRemaining(durationSec);
        setTotalSeconds(durationSec);
        startTimeRef.current = Date.now();
      } else {
        setMessage('Could not load assessment questions. Please try again.');
      }
    } catch {
      setMessage('We could not prepare this assessment. Check your connection and try again.');
    }
  };

  // ── Evaluation & Finish ───────────────────────────────────────────────────
  const evaluateAndFinish = async () => {
    if (!quiz || !job) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    const timeSpentSeconds = Math.max(
      1,
      Math.round((Date.now() - startTimeRef.current) / 1000),
    );

    // Score calculation
    let correctCount = 0;
    quiz.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) {
        correctCount++;
      }
    });

    const total = quiz.questions.length;
    const percentage = Math.round((correctCount / total) * 100);

    // Call evaluate API with anti-proxy parameters
    let evalResult: EvaluationPayload;
    try {
      const evalRes = await fetch(getApiEndpoint('/talentiq/assessments/evaluate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': authUser?.id || 'user_demo_seeker',
        },
        body: JSON.stringify({
          questions: quiz.questions,
          userAnswers: answers,
          focusLosses,
          timeSpentSeconds,
          jobTitle: job.title,
          speedAnomalies,
          clipboardViolations,
          identityPledgeSigned,
        }),
      });

      if (evalRes.ok) {
        evalResult = (await evalRes.json()) as EvaluationPayload;
      } else {
        throw new Error('Fallback to local');
      }
    } catch {
      // Local fallback calculation
      const readinessRating =
        percentage >= 80
          ? 'Strong Hire · Immediate Fit'
          : percentage >= 60
            ? 'Solid Contender'
            : 'Needs Development';

      const rawRisk = (focusLosses * 20) + (speedAnomalies * 25) + (clipboardViolations * 20);
      const proxyRiskScore = Math.max(0, Math.min(100, rawRisk));
      const proxyRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
        proxyRiskScore >= 50 ? 'HIGH' : proxyRiskScore >= 20 ? 'MEDIUM' : 'LOW';

      const integrityStatus =
        proxyRiskLevel === 'HIGH'
          ? 'Flagged: High Proxy Risk'
          : proxyRiskLevel === 'MEDIUM'
            ? `Monitored (${focusLosses} focus switches)`
            : 'Verified Authentic (0-Proxy Risk)';

      evalResult = {
        score: correctCount,
        total,
        percentage,
        readinessRating,
        integrityStatus,
        proxyRiskScore,
        proxyRiskLevel,
        antiProxyAudit: {
          proxyRiskScore,
          proxyRiskLevel,
          focusLosses,
          speedAnomalies,
          clipboardViolations,
          identityPledgeSigned,
          verdict:
            proxyRiskLevel === 'LOW'
              ? 'Candidate certified genuine. Single-window locked session with zero proxy anomalies.'
              : proxyRiskLevel === 'MEDIUM'
                ? `Minor pacing and focus fluctuations (${focusLosses} switches). Re-verification advised.`
                : `High proxy risk detected (${proxyRiskScore}/100). Focus departures and speed anomalies recorded.`,
        },
        feedback:
          percentage >= 80
            ? `Outstanding domain mastery demonstrated for ${job.title}. The candidate shows deep technical competence and authentic single-window focus.`
            : percentage >= 60
              ? `Good grasp of essential concepts for ${job.title}. Reviewing targeted explanations below will solidify mastery for technical interviews.`
              : `Foundational knowledge present with growth opportunities. Review the detailed answers and architectural concepts below to prepare for future rounds.`,
        strengths: [
          `Scored ${percentage}% on role-specific competency check`,
          proxyRiskLevel === 'LOW'
            ? '100% genuine single-window proctoring session — zero proxy indicators'
            : 'Completed all questions within allotted practice window',
          `Strong alignment with ${job.company}'s engineering expectations`,
        ],
        growthAreas:
          percentage < 100
            ? [
                'Review explanations for incorrect architectural trade-offs',
                'Deepen practical experience with edge cases under production load',
              ]
            : ['Ready for live hiring manager interview rounds'],
        skillsBreakdown: [
          { skill: 'Domain Knowledge', score: percentage },
          { skill: 'Problem Solving', score: Math.min(100, Math.max(20, percentage + (focusLosses === 0 ? 5 : -5))) },
          { skill: 'Focus & Integrity', score: Math.max(10, 100 - proxyRiskScore) },
        ],
      };
    }

    setEvaluation(evalResult);
    setIsSubmitting(false);

    // Save attempt to global state + MongoDB cloud sync
    completeAssessment({
      id: `attempt-${Date.now()}`,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      assessmentTitle: quiz.title,
      score: correctCount,
      total,
      percentage,
      focusLosses,
      speedAnomalies,
      clipboardViolations,
      proxyRiskScore: evalResult.proxyRiskScore ?? 0,
      proxyRiskLevel: evalResult.proxyRiskLevel ?? 'LOW',
      identityPledgeSigned,
      watermarkToken,
      timeSpentSeconds,
      readinessRating: evalResult.readinessRating,
      integrityStatus: evalResult.integrityStatus,
      feedback: evalResult.feedback,
      skillsBreakdown: evalResult.skillsBreakdown,
      completedAt: new Date().toISOString(),
    });
  };

  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = quiz ? answeredCount === quiz.questions.length : false;

  const toggleReviewMark = (idx: number) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!job) {
    return (
      <Screen>
        <Text style={[styles.heading, { color: colors.foreground }]}>Choose a role first</Text>
        <PrimaryButton label="Browse roles" onPress={() => router.replace('/(tabs)/jobs')} />
      </Screen>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 1: PRE-ASSESSMENT SETUP SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (!quiz) {
    return (
      <Screen>
        <Pressable onPress={handleBackToRole} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back to role</Text>
        </Pressable>

        <View style={[styles.startCard, { backgroundColor: colors.hero || '#182321' }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.sparkle, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]}>
              <Feather name="zap" size={22} color="#F0A895" />
            </View>
            <View style={[styles.proctorPill, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]}>
              <Feather name="shield" size={12} color="#F0A895" />
              <Text style={[styles.proctorPillText, { color: '#F0A895' }]}>AI PROCTORED</Text>
            </View>
          </View>

          <Text style={[styles.eyebrow, { color: '#F0A895' }]}>
            {job.company.toUpperCase()} · TECHNICAL ASSESSMENT
          </Text>
          <Text style={[styles.heroTitle, { color: '#FFFFFF' }]}>
            Demonstrate your craft.
          </Text>
          <Text style={[styles.heroCopy, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            An AI-tailored technical assessment evaluating practical engineering competencies for the{' '}
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#FFFFFF' }}>{job.title}</Text> role.
          </Text>

          {/* Format selection */}
          <View style={styles.setupBlock}>
            <Text style={[styles.setupLabel, { color: 'rgba(255, 255, 255, 0.85)' }]}>Assessment Format</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Role Technical Skills"
                selected={assessmentType === AssessmentGenerationRequestAssessmentType.MCQ}
                onPress={() => setAssessmentType(AssessmentGenerationRequestAssessmentType.MCQ)}
              />
              <Chip
                label="Problem Solving / Aptitude"
                selected={assessmentType === AssessmentGenerationRequestAssessmentType.APTITUDE}
                onPress={() => setAssessmentType(AssessmentGenerationRequestAssessmentType.APTITUDE)}
              />
            </View>
          </View>

          {/* Question count selection */}
          <View style={styles.setupBlock}>
            <Text style={[styles.setupLabel, { color: 'rgba(255, 255, 255, 0.85)' }]}>Question Count</Text>
            <View style={styles.chipRow}>
              {[3, 5, 8].map((count) => (
                <Chip
                  key={count}
                  label={`${count} Questions (${count * 2}m)`}
                  selected={questionCount === count}
                  onPress={() => setQuestionCount(count)}
                />
              ))}
            </View>
          </View>

          {/* Role skills preview */}
          <View style={styles.setupBlock}>
            <Text style={[styles.setupLabel, { color: 'rgba(255, 255, 255, 0.85)' }]}>Skills Evaluated</Text>
            <View style={styles.skillWrap}>
              {job.skills.map((skill) => (
                <View
                  key={skill}
                  style={[
                    styles.skillBadge,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderColor: 'rgba(255, 255, 255, 0.22)',
                    },
                  ]}
                >
                  <Text style={[styles.skillBadgeText, { color: '#FFFFFF' }]}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Anti-Proxy Candidate Attestation & Honor Pledge */}
          <View
            style={[
              styles.pledgeCard,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.18)',
              },
            ]}
          >
            <View style={styles.pledgeHeaderRow}>
              <View style={[styles.pledgeIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.25)' }]}>
                <Feather name="shield" size={14} color="#34D399" />
              </View>
              <Text style={[styles.pledgeHeaderTitle, { color: '#FFFFFF' }]}>
                Anti-Proxy Integrity Attestation
              </Text>
              <Pressable onPress={() => setShowPledgeModal(true)} hitSlop={8}>
                <Feather name="info" size={16} color="#F0A895" />
              </Pressable>
            </View>

            <View style={styles.pledgeCandidateRow}>
              <Avatar initials={candidateInitials} size={32} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[styles.pledgeCandidateName, { color: '#FFFFFF' }]}>
                  {candidateName}
                </Text>
                <Text style={[styles.pledgeCandidateMeta, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                  Single Device Verified · Zero Proxy Policy
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setIdentityPledgeSigned((prev) => !prev)}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkboxBox,
                  {
                    borderColor: identityPledgeSigned ? '#10B981' : '#F0A895',
                    backgroundColor: identityPledgeSigned ? '#10B981' : 'transparent',
                  },
                ]}
              >
                {identityPledgeSigned && <Feather name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: 'rgba(255, 255, 255, 0.9)' }]}>
                I certify that I am the registered candidate and will complete this assessment independently with NO proxy assistance, external AI tools, or secondary devices.
              </Text>
            </Pressable>
          </View>

          <PrimaryButton
            label={identityPledgeSigned ? "Begin Proctored Assessment" : "Accept Anti-Proxy Pledge to Start"}
            icon="arrow-right"
            loading={mutation.isPending}
            onPress={generate}
          />
        </View>

        {message ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text>
        ) : null}
      </Screen>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 2: EVALUATION & RESULTS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (evaluation) {
    const isHighPassing = evaluation.percentage >= 80;
    const isMediumPassing = evaluation.percentage >= 60;

    return (
      <Screen>
        <Pressable onPress={handleBackToRole} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back to role</Text>
        </Pressable>

        {/* Score Hero Card */}
        <Card style={[styles.resultHeroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.resultBadgeRow}>
            <View style={[styles.scoreCircle, { backgroundColor: isHighPassing ? colors.accent : colors.secondary }]}>
              <Text style={[styles.scorePercentage, { color: isHighPassing ? colors.accentForeground : colors.foreground }]}>
                {evaluation.percentage}%
              </Text>
            </View>
            <View style={styles.resultHeroMeta}>
              <Text style={[styles.resultHeroTitle, { color: colors.foreground }]}>
                {evaluation.score} of {evaluation.total} Correct
              </Text>
              <Text style={[styles.resultRating, { color: colors.primary }]}>
                {evaluation.readinessRating}
              </Text>
              <View style={styles.integrityRow}>
                <Feather
                  name={evaluation.integrityStatus.includes('Verified') ? 'shield' : 'alert-circle'}
                  size={13}
                  color={evaluation.integrityStatus.includes('Verified') ? colors.primary : '#D85D49'}
                />
                <Text style={[styles.integrityStatusText, { color: colors.mutedForeground }]}>
                  {evaluation.integrityStatus}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.aiFeedbackText, { color: colors.foreground }]}>
            {evaluation.feedback}
          </Text>
        </Card>

        {/* Anti-Proxy Security Audit Card */}
        <Card style={[styles.antiProxyAuditCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.antiProxyAuditHeader}>
            <View style={styles.antiProxyTitleRow}>
              <Feather
                name={evaluation.proxyRiskLevel === 'HIGH' ? 'alert-triangle' : 'shield'}
                size={16}
                color={evaluation.proxyRiskLevel === 'HIGH' ? '#D85D49' : evaluation.proxyRiskLevel === 'MEDIUM' ? '#F59E0B' : '#10B981'}
              />
              <Text style={[styles.antiProxyTitle, { color: colors.foreground }]}>
                Anti-Proxy Security Audit
              </Text>
            </View>
            <View
              style={[
                styles.antiProxyRiskBadge,
                {
                  backgroundColor:
                    evaluation.proxyRiskLevel === 'HIGH'
                      ? (isDark ? 'rgba(216, 93, 73, 0.22)' : '#FFEBE6')
                      : evaluation.proxyRiskLevel === 'MEDIUM'
                        ? (isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF3C7')
                        : (isDark ? 'rgba(16, 185, 129, 0.22)' : '#D1FAE5'),
                },
              ]}
            >
              <Text
                style={[
                  styles.antiProxyRiskText,
                  {
                    color:
                      evaluation.proxyRiskLevel === 'HIGH'
                        ? (isDark ? '#F87171' : '#D85D49')
                        : evaluation.proxyRiskLevel === 'MEDIUM'
                          ? (isDark ? '#FBBF24' : '#B45309')
                          : (isDark ? '#34D399' : '#065F46'),
                  },
                ]}
              >
                {evaluation.proxyRiskLevel === 'HIGH'
                  ? 'HIGH PROXY RISK'
                  : evaluation.proxyRiskLevel === 'MEDIUM'
                    ? 'MODERATE INACTIVITY'
                    : 'VERIFIED GENUINE (0% PROXY RISK)'}
              </Text>
            </View>
          </View>

          <View style={styles.auditMetricsGrid}>
            <View style={[styles.auditMetricBox, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.auditMetricValue, { color: colors.foreground }]}>
                {evaluation.antiProxyAudit?.focusLosses ?? focusLosses}
              </Text>
              <Text style={[styles.auditMetricLabel, { color: colors.mutedForeground }]}>
                Window Switches
              </Text>
            </View>
            <View style={[styles.auditMetricBox, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.auditMetricValue, { color: colors.foreground }]}>
                {evaluation.antiProxyAudit?.speedAnomalies ?? speedAnomalies}
              </Text>
              <Text style={[styles.auditMetricLabel, { color: colors.mutedForeground }]}>
                Speed Flags (&lt;2s)
              </Text>
            </View>
            <View style={[styles.auditMetricBox, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.auditMetricValue, { color: colors.foreground }]}>
                {evaluation.antiProxyAudit?.clipboardViolations ?? clipboardViolations}
              </Text>
              <Text style={[styles.auditMetricLabel, { color: colors.mutedForeground }]}>
                Copy Blocked
              </Text>
            </View>
            <View style={[styles.auditMetricBox, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.auditMetricValue, { color: '#10B981' }]}>
                Signed
              </Text>
              <Text style={[styles.auditMetricLabel, { color: colors.mutedForeground }]}>
                Honor Pledge
              </Text>
            </View>
          </View>

          <View style={[styles.verdictBox, { backgroundColor: colors.secondary }]}>
            <Feather
              name={evaluation.proxyRiskLevel === 'HIGH' ? 'alert-circle' : 'check-circle'}
              size={14}
              color={evaluation.proxyRiskLevel === 'HIGH' ? '#D85D49' : colors.primary}
            />
            <Text style={[styles.verdictText, { color: colors.foreground }]}>
              {evaluation.antiProxyAudit?.verdict ||
                (evaluation.proxyRiskLevel === 'HIGH'
                  ? 'High external aid likelihood recorded during proctored check.'
                  : 'Candidate certified authentic. Zero proxy indicators detected during assessment.')}
            </Text>
          </View>
        </Card>

        {/* Competency Mastery Breakdown */}
        <Card style={styles.breakdownCard}>
          <SectionTitle title="Competency Breakdown" />
          <View style={styles.breakdownList}>
            {evaluation.skillsBreakdown.map((item) => (
              <View key={item.skill} style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Text style={[styles.breakdownLabel, { color: colors.foreground }]}>{item.skill}</Text>
                  <Text style={[styles.breakdownScore, { color: colors.primary }]}>{item.score}%</Text>
                </View>
                <View style={[styles.progressBarTrack, { backgroundColor: colors.secondary }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${item.score}%`,
                        backgroundColor: item.score >= 80 ? colors.primary : colors.mutedForeground,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Strengths & Growth Areas */}
        <Card style={styles.insightsCard}>
          <SectionTitle title="AI Key Findings" />
          <View style={styles.insightsBlock}>
            <Text style={[styles.insightHeader, { color: colors.foreground }]}>Strengths Demonstrated</Text>
            {evaluation.strengths.map((str, i) => (
              <View key={i} style={styles.insightItem}>
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={[styles.insightText, { color: colors.foreground }]}>{str}</Text>
              </View>
            ))}
          </View>

          {evaluation.growthAreas.length > 0 ? (
            <View style={[styles.insightsBlock, { marginTop: 12 }]}>
              <Text style={[styles.insightHeader, { color: colors.foreground }]}>Growth Recommendations</Text>
              {evaluation.growthAreas.map((growth, i) => (
                <View key={i} style={styles.insightItem}>
                  <Feather name="compass" size={14} color="#D85D49" />
                  <Text style={[styles.insightText, { color: colors.mutedForeground }]}>{growth}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* Detailed Question-by-Question Review */}
        <View style={styles.reviewSection}>
          <Pressable
            onPress={() => setReviewExpanded((p) => !p)}
            style={styles.reviewToggleRow}
          >
            <SectionTitle
              title="Question Explanations"
              action={reviewExpanded ? 'Collapse' : 'Expand'}
              onAction={() => setReviewExpanded((p) => !p)}
            />
          </Pressable>

          {reviewExpanded
            ? quiz.questions.map((question, index) => {
                const candidateChoice = answers[index];
                const isCorrect = candidateChoice === question.correctAnswer;
                return (
                  <View
                    key={index}
                    style={[
                      styles.reviewQuestionCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isCorrect ? colors.accent : '#F0A895',
                      },
                    ]}
                  >
                    <View style={styles.reviewQuestionHeader}>
                      <View style={styles.reviewBadgeRow}>
                        <View
                          style={[
                            styles.reviewStatusBadge,
                            { backgroundColor: isCorrect ? colors.accent : '#FFEBE6' },
                          ]}
                        >
                          <Feather
                            name={isCorrect ? 'check' : 'x'}
                            size={12}
                            color={isCorrect ? colors.accentForeground : '#D85D49'}
                          />
                          <Text
                            style={[
                              styles.reviewStatusText,
                              { color: isCorrect ? colors.accentForeground : '#D85D49' },
                            ]}
                          >
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </Text>
                        </View>
                        <Text style={[styles.reviewNumber, { color: colors.mutedForeground }]}>
                          Question {index + 1} · {question.difficulty}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.questionPrompt, { color: colors.foreground }]}>
                      {question.prompt}
                    </Text>

                    <View style={styles.reviewAnswersWrap}>
                      <View style={styles.answerRow}>
                        <Text style={[styles.answerLabel, { color: colors.mutedForeground }]}>
                          Your answer:
                        </Text>
                        <Text
                          style={[
                            styles.answerValue,
                            { color: isCorrect ? colors.primary : '#D85D49' },
                          ]}
                        >
                          {candidateChoice || 'Not answered'}
                        </Text>
                      </View>
                      {!isCorrect ? (
                        <View style={styles.answerRow}>
                          <Text style={[styles.answerLabel, { color: colors.mutedForeground }]}>
                            Correct answer:
                          </Text>
                          <Text style={[styles.answerValue, { color: colors.primary }]}>
                            {question.correctAnswer}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={[styles.explanationBox, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.explanationTitle, { color: colors.foreground }]}>
                        Engineering Rationale:
                      </Text>
                      <Text style={[styles.explanationText, { color: colors.secondaryForeground }]}>
                        {question.explanation}
                      </Text>
                    </View>
                  </View>
                );
              })
            : null}
        </View>

        {/* Final Actions */}
        <View style={styles.bottomActions}>
          <PrimaryButton
            label="Save & Return to Role"
            icon="check"
            onPress={handleBackToRole}
          />
          <Pressable onPress={() => setQuiz(null)} style={styles.secondaryActionBtn}>
            <Feather name="refresh-cw" size={14} color={colors.foreground} />
            <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>
              Retake Practice Assessment
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 3: ACTIVE PROCTORED ASSESSMENT MODE
  // ═══════════════════════════════════════════════════════════════════════════
  const activeQuestion = quiz.questions[currentIdx];
  const isTimeCritical = secondsRemaining <= 120; // under 2 mins

  return (
    <Screen>
      {/* Background Anti-Proxy Security Watermark (Anti-Screen Sharing & Leakage) */}
      <View pointerEvents="none" style={styles.watermarkLayer}>
        <Text style={styles.watermarkText}>
          TALENTIQ ANTI-PROXY · {authUser?.name?.toUpperCase() || 'CANDIDATE'} · {watermarkToken || 'SECURE-SESSION'} · SINGLE-WINDOW LOCKED
        </Text>
      </View>

      {/* Real-time Focus Loss / Anti-Proxy Warning Toast */}
      {showIntegrityToast && (
        <View style={styles.integrityToast}>
          <Feather name="alert-triangle" size={16} color="#FFFFFF" />
          <Text style={styles.integrityToastText}>
            {integrityToastMessage || `App focus change detected (${focusLosses}). Proctoring integrity logged.`}
          </Text>
        </View>
      )}

      {/* Top Proctoring Bar: Timer + Anti-Proxy Security Badge */}
      <View style={styles.proctorBar}>
        <View style={[styles.timerBadge, { backgroundColor: isTimeCritical ? '#FFEBE6' : colors.card, borderColor: isTimeCritical ? '#D85D49' : colors.border }]}>
          <Feather name="clock" size={14} color={isTimeCritical ? '#D85D49' : colors.primary} />
          <Text style={[styles.timerText, { color: isTimeCritical ? '#D85D49' : colors.foreground }]}>
            {formatTimer(secondsRemaining)}
          </Text>
        </View>

        <View style={[styles.integrityBadge, { backgroundColor: focusLosses === 0 ? colors.card : '#FFEBE6', borderColor: colors.border }]}>
          <Feather name="shield" size={13} color={focusLosses === 0 ? '#10B981' : '#D85D49'} />
          <Text style={[styles.integrityBadgeText, { color: focusLosses === 0 ? '#10B981' : '#D85D49' }]}>
            {focusLosses === 0 ? 'ANTI-PROXY ACTIVE' : `${focusLosses} STRIKES · LOGGED`}
          </Text>
        </View>
      </View>

      {/* Header Info */}
      <View style={styles.quizHeader}>
        <Eyebrow>{job.company.toUpperCase()} · ANTI-PROXY SECURED CHECK</Eyebrow>
        <Text style={[styles.heading, { color: colors.foreground }]}>{quiz.title}</Text>
        <Text style={[styles.quizSub, { color: colors.mutedForeground }]}>
          Question {currentIdx + 1} of {quiz.questions.length} · {answeredCount} answered · Options randomized
        </Text>
      </View>

      {/* Interactive Question Stepper / Navigator */}
      <View style={styles.stepperContainer}>
        {quiz.questions.map((_, idx) => {
          const isAnswered = Boolean(answers[idx]);
          const isActive = idx === currentIdx;
          const isMarked = markedForReview.has(idx);

          return (
            <Pressable
              key={idx}
              onPress={() => handleGoToQuestion(idx)}
              style={[
                styles.stepperItem,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : isAnswered
                      ? colors.accent
                      : colors.card,
                  borderColor: isMarked ? '#D85D49' : isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.stepperText,
                  {
                    color: isActive
                      ? colors.primaryForeground
                      : isAnswered
                        ? colors.accentForeground
                        : colors.foreground,
                  },
                ]}
              >
                {idx + 1}
              </Text>
              {isMarked ? <View style={styles.reviewDot} /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Question Card with Anti-Copy Guard */}
      <Card style={[styles.activeQuestionCard, { borderColor: colors.border }]}>
        <View style={styles.questionCardTop}>
          <View style={styles.difficultyPill}>
            <Text style={[styles.difficultyText, { color: colors.primary }]}>
              {activeQuestion.difficulty.toUpperCase()} LEVEL
            </Text>
          </View>
          <Pressable
            onPress={() => toggleReviewMark(currentIdx)}
            style={styles.reviewFlagBtn}
          >
            <Feather
              name="flag"
              size={13}
              color={markedForReview.has(currentIdx) ? '#D85D49' : colors.mutedForeground}
            />
            <Text
              style={[
                styles.reviewFlagText,
                { color: markedForReview.has(currentIdx) ? '#D85D49' : colors.mutedForeground },
              ]}
            >
              {markedForReview.has(currentIdx) ? 'Marked' : 'Review later'}
            </Text>
          </Pressable>
        </View>

        <Text
          style={[styles.promptText, { color: colors.foreground }]}
          onLongPress={handleClipboardAttempt}
        >
          {activeQuestion.prompt}
        </Text>

        {/* 4 Shuffled Answer Options */}
        <View style={styles.optionsList}>
          {activeQuestion.options.map((option, optIdx) => {
            const isSelected = answers[currentIdx] === option;
            return (
              <Pressable
                key={option}
                onPress={() => handleSelectOption(option)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.optionLetterBox,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLetterText,
                      { color: isSelected ? colors.primaryForeground : colors.secondaryForeground },
                    ]}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </Text>
                </View>
                <Text style={[styles.optionContentText, { color: colors.foreground }]}>
                  {option}
                </Text>
                {isSelected ? (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Step Navigation Controls */}
      <View style={styles.navControls}>
        <Pressable
          disabled={currentIdx === 0}
          onPress={() => handleGoToQuestion(Math.max(0, currentIdx - 1))}
          style={[
            styles.navBtn,
            { borderColor: colors.border, opacity: currentIdx === 0 ? 0.4 : 1 },
          ]}
        >
          <Feather name="chevron-left" size={16} color={colors.foreground} />
          <Text style={[styles.navBtnText, { color: colors.foreground }]}>Previous</Text>
        </Pressable>

        {currentIdx < quiz.questions.length - 1 ? (
          <Pressable
            onPress={() => handleGoToQuestion(Math.min(quiz.questions.length - 1, currentIdx + 1))}
            style={[styles.navBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.navBtnText, { color: colors.foreground }]}>Next</Text>
            <Feather name="chevron-right" size={16} color={colors.foreground} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowConfirmModal(true)}
            style={[styles.finishBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.finishBtnText, { color: colors.primaryForeground }]}>
              Review & Submit
            </Text>
            <Feather name="check" size={16} color={colors.primaryForeground} />
          </Pressable>
        )}
      </View>

      {/* Floating Submit Action if all questions answered */}
      {isAllAnswered && currentIdx < quiz.questions.length - 1 && (
        <PrimaryButton
          label="All Answered · Submit Now"
          icon="check-circle"
          onPress={() => setShowConfirmModal(true)}
        />
      )}

      {/* Confirmation Modal before Final Submission */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalIconBox}>
              <Feather name="award" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Submit Assessment?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              You have answered {answeredCount} of {quiz.questions.length} questions.
              {!isAllAnswered ? ` You have ${quiz.questions.length - answeredCount} unanswered question(s).` : ''}
              {' '}Your Anti-Proxy audit and AI competency report will be generated immediately.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setShowConfirmModal(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Continue</Text>
              </Pressable>
              <PrimaryButton
                label="Submit Assessment"
                icon="check"
                loading={isSubmitting}
                onPress={evaluateAndFinish}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Anti-Proxy Protocol Details Modal */}
      <Modal visible={showPledgeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalIconBox}>
              <Feather name="shield" size={24} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              TalentIQ Anti-Proxy Protocol
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              To guarantee fairness and prevent proxy test-taking, TalentIQ enforces 4 proctoring layers:
            </Text>

            <View style={styles.ruleList}>
              <View style={styles.ruleItem}>
                <Feather name="check" size={14} color="#10B981" />
                <Text style={[styles.ruleText, { color: colors.foreground }]}>
                  <Text style={{ fontFamily: 'Inter_700Bold' }}>Single-Window Lock:</Text> Window / app switching triggers strikes logged for recruiters.
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <Feather name="check" size={14} color="#10B981" />
                <Text style={[styles.ruleText, { color: colors.foreground }]}>
                  <Text style={{ fontFamily: 'Inter_700Bold' }}>Anti-Collusion Shuffling:</Text> Options and question sets are scrambled per attempt.
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <Feather name="check" size={14} color="#10B981" />
                <Text style={[styles.ruleText, { color: colors.foreground }]}>
                  <Text style={{ fontFamily: 'Inter_700Bold' }}>Clipboard Guard:</Text> Question copying to external LLMs/proxies is strictly restricted.
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <Feather name="check" size={14} color="#10B981" />
                <Text style={[styles.ruleText, { color: colors.foreground }]}>
                  <Text style={{ fontFamily: 'Inter_700Bold' }}>Pacing Analysis:</Text> Instant (&lt;2s) bot or proxy answering patterns are flagged automatically.
                </Text>
              </View>
            </View>

            <PrimaryButton
              label="I Understand & Agree"
              icon="check"
              onPress={() => {
                setIdentityPledgeSigned(true);
                setShowPledgeModal(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  // Setup View
  startCard: { borderRadius: 27, padding: 22, gap: 15 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sparkle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#36483E',
  },
  proctorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#36483E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  proctorPillText: {
    color: '#F0A895',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.1 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.9 },
  heroCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, opacity: 0.82 },
  setupBlock: { gap: 8 },
  setupLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  skillWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  skillBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  skillBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  integrityBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  integrityText: { color: '#E7E5DC', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, flex: 1 },

  // Active Assessment Bar
  integrityToast: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#D85D49',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  integrityToastText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 11, flex: 1 },
  proctorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: { fontFamily: 'Inter_700Bold', fontSize: 13, fontVariant: ['tabular-nums'] },
  integrityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
  },
  integrityBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  // Header & Stepper
  quizHeader: { gap: 4, marginBottom: 8 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.7 },
  quizSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  stepperContainer: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  stepperItem: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stepperText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  reviewDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D85D49',
  },

  // Question Card
  activeQuestionCard: { padding: 18, borderRadius: 20, borderWidth: 1, gap: 14, marginVertical: 6 },
  questionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  difficultyPill: {
    backgroundColor: 'rgba(216,93,73,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8 },
  reviewFlagBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewFlagText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  promptText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  optionsList: { gap: 8, marginTop: 4 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    gap: 12,
  },
  optionLetterBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  optionContentText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18 },

  // Nav controls
  navControls: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 12 },
  navBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  finishBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13 },

  // Confirmation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 14 },
  modalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(216,93,73,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  modalBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  modalBtnRow: { gap: 10, marginTop: 6 },
  modalCancelBtn: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  // Evaluation & Results View
  resultHeroCard: { padding: 20, borderRadius: 22, borderWidth: 1, gap: 14 },
  resultBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePercentage: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  resultHeroMeta: { flex: 1, gap: 3 },
  resultHeroTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  resultRating: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  integrityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  integrityStatusText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  aiFeedbackText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },

  // Breakdown Card
  breakdownCard: { padding: 18, borderRadius: 20, gap: 14 },
  breakdownList: { gap: 12, marginTop: 6 },
  breakdownItem: { gap: 6 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  breakdownScore: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  progressBarTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  // Key Findings
  insightsCard: { padding: 18, borderRadius: 20, gap: 12 },
  insightsBlock: { gap: 8 },
  insightHeader: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  insightItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  insightText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, flex: 1 },

  // Question Explanations Review
  reviewSection: { gap: 12, marginTop: 8 },
  reviewToggleRow: { paddingVertical: 4 },
  reviewQuestionCard: { padding: 16, borderRadius: 18, borderWidth: 1.2, gap: 10 },
  reviewQuestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reviewStatusText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  reviewNumber: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  questionPrompt: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 21 },
  reviewAnswersWrap: { gap: 6, marginVertical: 4 },
  answerRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  answerLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  answerValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  explanationBox: { padding: 12, borderRadius: 12, gap: 4 },
  explanationTitle: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  explanationText: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 17 },

  // Bottom Actions
  bottomActions: { gap: 12, marginVertical: 18 },
  secondaryActionBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, textAlign: 'center', marginTop: 12 },

  // Anti-Proxy Pledge Card
  pledgeCard: {
    borderRadius: 16,
    padding: 15,
    gap: 13,
    borderWidth: 1,
  },
  pledgeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pledgeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pledgeHeaderTitle: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  pledgeCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  pledgeCandidateName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  pledgeCandidateMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxBoxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },

  // Anti-Proxy Audit Card
  antiProxyAuditCard: {
    padding: 18,
    borderRadius: 20,
    gap: 14,
    borderWidth: 1,
  },
  antiProxyAuditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  antiProxyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  antiProxyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  antiProxyRiskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  antiProxyRiskText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  auditMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  auditMetricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 3,
  },
  auditMetricValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  auditMetricLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9.5,
    textAlign: 'center',
  },
  verdictBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  verdictText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    lineHeight: 17,
  },

  // Security Watermark Layer
  watermarkLayer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.07,
    zIndex: -1,
  },
  watermarkText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Rule list in modal
  ruleList: {
    gap: 10,
    marginVertical: 4,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ruleText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
});
