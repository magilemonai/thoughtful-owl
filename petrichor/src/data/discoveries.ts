/**
 * Exploration discovery types.
 * These are found in the procedural forest during exploration.
 */

export interface Discovery {
  id: string;
  name: string;
  type: 'seed' | 'lore' | 'shrine' | 'grove' | 'spring' | 'foraging';
  description: string;
  rarity: number; // 0-1, lower = rarer
  seasonBias?: string; // appears more often in this season
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
];
