import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, Chip, Field, PrimaryButton, Screen, Wordmark } from '@/components/ui';
import { UserRole } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { role, setRole, profile, updateProfile, savedJobIds, applications, storageError } = useTalentIQ();
  const [name, setName] = useState(profile.name);
  const [headline, setHeadline] = useState(profile.headline);
  const [location, setLocation] = useState(profile.location);
  const [years, setYears] = useState(String(profile.yearsExperience));
  const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [education, setEducation] = useState(profile.education);
  const [resumeLink, setResumeLink] = useState(profile.resumeLink);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setHeadline(profile.headline);
    setLocation(profile.location);
    setYears(String(profile.yearsExperience));
    setSkillsText(profile.skills.join(', '));
    setEducation(profile.education);
    setResumeLink(profile.resumeLink);
  }, [profile]);

  const save = () => {
    const skillList = skillsText
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 16);
    updateProfile({
      name: name.trim() || profile.name,
      headline: headline.trim(),
      location: location.trim(),
      yearsExperience: Math.min(60, Math.max(0, Number(years) || 0)),
      skills: skillList,
      education: education.trim(),
      resumeLink: resumeLink.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const switchRole = (nextRole: UserRole) => {
    setRole(nextRole);
    router.replace('/(tabs)');
  };

  const logout = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch {
      Alert.alert('Could not sign out', 'Please check your connection and try again.');
    }
  };

  const displayName = user?.firstName || profile.name;

  return (
    <Screen>
      <View style={styles.top}>
        <Wordmark />
        <Text style={[styles.heading, { color: colors.foreground }]}>Your profile</Text>
      </View>

      <Card style={styles.identityCard}>
        <Avatar initials={displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()} size={62} />
        <View style={styles.identityCopy}>
          <Text style={[styles.identityName, { color: colors.foreground }]}>{displayName}</Text>
          <Text style={[styles.identityMeta, { color: colors.mutedForeground }]}>
            {user?.primaryEmailAddress?.emailAddress ?? 'Preview profile'}
          </Text>
        </View>
        <View style={[styles.roleTag, { backgroundColor: colors.accent }]}>
          <Text style={[styles.roleText, { color: colors.accentForeground }]}>
            {role === 'candidate' ? 'Candidate' : 'Recruiter'}
          </Text>
        </View>
      </Card>

      <View style={styles.stats}>
        <Stat value={String(savedJobIds.length).padStart(2, '0')} label="Saved" />
        <Stat value={String(applications.length).padStart(2, '0')} label="Applied" />
        <Stat value={String(profile.skills.length).padStart(2, '0')} label="Skills" />
      </View>

      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your details</Text>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
        <Field label="Professional headline" value={headline} onChangeText={setHeadline} placeholder="e.g. Product-minded engineer" />
        <Field label="Location" value={location} onChangeText={setLocation} placeholder="City or region" />
        <Field label="Years of experience" value={years} onChangeText={setYears} placeholder="4" keyboardType="number-pad" />
        <Field label="Skills, separated by commas" value={skillsText} onChangeText={setSkillsText} placeholder="React, Figma, Product strategy" multiline />
        <Field label="Education" value={education} onChangeText={setEducation} placeholder="Degree, school, or training" />
        <Field
          label="Resume or portfolio link"
          value={resumeLink}
          onChangeText={setResumeLink}
          placeholder="https://your-portfolio.com"
          keyboardType="url"
          autoCapitalize="none"
        />
        {resumeLink.trim() ? (
          <Pressable
            style={styles.resumeLink}
            onPress={() => {
              const url = resumeLink.trim();
              if (!/^https?:\/\//i.test(url)) {
                Alert.alert('Add a full link', 'Start your resume or portfolio address with https://.');
                return;
              }
              Linking.openURL(url).catch(() => {
                Alert.alert('Could not open link', 'Check the URL and try again.');
              });
            }}
          >
            <Feather name="external-link" size={14} color={colors.primary} />
            <Text style={[styles.resumeLinkText, { color: colors.primary }]}>Open resume or portfolio</Text>
          </Pressable>
        ) : null}
        {profile.skills.length ? (
          <View style={styles.skillList}>
            {profile.skills.map((skill) => <Chip key={skill} label={skill} />)}
          </View>
        ) : null}
        <PrimaryButton label={saved ? 'Profile saved' : 'Save profile'} icon={saved ? 'check' : 'save'} onPress={save} />
      </View>

      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Workspace view</Text>
        <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>
          Switch between candidate and recruiter sample experiences.
        </Text>
        <View style={styles.roleOptions}>
          <RoleOption selected={role === 'candidate'} icon="user" label="Candidate" onPress={() => switchRole('candidate')} />
          <RoleOption selected={role === 'recruiter'} icon="briefcase" label="Recruiter" onPress={() => switchRole('recruiter')} />
        </View>
      </View>

      <View style={[styles.localNotice, { backgroundColor: colors.secondary }]}>
        <Feather name="smartphone" size={15} color={colors.secondaryForeground} />
        <Text style={[styles.noticeText, { color: colors.secondaryForeground }]}>
          {storageError || 'Profile, saved roles, and applications are stored on this device in this preview.'}
        </Text>
      </View>

      {isSignedIn ? (
        <Pressable onPress={logout} style={styles.signOut}>
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/(auth)/sign-in')} style={styles.signOut}>
          <Feather name="log-in" size={16} color={colors.primary} />
          <Text style={[styles.signOutText, { color: colors.primary }]}>Sign in to your account</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function RoleOption({
  selected,
  icon,
  label,
  onPress,
}: {
  selected: boolean;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.roleOption,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.accent : colors.card,
        },
      ]}
    >
      <Feather name={icon} size={15} color={selected ? colors.accentForeground : colors.mutedForeground} />
      <Text style={[styles.roleOptionText, { color: selected ? colors.accentForeground : colors.foreground }]}>
        {label}
      </Text>
      {selected ? <Feather name="check" size={14} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { gap: 18 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -1 },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  identityCopy: { flex: 1, gap: 5 },
  identityName: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  identityMeta: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  roleTag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7 },
  roleText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 5 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  block: { gap: 14 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  skillList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  resumeLink: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 4, alignSelf: 'flex-start' },
  resumeLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  switchHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: -7 },
  roleOptions: { flexDirection: 'row', gap: 9 },
  roleOption: { minHeight: 43, borderRadius: 14, paddingHorizontal: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleOptionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  localNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 15 },
  noticeText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  signOut: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
