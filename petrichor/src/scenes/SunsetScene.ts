import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { COLORS } from '../config/palette';

interface SunsetData {
  harvestQuality: number; // 0-100
  landHealth?: number;
  discoveryCount?: number;
  totalHarvested?: number;
}

/**
 * The Harvest Sunset — the emotional climax of each run.
 *
 * Camera slowly pulls back to reveal the full farm in silhouette.
 * Sky cycles through hand-crafted color phases.
 * Motes gather. If quality is high, the Thornback appears on the ridge.
 * The only fully composed music in the game plays here.
 * Duration and visual richness scale with harvest quality.
 */
export class SunsetScene extends Phaser.Scene {
  private quality = 50;
  private landHealth = 0.5;
  private elapsed = 0;

  private skyGfx!: Phaser.GameObjects.Graphics;
  private sunGfx!: Phaser.GameObjects.Graphics;
  private landscapeGfx!: Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private thornbackGfx!: Phaser.GameObjects.Graphics;

  private sunY = 0;
  private sunTargetY = 0;
  private totalDuration = 0;

  private motes: Array<{ x: number; y: number; vy: number; vx: number; alpha: number; size: number; phase: number }> = [];
  private leaves: Array<{ x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; alpha: number; color: number }> = [];
  private fireflies: Array<{ x: number; y: number; phase: number; radius: number; speed: number }> = [];

  // Thornback appearance
  private showThornback = false;
  private thornbackAlpha = 0;

  // Music
  private musicPlaying = false;

  // Ended flag to prevent double-transition
  private ended = false;

  constructor() {
    super({ key: 'SunsetScene' });
  }

  init(data: SunsetData): void {
    this.quality = data?.harvestQuality ?? 50;
    this.landHealth = data?.landHealth ?? 0.5;
    this.elapsed = 0;
    this.motes = [];
    this.leaves = [];
    this.fireflies = [];
    this.showThornback = this.quality > 65 && this.landHealth > 0.6;
    this.thornbackAlpha = 0;
    this.musicPlaying = false;
    this.ended = false;
  }

  create(): void {
    // Layers
    this.skyGfx = this.add.graphics().setDepth(0);
    this.sunGfx = this.add.graphics().setDepth(10);
    this.landscapeGfx = this.add.graphics().setDepth(20);
    this.thornbackGfx = this.add.graphics().setDepth(25);
    this.particleGfx = this.add.graphics().setDepth(30);
    this.overlayGfx = this.add.graphics().setDepth(40);

    this.sunY = GAME_HEIGHT * 0.32;
    this.sunTargetY = GAME_HEIGHT * 0.72;
    this.totalDuration = 18000 + (this.quality / 100) * 22000; // 18-40 seconds

    // Motes (scale with quality)
    const moteCount = 8 + Math.floor(this.quality / 8) * 3;
    for (let i = 0; i < moteCount; i++) {
      this.motes.push({
        x: Math.random() * GAME_WIDTH,
        y: GAME_HEIGHT * 0.5 + Math.random() * GAME_HEIGHT * 0.4,
        vy: -0.05 - Math.random() * 0.25,
        vx: (Math.random() - 0.5) * 0.15,
        alpha: 0,
        size: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Leaves
    const leafColors = [COLORS.SUNSET_ORANGE, COLORS.WARM_AMBER, COLORS.GOLDEN_WHEAT, COLORS.ROSE_RED];
    for (let i = 0; i < 20; i++) {
      this.leaves.push({
        x: -20 + Math.random() * GAME_WIDTH * 1.5,
        y: Math.random() * GAME_HEIGHT * 0.65,
        vx: 0.15 + Math.random() * 0.35,
        vy: 0.05 + Math.random() * 0.15,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        alpha: 0.2 + Math.random() * 0.5,
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
      });
    }

    // Fireflies (dusk phase — quality > 50)
    if (this.quality > 50) {
      const ffCount = Math.floor((this.quality - 50) / 8);
      for (let i = 0; i < ffCount; i++) {
        this.fireflies.push({
          x: 30 + Math.random() * (GAME_WIDTH - 60),
          y: GAME_HEIGHT * 0.6 + Math.random() * GAME_HEIGHT * 0.25,
          phase: Math.random() * Math.PI * 2,
          radius: 8 + Math.random() * 12,
          speed: 0.5 + Math.random() * 0.8,
        });
      }
    }

    // Static landscape
    this.drawLandscape();

    // "Harvest" title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.12, 'Harvest', {
      fontFamily: 'monospace', fontSize: '11px',
      color: `#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`,
      letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.tweens.add({ targets: title, alpha: 0.8, duration: 4000, delay: 1500, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: title, alpha: 0, duration: 3000, delay: 10000, ease: 'Sine.easeInOut' });

    // Quality-based subtitle
    let subtitle = 'The land rests.';
    if (this.quality > 80) subtitle = 'A year well tended. The land remembers.';
    else if (this.quality > 60) subtitle = 'The harvest was good. The motes are pleased.';
    else if (this.quality > 40) subtitle = 'A quiet season. There is always next year.';
    else subtitle = 'The land endures.';

    const subText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.12 + 14, subtitle, {
      fontFamily: 'monospace', fontSize: '5px',
      color: `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`,
      letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.tweens.add({ targets: subText, alpha: 0.6, duration: 3000, delay: 4000, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: subText, alpha: 0, duration: 3000, delay: 12000, ease: 'Sine.easeInOut' });

    // Continue prompt
    const continueText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.92, 'tap to continue', {
      fontFamily: 'monospace', fontSize: '6px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`, letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.tweens.add({
      targets: continueText, alpha: { from: 0, to: 0.4 },
      duration: 1500, delay: this.totalDuration * 0.6,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // Input — only after half duration
    this.time.delayedCall(this.totalDuration * 0.4, () => {
      const doEnd = () => { if (!this.ended) this.endSunset(); };
      this.input.once('pointerdown', doEnd);
      if (this.input.keyboard) this.input.keyboard.once('keydown-SPACE', doEnd);
    });
    this.time.delayedCall(this.totalDuration + 2000, () => { if (!this.ended) this.endSunset(); });

    // Start music
    this.generateAndPlaySunsetMusic();
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta / 1000;
    const phaseT = Math.min(1, this.elapsed / (this.totalDuration / 1000));

    this.renderSky(phaseT);
    this.sunY += (this.sunTargetY - this.sunY) * 0.002;
    this.renderSun(phaseT);
    this.renderParticles(delta / 1000, phaseT);

    // Thornback (appears during dusk phase for high-quality harvests)
    if (this.showThornback && phaseT > 0.45 && phaseT < 0.85) {
      this.thornbackAlpha = Math.min(0.7, this.thornbackAlpha + 0.003);
    } else {
      this.thornbackAlpha = Math.max(0, this.thornbackAlpha - 0.005);
    }
    this.renderThornback();

    // Cinematic bars
    this.overlayGfx.clear();
    const barHeight = 14 + phaseT * 6;
    this.overlayGfx.fillStyle(0x000000, 0.15 + phaseT * 0.35);
    this.overlayGfx.fillRect(0, 0, GAME_WIDTH, barHeight);
    this.overlayGfx.fillRect(0, GAME_HEIGHT - barHeight, GAME_WIDTH, barHeight);
  }

  private renderSky(t: number): void {
    this.skyGfx.clear();
    const phases = [
      { top: 0x5c7a99, bottom: 0xe6c86e },
      { top: 0x553772, bottom: 0xe07c24 },
      { top: 0x2e1a47, bottom: 0xa4303f },
      { top: 0x0d0b0e, bottom: 0x1a1a2e },
    ];

    const pi = Math.min(3, Math.floor(t * 4));
    const ni = Math.min(3, pi + 1);
    const blend = Math.min(1, (t * 4) - pi);
    const cur = phases[pi], nxt = phases[ni];

    for (let y = 0; y < GAME_HEIGHT; y += 2) {
      const yT = y / GAME_HEIGHT;
      const r = Math.floor(this.mix((cur.top >> 16) & 0xFF, (nxt.top >> 16) & 0xFF, blend) * (1 - yT) +
        this.mix((cur.bottom >> 16) & 0xFF, (nxt.bottom >> 16) & 0xFF, blend) * yT);
      const g = Math.floor(this.mix((cur.top >> 8) & 0xFF, (nxt.top >> 8) & 0xFF, blend) * (1 - yT) +
        this.mix((cur.bottom >> 8) & 0xFF, (nxt.bottom >> 8) & 0xFF, blend) * yT);
      const b = Math.floor(this.mix(cur.top & 0xFF, nxt.top & 0xFF, blend) * (1 - yT) +
        this.mix(cur.bottom & 0xFF, nxt.bottom & 0xFF, blend) * yT);
      this.skyGfx.fillStyle((r << 16) | (g << 8) | b, 1);
      this.skyGfx.fillRect(0, y, GAME_WIDTH, 2);
    }

    // Stars
    if (t > 0.5) {
      const sa = Math.min(1, (t - 0.5) * 2.5);
      for (let i = 0; i < 40; i++) {
        const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * GAME_WIDTH;
        const sy = (Math.sin(i * 269.5 + 183.3) * 0.3 + 0.05) * GAME_HEIGHT;
        const tw = Math.sin(this.elapsed * 1.8 + i * 5) * 0.3 + 0.7;
        this.skyGfx.fillStyle(COLORS.SOFT_WHITE, sa * tw * 0.5);
        this.skyGfx.fillCircle(sx, sy, 0.5 + (i % 3) * 0.3);
      }
    }

    // Clouds (golden hour — subtle)
    if (t < 0.5) {
      const cloudAlpha = 0.06 * (1 - t * 2);
      this.skyGfx.fillStyle(COLORS.PALE_GOLD, cloudAlpha);
      for (let i = 0; i < 4; i++) {
        const cx = 40 + i * 75 + Math.sin(this.elapsed * 0.05 + i) * 5;
        const cy = GAME_HEIGHT * 0.2 + i * 8;
        this.skyGfx.fillRoundedRect(cx, cy, 40 + i * 10, 6, 3);
      }
    }
  }

  private renderSun(t: number): void {
    this.sunGfx.clear();
    const sunX = GAME_WIDTH * 0.6;
    const alpha = Math.max(0, 1 - t * 1.4);
    if (alpha <= 0) return;

    // Large ambient glow
    this.sunGfx.fillStyle(COLORS.WARM_AMBER, alpha * 0.03);
    this.sunGfx.fillCircle(sunX, this.sunY, 60);
    this.sunGfx.fillStyle(COLORS.SUNSET_ORANGE, alpha * 0.06);
    this.sunGfx.fillCircle(sunX, this.sunY, 35);
    this.sunGfx.fillStyle(COLORS.PALE_GOLD, alpha * 0.15);
    this.sunGfx.fillCircle(sunX, this.sunY, 18);
    this.sunGfx.fillStyle(COLORS.SOFT_WHITE, alpha * 0.8);
    this.sunGfx.fillCircle(sunX, this.sunY, 6);

    // Rays
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + this.elapsed * 0.03;
      const len = 25 + Math.sin(this.elapsed * 0.7 + i * 1.3) * 12;
      this.sunGfx.lineStyle(0.5, COLORS.PALE_GOLD, 0.06 * alpha);
      this.sunGfx.lineBetween(
        sunX + Math.cos(angle) * 8, this.sunY + Math.sin(angle) * 8,
        sunX + Math.cos(angle) * len, this.sunY + Math.sin(angle) * len
      );
    }

    // Horizon glow (light band at landscape line)
    if (t < 0.7) {
      this.sunGfx.fillStyle(COLORS.WARM_AMBER, alpha * 0.04);
      this.sunGfx.fillRect(0, GAME_HEIGHT * 0.52, GAME_WIDTH, 8);
    }
  }

  private drawLandscape(): void {
    // Distant hills
    this.landscapeGfx.fillStyle(COLORS.DEEP_FOREST, 0.5);
    this.landscapeGfx.beginPath();
    this.landscapeGfx.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 3) {
      const h = GAME_HEIGHT * 0.54 + Math.sin(x * 0.018) * 16 + Math.sin(x * 0.047) * 9;
      this.landscapeGfx.lineTo(x, h);
    }
    this.landscapeGfx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    this.landscapeGfx.closePath();
    this.landscapeGfx.fillPath();

    // Mid-ground treeline
    this.landscapeGfx.fillStyle(COLORS.DEEP_FOREST, 0.8);
    this.landscapeGfx.beginPath();
    this.landscapeGfx.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 2) {
      const base = GAME_HEIGHT * 0.63;
      const noise = Math.sin(x * 0.09) * 5 + Math.sin(x * 0.21) * 3;
      const peak = (x % 10 < 5) ? -3 - (Math.sin(x * 0.37) * 3) : 0;
      this.landscapeGfx.lineTo(x, base + noise + peak);
    }
    this.landscapeGfx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    this.landscapeGfx.closePath();
    this.landscapeGfx.fillPath();

    // Farm field
    this.landscapeGfx.fillStyle(COLORS.FOREST_GREEN, 0.9);
    this.landscapeGfx.fillRect(0, GAME_HEIGHT * 0.74, GAME_WIDTH, GAME_HEIGHT * 0.26);

    // Crop rows (scale density with quality)
    const rows = 2 + Math.floor(this.quality / 30);
    for (let row = 0; row < rows; row++) {
      const rowY = GAME_HEIGHT * 0.77 + row * 7;
      const color = row % 2 === 0 ? COLORS.GOLDEN_WHEAT : COLORS.PALE_GOLD;
      this.landscapeGfx.fillStyle(color, 0.65);
      const startX = 15 + row * 8;
      for (let x = startX; x < GAME_WIDTH - 15; x += 5) {
        const h = 3 + Math.sin(x * 0.4 + row * 1.5) * 2;
        this.landscapeGfx.fillRect(x, rowY - h, 2, h);
      }
    }

    // Fence posts
    this.landscapeGfx.fillStyle(COLORS.EARTH, 0.6);
    for (let x = 10; x < GAME_WIDTH; x += 30) {
      this.landscapeGfx.fillRect(x, GAME_HEIGHT * 0.74 - 5, 2, 7);
    }
    this.landscapeGfx.lineStyle(0.5, COLORS.EARTH, 0.3);
    this.landscapeGfx.lineBetween(10, GAME_HEIGHT * 0.74 - 3, GAME_WIDTH - 10, GAME_HEIGHT * 0.74 - 3);

    // Player sitting silhouette
    this.landscapeGfx.fillStyle(COLORS.DARK_SLATE, 1);
    const px = GAME_WIDTH * 0.35, py = GAME_HEIGHT * 0.72;
    this.landscapeGfx.fillRect(px, py, 6, 4); // body
    this.landscapeGfx.fillRect(px + 1, py - 3, 4, 3); // head
    this.landscapeGfx.fillRect(px + 4, py - 1, 3, 2); // arm resting on knee
    // Legs tucked
    this.landscapeGfx.fillRect(px - 1, py + 3, 8, 2);
  }

  private renderThornback(): void {
    this.thornbackGfx.clear();
    if (this.thornbackAlpha < 0.01) return;

    const x = GAME_WIDTH * 0.82;
    const y = GAME_HEIGHT * 0.58;
    const a = this.thornbackAlpha;
    const sway = Math.sin(this.elapsed * 0.25) * 0.8;

    // Dark silhouette on the ridge
    this.thornbackGfx.fillStyle(COLORS.DEEP_FOREST, a * 0.9);
    // Legs
    this.thornbackGfx.fillRect(x - 2 + sway * 0.3, y + 4, 2, 12);
    this.thornbackGfx.fillRect(x + 3 + sway * 0.3, y + 4, 2, 12);
    // Body
    this.thornbackGfx.fillRect(x - 3 + sway * 0.5, y - 5, 8, 11);
    // Neck + head
    this.thornbackGfx.fillRect(x - 1 + sway * 0.7, y - 12, 4, 8);
    this.thornbackGfx.fillRect(x - 2 + sway, y - 16, 6, 5);

    // Antlers
    this.thornbackGfx.fillStyle(COLORS.DEEP_FOREST, a);
    this.thornbackGfx.fillRect(x - 3 + sway, y - 18, 1, 5);
    this.thornbackGfx.fillRect(x - 7 + sway, y - 22, 1, 7);
    this.thornbackGfx.fillRect(x - 7 + sway, y - 22, 5, 1);
    this.thornbackGfx.fillRect(x + 4 + sway, y - 18, 1, 5);
    this.thornbackGfx.fillRect(x + 8 + sway, y - 22, 1, 7);
    this.thornbackGfx.fillRect(x + 4 + sway, y - 22, 5, 1);

    // Eyes
    const eyeGlow = 0.3 + Math.sin(this.elapsed * 0.4) * 0.15;
    this.thornbackGfx.fillStyle(0x52b788, a * eyeGlow);
    this.thornbackGfx.fillCircle(x + sway, y - 14, 1);
    this.thornbackGfx.fillCircle(x + 3 + sway, y - 14, 1);
    this.thornbackGfx.fillStyle(0x52b788, a * eyeGlow * 0.15);
    this.thornbackGfx.fillCircle(x + 1.5 + sway, y - 14, 5);
  }

  private renderParticles(dt: number, phaseT: number): void {
    this.particleGfx.clear();

    // Motes (gather during sunset, rise during dusk)
    for (const m of this.motes) {
      m.y += m.vy * dt * 25;
      m.x += m.vx * dt * 25 + Math.sin(this.elapsed + m.phase) * 0.1;
      m.phase += dt * 1.8;
      m.alpha = Math.min(0.9, m.alpha + dt * 0.15);

      if (m.y < -10) {
        m.y = GAME_HEIGHT * 0.75 + Math.random() * GAME_HEIGHT * 0.2;
        m.x = Math.random() * GAME_WIDTH;
      }

      const pulse = 0.5 + Math.sin(m.phase) * 0.5;
      this.particleGfx.fillStyle(COLORS.PALE_GREEN, m.alpha * pulse * 0.2);
      this.particleGfx.fillCircle(m.x, m.y, m.size * 3);
      this.particleGfx.fillStyle(COLORS.SOFT_WHITE, m.alpha * pulse * 0.6);
      this.particleGfx.fillCircle(m.x, m.y, m.size);
    }

    // Leaves
    for (const l of this.leaves) {
      l.x += l.vx * dt * 25;
      l.y += l.vy * dt * 25;
      l.rot += l.rotSpeed;
      if (l.x > GAME_WIDTH + 15) { l.x = -15; l.y = Math.random() * GAME_HEIGHT * 0.65; }

      this.particleGfx.fillStyle(l.color, l.alpha * (1 - phaseT * 0.5));
      const c = Math.cos(l.rot), s = Math.sin(l.rot);
      this.particleGfx.fillRect(l.x + c, l.y + s, 2, 1);
      this.particleGfx.fillRect(l.x - s * 0.5, l.y + c * 0.5, 1, 2);
    }

    // Fireflies (appear during dusk phase)
    if (phaseT > 0.5) {
      const ffAlpha = Math.min(1, (phaseT - 0.5) * 3);
      for (const ff of this.fireflies) {
        const angle = this.elapsed * ff.speed + ff.phase;
        const fx = ff.x + Math.cos(angle) * ff.radius;
        const fy = ff.y + Math.sin(angle * 0.7) * ff.radius * 0.5;
        const blink = Math.sin(this.elapsed * 3 + ff.phase * 5) > 0.3 ? 1 : 0.1;
        this.particleGfx.fillStyle(COLORS.PALE_GOLD, ffAlpha * blink * 0.4);
        this.particleGfx.fillCircle(fx, fy, 3);
        this.particleGfx.fillStyle(COLORS.SOFT_WHITE, ffAlpha * blink * 0.7);
        this.particleGfx.fillCircle(fx, fy, 1);
      }
    }
  }

  /**
   * Generate and play a simple procedural piano melody for the sunset.
   * Uses Web Audio API oscillators to create a gentle, contemplative piece.
   */
  private generateAndPlaySunsetMusic(): void {
    try {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (!ctx) return;

      // Pentatonic scale notes (Hz) — C major pentatonic, warm and safe
      const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];

      // Melody pattern — simple, descending, contemplative
      const melody = [7, 5, 4, 3, 5, 4, 2, 0, 4, 3, 2, 0, 3, 2, 0, -1];
      const noteDuration = this.totalDuration / (melody.length * 1000) * 0.8;

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 3);
      masterGain.gain.setValueAtTime(0.08, ctx.currentTime + this.totalDuration / 1000 - 5);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + this.totalDuration / 1000);
      masterGain.connect(ctx.destination);

      // Reverb-like delay
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.4;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.3;
      delay.connect(delayGain);
      delayGain.connect(masterGain);
      delayGain.connect(delay); // feedback loop

      // Play melody notes
      let time = ctx.currentTime + 2; // 2 second intro silence
      for (const noteIdx of melody) {
        if (noteIdx < 0) {
          time += noteDuration;
          continue; // rest
        }

        const freq = scale[noteIdx % scale.length];

        // Main tone (sine — pure piano-like)
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        // Second harmonic (softer, adds warmth)
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(0.6, time + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration * 0.9);

        const harmGain = ctx.createGain();
        harmGain.gain.setValueAtTime(0, time);
        harmGain.gain.linearRampToValueAtTime(0.15, time + 0.05);
        harmGain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration * 0.7);

        osc.connect(noteGain);
        osc2.connect(harmGain);
        noteGain.connect(masterGain);
        noteGain.connect(delay);
        harmGain.connect(masterGain);

        osc.start(time);
        osc.stop(time + noteDuration);
        osc2.start(time);
        osc2.stop(time + noteDuration);

        time += noteDuration;
      }

      // Ambient pad (low drone, very soft)
      const pad = ctx.createOscillator();
      pad.type = 'sine';
      pad.frequency.value = 130.8; // C3
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0, ctx.currentTime);
      padGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 4);
      padGain.gain.setValueAtTime(0.03, ctx.currentTime + this.totalDuration / 1000 - 4);
      padGain.gain.linearRampToValueAtTime(0, ctx.currentTime + this.totalDuration / 1000);
      pad.connect(padGain);
      padGain.connect(masterGain);
      pad.start(ctx.currentTime);
      pad.stop(ctx.currentTime + this.totalDuration / 1000);

      this.musicPlaying = true;
    } catch {
      // Audio not available — silent sunset is still beautiful
    }
  }

  private endSunset(): void {
    if (this.ended) return;
    this.ended = true;

    this.cameras.main.fadeOut(2500, 0x0d, 0x0b, 0x0e);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('RunTransitionScene', {
        harvestQuality: this.quality,
        landHealth: this.landHealth,
      });
    });
  }

  private mix(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
