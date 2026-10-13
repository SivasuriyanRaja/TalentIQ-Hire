import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Job } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { Card, IconButton } from '@/components/ui';

export function JobCard({
  job,
  matchScore,
  saved,
  onPress,
  onToggleSaved,
  compact = false,
}: {
  job: Job;
  matchScore?: number;
  saved?: boolean;
  onPress: () => void;
  onToggleSaved?: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card style={[styles.card, { opacity: pressed ? 0.85 : 1 }]}>
          <View style={styles.top}>
            <View style={[styles.companyMark, { backgroundColor: colors.accent }]}>
              <Text style={[styles.companyInitial, { color: colors.accentForeground }]}>
                {job.company.slice(0, 1)}
              </Text>
            </View>
            <View style={styles.companyBlock}>
              <Text style={[styles.company, { color: colors.mutedForeground }]}>{job.company}</Text>
              <Text style={[styles.posted, { color: colors.mutedForeground }]}>{job.posted}</Text>
            </View>
            {onToggleSaved ? (
              <View onStartShouldSetResponder={() => true}>
                <IconButton
                  icon={saved ? 'bookmark' : 'bookmark'}
                  accessibilityLabel={saved ? 'Remove saved job' : 'Save job'}
                  onPress={onToggleSaved}
                  color={saved ? colors.primary : colors.mutedForeground}
                />
              </View>
            ) : null}
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{job.title}</Text>
          <View style={styles.details}>
            <Detail icon="map-pin" label={job.location} />
            <Detail icon="briefcase" label={job.workMode} />
          </View>
          {!compact ? (
            <View style={styles.skills}>
              {job.skills.slice(0, 3).map((skill) => (
                <View key={skill} style={[styles.skillChip, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.skill, { color: colors.secondaryForeground }]}>{skill}</Text>
                </View>
              ))}
              {job.skills.length > 3 ? (
                <Text style={[styles.moreSkills, { color: colors.mutedForeground }]}>
                  +{job.skills.length - 3}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.bottom, { borderTopColor: colors.border }]}>
            <Text style={[styles.salary, { color: colors.foreground }]}>{job.salary}</Text>
            {matchScore ? (
              <View style={[styles.score, { backgroundColor: colors.accent }]}>
                <Feather name="zap" size={11} color={colors.accentForeground} />
                <Text style={[styles.scoreText, { color: colors.accentForeground }]}>{matchScore}% fit</Text>
              </View>
            ) : (
              <Feather name="arrow-up-right" size={17} color={colors.primary} />
            )}
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function Detail({ icon, label }: { icon: 'map-pin' | 'briefcase'; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.detail}>
      <Feather name={icon} size={12} color={colors.mutedForeground} />
      <Text style={[styles.detailText, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 13, padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  companyMark: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  companyInitial: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  companyBlock: { flex: 1, gap: 2 },
  company: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  posted: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.25 },
  details: { flexDirection: 'row', gap: 13 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  detailText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  skills: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  skillChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  skill: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  moreSkills: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  salary: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  score: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999 },
  scoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
