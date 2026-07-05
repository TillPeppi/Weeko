/**
 * Animated launch splash: a blue light pulse travels through the Weeko "W"
 * mark like a heartbeat. Shown while the DB initialises and stores hydrate,
 * then swapped for the app. Mirrors the app surface colors so the native
 * (static) splash blends seamlessly into this animated one.
 *
 * Driven by a requestAnimationFrame loop that sets `strokeDashoffset` as a
 * plain prop — this renders identically on web and native, unlike Reanimated's
 * animatedProps which don't propagate to SVG attributes on web. The per-frame
 * re-render is a non-issue for a short-lived splash with nothing else running.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Svg, { Path } from 'react-native-svg';

// The "W" mark as a single stroke (viewBox 0 0 96 96), matching assets/logo.
const W_PATH = 'M31 33 L40 65 L48 38 L56 65 L65 33';
// Dash pattern: one short bright segment (the pulse) + a long gap so only a
// single pulse is ever on the path. The offset travels a full pattern length
// (GAP + TRAIL) so the loop wraps seamlessly with no visible jump.
const TRAIL = 44;
const GAP = 220;
const CYCLE_MS = 1600;

const COLORS = {
  light: { bg: '#f1ebde', ink: '#141519', pulse: '#3d7fd6' },
  dark: { bg: '#15161b', ink: '#f1ecdf', pulse: '#5b9df0' },
} as const;

export function SplashPulse({ onLayout }: { onLayout?: () => void }) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const [offset, setOffset] = useState(GAP);

  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const loop = (t: number) => {
      if (start === null) start = t;
      const progress = ((t - start) % CYCLE_MS) / CYCLE_MS;
      setOffset(GAP + (-TRAIL - GAP) * progress); // GAP -> -TRAIL
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <View
      onLayout={onLayout}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.bg,
      }}
    >
      <Svg width={148} height={148} viewBox="0 0 96 96">
        <Path
          d={W_PATH}
          fill="none"
          stroke={c.ink}
          strokeOpacity={0.16}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={W_PATH}
          fill="none"
          stroke={c.pulse}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${TRAIL},${GAP}`}
          strokeDashoffset={offset}
        />
      </Svg>
    </View>
  );
}
