import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import {
  AssessmentGenerationRequestAssessmentType,
  AssessmentGenerationResponse,
  AssessmentQuestion,
  useGenerateTalentAssessment,
} from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Chip, PrimaryButton, Screen } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

export default function AssessmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs, completeAssessment, isUserSignedIn } = useTalentIQ();
  const mutation = useGenerateTalentAssessment();
  const [quiz, setQuiz] = useState<AssessmentGenerationResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [focusLosses, setFocusLosses] = useState(0);
  const [message, setMessage] = useState('');
  const [assessmentType, setAssessmentType] =
    useState<AssessmentGenerationRequestAssessmentType>(
      AssessmentGenerationRequestAssessmentType.MCQ,
    );
  const job = jobs.find((item) => item.id === jobId);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        setFocusLosses((count) => count + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const generate = async () => {
    if (!isUserSignedIn) {
      router.push('/(auth)/sign-in');
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
          questionCount: 5,
        },
      });
      setQuiz(response);
    } catch {
      setMessage('We could not prepare this assessment. Check your connection and try again.');
    }
  };

  const finish = () => {
    if (!quiz || Object.keys(answers).length < quiz.questions.length) return;
    const score = quiz.questions.reduce(
      (sum, question, index) => sum + (answers[index] === question.correctAnswer ? 1 : 0),
      0,
    );
    setResult({ score, total: quiz.questions.length });
    completeAssessment({
      id: `${Date.now()}`,
      jobId: job?.id ?? '',
      score,
      total: quiz.questions.length,
      focusLosses,
      completedAt: new Date().toISOString(),
    });
  };

  if (!job) {
    return (
      <Screen>
        <Text style={[styles.heading, { color: colors.foreground }]}>Choose a role first</Text>
        <PrimaryButton label="Browse roles" onPress={() => router.replace('/(tabs)/jobs')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={18} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Back to role</Text>
      </Pressable>

      {!quiz ? (
        <View style={[styles.startCard, { backgroundColor: colors.foreground }]}>
          <View style={styles.sparkle}>
            <Feather name="zap" size={21} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.eyebrow, { color: '#F0A895' }]}>TALENTIQ SKILL CHECK</Text>
          <Text style={[styles.heroTitle, { color: colors.background }]}>Show what you know.</Text>
          <Text style={[styles.heroCopy, { color: colors.background }]}>
            A short practice assessment tailored to the {job.title} role. Your answers are private to this preview.
          </Text>
          <Text style={[styles.typeLabel, { color: colors.background }]}>Choose a practice format</Text>
          <View style={styles.typeOptions}>
            <Chip
              label="Role skills"
              selected={assessmentType === AssessmentGenerationRequestAssessmentType.MCQ}
              onPress={() => setAssessmentType(AssessmentGenerationRequestAssessmentType.MCQ)}
            />
            <Chip
              label="Aptitude"
              selected={assessmentType === AssessmentGenerationRequestAssessmentType.APTITUDE}
              onPress={() => setAssessmentType(AssessmentGenerationRequestAssessmentType.APTITUDE)}
            />
          </View>
          <View style={styles.metaRow}>
            <Meta icon="list" label="5 questions" />
            <Meta icon="clock" label="About 8 minutes" />
          </View>
          <PrimaryButton
            label="Generate assessment"
            icon="arrow-right"
            loading={mutation.isPending}
            onPress={generate}
          />
        </View>
      ) : (
        <View style={styles.quizWrap}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>PRACTICE ASSESSMENT</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>{quiz.title}</Text>
            <Text style={[styles.quizSub, { color: colors.mutedForeground }]}>
              {quiz.durationMinutes} min · {quiz.questions.length} questions
            </Text>
          </View>
          {quiz.questions.map((question, index) => (
            <QuestionCard
              key={`${index}-${question.prompt}`}
              question={question}
              index={index}
              selected={answers[index]}
              showAnswer={Boolean(result)}
              onSelect={(answer) => setAnswers((current) => ({ ...current, [index]: answer }))}
            />
          ))}
          {result ? (
            <View style={[styles.resultCard, { backgroundColor: colors.accent }]}>
              <Feather name="award" size={24} color={colors.accentForeground} />
              <Text style={[styles.resultTitle, { color: colors.accentForeground }]}>
                {result.score} of {result.total} correct
              </Text>
              <Text style={[styles.resultNote, { color: colors.accentForeground }]}>
                {focusLosses} app focus changes recorded for assessment integrity. This practice score is not a hiring decision.
              </Text>
              <PrimaryButton label="Done" icon="check" tone="light" onPress={() => router.back()} />
            </View>
          ) : (
            <PrimaryButton
              label={`Submit answers · ${Object.keys(answers).length}/${quiz.questions.length}`}
              icon="check"
              disabled={Object.keys(answers).length < quiz.questions.length}
              onPress={finish}
            />
          )}
        </View>
      )}

      {message ? <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text> : null}
    </Screen>
  );
}

function Meta({ icon, label }: { icon: 'list' | 'clock'; label: string }) {
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={13} color="#F0A895" />
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function QuestionCard({
  question,
  index,
  selected,
  showAnswer,
  onSelect,
}: {
  question: AssessmentQuestion;
  index: number;
  selected?: string;
  showAnswer: boolean;
  onSelect: (answer: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.questionTop}>
        <Text style={[styles.questionNumber, { color: colors.primary }]}>
          QUESTION {String(index + 1).padStart(2, '0')}
        </Text>
        <Text style={[styles.difficulty, { color: colors.mutedForeground }]}>{question.difficulty}</Text>
      </View>
      <Text style={[styles.questionPrompt, { color: colors.foreground }]}>{question.prompt}</Text>
      <View style={styles.optionList}>
        {question.options.map((option, optionIndex) => {
          const isSelected = selected === option;
          const isCorrect = showAnswer && option === question.correctAnswer;
          const backgroundColor = isCorrect
            ? colors.accent
            : isSelected
              ? colors.secondary
              : colors.card;
          const borderColor = isCorrect ? colors.accent : isSelected ? colors.primary : colors.border;
          return (
            <Pressable
              key={option}
              disabled={showAnswer}
              onPress={() => onSelect(option)}
              style={[styles.option, { backgroundColor, borderColor }]}
            >
              <View style={[styles.optionLetter, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.optionLetterText, { color: colors.secondaryForeground }]}>
                  {String.fromCharCode(65 + optionIndex)}
                </Text>
              </View>
              <Text style={[styles.optionText, { color: colors.foreground }]}>{option}</Text>
              {isCorrect ? <Feather name="check" size={15} color={colors.accentForeground} /> : null}
            </Pressable>
          );
        })}
      </View>
      {showAnswer ? (
        <Text style={[styles.explanation, { color: colors.mutedForeground }]}>{question.explanation}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  startCard: { borderRadius: 27, padding: 21, gap: 15 },
  sparkle: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#36483E' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 35, letterSpacing: -0.9 },
  heroCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, opacity: 0.74 },
  typeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, opacity: 0.84 },
  typeOptions: { flexDirection: 'row', gap: 8 },
  metaRow: { flexDirection: 'row', gap: 17, marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabel: { color: '#E7E5DC', fontFamily: 'Inter_500Medium', fontSize: 10 },
  quizWrap: { gap: 16 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.8, marginTop: 5 },
  quizSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 6 },
  questionCard: { borderWidth: 1, borderRadius: 20, padding: 15, gap: 13 },
  questionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionNumber: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  difficulty: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  questionPrompt: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 21 },
  optionList: { gap: 7 },
  option: { borderWidth: 1, borderRadius: 13, minHeight: 44, paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  optionLetter: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  optionText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  explanation: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  resultCard: { borderRadius: 19, padding: 18, alignItems: 'center', gap: 10 },
  resultTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  resultNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 11, textAlign: 'center' },
});
