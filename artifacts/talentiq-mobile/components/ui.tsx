import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? Math.max(67, insets.top) : 0;
  const bottomPadding = Platform.OS === 'web' ? 118 : Math.max(100, insets.bottom + 84);
  const content = (
    <View
      style={[
        styles.screenContent,
        { paddingTop: topPadding, paddingBottom: bottomPadding },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <KeyboardAwareScrollViewCompat
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          bottomOffset={22}
        >
          {content}
        </KeyboardAwareScrollViewCompat>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.wordmark}>
      <View style={[styles.mark, { backgroundColor: inverse ? '#F4B19F' : colors.primary }]}>
        <Feather name="aperture" size={16} color={inverse ? '#182321' : colors.primaryForeground} />
      </View>
      <Text style={[styles.wordmarkText, { color: inverse ? '#F7F4EC' : colors.foreground }]}>
        talentiq
      </Text>
    </View>
  );
}

export function Eyebrow({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <Text style={[styles.eyebrow, { color: color || colors.mutedForeground }, style]}>
      {children}
    </Text>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  tone = 'primary',
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'dark' | 'light';
  testID?: string;
}) {
  const colors = useColors();
  const backgroundColor =
    tone === 'dark'
      ? colors.foreground
      : tone === 'light'
        ? colors.secondary
        : colors.primary;
  const textColor =
    tone === 'dark'
      ? colors.background
      : tone === 'light'
        ? colors.secondaryForeground
        : colors.primaryForeground;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor, opacity: disabled ? 0.52 : pressed ? 0.84 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={textColor} /> : null}
          <Text style={[styles.primaryButtonText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, padding: 6 })}
    >
      <Feather name={icon} size={20} color={color ?? colors.foreground} />
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.field,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
            height: multiline ? 104 : 52,
          },
          Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' } as any),
        ]}
      />
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.secondary,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.accentForeground : colors.secondaryForeground },
        ]}
      >
        {label}
      </Text>
    </Wrapper>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function Avatar({
  initials,
  size = 46,
}: {
  initials: string;
  size?: number;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: colors.accent,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.avatarText, { color: colors.accentForeground, fontSize: size * 0.31 }]}>
        {initials}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon = 'inbox',
}: {
  title: string;
  body: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <Feather name={icon} size={26} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screenContent: { paddingHorizontal: 22, gap: 22 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  wordmarkText: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.7 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.25, textTransform: 'uppercase' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.55 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  fieldWrap: { gap: 8 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  field: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' } as any)
      : {}),
  },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  card: { borderRadius: 22, borderWidth: 1, padding: 17 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 38, paddingHorizontal: 22, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
