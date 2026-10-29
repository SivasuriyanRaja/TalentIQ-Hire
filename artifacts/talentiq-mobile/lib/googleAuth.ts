import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { isClerkConfigured } from '@/lib/authBridge';
import { UserRole } from '@/data/talentiq';

// Complete WebBrowser auth session if returning from OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthOptions {
  role?: UserRole;
  intent?: 'sign-in' | 'sign-up';
}

/**
 * Returns true if real Google Client ID is configured in environment variables
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
 * Initiates Google OAuth 2.0 flow via WebBrowser or popup when Client ID is configured.
 * Returns the OAuth token/payload, or null if cancelled/failed.
 */
export async function startGoogleOAuthFlow(
  options: GoogleAuthOptions = {},
): Promise<{ token?: string; error?: string } | null> {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID;

  if (!clientId || clientId.includes('REPLACE')) {
    return null;
  }

  try {
    const redirectUri = Linking.createURL('/auth/callback');
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent('openid profile email')}&` +
      `prompt=select_account`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      // Parse hash fragment for access_token or id_token
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
