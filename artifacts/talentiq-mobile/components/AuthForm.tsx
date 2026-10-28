import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useSignIn, useSignUp } from '@/lib/authBridge';
import * as Haptics from 'expo-haptics';
import { Href, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Wordmark } from '@/components/ui';
import { UserRole } from '@/data/talentiq';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up';
}

export function AuthForm({ mode: initialMode }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState<'sign-in' | 'sign-up'>(initialMode);
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleTabChange = (tab: 'sign-in' | 'sign-up') => {
    if (tab !== activeTab) {
      void Haptics.selectionAsync();
      setActiveTab(tab);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(36, insets.bottom + 24),
        },
      ]}
      bottomOffset={30}
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top Bar with Back & Brand Wordmark ── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <Wordmark />

        <View style={{ width: 38 }} />
      </View>

      {/* ── Hero Brand Header with Ambient Orbs ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />

        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Feather name="zap" size={11} color="#F0A895" />
            <Text style={styles.heroBadgeText}>TALENTIQ IDENTITY</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>
          {activeTab === 'sign-in' ? (
            <>
              Welcome back.{'\n'}
              <Text style={{ color: '#F0A895' }}>Find your next move.</Text>
            </>
          ) : (
            <>
              Step into clarity.{'\n'}
              <Text style={{ color: '#F0A895' }}>Your career, elevated.</Text>
            </>
          )}
        </Text>

        <Text style={styles.heroSubtitle}>
          {activeTab === 'sign-in'
            ? 'Access your AI-scored matches, verified skills, and active job conversations.'
            : 'Join thousands of professionals and hiring teams using intelligent matchmaking.'}
        </Text>

        {/* ── Segmented Mode Switcher Tab ── */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => handleTabChange('sign-in')}
            style={[
              styles.tabButton,
              activeTab === 'sign-in' && styles.tabButtonActive,
            ]}
          >
            <Feather
              name="log-in"
              size={14}
              color={activeTab === 'sign-in' ? '#182321' : 'rgba(255, 255, 255, 0.65)'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'sign-in' && styles.tabTextActive,
              ]}
            >
              Sign In
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleTabChange('sign-up')}
            style={[
              styles.tabButton,
              activeTab === 'sign-up' && styles.tabButtonActive,
            ]}
          >
            <Feather
              name="user-plus"
              size={14}
              color={activeTab === 'sign-up' ? '#182321' : 'rgba(255, 255, 255, 0.65)'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'sign-up' && styles.tabTextActive,
              ]}
            >
              Create Account
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Value Propositions Strip ── */}
      <View style={styles.valueStrip}>
        <ValuePill icon="check-circle" text="94% Fit Accuracy" colors={colors} />
        <ValuePill icon="target" text="Skill Gap Analysis" colors={colors} />
        <ValuePill icon="shield" text="Private & Verified" colors={colors} />
      </View>

      {/* ── Dynamic Form Content ── */}
      {activeTab === 'sign-in' ? (
        <SignInSection onSwitchToSignUp={() => handleTabChange('sign-up')} />
      ) : (
        <SignUpSection onSwitchToSignIn={() => handleTabChange('sign-in')} />
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

function ValuePill({
  icon,
  text,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.valuePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon} size={12} color={colors.primary} />
      <Text style={[styles.valuePillText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGN IN SECTION
// ─────────────────────────────────────────────────────────────────────────────

function SignInSection({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { errors } = useSignIn();
  const { loginWithCredentials, loginDemo } = useTalentIQ();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setMessage('Please enter your password.');
      return;
    }

    setSending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await loginWithCredentials({ email: cleanEmail, password });
      if (!result.success) {
        setMessage(result.error ?? 'Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      setMessage(err?.message ?? 'Network error connecting to TalentIQ server.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.formBody}>
      <AuthInputField
        label="Email Address"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="name@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        testID="signin-email"
        error={errors.fields.identifier?.message}
      />

      <AuthInputField
        label="Password"
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry={!showPassword}
        isPassword
        showPassword={showPassword}
        onToggleShowPassword={() => {
          void Haptics.selectionAsync();
          setShowPassword(!showPassword);
        }}
        autoCapitalize="none"
        testID="signin-password"
        error={errors.fields.password?.message}
      />

      <View style={styles.extraRow}>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Password Reset',
              'Please contact support or follow the link sent to your registered email to reset your credentials.',
            );
          }}
          hitSlop={6}
        >
          <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot password?</Text>
        </Pressable>
      </View>

      {message ? (
        <View
          style={[
            styles.messageCard,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather
            name="alert-circle"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.messageText, { color: colors.foreground }]}>{message}</Text>
        </View>
      ) : null}

      <Pressable
        testID="signin-submit"
        disabled={sending}
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: colors.primary,
            opacity: sending ? 0.65 : pressed ? 0.86 : 1,
            ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
          },
        ]}
      >
        {sending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Text style={[styles.submitButtonText, { color: colors.primaryForeground }]}>
              Sign In
            </Text>
            <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
          </>
        )}
      </Pressable>

      {/* ── Social / Alternative Section ── */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or continue with</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.socialRow}>
        <SocialButton
          icon="globe"
          label="Google"
          colors={colors}
          onPress={() => {
            void Haptics.selectionAsync();
            Alert.alert('Google Sign-In', 'Connecting to Google OAuth...');
          }}
        />
        <SocialButton
          icon="smartphone"
          label="Apple"
          colors={colors}
          onPress={() => {
            void Haptics.selectionAsync();
            Alert.alert('Apple Sign-In', 'Connecting to Apple OAuth...');
          }}
        />
      </View>

      {/* ── Quick Demo Evaluation Access ── */}
      <View style={styles.demoBlock}>
        <Text style={[styles.demoPrompt, { color: colors.mutedForeground }]}>
          Instant preview access:
        </Text>
        <View style={styles.demoButtonsRow}>
          <Pressable
            onPress={() => void loginDemo('candidate')}
            style={({ pressed }) => [
              styles.demoBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Feather name="user" size={13} color={colors.primary} />
            <Text style={[styles.demoBtnText, { color: colors.foreground }]}>Candidate Demo</Text>
          </Pressable>
          <Pressable
            onPress={() => void loginDemo('recruiter')}
            style={({ pressed }) => [
              styles.demoBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Feather name="briefcase" size={13} color={colors.primary} />
            <Text style={[styles.demoBtnText, { color: colors.foreground }]}>Recruiter Demo</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Switcher to Sign Up ── */}
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>New to TalentIQ?</Text>
        <Pressable onPress={onSwitchToSignUp} hitSlop={6}>
          <Text style={[styles.switchLinkText, { color: colors.primary }]}>Create an account</Text>
        </Pressable>
      </View>

      <View nativeID="clerk-captcha" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGN UP SECTION
// ─────────────────────────────────────────────────────────────────────────────

function SignUpSection({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { errors } = useSignUp();
  const { role, setRole, registerWithCredentials } = useTalentIQ();

  const [selectedRole, setSelectedRole] = useState<UserRole>(role);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  const strength = getPasswordStrength(password);

  const handleRoleSelect = (newRole: UserRole) => {
    void Haptics.selectionAsync();
    setSelectedRole(newRole);
    setRole(newRole);
  };

  const submit = async () => {
    setMessage('');
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      setMessage('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long.');
      return;
    }

    setSendingCode(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await registerWithCredentials({
        name: cleanName,
        email: cleanEmail,
        password,
        role: selectedRole,
      });

      if (!result.success) {
        setMessage(result.error ?? 'We could not create your account. Please check your details and try again.');
      }
    } catch (err: any) {
      setMessage(err?.message ?? 'Network error connecting to TalentIQ server.');
    } finally {
      setSendingCode(false);
    }
  };

  return (
    <View style={styles.formBody}>
      {/* ── Role Selector ── */}
      <View style={styles.roleBlock}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>I want to use TalentIQ to:</Text>
            <View style={styles.roleChoiceRow}>
              <Pressable
                onPress={() => handleRoleSelect('candidate')}
                style={[
                  styles.roleChoiceCard,
                  {
                    backgroundColor: selectedRole === 'candidate' ? colors.accent : colors.card,
                    borderColor: selectedRole === 'candidate' ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={[styles.roleChoiceIcon, { backgroundColor: colors.background }]}>
                  <Feather name="compass" size={16} color={colors.primary} />
                </View>
                <View style={styles.roleChoiceCopy}>
                  <Text style={[styles.roleChoiceTitle, { color: colors.foreground }]}>Find Work</Text>
                  <Text style={[styles.roleChoiceSub, { color: colors.mutedForeground }]}>Job seeker</Text>
                </View>
                {selectedRole === 'candidate' && (
                  <Feather name="check-circle" size={16} color={colors.primary} />
                )}
              </Pressable>

              <Pressable
                onPress={() => handleRoleSelect('recruiter')}
                style={[
                  styles.roleChoiceCard,
                  {
                    backgroundColor: selectedRole === 'recruiter' ? colors.accent : colors.card,
                    borderColor: selectedRole === 'recruiter' ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={[styles.roleChoiceIcon, { backgroundColor: colors.background }]}>
                  <Feather name="briefcase" size={16} color={colors.primary} />
                </View>
                <View style={styles.roleChoiceCopy}>
                  <Text style={[styles.roleChoiceTitle, { color: colors.foreground }]}>Hire Talent</Text>
                  <Text style={[styles.roleChoiceSub, { color: colors.mutedForeground }]}>Recruiter</Text>
                </View>
                {selectedRole === 'recruiter' && (
                  <Feather name="check-circle" size={16} color={colors.primary} />
                )}
              </Pressable>
            </View>
          </View>

          <AuthInputField
            label="Full Name"
            icon="user"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Jordan Lee"
            autoCapitalize="words"
          />

          <AuthInputField
            label="Email Address"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder="jordan@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="signup-email"
            error={errors.fields.emailAddress?.message}
          />

          <AuthInputField
            label="Password"
            icon="lock"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 8 characters"
            secureTextEntry={!showPassword}
            isPassword
            showPassword={showPassword}
            onToggleShowPassword={() => {
              void Haptics.selectionAsync();
              setShowPassword(!showPassword);
            }}
            autoCapitalize="none"
            testID="signup-password"
            error={errors.fields.password?.message}
          />

          {/* ── Password Strength Bar ── */}
          {password.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthHeader}>
                <Text style={[styles.strengthTitle, { color: colors.mutedForeground }]}>
                  Password strength:
                </Text>
                <Text style={[styles.strengthRating, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
              <View style={styles.meterTrack}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      width: strength.score === 1 ? '33%' : strength.score === 2 ? '66%' : '100%',
                      backgroundColor: strength.color,
                    },
                  ]}
                />
              </View>
              <View style={styles.reqRow}>
                <View style={styles.reqItem}>
                  <Feather
                    name={strength.hasLength ? 'check' : 'circle'}
                    size={11}
                    color={strength.hasLength ? '#345748' : colors.mutedForeground}
                  />
                  <Text style={[styles.reqText, { color: strength.hasLength ? colors.foreground : colors.mutedForeground }]}>
                    8+ chars
                  </Text>
                </View>
                <View style={styles.reqItem}>
                  <Feather
                    name={strength.hasLetterAndNumber ? 'check' : 'circle'}
                    size={11}
                    color={strength.hasLetterAndNumber ? '#345748' : colors.mutedForeground}
                  />
                  <Text style={[styles.reqText, { color: strength.hasLetterAndNumber ? colors.foreground : colors.mutedForeground }]}>
                    Letters & numbers
                  </Text>
                </View>
              </View>
            </View>
          )}

      {message ? (
        <View style={[styles.messageCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.messageText, { color: colors.foreground }]}>{message}</Text>
        </View>
      ) : null}

      <Pressable
        testID="signup-submit"
        disabled={sendingCode}
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: colors.primary,
            opacity: sendingCode ? 0.65 : pressed ? 0.86 : 1,
            ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
          },
        ]}
      >
        {sendingCode ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Text style={[styles.submitButtonText, { color: colors.primaryForeground }]}>
              Create Account
            </Text>
            <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
          </>
        )}
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Already have an account?</Text>
        <Pressable onPress={onSwitchToSignIn} hitSlop={6}>
          <Text style={[styles.switchLinkText, { color: colors.primary }]}>Sign in</Text>
        </Pressable>
      </View>

      <Text style={[styles.termsNotice, { color: colors.mutedForeground }]}>
        By creating an account, you agree to TalentIQ’s Terms of Service and Privacy Policy.
      </Text>

      <View nativeID="clerk-captcha" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE AUTH INPUT COMPONENT WITH ICONS & FOCUS STATE
// ─────────────────────────────────────────────────────────────────────────────

interface AuthInputFieldProps extends TextInputProps {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  isPassword?: boolean;
  showPassword?: boolean;
  onToggleShowPassword?: () => void;
  error?: string;
}

function AuthInputField({
  label,
  icon,
  isPassword,
  showPassword,
  onToggleShowPassword,
  error,
  value,
  onChangeText,
  placeholder,
  testID,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: AuthInputFieldProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : isFocused ? colors.primary : colors.border,
            borderWidth: isFocused ? 1.5 : 1,
          },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={isFocused ? colors.primary : colors.mutedForeground}
          style={styles.leadingIcon}
        />
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.textInput,
            { color: colors.foreground },
            Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' } as any),
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={onToggleShowPassword}
            style={styles.eyeButton}
            hitSlop={8}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={17}
              color={showPassword ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
        ) : Boolean(value && value.length > 0) ? (
          <Pressable
            onPress={() => onChangeText?.('')}
            style={styles.eyeButton}
            hitSlop={8}
          >
            <Feather name="x-circle" size={15} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.fieldError, { color: colors.destructive }]}>{error}</Text>
      ) : null}
    </View>
  );
}

function SocialButton({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.socialButton,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Feather name={icon} size={15} color={colors.foreground} />
      <Text style={[styles.socialButtonText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function getPasswordStrength(pwd: string): {
  score: number;
  label: string;
  color: string;
  hasLength: boolean;
  hasLetterAndNumber: boolean;
} {
  if (!pwd) return { score: 0, label: '', color: '', hasLength: false, hasLetterAndNumber: false };
  const hasLength = pwd.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd) || /[^a-zA-Z0-9]/.test(pwd);
  const hasLetterAndNumber = hasLetter && hasNumber;
  let score = 0;
  if (pwd.length >= 6) score = 1;
  if (hasLength && (hasLetter || hasNumber)) score = 2;
  if (hasLength && hasLetterAndNumber) score = 3;

  if (score === 1) return { score, label: 'Weak', color: '#D85D49', hasLength, hasLetterAndNumber };
  if (score === 2) return { score, label: 'Good', color: '#E5A83B', hasLength, hasLetterAndNumber };
  return { score: 3, label: 'Strong', color: '#345748', hasLength, hasLetterAndNumber };
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  guestLinkText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: '#182321',
    borderRadius: 28,
    padding: 22,
    overflow: 'hidden',
    gap: 12,
  },
  heroOrbLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -80,
    top: -50,
    backgroundColor: '#394A43',
    opacity: 0.6,
  },
  heroOrbSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    right: 30,
    top: 70,
    backgroundColor: '#53655A',
    opacity: 0.4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#263630',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.1,
    color: '#F0A895',
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -1,
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255, 255, 255, 0.72)',
    maxWidth: 300,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 16,
    padding: 4,
    marginTop: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#F5F4EF',
  },
  tabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  tabTextActive: {
    color: '#182321',
  },
  valueStrip: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  valuePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  valuePillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  formBody: {
    gap: 16,
  },
  inputWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
  },
  leadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' } as any)
      : {}),
  },
  eyeButton: {
    padding: 6,
  },
  fieldError: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 2,
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -6,
  },
  forgotPasswordText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  messageText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  submitButton: {
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 4,
  },
  submitButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  switchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  switchLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  demoBlock: {
    gap: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  demoPrompt: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  demoBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  demoBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  termsNotice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  // ── Verification screen ──
  verifyBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  verifyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  verifyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.6,
  },
  verifySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  resendText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  // ── Role choice ──
  roleBlock: {
    gap: 8,
  },
  roleChoiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChoiceCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  roleChoiceIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChoiceCopy: {
    flex: 1,
    gap: 2,
  },
  roleChoiceTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  roleChoiceSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  // ── Password strength ──
  strengthWrap: {
    gap: 6,
    marginTop: -4,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  strengthRating: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  meterTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
  },
  reqRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 2,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
});
