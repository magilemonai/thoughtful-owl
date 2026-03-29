/**
 * Exploration discovery types.
 * These are found in the procedural forest during exploration.
 */

export interface DiscoveryCondition {
  /** Only visible/interactable during these times of day */
  timeOfDay?: string[];
  /** Player must stand still for this many seconds nearby before it appears */
  stillnessSeconds?: number;
  /** Minimum number of previous discoveries this run to unlock */
  minDiscoveries?: number;
}

export interface Discovery {
  id: string;
  name: string;
  type: 'seed' | 'lore' | 'shrine' | 'grove' | 'spring' | 'foraging';
  description: string;
  rarity: number; // 0-1, lower = rarer
  seasonBias?: string; // appears more often in this season
  condition?: DiscoveryCondition;
  reward?: {
    type: 'seed' | 'knowledge' | 'blessing' | 'item';
    id: string;
    amount?: number;
  };
}

export const DISCOVERIES: Discovery[] = [
  {
    id: 'wild_pea_patch',
    name: 'Wild Pea Patch',
    type: 'seed',
    description: 'Tangled vines heavy with pods. Seeds for the taking.',
    rarity: 0.6,
    seasonBias: 'spring',
    reward: { type: 'seed', id: 'pea', amount: 3 },
  },
  {
    id: 'sunflower_clearing',
    name: 'Sunflower Clearing',
    type: 'seed',
    description: 'A gap in the canopy. Sunflowers have claimed the light.',
    rarity: 0.4,
    seasonBias: 'summer',
    reward: { type: 'seed', id: 'sunflower', amount: 2 },
  },
  {
    id: 'mote_grove',
    name: 'Mote Grove',
    type: 'grove',
    description: 'The air glows here. Motes cluster thick as fireflies. They seem pleased to be found.',
    rarity: 0.3,
    reward: { type: 'blessing', id: 'mote_friendship' },
  },
  {
    id: 'thornback_shrine',
    name: 'Antlered Stone',
    type: 'shrine',
    description: 'A mossy stone carved with antlers. Old. Very old. The forest hums around it.',
    rarity: 0.2,
    reward: { type: 'blessing', id: 'thornback_favor' },
  },
  {
    id: 'hidden_spring',
    name: 'Hidden Spring',
    type: 'spring',
    description: 'Cold, clear water rising from between roots. It tastes like the earth itself.',
    rarity: 0.25,
    reward: { type: 'blessing', id: 'water_blessing' },
  },
  {
    id: 'mushroom_ring',
    name: 'Mushroom Ring',
    type: 'foraging',
    description: 'A perfect circle of mushrooms. The motes avoid the center.',
    rarity: 0.5,
    reward: { type: 'item', id: 'mushrooms', amount: 4 },
  },
  {
    id: 'ancient_stone',
    name: 'Weathered Inscription',
    type: 'lore',
    description: 'Words too old to read. But the journal seems to understand.',
    rarity: 0.15,
    reward: { type: 'knowledge', id: 'lore_fragment_1' },
  },
  {
    id: 'berry_thicket',
    name: 'Berry Thicket',
    type: 'foraging',
    description: 'Brambles laden with dark berries. The birds have left some for you.',
    rarity: 0.7,
    seasonBias: 'summer',
    reward: { type: 'item', id: 'berries', amount: 6 },
  },
  {
    id: 'pumpkin_hollow',
    name: 'Pumpkin Hollow',
    type: 'seed',
    description: 'Wild pumpkins in a sheltered hollow. How did they get here?',
    rarity: 0.35,
    seasonBias: 'autumn',
    reward: { type: 'seed', id: 'pumpkin', amount: 2 },
  },
  {
    id: 'frozen_mote',
    name: 'Frozen Mote',
    type: 'grove',
    description: 'A single mote, perfectly still in the cold air. It pulses slowly, like a sleeping heartbeat.',
    rarity: 0.15,
    seasonBias: 'winter',
    reward: { type: 'blessing', id: 'winter_sight' },
  },
  // --- Conditional discoveries ---
  {
    id: 'dawn_chorus',
    name: 'Dawn Chorus',
    type: 'grove',
    description: 'The trees sing only at first light. You had to be here early to hear them.',
    rarity: 0.25,
    condition: { timeOfDay: ['dawn', 'early_morning'] },
    reward: { type: 'blessing', id: 'dawn_vigor' },
  },
  {
    id: 'dusk_moth',
    name: 'Dusk Moth',
    type: 'foraging',
    description: 'A moth with wings like stained glass. It only flies at twilight.',
    rarity: 0.3,
    condition: { timeOfDay: ['dusk', 'evening'] },
    reward: { type: 'item', id: 'moth_wing', amount: 1 },
  },
  {
    id: 'listening_stone',
    name: 'Listening Stone',
    type: 'shrine',
    description: 'The stone only speaks to those who are patient enough to stand still and listen.',
    rarity: 0.2,
    condition: { stillnessSeconds: 4 },
    reward: { type: 'knowledge', id: 'lore_fragment_2' },
  },
  {
    id: 'deep_root_shrine',
    name: 'Deep Root Shrine',
    type: 'shrine',
    description: 'Hidden beneath tangled roots. Only those who have explored deeply find this place.',
    rarity: 0.15,
    condition: { minDiscoveries: 3 },
    reward: { type: 'blessing', id: 'deep_root_favor' },
  },
  {
    id: 'moonpetal',
    name: 'Moonpetal',
    type: 'seed',
    description: 'A luminous flower that only blooms under moonlight. Its seeds glow faintly.',
    rarity: 0.2,
    seasonBias: 'summer',
    condition: { timeOfDay: ['night', 'late_night'] },
    reward: { type: 'seed', id: 'moonpetal', amount: 2 },
  },
];
