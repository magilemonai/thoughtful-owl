import Phaser from 'phaser';
import { TILE_SIZE, CROP_GROWTH_STAGES, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';
import { Season } from '../config/palette';

export interface CropData {
  id: string;
  name: string;
  seasons: Season[];       // which seasons it can grow in
  growthDays: number;      // days from plant to harvest
  waterNeed: number;       // 0-1, how much water it needs
  colors: number[];        // palette indices for each growth stage
  harvestYield: number;    // base harvest amount
}

export const CROP_CATALOG: CropData[] = [
  // Spring crops
  {
    id: 'turnip', name: 'Turnip', seasons: ['spring'],
    growthDays: 2, waterNeed: 0.5,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.SOFT_PINK],
    harvestYield: 3,
  },
  {
    id: 'pea', name: 'Sugar Pea', seasons: ['spring'],
    growthDays: 3, waterNeed: 0.6,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.FRESH_GREEN],
    harvestYield: 4,
  },
  {
    id: 'wildflower', name: 'Wildflower', seasons: ['spring', 'summer'],
    growthDays: 2, waterNeed: 0.3,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.PALE_BLOSSOM, COLORS.SOFT_PINK],
    harvestYield: 2,
  },
  // Summer crops
  {
    id: 'tomato', name: 'Tomato', seasons: ['summer'],
    growthDays: 3, waterNeed: 0.7,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.ROSE_RED],
    harvestYield: 5,
  },
  {
    id: 'sunflower', name: 'Sunflower', seasons: ['summer'],
    growthDays: 4, waterNeed: 0.5,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.GOLDEN_WHEAT, COLORS.WARM_AMBER],
    harvestYield: 3,
  },
  {
    id: 'melon', name: 'Sweet Melon', seasons: ['summer'],
    growthDays: 4, waterNeed: 0.8,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.FRESH_GREEN],
    harvestYield: 8,
  },
  // Autumn crops
  {
    id: 'pumpkin', name: 'Pumpkin', seasons: ['autumn'],
    growthDays: 3, waterNeed: 0.5,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.SUNSET_ORANGE],
    harvestYield: 6,
  },
  {
    id: 'wheat', name: 'Wheat', seasons: ['autumn', 'summer'],
    growthDays: 3, waterNeed: 0.4,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.GOLDEN_WHEAT, COLORS.PALE_GOLD],
    harvestYield: 4,
  },
  // All-season
  {
    id: 'herb', name: 'Wild Herb', seasons: ['spring', 'summer', 'autumn'],
    growthDays: 2, waterNeed: 0.3,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.DEEP_FOREST],
    harvestYield: 2,
  },
  {
    id: 'root', name: 'Deep Root', seasons: ['spring', 'summer', 'autumn'],
    growthDays: 4, waterNeed: 0.4,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.EARTH, COLORS.DEEP_AMBER],
    harvestYield: 5,
  },
];

/**
 * A single planted crop instance on the farm grid.
 */
export class Crop {
  readonly sprite: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  readonly tileX: number;
  readonly tileY: number;
  readonly data: CropData;

  private growthProgress = 0; // 0 to data.growthDays
  private watered = false;
  private stage = 0; // 0-3

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, cropData: CropData) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.data = cropData;

    this.sprite = scene.add.graphics();
    this.sprite.setDepth(DEPTH.CROPS);
    this.render();
  }

  get isReadyToHarvest(): boolean {
    return this.stage >= CROP_GROWTH_STAGES - 1;
  }

  get currentStage(): number {
    return this.stage;
  }

  get isWatered(): boolean {
    return this.watered;
  }

  water(): void {
    this.watered = true;
    this.render();
  }

  /**
   * Advance growth by one day. Call at end of each day.
   * Returns true if the crop advanced a stage.
   */
  advanceDay(): boolean {
    if (this.isReadyToHarvest) return false;

    if (this.watered) {
      this.growthProgress += 1;
    } else {
      this.growthProgress += 0.3; // grows slower without water
    }

    this.watered = false;

    const newStage = Math.min(
      CROP_GROWTH_STAGES - 1,
      Math.floor((this.growthProgress / this.data.growthDays) * CROP_GROWTH_STAGES)
    );

    if (newStage !== this.stage) {
      this.stage = newStage;
      this.render();
      return true;
    }
    return false;
  }

  harvest(): number {
    if (!this.isReadyToHarvest) return 0;
    return this.data.harvestYield;
  }

  private render(): void {
    this.sprite.clear();

    const px = this.tileX * TILE_SIZE;
    const py = this.tileY * TILE_SIZE;
    const color = this.data.colors[this.stage];

    switch (this.stage) {
      case 0: // Seed/sprout: tiny green dot
        this.sprite.fillStyle(color, 0.8);
        this.sprite.fillRect(px + 7, py + 12, 2, 2);
        // Soil mark
        this.sprite.fillStyle(COLORS.EARTH, 0.5);
        this.sprite.fillRect(px + 5, py + 14, 6, 2);
        break;

      case 1: // Small plant: short stem + tiny leaves
        this.sprite.fillStyle(COLORS.EARTH, 0.5);
        this.sprite.fillRect(px + 5, py + 14, 6, 2);
        this.sprite.fillStyle(color, 0.9);
        this.sprite.fillRect(px + 7, py + 9, 2, 5);
        this.sprite.fillRect(px + 5, py + 9, 2, 2);
        this.sprite.fillRect(px + 9, py + 10, 2, 2);
        break;

      case 2: // Growing: taller stem, more leaves
        this.sprite.fillStyle(COLORS.EARTH, 0.5);
        this.sprite.fillRect(px + 4, py + 14, 8, 2);
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 7, py + 5, 2, 9);
        this.sprite.fillRect(px + 4, py + 6, 3, 3);
        this.sprite.fillRect(px + 9, py + 7, 3, 3);
        this.sprite.fillRect(px + 5, py + 10, 2, 2);
        this.sprite.fillRect(px + 9, py + 10, 2, 2);
        break;

      case 3: // Harvest-ready: full plant with colored fruit/flower
        this.sprite.fillStyle(COLORS.EARTH, 0.5);
        this.sprite.fillRect(px + 4, py + 14, 8, 2);
        this.sprite.fillStyle(COLORS.FOREST_GREEN, 1);
        this.sprite.fillRect(px + 7, py + 4, 2, 10);
        this.sprite.fillRect(px + 3, py + 5, 4, 4);
        this.sprite.fillRect(px + 9, py + 6, 4, 4);
        this.sprite.fillRect(px + 5, py + 9, 3, 3);
        this.sprite.fillRect(px + 9, py + 10, 2, 2);
        // Fruit/flower
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 5, py + 3, 3, 3);
        this.sprite.fillRect(px + 9, py + 4, 3, 3);
        this.sprite.fillRect(px + 7, py + 1, 2, 2);
        break;
    }

    // Water droplets visual
    if (this.watered && this.stage < CROP_GROWTH_STAGES - 1) {
      this.sprite.fillStyle(COLORS.LIGHT_SKY, 0.4);
      this.sprite.fillRect(px + 4, py + 13, 8, 1);
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
