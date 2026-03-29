import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';
import { Crop } from '../entities/Crop';

/**
 * Animates grass, trees, and crops swaying in the wind.
 * Wind strength is driven by the WeatherRenderer.
 * Uses a field of procedural grass blades rendered via Graphics.
 */
export class WindSystem {
  private scene: Phaser.Scene;
  private grassGraphics: Phaser.GameObjects.Graphics;
  private windStrength = 0;
  private windAngle = 0;

  // Grass blades — pre-computed positions
  private grassBlades: Array<{
    x: number; y: number;
    height: number;
    phase: number;
    stiffness: number;
  }> = [];

  // Tree references for swaying
  private trees: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.grassGraphics = scene.add.graphics();
    this.grassGraphics.setDepth(DEPTH.GROUND_DECOR - 1);

    this.generateGrassField();
  }

  setTrees(trees: Phaser.GameObjects.Image[]): void {
    this.trees = trees;
  }

  /**
   * Generate a field of grass blades on grass tiles.
   * Each blade is a simple 1px-wide line that bends with wind.
   */
  private generateGrassField(): void {
    // Dense grass in the farm area and edges
    const grassAreas = [
      { minX: 8, maxX: 22, minY: 5, maxY: 15, density: 0.4 },  // farm area (less dense - tilled)
      { minX: 0, maxX: 8, minY: 0, maxY: MAP_HEIGHT_TILES, density: 0.8 },  // left forest
      { minX: 22, maxX: 25, minY: 0, maxY: MAP_HEIGHT_TILES, density: 0.7 }, // right of farm
    ];

    for (const area of grassAreas) {
      for (let ty = area.minY; ty < area.maxY; ty++) {
        for (let tx = area.minX; tx < area.maxX; tx++) {
          const bladesPerTile = Math.floor(3 * area.density + Math.random() * 3 * area.density);
          for (let b = 0; b < bladesPerTile; b++) {
            this.grassBlades.push({
              x: tx * TILE_SIZE + Math.random() * TILE_SIZE,
              y: ty * TILE_SIZE + TILE_SIZE * 0.6 + Math.random() * TILE_SIZE * 0.4,
              height: 3 + Math.random() * 5,
              phase: Math.random() * Math.PI * 2,
              stiffness: 0.5 + Math.random() * 0.5,
            });
          }
        }
      }
    }
  }

  update(time: number, windStrength: number, windAngle: number, crops: Crop[]): void {
    this.windStrength = windStrength;
    this.windAngle = windAngle;

    this.renderGrass(time);
    this.swayTrees(time);
    this.swayCrops(time, crops);
  }

  private renderGrass(time: number): void {
    this.grassGraphics.clear();

    const t = time / 1000;
    const baseWind = this.windStrength;

    if (baseWind < 0.05 && this.grassBlades.length > 0) {
      // Minimal wind: still render static grass for visual richness
      this.grassGraphics.lineStyle(1, COLORS.FRESH_GREEN, 0.4);
      for (let i = 0; i < this.grassBlades.length; i += 3) { // skip some for perf
        const blade = this.grassBlades[i];
        this.grassGraphics.lineBetween(
          blade.x, blade.y,
          blade.x, blade.y - blade.height
        );
      }
      return;
    }

    // Animated grass
    for (let i = 0; i < this.grassBlades.length; i++) {
      const blade = this.grassBlades[i];

      // Wind-driven sway: combines global wind with per-blade phase
      const windWave = Math.sin(t * 1.5 + blade.phase + blade.x * 0.02) * baseWind;
      const gustWave = Math.sin(t * 3.7 + blade.phase * 2 + blade.y * 0.03) * baseWind * 0.3;
      const sway = (windWave + gustWave) * blade.height * 0.15 / blade.stiffness;

      const tipX = blade.x + sway;
      const tipY = blade.y - blade.height;

      // Color varies with height (lighter tips)
      const isHighBlade = blade.height > 5;
      const color = isHighBlade ? COLORS.FRESH_GREEN : COLORS.PALE_GREEN;
      const alpha = 0.3 + Math.abs(windWave) * 0.15;

      this.grassGraphics.lineStyle(1, color, alpha);
      this.grassGraphics.lineBetween(blade.x, blade.y, tipX, tipY);
    }
  }

  private swayTrees(time: number): void {
    const t = time / 1000;

    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      // Trees sway slowly, with less amplitude than grass
      const sway = Math.sin(t * 0.5 + i * 1.7) * this.windStrength * 0.3;
      tree.setRotation(sway * 0.01); // Very subtle rotation
    }
  }

  private swayCrops(time: number, crops: Crop[]): void {
    const swayAmount = this.windStrength * 1.5;
    for (const crop of crops) {
      crop.setSway(swayAmount);
      crop.updateVisual(time);
    }
  }

  destroy(): void {
    this.grassGraphics.destroy();
  }
}
