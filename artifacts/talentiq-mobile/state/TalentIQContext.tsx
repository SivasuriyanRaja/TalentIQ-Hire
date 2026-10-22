/**
 * TalentIQContext.tsx
 *
 * Global state for the TalentIQ app.  Persists locally via AsyncStorage for
 * offline support and syncs bi-directionally with the cloud API when the user
 * is signed in, so data is available on any device.
 *
 * Sync strategy:
 *  1. On mount: load local state from AsyncStorage immediately (instant load)
 *  2. After auth is ready: fetch cloud data and merge (cloud wins on conflict)
 *  3. On every write: update local state → persist to AsyncStorage → push to cloud
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@clerk/expo';
import {
  Application,
  ApplicationStatus,
  AssessmentAttempt,
  CandidateProfile,
  initialProfile,
  Job,
  sampleJobs,
  UserRole,
} from '@/data/talentiq';
import { useCloudSync } from '@/hooks/useCloudSync';

interface TalentIQState {
  role: UserRole;
  profile: CandidateProfile;
  applications: Application[];
  savedJobIds: string[];
  customJobs: Job[];
  attempts: AssessmentAttempt[];
  candidateStatuses: Record<string, ApplicationStatus>;
}

interface TalentIQContextValue extends TalentIQState {
  isLoaded: boolean;
  isSyncing: boolean;
  storageError: string;
  syncError: string;
  jobs: Job[];
  setRole: (role: UserRole) => void;
  updateProfile: (profile: CandidateProfile) => void;
  applyToJob: (jobId: string, jobTitle?: string, company?: string, matchScore?: number) => void;
  toggleSavedJob: (jobId: string) => void;
  addJob: (job: Job) => void;
  completeAssessment: (attempt: AssessmentAttempt) => void;
  setCandidateStatus: (name: string, status: ApplicationStatus) => void;
  /** Upload a resume file and merge extracted skills into the profile */
  uploadResume: (fileUri: string, fileName: string, mimeType: string) => Promise<void>;
  /** Manually trigger a full cloud sync */
  syncNow: () => Promise<void>;
}

const STORAGE_PREFIX = 'talentiq.mobile.state.v2';

const defaultState: TalentIQState = {
  role: 'candidate',
  profile: initialProfile,
  applications: [],
  savedJobIds: [],
  customJobs: [],
  attempts: [],
  candidateStatuses: {
    'Jordan Lee': 'Shortlisted',
    'Sam Rivera': 'Interview',
    'Mina Chen': 'Applied',
  },
};

const TalentIQContext = createContext<TalentIQContextValue | null>(null);

export function TalentIQProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, isSignedIn, isLoaded: authLoaded } = useAuth();
  const storageKey = `${STORAGE_PREFIX}:${userId ?? 'guest'}`;

  const [state, setState] = useState<TalentIQState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hydratedKey, setHydratedKey] = useState('');
  const [storageError, setStorageError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const cloudSync = useCloudSync();

  // Track whether we've done the initial cloud sync for this session
  const hasSyncedRef = useRef(false);

  // ── Local persistence ─────────────────────────────────────────────────────

  // Load from AsyncStorage when the user (or auth key) changes
  useEffect(() => {
    let active = true;
    setIsLoaded(false);
    setState(defaultState);
    setStorageError('');
    hasSyncedRef.current = false;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (value && active) {
          try {
            setState({ ...defaultState, ...JSON.parse(value) });
          } catch {
            setState(defaultState);
            setStorageError(
              'Saved profile data could not be read. Your sample profile has been restored.',
            );
          }
        }
      })
      .catch(() => {
        if (active)
          setStorageError('Could not load saved activity from this device.');
      })
      .finally(() => {
        if (active) {
          setHydratedKey(storageKey);
          setIsLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  // Persist to AsyncStorage on every state change
  useEffect(() => {
    if (isLoaded && hydratedKey === storageKey) {
      AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {
        setStorageError('Could not save your latest changes on this device.');
      });
    }
  }, [isLoaded, hydratedKey, storageKey, state]);

  // ── Cloud sync ────────────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    if (!isSignedIn || !authLoaded) return;
    setIsSyncing(true);
    setSyncError('');
    try {
      // Fetch all cloud data in parallel
      const [cloudProfile, cloudApps, cloudSavedIds, cloudStages] =
        await Promise.all([
          cloudSync.fetchCloudProfile(),
          cloudSync.fetchCloudApplications(),
          cloudSync.fetchCloudSavedJobIds(),
          cloudSync.fetchCloudStages(),
        ]);

      setState((current) => {
        const merged: TalentIQState = { ...current };

        // Profile: cloud wins on fields that have cloud data
        if (cloudProfile) {
          merged.profile = {
            ...current.profile,
            ...cloudProfile,
          };
        }

        // Applications: merge by jobId — cloud status wins
        if (cloudApps.length > 0) {
          const localMap = new Map(
            current.applications.map((a) => [a.jobId, a]),
          );
          for (const ca of cloudApps) {
            localMap.set(ca.jobId, {
              ...localMap.get(ca.jobId),
              ...ca,
            });
          }
          merged.applications = Array.from(localMap.values());
        }

        // Saved jobs: union of local + cloud
        if (cloudSavedIds.length > 0) {
          const combined = new Set([...current.savedJobIds, ...cloudSavedIds]);
          merged.savedJobIds = Array.from(combined);
        }

        // Recruiter stages: cloud wins
        if (Object.keys(cloudStages).length > 0) {
          merged.candidateStatuses = {
            ...current.candidateStatuses,
            ...cloudStages,
          };
        }

        return merged;
      });
    } catch {
      setSyncError('Could not sync with the cloud. Working offline.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, authLoaded, cloudSync]);

  // Trigger cloud sync once after auth loads and local state is ready
  useEffect(() => {
    if (isLoaded && authLoaded && isSignedIn && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      void syncNow();
    }
  }, [isLoaded, authLoaded, isSignedIn, syncNow]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setRole = useCallback((role: UserRole) => {
    setState((current) => ({ ...current, role }));
  }, []);

  const updateProfile = useCallback(
    (profile: CandidateProfile) => {
      setState((current) => ({ ...current, profile }));
      // Push to cloud asynchronously
      void cloudSync.pushProfile(profile);
    },
    [cloudSync],
  );

  const applyToJob = useCallback(
    (
      jobId: string,
      jobTitle = '',
      company = '',
      matchScore = 0,
    ) => {
      setState((current) => {
        if (current.applications.some((a) => a.jobId === jobId)) {
          return current;
        }
        const newApp: Application = {
          id: `${Date.now()}`,
          jobId,
          status: 'Applied',
          appliedAt: new Date().toISOString(),
          matchScore,
        };
        // Push to cloud
        void cloudSync.pushApplication(newApp, jobTitle, company);
        return {
          ...current,
          applications: [newApp, ...current.applications],
        };
      });
    },
    [cloudSync],
  );

  const toggleSavedJob = useCallback(
    (jobId: string) => {
      // Push toggle to cloud
      void cloudSync.toggleSavedJobCloud(jobId);
      setState((current) => ({
        ...current,
        savedJobIds: current.savedJobIds.includes(jobId)
          ? current.savedJobIds.filter((id) => id !== jobId)
          : [jobId, ...current.savedJobIds],
      }));
    },
    [cloudSync],
  );

  const addJob = useCallback((job: Job) => {
    setState((current) => ({
      ...current,
      customJobs: [job, ...current.customJobs],
    }));
  }, []);

  const completeAssessment = useCallback((attempt: AssessmentAttempt) => {
    setState((current) => ({
      ...current,
      attempts: [attempt, ...current.attempts],
    }));
  }, []);

  const setCandidateStatus = useCallback(
    (name: string, status: ApplicationStatus) => {
      // Push to cloud
      void cloudSync.pushStage(name, status);
      setState((current) => ({
        ...current,
        candidateStatuses: { ...current.candidateStatuses, [name]: status },
      }));
    },
    [cloudSync],
  );

  const uploadResume = useCallback(
    async (fileUri: string, fileName: string, mimeType: string) => {
      const result = await cloudSync.uploadResume(fileUri, fileName, mimeType);
      if (!result) return;
      // Merge extracted skills + resume metadata into profile
      setState((current) => {
        const updatedProfile: CandidateProfile = {
          ...current.profile,
          resumeFileName: result.resumeFileName,
          resumeFileSizeBytes: result.resumeFileSizeBytes,
          extractedSkills: result.extractedSkills,
          // Auto-merge extracted skills into manual skills (deduplicated)
          skills: Array.from(
            new Set([...current.profile.skills, ...result.extractedSkills]),
          ).slice(0, 20),
        };
        return { ...current, profile: updatedProfile };
      });
    },
    [cloudSync],
  );

  const value = useMemo(
    () => ({
      ...state,
      isLoaded,
      isSyncing,
      storageError,
      syncError,
      jobs: [...state.customJobs, ...sampleJobs],
      setRole,
      updateProfile,
      applyToJob,
      toggleSavedJob,
      addJob,
      completeAssessment,
      setCandidateStatus,
      uploadResume,
      syncNow,
    }),
    [
      state,
      isLoaded,
      isSyncing,
      storageError,
      syncError,
      setRole,
      updateProfile,
      applyToJob,
      toggleSavedJob,
      addJob,
      completeAssessment,
      setCandidateStatus,
      uploadResume,
      syncNow,
    ],
  );

  return (
    <TalentIQContext.Provider value={value}>{children}</TalentIQContext.Provider>
  );
}

export function useTalentIQ() {
  const context = useContext(TalentIQContext);
  if (!context) {
    throw new Error('useTalentIQ must be used inside TalentIQProvider.');
  }
  return context;
}
