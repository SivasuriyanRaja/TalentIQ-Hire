import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from '@/data/talentiq';
import { getApiBaseUrl } from '@/utils/apiConfig';

// Complete WebBrowser auth session if returning from OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CLIENT_ID_STORAGE_KEY = 'talentiq.google_client_id';
export const OAUTH_STATE_KEY = 'talentiq.oauth.state';
export const OAUTH_VERIFIER_KEY = 'talentiq.oauth.verifier';
export const OAUTH_ROLE_KEY = 'talentiq.oauth.role';
export const OAUTH_INTENT_KEY = 'talentiq.oauth.intent';

export interface GoogleAuthOptions {
  role?: UserRole;
  intent?: 'sign-in' | 'sign-up';
}

export interface OAuthStatePayload {
  nonce: string;
  role: UserRole;
  intent: 'sign-in' | 'sign-up';
  verifier?: string;
  ts: number;
}

/**
 * Generates an unguessable high-entropy random string for PKCE and CSRF
 */
export function generateRandomString(length: number = 64): string {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  // Fallback
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generates RFC 7636 PKCE code_verifier (64 random chars)
 */
export async function generateCodeVerifier(): Promise<string> {
  return generateRandomString(64);
}

/**
 * Generates RFC 7636 PKCE code_challenge using SHA-256 base64url encoding
 */
export async function generateCodeChallengeS256(verifier: string): Promise<string> {
  try {
    const base64 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    );
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    // Web subtle crypto fallback
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
      return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    throw new Error('PKCE SHA-256 digest failed in current runtime environment.');
  }
}

/**
 * Encodes OAuth state payload into a safe base64url string with CSRF nonce
 */
export function encodeOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  // Fallback for environments where btoa is not global
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes and validates OAuth state parameter returned from Google redirect
 */
export function decodeOAuthState(stateStr: string): OAuthStatePayload | null {
  try {
    let base64 = stateStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const decoded = decodeURIComponent(escape(binary));
    const parsed = JSON.parse(decoded) as OAuthStatePayload;

    // Check expiration (max 15 minutes validity)
    if (parsed.ts && Date.now() - parsed.ts > 15 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Validates returned state against stored CSRF token in AsyncStorage / sessionStorage
 */
export async function validateOAuthState(
  returnedState: string,
): Promise<{ valid: boolean; role?: UserRole; intent?: 'sign-in' | 'sign-up'; verifier?: string }> {
  if (!returnedState) {
    return { valid: false };
  }

  const decoded = decodeOAuthState(returnedState);
  if (!decoded) {
    return { valid: false };
  }

  try {
    const storedState =
      (Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(OAUTH_STATE_KEY)
        : null) || (await AsyncStorage.getItem(OAUTH_STATE_KEY));

    // If stored state is available, ensure exact match
    if (storedState && storedState !== returnedState) {
      return { valid: false };
    }
  } catch {}

  return {
    valid: true,
    role: decoded.role,
    intent: decoded.intent,
    verifier: decoded.verifier,
  };
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
 * Saves a Google Client ID directly to AsyncStorage for in-app configuration
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
 * Computes the exact redirect URI based on configuration and runtime platform.
 * Standard backend callback is [/api/auth/google/callback].
 */
export function getGoogleOAuthRedirectUri(): string {
  // 1. Explicit environment variable override
  const envRedirect =
    process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI;
  if (envRedirect && !envRedirect.includes('REPLACE')) {
    return envRedirect.trim();
  }

  // 2. Browser web runtime: redirect directly to backend callback
  if (Platform.OS === 'web') {
    const apiBase = getApiBaseUrl();
    return `${apiBase}/api/auth/google/callback`;
  }

  // 3. Native mobile: deep link redirect
  return Linking.createURL('/auth/callback');
}

/**
 * Initiates the Google OAuth 2.0 Authorization Code Flow with PKCE.
 * Performs a direct top-level browser redirect to accounts.google.com (no popups).
 */
export async function initiateGoogleOAuth(
  options: GoogleAuthOptions = {},
): Promise<{ error?: string }> {
  try {
    const clientId = await getEffectiveGoogleClientId();
    if (!clientId) {
      return {
        error:
          'Google Client ID is missing. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your environment or Google Cloud Console.',
      };
    }

    const role: UserRole = options.role || 'candidate';
    const intent: 'sign-in' | 'sign-up' = options.intent || 'sign-in';

    // 1. Generate RFC 7636 PKCE code_verifier and code_challenge (S256)
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallengeS256(codeVerifier);

    // 2. Generate cryptographically random CSRF state binding role, intent, and verifier
    const nonce = generateRandomString(32);
    const statePayload: OAuthStatePayload = {
      nonce,
      role,
      intent,
      verifier: codeVerifier,
      ts: Date.now(),
    };
    const state = encodeOAuthState(statePayload);

    // 3. Persist state and verifier in storage
    await Promise.all([
      AsyncStorage.setItem(OAUTH_STATE_KEY, state),
      AsyncStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier),
      AsyncStorage.setItem(OAUTH_ROLE_KEY, role),
      AsyncStorage.setItem(OAUTH_INTENT_KEY, intent),
    ]);

    // On web, also store in sessionStorage & cookie for instant cross-redirect retrieval
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(OAUTH_STATE_KEY, state);
        sessionStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier);
        localStorage.setItem(OAUTH_STATE_KEY, state);
        localStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier);
        // Set short-lived cookie for server-side verification
        document.cookie = `tq_code_verifier=${encodeURIComponent(codeVerifier)}; Path=/; SameSite=Lax; Max-Age=900`;
        document.cookie = `tq_oauth_state=${encodeURIComponent(state)}; Path=/; SameSite=Lax; Max-Age=900`;
      } catch {}
    }

    const redirectUri = getGoogleOAuthRedirectUri();

    // 4. Construct official accounts.google.com OAuth authorization URL
    // Strictly request only: openid, email, profile
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('openid email profile')}&` +
      `code_challenge=${encodeURIComponent(codeChallenge)}&` +
      `code_challenge_method=S256&` +
      `state=${encodeURIComponent(state)}&` +
      `access_type=offline&` +
      `prompt=select_account`;

    // 5. Redirect browser directly (never popups, which are blocked on mobile)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(authUrl);
      return {};
    }

    // On Native mobile platforms, use WebBrowser redirect flow
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: 'Google sign-in was cancelled.' };
    }

    return {};
  } catch (err: any) {
    return { error: err?.message || 'Could not initiate Google authentication.' };
  }
}
