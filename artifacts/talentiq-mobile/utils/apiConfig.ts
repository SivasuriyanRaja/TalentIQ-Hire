import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolves the backend API base URL depending on runtime environment:
 * 1. Explicit EXPO_PUBLIC_DOMAIN if configured (e.g. ngrok or remote server)
 * 2. On Web: http://localhost:5000
 * 3. On Physical Mobile (Expo Go): host IP from Constants.expoConfig.hostUri (e.g. 192.168.29.120:5000)
 * 4. On Android Emulator: http://10.0.2.2:5000
 * 5. Fallback: http://localhost:5000
 */
export function getApiBaseUrl(): string {
  const publicDomain = process.env.EXPO_PUBLIC_DOMAIN;

  // 1. Explicit domain or IP
  if (
    publicDomain &&
    !publicDomain.includes('localhost') &&
    !publicDomain.includes('127.0.0.1')
  ) {
    const clean = publicDomain.replace(/\/+$/, '');
    return clean.startsWith('http://') || clean.startsWith('https://')
      ? clean
      : `https://${clean}`;
  }

  // 2. Web browser: localhost:5000 works directly
  if (Platform.OS === 'web') {
    return 'http://localhost:5000';
  }

  // 3. Physical mobile device via Expo Go:
  // Packager host IP from Constants.expoConfig?.hostUri (e.g. "192.168.29.120:8081")
  const hostUri = Constants.expoConfig?.hostUri;
  const packagerIp = hostUri ? hostUri.split(':')[0] : null;

  if (packagerIp && packagerIp !== 'localhost' && packagerIp !== '127.0.0.1') {
    return `http://${packagerIp}:5000`;
  }

  // 4. Android Emulator loopback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  return 'http://localhost:5000';
}

/**
 * Return absolute API endpoint path (e.g. /sync/profile/resume -> http://192.168.29.120:5000/api/sync/profile/resume)
 */
export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}/api${cleanPath}`;
}
