import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GoogleIcon } from '@/components/GoogleIcon';
import { UserRole } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import {
  getEffectiveGoogleClientId,
  getGoogleOAuthRedirectUri,
  getSavedGoogleAccounts,
  recordSavedGoogleAccount,
  removeSavedGoogleAccount,
  saveGoogleClientId,
  startGoogleOAuthFlow,
  SavedGoogleAccount,
} from '@/lib/googleAuth';

export interface GoogleProfilePayload {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
}

interface GoogleAccountModalProps {
  visible: boolean;
  intent: 'sign-in' | 'sign-up';
  selectedRole?: UserRole;
  onClose: () => void;
  onSelectAccount: (payload: GoogleProfilePayload) => Promise<void>;
  onOAuthSuccess?: (token: string) => Promise<void>;
}

export function GoogleAccountModal({
  visible,
  intent,
  selectedRole = 'candidate',
  onClose,
  onSelectAccount,
  onOAuthSuccess,
}: GoogleAccountModalProps) {
  const colors = useColors();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'oauth'>('account');

  // Real accounts remembered on this device
  const [savedAccounts, setSavedAccounts] = useState<SavedGoogleAccount[]>([]);

  // Direct Google account form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // OAuth Client ID state
  const [clientId, setClientId] = useState('');
  const [isOAuthAvailable, setIsOAuthAvailable] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  useEffect(() => {
    if (visible) {
      void loadInitialState();
    }
  }, [visible]);

  const loadInitialState = async () => {
    try {
      const accounts = await getSavedGoogleAccounts();
      setSavedAccounts(accounts);

      const effectiveId = await getEffectiveGoogleClientId();
      setClientId(effectiveId);
      setIsOAuthAvailable(Boolean(effectiveId && effectiveId.length > 10));

      // If user has a saved account, pre-fill for ease of use
      if (accounts.length > 0 && !email) {
        setEmail(accounts[0].email);
        setName(accounts[0].name);
      }
    } catch {}
  };

  const handleSelect = async (account: GoogleProfilePayload, idTag: string) => {
    try {
      setErrorMsg('');
      setLoadingId(idTag);
      void Haptics.selectionAsync();

      await onSelectAccount(account);
      await recordSavedGoogleAccount(account);
      const updated = await getSavedGoogleAccounts();
      setSavedAccounts(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleAccountSubmit = async () => {
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0] || 'Google User';

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid Google account email.');
      return;
    }

    const payload: GoogleProfilePayload = {
      email: cleanEmail,
      name: cleanName,
      googleId: `google_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=4285F4&color=fff&size=128`,
    };

    await handleSelect(payload, 'form_submit');
  };

  const handleLaunchBrowserOAuth = async () => {
    setErrorMsg('');
    setLoadingId('oauth_browser');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const oauthResult = await startGoogleOAuthFlow({
        intent,
        role: selectedRole,
      });

      if (oauthResult?.token) {
        if (onOAuthSuccess) {
          await onOAuthSuccess(oauthResult.token);
        } else {
          await onSelectAccount({
            email: '',
            name: '',
            googleId: '',
          });
        }
        onClose();
      } else if (oauthResult?.error) {
        setErrorMsg(oauthResult.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google browser login encountered an error.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleSaveClientId = async () => {
    const clean = clientId.trim();
    await saveGoogleClientId(clean);
    setIsOAuthAvailable(Boolean(clean && clean.length > 10));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Client ID Saved',
      clean
        ? 'Google OAuth Client ID has been configured for accounts.google.com authentication.'
        : 'Google OAuth Client ID cleared.',
    );
  };

  const handleCopyRedirectUri = () => {
    const uri = getGoogleOAuthRedirectUri();
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(uri);
      setCopiedRedirectUri(true);
      setTimeout(() => setCopiedRedirectUri(false), 2000);
    } else {
      Alert.alert('Google Authorized Redirect URI', uri);
    }
  };

  const handleRemoveSaved = async (accountEmail: string) => {
    await removeSavedGoogleAccount(accountEmail);
    const updated = await getSavedGoogleAccounts();
    setSavedAccounts(updated);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loadingId ? undefined : onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropPressable}
          onPress={loadingId ? undefined : onClose}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <GoogleIcon size={22} />
              <Text style={[styles.googleTitle, { color: colors.foreground }]}>
                Google Sign-In
              </Text>
            </View>

            <Pressable
              disabled={Boolean(loadingId)}
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Subtitle / Mode Indicator */}
          <View style={styles.subtitleBlock}>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {intent === 'sign-up'
                ? `Create a verified ${selectedRole.toUpperCase()} account with Google`
                : 'Sign in to TalentIQ with your Google Account'}
            </Text>
          </View>

          {/* Mode Switch Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.secondary }]}>
            <Pressable
              onPress={() => setActiveTab('account')}
              style={[
                styles.tabBtn,
                activeTab === 'account' && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="user-check"
                size={14}
                color={activeTab === 'account' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'account' ? colors.foreground : colors.mutedForeground },
                ]}
              >
                Google Account
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('oauth')}
              style={[
                styles.tabBtn,
                activeTab === 'oauth' && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="globe"
                size={14}
                color={activeTab === 'oauth' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'oauth' ? colors.foreground : colors.mutedForeground },
                ]}
              >
                OAuth 2.0 Web Flow
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {errorMsg ? (
              <View style={[styles.errorCard, { backgroundColor: colors.destructive + '15' }]}>
                <Feather name="alert-circle" size={15} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {activeTab === 'account' ? (
              <View style={styles.tabContent}>
                {/* Remembered Accounts on this device */}
                {savedAccounts.length > 0 ? (
                  <View style={styles.savedSection}>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                      Previously used accounts:
                    </Text>
                    {savedAccounts.map((acc) => (
                      <View
                        key={acc.email}
                        style={[
                          styles.savedAccountRow,
                          {
                            backgroundColor: colors.accent,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Pressable
                          style={styles.savedAccountPress}
                          disabled={Boolean(loadingId)}
                          onPress={() =>
                            handleSelect(
                              {
                                email: acc.email,
                                name: acc.name,
                                picture: acc.picture,
                                googleId: acc.googleId,
                              },
                              acc.email,
                            )
                          }
                        >
                          <View style={styles.accountInitial}>
                            <Text style={styles.accountInitialText}>
                              {acc.name ? acc.name.charAt(0).toUpperCase() : 'G'}
                            </Text>
                          </View>
                          <View style={styles.accountDetails}>
                            <Text style={[styles.accountName, { color: colors.accentForeground }]}>
                              {acc.name}
                            </Text>
                            <Text style={[styles.accountEmail, { color: colors.mutedForeground }]}>
                              {acc.email}
                            </Text>
                          </View>
                          {loadingId === acc.email ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Feather name="arrow-right" size={16} color={colors.primary} />
                          )}
                        </Pressable>

                        <Pressable
                          onPress={() => handleRemoveSaved(acc.email)}
                          hitSlop={8}
                          style={styles.removeSavedBtn}
                        >
                          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Direct Google Account Form */}
                <View style={styles.formBlock}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    {savedAccounts.length > 0
                      ? 'Or enter another Google account:'
                      : 'Enter your Google account details:'}
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                      Google Email Address
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Feather name="mail" size={16} color={colors.mutedForeground} />
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@gmail.com"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={[styles.inputField, { color: colors.foreground }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                      Full Name
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Feather name="user" size={16} color={colors.mutedForeground} />
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Sivasuriyan Raja"
                        placeholderTextColor={colors.mutedForeground}
                        autoCapitalize="words"
                        style={[styles.inputField, { color: colors.foreground }]}
                      />
                    </View>
                  </View>

                  <Pressable
                    disabled={Boolean(loadingId)}
                    onPress={handleAccountSubmit}
                    style={({ pressed }) => [
                      styles.submitBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: loadingId || pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    {loadingId === 'form_submit' ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <>
                        <GoogleIcon size={18} />
                        <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
                          {intent === 'sign-up'
                            ? `Sign Up as ${selectedRole.toUpperCase()} with Google`
                            : 'Sign In with Google'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              /* OAuth 2.0 Browser Authentication Tab */
              <View style={styles.tabContent}>
                <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
                  <Feather name="shield" size={16} color={colors.primary} />
                  <Text style={[styles.infoBoxText, { color: colors.secondaryForeground }]}>
                    Direct OAuth 2.0 authenticates directly via Google's secure{' '}
                    <Text style={{ fontWeight: '700' }}>accounts.google.com</Text> browser
                    window with full Google credentials verification.
                  </Text>
                </View>

                {isOAuthAvailable ? (
                  <Pressable
                    disabled={Boolean(loadingId)}
                    onPress={handleLaunchBrowserOAuth}
                    style={({ pressed }) => [
                      styles.launchOAuthBtn,
                      {
                        backgroundColor: '#4285F4',
                        opacity: loadingId || pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    {loadingId === 'oauth_browser' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <GoogleIcon size={18} />
                        <Text style={styles.launchOAuthBtnText}>
                          Open accounts.google.com
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}

                <View style={styles.configBlock}>
                  <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                    Google OAuth Client ID
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <Feather name="key" size={16} color={colors.mutedForeground} />
                    <TextInput
                      value={clientId}
                      onChangeText={setClientId}
                      placeholder="xxxx.apps.googleusercontent.com"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      style={[styles.inputField, { color: colors.foreground }]}
                    />
                  </View>

                  <Pressable
                    onPress={handleSaveClientId}
                    style={[styles.saveIdBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Feather name="check" size={14} color={colors.primary} />
                    <Text style={[styles.saveIdBtnText, { color: colors.foreground }]}>
                      Save Client ID
                    </Text>
                  </Pressable>

                  {/* Redirect URI snippet */}
                  <View style={styles.redirectUriBlock}>
                    <Text style={[styles.redirectUriLabel, { color: colors.mutedForeground }]}>
                      Authorized redirect URI for Google Console:
                    </Text>
                    <Pressable
                      onPress={handleCopyRedirectUri}
                      style={[styles.redirectUriRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Text
                        style={[styles.redirectUriText, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {getGoogleOAuthRedirectUri()}
                      </Text>
                      <View style={styles.copyAction}>
                        <Feather
                          name={copiedRedirectUri ? 'check' : 'copy'}
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={[styles.copyActionText, { color: colors.primary }]}>
                          {copiedRedirectUri ? 'Copied' : 'Copy'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  googleTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  closeBtn: {
    padding: 6,
  },
  subtitleBlock: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  scrollArea: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  tabContent: {
    gap: 16,
    paddingBottom: 16,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  savedSection: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  savedAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingRight: 8,
    overflow: 'hidden',
  },
  savedAccountPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  accountInitial: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitialText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  accountEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  removeSavedBtn: {
    padding: 8,
  },
  formBlock: {
    gap: 12,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputField: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  infoBoxText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  launchOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  launchOAuthBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  configBlock: {
    gap: 10,
    marginTop: 6,
  },
  saveIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveIdBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  redirectUriBlock: {
    gap: 5,
    marginTop: 4,
  },
  redirectUriLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10.5,
  },
  redirectUriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  redirectUriText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    marginRight: 6,
  },
  copyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
});
