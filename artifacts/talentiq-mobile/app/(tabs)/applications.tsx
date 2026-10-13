import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Avatar,
  Card,
  EmptyState,
  Eyebrow,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { ApplicationStatus, sampleCandidates } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

const statusColors: Record<ApplicationStatus, 'primary' | 'accent' | 'muted' | 'destructive'> = {
  Applied: 'primary',
  Shortlisted: 'accent',
  Interview: 'accent',
  Offer: 'primary',
  Rejected: 'destructive',
};

export default function ApplicationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { role, applications, jobs, attempts, candidateStatuses, setCandidateStatus } = useTalentIQ();

  if (role === 'recruiter') {
    return (
      <Screen>
        <View style={styles.heading}>
          <Eyebrow>PEOPLE, NOT PROFILES</Eyebrow>
          <Text style={[styles.title, { color: colors.foreground }]}>Candidate pipeline</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            A sample shortlist, ranked by role skills and experience.
          </Text>
        </View>
        <View style={styles.pipelineMetrics}>
          <PipelineMetric label="In review" value={String(sampleCandidates.filter((candidate) => candidateStatuses[candidate.name] === 'Shortlisted').length).padStart(2, '0')} />
          <PipelineMetric label="Interview" value={String(sampleCandidates.filter((candidate) => candidateStatuses[candidate.name] === 'Interview').length).padStart(2, '0')} />
          <PipelineMetric label="New today" value={String(sampleCandidates.filter((candidate) => candidateStatuses[candidate.name] === 'Applied').length).padStart(2, '0')} />
        </View>
        <SectionTitle title="Recommended" action="Sort: best fit" />
        {sampleCandidates.map((candidate, index) => (
          <Card key={candidate.name} style={styles.candidateCard}>
            <View style={styles.candidateTop}>
              <Avatar initials={candidate.initials} size={48} />
              <View style={styles.candidateMain}>
                <Text style={[styles.candidateName, { color: colors.foreground }]}>{candidate.name}</Text>
                <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>
                  {candidate.title} · {candidate.experience}
                </Text>
              </View>
              <View style={[styles.matchTag, { backgroundColor: colors.accent }]}>
                <Feather name="zap" size={10} color={colors.accentForeground} />
                <Text style={[styles.matchText, { color: colors.accentForeground }]}>{candidate.score}%</Text>
              </View>
            </View>
            <View style={styles.candidateSkills}>
              {candidate.skills.map((skill) => (
                <View key={skill} style={[styles.skill, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.skillText, { color: colors.secondaryForeground }]}>{skill}</Text>
                </View>
              ))}
            </View>
            <View style={styles.stageRow}>
              <StatusPill status={candidateStatuses[candidate.name] ?? 'Applied'} />
              <Pressable
                onPress={() => {
                  const status = candidateStatuses[candidate.name] ?? 'Applied';
                  const nextStatus: ApplicationStatus =
                    status === 'Applied'
                      ? 'Shortlisted'
                      : status === 'Shortlisted'
                        ? 'Interview'
                        : status === 'Interview'
                          ? 'Offer'
                          : status === 'Offer'
                            ? 'Rejected'
                            : 'Applied';
                  setCandidateStatus(candidate.name, nextStatus);
                }}
                style={[styles.stageButton, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.stageButtonText, { color: colors.secondaryForeground }]}>
                  Move to next stage
                </Text>
                <Feather name="arrow-right" size={12} color={colors.secondaryForeground} />
              </Pressable>
            </View>
            <View style={[styles.reviewRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>
                {index === 0 ? 'Strong match · assessment complete' : 'Skills align · ready to review'}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/jobs')}>
                <Text style={[styles.reviewLink, { color: colors.primary }]}>Review</Text>
              </Pressable>
            </View>
          </Card>
        ))}
        <View style={[styles.sampleNotice, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.sampleText, { color: colors.mutedForeground }]}>
            These are sample candidate profiles for the preview workspace.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Eyebrow>YOUR MOMENTUM</Eyebrow>
        <Text style={[styles.title, { color: colors.foreground }]}>Activity</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          A clear view of the steps you’ve taken.
        </Text>
      </View>
      <View style={styles.pipelineMetrics}>
        <PipelineMetric label="Applications" value={String(applications.length).padStart(2, '0')} />
        <PipelineMetric label="Assessments" value={String(attempts.length).padStart(2, '0')} />
        <PipelineMetric label="Interviews" value="00" />
      </View>
      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon="send"
            title="Your next step starts here"
            body="Save a role that speaks to you and apply when you’re ready. You’ll find every application here."
          />
          <PrimaryButton label="Explore open roles" icon="arrow-right" onPress={() => router.push('/(tabs)/jobs')} />
        </Card>
      ) : (
        <View style={styles.list}>
          <SectionTitle title="Applications" />
          {applications.map((application) => {
            const job = jobs.find((item) => item.id === application.jobId);
            if (!job) return null;
            return (
              <Pressable key={application.id} onPress={() => router.push(`/job/${job.id}`)}>
                <Card style={styles.applicationCard}>
                  <View style={styles.applicationHeader}>
                    <View style={[styles.companyIcon, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.companyInitial, { color: colors.accentForeground }]}>
                        {job.company.slice(0, 1)}
                      </Text>
                    </View>
                    <View style={styles.applicationDetails}>
                      <Text style={[styles.applicationTitle, { color: colors.foreground }]}>{job.title}</Text>
                      <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>{job.company}</Text>
                    </View>
                    <StatusPill status={application.status} />
                  </View>
                  <View style={[styles.reviewRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>
                      Applied {new Date(application.appliedAt).toLocaleDateString()}
                    </Text>
                    <Feather name="arrow-up-right" size={16} color={colors.primary} />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
      {attempts.length > 0 ? (
        <View style={styles.list}>
          <SectionTitle title="Recent assessments" />
          {attempts.slice(0, 3).map((attempt) => {
            const job = jobs.find((item) => item.id === attempt.jobId);
            return (
              <Card key={attempt.id} style={styles.attemptRow}>
                <View style={[styles.attemptIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="check" size={16} color={colors.accentForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.applicationTitle, { color: colors.foreground }]}>{job?.title ?? 'Role assessment'}</Text>
                  <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>
                    {attempt.score}/{attempt.total} correct · {attempt.focusLosses} focus changes logged
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const colors = useColors();
  const colorKey = statusColors[status];
  const backgroundColor =
    colorKey === 'accent'
      ? colors.accent
      : colorKey === 'destructive'
        ? colors.muted
        : colors.secondary;
  const foregroundColor = colorKey === 'accent' ? colors.accentForeground : colors.secondaryForeground;
  return (
    <View style={[styles.statusPill, { backgroundColor }]}>
      <Text style={[styles.statusText, { color: foregroundColor }]}>{status}</Text>
    </View>
  );
}

function PipelineMetric({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.pipelineMetric, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.pipelineValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.pipelineLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -1 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  pipelineMetrics: { flexDirection: 'row', gap: 9 },
  pipelineMetric: { flex: 1, borderWidth: 1, borderRadius: 17, padding: 12, gap: 4 },
  pipelineValue: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  pipelineLabel: { fontFamily: 'Inter_400Regular', fontSize: 9 },
  candidateCard: { gap: 13 },
  candidateTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  candidateMain: { flex: 1, gap: 4 },
  candidateName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  candidateSub: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  matchTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999 },
  matchText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  candidateSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stageButton: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  skill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  skillText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  reviewRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  reviewLink: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  sampleNotice: { borderRadius: 14, flexDirection: 'row', gap: 8, padding: 12 },
  sampleText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  list: { gap: 13 },
  applicationCard: { gap: 12, padding: 14 },
  applicationHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  companyIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  companyInitial: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  applicationDetails: { flex: 1, gap: 4 },
  applicationTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  attemptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  attemptIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
