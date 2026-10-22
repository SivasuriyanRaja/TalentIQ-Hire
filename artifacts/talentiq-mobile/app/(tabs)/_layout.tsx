import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  useSharedValue,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

// ── Animated tab icon ─────────────────────────────────────────────────────────

function AnimatedTabIcon({
  icon,
  label,
  focused,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  focused: boolean;
}) {
  const colors = useColors();

  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 18,
      stiffness: 200,
      mass: 0.7,
    });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => {
    const paddingH = interpolate(progress.value, [0, 1], [0, 14]);
    const bgOpacity = interpolate(progress.value, [0, 1], [0, 1]);
    return {
      paddingHorizontal: paddingH,
      backgroundColor: `rgba(${hexToRgb(colors.accent)}, ${bgOpacity})`,
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 1.08]);
    return { transform: [{ scale }] };
  });

  const labelStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.6, 1], [0, 0, 1]);
    const translateX = interpolate(progress.value, [0, 1], [-6, 0]);
    const maxWidth = interpolate(progress.value, [0, 1], [0, 80]);
    return { opacity, transform: [{ translateX }], maxWidth };
  });

  return (
    <Animated.View style={[styles.tabPill, pillStyle]}>
      <Animated.View style={iconStyle}>
        <Feather
          name={icon}
          size={20}
          color={focused ? colors.accentForeground : colors.mutedForeground}
        />
      </Animated.View>
      <Animated.Text
        style={[
          styles.tabLabel,
          { color: colors.accentForeground },
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

/** Convert hex color to rgb triplet string for use in rgba() */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '100, 150, 120';
  return `${r}, ${g}, ${b}`;
}

// ── Tab layout ────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const tabs: Array<{
    name: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
  }> = [
    { name: 'index', icon: 'home', label: 'Home' },
    { name: 'jobs', icon: 'compass', label: 'Discover' },
    { name: 'applications', icon: 'layers', label: 'Activity' },
    { name: 'profile', icon: 'user', label: 'Profile' },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          height: 84,
          paddingTop: 9,
          paddingBottom: isWeb ? 16 : 20,
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopColor: colors.border,
          borderTopWidth: isWeb ? 1 : StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={78}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused }) => (
              <AnimatedTabIcon icon={tab.icon} label={tab.label} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    overflow: 'hidden',
  },
});
