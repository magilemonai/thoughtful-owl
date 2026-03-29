import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/constants';
import { COLORS } from '../config/palette';
import { AmbientMixer } from '../audio/AmbientMixer';

/**
 * Boot scene: generates all procedural assets and audio,
 * shows a minimal loading screen, then transitions to Title.
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
    // Generate procedural textures
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
    const canvas = document.createElement('canvas');
    canvas.width = cols * ts;
    canvas.height = rows * ts;
    const ctx = canvas.getContext('2d')!;

    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

    // Row 0: Grass variants (8 tiles)
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      ctx.fillStyle = hex(COLORS.FOREST_GREEN);
      ctx.fillRect(ox, 0, ts, ts);

      // Grass texture detail
      ctx.fillStyle = hex(COLORS.FRESH_GREEN);
      for (let p = 0; p < 6; p++) {
        const gx = ox + Math.floor(Math.sin(i * 3 + p * 7) * 6 + 8);
        const gy = Math.floor(Math.cos(i * 5 + p * 3) * 6 + 8);
        ctx.fillRect(gx, gy, 1, 2);
      }
      // Darker patches
      ctx.fillStyle = hex(COLORS.DEEP_FOREST);
      for (let p = 0; p < 3; p++) {
        const gx = ox + Math.floor(Math.sin(i * 7 + p * 11) * 5 + 8);
        const gy = Math.floor(Math.cos(i * 11 + p * 7) * 5 + 8);
        ctx.fillRect(gx, gy, 2, 1);
      }
    }

    // Row 1: Soil variants (tilled, watered, dry)
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts;
      const baseColor = i < 3 ? COLORS.EARTH : i < 6 ? COLORS.DEEP_AMBER : COLORS.DARK_SLATE;
      ctx.fillStyle = hex(baseColor);
      ctx.fillRect(ox, oy, ts, ts);

      // Furrow lines
      ctx.fillStyle = hex(COLORS.VOID);
      for (let line = 0; line < 3; line++) {
        ctx.globalAlpha = 0.15;
        ctx.fillRect(ox + 2, oy + 3 + line * 5, 12, 1);
      }
      ctx.globalAlpha = 1;
    }

    // Row 2: Water tiles
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 2;
      ctx.fillStyle = hex(COLORS.STEEL_BLUE);
      ctx.fillRect(ox, oy, ts, ts);
      ctx.fillStyle = hex(COLORS.MUTED_SKY);
      // Wave highlights
      const waveOffset = i * 3;
      ctx.fillRect(ox + (waveOffset % 12) + 2, oy + 4, 4, 1);
      ctx.fillRect(ox + ((waveOffset + 6) % 12) + 2, oy + 10, 3, 1);
    }

    // Row 3: Path/dirt tiles
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 3;
      ctx.fillStyle = hex(COLORS.WARM_GREY);
      ctx.fillRect(ox, oy, ts, ts);
      ctx.fillStyle = hex(COLORS.PARCHMENT);
      for (let p = 0; p < 4; p++) {
        const px = ox + Math.floor(Math.sin(i * 5 + p * 9) * 5 + 8);
        const py = oy + Math.floor(Math.cos(i * 9 + p * 5) * 5 + 8);
        ctx.fillRect(px, py, 2, 1);
      }
    }

    // Row 4: Forest floor
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 4;
      ctx.fillStyle = hex(COLORS.DEEP_FOREST);
      ctx.fillRect(ox, oy, ts, ts);
      ctx.fillStyle = hex(COLORS.EARTH);
      for (let p = 0; p < 5; p++) {
        const px = ox + Math.floor(Math.sin(i * 7 + p * 13) * 6 + 8);
        const py = oy + Math.floor(Math.cos(i * 13 + p * 7) * 6 + 8);
        ctx.fillRect(px, py, 2, 2);
      }
    }

    // Row 5: Snow-covered grass (winter)
    for (let i = 0; i < cols; i++) {
      const ox = i * ts;
      const oy = ts * 5;
      ctx.fillStyle = hex(COLORS.PALE_CLOUD);
      ctx.fillRect(ox, oy, ts, ts);
      ctx.fillStyle = hex(COLORS.SOFT_WHITE);
      for (let p = 0; p < 4; p++) {
        const px = ox + Math.floor(Math.sin(i * 3 + p * 11) * 5 + 8);
        const py = oy + Math.floor(Math.cos(i * 7 + p * 3) * 5 + 8);
        ctx.fillRect(px, py, 3, 2);
      }
      // Subtle grass poking through
      ctx.fillStyle = hex(COLORS.FOREST_GREEN);
      ctx.globalAlpha = 0.3;
      ctx.fillRect(ox + 6 + i, oy + 10, 1, 3);
      ctx.globalAlpha = 1;
    }

    this.textures.addCanvas('terrain', canvas);

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
    const canvas = document.createElement('canvas');
    // 3 tree variants, each 32×48
    const treeW = 32;
    const treeH = 48;
    canvas.width = treeW * 3;
    canvas.height = treeH;
    const ctx = canvas.getContext('2d')!;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

    for (let t = 0; t < 3; t++) {
      const ox = t * treeW;

      // Trunk
      ctx.fillStyle = hex(COLORS.EARTH);
      const trunkW = 4 + t;
      const trunkH = 16 + t * 2;
      ctx.fillRect(ox + (treeW - trunkW) / 2, treeH - trunkH, trunkW, trunkH);

      // Canopy layers (bottom to top, getting smaller)
      const layers = 3 + t;
      for (let l = 0; l < layers; l++) {
        const layerY = treeH - trunkH - 4 - l * 7;
        const layerW = 20 - l * 3 + t * 2;
        const shade = l % 2 === 0 ? COLORS.FOREST_GREEN : COLORS.DEEP_FOREST;
        ctx.fillStyle = hex(shade);
        ctx.fillRect(ox + (treeW - layerW) / 2, layerY, layerW, 8);
      }

      // Highlight leaves
      ctx.fillStyle = hex(COLORS.FRESH_GREEN);
      for (let h = 0; h < 4; h++) {
        const hx = ox + 8 + Math.floor(Math.sin(t * 5 + h * 7) * 8 + 8);
        const hy = 8 + Math.floor(Math.cos(t * 7 + h * 5) * 8);
        ctx.fillRect(hx, hy, 2, 2);
      }
    }

    this.textures.addCanvas('trees', canvas);
    const texture = this.textures.get('trees');
    for (let i = 0; i < 3; i++) {
      texture.add(i, 0, i * treeW, 0, treeW, treeH);
    }
  }

  private generateObjectSprites(): void {
    const canvas = document.createElement('canvas');
    const size = 16;
    // Objects: rock, bush, flower, mushroom, stump
    const count = 5;
    canvas.width = size * count;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

    // Rock
    ctx.fillStyle = hex(COLORS.STONE_GREY);
    ctx.fillRect(3, 8, 10, 6);
    ctx.fillRect(5, 6, 6, 3);
    ctx.fillStyle = hex(COLORS.WARM_GREY);
    ctx.fillRect(5, 8, 3, 2);

    // Bush
    let ox = size;
    ctx.fillStyle = hex(COLORS.FOREST_GREEN);
    ctx.fillRect(ox + 3, 6, 10, 8);
    ctx.fillStyle = hex(COLORS.FRESH_GREEN);
    ctx.fillRect(ox + 5, 5, 6, 4);
    ctx.fillStyle = hex(COLORS.PALE_GREEN);
    ctx.fillRect(ox + 6, 6, 2, 2);

    // Flower
    ox = size * 2;
    ctx.fillStyle = hex(COLORS.FOREST_GREEN);
    ctx.fillRect(ox + 7, 8, 2, 6);
    ctx.fillStyle = hex(COLORS.SOFT_PINK);
    ctx.fillRect(ox + 6, 5, 4, 4);
    ctx.fillStyle = hex(COLORS.PALE_GOLD);
    ctx.fillRect(ox + 7, 6, 2, 2);

    // Mushroom
    ox = size * 3;
    ctx.fillStyle = hex(COLORS.PARCHMENT);
    ctx.fillRect(ox + 7, 9, 2, 5);
    ctx.fillStyle = hex(COLORS.ROSE_RED);
    ctx.fillRect(ox + 4, 6, 8, 4);
    ctx.fillStyle = hex(COLORS.SOFT_WHITE);
    ctx.fillRect(ox + 6, 7, 2, 1);
    ctx.fillRect(ox + 9, 7, 1, 1);

    // Stump
    ox = size * 4;
    ctx.fillStyle = hex(COLORS.EARTH);
    ctx.fillRect(ox + 4, 8, 8, 6);
    ctx.fillStyle = hex(COLORS.DEEP_AMBER);
    ctx.fillRect(ox + 5, 8, 6, 2);
    ctx.fillStyle = hex(COLORS.WARM_GREY);
    ctx.fillRect(ox + 6, 9, 4, 1);

    this.textures.addCanvas('objects', canvas);
    const texture = this.textures.get('objects');
    for (let i = 0; i < count; i++) {
      texture.add(i, 0, i * size, 0, size, size);
    }
  }
}
