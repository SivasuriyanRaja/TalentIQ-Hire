import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useSignIn, useSignUp } from '@clerk/expo';
import { Href, Link, useRouter } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { Field, PrimaryButton, Wordmark } from '@/components/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return mode === 'sign-in' ? <SignInForm /> : <SignUpForm />;
}

function SignUpForm() {
  const colors = useColors();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  const isVerifying =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  const submit = async () => {
    setMessage('');
    setSendingCode(true);
    try {
      const { error } = await signUp.password({ emailAddress: email.trim(), password });
      if (error) {
        setMessage(error.message ?? 'We could not create your account. Check your details and try again.');
        return;
      }
      const result = await signUp.verifications.sendEmailCode();
      if (result.error) {
        setMessage(result.error.message ?? 'We could not send your verification code.');
      }
    } catch {
      setMessage('We could not reach the sign-in service. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const verify = async () => {
    setMessage('');
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (error) {
        setMessage(error.message ?? 'That code did not work. Check it and try again.');
        return;
      }
      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: ({ decorateUrl }) => router.replace(decorateUrl('/role-select') as Href),
        });
      } else {
        setMessage('Your sign-up needs another step. Please contact your administrator.');
      }
    } catch {
      setMessage('We could not verify that code. Please try again.');
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={styles.formContent}
      bottomOffset={30}
      keyboardDismissMode="interactive"
    >
      <Wordmark />
      <View style={styles.formIntro}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>A BETTER WAY TO GET THERE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isVerifying ? 'Check your inbox.' : 'Make your next move.'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {isVerifying
            ? `We sent a six-digit code to ${email}.`
            : 'Create your TalentIQ account to save your matches and progress.'}
        </Text>
      </View>

      {isVerifying ? (
        <Field
          label="Email verification code"
          value={code}
          onChangeText={setCode}
          placeholder="Enter your 6-digit code"
          keyboardType="number-pad"
          autoCapitalize="none"
          testID="verification-code"
        />
      ) : (
        <>
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="signup-email"
          />
          {errors.fields.emailAddress?.message ? (
            <Text style={[styles.inlineError, { color: colors.destructive }]}>
              {errors.fields.emailAddress.message}
            </Text>
          ) : null}
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            testID="signup-password"
          />
          {errors.fields.password?.message ? (
            <Text style={[styles.inlineError, { color: colors.destructive }]}>
              {errors.fields.password.message}
            </Text>
          ) : null}
        </>
      )}

      {message ? (
        <View style={[styles.message, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.messageText, { color: colors.foreground }]}>{message}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={isVerifying ? 'Verify email' : 'Create account'}
        icon={isVerifying ? 'check' : 'arrow-right'}
        loading={sendingCode || fetchStatus === 'fetching'}
        disabled={isVerifying ? code.length < 4 : !email.includes('@') || password.length < 8}
        onPress={isVerifying ? verify : submit}
        testID="signup-submit"
      />
      {isVerifying ? (
        <Pressable
          onPress={async () => {
            setMessage('');
            const result = await signUp.verifications.sendEmailCode();
            if (result.error) setMessage(result.error.message ?? 'Could not resend the code.');
          }}
          style={styles.resend}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>Send a new code</Text>
        </Pressable>
      ) : null}

      <View nativeID="clerk-captcha" />
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
          Already have an account?
        </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable><Text style={[styles.linkText, { color: colors.primary }]}>Sign in</Text></Pressable>
        </Link>
      </View>
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>
        By continuing, you agree to use your account responsibly and keep your login details private.
      </Text>
    </KeyboardAwareScrollViewCompat>
  );
}

function SignInForm() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const needsTrustCode = signIn.status === 'needs_client_trust';

  const finalize = async () => {
    await signIn.finalize({
      navigate: ({ decorateUrl }) => router.replace(decorateUrl('/(tabs)') as Href),
    });
  };

  const submit = async () => {
    setMessage('');
    setSending(true);
    try {
      const { error } = await signIn.password({ emailAddress: email.trim(), password });
      if (error) {
        setMessage(error.message ?? 'We could not sign you in. Check your details and try again.');
        return;
      }
      if (signIn.status === 'complete') {
        await finalize();
      } else if (signIn.status === 'needs_client_trust') {
        const emailCode = signIn.supportedSecondFactors.find(
          (factor) => factor.strategy === 'email_code',
        );
        if (emailCode) {
          const result = await signIn.mfa.sendEmailCode();
          if (result.error) setMessage(result.error.message ?? 'Could not send your sign-in code.');
        } else {
          setMessage('This account needs an additional sign-in step we cannot complete here.');
        }
      } else {
        setMessage('Sign-in needs another step. Please contact your administrator.');
      }
    } catch {
      setMessage('We could not reach the sign-in service. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const verifyTrust = async () => {
    setMessage('');
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (error) {
        setMessage(error.message ?? 'That code did not work. Check it and try again.');
      } else if (signIn.status === 'complete') {
        await finalize();
      }
    } catch {
      setMessage('We could not verify that code. Please try again.');
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={styles.formContent}
      bottomOffset={30}
      keyboardDismissMode="interactive"
    >
      <Wordmark />
      <View style={styles.formIntro}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>GOOD TO HAVE YOU BACK</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {needsTrustCode ? 'Verify it’s you.' : 'Welcome back.'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {needsTrustCode
            ? 'We’ve sent a verification code to your email.'
            : 'Sign in to pick up where you left off.'}
        </Text>
      </View>
      {needsTrustCode ? (
        <Field
          label="Email verification code"
          value={code}
          onChangeText={setCode}
          placeholder="Enter your code"
          keyboardType="number-pad"
          testID="signin-verification-code"
        />
      ) : (
        <>
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="signin-email"
          />
          {errors.fields.identifier?.message ? (
            <Text style={[styles.inlineError, { color: colors.destructive }]}>
              {errors.fields.identifier.message}
            </Text>
          ) : null}
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            testID="signin-password"
          />
          {errors.fields.password?.message ? (
            <Text style={[styles.inlineError, { color: colors.destructive }]}>
              {errors.fields.password.message}
            </Text>
          ) : null}
        </>
      )}

      {message ? (
        <View style={[styles.message, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.messageText, { color: colors.foreground }]}>{message}</Text>
        </View>
      ) : null}
      <PrimaryButton
        label={needsTrustCode ? 'Verify and continue' : 'Sign in'}
        icon="arrow-right"
        loading={sending || fetchStatus === 'fetching'}
        disabled={needsTrustCode ? code.length < 4 : !email.includes('@') || !password}
        onPress={needsTrustCode ? verifyTrust : submit}
        testID="signin-submit"
      />
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
          New to TalentIQ?
        </Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable><Text style={[styles.linkText, { color: colors.primary }]}>Create an account</Text></Pressable>
        </Link>
      </View>
      <View nativeID="clerk-captcha" />
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  formContent: { flexGrow: 1, padding: 24, paddingTop: 25, paddingBottom: 40, gap: 17 },
  formIntro: { gap: 9, marginTop: 27, marginBottom: 10 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.15 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 38, letterSpacing: -1.25 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  inlineError: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: -9 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 14 },
  messageText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  linkText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  resend: { alignItems: 'center', padding: 7 },
  privacy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 'auto' },
});
