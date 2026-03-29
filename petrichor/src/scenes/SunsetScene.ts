import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { COLORS } from '../config/palette';

interface SunsetData {
  harvestQuality: number; // 0-100
}

/**
 * The Harvest Sunset — the emotional climax of each run.
 * A cinematic sequence where the player watches the sun set over their farm.
 * Duration and beauty scale with harvest quality.
 */
export class SunsetScene extends Phaser.Scene {
  private quality = 50;
  private elapsed = 0;
  private phase: 'golden' | 'sunset' | 'dusk' | 'stars' | 'complete' = 'golden';

  private skyGfx!: Phaser.GameObjects.Graphics;
  private sunGfx!: Phaser.GameObjects.Graphics;
  private landscapeGfx!: Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;

  private sunY = 0;
  private sunTargetY = 0;

  private motes: Array<{ x: number; y: number; vy: number; alpha: number; size: number; phase: number }> = [];
  private leaves: Array<{ x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; alpha: number }> = [];

  constructor() {
    super({ key: 'SunsetScene' });
  }

  init(data: SunsetData): void {
    this.quality = data?.harvestQuality ?? 50;
    this.elapsed = 0;
    this.phase = 'golden';
    this.motes = [];
    this.leaves = [];
  }

  create(): void {
    // Graphics layers
    this.skyGfx = this.add.graphics().setDepth(0);
    this.sunGfx = this.add.graphics().setDepth(10);
    this.landscapeGfx = this.add.graphics().setDepth(20);
    this.particleGfx = this.add.graphics().setDepth(30);
    this.overlayGfx = this.add.graphics().setDepth(40);

    // Initial sun position
    this.sunY = GAME_HEIGHT * 0.35;
    this.sunTargetY = GAME_HEIGHT * 0.7;

    // Create floating motes (more with higher quality)
    const moteCount = 10 + Math.floor(this.quality / 10) * 3;
    for (let i = 0; i < moteCount; i++) {
      this.motes.push({
        x: Math.random() * GAME_WIDTH,
        y: GAME_HEIGHT * 0.5 + Math.random() * GAME_HEIGHT * 0.4,
        vy: -0.1 - Math.random() * 0.3,
        alpha: 0,
        size: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Drifting autumn leaves
    for (let i = 0; i < 15; i++) {
      this.leaves.push({
        x: Math.random() * GAME_WIDTH * 1.5,
        y: Math.random() * GAME_HEIGHT * 0.6,
        vx: 0.2 + Math.random() * 0.4,
        vy: 0.1 + Math.random() * 0.2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }

    // Draw static landscape
    this.drawLandscape();

    // Text elements (fade in over time)
    const seasonText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.15, 'Harvest', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: `#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`,
      letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.tweens.add({
      targets: seasonText,
      alpha: 0.8,
      duration: 3000,
      delay: 2000,
      ease: 'Sine.easeInOut',
    });

    // "Continue" prompt appears later
    const continueText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.9, 'tap to continue', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    // Total duration scales with quality: 15-30 seconds
    const totalDuration = 15000 + (this.quality / 100) * 15000;

    this.tweens.add({
      targets: continueText,
      alpha: { from: 0, to: 0.5 },
      duration: 1500,
      delay: totalDuration * 0.7,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Tap to continue (only after minimum time)
    this.time.delayedCall(totalDuration * 0.5, () => {
      this.input.once('pointerdown', () => this.endSunset());
      if (this.input.keyboard) {
        this.input.keyboard.once('keydown-SPACE', () => this.endSunset());
      }
    });

    // Auto-advance after full duration
    this.time.delayedCall(totalDuration, () => this.endSunset());
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta / 1000;

    // Phase progression
    const totalPhaseDuration = 20 + (this.quality / 100) * 20;
    const phaseT = this.elapsed / totalPhaseDuration;

    if (phaseT < 0.3) this.phase = 'golden';
    else if (phaseT < 0.6) this.phase = 'sunset';
    else if (phaseT < 0.85) this.phase = 'dusk';
    else this.phase = 'stars';

    // Render sky
    this.renderSky(phaseT);

    // Animate sun
    this.sunY += (this.sunTargetY - this.sunY) * 0.003;
    this.renderSun(phaseT);

    // Animate particles
    this.renderParticles(delta / 1000);

    // Vignette overlay
    this.overlayGfx.clear();
    const vignetteAlpha = 0.1 + phaseT * 0.4;
    this.overlayGfx.fillStyle(0x000000, vignetteAlpha);
    // Top and bottom bars for cinematic feel
    const barHeight = 15 + phaseT * 5;
    this.overlayGfx.fillRect(0, 0, GAME_WIDTH, barHeight);
    this.overlayGfx.fillRect(0, GAME_HEIGHT - barHeight, GAME_WIDTH, barHeight);
  }

  private renderSky(t: number): void {
    this.skyGfx.clear();

    // Sky colors transition through golden → orange → purple → deep blue
    interface SkyPhase { top: number; bottom: number }
    const phases: SkyPhase[] = [
      { top: 0x5c7a99, bottom: 0xe6c86e },  // golden
      { top: 0x553772, bottom: 0xe07c24 },  // sunset
      { top: 0x2e1a47, bottom: 0xa4303f },  // dusk
      { top: 0x0d0b0e, bottom: 0x1a1a2e },  // stars
    ];

    const phaseIndex = Math.min(3, Math.floor(t * 4));
    const nextIndex = Math.min(3, phaseIndex + 1);
    const blend = (t * 4) - phaseIndex;

    const current = phases[phaseIndex];
    const next = phases[nextIndex];

    for (let y = 0; y < GAME_HEIGHT; y++) {
      const yT = y / GAME_HEIGHT;

      const cTopR = ((current.top >> 16) & 0xFF);
      const cTopG = ((current.top >> 8) & 0xFF);
      const cTopB = (current.top & 0xFF);
      const cBotR = ((current.bottom >> 16) & 0xFF);
      const cBotG = ((current.bottom >> 8) & 0xFF);
      const cBotB = (current.bottom & 0xFF);

      const nTopR = ((next.top >> 16) & 0xFF);
      const nTopG = ((next.top >> 8) & 0xFF);
      const nTopB = (next.top & 0xFF);
      const nBotR = ((next.bottom >> 16) & 0xFF);
      const nBotG = ((next.bottom >> 8) & 0xFF);
      const nBotB = (next.bottom & 0xFF);

      const topR = cTopR + (nTopR - cTopR) * blend;
      const topG = cTopG + (nTopG - cTopG) * blend;
      const topB = cTopB + (nTopB - cTopB) * blend;
      const botR = cBotR + (nBotR - cBotR) * blend;
      const botG = cBotG + (nBotG - cBotG) * blend;
      const botB = cBotB + (nBotB - cBotB) * blend;

      const r = Math.floor(topR + (botR - topR) * yT);
      const g = Math.floor(topG + (botG - topG) * yT);
      const b = Math.floor(topB + (botB - topB) * yT);

      this.skyGfx.fillStyle((r << 16) | (g << 8) | b, 1);
      this.skyGfx.fillRect(0, y, GAME_WIDTH, 1);
    }

    // Stars (appear during dusk/stars phase)
    if (t > 0.5) {
      const starAlpha = (t - 0.5) * 2;
      for (let i = 0; i < 30; i++) {
        const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * GAME_WIDTH;
        const sy = (Math.sin(i * 269.5 + 183.3) * 0.3 + 0.1) * GAME_HEIGHT;
        const twinkle = Math.sin(this.elapsed * 2 + i * 5) * 0.3 + 0.7;
        const size = (Math.sin(i * 43.3) * 0.3 + 0.7);
        this.skyGfx.fillStyle(COLORS.SOFT_WHITE, starAlpha * twinkle * 0.6);
        this.skyGfx.fillCircle(sx, sy, size);
      }
    }
  }

  private renderSun(t: number): void {
    this.sunGfx.clear();

    const sunX = GAME_WIDTH * 0.6;
    const sunAlpha = Math.max(0, 1 - t * 1.5);

    if (sunAlpha <= 0) return;

    // Sun glow layers
    const glowColors = [
      { color: COLORS.WARM_AMBER, radius: 40, alpha: 0.05 },
      { color: COLORS.SUNSET_ORANGE, radius: 25, alpha: 0.1 },
      { color: COLORS.PALE_GOLD, radius: 15, alpha: 0.2 },
      { color: COLORS.SOFT_WHITE, radius: 6, alpha: 0.8 },
    ];

    for (const glow of glowColors) {
      this.sunGfx.fillStyle(glow.color, glow.alpha * sunAlpha);
      this.sunGfx.fillCircle(sunX, this.sunY, glow.radius);
    }

    // Sun rays (subtle)
    const rayCount = 8;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + this.elapsed * 0.05;
      const rayLength = 30 + Math.sin(this.elapsed + i) * 10;
      const endX = sunX + Math.cos(angle) * rayLength;
      const endY = this.sunY + Math.sin(angle) * rayLength;
      this.sunGfx.lineStyle(1, COLORS.PALE_GOLD, 0.1 * sunAlpha);
      this.sunGfx.lineBetween(sunX, this.sunY, endX, endY);
    }
  }

  private drawLandscape(): void {
    // Silhouette landscape — farm fields, trees, rolling hills
    const hex = (c: number) => c;

    // Distant hills
    this.landscapeGfx.fillStyle(hex(COLORS.DEEP_FOREST), 0.5);
    this.landscapeGfx.beginPath();
    this.landscapeGfx.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 4) {
      const h = GAME_HEIGHT * 0.55 + Math.sin(x * 0.02) * 15 + Math.sin(x * 0.05) * 8;
      this.landscapeGfx.lineTo(x, h);
    }
    this.landscapeGfx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    this.landscapeGfx.closePath();
    this.landscapeGfx.fillPath();

    // Treeline
    this.landscapeGfx.fillStyle(hex(COLORS.DEEP_FOREST), 0.8);
    this.landscapeGfx.beginPath();
    this.landscapeGfx.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 2) {
      const baseH = GAME_HEIGHT * 0.65;
      const treeNoise = Math.sin(x * 0.1) * 5 + Math.sin(x * 0.23) * 3;
      // Individual tree peaks
      const peak = (x % 12 < 6) ? -4 - Math.random() * 4 : 0;
      this.landscapeGfx.lineTo(x, baseH + treeNoise + peak);
    }
    this.landscapeGfx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    this.landscapeGfx.closePath();
    this.landscapeGfx.fillPath();

    // Farm fields in foreground
    this.landscapeGfx.fillStyle(hex(COLORS.FOREST_GREEN), 0.9);
    this.landscapeGfx.fillRect(0, GAME_HEIGHT * 0.75, GAME_WIDTH, GAME_HEIGHT * 0.25);

    // Crop rows
    this.landscapeGfx.fillStyle(hex(COLORS.GOLDEN_WHEAT), 0.7);
    for (let row = 0; row < 3; row++) {
      const rowY = GAME_HEIGHT * 0.78 + row * 8;
      for (let x = 20 + row * 10; x < GAME_WIDTH - 20; x += 6) {
        const h = 3 + Math.sin(x * 0.5 + row) * 2;
        this.landscapeGfx.fillRect(x, rowY - h, 3, h);
      }
    }

    // Player silhouette (sitting)
    this.landscapeGfx.fillStyle(hex(COLORS.DARK_SLATE), 1);
    const playerX = GAME_WIDTH * 0.35;
    const playerY = GAME_HEIGHT * 0.73;
    // Body
    this.landscapeGfx.fillRect(playerX, playerY, 6, 4);
    // Head
    this.landscapeGfx.fillRect(playerX + 1, playerY - 3, 4, 3);
  }

  private renderParticles(dt: number): void {
    this.particleGfx.clear();

    // Motes
    for (const m of this.motes) {
      m.y += m.vy * dt * 30;
      m.phase += dt * 2;
      m.alpha = Math.min(1, m.alpha + dt * 0.3);

      if (m.y < -10) {
        m.y = GAME_HEIGHT * 0.8 + Math.random() * GAME_HEIGHT * 0.2;
        m.x = Math.random() * GAME_WIDTH;
      }

      const pulse = 0.5 + Math.sin(m.phase) * 0.5;
      this.particleGfx.fillStyle(COLORS.PALE_GREEN, m.alpha * pulse * 0.3);
      this.particleGfx.fillCircle(m.x, m.y, m.size * 3);
      this.particleGfx.fillStyle(COLORS.SOFT_WHITE, m.alpha * pulse * 0.7);
      this.particleGfx.fillCircle(m.x, m.y, m.size);
    }

    // Drifting leaves
    for (const l of this.leaves) {
      l.x += l.vx * dt * 30;
      l.y += l.vy * dt * 30;
      l.rot += l.rotSpeed;

      if (l.x > GAME_WIDTH + 10) {
        l.x = -10;
        l.y = Math.random() * GAME_HEIGHT * 0.7;
      }

      const leafColors = [COLORS.SUNSET_ORANGE, COLORS.WARM_AMBER, COLORS.GOLDEN_WHEAT, COLORS.ROSE_RED];
      const color = leafColors[Math.floor(Math.abs(Math.sin(l.rot * 10)) * leafColors.length) % leafColors.length];

      this.particleGfx.fillStyle(color, l.alpha);
      // Simple leaf shape (2×3 pixels rotated)
      const cos = Math.cos(l.rot);
      const sin = Math.sin(l.rot);
      this.particleGfx.fillRect(l.x + cos, l.y + sin, 2, 1);
      this.particleGfx.fillRect(l.x - sin * 0.5, l.y + cos * 0.5, 1, 2);
    }
  }

  private endSunset(): void {
    this.cameras.main.fadeOut(2000, 0x0d, 0x0b, 0x0e);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // TODO: Transition to RunTransitionScene for meta-progression
      // For now, loop back to title
      this.scene.start('TitleScene');
    });
  }
}
