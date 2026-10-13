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
  const [submitting, setSubmitting] = useState(false);

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
    };
    addJob(job);
    setSubmitting(false);
    router.replace('/(tabs)/jobs');
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
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
      <View style={[styles.tip, { backgroundColor: colors.secondary }]}>
        <Feather name="zap" size={15} color={colors.primary} />
        <Text style={[styles.tipText, { color: colors.secondaryForeground }]}>
          Specific skills help TalentIQ create more useful candidate insights.
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
});
