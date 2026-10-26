import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  type FlatListProps,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Wordmark } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  accent: string;
  ornamentColor: string;
}

const slides: OnboardingSlide[] = [
  {
    id: 'match',
    eyebrow: 'AI-POWERED PRECISION',
    title: 'Your match,\nnot a guess.',
    subtitle:
      'TalentIQ scores you against every job — measuring skill overlap, experience depth, and role fit so you know where you truly stand.',
    icon: 'zap',
    accent: '#2D4038',
    ornamentColor: '#3A4B43',
  },
  {
    id: 'gaps',
    eyebrow: 'SKILL GAP ANALYSIS',
    title: 'Know exactly\nwhat to build.',
    subtitle:
      'See which skills you already have, and which ones to develop. Real, specific guidance — not generic feedback.',
    icon: 'target',
    accent: '#2D3040',
    ornamentColor: '#3A4050',
  },
  {
    id: 'assess',
    eyebrow: 'SMART ASSESSMENTS',
    title: 'Prove it\nbefore the call.',
    subtitle:
      'Take AI-generated assessments tailored to every role. Demonstrate your strengths with evidence, not just keywords.',
    icon: 'check-square',
    accent: '#3A2D30',
    ornamentColor: '#4A3B3E',
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef<NonNullable<FlatListProps<OnboardingSlide>['onViewableItemsChanged']>>(
    ({ viewableItems }) => {
      if (viewableItems.length > 0 && viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const goNext = () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      router.replace('/(auth)/sign-up');
    }
  };

  const skip = () => {
    router.replace('/role-select');
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Wordmark />
        <Pressable onPress={skip} hitSlop={12}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
            {isLast ? '' : 'Skip'}
          </Text>
        </Pressable>
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item, index }) => <Slide slide={item} index={index} scrollX={scrollX} />}
      />

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const inputRange = [
              (i - 1) * SCREEN_WIDTH,
              i * SCREEN_WIDTH,
              (i + 1) * SCREEN_WIDTH,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 22, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity, backgroundColor: colors.primary },
                ]}
              />
            );
          })}
        </View>

        {/* CTA Button */}
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
            {isLast ? 'Get started' : 'Continue'}
          </Text>
          <Feather
            name={isLast ? 'arrow-up-right' : 'arrow-right'}
            size={18}
            color={colors.primaryForeground}
          />
        </Pressable>

        {isLast ? (
          <Pressable onPress={skip} style={styles.guestRow}>
            <Text style={[styles.guestText, { color: colors.mutedForeground }]}>
              Explore without an account
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Slide({
  slide,
  index,
  scrollX,
}: {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
}) {
  const colors = useColors();

  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.88, 1, 0.88],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [18, 0, 18],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.55, 1, 0.55],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.slide}>
      {/* Hero card */}
      <Animated.View
        style={[
          styles.heroCard,
          { backgroundColor: colors.foreground, transform: [{ scale }, { translateY }], opacity },
        ]}
      >
        {/* Decorative orbs */}
        <View style={[styles.orbLarge, { backgroundColor: slide.ornamentColor }]} />
        <View style={[styles.orbSmall, { backgroundColor: slide.ornamentColor, opacity: 0.5 }]} />

        {/* Eyebrow */}
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowBadge, { backgroundColor: slide.accent }]}>
            <Feather name={slide.icon} size={11} color="#F0A895" />
            <Text style={styles.eyebrowText}>{slide.eyebrow}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.slideTitle, { color: colors.background }]}>
          {slide.title}
        </Text>

        {/* Animated score preview (slide 1 only) */}
        {index === 0 ? (
          <View style={styles.scorePreview}>
            <View style={[styles.scoreBar, { backgroundColor: slide.accent }]}>
              <View style={[styles.scoreBarFill, { backgroundColor: '#F0A895', width: '78%' }]} />
            </View>
            <View style={styles.scoreLabels}>
              <Text style={styles.scoreLabel}>Skills</Text>
              <Text style={[styles.scoreValue, { color: colors.background }]}>78%</Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: slide.accent }]}>
              <View style={[styles.scoreBarFill, { backgroundColor: '#F0A895', width: '91%' }]} />
            </View>
            <View style={styles.scoreLabels}>
              <Text style={styles.scoreLabel}>Experience</Text>
              <Text style={[styles.scoreValue, { color: colors.background }]}>91%</Text>
            </View>
          </View>
        ) : null}

        {/* Gap chips (slide 2 only) */}
        {index === 1 ? (
          <View style={styles.chipRow}>
            {['React Native', 'TypeScript', 'GraphQL'].map((skill) => (
              <View key={skill} style={[styles.skillChip, { backgroundColor: slide.accent }]}>
                <Feather name="check" size={10} color="#F0A895" />
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
            {['Kubernetes'].map((skill) => (
              <View key={skill} style={[styles.skillChip, { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' }]}>
                <Feather name="plus" size={10} color="#888" />
                <Text style={[styles.skillChipText, { color: '#888' }]}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Assessment preview (slide 3 only) */}
        {index === 2 ? (
          <View style={[styles.assessCard, { backgroundColor: slide.accent }]}>
            <Text style={styles.assessEyebrow}>SKILL CHECK</Text>
            <Text style={[styles.assessTitle, { color: colors.background }]}>
              What rendering strategy does React Native use?
            </Text>
            {['Native bridge', 'JSI (direct)'].map((opt, i) => (
              <View
                key={opt}
                style={[
                  styles.assessOption,
                  { backgroundColor: i === 1 ? '#F0A895' : 'rgba(255,255,255,0.08)' },
                ]}
              >
                <Text style={[styles.assessOptionText, { color: i === 1 ? '#182321' : colors.background }]}>
                  {opt}
                </Text>
                {i === 1 ? <Feather name="check" size={12} color="#182321" /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>

      {/* Subtitle below card */}
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {slide.subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 24,
    paddingTop: 12,
  },
  heroCard: {
    width: '100%',
    borderRadius: 32,
    padding: 26,
    minHeight: 380,
    overflow: 'hidden',
    gap: 16,
  },
  orbLarge: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -90,
    top: -60,
  },
  orbSmall: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    right: 10,
    top: 100,
  },
  eyebrowRow: { flexDirection: 'row' },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  eyebrowText: {
    color: '#F0A895',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.9,
  },
  slideTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.4,
  },
  scorePreview: { gap: 8, marginTop: 4 },
  scoreBar: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 999 },
  scoreLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  scoreValue: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  skillChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#F0A895',
  },
  assessCard: { borderRadius: 18, padding: 14, gap: 10, marginTop: 4 },
  assessEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.5)',
  },
  assessTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 19,
  },
  assessOption: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assessOptionText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 999 },
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  guestRow: { paddingVertical: 4 },
  guestText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
