/**
 * Spirit lore and behavior data.
 *
 * The Elders — vast, ancient presences bound to elements.
 * Motes — tiny luminous spirits that cluster near healthy land.
 */

export interface ElderData {
  id: string;
  name: string;
  title: string;
  element: 'forest' | 'water' | 'earth' | 'wind';
  description: string;
  blessingDescription: string;
  silhouetteColor: number;
  glowColor: number;
  appearsInV1: boolean;
}

export const ELDERS: ElderData[] = [
  {
    id: 'thornback',
    name: 'The Thornback',
    title: 'Elder of the Forest',
    element: 'forest',
    description: 'An antlered silhouette between the trees. Where it walks, saplings grow overnight. It remembers every tree that has ever fallen.',
    blessingDescription: 'Wood and forage yields increase. The forest opens new paths.',
    silhouetteColor: 0x1b4332,
    glowColor: 0x52b788,
    appearsInV1: true,
  },
  {
    id: 'greycurrent',
    name: 'The Greycurrent',
    title: 'Elder of the Water',
    element: 'water',
    description: 'A slow shape beneath the river surface. Its moods control the rain. On still nights, you can see its eye — vast and silver.',
    blessingDescription: 'Rain comes when needed. The river yields its gifts.',
    silhouetteColor: 0x16213e,
    glowColor: 0x8ecae6,
    appearsInV1: false,
  },
  {
    id: 'deepwarm',
    name: 'The Deepwarm',
    title: 'Elder of the Earth',
    element: 'earth',
    description: 'Never seen, only felt. Warmth rising through soil. Tremors of contentment when the land is tended well. Tremors of another kind when it is not.',
    blessingDescription: 'Soil fertility surges. Crops grow deep and strong.',
    silhouetteColor: 0x6b4423,
    glowColor: 0xe6c86e,
    appearsInV1: false,
  },
  {
    id: 'listless',
    name: 'The Listless',
    title: 'Elder of the Wind',
    element: 'wind',
    description: 'Visible only in what it moves. Spiraling leaves, bending grass, carried seeds. Some say it is sleeping. Some say it simply does not care.',
    blessingDescription: 'Seeds travel farther. Weather softens. Storms pass gently.',
    silhouetteColor: 0xd4cfc4,
    glowColor: 0xf5f0e8,
    appearsInV1: false,
  },
];

export interface MoteConfig {
  baseCount: number;        // motes at neutral land health
  maxCount: number;         // motes at perfect land health
  minLandHealth: number;    // below this, motes flee
  spawnRadius: number;      // pixels from spawn point
  fleeSpeed: number;        // how fast they fade out
  returnSpeed: number;      // how fast they fade back in
}

export const MOTE_CONFIG: MoteConfig = {
  baseCount: 4,
  maxCount: 12,
  minLandHealth: 0.2,
  spawnRadius: 40,
  fleeSpeed: 0.02,
  returnSpeed: 0.005,
};
