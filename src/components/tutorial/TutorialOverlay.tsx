import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTutorialStore } from '../../store/tutorialStore';
import { useTutorialMeasure, type TargetRect } from './TutorialMeasureContext';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TUTORIAL_STEPS, TOTAL_STEPS } from './tutorialSteps';
import { COLORS, SPACING, RADIUS } from '../../theme';

const SCREEN_H = Dimensions.get('window').height;
// Reserve space so the tooltip never lands under the Skip/dots/Next bar
// or off the top edge, whatever the measured target's position is.
const TOOLTIP_RESERVED_BOTTOM = 130;

export function TutorialOverlay() {
  const { isActive, currentStep, next, skip, abort } = useTutorialStore();
  const { measure } = useTutorialMeasure();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  // Spotlight hole position is plain React state: one layout per step, no
  // per-frame animation — animating the hole (SVG mask or layout props on the
  // giant dim view) re-rasterized the full-screen layer every frame and was
  // unusably choppy on device. Polish comes from the opacity fades only.
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [tooltipTop, setTooltipTop] = useState(0);

  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const tooltipScale = useSharedValue(0.86);

  const measureTarget = useCallback(async (stepIdx: number, firstShow = false) => {
    const step = TUTORIAL_STEPS[stepIdx];
    if (!step) return;

    let measured: TargetRect | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      measured = await measure(step.targetId);
      if (measured) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!measured) {
      // Layout measurement failed — hide overlay without marking complete so it retries next launch.
      abort();
      return;
    }

    const padding = step.padding ?? 8;
    const rawTooltipY =
      step.tooltipPosition === 'above'
        ? measured.y - padding - 80
        : measured.y + measured.height + padding + 16;
    // Clamp on-screen: the swipe-card steps put "below" tooltips past the
    // action buttons on shorter devices.
    const clampedTooltipY = Math.min(
      Math.max(rawTooltipY, insets.top + 8),
      SCREEN_H - insets.bottom - TOOLTIP_RESERVED_BOTTOM,
    );

    setRect(measured);
    setTooltipTop(clampedTooltipY);

    if (firstShow) {
      setVisible(true);
      overlayOpacity.value = withTiming(1, { duration: 340 });
      tooltipScale.value = 0.86;
      tooltipOpacity.value = withTiming(1, { duration: 220 });
      tooltipScale.value = withSpring(1, { damping: 13, stiffness: 170 });
    } else {
      tooltipOpacity.value = withTiming(0, { duration: 120 }, () => {
        tooltipScale.value = 0.86;
        tooltipOpacity.value = withTiming(1, { duration: 220 });
        tooltipScale.value = withSpring(1, { damping: 13, stiffness: 170 });
      });
    }
  }, [abort, measure, insets.top, insets.bottom, overlayOpacity, tooltipOpacity, tooltipScale]);

  // Show/hide overlay — measurement gates visibility, so a failed measure
  // never flashes an unpositioned overlay.
  useEffect(() => {
    if (isActive && !visible) {
      measureTarget(0, true);
    } else if (!isActive && visible) {
      overlayOpacity.value = withTiming(0, { duration: 260 }, () => {
        runOnJS(setVisible)(false);
      });
    }
  }, [isActive, measureTarget, overlayOpacity, visible]);

  // Measure on step change
  useEffect(() => {
    if (isActive && currentStep > 0) {
      measureTarget(currentStep);
    }
  }, [currentStep, isActive, measureTarget]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ scale: tooltipScale.value }],
  }));

  if (!visible) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const isLast = currentStep === TOTAL_STEPS - 1;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={isActive ? 'auto' : 'none'}>
      {rect && <TutorialSpotlight rect={rect} padding={step?.padding ?? 8} />}

      {/* Tooltip */}
      <Animated.View style={[styles.tooltip, { top: tooltipTop }, tooltipStyle]}>
        <View style={styles.tooltipContent}>
          <Ionicons
            name={step?.icon as any}
            size={20}
            color={COLORS.purple}
            style={{ marginRight: SPACING.sm }}
          />
          <Text style={styles.tooltipText}>{step?.text}</Text>
        </View>
      </Animated.View>

      {/* Bottom nav */}
      <View style={[styles.nav, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity onPress={skip} hitSlop={12} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Step dots */}
        <View style={styles.dots}>
          {TUTORIAL_STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentStep && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
          <Ionicons
            name={isLast ? 'checkmark' : 'arrow-forward'}
            size={16}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  tooltip: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface2,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: 340,
  },
  tooltipText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: COLORS.purple,
    width: 18,
    borderRadius: 3,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.purple,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  nextText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
