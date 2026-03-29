/**
 * Core game constants for Petrichor
 */

// Display
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;
export const TILE_SIZE = 16;
export const MAX_SCALE = 6;

// Map
export const MAP_WIDTH_TILES = 30;
export const MAP_HEIGHT_TILES = 20;
export const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
export const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;

// Player
export const PLAYER_SPEED = 48; // pixels per second
export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 32;

// Time system
export const DAYS_PER_SEASON = 4;
export const SEASONS_PER_RUN = 3; // spring, summer, autumn (farming)
export const WINTER_DAYS = 1; // one contemplative winter day before sunset
export const TOTAL_DAYS = DAYS_PER_SEASON * SEASONS_PER_RUN + WINTER_DAYS; // 13
export const TUTORIAL_DAYS = 5; // first run is abbreviated (spring + 1 summer day)

// Each in-game day lasts this many real seconds
export const DAY_DURATION_SECONDS = 150; // 2.5 minutes per day (~30 min runs)

// Time-of-day phase durations (fraction of day)
export const TIME_PHASE_DURATIONS: Record<string, number> = {
  dawn:       0.06,  // brief
  morning:    0.18,
  afternoon:  0.26,
  goldenHour: 0.10,
  sunset:     0.08,
  dusk:       0.06,
  night:      0.16,
  deepNight:  0.10,
};

// Farming
export const CROP_GROWTH_STAGES = 4;
export const WATER_DECAY_HOURS = 8; // soil dries after this many in-game hours

// Spirits
export const MAX_MOTES_PER_AREA = 12;
export const MOTE_SPAWN_HEALTH_THRESHOLD = 0.3; // land health required

// Camera
export const CAMERA_LERP = 0.08;
export const CAMERA_BREATHE_AMPLITUDE = 0.5; // pixels
export const CAMERA_BREATHE_PERIOD = 8; // seconds

// Touch controls
export const JOYSTICK_RADIUS = 40;
export const JOYSTICK_DEAD_ZONE = 8;
export const TAP_THRESHOLD_MS = 200;
export const TAP_THRESHOLD_DISTANCE = 10;

// Seasons
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'] as const;
export const FARMING_SEASONS = ['spring', 'summer', 'autumn'] as const;

// Z-depth layers
export const DEPTH = {
  BACKGROUND: 0,
  PARALLAX_FAR: 10,
  PARALLAX_MID: 20,
  PARALLAX_NEAR: 30,
  TERRAIN: 100,
  SOIL: 110,
  CROPS: 120,
  GROUND_DECOR: 130,
  ENTITIES: 200,
  PLAYER: 210,
  MOTES: 220,
  ELDER_SILHOUETTE: 250,
  WEATHER_BEHIND: 300,
  TREE_CANOPY: 350,
  WEATHER_FRONT: 400,
  LIGHTING_OVERLAY: 500,
  COLOR_GRADE: 600,
  UI: 700,
  MA_OVERLAY: 800,
} as const;
