import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTalentIQ } from '@/state/TalentIQContext';

interface TabItemProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
  badge?: number;
}

function TabBarIcon({ icon, focused, badge }: TabItemProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.iconContainer,
        focused && {
          backgroundColor: colors.accent,
        },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={focused ? colors.accentForeground : colors.mutedForeground}
      />
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isUserSignedIn, authMode, isLoaded, applications } = useTalentIQ();
  const isDark = useColorScheme() === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  // Secondary protection layer: If logged out, cannot stay in tabs
  if (isLoaded && !isUserSignedIn && authMode === 'unauthenticated') {
    return <Redirect href="/" />;
  }

  const bottomInset = isWeb ? 8 : Math.max(insets.bottom, isIOS ? 18 : 8);
  const barHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentForeground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10.5,
          letterSpacing: 0.1,
          marginTop: 2,
        },
        tabBarStyle: {
          height: barHeight,
          paddingTop: 6,
          paddingBottom: bottomInset,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Discover',
          tabBarLabel: 'Discover',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="compass" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Activity',
          tabBarLabel: 'Activity',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              icon="layers"
              focused={focused}
              badge={applications?.length > 0 ? applications.length : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    lineHeight: 11,
  },
});

