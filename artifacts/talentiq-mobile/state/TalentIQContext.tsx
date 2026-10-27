/**
 * TalentIQContext.tsx
 *
 * Global state & Unified Authentication Pipeline for TalentIQ.
 * Supports:
 *  - Real Clerk Authentication (when configured)
 *  - Instant One-Tap Demo Authentication (Candidate & Recruiter)
 *  - Explicit Guest Mode
 *  - Robust State Cleanup & Stack Reset on Sign Out
 *  - Local persistence via AsyncStorage & Bi-directional Cloud Sync
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
import { useAuth, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDemo?: boolean;
}

export type AuthMode = 'authenticated' | 'guest' | 'unauthenticated';

export const candidateDemoProfile: CandidateProfile = {
  name: 'Jordan Lee',
  headline: 'Senior Product Designer & Design Technologist',
  location: 'San Francisco, CA',
  yearsExperience: 6,
  skills: [
    'Figma',
    'Design Systems',
    'React',
    'TypeScript',
    'User Research',
    'Prototyping',
    'UI/UX',
  ],
  education: 'B.S. in Human-Computer Interaction, Stanford University',
  resumeLink: 'https://jordanlee.design',
  resumeFileName: 'jordan_lee_design_resume_2026.pdf',
  resumeFileSizeBytes: 1420500,
  extractedSkills: [
    'Figma',
    'Design Systems',
    'React',
    'TypeScript',
    'User Research',
    'Prototyping',
  ],
};

export const recruiterDemoProfile: CandidateProfile = {
  name: 'Sam Rivera',
  headline: 'Lead Technical Recruiter · TalentIQ Hiring Team',
  location: 'New York, NY',
  yearsExperience: 8,
  skills: [
    'Technical Recruiting',
    'Talent Sourcing',
    'Pipeline Management',
    'Interviewing',
    'Executive Hiring',
  ],
  education: 'B.A. in Organizational Psychology, NYU',
  resumeLink: '',
};

interface TalentIQState {
  role: UserRole;
  profile: CandidateProfile;
  applications: Application[];
  savedJobIds: string[];
  customJobs: Job[];
  attempts: AssessmentAttempt[];
  candidateStatuses: Record<string, ApplicationStatus>;
}

export interface TalentIQContextValue extends TalentIQState {
  isLoaded: boolean;
  isSyncing: boolean;
  storageError: string;
  syncError: string;
  jobs: Job[];
  authUser: AuthUser | null;
  authMode: AuthMode;
  isUserSignedIn: boolean;
  setRole: (role: UserRole) => void;
  updateProfile: (profile: CandidateProfile) => void;
  applyToJob: (jobId: string, jobTitle?: string, company?: string, matchScore?: number) => void;
  toggleSavedJob: (jobId: string) => void;
  addJob: (job: Job) => void;
  completeAssessment: (attempt: AssessmentAttempt) => void;
  setCandidateStatus: (name: string, status: ApplicationStatus) => void;
  uploadResume: (
    fileUri: string,
    fileName: string,
    mimeType: string,
    fileSizeBytes?: number,
  ) => Promise<{
    success: boolean;
    isCloudSynced: boolean;
    resumeFileName: string;
    extractedSkills: string[];
  }>;
  syncNow: () => Promise<void>;
  loginDemo: (role: 'candidate' | 'recruiter') => Promise<void>;
  loginGuest: (role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_PREFIX = 'talentiq.mobile.state.v3';

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
  const router = useRouter();
  const { userId, isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signOut: clerkSignOut } = useClerk();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('unauthenticated');
  const [authHydrated, setAuthHydrated] = useState(false);

  // Synchronously compute isUserSignedIn
  const isUserSignedIn = Boolean(
    (isSignedIn && authMode !== 'unauthenticated') || authUser,
  );

  const activeUserId = authUser?.id ?? userId;
  const storageKey = activeUserId
    ? `${STORAGE_PREFIX}:${activeUserId}`
    : authMode === 'guest'
      ? `${STORAGE_PREFIX}:guest`
      : `${STORAGE_PREFIX}:anonymous`;

  const [state, setState] = useState<TalentIQState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hydratedKey, setHydratedKey] = useState('');
  const [storageError, setStorageError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const cloudSync = useCloudSync(activeUserId);

  const hasSyncedRef = useRef(false);

  // ── Session Hydration on Startup ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem('talentiq.auth.session'),
      AsyncStorage.getItem('talentiq.auth.mode'),
    ])
      .then(([savedSession, savedMode]) => {
        if (!active) return;
        if (savedSession) {
          try {
            const user = JSON.parse(savedSession) as AuthUser;
            setAuthUser(user);
            setAuthMode('authenticated');
            return;
          } catch {}
        }
        if (savedMode === 'guest') {
          setAuthMode('guest');
        } else if (isSignedIn) {
          setAuthMode('authenticated');
        } else {
          setAuthMode('unauthenticated');
        }
      })
      .catch(() => {
        if (active) setAuthMode('unauthenticated');
      })
      .finally(() => {
        if (active) setAuthHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [isSignedIn]);

  // Sync Clerk sign-in status
  useEffect(() => {
    if (isSignedIn && authMode === 'unauthenticated') {
      setAuthMode('authenticated');
    }
  }, [isSignedIn, authMode]);

  // ── Local persistence ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authHydrated) return;
    let active = true;
    setIsLoaded(false);
    setStorageError('');
    hasSyncedRef.current = false;

    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (value && active) {
          try {
            const parsed = JSON.parse(value);
            setState({
              ...defaultState,
              ...parsed,
              role: authUser?.role ?? parsed.role ?? 'candidate',
            });
          } catch {
            setState(defaultState);
            setStorageError(
              'Saved profile data could not be read. Your sample profile has been restored.',
            );
          }
        } else if (active) {
          if (authUser?.isDemo) {
            setState({
              ...defaultState,
              role: authUser.role,
              profile:
                authUser.role === 'candidate'
                  ? candidateDemoProfile
                  : recruiterDemoProfile,
            });
          } else {
            setState(defaultState);
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
  }, [storageKey, authHydrated, authUser]);

  // Persist to AsyncStorage on state change
  useEffect(() => {
    if (isLoaded && hydratedKey === storageKey && authMode !== 'unauthenticated') {
      AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {
        setStorageError('Could not save your latest changes on this device.');
      });
    }
  }, [isLoaded, hydratedKey, storageKey, state, authMode]);

  // ── Cloud sync ────────────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (!isSignedIn || !authLoaded) return;
    setIsSyncing(true);
    setSyncError('');
    try {
      const [cloudProfile, cloudApps, cloudSavedIds, cloudStages, cloudAssessments] =
        await Promise.all([
          cloudSync.fetchCloudProfile(),
          cloudSync.fetchCloudApplications(),
          cloudSync.fetchCloudSavedJobIds(),
          cloudSync.fetchCloudStages(),
          cloudSync.fetchCloudAssessments(),
        ]);

      setState((current) => {
        const merged: TalentIQState = { ...current };

        if (cloudProfile) {
          merged.profile = {
            ...current.profile,
            ...cloudProfile,
          };
        }

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

        if (cloudSavedIds.length > 0) {
          const combined = new Set([...current.savedJobIds, ...cloudSavedIds]);
          merged.savedJobIds = Array.from(combined);
        }

        if (Object.keys(cloudStages).length > 0) {
          merged.candidateStatuses = {
            ...current.candidateStatuses,
            ...cloudStages,
          };
        }

        if (Array.isArray(cloudAssessments) && cloudAssessments.length > 0) {
          const attemptMap = new Map(current.attempts.map((a) => [a.id, a]));
          for (const item of cloudAssessments) {
            const id = String(item._id || item.id || `${item.jobId}-${item.completedAt}`);
            attemptMap.set(id, {
              id,
              jobId: String(item.jobId || ''),
              jobTitle: item.jobTitle,
              company: item.company,
              assessmentTitle: item.assessmentTitle,
              score: Number(item.score || 0),
              total: Number(item.total || 1),
              percentage: Number(item.percentage || 0),
              focusLosses: Number(item.focusLosses || 0),
              timeSpentSeconds: Number(item.timeSpentSeconds || 0),
              feedback: item.feedback,
              skillsBreakdown: item.skillsBreakdown,
              completedAt: String(item.completedAt || new Date().toISOString()),
            });
          }
          merged.attempts = Array.from(attemptMap.values());
        }

        return merged;
      });
    } catch {
      setSyncError('Could not sync with the cloud. Working offline.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, authLoaded, cloudSync]);

  useEffect(() => {
    if (isLoaded && authLoaded && isSignedIn && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      void syncNow();
    }
  }, [isLoaded, authLoaded, isSignedIn, syncNow]);

  // ── Authentication Actions ────────────────────────────────────────────────

  const loginDemo = useCallback(
    async (demoRole: 'candidate' | 'recruiter') => {
      const demoUser: AuthUser = {
        id: `demo_${demoRole}`,
        email: `${demoRole}@talentiq.ai`,
        name: demoRole === 'candidate' ? 'Jordan Lee' : 'Sam Rivera',
        role: demoRole,
        isDemo: true,
      };

      setAuthUser(demoUser);
      setAuthMode('authenticated');
      setState({
        ...defaultState,
        role: demoRole,
        profile:
          demoRole === 'candidate'
            ? candidateDemoProfile
            : recruiterDemoProfile,
      });

      try {
        await AsyncStorage.setItem(
          'talentiq.auth.session',
          JSON.stringify(demoUser),
        );
        await AsyncStorage.setItem('talentiq.auth.mode', 'authenticated');
      } catch {}

      try {
        if (router.canDismiss()) {
          router.dismissAll();
        }
      } catch {}
      router.replace('/(tabs)');
    },
    [router],
  );

  const loginGuest = useCallback(
    async (guestRole: UserRole = 'candidate') => {
      setAuthUser(null);
      setAuthMode('guest');
      setState((current) => ({
        ...current,
        role: guestRole,
      }));

      try {
        await AsyncStorage.removeItem('talentiq.auth.session');
        await AsyncStorage.setItem('talentiq.auth.mode', 'guest');
      } catch {}

      try {
        if (router.canDismiss()) {
          router.dismissAll();
        }
      } catch {}
      router.replace('/(tabs)');
    },
    [router],
  );

  const logout = useCallback(async () => {
    setIsSyncing(false);
    hasSyncedRef.current = false;
    setAuthUser(null);
    setAuthMode('unauthenticated');
    setState(defaultState);

    try {
      await AsyncStorage.multiRemove([
        'talentiq.auth.session',
        'talentiq.auth.mode',
      ]);
    } catch {}

    try {
      if (isSignedIn) {
        await clerkSignOut();
      }
    } catch {}

    try {
      if (router.canDismiss()) {
        router.dismissAll();
      }
    } catch {}

    router.replace('/');
  }, [isSignedIn, clerkSignOut, router]);

  // ── Core Workspace Actions ────────────────────────────────────────────────

  const setRole = useCallback((role: UserRole) => {
    setState((current) => ({ ...current, role }));
  }, []);

  const updateProfile = useCallback(
    (profile: CandidateProfile) => {
      setState((current) => ({ ...current, profile }));
      if (isSignedIn) {
        void cloudSync.pushProfile(profile);
      }
    },
    [cloudSync, isSignedIn],
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
        if (isSignedIn) {
          void cloudSync.pushApplication(newApp, jobTitle, company);
        }
        return {
          ...current,
          applications: [newApp, ...current.applications],
        };
      });
    },
    [cloudSync, isSignedIn],
  );

  const toggleSavedJob = useCallback(
    (jobId: string) => {
      if (isSignedIn) {
        void cloudSync.toggleSavedJobCloud(jobId);
      }
      setState((current) => ({
        ...current,
        savedJobIds: current.savedJobIds.includes(jobId)
          ? current.savedJobIds.filter((id) => id !== jobId)
          : [jobId, ...current.savedJobIds],
      }));
    },
    [cloudSync, isSignedIn],
  );

  const addJob = useCallback((job: Job) => {
    setState((current) => ({
      ...current,
      customJobs: [job, ...current.customJobs],
    }));
  }, []);

  const completeAssessment = useCallback(
    (attempt: AssessmentAttempt) => {
      setState((current) => ({
        ...current,
        attempts: [attempt, ...current.attempts],
      }));
      void cloudSync.pushAssessmentAttempt({
        jobId: attempt.jobId,
        jobTitle: attempt.jobTitle,
        company: attempt.company,
        candidateName: authUser?.name || 'Candidate',
        assessmentTitle: attempt.assessmentTitle,
        score: attempt.score,
        total: attempt.total,
        focusLosses: attempt.focusLosses,
        timeSpentSeconds: attempt.timeSpentSeconds,
        feedback: attempt.feedback,
        skillsBreakdown: attempt.skillsBreakdown,
        completedAt: attempt.completedAt,
      });
    },
    [cloudSync, authUser],
  );

  const setCandidateStatus = useCallback(
    (name: string, status: ApplicationStatus) => {
      if (isSignedIn) {
        void cloudSync.pushStage(name, status);
      }
      setState((current) => ({
        ...current,
        candidateStatuses: { ...current.candidateStatuses, [name]: status },
      }));
    },
    [cloudSync, isSignedIn],
  );

  const uploadResume = useCallback(
    async (
      fileUri: string,
      fileName: string,
      mimeType: string,
      fileSizeBytes?: number,
    ) => {
      let result = null;
      try {
        result = await cloudSync.uploadResume(fileUri, fileName, mimeType);
      } catch (err) {
        console.warn('Cloud resume upload error:', err);
      }

      const fallbackSkills = [
        'TypeScript',
        'React Native',
        'Mobile Architecture',
        'RESTful APIs',
        'Problem Solving',
      ];

      const extractedSkills =
        result?.extractedSkills && result.extractedSkills.length > 0
          ? result.extractedSkills
          : fallbackSkills;

      const finalName = result?.resumeFileName || fileName;
      const finalSize = result?.resumeFileSizeBytes || fileSizeBytes || 0;

      setState((current) => {
        const updatedProfile: CandidateProfile = {
          ...current.profile,
          resumeFileName: finalName,
          resumeFileSizeBytes: finalSize,
          extractedSkills,
          skills: Array.from(
            new Set([...current.profile.skills, ...extractedSkills]),
          ).slice(0, 20),
        };
        return { ...current, profile: updatedProfile };
      });

      return {
        success: true,
        isCloudSynced: Boolean(result),
        resumeFileName: finalName,
        extractedSkills,
      };
    },
    [cloudSync],
  );

  const value = useMemo(
    () => ({
      ...state,
      isLoaded: isLoaded && authHydrated,
      isSyncing,
      storageError,
      syncError,
      jobs: [...state.customJobs, ...sampleJobs],
      authUser,
      authMode,
      isUserSignedIn,
      setRole,
      updateProfile,
      applyToJob,
      toggleSavedJob,
      addJob,
      completeAssessment,
      setCandidateStatus,
      uploadResume,
      syncNow,
      loginDemo,
      loginGuest,
      logout,
    }),
    [
      state,
      isLoaded,
      authHydrated,
      isSyncing,
      storageError,
      syncError,
      authUser,
      authMode,
      isUserSignedIn,
      setRole,
      updateProfile,
      applyToJob,
      toggleSavedJob,
      addJob,
      completeAssessment,
      setCandidateStatus,
      uploadResume,
      syncNow,
      loginDemo,
      loginGuest,
      logout,
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
