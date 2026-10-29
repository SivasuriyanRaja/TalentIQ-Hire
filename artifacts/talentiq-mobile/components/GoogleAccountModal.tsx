import React, { useState } from 'react';
import {
  ActivityIndicator,
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
}

interface QuickAccount {
  id: string;
  name: string;
  email: string;
  roleHint: string;
  avatarBg: string;
  avatarText: string;
  picture?: string;
}

const PRESET_ACCOUNTS: QuickAccount[] = [
  {
    id: 'google_user_primary',
    name: 'Sivasuriyan Raja',
    email: 'sivasuriyanraja569@gmail.com',
    roleHint: 'Personal Google Account',
    avatarBg: '#4285F4',
    avatarText: 'SR',
    picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
  },
  {
    id: 'google_candidate_demo',
    name: 'Alex Morgan',
    email: 'alex.morgan@gmail.com',
    roleHint: 'Candidate Account',
    avatarBg: '#34A853',
    avatarText: 'AM',
    picture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120',
  },
  {
    id: 'google_recruiter_demo',
    name: 'Sarah Lin',
    email: 'sarah.recruiter@gmail.com',
    roleHint: 'Talent Acquisition Partner',
    avatarBg: '#EA4335',
    avatarText: 'SL',
    picture: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120',
  },
];

export function GoogleAccountModal({
  visible,
  intent,
  selectedRole = 'candidate',
  onClose,
  onSelectAccount,
}: GoogleAccountModalProps) {
  const colors = useColors();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customError, setCustomError] = useState('');

  const handleSelect = async (account: GoogleProfilePayload, idTag: string) => {
    try {
      setLoadingId(idTag);
      void Haptics.selectionAsync();
      await onSelectAccount(account);
    } catch {
      // Error handled by parent
    } finally {
      setLoadingId(null);
    }
  };

  const handleCustomSubmit = async () => {
    setCustomError('');
    const cleanEmail = customEmail.trim().toLowerCase();
    const cleanName = customName.trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setCustomError('Please enter a valid Google account email.');
      return;
    }

    if (!cleanName) {
      setCustomError('Please enter your full name.');
      return;
    }

    await handleSelect(
      {
        email: cleanEmail,
        name: cleanName,
        googleId: `google_custom_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=4285F4&color=fff`,
      },
      'custom',
    );
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
          {/* Top Bar with Google Branding */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <GoogleIcon size={22} />
              <Text style={[styles.googleTitle, { color: colors.foreground }]}>
                Sign in with Google
              </Text>
            </View>

            <Pressable
              disabled={Boolean(loadingId)}
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Close account chooser"
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Context Subtitle & Intent Badge */}
          <View style={styles.subtitleBlock}>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Choose an account to continue to{' '}
              <Text style={{ fontWeight: '700', color: colors.foreground }}>
                TalentIQ AI
              </Text>
            </Text>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    intent === 'sign-up' ? colors.primary + '18' : colors.secondary,
                  borderColor:
                    intent === 'sign-up' ? colors.primary + '40' : colors.border,
                },
              ]}
            >
              <Feather
                name={intent === 'sign-up' ? 'user-plus' : 'log-in'}
                size={12}
                color={intent === 'sign-up' ? colors.primary : colors.foreground}
              />
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      intent === 'sign-up' ? colors.primary : colors.foreground,
                  },
                ]}
              >
                {intent === 'sign-up'
                  ? `CREATE ACCOUNT AS ${selectedRole.toUpperCase()}`
                  : 'SIGN IN TO TALENTIQ'}
              </Text>
            </View>
          </View>

          {/* Account Choices List */}
          <ScrollView
            style={styles.accountsList}
            showsVerticalScrollIndicator={false}
          >
            {PRESET_ACCOUNTS.map((acc) => {
              const isThisLoading = loadingId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  disabled={Boolean(loadingId)}
                  onPress={() =>
                    handleSelect(
                      {
                        email: acc.email,
                        name: acc.name,
                        picture: acc.picture,
                        googleId: acc.id,
                      },
                      acc.id,
                    )
                  }
                  style={({ pressed }) => [
                    styles.accountItem,
                    {
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.accent : 'transparent',
                      opacity: loadingId && !isThisLoading ? 0.45 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatarBadge,
                      { backgroundColor: acc.avatarBg },
                    ]}
                  >
                    <Text style={styles.avatarText}>{acc.avatarText}</Text>
                  </View>

                  <View style={styles.accountInfo}>
                    <Text
                      style={[styles.accountName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </Text>
                    <Text
                      style={[
                        styles.accountEmail,
                        { color: colors.mutedForeground },
                      ]}
                      numberOfLines={1}
                    >
                      {acc.email}
                    </Text>
                    <Text
                      style={[
                        styles.accountHint,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {acc.roleHint}
                    </Text>
                  </View>

                  {isThisLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  )}
                </Pressable>
              );
            })}

            {/* Use Another Account Toggle */}
            {!showCustomForm ? (
              <Pressable
                disabled={Boolean(loadingId)}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setShowCustomForm(true);
                }}
                style={({ pressed }) => [
                  styles.useAnotherButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.accent : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.useAnotherIcon,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather
                    name="user-plus"
                    size={16}
                    color={colors.foreground}
                  />
                </View>
                <Text
                  style={[
                    styles.useAnotherText,
                    { color: colors.foreground },
                  ]}
                >
                  Use another Google account
                </Text>
              </Pressable>
            ) : (
              <View
                style={[
                  styles.customFormCard,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.customFormTitle,
                    { color: colors.foreground },
                  ]}
                >
                  Enter Google Account Details
                </Text>

                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Google Email
                  </Text>
                  <TextInput
                    value={customEmail}
                    onChangeText={setCustomEmail}
                    placeholder="you@gmail.com"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.inputField,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Full Name
                  </Text>
                  <TextInput
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="Your Name"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="words"
                    style={[
                      styles.inputField,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                </View>

                {customError ? (
                  <Text style={styles.errorText}>{customError}</Text>
                ) : null}

                <View style={styles.customFormActions}>
                  <Pressable
                    disabled={Boolean(loadingId)}
                    onPress={() => setShowCustomForm(false)}
                    style={[
                      styles.customCancelBtn,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.customCancelText,
                        { color: colors.foreground },
                      ]}
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={Boolean(loadingId)}
                    onPress={handleCustomSubmit}
                    style={[
                      styles.customSubmitBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    {loadingId === 'custom' ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primaryForeground}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.customSubmitText,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        Continue with Google
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Privacy & Terms footer */}
          <View style={styles.footer}>
            <Feather name="shield" size={13} color={colors.mutedForeground} />
            <Text
              style={[styles.footerText, { color: colors.mutedForeground }]}
            >
              Google will share your name, email address, and profile picture with
              TalentIQ AI to establish your secure identity.
            </Text>
          </View>
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
    padding: 20,
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  closeButton: {
    padding: 4,
  },
  subtitleBlock: {
    marginBottom: 16,
    gap: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  accountsList: {
    maxHeight: 340,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 12,
    marginBottom: 2,
  },
  accountHint: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  useAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  useAnotherIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  useAnotherText: {
    fontSize: 13,
    fontWeight: '600',
  },
  customFormCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 14,
    gap: 10,
  },
  customFormTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputField: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  customFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  customCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  customCancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customSubmitText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.25)',
  },
  footerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
  },
});
