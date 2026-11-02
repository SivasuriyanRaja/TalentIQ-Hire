import { Job, WorldRegion } from '@/data/talentiq';

export interface RegionOption {
  id: WorldRegion;
  label: string;
  flag: string;
  currencySymbol: string;
  currencyCode: string;
  unitLabel: string;
  summary: string;
}

export const REGION_OPTIONS: RegionOption[] = [
  {
    id: 'India',
    label: 'India',
    flag: '🇮🇳',
    currencySymbol: '₹',
    currencyCode: 'INR',
    unitLabel: 'LPA',
    summary: 'Compensation in Rupees (₹ LPA) · Indian tech giants & startups',
  },
  {
    id: 'US',
    label: 'United States',
    flag: '🇺🇸',
    currencySymbol: '$',
    currencyCode: 'USD',
    unitLabel: '/yr',
    summary: 'Compensation in US Dollars ($k/yr) · Silicon Valley & NYC',
  },
  {
    id: 'Europe',
    label: 'Europe / UK',
    flag: '🇪🇺',
    currencySymbol: '€',
    currencyCode: 'EUR',
    unitLabel: '/yr',
    summary: 'Compensation in EUR / GBP · London, Berlin, Amsterdam',
  },
  {
    id: 'Global',
    label: 'Worldwide',
    flag: '🌐',
    currencySymbol: 'All',
    currencyCode: 'GLOBAL',
    unitLabel: 'Local',
    summary: 'All international roles and global remote opportunities',
  },
];

/**
 * Resolves the display salary for a role based on the candidate's active region.
 * When India is selected, always presents in Rupees (Lakhs Per Annum).
 */
export function formatSalaryForRegion(job: Job, targetRegion: WorldRegion): string {
  if (targetRegion === 'India') {
    return job.salaryINR || job.salary;
  }
  if (targetRegion === 'US') {
    return job.salaryUSD || job.salary;
  }
  return job.salary;
}

/**
 * Returns country flag & short location tag
 */
export function getCountryBadge(job: Job): { flag: string; label: string } {
  switch (job.country) {
    case 'India':
      return { flag: '🇮🇳', label: 'India' };
    case 'US':
      return { flag: '🇺🇸', label: 'USA' };
    case 'UK':
      return { flag: '🇬🇧', label: 'UK' };
    case 'Germany':
      return { flag: '🇩🇪', label: 'Germany' };
    case 'Singapore':
      return { flag: '🇸🇬', label: 'Singapore' };
    default:
      return { flag: '🌐', label: 'Global' };
  }
}

/**
 * Filters and prioritizes jobs:
 * When a specific world region is active (e.g. India), roles in that region
 * are strictly prioritized to the top of the feed with localized salary formatting.
 */
export function filterAndPrioritizeJobs({
  jobs,
  region,
  searchQuery = '',
  workModeFilter = 'All',
}: {
  jobs: Job[];
  region: WorldRegion;
  searchQuery?: string;
  workModeFilter?: string;
}): Job[] {
  const query = searchQuery.trim().toLowerCase();

  const filtered = jobs.filter((job) => {
    // Search query matching (title, company, city, skills, department)
    const matchesSearch =
      !query ||
      `${job.title} ${job.company} ${job.location} ${job.country} ${job.skills.join(' ')} ${job.department || ''}`
        .toLowerCase()
        .includes(query);

    // Work mode filtering
    const matchesMode =
      workModeFilter === 'All' ||
      job.workMode.toLowerCase() === workModeFilter.toLowerCase();

    // Region filtering:
    // If Global is selected, all matching jobs are returned.
    // If a specific region is selected (e.g. India), we show roles from that region first,
    // plus remote global roles that hire in that region.
    let matchesRegion = true;
    if (region !== 'Global') {
      matchesRegion =
        job.region === region ||
        (job.workMode === 'Remote' && (job.region === 'Global' || job.region === region));
    }

    return matchesSearch && matchesMode && matchesRegion;
  });

  // Sort: Prioritize exact region matches to the top
  return filtered.sort((a, b) => {
    if (region === 'Global') return 0;
    const aIsPrimary = a.region === region;
    const bIsPrimary = b.region === region;
    if (aIsPrimary && !bIsPrimary) return -1;
    if (!aIsPrimary && bIsPrimary) return 1;
    return 0;
  });
}
