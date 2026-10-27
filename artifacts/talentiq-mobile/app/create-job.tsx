import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, Field, PrimaryButton, Screen } from '@/components/ui';
import { Job } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

const modes: Job['workMode'][] = ['Remote', 'Hybrid', 'On-site'];

export default function CreateJobScreen() {
  const colors = useColors();
  const router = useRouter();
  const { addJob } = useTalentIQ();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [workMode, setWorkMode] = useState<Job['workMode']>('Remote');
  const [requireAssessment, setRequireAssessment] = useState(true);
  const [minPassingScore, setMinPassingScore] = useState<number>(75);
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/jobs');
    }
  };

  const publish = () => {
    if (!title.trim() || !company.trim() || !location.trim() || !description.trim()) {
      Alert.alert('Add the role details', 'Title, company, location, and description are required.');
      return;
    }
    setSubmitting(true);
    const job: Job = {
      id: `job-${Date.now()}`,
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      workMode,
      employment: 'Full-time',
      salary: salary.trim() || 'Compensation discussed',
      posted: 'Just now',
      description: description.trim(),
      skills: skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 12),
      color: '#DCEBE3',
      assessmentRequired: requireAssessment,
      assessmentMinScore: minPassingScore,
    };
    addJob(job);
    setSubmitting(false);
    router.replace('/(tabs)/jobs');
  };

  return (
    <Screen>
      <Pressable onPress={handleBack} style={styles.back}>
        <Feather name="arrow-left" size={18} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
      </Pressable>
      <View style={styles.intro}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>BUILD YOUR SHORTLIST</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Create a role</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Add a clear, thoughtful description. Your role will appear in this device’s recruiter workspace.
        </Text>
      </View>
      <Field label="Role title" value={title} onChangeText={setTitle} placeholder="e.g. Senior Product Designer" />
      <Field label="Company" value={company} onChangeText={setCompany} placeholder="Company name" />
      <Field label="Location" value={location} onChangeText={setLocation} placeholder="City or Remote" />
      <Field label="Salary range" value={salary} onChangeText={setSalary} placeholder="e.g. $140k – $180k" />
      <View style={styles.modeBlock}>
        <Text style={[styles.label, { color: colors.foreground }]}>Work arrangement</Text>
        <View style={styles.modes}>
          {modes.map((mode) => (
            <Chip key={mode} label={mode} selected={workMode === mode} onPress={() => setWorkMode(mode)} />
          ))}
        </View>
      </View>
      <Field
        label="Required skills"
        value={skills}
        onChangeText={setSkills}
        placeholder="Figma, research, design systems"
      />
      <Field
        label="Role description"
        value={description}
        onChangeText={setDescription}
        placeholder="Share what this person will work on and how they’ll make an impact."
        multiline
      />

      {/* AI Assessment Configuration */}
      <View style={[styles.assessmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => setRequireAssessment((prev) => !prev)}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: requireAssessment ? colors.primary : colors.card,
                borderColor: requireAssessment ? colors.primary : colors.border,
              },
            ]}
          >
            {requireAssessment && <Feather name="check" size={12} color={colors.primaryForeground} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={[styles.configTitle, { color: colors.foreground }]}>
                Require AI Skill Check
              </Text>
            </View>
            <Text style={[styles.configSubtitle, { color: colors.mutedForeground }]}>
              Candidates complete a 5-question proctored skill check on application.
            </Text>
          </View>
        </Pressable>

        {requireAssessment && (
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreLabel, { color: colors.foreground }]}>
              Minimum Target Score:
            </Text>
            <View style={styles.scoreChips}>
              {[60, 75, 85].map((score) => (
                <Chip
                  key={score}
                  label={`${score}%`}
                  selected={minPassingScore === score}
                  onPress={() => setMinPassingScore(score)}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={[styles.tip, { backgroundColor: colors.secondary }]}>
        <Feather name="shield" size={15} color={colors.primary} />
        <Text style={[styles.tipText, { color: colors.secondaryForeground }]}>
          Candidates with verified AI assessments receive priority ranking in the pipeline.
        </Text>
      </View>
      <PrimaryButton label="Publish role" icon="arrow-up-right" loading={submitting} onPress={publish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  intro: { gap: 8, marginTop: 5 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.05 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  modeBlock: { gap: 9 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tip: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 14 },
  tipText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  assessmentCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginVertical: 4,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  configTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  configSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16 },
  scoreRow: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  scoreLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5 },
  scoreChips: { flexDirection: 'row', gap: 8 },
});
