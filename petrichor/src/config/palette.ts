/**
 * Petrichor Master Palette — 32 colors
 * Inspired by ENDESGA-32, tuned for pastoral atmosphere.
 * All sprites use ONLY these colors. Time-of-day variation
 * is achieved through shader-based color ramp remapping.
 */

// Master palette as hex values (0xRRGGBB)
export const MASTER_PALETTE = [
  // Darks (0-3)
  0x0d0b0e, // void black
  0x1a1a2e, // deep night blue
  0x16213e, // midnight
  0x2c3e50, // dark slate

  // Cool midtones (4-7)
  0x3d5a80, // steel blue
  0x5c7a99, // muted sky
  0x8ecae6, // light sky
  0xb8d8e8, // pale cloud

  // Warm midtones (8-11)
  0x6b4423, // rich earth
  0x8b6914, // deep amber
  0xc49a3a, // golden wheat
  0xe6c86e, // pale gold

  // Greens (12-15)
  0x1b4332, // deep forest
  0x2d6a4f, // forest green
  0x52b788, // fresh green
  0x95d5b2, // pale green

  // Warm accents (16-19)
  0x7f2b0a, // deep rust
  0xb44011, // burnt orange
  0xe07c24, // sunset orange
  0xf4a940, // warm amber

  // Reds & pinks (20-23)
  0x6b1d2a, // deep crimson
  0xa4303f, // rose red
  0xd4687a, // soft pink
  0xf2b5c1, // pale blossom

  // Purples (24-27)
  0x2e1a47, // deep purple
  0x553772, // twilight
  0x8b5fbf, // lavender
  0xc4a8e0, // pale lilac

  // Highlights & neutrals (28-31)
  0x4a4a4a, // stone grey
  0x8a8a7a, // warm grey
  0xd4cfc4, // parchment
  0xf5f0e8, // soft white
] as const;

// Named aliases for common use
export const COLORS = {
  VOID: MASTER_PALETTE[0],
  NIGHT_SKY: MASTER_PALETTE[1],
  MIDNIGHT: MASTER_PALETTE[2],
  DARK_SLATE: MASTER_PALETTE[3],

  STEEL_BLUE: MASTER_PALETTE[4],
  MUTED_SKY: MASTER_PALETTE[5],
  LIGHT_SKY: MASTER_PALETTE[6],
  PALE_CLOUD: MASTER_PALETTE[7],

  EARTH: MASTER_PALETTE[8],
  DEEP_AMBER: MASTER_PALETTE[9],
  GOLDEN_WHEAT: MASTER_PALETTE[10],
  PALE_GOLD: MASTER_PALETTE[11],

  DEEP_FOREST: MASTER_PALETTE[12],
  FOREST_GREEN: MASTER_PALETTE[13],
  FRESH_GREEN: MASTER_PALETTE[14],
  PALE_GREEN: MASTER_PALETTE[15],

  DEEP_RUST: MASTER_PALETTE[16],
  BURNT_ORANGE: MASTER_PALETTE[17],
  SUNSET_ORANGE: MASTER_PALETTE[18],
  WARM_AMBER: MASTER_PALETTE[19],

  DEEP_CRIMSON: MASTER_PALETTE[20],
  ROSE_RED: MASTER_PALETTE[21],
  SOFT_PINK: MASTER_PALETTE[22],
  PALE_BLOSSOM: MASTER_PALETTE[23],

  DEEP_PURPLE: MASTER_PALETTE[24],
  TWILIGHT: MASTER_PALETTE[25],
  LAVENDER: MASTER_PALETTE[26],
  PALE_LILAC: MASTER_PALETTE[27],

  STONE_GREY: MASTER_PALETTE[28],
  WARM_GREY: MASTER_PALETTE[29],
  PARCHMENT: MASTER_PALETTE[30],
  SOFT_WHITE: MASTER_PALETTE[31],
} as const;

/**
 * Time-of-day color grading profiles.
 * Each profile defines tint, brightness multiplier, and saturation shift
 * applied via the PaletteShader to ALL sprites uniformly.
 */
export interface TimeOfDayProfile {
  name: string;
  tint: { r: number; g: number; b: number };  // RGB multiplier (0-1)
  brightness: number;   // 0-2, where 1 = neutral
  saturation: number;   // 0-2, where 1 = neutral
  ambientColor: number; // hex color for ambient light
  shadowAlpha: number;  // 0-1 shadow darkness
  skyGradientTop: number;
  skyGradientBottom: number;
}

export const TIME_PROFILES: Record<string, TimeOfDayProfile> = {
  dawn: {
    name: 'Dawn',
    tint: { r: 1.05, g: 0.88, b: 0.92 },
    brightness: 0.75,
    saturation: 0.85,
    ambientColor: 0xd4687a,
    shadowAlpha: 0.2,
    skyGradientTop: 0x2e1a47,
    skyGradientBottom: 0xf2b5c1,
  },
  morning: {
    name: 'Morning',
    tint: { r: 1.0, g: 1.0, b: 0.95 },
    brightness: 0.95,
    saturation: 1.05,
    ambientColor: 0xf5f0e8,
    shadowAlpha: 0.3,
    skyGradientTop: 0x3d5a80,
    skyGradientBottom: 0x8ecae6,
  },
  afternoon: {
    name: 'Afternoon',
    tint: { r: 1.0, g: 1.0, b: 1.0 },
    brightness: 1.0,
    saturation: 1.1,
    ambientColor: 0xf5f0e8,
    shadowAlpha: 0.35,
    skyGradientTop: 0x3d5a80,
    skyGradientBottom: 0xb8d8e8,
  },
  goldenHour: {
    name: 'Golden Hour',
    tint: { r: 1.15, g: 0.95, b: 0.75 },
    brightness: 0.95,
    saturation: 1.2,
    ambientColor: 0xe6c86e,
    shadowAlpha: 0.45,
    skyGradientTop: 0x5c7a99,
    skyGradientBottom: 0xe6c86e,
  },
  sunset: {
    name: 'Sunset',
    tint: { r: 1.2, g: 0.78, b: 0.65 },
    brightness: 0.85,
    saturation: 1.25,
    ambientColor: 0xe07c24,
    shadowAlpha: 0.5,
    skyGradientTop: 0x2e1a47,
    skyGradientBottom: 0xe07c24,
  },
  dusk: {
    name: 'Dusk',
    tint: { r: 0.8, g: 0.75, b: 0.95 },
    brightness: 0.6,
    saturation: 0.8,
    ambientColor: 0x553772,
    shadowAlpha: 0.55,
    skyGradientTop: 0x1a1a2e,
    skyGradientBottom: 0x553772,
  },
  night: {
    name: 'Night',
    tint: { r: 0.6, g: 0.65, b: 0.85 },
    brightness: 0.4,
    saturation: 0.5,
    ambientColor: 0x16213e,
    shadowAlpha: 0.65,
    skyGradientTop: 0x0d0b0e,
    skyGradientBottom: 0x1a1a2e,
  },
  deepNight: {
    name: 'Deep Night',
    tint: { r: 0.45, g: 0.48, b: 0.72 },
    brightness: 0.25,
    saturation: 0.35,
    ambientColor: 0x0d0b0e,
    shadowAlpha: 0.75,
    skyGradientTop: 0x0d0b0e,
    skyGradientBottom: 0x16213e,
  },
};

// Order for cycling through the day
export const TIME_OF_DAY_ORDER = [
  'dawn', 'morning', 'afternoon', 'goldenHour',
  'sunset', 'dusk', 'night', 'deepNight',
] as const;

export type TimeOfDay = typeof TIME_OF_DAY_ORDER[number];

/**
 * Seasonal palette modifiers — applied ON TOP of time-of-day.
 * These shift the overall color temperature per season.
 */
export const SEASON_MODIFIERS = {
  spring: { saturation: 1.1, tintShift: { r: 0.0, g: 0.03, b: 0.0 }, bloomIntensity: 0.15 },
  summer: { saturation: 1.15, tintShift: { r: 0.02, g: 0.01, b: -0.02 }, bloomIntensity: 0.1 },
  autumn: { saturation: 1.05, tintShift: { r: 0.05, g: -0.02, b: -0.04 }, bloomIntensity: 0.2 },
  winter: { saturation: 0.7, tintShift: { r: -0.03, g: 0.0, b: 0.05 }, bloomIntensity: 0.05 },
} as const;

export type Season = keyof typeof SEASON_MODIFIERS;
