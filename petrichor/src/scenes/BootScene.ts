import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/constants';
import { COLORS } from '../config/palette';
import { AmbientMixer } from '../audio/AmbientMixer';

/**
 * Boot scene: generates all procedural assets and audio,
 * shows a minimal loading screen, then transitions to Title.
 *
 * All textures are generated using Phaser's Graphics.generateTexture()
 * for reliable WebGL texture creation on mobile devices.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show loading bar
    const barW = 100;
    const barH = 4;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT / 2 + 20;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.DARK_SLATE, 0.5);
    bg.fillRect(barX, barY, barW, barH);

    const fill = this.add.graphics();
    this.load.on('progress', (value: number) => {
      fill.clear();
      fill.fillStyle(COLORS.FRESH_GREEN, 1);
      fill.fillRect(barX, barY, barW * value, barH);
    });

    // Title text
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, 'petrichor', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
      letterSpacing: 4,
    }).setOrigin(0.5);
  }

  create(): void {
    // Generate procedural textures using Phaser Graphics
    this.generateTerrainTileset();
    this.generateTreeSprites();
    this.generateObjectSprites();

    // Generate procedural audio
    AmbientMixer.generateProceduralAudio(this);

    // Small delay for visual polish
    this.time.delayedCall(800, () => {
      this.scene.start('TitleScene');
    });
  }

  private generateTerrainTileset(): void {
    const ts = TILE_SIZE;
    const cols = 8;
    const rows = 6;
    const g = this.add.graphics();

    // Row 0: Grass variants (8 tiles)
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      g.fillStyle(COLORS.FOREST_GREEN);
      g.fillRect(ox, 0, ts, ts);

      // Grass texture detail
      g.fillStyle(COLORS.FRESH_GREEN);
      for (let p = 0; p < 6; p++) {
        const gx = ox + Math.floor(Math.sin(i * 3 + p * 7) * 6 + 8);
        const gy = Math.floor(Math.cos(i * 5 + p * 3) * 6 + 8);
        g.fillRect(gx, gy, 1, 2);
      }
      // Darker patches
      g.fillStyle(COLORS.DEEP_FOREST);
      for (let p = 0; p < 3; p++) {
        const gx = ox + Math.floor(Math.sin(i * 7 + p * 11) * 5 + 8);
        const gy = Math.floor(Math.cos(i * 11 + p * 7) * 5 + 8);
        g.fillRect(gx, gy, 2, 1);
      }
    }

    // Row 1: Soil variants (tilled, watered, dry)
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts;
      const baseColor = i < 3 ? COLORS.EARTH : i < 6 ? COLORS.DEEP_AMBER : COLORS.DARK_SLATE;
      g.fillStyle(baseColor);
      g.fillRect(ox, oy, ts, ts);

      // Furrow lines
      g.fillStyle(COLORS.VOID, 0.15);
      for (let line = 0; line < 3; line++) {
        g.fillRect(ox + 2, oy + 3 + line * 5, 12, 1);
      }
    }

    // Row 2: Water tiles
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 2;
      g.fillStyle(COLORS.STEEL_BLUE);
      g.fillRect(ox, oy, ts, ts);
      g.fillStyle(COLORS.MUTED_SKY);
      const waveOffset = i * 3;
      g.fillRect(ox + (waveOffset % 12) + 2, oy + 4, 4, 1);
      g.fillRect(ox + ((waveOffset + 6) % 12) + 2, oy + 10, 3, 1);
    }

    // Row 3: Path/dirt tiles
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 3;
      g.fillStyle(COLORS.WARM_GREY);
      g.fillRect(ox, oy, ts, ts);
      g.fillStyle(COLORS.PARCHMENT);
      for (let p = 0; p < 4; p++) {
        const px = ox + Math.floor(Math.sin(i * 5 + p * 9) * 5 + 8);
        const py = oy + Math.floor(Math.cos(i * 9 + p * 5) * 5 + 8);
        g.fillRect(px, py, 2, 1);
      }
    }

    // Row 4: Forest floor
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 4;
      g.fillStyle(COLORS.DEEP_FOREST);
      g.fillRect(ox, oy, ts, ts);
      g.fillStyle(COLORS.EARTH);
      for (let p = 0; p < 5; p++) {
        const px = ox + Math.floor(Math.sin(i * 7 + p * 13) * 6 + 8);
        const py = oy + Math.floor(Math.cos(i * 13 + p * 7) * 6 + 8);
        g.fillRect(px, py, 2, 2);
      }
    }

    // Row 5: Snow-covered grass (winter)
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 5;
      g.fillStyle(COLORS.PALE_CLOUD);
      g.fillRect(ox, oy, ts, ts);
      g.fillStyle(COLORS.SOFT_WHITE);
      for (let p = 0; p < 4; p++) {
        const px = ox + Math.floor(Math.sin(i * 3 + p * 11) * 5 + 8);
        const py = oy + Math.floor(Math.cos(i * 7 + p * 3) * 5 + 8);
        g.fillRect(px, py, 3, 2);
      }
      // Subtle grass poking through
      g.fillStyle(COLORS.FOREST_GREEN, 0.3);
      g.fillRect(ox + 6 + i, oy + 10, 1, 3);
    }

    g.generateTexture('terrain', cols * ts, rows * ts);
    g.destroy();

    // Define individual tile frames
    const texture = this.textures.get('terrain');
    let frame = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        texture.add(frame, 0, col * ts, row * ts, ts, ts);
        frame++;
      }
    }
  }

  private generateTreeSprites(): void {
    const treeW = 32;
    const treeH = 48;
    const g = this.add.graphics();

    for (let t = 0; t < 3; t++) {
      const ox = t * treeW;

      // Trunk
      g.fillStyle(COLORS.EARTH);
      const trunkW = 4 + t;
      const trunkH = 16 + t * 2;
      g.fillRect(ox + (treeW - trunkW) / 2, treeH - trunkH, trunkW, trunkH);

      // Canopy layers (bottom to top, getting smaller)
      const layers = 3 + t;
      for (let l = 0; l < layers; l++) {
        const layerY = treeH - trunkH - 4 - l * 7;
        const layerW = 20 - l * 3 + t * 2;
        const shade = l % 2 === 0 ? COLORS.FOREST_GREEN : COLORS.DEEP_FOREST;
        g.fillStyle(shade);
        g.fillRect(ox + (treeW - layerW) / 2, layerY, layerW, 8);
      }

      // Highlight leaves
      g.fillStyle(COLORS.FRESH_GREEN);
      for (let h = 0; h < 4; h++) {
        const hx = ox + 8 + Math.floor(Math.sin(t * 5 + h * 7) * 8 + 8);
        const hy = 8 + Math.floor(Math.cos(t * 7 + h * 5) * 8);
        g.fillRect(hx, hy, 2, 2);
      }
    }

    g.generateTexture('trees', treeW * 3, treeH);
    g.destroy();

    const texture = this.textures.get('trees');
    for (let i = 0; i < 3; i++) {
      texture.add(i, 0, i * treeW, 0, treeW, treeH);
    }
  }

  private generateObjectSprites(): void {
    const size = 16;
    const count = 5;
    const g = this.add.graphics();

    // Rock
    g.fillStyle(COLORS.STONE_GREY);
    g.fillRect(3, 8, 10, 6);
    g.fillRect(5, 6, 6, 3);
    g.fillStyle(COLORS.WARM_GREY);
    g.fillRect(5, 8, 3, 2);

    // Bush
    let ox = size;
    g.fillStyle(COLORS.FOREST_GREEN);
    g.fillRect(ox + 3, 6, 10, 8);
    g.fillStyle(COLORS.FRESH_GREEN);
    g.fillRect(ox + 5, 5, 6, 4);
    g.fillStyle(COLORS.PALE_GREEN);
    g.fillRect(ox + 6, 6, 2, 2);

    // Flower
    ox = size * 2;
    g.fillStyle(COLORS.FOREST_GREEN);
    g.fillRect(ox + 7, 8, 2, 6);
    g.fillStyle(COLORS.SOFT_PINK);
    g.fillRect(ox + 6, 5, 4, 4);
    g.fillStyle(COLORS.PALE_GOLD);
    g.fillRect(ox + 7, 6, 2, 2);

    // Mushroom
    ox = size * 3;
    g.fillStyle(COLORS.PARCHMENT);
    g.fillRect(ox + 7, 9, 2, 5);
    g.fillStyle(COLORS.ROSE_RED);
    g.fillRect(ox + 4, 6, 8, 4);
    g.fillStyle(COLORS.SOFT_WHITE);
    g.fillRect(ox + 6, 7, 2, 1);
    g.fillRect(ox + 9, 7, 1, 1);

    // Stump
    ox = size * 4;
    g.fillStyle(COLORS.EARTH);
    g.fillRect(ox + 4, 8, 8, 6);
    g.fillStyle(COLORS.DEEP_AMBER);
    g.fillRect(ox + 5, 8, 6, 2);
    g.fillStyle(COLORS.WARM_GREY);
    g.fillRect(ox + 6, 9, 4, 1);

    g.generateTexture('objects', size * count, size);
    g.destroy();

    const texture = this.textures.get('objects');
    for (let i = 0; i < count; i++) {
      texture.add(i, 0, i * size, 0, size, size);
    }
  }
}
