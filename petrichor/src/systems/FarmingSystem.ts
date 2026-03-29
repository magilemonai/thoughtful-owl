import Phaser from 'phaser';
import { TILE_SIZE, DEPTH } from '../config/constants';
import { COLORS, Season } from '../config/palette';
import { Crop, CropData, CROP_CATALOG } from '../entities/Crop';

export interface SoilTile {
  tileX: number;
  tileY: number;
  tilled: boolean;
  watered: boolean;
  waterLevel: number;     // 0-1, decays over time
  fertility: number;      // 0-1, degrades with repeated planting
  crop: Crop | null;
  frosted: boolean;
  daysSinceLastCrop: number;
}

export interface FarmingEvents {
  'crop-planted': [crop: Crop, tile: SoilTile];
  'crop-harvested': [cropData: CropData, yield_: number, tileX: number, tileY: number];
  'crop-withered': [crop: Crop, reason: string];
  'soil-tilled': [tile: SoilTile];
  'soil-watered': [tile: SoilTile];
}

/**
 * Central farming system managing soil state, crop lifecycle,
 * weather interactions, and harvest scoring.
 */
export class FarmingSystem {
  private scene: Phaser.Scene;
  readonly grid: Map<string, SoilTile> = new Map();
  private crops: Crop[] = [];
  readonly events: Phaser.Events.EventEmitter;

  // Soil graphics layer
  private soilGraphics: Phaser.GameObjects.Graphics;

  // Farm bounds
  private readonly farmMinX = 8;
  private readonly farmMaxX = 22;
  private readonly farmMinY = 5;
  private readonly farmMaxY = 15;

  // Stats for harvest quality calculation
  private totalHarvested = 0;
  private totalWithered = 0;
  private totalPlanted = 0;
  private daysWithAllWatered = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();

    this.soilGraphics = scene.add.graphics();
    this.soilGraphics.setDepth(DEPTH.SOIL);
  }

  isInFarmBounds(tileX: number, tileY: number): boolean {
    return tileX >= this.farmMinX && tileX < this.farmMaxX
      && tileY >= this.farmMinY && tileY < this.farmMaxY;
  }

  getTile(tileX: number, tileY: number): SoilTile | undefined {
    return this.grid.get(`${tileX},${tileY}`);
  }

  /**
   * Till soil at the given tile position.
   * Returns the newly tilled tile, or null if already tilled.
   */
  till(tileX: number, tileY: number): SoilTile | null {
    if (!this.isInFarmBounds(tileX, tileY)) return null;
    const key = `${tileX},${tileY}`;
    if (this.grid.has(key)) return null;

    const tile: SoilTile = {
      tileX, tileY,
      tilled: true,
      watered: false,
      waterLevel: 0,
      fertility: 1.0,
      crop: null,
      frosted: false,
      daysSinceLastCrop: 0,
    };
    this.grid.set(key, tile);
    this.events.emit('soil-tilled', tile);
    this.renderSoil();
    return tile;
  }

  /**
   * Water soil at the given tile position.
   * Returns true if successful.
   */
  water(tileX: number, tileY: number): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !tile.tilled) return false;

    tile.watered = true;
    tile.waterLevel = 1.0;
    if (tile.crop) {
      tile.crop.water();
    }
    this.events.emit('soil-watered', tile);
    this.renderSoil();
    return true;
  }

  /**
   * Plant a crop at the given tile position.
   * Returns the crop if successful, null otherwise.
   */
  plant(tileX: number, tileY: number, cropData: CropData, season: Season): Crop | null {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !tile.tilled || tile.crop) return null;
    if (!cropData.seasons.includes(season)) return null;

    const crop = new Crop(this.scene, tileX, tileY, cropData, tile.fertility);
    tile.crop = crop;
    this.crops.push(crop);
    this.totalPlanted++;
    this.events.emit('crop-planted', crop, tile);
    return crop;
  }

  /**
   * Harvest the crop at the given tile.
   * Returns the yield amount, or 0 if nothing to harvest.
   */
  harvest(tileX: number, tileY: number): { yield_: number; cropData: CropData } | null {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !tile.crop || !tile.crop.isReadyToHarvest) return null;

    const crop = tile.crop;
    const yield_ = crop.harvest();
    const cropData = crop.data;

    // Remove crop
    crop.destroy();
    tile.crop = null;
    tile.daysSinceLastCrop = 0;

    // Degrade fertility slightly
    tile.fertility = Math.max(0.3, tile.fertility - 0.08);

    this.crops = this.crops.filter(c => c !== crop);
    this.totalHarvested++;
    this.events.emit('crop-harvested', cropData, yield_, tileX, tileY);
    this.renderSoil();

    return { yield_, cropData };
  }

  /**
   * Called at end of each day — advance crops, decay water, check weather effects.
   */
  advanceDay(season: Season, weatherWasRainy: boolean): void {
    let allWatered = true;
    const tilledCount = this.grid.size;

    for (const tile of this.grid.values()) {
      // Rain waters all tilled soil
      if (weatherWasRainy) {
        tile.watered = true;
        tile.waterLevel = Math.min(1, tile.waterLevel + 0.6);
      }

      // Advance crop growth
      if (tile.crop) {
        const advanced = tile.crop.advanceDay(tile.fertility);
        if (advanced) {
          // Growth particle effect
          this.createGrowthSparkle(tile.tileX, tile.tileY);
        }
      }

      // Water decay
      if (tile.watered) {
        tile.waterLevel -= 0.35;
        if (tile.waterLevel <= 0) {
          tile.watered = false;
          tile.waterLevel = 0;
        }
      } else {
        allWatered = false;
      }

      // Fertility slowly recovers when empty
      if (!tile.crop) {
        tile.daysSinceLastCrop++;
        if (tile.daysSinceLastCrop > 2) {
          tile.fertility = Math.min(1, tile.fertility + 0.05);
        }
      }

      // Frost effects in late autumn / winter
      tile.frosted = false;
    }

    if (tilledCount > 0 && allWatered) {
      this.daysWithAllWatered++;
    }

    this.renderSoil();
  }

  /**
   * Apply frost to crops — can wither unprotected crops.
   */
  applyFrost(severity: number): void {
    for (const tile of this.grid.values()) {
      tile.frosted = true;

      if (tile.crop && !tile.crop.isReadyToHarvest) {
        // Frost can wither crops based on severity and crop hardiness
        if (Math.random() < severity * 0.4) {
          this.witherCrop(tile, 'frost');
        }
      }
    }
    this.renderSoil();
  }

  /**
   * Apply storm damage — can destroy crops.
   */
  applyStormDamage(severity: number): void {
    for (const tile of this.grid.values()) {
      if (tile.crop && Math.random() < severity * 0.15) {
        this.witherCrop(tile, 'storm');
      }
    }
  }

  /**
   * Apply drought stress — crops wither without water.
   */
  applyDroughtStress(): void {
    for (const tile of this.grid.values()) {
      if (tile.crop && !tile.watered && tile.waterLevel <= 0) {
        // Each consecutive dry day adds wither chance
        if (Math.random() < 0.1) {
          this.witherCrop(tile, 'drought');
        }
      }
    }
  }

  private witherCrop(tile: SoilTile, reason: string): void {
    if (!tile.crop) return;
    const crop = tile.crop;
    this.events.emit('crop-withered', crop, reason);
    crop.wither();
    this.createWitherEffect(tile.tileX, tile.tileY);

    // Remove after animation
    this.scene.time.delayedCall(1000, () => {
      if (tile.crop === crop) {
        crop.destroy();
        tile.crop = null;
        this.crops = this.crops.filter(c => c !== crop);
        this.totalWithered++;
        this.renderSoil();
      }
    });
  }

  /**
   * Calculate harvest quality score (0-100) for the Sunset scene.
   */
  calculateHarvestQuality(): number {
    let score = 0;

    // Harvest ratio (harvested vs planted)
    if (this.totalPlanted > 0) {
      score += (this.totalHarvested / this.totalPlanted) * 40;
    }

    // Wither penalty
    score -= this.totalWithered * 3;

    // Consistent watering bonus
    score += Math.min(20, this.daysWithAllWatered * 2);

    // Crop diversity bonus
    const uniqueHarvested = new Set(this.crops.filter(c => c.isReadyToHarvest).map(c => c.data.id));
    score += uniqueHarvested.size * 5;

    // Standing ready crops at harvest time
    score += this.crops.filter(c => c.isReadyToHarvest).length * 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get counts of crops needing water, ready to harvest, etc.
   */
  getStatus(): { needsWater: number; readyToHarvest: number; growing: number; tilledEmpty: number } {
    let needsWater = 0, readyToHarvest = 0, growing = 0, tilledEmpty = 0;

    for (const tile of this.grid.values()) {
      if (tile.crop) {
        if (tile.crop.isReadyToHarvest) readyToHarvest++;
        else {
          growing++;
          if (!tile.watered) needsWater++;
        }
      } else if (tile.tilled) {
        tilledEmpty++;
      }
    }

    return { needsWater, readyToHarvest, growing, tilledEmpty };
  }

  /**
   * Render soil state visuals — watering, frost, fertility indicators.
   */
  renderSoil(): void {
    this.soilGraphics.clear();

    for (const tile of this.grid.values()) {
      const px = tile.tileX * TILE_SIZE;
      const py = tile.tileY * TILE_SIZE;

      // Base tilled soil
      this.soilGraphics.fillStyle(COLORS.EARTH, 0.8);
      this.soilGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Furrow lines
      this.soilGraphics.fillStyle(COLORS.VOID, 0.12);
      this.soilGraphics.fillRect(px + 2, py + 3, 12, 1);
      this.soilGraphics.fillRect(px + 2, py + 8, 12, 1);
      this.soilGraphics.fillRect(px + 2, py + 13, 12, 1);

      // Water overlay
      if (tile.watered) {
        const waterAlpha = 0.15 + tile.waterLevel * 0.2;
        this.soilGraphics.fillStyle(COLORS.STEEL_BLUE, waterAlpha);
        this.soilGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Water sheen highlights
        this.soilGraphics.fillStyle(COLORS.LIGHT_SKY, waterAlpha * 0.5);
        this.soilGraphics.fillRect(px + 3, py + 2, 4, 1);
        this.soilGraphics.fillRect(px + 9, py + 7, 3, 1);
      }

      // Frost overlay
      if (tile.frosted) {
        this.soilGraphics.fillStyle(COLORS.SOFT_WHITE, 0.25);
        this.soilGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        // Ice crystals
        this.soilGraphics.fillStyle(COLORS.PALE_CLOUD, 0.4);
        this.soilGraphics.fillRect(px + 2, py + 2, 2, 1);
        this.soilGraphics.fillRect(px + 10, py + 5, 2, 1);
        this.soilGraphics.fillRect(px + 5, py + 12, 2, 1);
      }

      // Low fertility warning
      if (tile.fertility < 0.5) {
        const fadeFactor = 1 - tile.fertility / 0.5;
        this.soilGraphics.fillStyle(COLORS.STONE_GREY, fadeFactor * 0.2);
        this.soilGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private createGrowthSparkle(tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    const gfx = this.scene.add.graphics();
    gfx.setDepth(DEPTH.WEATHER_FRONT);

    const sparkles: Array<{ x: number; y: number; vy: number; life: number }> = [];
    for (let i = 0; i < 5; i++) {
      sparkles.push({
        x: px + (Math.random() - 0.5) * 8,
        y: py,
        vy: -0.3 - Math.random() * 0.5,
        life: 1,
      });
    }

    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: 25,
      callback: () => {
        gfx.clear();
        for (const s of sparkles) {
          s.y += s.vy;
          s.life -= 0.04;
          if (s.life > 0) {
            gfx.fillStyle(COLORS.PALE_GREEN, s.life * 0.6);
            gfx.fillCircle(s.x, s.y, 1);
          }
        }
      },
    });

    this.scene.time.delayedCall(450, () => {
      timer.destroy();
      gfx.destroy();
    });
  }

  private createWitherEffect(tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    const gfx = this.scene.add.graphics();
    gfx.setDepth(DEPTH.WEATHER_FRONT);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * 0.5,
        vy: -0.2 + Math.sin(angle) * 0.3,
        life: 1,
      });
    }

    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: 30,
      callback: () => {
        gfx.clear();
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.033;
          if (p.life > 0) {
            gfx.fillStyle(COLORS.WARM_GREY, p.life * 0.5);
            gfx.fillCircle(p.x, p.y, 1.5 * p.life);
          }
        }
      },
    });

    this.scene.time.delayedCall(520, () => {
      timer.destroy();
      gfx.destroy();
    });
  }

  get allCrops(): Crop[] {
    return this.crops;
  }

  destroy(): void {
    for (const crop of this.crops) {
      crop.destroy();
    }
    this.soilGraphics.destroy();
    this.events.removeAllListeners();
  }
}
