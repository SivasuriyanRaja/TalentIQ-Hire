/**
 * @deprecated The mock modal has been removed and replaced with real Google OAuth 2.0 PKCE flow.
 * This compatibility stub satisfies any pending Metro bundler cache resolutions during hot reload.
 */
export interface GoogleProfilePayload {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
}

export function GoogleAccountModal() {
  return null;
}

export default GoogleAccountModal;
