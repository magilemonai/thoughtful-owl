import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { COLORS, TIME_PROFILES } from '../config/palette';

/**
 * Title screen — atmospheric, minimal, beautiful.
 * Animated sky gradient cycling through dawn colors.
 * "petrichor" in elegant spacing, tap to begin.
 */
export class TitleScene extends Phaser.Scene {
  private skyGradient!: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private particles!: Phaser.GameObjects.Graphics;
  private motes: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; phase: number }> = [];

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.elapsed = 0;

    // Sky gradient background
    this.skyGradient = this.add.graphics();
    this.renderSky(0);

    // Floating motes in the background
    this.particles = this.add.graphics();
    for (let i = 0; i < 20; i++) {
      this.motes.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.1 - Math.random() * 0.3,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.1 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Mountain silhouette at bottom
    const mountains = this.add.graphics();
    mountains.fillStyle(COLORS.MIDNIGHT, 0.8);
    mountains.beginPath();
    mountains.moveTo(0, GAME_HEIGHT);
    const peaks = [
      { x: 0, y: 140 }, { x: 40, y: 115 }, { x: 80, y: 125 },
      { x: 120, y: 100 }, { x: 160, y: 110 }, { x: 200, y: 95 },
      { x: 240, y: 120 }, { x: 280, y: 108 }, { x: 320, y: 130 },
    ];
    for (const p of peaks) {
      mountains.lineTo(p.x, p.y);
    }
    mountains.lineTo(GAME_WIDTH, GAME_HEIGHT);
    mountains.closePath();
    mountains.fillPath();

    // Tree line
    const treeline = this.add.graphics();
    treeline.fillStyle(COLORS.DEEP_FOREST, 0.9);
    treeline.beginPath();
    treeline.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 8) {
      const h = 145 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.13) * 5;
      treeline.lineTo(x, h);
    }
    treeline.lineTo(GAME_WIDTH, GAME_HEIGHT);
    treeline.closePath();
    treeline.fillPath();

    // Title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, 'petrichor', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
      letterSpacing: 6,
    });
    title.setOrigin(0.5);
    title.setAlpha(0);

    // Subtitle
    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35 + 18, 'the scent of rain on dry earth', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`,
      letterSpacing: 2,
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0);

    // "tap to begin"
    const tapText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.75, 'tap to begin', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: `#${COLORS.MUTED_SKY.toString(16).padStart(6, '0')}`,
      letterSpacing: 2,
    });
    tapText.setOrigin(0.5);
    tapText.setAlpha(0);

    // Fade in sequence
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 2000,
      delay: 500,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: subtitle,
      alpha: 0.7,
      duration: 2000,
      delay: 1500,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: tapText,
      alpha: { from: 0, to: 0.5 },
      duration: 1500,
      delay: 2500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Input to start game
    this.input.once('pointerdown', () => {
      this.cameras.main.fadeOut(1000, 0x0d, 0x0b, 0x0e);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });

    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-SPACE', () => {
        this.cameras.main.fadeOut(1000, 0x0d, 0x0b, 0x0e);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene');
        });
      });
    }
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta / 1000;

    // Slowly cycle sky colors
    this.renderSky(this.elapsed);

    // Animate motes
    this.particles.clear();
    for (const m of this.motes) {
      m.x += m.vx;
      m.y += m.vy;
      m.phase += 0.02;

      // Wrap around
      if (m.y < -5) { m.y = GAME_HEIGHT + 5; m.x = Math.random() * GAME_WIDTH; }
      if (m.x < -5 || m.x > GAME_WIDTH + 5) { m.x = Math.random() * GAME_WIDTH; }

      const pulse = 0.5 + Math.sin(m.phase) * 0.5;
      this.particles.fillStyle(COLORS.PALE_GREEN, m.alpha * pulse);
      this.particles.fillCircle(m.x, m.y, m.size * 2);
      this.particles.fillStyle(COLORS.SOFT_WHITE, m.alpha * pulse * 0.8);
      this.particles.fillCircle(m.x, m.y, m.size);
    }
  }

  private renderSky(time: number): void {
    this.skyGradient.clear();

    // Blend between dawn and dusk palettes slowly
    const t = (Math.sin(time * 0.1) + 1) / 2; // 0-1 oscillation
    const dawn = TIME_PROFILES.dawn;
    const dusk = TIME_PROFILES.dusk;

    for (let y = 0; y < GAME_HEIGHT; y++) {
      const yNorm = y / GAME_HEIGHT;

      // Interpolate top/bottom colors
      const topR = this.lerp((dawn.skyGradientTop >> 16) & 0xFF, (dusk.skyGradientTop >> 16) & 0xFF, t);
      const topG = this.lerp((dawn.skyGradientTop >> 8) & 0xFF, (dusk.skyGradientTop >> 8) & 0xFF, t);
      const topB = this.lerp(dawn.skyGradientTop & 0xFF, dusk.skyGradientTop & 0xFF, t);

      const botR = this.lerp((dawn.skyGradientBottom >> 16) & 0xFF, (dusk.skyGradientBottom >> 16) & 0xFF, t);
      const botG = this.lerp((dawn.skyGradientBottom >> 8) & 0xFF, (dusk.skyGradientBottom >> 8) & 0xFF, t);
      const botB = this.lerp(dawn.skyGradientBottom & 0xFF, dusk.skyGradientBottom & 0xFF, t);

      const r = Math.floor(this.lerp(topR, botR, yNorm));
      const g = Math.floor(this.lerp(topG, botG, yNorm));
      const b = Math.floor(this.lerp(topB, botB, yNorm));

      this.skyGradient.fillStyle((r << 16) | (g << 8) | b, 1);
      this.skyGradient.fillRect(0, y, GAME_WIDTH, 1);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
