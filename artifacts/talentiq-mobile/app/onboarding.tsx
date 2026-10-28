import React, { useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Wordmark } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const { width: windowWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const goToSlide = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < slides.length) {
      setActiveIndex(nextIndex);
      try {
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      } catch {
        flatListRef.current?.scrollToOffset({
          offset: nextIndex * windowWidth,
          animated: true,
        });
      }
    } else if (nextIndex >= slides.length) {
      router.replace('/(auth)/sign-up');
    }
  };

  const goNext = () => {
    if (activeIndex < slides.length - 1) {
      goToSlide(activeIndex + 1);
    } else {
      router.replace('/(auth)/sign-up');
    }
  };

  const skipToSignIn = () => {
    router.replace('/(auth)/sign-in');
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn} accessibilityLabel="Back to welcome">
          <Feather name="arrow-left" size={19} color={colors.foreground} />
        </Pressable>
        <Wordmark />
        <Pressable onPress={skipToSignIn} hitSlop={12} style={styles.navLink}>
          <Text style={[styles.skipText, { color: colors.primary }]}>
            Sign In
          </Text>
        </Pressable>
      </View>

      {/* Slides Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: windowWidth,
          offset: windowWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: info.index * windowWidth,
              animated: true,
            });
          }, 60);
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          const offsetX = e.nativeEvent.contentOffset.x;
          const newIdx = Math.round(offsetX / windowWidth);
          if (newIdx >= 0 && newIdx < slides.length && newIdx !== activeIndex) {
            setActiveIndex(newIdx);
          }
        }}
        renderItem={({ item, index }) => (
          <Slide
            slide={item}
            index={index}
            scrollX={scrollX}
            slideWidth={windowWidth}
          />
        )}
      />

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Clickable Dot indicators */}
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const isCurrent = activeIndex === i;
            return (
              <Pressable
                key={i}
                onPress={() => goToSlide(i)}
                hitSlop={10}
                accessibilityLabel={`Go to slide ${i + 1}`}
                style={styles.dotTouchable}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      width: isCurrent ? 24 : 8,
                      opacity: isCurrent ? 1 : 0.35,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* CTA Button */}
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Create Account' : 'Continue to next slide'}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
            {isLast ? 'Create Account' : 'Continue'}
          </Text>
          <Feather
            name={isLast ? 'arrow-up-right' : 'arrow-right'}
            size={18}
            color={colors.primaryForeground}
          />
        </Pressable>

        <Pressable onPress={skipToSignIn} style={styles.guestRow} hitSlop={8}>
          <Text style={[styles.guestText, { color: colors.foreground }]}>
            {isLast ? (
              <>Already have an account? <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Sign In</Text></>
            ) : (
              'Skip to Sign In'
            )}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Slide({
  slide,
  index,
  scrollX,
  slideWidth,
}: {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
  slideWidth: number;
}) {
  const colors = useColors();

  const inputRange = [
    (index - 1) * slideWidth,
    index * slideWidth,
    (index + 1) * slideWidth,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [14, 0, 14],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.65, 1, 0.65],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.slide, { width: slideWidth }]}>
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
              <Text style={[styles.scoreLabel, { color: colors.background }]}>Skills</Text>
              <Text style={[styles.scoreValue, { color: colors.background }]}>78%</Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: slide.accent }]}>
              <View style={[styles.scoreBarFill, { backgroundColor: '#F0A895', width: '91%' }]} />
            </View>
            <View style={styles.scoreLabels}>
              <Text style={[styles.scoreLabel, { color: colors.background }]}>Experience</Text>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  navLink: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  skipText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  slide: {
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
  },
  heroCard: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
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
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.3,
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
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    opacity: 0.85,
  },
  scoreValue: { fontFamily: 'Inter_700Bold', fontSize: 11 },
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
    color: 'rgba(255,255,255,0.65)',
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
    maxWidth: 640,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 14,
    alignItems: 'center',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dotTouchable: {
    padding: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  dot: { height: 6, borderRadius: 999 },
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  ctaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  guestRow: {
    paddingVertical: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  guestText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
