import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [selectedCandidate, setSelectedCandidate] = useState<typeof sampleCandidates[0] | null>(null);
  const [assignedStatus, setAssignedStatus] = useState<Record<string, boolean>>({});

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Feather name="zap" size={13} color={colors.primary} />
                <Text style={[styles.candidateSub, { color: colors.foreground }]}>
                  {index === 0
                    ? 'AI Assessment: 5/5 (100% · High Trust)'
                    : index === 1
                      ? 'AI Assessment: 4/5 (80% · Verified)'
                      : assignedStatus[candidate.name]
                        ? 'AI Assessment: Assigned (Pending)'
                        : 'Skill check: Not yet taken'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (index <= 1) {
                    setSelectedCandidate(candidate);
                  } else if (!assignedStatus[candidate.name]) {
                    setAssignedStatus((prev) => ({ ...prev, [candidate.name]: true }));
                    Alert.alert(
                      'Assessment Assigned',
                      `An automated 5-question AI Skill Check has been assigned to ${candidate.name}.`,
                    );
                  } else {
                    Alert.alert('Status', `${candidate.name} has a pending assessment check.`);
                  }
                }}
              >
                <Text style={[styles.reviewLink, { color: colors.primary }]}>
                  {index <= 1 ? 'View Report' : assignedStatus[candidate.name] ? 'Pending' : 'Assign Check'}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {/* Candidate AI Assessment Review Modal */}
        <Modal visible={Boolean(selectedCandidate)} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Avatar initials={selectedCandidate?.initials ?? 'CA'} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalCandidateName, { color: colors.foreground }]}>
                    {selectedCandidate?.name}
                  </Text>
                  <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>
                    {selectedCandidate?.title} · {selectedCandidate?.experience}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedCandidate(null)}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <View style={[styles.modalScoreCard, { backgroundColor: colors.accent }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.modalScoreTitle, { color: colors.accentForeground }]}>
                    AI Verified Skill Check
                  </Text>
                  <Text style={[styles.modalScoreSub, { color: colors.accentForeground }]}>
                    {selectedCandidate?.name === 'Jordan Lee' ? 'Score: 100% · Strong Hire' : 'Score: 80% · Qualified'}
                  </Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Feather name="shield" size={13} color="#FFFFFF" />
                  <Text style={styles.verifiedBadgeText}>ANTI-PROXY 100%</Text>
                </View>
              </View>

              {/* Anti-Proxy Security Clearance Box */}
              <View style={[styles.antiProxyRecruiterBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={styles.antiProxyHeaderMini}>
                  <Feather name="shield" size={14} color="#10B981" />
                  <Text style={[styles.antiProxyHeaderMiniText, { color: colors.foreground }]}>
                    Anti-Proxy Proctoring Audit: Low Risk (Authentic)
                  </Text>
                </View>
                <View style={styles.antiProxyRowMini}>
                  <Text style={[styles.antiProxyStatText, { color: colors.mutedForeground }]}>
                    Focus Switches: <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>0</Text>
                  </Text>
                  <Text style={[styles.antiProxyStatText, { color: colors.mutedForeground }]}>
                    Speed Flags: <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>0</Text>
                  </Text>
                  <Text style={[styles.antiProxyStatText, { color: colors.mutedForeground }]}>
                    Copy Attempts: <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>0</Text>
                  </Text>
                </View>
                <Text style={[styles.proctorNoticeText, { color: colors.mutedForeground, marginTop: 2 }]}>
                  Candidate completed single-window test independently. Anti-Proxy Honor Pledge signed.
                </Text>
              </View>

              <View style={styles.modalSkillsBlock}>
                <Text style={[styles.modalSectionTitle, { color: colors.foreground }]}>
                  Tested Competencies
                </Text>
                {selectedCandidate?.skills.map((skill) => (
                  <View key={skill} style={styles.modalSkillRow}>
                    <Text style={[styles.modalSkillName, { color: colors.foreground }]}>{skill}</Text>
                    <View style={styles.modalSkillBarWrap}>
                      <View style={[styles.modalSkillBarTrack, { backgroundColor: colors.secondary }]}>
                        <View
                          style={[
                            styles.modalSkillBarFill,
                            { backgroundColor: colors.primary, width: selectedCandidate.name === 'Jordan Lee' ? '95%' : '85%' },
                          ]}
                        />
                      </View>
                      <Text style={[styles.modalSkillScore, { color: colors.primary }]}>
                        {selectedCandidate.name === 'Jordan Lee' ? '95%' : '85%'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <PrimaryButton
                label="Done Reviewing"
                icon="check"
                onPress={() => setSelectedCandidate(null)}
              />
            </View>
          </View>
        </Modal>
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
          <SectionTitle title="Your AI Assessments" />
          {attempts.slice(0, 5).map((attempt) => {
            const job = jobs.find((item) => item.id === attempt.jobId);
            const percentage =
              attempt.percentage ?? Math.round((attempt.score / Math.max(1, attempt.total)) * 100);
            const isPassing = percentage >= 70;

            return (
              <Card key={attempt.id} style={styles.attemptRow}>
                <View
                  style={[
                    styles.attemptIcon,
                    { backgroundColor: isPassing ? colors.accent : colors.secondary },
                  ]}
                >
                  <Feather
                    name={isPassing ? 'award' : 'zap'}
                    size={16}
                    color={isPassing ? colors.accentForeground : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.applicationTitle, { color: colors.foreground }]}>
                    {attempt.assessmentTitle ?? job?.title ?? 'Role Skill Assessment'}
                  </Text>
                  <Text style={[styles.candidateSub, { color: colors.mutedForeground }]}>
                    {attempt.score}/{attempt.total} Correct ({percentage}%)
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                    <View
                      style={[
                        styles.miniProxyBadge,
                        {
                          backgroundColor:
                            attempt.proxyRiskLevel === 'HIGH'
                              ? '#FFEBE6'
                              : attempt.proxyRiskLevel === 'MEDIUM'
                                ? '#FEF3C7'
                                : '#D1FAE5',
                        },
                      ]}
                    >
                      <Feather
                        name={attempt.proxyRiskLevel === 'HIGH' ? 'alert-triangle' : 'shield'}
                        size={10}
                        color={
                          attempt.proxyRiskLevel === 'HIGH'
                            ? '#D85D49'
                            : attempt.proxyRiskLevel === 'MEDIUM'
                              ? '#B45309'
                              : '#065F46'
                        }
                      />
                      <Text
                        style={[
                          styles.miniProxyText,
                          {
                            color:
                              attempt.proxyRiskLevel === 'HIGH'
                                ? '#D85D49'
                                : attempt.proxyRiskLevel === 'MEDIUM'
                                  ? '#B45309'
                                  : '#065F46',
                          },
                        ]}
                      >
                        {attempt.proxyRiskLevel === 'HIGH'
                          ? 'HIGH PROXY RISK'
                          : attempt.proxyRiskLevel === 'MEDIUM'
                            ? 'FLAGGED BLURS'
                            : '0-PROXY VERIFIED'}
                      </Text>
                    </View>
                    {attempt.readinessRating ? (
                      <Text style={[styles.attemptRating, { color: colors.primary }]}>
                        {attempt.readinessRating}
                      </Text>
                    ) : null}
                  </View>
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
  attemptRating: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalCandidateName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  modalScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
  },
  modalScoreTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  modalScoreSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    opacity: 0.9,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10B981',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  modalSkillsBlock: {
    gap: 10,
  },
  modalSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 4,
  },
  modalSkillRow: {
    gap: 4,
  },
  modalSkillName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  modalSkillBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalSkillBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  modalSkillBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  modalSkillScore: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    width: 32,
    textAlign: 'right',
  },
  proctorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  proctorNoticeText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  antiProxyRecruiterBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  antiProxyHeaderMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  antiProxyHeaderMiniText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  antiProxyRowMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  antiProxyStatText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
  },
  miniProxyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniProxyText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8.5,
    letterSpacing: 0.4,
  },
});
