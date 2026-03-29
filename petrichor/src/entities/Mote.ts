import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';

/**
 * A Mote — small luminous spirit creature.
 * Floats gently, pulses with soft light, clusters near healthy land.
 * Purely procedural rendering: glow shader + simple wobble.
 */
export class Mote {
  readonly sprite: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private homeX: number;
  private homeY: number;
  private wanderRadius: number;
  private phase: number; // unique phase offset for animation
  private size: number;
  private glowSize: number;
  private alpha: number;
  private visible = true;
  private fadeTarget = 1;

  // Behavior
  private wanderAngle: number;
  private wanderSpeed: number;
  private bobSpeed: number;
  private bobAmplitude: number;
  private pulseSpeed: number;
  private winterMode = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;

    this.phase = Math.random() * Math.PI * 2;
    this.size = 1.5 + Math.random() * 1;
    this.glowSize = this.size * 4 + Math.random() * 3;
    this.alpha = 0.6 + Math.random() * 0.4;
    this.wanderRadius = 20 + Math.random() * 30;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderSpeed = 0.3 + Math.random() * 0.5;
    this.bobSpeed = 1.5 + Math.random() * 1;
    this.bobAmplitude = 2 + Math.random() * 2;
    this.pulseSpeed = 2 + Math.random() * 2;

    this.sprite = scene.add.graphics();
    this.sprite.setDepth(DEPTH.MOTES);
  }

  show(): void { this.fadeTarget = 1; this.visible = true; }
  hide(): void { this.fadeTarget = 0; }

  /** Winter: dimmer, slower, cooler glow — still present but subdued */
  setWinterMode(on: boolean): void {
    this.winterMode = on;
    if (on) {
      this.wanderSpeed *= 0.4;
      this.bobSpeed *= 0.5;
      this.pulseSpeed *= 0.6;
    }
  }

  setHome(x: number, y: number): void {
    this.homeX = x;
    this.homeY = y;
  }

  update(time: number, _delta: number): void {
    const t = time / 1000;

    // Fade in/out
    const fadeSpeed = 0.02;
    this.alpha += (this.fadeTarget * (0.6 + Math.random() * 0.4) - this.alpha) * fadeSpeed;
    if (this.alpha < 0.01 && this.fadeTarget === 0) {
      this.visible = false;
    }
    if (!this.visible) return;

    // Wander around home position
    this.wanderAngle += (Math.random() - 0.5) * 0.1;
    const targetX = this.homeX + Math.cos(this.wanderAngle) * this.wanderRadius * 0.5;
    const targetY = this.homeY + Math.sin(this.wanderAngle) * this.wanderRadius * 0.5;
    this.x += (targetX - this.x) * this.wanderSpeed * 0.02;
    this.y += (targetY - this.y) * this.wanderSpeed * 0.02;

    // Vertical bob
    const bobOffset = Math.sin(t * this.bobSpeed + this.phase) * this.bobAmplitude;

    // Pulse glow
    const pulse = 0.7 + Math.sin(t * this.pulseSpeed + this.phase) * 0.3;

    // Render
    this.sprite.clear();

    const drawX = this.x;
    const drawY = this.y + bobOffset;

    // Winter: cooler, dimmer glow
    const glowColor = this.winterMode ? COLORS.PALE_CLOUD : COLORS.PALE_GREEN;
    const dimmer = this.winterMode ? 0.5 : 1;

    // Outer glow (soft, large)
    this.sprite.fillStyle(glowColor, this.alpha * 0.1 * pulse * dimmer);
    this.sprite.fillCircle(drawX, drawY, this.glowSize);

    // Mid glow
    this.sprite.fillStyle(glowColor, this.alpha * 0.25 * pulse * dimmer);
    this.sprite.fillCircle(drawX, drawY, this.glowSize * 0.5);

    // Core
    this.sprite.fillStyle(COLORS.SOFT_WHITE, this.alpha * 0.9 * pulse * dimmer);
    this.sprite.fillCircle(drawX, drawY, this.size);

    // Tiny sparkle
    if (Math.sin(t * 7 + this.phase) > 0.9) {
      this.sprite.fillStyle(COLORS.SOFT_WHITE, this.alpha * 0.6);
      this.sprite.fillCircle(
        drawX + Math.cos(t * 3) * 3,
        drawY + Math.sin(t * 3) * 3,
        0.5
      );
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
