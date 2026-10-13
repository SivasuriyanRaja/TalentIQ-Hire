import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  storageError: string;
  jobs: Job[];
  setRole: (role: UserRole) => void;
  updateProfile: (profile: CandidateProfile) => void;
  applyToJob: (jobId: string) => void;
  toggleSavedJob: (jobId: string) => void;
  addJob: (job: Job) => void;
  completeAssessment: (attempt: AssessmentAttempt) => void;
  setCandidateStatus: (name: string, status: ApplicationStatus) => void;
}

const STORAGE_PREFIX = 'talentiq.mobile.state.v1';

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
  const { userId } = useAuth();
  const storageKey = `${STORAGE_PREFIX}:${userId ?? 'guest'}`;
  const [state, setState] = useState<TalentIQState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hydratedKey, setHydratedKey] = useState('');
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoaded(false);
    setState(defaultState);
    setStorageError('');
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (value && active) {
          try {
            setState({ ...defaultState, ...JSON.parse(value) });
          } catch {
            setState(defaultState);
            setStorageError('Saved profile data could not be read. Your sample profile has been restored.');
          }
        }
      })
      .catch(() => {
        if (active) setStorageError('Could not load saved activity from this device.');
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

  useEffect(() => {
    if (isLoaded && hydratedKey === storageKey) {
      AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {
        setStorageError('Could not save your latest changes on this device.');
      });
    }
  }, [isLoaded, hydratedKey, storageKey, state]);

  const setRole = useCallback((role: UserRole) => {
    setState((current) => ({ ...current, role }));
  }, []);

  const updateProfile = useCallback((profile: CandidateProfile) => {
    setState((current) => ({ ...current, profile }));
  }, []);

  const applyToJob = useCallback((jobId: string) => {
    setState((current) => {
      if (current.applications.some((application) => application.jobId === jobId)) {
        return current;
      }
      return {
        ...current,
        applications: [
          {
            id: `${Date.now()}`,
            jobId,
            status: 'Applied',
            appliedAt: new Date().toISOString(),
            matchScore: 0,
          },
          ...current.applications,
        ],
      };
    });
  }, []);

  const toggleSavedJob = useCallback((jobId: string) => {
    setState((current) => ({
      ...current,
      savedJobIds: current.savedJobIds.includes(jobId)
        ? current.savedJobIds.filter((savedId) => savedId !== jobId)
        : [jobId, ...current.savedJobIds],
    }));
  }, []);

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

  const setCandidateStatus = useCallback((name: string, status: ApplicationStatus) => {
    setState((current) => ({
      ...current,
      candidateStatuses: { ...current.candidateStatuses, [name]: status },
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isLoaded,
      storageError,
      jobs: [...state.customJobs, ...sampleJobs],
      setRole,
      updateProfile,
      applyToJob,
      toggleSavedJob,
      addJob,
      completeAssessment,
      setCandidateStatus,
    }),
    [
      state,
      isLoaded,
      storageError,
      setRole,
      updateProfile,
      applyToJob,
      toggleSavedJob,
      addJob,
      completeAssessment,
      setCandidateStatus,
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
