import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from '@/data/talentiq';

// Complete WebBrowser auth session if returning from OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CLIENT_ID_STORAGE_KEY = 'talentiq.google_client_id';
export const SAVED_GOOGLE_ACCOUNTS_KEY = 'talentiq.google_saved_accounts';

export interface GoogleAuthOptions {
  role?: UserRole;
  intent?: 'sign-in' | 'sign-up';
}

export interface SavedGoogleAccount {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  lastUsedAt: string;
}

/**
 * Retrieves the effective Google Client ID from process.env or AsyncStorage
 */
export async function getEffectiveGoogleClientId(): Promise<string> {
  const envKey =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    '';

  if (envKey && !envKey.includes('REPLACE') && envKey.length > 10) {
    return envKey.trim();
  }

  try {
    const stored = await AsyncStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
    if (stored && !stored.includes('REPLACE') && stored.length > 10) {
      return stored.trim();
    }
  } catch {}

  return '';
}

/**
 * Saves a Google Client ID directly to AsyncStorage for instant in-app configuration
 */
export async function saveGoogleClientId(clientId: string): Promise<void> {
  const clean = clientId.trim();
  if (clean) {
    await AsyncStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, clean);
  } else {
    await AsyncStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
  }
}

/**
 * Synchronous check whether Google OAuth Client ID is configured in process.env
 */
export function isGoogleOAuthConfigured(): boolean {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    '';
  return (
    Boolean(clientId) &&
    !clientId.includes('REPLACE') &&
    clientId.length > 10
  );
}

/**
 * Computes the exact redirect URI based on current runtime platform
 */
export function getGoogleOAuthRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/auth/callback`;
  }
  return Linking.createURL('/auth/callback');
}

/**
 * Initiates Google OAuth 2.0 flow via WebBrowser with real accounts.google.com
 */
export async function startGoogleOAuthFlow(
  options: GoogleAuthOptions = {},
): Promise<{ token?: string; error?: string } | null> {
  const clientId = await getEffectiveGoogleClientId();

  if (!clientId) {
    return { error: 'No Google Client ID configured' };
  }

  try {
    const redirectUri = getGoogleOAuthRedirectUri();
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent('openid profile email')}&` +
      `prompt=select_account`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      const hashIndex = result.url.indexOf('#');
      const queryIndex = result.url.indexOf('?');
      const paramsString =
        hashIndex !== -1
          ? result.url.substring(hashIndex + 1)
          : queryIndex !== -1
            ? result.url.substring(queryIndex + 1)
            : '';

      const params = new URLSearchParams(paramsString);
      const token = params.get('access_token') || params.get('id_token');
      if (token) {
        return { token };
      }
    }

    return null;
  } catch (err: any) {
    return { error: err?.message || 'Google OAuth browser flow error' };
  }
}

/**
 * Loads real remembered Google accounts from AsyncStorage
 */
export async function getSavedGoogleAccounts(): Promise<SavedGoogleAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_GOOGLE_ACCOUNTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

/**
 * Saves an authenticated Google account to AsyncStorage
 */
export async function recordSavedGoogleAccount(account: {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
}): Promise<void> {
  try {
    const existing = await getSavedGoogleAccounts();
    const filtered = existing.filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase(),
    );
    filtered.unshift({
      ...account,
      lastUsedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(
      SAVED_GOOGLE_ACCOUNTS_KEY,
      JSON.stringify(filtered.slice(0, 5)),
    );
  } catch {}
}

/**
 * Removes a saved Google account from the list
 */
export async function removeSavedGoogleAccount(email: string): Promise<void> {
  try {
    const existing = await getSavedGoogleAccounts();
    const filtered = existing.filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase(),
    );
    await AsyncStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch {}
}
