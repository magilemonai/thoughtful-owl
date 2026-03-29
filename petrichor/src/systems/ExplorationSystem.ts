import Phaser from 'phaser';
import { TILE_SIZE, DEPTH, MAP_HEIGHT } from '../config/constants';
import { COLORS, Season } from '../config/palette';
import { Discovery, DiscoveryCondition, DISCOVERIES } from '../data/discoveries';

interface ForestNode {
  x: number;
  y: number;
  type: 'path' | 'clearing' | 'dense' | 'water' | 'discovery';
  discovery?: Discovery;
  visited: boolean;
  treeCount: number;
}

interface ExplorationPoint {
  worldX: number;
  worldY: number;
  node: ForestNode;
  sprite: Phaser.GameObjects.Graphics;
  interactable: boolean;
  collected: boolean;
}

/**
 * Generates a procedural forest for exploration beyond the farm.
 * The forest is a grid of interconnected nodes with paths,
 * clearings, and discovery locations. Regenerated each run.
 *
 * The forest exists in the left portion of the map (tiles 0-7)
 * and extends the world rightward near the river (tiles 22-24).
 */
export class ExplorationSystem {
  private scene: Phaser.Scene;
  readonly events: Phaser.Events.EventEmitter;

  // Forest grid (separate from farm tilemap)
  private forestNodes: ForestNode[][] = [];
  private explorationPoints: ExplorationPoint[] = [];
  private discoveryContainer: Phaser.GameObjects.Container;
  private indicatorGraphics: Phaser.GameObjects.Graphics;

  // Discovery state
  private discoveredThisRun: Set<string> = new Set();
  private activeDiscovery: Discovery | null = null;

  // Discovery popup
  private popupContainer: Phaser.GameObjects.Container;
  private popupVisible = false;

  // Condition evaluation state
  private currentTimeOfDay = 'morning';
  private playerStillSeconds = 0;
  private lastPlayerX = 0;
  private lastPlayerY = 0;

  // Forest dimensions (in tiles, left forest zone)
  private readonly forestW = 7;
  private readonly forestH = 20;
  private readonly forestOffsetX = 0; // tile offset

  // Right forest zone (near river)
  private readonly rightForestMinX = 22;
  private readonly rightForestMaxX = 24;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();

    this.discoveryContainer = scene.add.container(0, 0);
    this.discoveryContainer.setDepth(DEPTH.GROUND_DECOR + 5);

    this.indicatorGraphics = scene.add.graphics();
    this.indicatorGraphics.setDepth(DEPTH.MOTES + 5);

    this.popupContainer = scene.add.container(0, 0);
    this.popupContainer.setDepth(DEPTH.UI + 20);
    this.popupContainer.setScrollFactor(0);
    this.popupContainer.setAlpha(0);
  }

  /**
   * Generate forest layout for a new run.
   * Discovery placement is influenced by season.
   */
  generate(season: Season, runNumber: number): void {
    this.forestNodes = [];
    this.cleanupPoints();

    // Seed RNG for reproducible-per-run forests
    const seed = runNumber * 7919 + 1;
    const rng = this.seededRandom(seed);

    // Generate left forest grid
    for (let y = 0; y < this.forestH; y++) {
      this.forestNodes[y] = [];
      for (let x = 0; x < this.forestW; x++) {
        const roll = rng();
        let type: ForestNode['type'] = 'dense';

        // Paths tend to form along certain columns
        if (x === 2 || x === 5) {
          type = roll < 0.6 ? 'path' : 'dense';
        } else if (roll < 0.15) {
          type = 'clearing';
        } else if (roll < 0.2 && y > 3) {
          type = 'water'; // small pond/stream
        }

        this.forestNodes[y][x] = {
          x: (this.forestOffsetX + x) * TILE_SIZE + TILE_SIZE / 2,
          y: y * TILE_SIZE + TILE_SIZE / 2,
          type,
          visited: false,
          treeCount: type === 'dense' ? 3 + Math.floor(rng() * 3) : type === 'path' ? 1 : 0,
        };
      }
    }

    // Place discoveries
    this.placeDiscoveries(season, rng);

    // Create visual indicators for discovery points
    this.createExplorationPoints();
  }

  private placeDiscoveries(season: Season, rng: () => number): void {
    // Select 3-5 discoveries for this run
    const available = DISCOVERIES.filter(d => {
      // Season bias increases chance
      if (d.seasonBias && d.seasonBias !== season) {
        return rng() < d.rarity * 0.5; // halved chance outside preferred season
      }
      return rng() < d.rarity;
    });

    // Take 3-5 of the available ones
    const count = Math.min(available.length, 3 + Math.floor(rng() * 3));
    const selected = available.slice(0, count);

    // Place on clearing or path nodes
    const candidates: ForestNode[] = [];
    for (const row of this.forestNodes) {
      for (const node of row) {
        if (node.type === 'clearing' || (node.type === 'path' && rng() < 0.3)) {
          candidates.push(node);
        }
      }
    }

    // Also add some right-forest discovery spots
    for (let y = 2; y < 18; y += 4) {
      if (rng() < 0.5) {
        const rightNode: ForestNode = {
          x: (this.rightForestMinX + Math.floor(rng() * 2)) * TILE_SIZE + TILE_SIZE / 2,
          y: y * TILE_SIZE + TILE_SIZE / 2,
          type: 'clearing',
          visited: false,
          treeCount: 0,
        };
        candidates.push(rightNode);
      }
    }

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < selected.length && i < candidates.length; i++) {
      candidates[i].type = 'discovery';
      candidates[i].discovery = selected[i];
    }
  }

  private createExplorationPoints(): void {
    for (const row of this.forestNodes) {
      for (const node of row) {
        if (node.type === 'discovery' && node.discovery) {
          this.createDiscoveryMarker(node);
        }
      }
    }
  }

  private createDiscoveryMarker(node: ForestNode): void {
    const gfx = this.scene.add.graphics();
    this.discoveryContainer.add(gfx);

    const point: ExplorationPoint = {
      worldX: node.x,
      worldY: node.y,
      node,
      sprite: gfx,
      interactable: true,
      collected: false,
    };

    this.explorationPoints.push(point);
  }

  /**
   * Check if a discovery's conditions are met.
   */
  private meetsConditions(condition?: DiscoveryCondition): boolean {
    if (!condition) return true;
    if (condition.timeOfDay && !condition.timeOfDay.includes(this.currentTimeOfDay)) {
      return false;
    }
    if (condition.stillnessSeconds && this.playerStillSeconds < condition.stillnessSeconds) {
      return false;
    }
    if (condition.minDiscoveries && this.discoveredThisRun.size < condition.minDiscoveries) {
      return false;
    }
    return true;
  }

  /**
   * Check if player is near a discovery point.
   * Returns the discovery if within interaction range and conditions are met.
   */
  checkProximity(playerX: number, playerY: number): Discovery | null {
    if (this.popupVisible) return null;

    for (const point of this.explorationPoints) {
      if (point.collected || !point.interactable) continue;

      const dx = playerX - point.worldX;
      const dy = playerY - point.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TILE_SIZE * 1.5) {
        const discovery = point.node.discovery;
        if (discovery && this.meetsConditions(discovery.condition)) {
          return discovery;
        }
      }
    }
    return null;
  }

  /**
   * Interact with the nearest discovery point.
   * Returns the reward data if successful.
   */
  interact(playerX: number, playerY: number): {
    discovery: Discovery;
    reward: Discovery['reward'];
  } | null {
    for (const point of this.explorationPoints) {
      if (point.collected || !point.interactable) continue;

      const dx = playerX - point.worldX;
      const dy = playerY - point.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TILE_SIZE * 1.5 && point.node.discovery && this.meetsConditions(point.node.discovery.condition)) {
        point.collected = true;
        point.node.visited = true;
        this.discoveredThisRun.add(point.node.discovery.id);

        const discovery = point.node.discovery;
        this.activeDiscovery = discovery;
        this.showDiscoveryPopup(discovery, point.worldX, point.worldY);
        this.createCollectEffect(point.worldX, point.worldY, discovery.type);

        this.events.emit('discovery', discovery);

        return {
          discovery,
          reward: discovery.reward,
        };
      }
    }
    return null;
  }

  /**
   * Render discovery point indicators (glowing markers in the forest).
   */
  update(time: number, playerX: number, playerY: number, delta?: number): void {
    // Track player stillness
    const dt = (delta || 16) / 1000;
    const moved = Math.abs(playerX - this.lastPlayerX) + Math.abs(playerY - this.lastPlayerY);
    if (moved < 0.5) {
      this.playerStillSeconds += dt;
    } else {
      this.playerStillSeconds = 0;
    }
    this.lastPlayerX = playerX;
    this.lastPlayerY = playerY;

    this.indicatorGraphics.clear();
    const t = time / 1000;

    for (const point of this.explorationPoints) {
      if (point.collected) continue;

      const discovery = point.node.discovery!;
      // Hide indicators for discoveries whose conditions aren't met
      if (!this.meetsConditions(discovery.condition)) continue;

      const dx = playerX - point.worldX;
      const dy = playerY - point.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only show indicators when player is within detection range
      if (dist > TILE_SIZE * 12) continue;
      const proximityAlpha = Math.max(0, 1 - dist / (TILE_SIZE * 10));

      // Different indicator styles per discovery type
      const pulse = 0.5 + Math.sin(t * 2 + point.worldX * 0.1) * 0.5;
      let color: number = COLORS.PALE_GREEN;
      let glowRadius = 6;

      switch (discovery.type) {
        case 'seed': color = COLORS.GOLDEN_WHEAT; glowRadius = 5; break;
        case 'grove': color = COLORS.PALE_GREEN; glowRadius = 8; break;
        case 'shrine': color = COLORS.LAVENDER; glowRadius = 7; break;
        case 'spring': color = COLORS.LIGHT_SKY; glowRadius = 6; break;
        case 'foraging': color = COLORS.WARM_AMBER; glowRadius = 5; break;
        case 'lore': color = COLORS.PALE_LILAC; glowRadius = 6; break;
      }

      // Outer glow
      this.indicatorGraphics.fillStyle(color, proximityAlpha * pulse * 0.1);
      this.indicatorGraphics.fillCircle(point.worldX, point.worldY, glowRadius * 2);

      // Inner glow
      this.indicatorGraphics.fillStyle(color, proximityAlpha * pulse * 0.3);
      this.indicatorGraphics.fillCircle(point.worldX, point.worldY, glowRadius);

      // Core sparkle
      this.indicatorGraphics.fillStyle(COLORS.SOFT_WHITE, proximityAlpha * pulse * 0.6);
      this.indicatorGraphics.fillCircle(point.worldX, point.worldY, 2);

      // Floating particles around discovery
      if (proximityAlpha > 0.3) {
        for (let i = 0; i < 3; i++) {
          const angle = t * 0.8 + i * (Math.PI * 2 / 3);
          const radius = glowRadius + Math.sin(t * 1.5 + i) * 3;
          const px = point.worldX + Math.cos(angle) * radius;
          const py = point.worldY + Math.sin(angle) * radius;
          this.indicatorGraphics.fillStyle(color, proximityAlpha * 0.4);
          this.indicatorGraphics.fillCircle(px, py, 1);
        }
      }

      // Direction hint when somewhat close
      if (dist < TILE_SIZE * 6 && dist > TILE_SIZE * 2) {
        const dirX = (point.worldX - playerX) / dist;
        const dirY = (point.worldY - playerY) / dist;
        const hintDist = 20;
        this.indicatorGraphics.fillStyle(color, 0.15 * pulse);
        this.indicatorGraphics.fillCircle(
          playerX + dirX * hintDist,
          playerY + dirY * hintDist - 8, // above player
          2
        );
      }
    }

    // Update popup fade
    if (this.popupVisible) {
      this.popupContainer.setAlpha(Math.min(1, this.popupContainer.alpha + 0.05));
    }
  }

  private showDiscoveryPopup(discovery: Discovery, worldX: number, worldY: number): void {
    this.popupContainer.removeAll(true);
    this.popupVisible = true;
    this.popupContainer.setAlpha(0);

    const cam = this.scene.cameras.main;
    const screenX = 160; // center of 320px screen
    const screenY = 40;

    // Background panel
    const bg = this.scene.add.graphics();
    const panelW = 160;
    const panelH = 40;
    bg.fillStyle(COLORS.MIDNIGHT, 0.9);
    bg.fillRoundedRect(screenX - panelW / 2, screenY, panelW, panelH, 3);
    bg.lineStyle(1, COLORS.MUTED_SKY, 0.3);
    bg.strokeRoundedRect(screenX - panelW / 2, screenY, panelW, panelH, 3);
    this.popupContainer.add(bg);

    // Discovery name
    const nameText = this.scene.add.text(screenX, screenY + 8, discovery.name, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.popupContainer.add(nameText);

    // Description
    const descText = this.scene.add.text(screenX, screenY + 18, discovery.description, {
      fontFamily: 'monospace',
      fontSize: '5px',
      color: `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`,
      align: 'center',
      wordWrap: { width: panelW - 16 },
    }).setOrigin(0.5, 0);
    this.popupContainer.add(descText);

    // Auto-dismiss after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      this.scene.tweens.add({
        targets: this.popupContainer,
        alpha: 0,
        duration: 800,
        onComplete: () => {
          this.popupVisible = false;
          this.activeDiscovery = null;
        },
      });
    });
  }

  private createCollectEffect(x: number, y: number, type: string): void {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(DEPTH.WEATHER_FRONT);

    let color: number = COLORS.PALE_GREEN;
    if (type === 'seed') color = COLORS.GOLDEN_WHEAT;
    if (type === 'shrine') color = COLORS.LAVENDER;
    if (type === 'spring') color = COLORS.LIGHT_SKY;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 1,
      });
    }

    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: 35,
      callback: () => {
        gfx.clear();
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.01;
          p.life -= 0.028;
          if (p.life > 0) {
            gfx.fillStyle(color, p.life * 0.7);
            gfx.fillCircle(p.x, p.y, 1.5 * p.life);
          }
        }
      },
    });

    this.scene.time.delayedCall(600, () => { timer.destroy(); gfx.destroy(); });
  }

  setTimeOfDay(timeOfDay: string): void {
    this.currentTimeOfDay = timeOfDay;
  }

  get discoveryCount(): number {
    return this.discoveredThisRun.size;
  }

  get isPopupVisible(): boolean {
    return this.popupVisible;
  }

  private cleanupPoints(): void {
    for (const point of this.explorationPoints) {
      point.sprite.destroy();
    }
    this.explorationPoints = [];
    this.discoveredThisRun.clear();
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  destroy(): void {
    this.cleanupPoints();
    this.discoveryContainer.destroy();
    this.indicatorGraphics.destroy();
    this.popupContainer.destroy();
    this.events.removeAllListeners();
  }
}
