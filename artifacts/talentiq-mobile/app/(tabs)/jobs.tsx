import React, { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, EmptyState, Eyebrow, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { JobCard as JobItemCard } from '@/components/JobCard';
import { estimateMatch, WorldRegion } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';
import { REGION_OPTIONS, filterAndPrioritizeJobs } from '@/utils/regionUtils';

type WorkModeFilter = 'All' | 'Remote' | 'Hybrid' | 'On-site';

export default function JobsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobs, profile, role, savedJobIds, toggleSavedJob, worldRegion, setWorldRegion } = useTalentIQ();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WorkModeFilter>('All');
  const filters: WorkModeFilter[] = ['All', 'Remote', 'Hybrid', 'On-site'];

  const filtered = useMemo(() => {
    return filterAndPrioritizeJobs({
      jobs,
      region: worldRegion || 'India',
      searchQuery: search,
      workModeFilter: filter,
    });
  }, [jobs, worldRegion, search, filter]);

  const activeRegionConfig = useMemo(() => {
    return REGION_OPTIONS.find((r) => r.id === (worldRegion || 'India')) || REGION_OPTIONS[0];
  }, [worldRegion]);

  return (
    <Screen>
      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <Eyebrow>{role === 'recruiter' ? 'YOUR OPEN ROLES' : 'THE RIGHT NEXT STEP'}</Eyebrow>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {role === 'recruiter' ? 'Your roles' : 'Discover Roles'}
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

      {/* ── Global Region Selector ── */}
      <View style={styles.regionSection}>
        <View style={styles.regionHeader}>
          <View style={styles.regionTitleRow}>
            <Feather name="globe" size={14} color={colors.primary} />
            <Text style={[styles.regionLabel, { color: colors.mutedForeground }]}>
              TARGET REGION & CURRENCY:
            </Text>
          </View>
          <Text style={[styles.regionActiveBadge, { color: colors.primary }]}>
            {activeRegionConfig.flag} {activeRegionConfig.currencySymbol} {activeRegionConfig.unitLabel}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionPillsScroll}
        >
          {REGION_OPTIONS.map((opt) => {
            const isSelected = (worldRegion || 'India') === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setWorldRegion(opt.id)}
                style={({ pressed }) => [
                  styles.regionPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={styles.regionPillFlag}>{opt.flag}</Text>
                <Text
                  style={[
                    styles.regionPillText,
                    {
                      color: isSelected ? colors.primaryForeground : colors.foreground,
                      fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_500Medium',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                <View
                  style={[
                    styles.currencyTag,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(255, 255, 255, 0.22)'
                        : colors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyTagText,
                      {
                        color: isSelected ? colors.primaryForeground : colors.secondaryForeground,
                      },
                    ]}
                  >
                    {opt.currencySymbol}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.regionBanner,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Text style={styles.bannerFlag}>{activeRegionConfig.flag}</Text>
          <Text style={[styles.bannerText, { color: colors.secondaryForeground }]}>
            {activeRegionConfig.summary}
          </Text>
        </View>
      </View>

      {/* ── Search Input ── */}
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            role === 'recruiter'
              ? 'Search your open roles'
              : `Role, company, skill (e.g. React, Razorpay, Bengaluru)`
          }
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
            <SectionTitle title={`${filtered.length} active roles`} />
            <Text style={[styles.sortText, { color: colors.mutedForeground }]}>
              Prioritizing {activeRegionConfig.label}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.recruiterIntro}>
          <Text style={[styles.recruiterNote, { color: colors.mutedForeground }]}>
            {jobs.length} roles available across global & Indian tech pipelines
          </Text>
          <PrimaryButton label="Create a role" icon="plus" onPress={() => router.push('/create-job')} />
        </View>
      )}

      {/* ── Job Cards List ── */}
      {filtered.length ? (
        filtered.map((job) => (
          <JobItemCard
            key={job.id}
            job={job}
            targetRegion={worldRegion || 'India'}
            matchScore={role === 'candidate' ? estimateMatch(job, profile.skills) : undefined}
            saved={savedJobIds.includes(job.id)}
            onToggleSaved={() => toggleSavedJob(job.id)}
            onPress={() => router.push(`/job/${job.id}`)}
          />
        ))
      ) : (
        <EmptyState
          icon="search"
          title="No roles match your filter"
          body="Try switching world region or clearing your search criteria to discover more opportunities."
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
  regionSection: { gap: 10, marginVertical: 4 },
  regionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  regionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  regionLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 },
  regionActiveBadge: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  regionPillsScroll: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  regionPillFlag: { fontSize: 14 },
  regionPillText: { fontSize: 12 },
  currencyTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  currencyTagText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  regionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerFlag: { fontSize: 15 },
  bannerText: { fontFamily: 'Inter_500Medium', fontSize: 11, flex: 1, lineHeight: 16 },
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
