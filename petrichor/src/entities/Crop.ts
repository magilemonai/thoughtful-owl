import Phaser from 'phaser';
import { TILE_SIZE, CROP_GROWTH_STAGES, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';
import { Season } from '../config/palette';

export interface CropData {
  id: string;
  name: string;
  seasons: Season[];
  growthDays: number;
  waterNeed: number;       // 0-1
  colors: number[];        // palette colors for each growth stage
  harvestYield: number;
  shape: 'round' | 'tall' | 'bush' | 'vine' | 'grain'; // determines visual silhouette
  frostHardy: boolean;     // survives light frost
}

export const CROP_CATALOG: CropData[] = [
  // Spring crops
  {
    id: 'turnip', name: 'Turnip', seasons: ['spring'],
    growthDays: 2, waterNeed: 0.5,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.SOFT_PINK],
    harvestYield: 3, shape: 'round', frostHardy: true,
  },
  {
    id: 'pea', name: 'Sugar Pea', seasons: ['spring'],
    growthDays: 3, waterNeed: 0.6,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.FRESH_GREEN],
    harvestYield: 4, shape: 'vine', frostHardy: false,
  },
  {
    id: 'wildflower', name: 'Wildflower', seasons: ['spring', 'summer'],
    growthDays: 2, waterNeed: 0.3,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.PALE_BLOSSOM, COLORS.SOFT_PINK],
    harvestYield: 2, shape: 'tall', frostHardy: false,
  },
  // Summer crops
  {
    id: 'tomato', name: 'Tomato', seasons: ['summer'],
    growthDays: 3, waterNeed: 0.7,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.ROSE_RED],
    harvestYield: 5, shape: 'bush', frostHardy: false,
  },
  {
    id: 'sunflower', name: 'Sunflower', seasons: ['summer'],
    growthDays: 4, waterNeed: 0.5,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.GOLDEN_WHEAT, COLORS.WARM_AMBER],
    harvestYield: 3, shape: 'tall', frostHardy: false,
  },
  {
    id: 'melon', name: 'Sweet Melon', seasons: ['summer'],
    growthDays: 4, waterNeed: 0.8,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.FRESH_GREEN],
    harvestYield: 8, shape: 'round', frostHardy: false,
  },
  // Autumn crops
  {
    id: 'pumpkin', name: 'Pumpkin', seasons: ['autumn'],
    growthDays: 3, waterNeed: 0.5,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.SUNSET_ORANGE],
    harvestYield: 6, shape: 'round', frostHardy: true,
  },
  {
    id: 'wheat', name: 'Wheat', seasons: ['autumn', 'summer'],
    growthDays: 3, waterNeed: 0.4,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.GOLDEN_WHEAT, COLORS.PALE_GOLD],
    harvestYield: 4, shape: 'grain', frostHardy: true,
  },
  // All-season
  {
    id: 'herb', name: 'Wild Herb', seasons: ['spring', 'summer', 'autumn'],
    growthDays: 2, waterNeed: 0.3,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.FOREST_GREEN, COLORS.DEEP_FOREST],
    harvestYield: 2, shape: 'bush', frostHardy: true,
  },
  {
    id: 'root', name: 'Deep Root', seasons: ['spring', 'summer', 'autumn'],
    growthDays: 4, waterNeed: 0.4,
    colors: [COLORS.PALE_GREEN, COLORS.FRESH_GREEN, COLORS.EARTH, COLORS.DEEP_AMBER],
    harvestYield: 5, shape: 'round', frostHardy: true,
  },
];

/**
 * A single planted crop instance on the farm grid.
 * Each crop type has a unique visual shape at each growth stage.
 */
export class Crop {
  readonly sprite: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  readonly tileX: number;
  readonly tileY: number;
  readonly data: CropData;

  private growthProgress = 0;
  private _watered = false;
  private stage = 0;
  private fertility: number;
  private withered = false;
  private swayOffset: number; // unique per-crop for wind animation
  private swayAmount = 0;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, cropData: CropData, fertility: number = 1) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.data = cropData;
    this.fertility = fertility;
    this.swayOffset = Math.random() * Math.PI * 2;

    this.sprite = scene.add.graphics();
    this.sprite.setDepth(DEPTH.CROPS);
    this.render();
  }

  get isReadyToHarvest(): boolean {
    return this.stage >= CROP_GROWTH_STAGES - 1 && !this.withered;
  }

  get currentStage(): number {
    return this.stage;
  }

  get isWatered(): boolean {
    return this._watered;
  }

  get isWithered(): boolean {
    return this.withered;
  }

  water(): void {
    this._watered = true;
    this.render();
  }

  /**
   * Advance growth by one day.
   * Fertility affects growth speed. Returns true if the crop advanced a stage.
   */
  advanceDay(fertility: number = 1): boolean {
    if (this.isReadyToHarvest || this.withered) return false;

    const growthRate = this._watered ? 1.0 : 0.25;
    const fertilityBonus = 0.7 + fertility * 0.3; // fertility scales 70-100% speed
    this.growthProgress += growthRate * fertilityBonus;
    this._watered = false;

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
    const fertilityMult = 0.6 + this.fertility * 0.4;
    return Math.ceil(this.data.harvestYield * fertilityMult);
  }

  wither(): void {
    this.withered = true;
    this.render();
  }

  /**
   * Apply wind sway (called each frame by weather system)
   */
  setSway(amount: number): void {
    this.swayAmount = amount;
  }

  /**
   * Re-render with current sway. Called by wind system each frame.
   */
  updateVisual(time: number): void {
    if (this.stage < 1) return; // seeds don't sway
    if (Math.abs(this.swayAmount) < 0.01) return;
    this.render(time);
  }

  private render(time: number = 0): void {
    this.sprite.clear();

    const px = this.tileX * TILE_SIZE;
    const py = this.tileY * TILE_SIZE;

    if (this.withered) {
      this.renderWithered(px, py);
      return;
    }

    const color = this.data.colors[this.stage];
    const sway = this.stage >= 1
      ? Math.sin(time * 0.002 + this.swayOffset) * this.swayAmount * (this.stage * 0.5)
      : 0;

    switch (this.stage) {
      case 0:
        this.renderSeedling(px, py, color);
        break;
      case 1:
        this.renderYoung(px, py, color, sway);
        break;
      case 2:
        this.renderGrowing(px, py, color, sway);
        break;
      case 3:
        this.renderMature(px, py, color, sway);
        break;
    }

    // Water shimmer
    if (this._watered && this.stage < CROP_GROWTH_STAGES - 1) {
      this.sprite.fillStyle(COLORS.LIGHT_SKY, 0.3);
      this.sprite.fillRect(px + 4, py + 13, 8, 1);
    }
  }

  // Stage 0: All crops look similar as seedlings
  private renderSeedling(px: number, py: number, color: number): void {
    this.sprite.fillStyle(color, 0.8);
    this.sprite.fillRect(px + 7, py + 12, 2, 2);
    this.sprite.fillStyle(COLORS.EARTH, 0.3);
    this.sprite.fillRect(px + 5, py + 14, 6, 2);
  }

  // Stage 1: Shape differentiation begins
  private renderYoung(px: number, py: number, color: number, sway: number): void {
    const sx = Math.round(sway);
    const shape = this.data.shape;

    // Stem (all shapes)
    this.sprite.fillStyle(COLORS.FOREST_GREEN, 0.9);
    this.sprite.fillRect(px + 7 + sx, py + 9, 2, 5);

    switch (shape) {
      case 'tall':
        this.sprite.fillStyle(color, 0.9);
        this.sprite.fillRect(px + 6 + sx, py + 8, 4, 3);
        break;
      case 'bush':
        this.sprite.fillStyle(color, 0.9);
        this.sprite.fillRect(px + 5 + sx, py + 9, 6, 3);
        break;
      case 'round':
        this.sprite.fillStyle(color, 0.9);
        this.sprite.fillCircle(px + 8 + sx, py + 10, 2.5);
        break;
      case 'vine':
        this.sprite.fillStyle(color, 0.9);
        this.sprite.fillRect(px + 5 + sx, py + 9, 2, 2);
        this.sprite.fillRect(px + 9 + sx, py + 10, 2, 2);
        break;
      case 'grain':
        this.sprite.fillStyle(color, 0.9);
        this.sprite.fillRect(px + 7 + sx, py + 7, 2, 3);
        this.sprite.fillRect(px + 6 + sx, py + 8, 1, 2);
        break;
    }
  }

  // Stage 2: More developed shapes
  private renderGrowing(px: number, py: number, color: number, sway: number): void {
    const sx = Math.round(sway);
    const shape = this.data.shape;

    // Stem
    this.sprite.fillStyle(COLORS.FOREST_GREEN, 1);

    switch (shape) {
      case 'tall':
        this.sprite.fillRect(px + 7 + sx, py + 4, 2, 10);
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 5 + sx, py + 4, 6, 4);
        this.sprite.fillRect(px + 4 + sx, py + 6, 3, 3);
        this.sprite.fillRect(px + 9 + sx, py + 5, 3, 3);
        break;
      case 'bush':
        this.sprite.fillRect(px + 7 + sx, py + 8, 2, 6);
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 3 + sx, py + 5, 10, 6);
        this.sprite.fillStyle(COLORS.DEEP_FOREST, 0.5);
        this.sprite.fillRect(px + 5 + sx, py + 7, 3, 2);
        break;
      case 'round':
        this.sprite.fillRect(px + 7 + sx, py + 7, 2, 7);
        this.sprite.fillStyle(color, 1);
        this.sprite.fillCircle(px + 8 + sx, py + 7, 4);
        this.sprite.fillStyle(COLORS.FRESH_GREEN, 0.6);
        this.sprite.fillRect(px + 5 + sx, py + 4, 3, 2);
        this.sprite.fillRect(px + 9 + sx, py + 5, 2, 2);
        break;
      case 'vine':
        this.sprite.fillRect(px + 7 + sx, py + 6, 2, 8);
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 3 + sx, py + 8, 3, 3);
        this.sprite.fillRect(px + 10 + sx, py + 6, 3, 3);
        this.sprite.fillRect(px + 5 + sx, py + 5, 2, 2);
        // Vine tendrils
        this.sprite.fillStyle(COLORS.FRESH_GREEN, 0.7);
        this.sprite.fillRect(px + 2 + sx, py + 9, 2, 1);
        this.sprite.fillRect(px + 12 + sx, py + 7, 2, 1);
        break;
      case 'grain':
        // Multiple stalks
        this.sprite.fillRect(px + 5 + sx, py + 4, 1, 10);
        this.sprite.fillRect(px + 8 + sx, py + 3, 1, 11);
        this.sprite.fillRect(px + 11 + sx, py + 5, 1, 9);
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 4 + sx, py + 3, 3, 3);
        this.sprite.fillRect(px + 7 + sx, py + 2, 3, 3);
        this.sprite.fillRect(px + 10 + sx, py + 4, 3, 3);
        break;
    }
  }

  // Stage 3: Mature / harvest-ready — most distinctive
  private renderMature(px: number, py: number, color: number, sway: number): void {
    const sx = Math.round(sway);
    const shape = this.data.shape;
    const id = this.data.id;

    this.sprite.fillStyle(COLORS.FOREST_GREEN, 1);

    switch (shape) {
      case 'tall':
        // Tall stem with flower/head at top
        this.sprite.fillRect(px + 7 + sx, py + 3, 2, 11);
        this.sprite.fillRect(px + 4 + sx, py + 7, 3, 3);
        this.sprite.fillRect(px + 9 + sx, py + 8, 3, 3);
        // Crown
        this.sprite.fillStyle(color, 1);
        if (id === 'sunflower') {
          // Big round flower head
          this.sprite.fillCircle(px + 8 + sx, py + 3, 4);
          this.sprite.fillStyle(COLORS.DEEP_AMBER, 1);
          this.sprite.fillCircle(px + 8 + sx, py + 3, 2);
        } else {
          // Generic flower top
          this.sprite.fillRect(px + 5 + sx, py + 1, 6, 4);
          this.sprite.fillRect(px + 6 + sx, py + 0, 4, 2);
        }
        break;

      case 'bush':
        // Wide bushy plant with visible fruit
        this.sprite.fillRect(px + 7 + sx, py + 8, 2, 6);
        this.sprite.fillRect(px + 2 + sx, py + 4, 12, 7);
        this.sprite.fillStyle(COLORS.DEEP_FOREST, 0.4);
        this.sprite.fillRect(px + 4 + sx, py + 6, 4, 3);
        this.sprite.fillRect(px + 9 + sx, py + 5, 3, 3);
        // Fruit dots
        this.sprite.fillStyle(color, 1);
        this.sprite.fillCircle(px + 5 + sx, py + 5, 2);
        this.sprite.fillCircle(px + 10 + sx, py + 4, 2);
        this.sprite.fillCircle(px + 7 + sx, py + 8, 1.5);
        break;

      case 'round':
        // Visible large fruit on ground
        this.sprite.fillRect(px + 7 + sx, py + 5, 2, 9);
        this.sprite.fillRect(px + 4 + sx, py + 4, 3, 4);
        this.sprite.fillRect(px + 9 + sx, py + 5, 3, 3);
        this.sprite.fillStyle(color, 1);
        if (id === 'pumpkin') {
          // Big pumpkin shape
          this.sprite.fillCircle(px + 8 + sx, py + 10, 4);
          this.sprite.fillStyle(COLORS.FOREST_GREEN, 0.8);
          this.sprite.fillRect(px + 7 + sx, py + 6, 2, 2);
        } else if (id === 'melon') {
          this.sprite.fillCircle(px + 8 + sx, py + 10, 3.5);
          this.sprite.fillStyle(COLORS.PALE_GREEN, 0.4);
          this.sprite.fillRect(px + 6 + sx, py + 9, 1, 3);
          this.sprite.fillRect(px + 10 + sx, py + 9, 1, 3);
        } else {
          // Turnip/root poking from ground
          this.sprite.fillCircle(px + 8 + sx, py + 12, 3);
          this.sprite.fillStyle(COLORS.FRESH_GREEN, 1);
          this.sprite.fillRect(px + 6 + sx, py + 7, 4, 3);
        }
        break;

      case 'vine':
        // Sprawling vine with hanging pods
        this.sprite.fillRect(px + 7 + sx, py + 4, 2, 10);
        this.sprite.fillRect(px + 3 + sx, py + 6, 2, 1);
        this.sprite.fillRect(px + 11 + sx, py + 5, 2, 1);
        this.sprite.fillStyle(COLORS.FRESH_GREEN, 0.8);
        this.sprite.fillRect(px + 2 + sx, py + 7, 4, 4);
        this.sprite.fillRect(px + 10 + sx, py + 5, 4, 4);
        // Pods
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 3 + sx, py + 8, 2, 3);
        this.sprite.fillRect(px + 11 + sx, py + 6, 2, 3);
        this.sprite.fillRect(px + 6 + sx, py + 3, 2, 3);
        break;

      case 'grain':
        // Full wheat/grain stalks bowing
        const bow = sx * 0.5;
        this.sprite.fillRect(px + 4 + bow, py + 2, 1, 12);
        this.sprite.fillRect(px + 7 + sx, py + 1, 1, 13);
        this.sprite.fillRect(px + 10 + bow, py + 3, 1, 11);
        this.sprite.fillRect(px + 12 + bow, py + 4, 1, 10);
        // Grain heads
        this.sprite.fillStyle(color, 1);
        this.sprite.fillRect(px + 3 + bow, py + 1, 3, 4);
        this.sprite.fillRect(px + 6 + sx, py + 0, 3, 4);
        this.sprite.fillRect(px + 9 + bow, py + 2, 3, 4);
        this.sprite.fillRect(px + 11 + bow, py + 3, 3, 3);
        break;
    }

    // Harvest-ready glow indicator (subtle pulsing)
    if (this.isReadyToHarvest) {
      const pulse = Math.sin(Date.now() * 0.003 + this.swayOffset) * 0.1 + 0.1;
      this.sprite.fillStyle(COLORS.PALE_GOLD, pulse);
      this.sprite.fillCircle(px + 8, py + 8, 8);
    }
  }

  private renderWithered(px: number, py: number): void {
    // Sad, drooping, grey-brown plant
    this.sprite.fillStyle(COLORS.WARM_GREY, 0.6);
    this.sprite.fillRect(px + 7, py + 8, 2, 6);
    this.sprite.fillRect(px + 5, py + 6, 2, 3);
    this.sprite.fillRect(px + 9, py + 7, 2, 2);

    this.sprite.fillStyle(COLORS.STONE_GREY, 0.5);
    this.sprite.fillRect(px + 4, py + 5, 4, 3);
    this.sprite.fillRect(px + 8, py + 6, 4, 2);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
