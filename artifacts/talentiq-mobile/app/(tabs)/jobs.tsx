import React, { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, EmptyState, Eyebrow, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { JobCard as JobItemCard } from '@/components/JobCard';
import { estimateMatch } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

type Filter = 'All' | 'Remote' | 'Hybrid' | 'On-site';

export default function JobsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobs, profile, role, savedJobIds, toggleSavedJob } = useTalentIQ();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const filters: Filter[] = ['All', 'Remote', 'Hybrid', 'On-site'];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !query ||
        `${job.title} ${job.company} ${job.location} ${job.skills.join(' ')}`
          .toLowerCase()
          .includes(query);
      const matchesMode = filter === 'All' || job.workMode === filter;
      return matchesSearch && matchesMode;
    });
  }, [jobs, search, filter]);

  return (
    <Screen>
      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <Eyebrow>{role === 'recruiter' ? 'YOUR OPEN ROLES' : 'THE RIGHT NEXT STEP'}</Eyebrow>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {role === 'recruiter' ? 'Your roles' : 'Find your fit'}
          </Text>
        </View>
        {role === 'recruiter' ? (
          <Pressable
            onPress={() => router.push('/create-job')}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={19} color={colors.primaryForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={role === 'recruiter' ? 'Search your roles' : 'Role, company, or skill'}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.searchInput,
            { color: colors.foreground },
            Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' } as any),
          ]}
          returnKeyType="search"
          accessibilityLabel="Search jobs"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search">
            <Feather name="x-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {role === 'candidate' ? (
        <>
          <View style={styles.filters}>
            {filters.map((item) => (
              <Chip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />
            ))}
          </View>
          <View style={styles.introRow}>
            <SectionTitle title={`${filtered.length} roles to explore`} />
            <Text style={[styles.sortText, { color: colors.mutedForeground }]}>For you</Text>
          </View>
        </>
      ) : (
        <View style={styles.recruiterIntro}>
          <Text style={[styles.recruiterNote, { color: colors.mutedForeground }]}>
            {jobs.length} roles in this sample workspace
          </Text>
          <PrimaryButton label="Create a role" icon="plus" onPress={() => router.push('/create-job')} />
        </View>
      )}

      {filtered.length ? (
        filtered.map((job) => (
          <JobItemCard
            key={job.id}
            job={job}
            matchScore={role === 'candidate' ? estimateMatch(job, profile.skills) : undefined}
            saved={savedJobIds.includes(job.id)}
            onToggleSaved={() => toggleSavedJob(job.id)}
            onPress={() => router.push(`/job/${job.id}`)}
          />
        ))
      ) : (
        <EmptyState
          icon="search"
          title="No roles found"
          body="Try a different search or clear your filters to see more opportunities."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { gap: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -1 },
  addButton: { width: 43, height: 43, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  search: { height: 51, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' } as any)
      : {}),
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  recruiterIntro: { gap: 12 },
  recruiterNote: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
