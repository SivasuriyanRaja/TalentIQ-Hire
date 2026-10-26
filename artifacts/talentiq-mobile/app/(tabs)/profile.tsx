import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Avatar, Card, Chip, Field, PrimaryButton, Screen, Wordmark } from '@/components/ui';
import { UserRole } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

// Allowed MIME types for resume upload
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const {
    role,
    setRole,
    profile,
    updateProfile,
    savedJobIds,
    applications,
    storageError,
    syncError,
    isSyncing,
    uploadResume,
    syncNow,
    authUser,
    isUserSignedIn,
    logout,
  } = useTalentIQ();

  const [name, setName] = useState(profile.name);
  const [headline, setHeadline] = useState(profile.headline);
  const [location, setLocation] = useState(profile.location);
  const [years, setYears] = useState(String(profile.yearsExperience));
  const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [education, setEducation] = useState(profile.education);
  const [resumeLink, setResumeLink] = useState(profile.resumeLink);
  const [saved, setSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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
      ...profile,
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

  const pickAndUploadResume = async () => {
    if (!isSignedIn) {
      Alert.alert(
        'Sign in required',
        'Please sign in to upload your resume. It will be stored securely in the cloud.',
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const sizeBytes = asset.size ?? 0;

      if (sizeBytes > 5 * 1024 * 1024) {
        Alert.alert('File too large', 'Resume must be under 5 MB.');
        return;
      }

      setIsUploading(true);
      setUploadSuccess(false);

      await uploadResume(
        asset.uri,
        asset.name ?? 'resume',
        asset.mimeType ?? 'application/pdf',
      );

      setIsUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      setIsUploading(false);
      Alert.alert(
        'Upload failed',
        'Could not upload your resume. Please check your connection and try again.',
      );
    }
  };

  const switchRole = (nextRole: UserRole) => {
    setRole(nextRole);
    router.replace('/(tabs)');
  };

  const displayName = authUser?.name || user?.firstName || profile.name;
  const displayEmail =
    authUser?.email ??
    user?.primaryEmailAddress?.emailAddress ??
    (isUserSignedIn ? 'Signed in account' : 'Preview profile');
  const hasResumeFile = Boolean(profile.resumeFileName);
  const hasExtractedSkills =
    profile.extractedSkills && profile.extractedSkills.length > 0;

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.topRow}>
          <Wordmark />
          {isSyncing && (
            <View style={styles.syncBadge}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.syncText, { color: colors.mutedForeground }]}>
                Syncing…
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.heading, { color: colors.foreground }]}>Your profile</Text>
      </View>

      <Card style={styles.identityCard}>
        <Avatar
          initials={displayName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
          size={62}
        />
        <View style={styles.identityCopy}>
          <Text style={[styles.identityName, { color: colors.foreground }]}>
            {displayName}
          </Text>
          <Text style={[styles.identityMeta, { color: colors.mutedForeground }]}>
            {displayEmail}
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

      {/* ── Resume Upload Section ── */}
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Resume
        </Text>
        <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
          Upload your resume (PDF, DOCX, or TXT · max 5 MB). Skills are automatically
          extracted and added to your profile.
        </Text>

        {/* Uploaded file badge */}
        {hasResumeFile && (
          <View style={[styles.resumeBadge, { backgroundColor: colors.accent }]}>
            <Feather name="file-text" size={15} color={colors.accentForeground} />
            <View style={styles.resumeBadgeInfo}>
              <Text
                style={[styles.resumeFileName, { color: colors.accentForeground }]}
                numberOfLines={1}
              >
                {profile.resumeFileName}
              </Text>
              {profile.resumeFileSizeBytes ? (
                <Text
                  style={[styles.resumeFileMeta, { color: colors.accentForeground }]}
                >
                  {formatBytes(profile.resumeFileSizeBytes)} · Stored securely in cloud
                </Text>
              ) : null}
            </View>
            <Feather name="check-circle" size={15} color={colors.accentForeground} />
          </View>
        )}

        {/* Extracted skills from resume */}
        {hasExtractedSkills && (
          <View style={styles.extractedBlock}>
            <View style={styles.extractedHeader}>
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={[styles.extractedLabel, { color: colors.primary }]}>
                AI-extracted skills
              </Text>
            </View>
            <View style={styles.skillList}>
              {profile.extractedSkills!.map((skill) => (
                <Chip key={skill} label={skill} />
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={[
            styles.uploadButton,
            {
              borderColor: uploadSuccess ? colors.primary : colors.border,
              backgroundColor: uploadSuccess
                ? colors.accent
                : colors.card,
            },
          ]}
          onPress={pickAndUploadResume}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.uploadButtonText, { color: colors.mutedForeground }]}>
                Uploading & extracting skills…
              </Text>
            </>
          ) : uploadSuccess ? (
            <>
              <Feather name="check" size={16} color={colors.primary} />
              <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
                Resume uploaded successfully
              </Text>
            </>
          ) : (
            <>
              <Feather name="upload" size={16} color={colors.foreground} />
              <Text style={[styles.uploadButtonText, { color: colors.foreground }]}>
                {hasResumeFile ? 'Replace resume' : 'Upload resume'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Backwards-compat: portfolio / external link */}
        <Field
          label="Portfolio or resume link (optional)"
          value={resumeLink}
          onChangeText={setResumeLink}
          placeholder="https://your-portfolio.com"
          keyboardType="url"
          autoCapitalize="none"
        />
        {resumeLink.trim() ? (
          <Pressable
            style={styles.externalLink}
            onPress={() => {
              const url = resumeLink.trim();
              if (!/^https?:\/\//i.test(url)) {
                Alert.alert(
                  'Add a full link',
                  'Start your resume or portfolio address with https://.',
                );
                return;
              }
              Linking.openURL(url).catch(() => {
                Alert.alert('Could not open link', 'Check the URL and try again.');
              });
            }}
          >
            <Feather name="external-link" size={14} color={colors.primary} />
            <Text style={[styles.externalLinkText, { color: colors.primary }]}>
              Open portfolio link
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Profile details ── */}
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Your details
        </Text>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
        />
        <Field
          label="Professional headline"
          value={headline}
          onChangeText={setHeadline}
          placeholder="e.g. Product-minded engineer"
        />
        <Field
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="City or region"
        />
        <Field
          label="Years of experience"
          value={years}
          onChangeText={setYears}
          placeholder="4"
          keyboardType="number-pad"
        />
        <Field
          label="Skills, separated by commas"
          value={skillsText}
          onChangeText={setSkillsText}
          placeholder="React, Figma, Product strategy"
          multiline
        />
        <Field
          label="Education"
          value={education}
          onChangeText={setEducation}
          placeholder="Degree, school, or training"
        />

        {profile.skills.length ? (
          <View style={styles.skillList}>
            {profile.skills.map((skill) => (
              <Chip key={skill} label={skill} />
            ))}
          </View>
        ) : null}

        <PrimaryButton
          label={saved ? 'Profile saved' : 'Save profile'}
          icon={saved ? 'check' : 'save'}
          onPress={save}
        />
      </View>

      {/* ── Workspace role switcher ── */}
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Workspace view
        </Text>
        <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>
          Switch between candidate and recruiter sample experiences.
        </Text>
        <View style={styles.roleOptions}>
          <RoleOption
            selected={role === 'candidate'}
            icon="user"
            label="Candidate"
            onPress={() => switchRole('candidate')}
          />
          <RoleOption
            selected={role === 'recruiter'}
            icon="briefcase"
            label="Recruiter"
            onPress={() => switchRole('recruiter')}
          />
        </View>
      </View>

      {/* ── Status notices ── */}
      {syncError ? (
        <View style={[styles.noticeRow, { backgroundColor: colors.muted }]}>
          <Feather name="wifi-off" size={14} color={colors.mutedForeground} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            {syncError}
          </Text>
        </View>
      ) : null}

      <View style={[styles.noticeRow, { backgroundColor: colors.secondary }]}>
        <Feather
          name={isSignedIn ? 'cloud' : 'smartphone'}
          size={15}
          color={colors.secondaryForeground}
        />
        <Text style={[styles.noticeText, { color: colors.secondaryForeground }]}>
          {storageError ||
            (isSignedIn
              ? 'Profile, saved roles, applications, and recruiter stages are synced across your devices.'
              : 'Sign in to sync your profile across devices. Data is stored locally for now.')}
        </Text>
      </View>

      {isSignedIn ? (
        <Pressable
          onPress={() => void syncNow()}
          style={styles.syncNowButton}
          disabled={isSyncing}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.syncNowText, { color: colors.primary }]}>
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Text>
        </Pressable>
      ) : null}

      {isUserSignedIn ? (
        <Pressable onPress={logout} style={styles.signOut}>
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>
            Sign out
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.signOut}
        >
          <Feather name="log-in" size={16} color={colors.primary} />
          <Text style={[styles.signOutText, { color: colors.primary }]}>
            Sign in to your account
          </Text>
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
      <Feather
        name={icon}
        size={15}
        color={selected ? colors.accentForeground : colors.mutedForeground}
      />
      <Text
        style={[
          styles.roleOptionText,
          { color: selected ? colors.accentForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
      {selected ? (
        <Feather name="check" size={14} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
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
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: -7 },
  // Resume upload
  resumeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  resumeBadgeInfo: { flex: 1, gap: 3 },
  resumeFileName: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  resumeFileMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, opacity: 0.8 },
  extractedBlock: { gap: 9 },
  extractedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  extractedLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
  },
  uploadButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 4,
    alignSelf: 'flex-start',
  },
  externalLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  skillList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  switchHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: -7 },
  roleOptions: { flexDirection: 'row', gap: 9 },
  roleOption: {
    minHeight: 43,
    borderRadius: 14,
    paddingHorizontal: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  roleOptionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: 15,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  syncNowButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  syncNowText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  signOut: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
