/**
 * useCloudSync.ts
 *
 * Provides helpers to sync profile, applications, saved jobs, and recruiter
 * stages to/from the TalentIQ API server. Falls back gracefully when the user
 * is not signed in or the network is unavailable.
 *
 * Call `syncAll()` on mount after auth is ready, and after any state change
 * you want persisted to the cloud.
 */

import { useCallback } from 'react';
import { useAuth } from '@clerk/expo';
import type { Application, ApplicationStatus, CandidateProfile } from '@/data/talentiq';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '';

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
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export function useCloudSync() {
  const { getToken, isSignedIn } = useAuth();

  // ── Profile ────────────────────────────────────────────────────────────────

  const fetchCloudProfile = useCallback(async (): Promise<CandidateProfile | null> => {
    if (!isSignedIn || !API_BASE) return null;
    try {
      const token = await getToken();
      if (!token) return null;
      const res = await apiFetch('/sync/profile', token);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
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
  }, [isSignedIn, getToken]);

  const pushProfile = useCallback(async (profile: CandidateProfile): Promise<void> => {
    if (!isSignedIn || !API_BASE) return;
    try {
      const token = await getToken();
      if (!token) return;
      const payload: CloudProfilePayload = {
        name: profile.name,
        headline: profile.headline,
        location: profile.location,
        yearsExperience: profile.yearsExperience,
        skills: profile.skills,
        education: profile.education,
        resumeLink: profile.resumeLink,
      };
      await apiFetch('/sync/profile', token, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-fatal — local state is preserved
    }
  }, [isSignedIn, getToken]);

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
      if (!isSignedIn || !API_BASE) return null;
      try {
        const token = await getToken();
        if (!token) return null;

        const formData = new FormData();
        formData.append('resume', {
          uri: fileUri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob);

        const res = await fetch(`${API_BASE}/sync/profile/resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Do NOT set Content-Type here — let fetch set multipart boundary
          },
          body: formData,
        });

        if (!res.ok) return null;
        const data = await res.json() as Record<string, unknown>;
        return {
          extractedSkills: Array.isArray(data.extractedSkills)
            ? (data.extractedSkills as unknown[]).filter((s): s is string => typeof s === 'string')
            : [],
          resumeFileName: String(data.resumeFileName ?? fileName),
          resumeFileSizeBytes: typeof data.resumeFileSizeBytes === 'number'
            ? data.resumeFileSizeBytes
            : 0,
        };
      } catch {
        return null;
      }
    },
    [isSignedIn, getToken],
  );

  // ── Applications ───────────────────────────────────────────────────────────

  const fetchCloudApplications = useCallback(async (): Promise<Application[]> => {
    if (!isSignedIn || !API_BASE) return [];
    try {
      const token = await getToken();
      if (!token) return [];
      const res = await apiFetch('/sync/applications', token);
      if (!res.ok) return [];
      const data = await res.json() as unknown[];
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
  }, [isSignedIn, getToken]);

  const pushApplication = useCallback(
    async (
      application: Application,
      jobTitle: string,
      company: string,
    ): Promise<void> => {
      if (!isSignedIn || !API_BASE) return;
      try {
        const token = await getToken();
        if (!token) return;
        const payload: CloudApplicationPayload = {
          jobId: application.jobId,
          jobTitle,
          company,
          status: application.status,
          matchScore: application.matchScore,
          appliedAt: application.appliedAt,
        };
        await apiFetch('/sync/applications', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // Non-fatal
      }
    },
    [isSignedIn, getToken],
  );

  const removeApplication = useCallback(async (jobId: string): Promise<void> => {
    if (!isSignedIn || !API_BASE) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch(`/sync/applications/${encodeURIComponent(jobId)}`, token, {
        method: 'DELETE',
      });
    } catch {
      // Non-fatal
    }
  }, [isSignedIn, getToken]);

  // ── Saved Jobs ─────────────────────────────────────────────────────────────

  const fetchCloudSavedJobIds = useCallback(async (): Promise<string[]> => {
    if (!isSignedIn || !API_BASE) return [];
    try {
      const token = await getToken();
      if (!token) return [];
      const res = await apiFetch('/sync/saved-jobs', token);
      if (!res.ok) return [];
      const data = await res.json() as unknown;
      return Array.isArray(data)
        ? (data as unknown[]).filter((s): s is string => typeof s === 'string')
        : [];
    } catch {
      return [];
    }
  }, [isSignedIn, getToken]);

  const toggleSavedJobCloud = useCallback(async (jobId: string): Promise<void> => {
    if (!isSignedIn || !API_BASE) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch('/sync/saved-jobs', token, {
        method: 'POST',
        body: JSON.stringify({ jobId }),
      });
    } catch {
      // Non-fatal
    }
  }, [isSignedIn, getToken]);

  // ── Recruiter Stages ───────────────────────────────────────────────────────

  const fetchCloudStages = useCallback(async (): Promise<Record<string, ApplicationStatus>> => {
    if (!isSignedIn || !API_BASE) return {};
    try {
      const token = await getToken();
      if (!token) return {};
      const res = await apiFetch('/sync/stages', token);
      if (!res.ok) return {};
      const data = await res.json() as unknown;
      if (typeof data !== 'object' || data === null) return {};
      const result: Record<string, ApplicationStatus> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v === 'string') result[k] = v as ApplicationStatus;
      }
      return result;
    } catch {
      return {};
    }
  }, [isSignedIn, getToken]);

  const pushStage = useCallback(
    async (candidateName: string, status: ApplicationStatus): Promise<void> => {
      if (!isSignedIn || !API_BASE) return;
      try {
        const token = await getToken();
        if (!token) return;
        await apiFetch(
          `/sync/stages/${encodeURIComponent(candidateName)}`,
          token,
          { method: 'PUT', body: JSON.stringify({ status }) },
        );
      } catch {
        // Non-fatal
      }
    },
    [isSignedIn, getToken],
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
  };
}
