import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, DEPTH } from '../config/constants';
import { COLORS, Season } from '../config/palette';
import { Mote } from '../entities/Mote';
import { MOTE_CONFIG, ELDERS } from '../data/spirits';
import { FarmingSystem } from './FarmingSystem';

/**
 * Manages land health, mote population, and Elder presence.
 *
 * Land health is a 0-1 value derived from:
 * - Crop diversity (more types = healthier)
 * - Soil fertility average
 * - Wither ratio (fewer withered = healthier)
 * - Exploration discoveries (engaging with the forest helps)
 * - NOT overfarming (leaving some soil fallow)
 *
 * Motes appear/disappear based on land health.
 * The Thornback appears when health is high and the player has
 * shown respect to the forest (discoveries, not overfarming).
 */
export class SpiritSystem {
  private scene: Phaser.Scene;
  readonly events: Phaser.Events.EventEmitter;

  // Land health
  private _landHealth = 0.5;
  private targetLandHealth = 0.5;

  // Motes
  private motes: Mote[] = [];
  private moteSpawnPoints: Array<{ x: number; y: number }> = [];
  private maxMotes = MOTE_CONFIG.maxCount;

  // Thornback Elder
  private thornbackVisible = false;
  private thornbackAlpha = 0;
  private thornbackGraphics: Phaser.GameObjects.Graphics;
  private thornbackX = 0;
  private thornbackY = 0;
  private thornbackEyeGlow = 0;
  private thornbackAppearanceTimer = 0;
  private hasThornbackAppearedThisRun = false;

  // Blessings (earned from discoveries/shrines)
  private blessings: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();

    this.thornbackGraphics = scene.add.graphics();
    this.thornbackGraphics.setDepth(DEPTH.ELDER_SILHOUETTE);

    // Mote spawn points (forest edges, near trees)
    this.generateMoteSpawnPoints();
  }

  get landHealth(): number {
    return this._landHealth;
  }

  addBlessing(id: string): void {
    this.blessings.add(id);
    if (id === 'thornback_favor') {
      this.targetLandHealth = Math.min(1, this.targetLandHealth + 0.15);
    }
    if (id === 'mote_friendship') {
      this.maxMotes = Math.min(20, this.maxMotes + 4);
    }
  }

  /**
   * Recalculate land health from farming state.
   * Called once per day or after significant events.
   */
  recalculateLandHealth(farming: FarmingSystem, discoveryCount: number): void {
    let health = 0.5; // baseline

    const status = farming.getStatus();
    const totalTiles = farming.grid.size;

    if (totalTiles > 0) {
      // Fertility average
      let fertilitySum = 0;
      let tilledCount = 0;
      for (const tile of farming.grid.values()) {
        fertilitySum += tile.fertility;
        tilledCount++;
      }
      const avgFertility = tilledCount > 0 ? fertilitySum / tilledCount : 1;
      health += (avgFertility - 0.5) * 0.2; // +/- 0.1

      // Don't overfarm — penalize if >70% of farm area is tilled
      const farmArea = 14 * 10; // 140 tiles in farm zone
      const tilledRatio = tilledCount / farmArea;
      if (tilledRatio > 0.7) {
        health -= (tilledRatio - 0.7) * 0.5;
      }

      // Crop diversity bonus
      const uniqueCrops = new Set(farming.allCrops.map(c => c.data.id));
      health += Math.min(0.15, uniqueCrops.size * 0.03);
    }

    // Discovery bonus
    health += Math.min(0.2, discoveryCount * 0.05);

    // Blessing bonus
    health += this.blessings.size * 0.05;

    // Clamp
    this.targetLandHealth = Math.max(0, Math.min(1, health));
  }

  /**
   * Initialize motes for the scene.
   */
  initMotes(existingMotes: Mote[]): void {
    this.motes = existingMotes;
  }

  /**
   * Spawn additional motes if land health warrants it.
   */
  spawnMote(): Mote | null {
    if (this.motes.length >= this.maxMotes) return null;
    if (this._landHealth < MOTE_CONFIG.minLandHealth) return null;
    if (this.moteSpawnPoints.length === 0) return null;

    const point = this.moteSpawnPoints[Math.floor(Math.random() * this.moteSpawnPoints.length)];
    const mote = new Mote(this.scene, point.x, point.y);
    this.motes.push(mote);
    return mote;
  }

  update(time: number, delta: number, playerX: number, playerY: number): void {
    // Smooth land health transitions
    this._landHealth += (this.targetLandHealth - this._landHealth) * 0.01;

    // Mote population management
    this.updateMotePopulation();

    // Mote behavior influenced by player proximity and land health
    this.updateMotes(time, delta, playerX, playerY);

    // Thornback Elder
    this.updateThornback(time, delta, playerX, playerY);
  }

  private updateMotePopulation(): void {
    const targetCount = Math.floor(
      MOTE_CONFIG.baseCount + (this.maxMotes - MOTE_CONFIG.baseCount) * this._landHealth
    );

    // Spawn motes if under target
    if (this.motes.length < targetCount && Math.random() < 0.01) {
      this.spawnMote();
    }

    // Hide motes if over target (land health dropped)
    if (this.motes.length > targetCount) {
      const excess = this.motes.length - targetCount;
      for (let i = 0; i < Math.min(excess, 1); i++) {
        const mote = this.motes[this.motes.length - 1 - i];
        mote.hide();
      }
    }
  }

  private updateMotes(time: number, delta: number, playerX: number, playerY: number): void {
    for (const mote of this.motes) {
      mote.update(time, delta);
    }

    // Motes are drawn toward player when land health is high
    if (this._landHealth > 0.7) {
      for (const mote of this.motes) {
        // Occasionally a mote drifts toward the player
        if (Math.random() < 0.002) {
          const jitter = 30 + Math.random() * 20;
          mote.setHome(
            playerX + (Math.random() - 0.5) * jitter,
            playerY + (Math.random() - 0.5) * jitter - 10
          );
        }
      }
    }
  }

  private updateThornback(time: number, delta: number, playerX: number, playerY: number): void {
    const t = time / 1000;

    // Thornback appears when land health is high (>0.7) and player is near forest edge
    const nearForest = playerX < 9 * TILE_SIZE || playerX > 21 * TILE_SIZE;
    const shouldAppear = this._landHealth > 0.65 && nearForest && !this.hasThornbackAppearedThisRun;

    if (shouldAppear) {
      this.thornbackAppearanceTimer += delta;
      // Appears after player lingers near forest for 5 seconds
      if (this.thornbackAppearanceTimer > 5000 && !this.thornbackVisible) {
        this.thornbackVisible = true;
        this.hasThornbackAppearedThisRun = true;

        // Position: at the tree line, near but not on top of player
        if (playerX < 9 * TILE_SIZE) {
          this.thornbackX = 2 * TILE_SIZE;
          this.thornbackY = playerY - 20 + Math.random() * 40;
        } else {
          this.thornbackX = 24 * TILE_SIZE;
          this.thornbackY = playerY - 20 + Math.random() * 40;
        }

        this.events.emit('thornback-appears');
      }
    } else {
      this.thornbackAppearanceTimer = Math.max(0, this.thornbackAppearanceTimer - delta * 0.5);
    }

    // Fade in/out
    if (this.thornbackVisible) {
      this.thornbackAlpha = Math.min(1, this.thornbackAlpha + 0.005);
      this.thornbackEyeGlow = 0.3 + Math.sin(t * 0.5) * 0.2;

      // Slowly fade out after 15 seconds
      if (this.thornbackAlpha >= 1) {
        this.thornbackAlpha = 1;
        this.scene.time.delayedCall(15000, () => {
          this.thornbackVisible = false;
        });
      }

      // Disappear if player gets too close
      const dx = playerX - this.thornbackX;
      const dy = playerY - this.thornbackY;
      if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE * 3) {
        this.thornbackVisible = false;
        this.events.emit('thornback-retreats');
      }
    } else if (this.thornbackAlpha > 0) {
      this.thornbackAlpha = Math.max(0, this.thornbackAlpha - 0.008);
    }

    this.renderThornback(t);
  }

  /**
   * Render the Thornback as a tall antlered silhouette between trees.
   * Never fully visible — always partially obscured, mysterious.
   */
  private renderThornback(t: number): void {
    this.thornbackGraphics.clear();
    if (this.thornbackAlpha < 0.01) return;

    const x = this.thornbackX;
    const y = this.thornbackY;
    const alpha = this.thornbackAlpha;
    const elderData = ELDERS[0]; // Thornback

    // Subtle breathing sway
    const sway = Math.sin(t * 0.3) * 1;

    // Body silhouette (tall, narrow, dark)
    this.thornbackGraphics.fillStyle(elderData.silhouetteColor, alpha * 0.7);
    // Legs (thin)
    this.thornbackGraphics.fillRect(x - 3 + sway * 0.3, y + 5, 2, 18);
    this.thornbackGraphics.fillRect(x + 2 + sway * 0.3, y + 5, 2, 18);
    // Body
    this.thornbackGraphics.fillRect(x - 4 + sway * 0.5, y - 8, 9, 16);
    // Neck
    this.thornbackGraphics.fillRect(x - 2 + sway * 0.7, y - 16, 5, 10);
    // Head
    this.thornbackGraphics.fillRect(x - 3 + sway, y - 22, 7, 7);

    // Antlers (the most distinctive feature — wide, branching)
    this.thornbackGraphics.fillStyle(elderData.silhouetteColor, alpha * 0.8);
    // Left antler
    this.thornbackGraphics.fillRect(x - 4 + sway, y - 24, 1, 6);
    this.thornbackGraphics.fillRect(x - 8 + sway, y - 28, 1, 8);
    this.thornbackGraphics.fillRect(x - 8 + sway, y - 28, 5, 1);
    this.thornbackGraphics.fillRect(x - 12 + sway, y - 32, 1, 6);
    this.thornbackGraphics.fillRect(x - 12 + sway, y - 32, 5, 1);
    this.thornbackGraphics.fillRect(x - 6 + sway, y - 26, 3, 1);

    // Right antler (mirrored)
    this.thornbackGraphics.fillRect(x + 4 + sway, y - 24, 1, 6);
    this.thornbackGraphics.fillRect(x + 8 + sway, y - 28, 1, 8);
    this.thornbackGraphics.fillRect(x + 4 + sway, y - 28, 5, 1);
    this.thornbackGraphics.fillRect(x + 12 + sway, y - 32, 1, 6);
    this.thornbackGraphics.fillRect(x + 8 + sway, y - 32, 5, 1);
    this.thornbackGraphics.fillRect(x + 4 + sway, y - 26, 3, 1);

    // Eyes — two small glowing points
    const eyeAlpha = alpha * this.thornbackEyeGlow;
    this.thornbackGraphics.fillStyle(elderData.glowColor, eyeAlpha);
    this.thornbackGraphics.fillCircle(x - 1 + sway, y - 19, 1.5);
    this.thornbackGraphics.fillCircle(x + 2 + sway, y - 19, 1.5);

    // Eye glow halo
    this.thornbackGraphics.fillStyle(elderData.glowColor, eyeAlpha * 0.15);
    this.thornbackGraphics.fillCircle(x + 0.5 + sway, y - 19, 6);

    // Ground mist around feet
    this.thornbackGraphics.fillStyle(COLORS.PALE_GREEN, alpha * 0.08);
    for (let i = 0; i < 5; i++) {
      const mx = x - 10 + i * 5 + Math.sin(t + i * 2) * 3;
      const my = y + 20 + Math.sin(t * 0.5 + i) * 2;
      this.thornbackGraphics.fillCircle(mx, my, 4 + Math.sin(t + i) * 2);
    }
  }

  private generateMoteSpawnPoints(): void {
    // Left forest
    for (let i = 0; i < 10; i++) {
      this.moteSpawnPoints.push({
        x: Math.random() * 7 * TILE_SIZE + TILE_SIZE,
        y: Math.random() * MAP_HEIGHT,
      });
    }
    // Right of farm, near river
    for (let i = 0; i < 5; i++) {
      this.moteSpawnPoints.push({
        x: 22 * TILE_SIZE + Math.random() * 3 * TILE_SIZE,
        y: Math.random() * MAP_HEIGHT,
      });
    }
    // Farm edges (motes visit when health is high)
    for (let i = 0; i < 3; i++) {
      this.moteSpawnPoints.push({
        x: 8 * TILE_SIZE + Math.random() * 14 * TILE_SIZE,
        y: (5 + Math.random() * 10) * TILE_SIZE,
      });
    }
  }

  /**
   * Reset for a new run
   */
  reset(): void {
    this.thornbackVisible = false;
    this.thornbackAlpha = 0;
    this.hasThornbackAppearedThisRun = false;
    this.thornbackAppearanceTimer = 0;
    this.blessings.clear();
    this._landHealth = 0.5;
    this.targetLandHealth = 0.5;
    this.maxMotes = MOTE_CONFIG.maxCount;
  }

  destroy(): void {
    this.thornbackGraphics.destroy();
    this.events.removeAllListeners();
  }
}
