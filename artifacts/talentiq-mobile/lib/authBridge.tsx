import React, { createContext, useContext, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ClerkProvider as ExpoClerkProvider,
  ClerkLoaded as ExpoClerkLoaded,
  useAuth as useExpoAuth,
  useUser as useExpoUser,
  useClerk as useExpoClerk,
  useSignIn as useExpoSignIn,
  useSignUp as useExpoSignUp,
  type TokenCache,
} from '@clerk/expo';
import { getApiEndpoint } from '@/utils/apiConfig';

/**
 * Validates whether a Clerk publishable key is a genuine, active key
 * rather than a placeholder, dummy string, or non-existent tenant.
 */
export const isClerkPublishableKeyValid = (key?: string | null): boolean => {
  if (!key) return false;
  const trimmed = key.trim();
  if (
    trimmed === '' ||
    trimmed.includes('REPLACE_WITH_YOUR') ||
    trimmed.includes('dGFsZW50aXEuY2xlcmsuYWNjb3VudHMuZGV2JA') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('your_') ||
    trimmed === 'pk_test_' ||
    trimmed === 'pk_live_'
  ) {
    return false;
  }
  return (
    (trimmed.startsWith('pk_test_') || trimmed.startsWith('pk_live_')) &&
    trimmed.length > 30
  );
};

const rawEnvKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.CLERK_PUBLISHABLE_KEY ??
  '';

export const isClerkConfigured = isClerkPublishableKeyValid(rawEnvKey);

export interface MockUser {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  imageUrl: string | null;
}

export interface ClerkAuthErrors {
  fields: Record<string, { message?: string } | undefined>;
  [key: string]: any;
}

export interface AuthBridgeContextValue {
  isClerkConfigured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  sessionId: string | null;
  getToken: (options?: any) => Promise<string | null>;
  signOut: (options?: any) => Promise<void>;
  user: MockUser | null;
  clerk: {
    loaded: boolean;
    signOut: (options?: any) => Promise<void>;
    openSignIn?: () => void;
    openSignUp?: () => void;
  };
  signInData: {
    isLoaded: boolean;
    fetchStatus: string;
    errors: ClerkAuthErrors;
    signIn: {
      status: string;
      supportedSecondFactors: Array<{ strategy: string }>;
      password: (params: {
        emailAddress?: string;
        password?: string;
      }) => Promise<{ error?: { message?: string } }>;
      mfa: {
        sendEmailCode: () => Promise<{ error?: { message?: string } | null }>;
        verifyEmailCode: (params: { code: string }) => Promise<{ error?: { message?: string } | null }>;
      };
      finalize: (opts?: {
        navigate?: (args: { decorateUrl: (u: string) => string }) => void;
      }) => Promise<void>;
    };
    setActive: (params?: any) => Promise<void>;
  };
  signUpData: {
    isLoaded: boolean;
    fetchStatus: string;
    errors: ClerkAuthErrors;
    signUp: {
      status: string;
      unverifiedFields: string[];
      missingFields: string[];
      password: (params: {
        emailAddress?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
      }) => Promise<{ error?: { message?: string } }>;
      verifications: {
        sendEmailCode: () => Promise<{ error?: { message?: string } | null }>;
        verifyEmailCode: (params: { code: string }) => Promise<{ error?: { message?: string } | null }>;
      };
      finalize: (opts?: {
        navigate?: (args: { decorateUrl: (u: string) => string }) => void;
      }) => Promise<void>;
    };
    setActive: (params?: any) => Promise<void>;
  };
}

const defaultMockValue: AuthBridgeContextValue = {
  isClerkConfigured: false,
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  getToken: async () => null,
  signOut: async () => {},
  user: null,
  clerk: {
    loaded: true,
    signOut: async () => {},
  },
  signInData: {
    isLoaded: true,
    fetchStatus: 'idle',
    errors: { fields: {} },
    signIn: {
      status: 'needs_identifier',
      supportedSecondFactors: [],
      password: async ({ emailAddress, password }: { emailAddress?: string; password?: string }) => {
        try {
          const endpoint = getApiEndpoint('/auth/sign-in');
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailAddress, password }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            return {
              error: {
                message: data.error || 'Invalid email or password. Please try again.',
              },
            };
          }
          if (data.token) {
            await AsyncStorage.setItem('talentiq.auth.token', data.token);
          }
          if (data.user) {
            await AsyncStorage.setItem(
              'talentiq.auth.session',
              JSON.stringify({
                id: data.user.id || data.user.userId,
                email: data.user.email,
                name: data.user.name,
                role: data.user.role || 'candidate',
                isDemo: false,
              }),
            );
            await AsyncStorage.setItem('talentiq.auth.mode', 'authenticated');
          }
          return { error: undefined };
        } catch (err: any) {
          return {
            error: {
              message: err?.message || 'Could not connect to authentication server.',
            },
          };
        }
      },
      mfa: {
        sendEmailCode: async () => ({ error: null }),
        verifyEmailCode: async () => ({
          error: { message: 'MFA is not needed.' },
        }),
      },
      finalize: async () => {},
    },
    setActive: async () => {},
  },
  signUpData: {
    isLoaded: true,
    fetchStatus: 'idle',
    errors: { fields: {} },
    signUp: {
      status: 'complete',
      unverifiedFields: [],
      missingFields: [],
      password: async ({
        emailAddress,
        password,
        firstName,
        lastName,
      }: {
        emailAddress?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        try {
          const name = [firstName, lastName].filter(Boolean).join(' ') || 'Candidate';
          const endpoint = getApiEndpoint('/auth/sign-up');
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email: emailAddress, password, role: 'candidate' }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            return {
              error: {
                message: data.error || 'Failed to create account. Please check your details.',
              },
            };
          }
          if (data.token) {
            await AsyncStorage.setItem('talentiq.auth.token', data.token);
          }
          if (data.user) {
            await AsyncStorage.setItem(
              'talentiq.auth.session',
              JSON.stringify({
                id: data.user.id || data.user.userId,
                email: data.user.email,
                name: data.user.name,
                role: data.user.role || 'candidate',
                isDemo: false,
              }),
            );
            await AsyncStorage.setItem('talentiq.auth.mode', 'authenticated');
          }
          return { error: undefined };
        } catch (err: any) {
          return {
            error: {
              message: err?.message || 'Could not connect to authentication server.',
            },
          };
        }
      },
      verifications: {
        sendEmailCode: async () => ({ error: null }),
        verifyEmailCode: async () => ({
          error: null,
        }),
      },
      finalize: async () => {},
    },
    setActive: async () => {},
  },
};

const AuthBridgeContext = createContext<AuthBridgeContextValue>(defaultMockValue);

function RealBridge({ children }: { children: React.ReactNode }) {
  const auth = useExpoAuth();
  const user = useExpoUser();
  const clerk = useExpoClerk();
  const signInData = useExpoSignIn();
  const signUpData = useExpoSignUp();

  const value: AuthBridgeContextValue = useMemo(
    () => ({
      isClerkConfigured: true,
      isLoaded: auth.isLoaded,
      isSignedIn: Boolean(auth.isSignedIn),
      userId: auth.userId ?? null,
      sessionId: auth.sessionId ?? null,
      getToken: auth.getToken,
      signOut: auth.signOut,
      user: (user.user as unknown as MockUser) ?? null,
      clerk: {
        loaded: clerk.loaded,
        signOut: clerk.signOut,
        openSignIn: (clerk as unknown as { openSignIn?: () => void }).openSignIn,
        openSignUp: (clerk as unknown as { openSignUp?: () => void }).openSignUp,
      },
      signInData: {
        ...signInData,
        errors: ((signInData as any)?.errors?.fields ? (signInData as any).errors : { fields: {} }) as ClerkAuthErrors,
      } as unknown as AuthBridgeContextValue['signInData'],
      signUpData: {
        ...signUpData,
        errors: ((signUpData as any)?.errors?.fields ? (signUpData as any).errors : { fields: {} }) as ClerkAuthErrors,
      } as unknown as AuthBridgeContextValue['signUpData'],
    }),
    [auth, user, clerk, signInData, signUpData],
  );

  return <AuthBridgeContext.Provider value={value}>{children}</AuthBridgeContext.Provider>;
}

function MockBridge({ children }: { children: React.ReactNode }) {
  return (
    <AuthBridgeContext.Provider value={defaultMockValue}>
      {children}
    </AuthBridgeContext.Provider>
  );
}

export function ClerkProvider({
  children,
  publishableKey,
  tokenCache,
  proxyUrl,
}: {
  children: React.ReactNode;
  publishableKey?: string;
  tokenCache?: TokenCache;
  proxyUrl?: string;
}) {
  const activeKey = publishableKey || rawEnvKey;
  const valid = isClerkPublishableKeyValid(activeKey);

  if (!valid) {
    return <MockBridge>{children}</MockBridge>;
  }

  return (
    <ExpoClerkProvider
      publishableKey={activeKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <RealBridge>{children}</RealBridge>
    </ExpoClerkProvider>
  );
}

export function ClerkLoaded({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured) {
    return <>{children}</>;
  }
  return <ExpoClerkLoaded>{children}</ExpoClerkLoaded>;
}

export function useAuth() {
  const ctx = useContext(AuthBridgeContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    getToken: ctx.getToken,
    signOut: ctx.signOut,
  };
}

export function useUser() {
  const ctx = useContext(AuthBridgeContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    user: ctx.user,
  };
}

export function useClerk() {
  const ctx = useContext(AuthBridgeContext);
  return ctx.clerk;
}

export function useSignIn() {
  const ctx = useContext(AuthBridgeContext);
  return ctx.signInData;
}

export function useSignUp() {
  const ctx = useContext(AuthBridgeContext);
  return ctx.signUpData;
}
