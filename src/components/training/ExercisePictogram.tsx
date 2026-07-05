/**
 * Stick-figure pictograms for the built-in exercise catalog, keyed by
 * exercise.slug (db/seeds). Pure SVG (react-native-svg) so they work
 * offline, scale freely and follow the ink color in both themes.
 * Unknown/custom exercises fall back to a dumbbell glyph.
 */
import Svg, { Circle, Path } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import { uiColor } from '@/constants/uiColors';

interface PictogramSpec {
  /** head center */
  head?: [number, number];
  /** stroked path segments (the figure + equipment) */
  paths: string[];
  /** kettlebell body centers */
  kbs?: [number, number][];
  /** faint floor line */
  ground?: boolean;
}

/** All figures live in a 64×64 box; ground sits at y=58. */
const SPECS: Record<string, PictogramSpec> = {
  pullup: {
    head: [32, 19],
    paths: ['M10 9 L54 9', 'M20 9 L30 25', 'M44 9 L34 25', 'M32 24 L32 41', 'M32 41 L27 57', 'M32 41 L37 57'],
  },
  chinup: {
    head: [32, 19],
    paths: ['M10 9 L54 9', 'M20 9 L30 25', 'M44 9 L34 25', 'M32 24 L32 41', 'M32 41 L26 48 L33 53', 'M32 41 L30 50 L37 54'],
  },
  hangingLegRaise: {
    head: [32, 19],
    paths: ['M10 9 L54 9', 'M20 9 L30 25', 'M44 9 L34 25', 'M32 24 L32 40', 'M32 40 L48 37', 'M32 40 L48 43'],
  },
  kbRow: {
    head: [19, 21],
    ground: true,
    paths: ['M40 38 L37 57', 'M40 38 L45 57', 'M40 38 L24 26', 'M24 26 L19 41', 'M26 27 L31 36 L29 43'],
    kbs: [[29, 50]],
  },
  dip: {
    head: [32, 12],
    paths: ['M10 24 L24 24', 'M40 24 L54 24', 'M32 19 L17 24', 'M32 19 L47 24', 'M32 18 L32 36', 'M32 36 L27 46 L33 51', 'M32 36 L31 47 L37 52'],
  },
  pushup: {
    head: [14, 33],
    ground: true,
    paths: ['M19 38 L54 52', 'M20 39 L14 47 L24 55', 'M50 51 L52 56'],
  },
  diamondPushup: {
    head: [14, 33],
    ground: true,
    paths: ['M19 38 L54 52', 'M20 39 L18 47 L26 55', 'M50 51 L52 56', 'M27 52 l4 -4 l4 4 l-4 4 z'],
  },
  pikePushup: {
    head: [18, 46],
    ground: true,
    paths: ['M34 26 L16 52', 'M34 26 L50 54', 'M28 35 L24 52'],
  },
  kbPress: {
    head: [30, 14],
    ground: true,
    paths: ['M30 20 L30 40', 'M30 40 L24 57', 'M30 40 L36 57', 'M30 24 L22 34', 'M30 24 L42 13'],
    kbs: [[46, 9]],
  },
  kbSwing: {
    head: [27, 16],
    ground: true,
    paths: ['M28 22 L30 40', 'M30 40 L24 57', 'M30 40 L36 57', 'M28 24 L46 28'],
    kbs: [[51, 31]],
  },
  gobletSquat: {
    head: [32, 16],
    ground: true,
    paths: ['M32 22 L32 36', 'M32 36 L22 44 L24 56', 'M32 36 L42 44 L40 56', 'M32 26 L27 31', 'M32 26 L37 31'],
    kbs: [[32, 33]],
  },
  kbLunge: {
    head: [30, 14],
    ground: true,
    paths: ['M30 20 L30 38', 'M30 38 L42 44 L42 57', 'M30 38 L20 48', 'M20 48 L12 56', 'M30 24 L34 38'],
    kbs: [[35, 44]],
  },
  kbDeadlift: {
    head: [16, 20],
    ground: true,
    paths: ['M36 34 L30 57', 'M36 34 L41 57', 'M36 34 L21 24', 'M22 25 L24 43'],
    kbs: [[25, 49]],
  },
  farmersCarry: {
    head: [32, 12],
    ground: true,
    paths: ['M32 18 L32 38', 'M32 38 L40 48 L40 57', 'M32 38 L26 48 L20 55', 'M32 22 L22 35', 'M32 22 L42 35'],
    kbs: [[21, 41], [43, 41]],
  },
  treadmillRun: {
    head: [26, 15],
    paths: [
      'M8 54 L50 50',
      'M48 50 L56 28',
      'M26 21 L30 37',
      'M27 24 L37 29',
      'M27 24 L18 27',
      'M30 37 L40 43 L38 52',
      'M30 37 L21 44 L18 36',
    ],
  },
  burpee: {
    head: [12, 38],
    ground: true,
    paths: ['M17 43 L46 52', 'M18 44 L13 55', 'M43 51 L45 56', 'M54 34 L54 16', 'M50 20 L54 16 L58 20'],
  },
  plank: {
    head: [13, 36],
    ground: true,
    paths: ['M18 40 L50 52', 'M19 41 L14 53', 'M14 53 L23 55', 'M48 51 L50 56'],
  },
  sidePlank: {
    head: [51, 28],
    ground: true,
    paths: ['M14 54 L47 34', 'M45 36 L43 54', 'M46 35 L52 20'],
  },
  hollowHold: {
    head: [12, 39],
    ground: true,
    paths: ['M14 44 Q32 58 50 42', 'M50 42 L56 36', 'M14 44 L8 38'],
  },
  russianTwist: {
    head: [20, 23],
    ground: true,
    paths: ['M30 48 L22 30', 'M30 48 L44 40', 'M44 40 L52 46', 'M24 33 L40 33'],
    kbs: [[45, 36]],
  },
  gluteBridge: {
    head: [10, 51],
    ground: true,
    paths: ['M16 52 L34 40', 'M34 40 L44 42', 'M44 42 L46 56', 'M18 52 L30 56'],
  },
  calfRaise: {
    head: [32, 10],
    ground: true,
    paths: ['M32 16 L32 36', 'M32 20 L26 32', 'M32 20 L38 32', 'M32 36 L28 50', 'M32 36 L36 50', 'M28 50 L31 57', 'M36 50 L39 57'],
  },
  wallSit: {
    head: [21, 16],
    ground: true,
    paths: ['M14 6 L14 56', 'M20 22 L20 40', 'M20 40 L36 40', 'M36 40 L36 56', 'M20 26 L28 31'],
  },
  pistolSquat: {
    head: [28, 18],
    ground: true,
    paths: ['M28 24 L26 38', 'M26 38 L48 42', 'M28 26 L44 28', 'M26 38 L19 46', 'M19 46 L24 57'],
  },
  bulgarianSplitSquat: {
    head: [30, 15],
    ground: true,
    paths: ['M30 20 L28 34', 'M28 34 L38 42', 'M38 42 L46 45', 'M28 34 L22 44', 'M22 44 L22 56', 'M29 24 L34 34', 'M44 45 L56 45 L56 57', 'M44 45 L44 57'],
  },
  mountainClimber: {
    head: [12, 33],
    ground: true,
    paths: ['M18 36 L50 50', 'M19 37 L15 52', 'M50 50 L53 56', 'M40 45 L28 44 L31 52'],
  },
  jumpSquat: {
    head: [32, 12],
    ground: true,
    paths: ['M32 18 L32 32', 'M32 22 L42 13', 'M32 22 L22 13', 'M32 32 L26 42 L28 50', 'M32 32 L38 42 L36 50', 'M20 55 L26 55', 'M38 55 L44 55'],
  },
};

/** fallback for custom exercises: a plain dumbbell */
const FALLBACK: PictogramSpec = {
  paths: ['M18 22 L18 42', 'M13 26 L13 38', 'M46 22 L46 42', 'M51 26 L51 38', 'M18 32 L46 32'],
};

function Kettlebell({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <>
      <Path
        d={`M${x - 4} ${y - 4} a4 4 0 0 1 8 0`}
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={x} cy={y + 2} r={4.5} stroke={color} strokeWidth={2.5} fill="none" />
    </>
  );
}

export function ExercisePictogram({
  slug,
  size = 44,
  color,
}: {
  slug: string | null | undefined;
  size?: number;
  color?: string;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const stroke = color ?? uiColor('ink', dark);
  const spec = (slug && SPECS[slug]) || FALLBACK;

  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      {spec.ground && (
        <Path d="M6 58 L58 58" stroke={stroke} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
      )}
      {spec.paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={stroke}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {spec.head && <Circle cx={spec.head[0]} cy={spec.head[1]} r={4.5} fill={stroke} />}
      {spec.kbs?.map(([x, y], i) => (
        <Kettlebell key={i} x={x} y={y} color={stroke} />
      ))}
    </Svg>
  );
}

/** True when a dedicated pictogram exists for this slug. */
export function hasPictogram(slug: string | null | undefined): boolean {
  return !!slug && slug in SPECS;
}
