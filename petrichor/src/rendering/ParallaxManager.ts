import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/constants';

interface ParallaxLayer {
  image: Phaser.GameObjects.TileSprite;
  scrollFactor: number;
  depth: number;
}

/**
 * Manages parallax background layers that scroll at different rates
 * relative to the camera, creating depth illusion.
 */
export class ParallaxManager {
  private layers: ParallaxLayer[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  addLayer(
    textureKey: string,
    scrollFactor: number,
    depth: number,
    yOffset: number = 0
  ): void {
    const image = this.scene.add.tileSprite(
      0, yOffset,
      GAME_WIDTH * 3, // wider than screen for scrolling
      GAME_HEIGHT,
      textureKey
    );
    image.setOrigin(0, 0);
    image.setDepth(depth);
    image.setScrollFactor(0); // we handle scrolling manually

    this.layers.push({ image, scrollFactor, depth });
  }

  /**
   * Creates default three-layer parallax background using generated textures
   */
  createDefaultLayers(): void {
    this.createMountainTexture();
    this.createTreelineTexture();
    this.createMistTexture();

    this.addLayer('bg_mountains', 0.05, DEPTH.PARALLAX_FAR);
    this.addLayer('bg_treeline', 0.15, DEPTH.PARALLAX_MID);
    this.addLayer('bg_mist', 0.08, DEPTH.PARALLAX_NEAR, GAME_HEIGHT * 0.6);
  }

  update(cameraX: number, _cameraY: number): void {
    for (const layer of this.layers) {
      layer.image.tilePositionX = cameraX * layer.scrollFactor;
    }
  }

  /**
   * Procedurally generate a mountain silhouette texture
   */
  private createMountainTexture(): void {
    const w = GAME_WIDTH * 2;
    const h = GAME_HEIGHT;
    const gfx = this.scene.add.graphics();

    // Sky gradient
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const r = Math.floor(0x3d + (0xb8 - 0x3d) * t);
      const g = Math.floor(0x5a + (0xd8 - 0x5a) * t);
      const b = Math.floor(0x80 + (0xe8 - 0x80) * t);
      gfx.fillStyle((r << 16) | (g << 8) | b, 1);
      gfx.fillRect(0, y, w, 1);
    }

    // Mountain silhouettes
    gfx.fillStyle(0x2c3e50, 0.6);
    this.drawMountainRange(gfx, w, h, 0.4, 0.25, 6);
    gfx.fillStyle(0x1a1a2e, 0.5);
    this.drawMountainRange(gfx, w, h, 0.55, 0.15, 8);

    gfx.generateTexture('bg_mountains', w, h);
    gfx.destroy();
  }

  private drawMountainRange(
    gfx: Phaser.GameObjects.Graphics,
    w: number, h: number,
    baseY: number, amplitude: number, peaks: number
  ): void {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= peaks * 4; i++) {
      const x = (i / (peaks * 4)) * w;
      const noise = Math.sin(i * 0.8) * 0.5 + Math.sin(i * 1.7) * 0.3 + Math.sin(i * 3.1) * 0.2;
      const y = h * baseY - noise * h * amplitude;
      points.push({ x, y });
    }

    gfx.beginPath();
    gfx.moveTo(0, h);
    for (const p of points) {
      gfx.lineTo(p.x, p.y);
    }
    gfx.lineTo(w, h);
    gfx.closePath();
    gfx.fillPath();
  }

  /**
   * Procedurally generate treeline silhouette
   */
  private createTreelineTexture(): void {
    const w = GAME_WIDTH * 2;
    const h = GAME_HEIGHT;
    const gfx = this.scene.add.graphics();

    gfx.fillStyle(0x1b4332, 0.7);

    const treeCount = 40;
    // Draw trees as simple triangular silhouettes
    for (let i = 0; i < treeCount; i++) {
      const x = (i / treeCount) * w + (Math.sin(i * 2.3) * 20);
      const treeH = 30 + Math.sin(i * 1.7) * 15 + Math.sin(i * 4.2) * 8;
      const baseY = h * 0.65;
      const treeW = 12 + Math.sin(i * 3.1) * 4;

      // Tree triangle
      gfx.beginPath();
      gfx.moveTo(x, baseY - treeH);
      gfx.lineTo(x - treeW, baseY);
      gfx.lineTo(x + treeW, baseY);
      gfx.closePath();
      gfx.fillPath();
    }

    // Ground fill below treeline
    gfx.fillStyle(0x1b4332, 0.7);
    gfx.fillRect(0, h * 0.65, w, h * 0.35);

    gfx.generateTexture('bg_treeline', w, h);
    gfx.destroy();
  }

  /**
   * Procedurally generate a soft mist layer
   */
  private createMistTexture(): void {
    const w = GAME_WIDTH * 2;
    const h = Math.floor(GAME_HEIGHT * 0.4);
    const gfx = this.scene.add.graphics();

    // Soft horizontal mist bands
    for (let y = 0; y < h; y++) {
      const alpha = Math.sin((y / h) * Math.PI) * 0.15;
      gfx.fillStyle(0xd4cfc4, alpha);
      gfx.fillRect(0, y, w, 1);
    }

    gfx.generateTexture('bg_mist', w, h);
    gfx.destroy();
  }

  setTint(color: number): void {
    for (const layer of this.layers) {
      layer.image.setTint(color);
    }
  }
}
