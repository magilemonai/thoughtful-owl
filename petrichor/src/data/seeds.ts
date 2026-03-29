/**
 * Seed discovery data — tracks which seeds the player has found
 * across all runs. This is a meta-progression element.
 */

export interface SeedEntry {
  id: string;
  name: string;
  discovered: boolean;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'spirit';
}

export const SEED_CATALOG: SeedEntry[] = [
  { id: 'turnip', name: 'Turnip', discovered: true, description: 'A humble root. Quick to grow, steady in yield.', rarity: 'common' },
  { id: 'pea', name: 'Sugar Pea', discovered: false, description: 'Sweet tendrils that climb toward the sun.', rarity: 'common' },
  { id: 'wildflower', name: 'Wildflower', discovered: false, description: 'The motes seem drawn to its color.', rarity: 'uncommon' },
  { id: 'tomato', name: 'Tomato', discovered: false, description: 'Needs patience and water. Worth the wait.', rarity: 'common' },
  { id: 'sunflower', name: 'Sunflower', discovered: false, description: 'Turns to follow the light. A field of them is something to see.', rarity: 'uncommon' },
  { id: 'melon', name: 'Sweet Melon', discovered: false, description: 'Heavy and fragrant. The Thornback watches melon fields closely.', rarity: 'uncommon' },
  { id: 'pumpkin', name: 'Pumpkin', discovered: false, description: 'Golden in autumn light. Harvest before the first frost.', rarity: 'common' },
  { id: 'wheat', name: 'Wheat', discovered: false, description: 'The sound of wind through wheat is its own kind of quiet.', rarity: 'common' },
  { id: 'herb', name: 'Wild Herb', discovered: true, description: 'Grows anywhere the soil is kind. Smells of the forest after rain.', rarity: 'common' },
  { id: 'root', name: 'Deep Root', discovered: false, description: 'Takes its time. The Deepwarm favors patient farmers.', rarity: 'uncommon' },
];

/**
 * Save/load seed discovery state
 */
export function saveSeedProgress(catalog: SeedEntry[]): void {
  const discovered = catalog.filter(s => s.discovered).map(s => s.id);
  try {
    localStorage.setItem('petrichor_seeds', JSON.stringify(discovered));
  } catch {
    // Storage might be unavailable
  }
}

export function loadSeedProgress(catalog: SeedEntry[]): void {
  try {
    const data = localStorage.getItem('petrichor_seeds');
    if (data) {
      const discovered: string[] = JSON.parse(data);
      for (const entry of catalog) {
        entry.discovered = discovered.includes(entry.id);
      }
    }
  } catch {
    // Use defaults
  }
}
