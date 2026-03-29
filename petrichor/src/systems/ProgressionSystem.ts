/**
 * ProgressionSystem — Meta-progression that persists between runs.
 *
 * Tracks:
 * - Discovered seeds (unlock new plantable crops)
 * - Tool upgrades (better watering can, hoe quality)
 * - Journal entries (lore fragments, Elder sightings, Ma moments)
 * - Run history (best harvest quality, total runs)
 * - Blessings (spirit favors that carry over)
 *
 * All data stored in localStorage with graceful fallback.
 */

const STORAGE_KEY = 'petrichor_save';

export interface ToolState {
  wateringCan: number;  // 0-3, range increases per level (1→2→3→4 tiles)
  hoe: number;          // 0-3, speed increases per level
  basket: number;       // 0-3, harvest yield bonus per level
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
  discoveredRun: number;
  category: 'lore' | 'elder' | 'ma' | 'seed' | 'recipe';
}

export interface RunRecord {
  runNumber: number;
  harvestQuality: number;
  landHealth: number;
  discoveryCount: number;
  totalHarvested: number;
  seasonsCompleted: number;
}

export interface SaveData {
  version: number;
  totalRuns: number;
  bestQuality: number;

  // Seeds
  discoveredSeeds: string[];

  // Tools
  tools: ToolState;

  // Journal
  journal: JournalEntry[];

  // Blessings (active spirit favors)
  blessings: string[];

  // Run history (last 10)
  runHistory: RunRecord[];

  // Recipes found
  recipes: string[];

  // Lifetime stats
  stats: {
    totalCropsHarvested: number;
    totalDiscoveries: number;
    totalMaMoments: number;
    elderSightings: number;
  };
}

function defaultSave(): SaveData {
  return {
    version: 1,
    totalRuns: 0,
    bestQuality: 0,
    discoveredSeeds: ['turnip', 'herb'], // starter seeds
    tools: { wateringCan: 0, hoe: 0, basket: 0 },
    journal: [],
    blessings: [],
    runHistory: [],
    recipes: [],
    stats: {
      totalCropsHarvested: 0,
      totalDiscoveries: 0,
      totalMaMoments: 0,
      elderSightings: 0,
    },
  };
}

export class ProgressionSystem {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  /** Load from localStorage, or return defaults */
  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        // Merge with defaults for forward-compat
        return { ...defaultSave(), ...parsed };
      }
    } catch {
      // corrupt or unavailable
    }
    return defaultSave();
  }

  /** Persist to localStorage */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // storage full or unavailable
    }
  }

  /** Call at end of each run to record results and unlock progression */
  completeRun(result: {
    harvestQuality: number;
    landHealth: number;
    discoveryCount: number;
    totalHarvested: number;
    seasonsCompleted: number;
    newSeeds: string[];
    newBlessings: string[];
    newLore: string[];
    maMoments: number;
    elderSeen: boolean;
  }): { unlocks: string[] } {
    const unlocks: string[] = [];

    this.data.totalRuns++;

    // Record run
    const record: RunRecord = {
      runNumber: this.data.totalRuns,
      harvestQuality: result.harvestQuality,
      landHealth: result.landHealth,
      discoveryCount: result.discoveryCount,
      totalHarvested: result.totalHarvested,
      seasonsCompleted: result.seasonsCompleted,
    };
    this.data.runHistory.push(record);
    if (this.data.runHistory.length > 10) {
      this.data.runHistory.shift();
    }

    // Best quality
    if (result.harvestQuality > this.data.bestQuality) {
      this.data.bestQuality = result.harvestQuality;
      unlocks.push('New personal best harvest!');
    }

    // Discover seeds
    for (const seedId of result.newSeeds) {
      if (!this.data.discoveredSeeds.includes(seedId)) {
        this.data.discoveredSeeds.push(seedId);
        unlocks.push(`New seed: ${seedId}`);
      }
    }

    // Blessings
    for (const blessing of result.newBlessings) {
      if (!this.data.blessings.includes(blessing)) {
        this.data.blessings.push(blessing);
        unlocks.push(`Blessing: ${blessing}`);
      }
    }

    // Lore → journal entries
    for (const loreId of result.newLore) {
      if (!this.data.journal.find(j => j.id === loreId)) {
        this.data.journal.push({
          id: loreId,
          title: this.getLoreTitle(loreId),
          text: this.getLoreText(loreId),
          discoveredRun: this.data.totalRuns,
          category: 'lore',
        });
        unlocks.push(`Journal: ${this.getLoreTitle(loreId)}`);
      }
    }

    // Tool upgrades (milestone-based)
    const toolUpgrade = this.checkToolUpgrade(result);
    if (toolUpgrade) {
      unlocks.push(toolUpgrade);
    }

    // Stats
    this.data.stats.totalCropsHarvested += result.totalHarvested;
    this.data.stats.totalDiscoveries += result.discoveryCount;
    this.data.stats.totalMaMoments += result.maMoments;
    if (result.elderSeen) this.data.stats.elderSightings++;

    // Ma journal entries
    if (result.maMoments > 0 && !this.data.journal.find(j => j.id === 'ma_first')) {
      this.data.journal.push({
        id: 'ma_first',
        title: 'A Moment of Stillness',
        text: 'You stopped. The world breathed. For the first time, you heard the land.',
        discoveredRun: this.data.totalRuns,
        category: 'ma',
      });
      unlocks.push('Journal: A Moment of Stillness');
    }

    // Elder journal
    if (result.elderSeen && !this.data.journal.find(j => j.id === 'elder_first_sight')) {
      this.data.journal.push({
        id: 'elder_first_sight',
        title: 'Something in the Trees',
        text: 'At the forest edge, antlers. Eyes like green fire. It watched you. Then it was gone.',
        discoveredRun: this.data.totalRuns,
        category: 'elder',
      });
      unlocks.push('Journal: Something in the Trees');
    }

    this.save();
    return { unlocks };
  }

  private checkToolUpgrade(result: {
    totalHarvested: number;
    harvestQuality: number;
    discoveryCount: number;
  }): string | null {
    const total = this.data.stats.totalCropsHarvested + result.totalHarvested;

    // Watering can: upgrades at 10, 30, 60 total harvests
    const canThresholds = [10, 30, 60];
    for (let i = canThresholds.length - 1; i >= 0; i--) {
      if (total >= canThresholds[i] && this.data.tools.wateringCan <= i) {
        this.data.tools.wateringCan = i + 1;
        return `Watering can upgraded to level ${i + 1}!`;
      }
    }

    // Hoe: upgrades at quality milestones
    if (this.data.bestQuality >= 80 && this.data.tools.hoe < 3) {
      this.data.tools.hoe = 3;
      return 'Hoe upgraded to level 3!';
    } else if (this.data.bestQuality >= 60 && this.data.tools.hoe < 2) {
      this.data.tools.hoe = 2;
      return 'Hoe upgraded to level 2!';
    } else if (this.data.bestQuality >= 30 && this.data.tools.hoe < 1) {
      this.data.tools.hoe = 1;
      return 'Hoe upgraded to level 1!';
    }

    // Basket: upgrades with discoveries
    const totalDiscoveries = this.data.stats.totalDiscoveries + result.discoveryCount;
    if (totalDiscoveries >= 20 && this.data.tools.basket < 3) {
      this.data.tools.basket = 3;
      return 'Basket upgraded to level 3!';
    } else if (totalDiscoveries >= 10 && this.data.tools.basket < 2) {
      this.data.tools.basket = 2;
      return 'Basket upgraded to level 2!';
    } else if (totalDiscoveries >= 3 && this.data.tools.basket < 1) {
      this.data.tools.basket = 1;
      return 'Basket upgraded to level 1!';
    }

    return null;
  }

  private getLoreTitle(id: string): string {
    const titles: Record<string, string> = {
      lore_fragment_1: 'Before the Farm',
      lore_fragment_2: 'The First Elder',
      lore_fragment_3: 'Why the Motes Glow',
    };
    return titles[id] || 'A Fragment';
  }

  private getLoreText(id: string): string {
    const texts: Record<string, string> = {
      lore_fragment_1: 'Before anyone farmed this land, the forest covered everything. The Elders walked freely then, vast and unafraid.',
      lore_fragment_2: 'The Thornback was the first to notice the farmer. It watched from the treeline for seven years before it blinked.',
      lore_fragment_3: 'Motes are not born. They gather where the land is happy. They are the land\'s way of smiling.',
    };
    return texts[id] || 'The words are too old to fully understand, but the feeling remains.';
  }

  // --- Getters ---

  get totalRuns(): number { return this.data.totalRuns; }
  get bestQuality(): number { return this.data.bestQuality; }
  get discoveredSeeds(): string[] { return [...this.data.discoveredSeeds]; }
  get tools(): ToolState { return { ...this.data.tools }; }
  get journal(): JournalEntry[] { return [...this.data.journal]; }
  get blessings(): string[] { return [...this.data.blessings]; }
  get runHistory(): RunRecord[] { return [...this.data.runHistory]; }
  get stats(): SaveData['stats'] { return { ...this.data.stats }; }

  get nextRunNumber(): number { return this.data.totalRuns + 1; }

  /** Check if a specific seed has been discovered */
  hasSeed(id: string): boolean {
    return this.data.discoveredSeeds.includes(id);
  }

  /** Check if a blessing is active */
  hasBlessing(id: string): boolean {
    return this.data.blessings.includes(id);
  }

  /** Wipe all save data (for testing or player choice) */
  reset(): void {
    this.data = defaultSave();
    this.save();
  }
}
