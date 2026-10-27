/**
 * useCloudSync.ts
 *
 * Provides helpers to sync profile, applications, saved jobs, and recruiter
 * stages to/from the TalentIQ API server. Supports dynamic API host resolution,
 * Clerk auth tokens, and dev/demo fallback headers.
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@clerk/expo';
import type { Application, ApplicationStatus, CandidateProfile } from '@/data/talentiq';
import { getApiEndpoint } from '@/utils/apiConfig';

type CloudProfilePayload = {
  name: string;
  headline: string;
  location: string;
  yearsExperience: number;
  skills: string[];
  education: string;
  resumeLink: string;
};

type CloudApplicationPayload = {
  jobId: string;
  jobTitle: string;
  company: string;
  status: ApplicationStatus;
  matchScore: number;
  appliedAt: string;
};

async function apiFetch(
  path: string,
  token: string | null | undefined,
  activeUserId?: string | null,
  options: RequestInit = {},
): Promise<Response> {
  const url = getApiEndpoint(path);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': activeUserId || 'user_demo_seeker',
    ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: 'Bearer dev_mock_token' }),
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

export function useCloudSync(activeUserId?: string | null) {
  const { getToken, isSignedIn } = useAuth();
  const canSync = Boolean(isSignedIn || activeUserId);

  // ── Profile ────────────────────────────────────────────────────────────────

  const fetchCloudProfile = useCallback(async (): Promise<CandidateProfile | null> => {
    if (!canSync) return null;
    try {
      const token = await getToken().catch(() => null);
      const res = await apiFetch('/sync/profile', token, activeUserId);
      if (res.status === 404 || !res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      return {
        name: String(data.name ?? ''),
        headline: String(data.headline ?? ''),
        location: String(data.location ?? ''),
        yearsExperience: typeof data.yearsExperience === 'number' ? data.yearsExperience : 0,
        skills: Array.isArray(data.skills)
          ? (data.skills as unknown[]).filter((s): s is string => typeof s === 'string')
          : [],
        education: String(data.education ?? ''),
        resumeLink: String(data.resumeLink ?? ''),
        resumeFileName: typeof data.resumeFileName === 'string' ? data.resumeFileName : undefined,
        resumeFileSizeBytes: typeof data.resumeFileSizeBytes === 'number' ? data.resumeFileSizeBytes : undefined,
        extractedSkills: Array.isArray(data.extractedSkills)
          ? (data.extractedSkills as unknown[]).filter((s): s is string => typeof s === 'string')
          : [],
      };
    } catch {
      return null;
    }
  }, [canSync, getToken, activeUserId]);

  const pushProfile = useCallback(
    async (profile: CandidateProfile): Promise<void> => {
      if (!canSync) return;
      try {
        const token = await getToken().catch(() => null);
        const payload: CloudProfilePayload = {
          name: profile.name,
          headline: profile.headline,
          location: profile.location,
          yearsExperience: profile.yearsExperience,
          skills: profile.skills,
          education: profile.education,
          resumeLink: profile.resumeLink,
        };
        await apiFetch('/sync/profile', token, activeUserId, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch {
        // Non-fatal — local state is preserved
      }
    },
    [canSync, getToken, activeUserId],
  );

  // ── Resume upload ──────────────────────────────────────────────────────────

  /**
   * Upload a resume file to the server.
   * Returns { extractedSkills, resumeFileName, resumeFileSizeBytes } on success.
   */
  const uploadResume = useCallback(
    async (
      fileUri: string,
      fileName: string,
      mimeType: string,
    ): Promise<{
      extractedSkills: string[];
      resumeFileName: string;
      resumeFileSizeBytes: number;
    } | null> => {
      try {
        const token = await getToken().catch(() => null);
        const formData = new FormData();

        if (Platform.OS === 'web') {
          const blobRes = await fetch(fileUri);
          const blob = await blobRes.blob();
          formData.append('resume', blob, fileName);
        } else {
          formData.append('resume', {
            uri: fileUri,
            name: fileName,
            type: mimeType || 'application/pdf',
          } as unknown as Blob);
        }

        const headers: Record<string, string> = {
          'x-user-id': activeUserId || 'user_demo_seeker',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          headers['Authorization'] = 'Bearer dev_mock_token';
        }

        const url = getApiEndpoint('/sync/profile/resume');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn('Resume upload endpoint returned status:', res.status);
          return null;
        }

        const data = (await res.json()) as Record<string, unknown>;
        return {
          extractedSkills: Array.isArray(data.extractedSkills)
            ? (data.extractedSkills as unknown[]).filter((s): s is string => typeof s === 'string')
            : [],
          resumeFileName: String(data.resumeFileName ?? fileName),
          resumeFileSizeBytes:
            typeof data.resumeFileSizeBytes === 'number'
              ? data.resumeFileSizeBytes
              : 0,
        };
      } catch (err) {
        console.warn('uploadResume network/parse error:', err);
        return null;
      }
    },
    [getToken, activeUserId],
  );

  // ── Applications ───────────────────────────────────────────────────────────

  const fetchCloudApplications = useCallback(async (): Promise<Application[]> => {
    if (!canSync) return [];
    try {
      const token = await getToken().catch(() => null);
      const res = await apiFetch('/sync/applications', token, activeUserId);
      if (!res.ok) return [];
      const data = (await res.json()) as unknown[];
      return data
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          id: String(item._id ?? item.jobId ?? Date.now()),
          jobId: String(item.jobId ?? ''),
          status: (item.status as ApplicationStatus) ?? 'Applied',
          appliedAt: String(item.appliedAt ?? new Date().toISOString()),
          matchScore: typeof item.matchScore === 'number' ? item.matchScore : 0,
        }));
    } catch {
      return [];
    }
  }, [canSync, getToken, activeUserId]);

  const pushApplication = useCallback(
    async (
      application: Application,
      jobTitle: string,
      company: string,
    ): Promise<void> => {
      if (!canSync) return;
      try {
        const token = await getToken().catch(() => null);
        const payload: CloudApplicationPayload = {
          jobId: application.jobId,
          jobTitle,
          company,
          status: application.status,
          matchScore: application.matchScore,
          appliedAt: application.appliedAt,
        };
        await apiFetch('/sync/applications', token, activeUserId, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // Non-fatal
      }
    },
    [canSync, getToken, activeUserId],
  );

  const removeApplication = useCallback(
    async (jobId: string): Promise<void> => {
      if (!canSync) return;
      try {
        const token = await getToken().catch(() => null);
        await apiFetch(`/sync/applications/${encodeURIComponent(jobId)}`, token, activeUserId, {
          method: 'DELETE',
        });
      } catch {
        // Non-fatal
      }
    },
    [canSync, getToken, activeUserId],
  );

  // ── Saved Jobs ─────────────────────────────────────────────────────────────

  const fetchCloudSavedJobIds = useCallback(async (): Promise<string[]> => {
    if (!canSync) return [];
    try {
      const token = await getToken().catch(() => null);
      const res = await apiFetch('/sync/saved-jobs', token, activeUserId);
      if (!res.ok) return [];
      const data = (await res.json()) as unknown;
      return Array.isArray(data)
        ? (data as unknown[]).filter((s): s is string => typeof s === 'string')
        : [];
    } catch {
      return [];
    }
  }, [canSync, getToken, activeUserId]);

  const toggleSavedJobCloud = useCallback(
    async (jobId: string): Promise<void> => {
      if (!canSync) return;
      try {
        const token = await getToken().catch(() => null);
        await apiFetch('/sync/saved-jobs', token, activeUserId, {
          method: 'POST',
          body: JSON.stringify({ jobId }),
        });
      } catch {
        // Non-fatal
      }
    },
    [canSync, getToken, activeUserId],
  );

  // ── Recruiter Stages ───────────────────────────────────────────────────────

  const fetchCloudStages = useCallback(async (): Promise<Record<string, ApplicationStatus>> => {
    if (!canSync) return {};
    try {
      const token = await getToken().catch(() => null);
      const res = await apiFetch('/sync/stages', token, activeUserId);
      if (!res.ok) return {};
      const data = (await res.json()) as unknown;
      if (typeof data !== 'object' || data === null) return {};
      const result: Record<string, ApplicationStatus> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v === 'string') result[k] = v as ApplicationStatus;
      }
      return result;
    } catch {
      return {};
    }
  }, [canSync, getToken, activeUserId]);

  const pushStage = useCallback(
    async (candidateName: string, status: ApplicationStatus): Promise<void> => {
      if (!canSync) return;
      try {
        const token = await getToken().catch(() => null);
        await apiFetch(`/sync/stages/${encodeURIComponent(candidateName)}`, token, activeUserId, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        });
      } catch {
        // Non-fatal
      }
    },
    [canSync, getToken, activeUserId],
  );

  // ── Assessment Sync ────────────────────────────────────────────────────────

  const pushAssessmentAttempt = useCallback(
    async (payload: {
      jobId: string;
      jobTitle?: string;
      company?: string;
      candidateName?: string;
      assessmentTitle?: string;
      score: number;
      total: number;
      focusLosses: number;
      timeSpentSeconds?: number;
      feedback?: string;
      skillsBreakdown?: Array<{ skill: string; score: number }>;
      completedAt?: string;
    }): Promise<void> => {
      if (!canSync) return;
      try {
        const token = await getToken().catch(() => null);
        await apiFetch('/sync/assessments', token, activeUserId, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // Non-fatal
      }
    },
    [canSync, getToken, activeUserId],
  );

  const fetchCloudAssessments = useCallback(async (): Promise<any[]> => {
    if (!canSync) return [];
    try {
      const token = await getToken().catch(() => null);
      const res = await apiFetch('/sync/assessments', token, activeUserId);
      if (!res.ok) return [];
      return (await res.json()) as any[];
    } catch {
      return [];
    }
  }, [canSync, getToken, activeUserId]);

  const fetchRecruiterAssessments = useCallback(
    async (jobId?: string): Promise<any[]> => {
      if (!canSync) return [];
      try {
        const token = await getToken().catch(() => null);
        const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
        const res = await apiFetch(`/sync/recruiter/assessments${query}`, token, activeUserId);
        if (!res.ok) return [];
        return (await res.json()) as any[];
      } catch {
        return [];
      }
    },
    [canSync, getToken, activeUserId],
  );

  return {
    fetchCloudProfile,
    pushProfile,
    uploadResume,
    fetchCloudApplications,
    pushApplication,
    removeApplication,
    fetchCloudSavedJobIds,
    toggleSavedJobCloud,
    fetchCloudStages,
    pushStage,
    pushAssessmentAttempt,
    fetchCloudAssessments,
    fetchRecruiterAssessments,
  };
}
