import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';
import { ProgressionSystem } from '../systems/ProgressionSystem';

interface TransitionData {
  harvestQuality: number;
  landHealth: number;
  discoveryCount?: number;
  totalHarvested?: number;
  newSeeds?: string[];
  newBlessings?: string[];
  newLore?: string[];
  maMoments?: number;
  elderSeen?: boolean;
}

/**
 * RunTransitionScene — The between-run progression screen.
 *
 * Shows:
 * - Run summary (quality, land health, harvests)
 * - New unlocks (seeds, tools, journal entries)
 * - Animated reveal of each unlock
 * - "Begin next year" prompt
 *
 * Visual style: parchment/journal aesthetic with
 * ink-like text appearing line by line.
 */
export class RunTransitionScene extends Phaser.Scene {
  private progression!: ProgressionSystem;
  private unlocks: string[] = [];
  private quality = 50;
  private landHealth = 0.5;

  private bgGfx!: Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;

  private textElements: Phaser.GameObjects.Text[] = [];
  private motes: Array<{ x: number; y: number; phase: number; alpha: number }> = [];

  private ready = false;

  constructor() {
    super({ key: 'RunTransitionScene' });
  }

  init(data: TransitionData): void {
    this.quality = data?.harvestQuality ?? 50;
    this.landHealth = data?.landHealth ?? 0.5;
    this.textElements = [];
    this.motes = [];
    this.ready = false;

    // Process progression
    this.progression = new ProgressionSystem();
    const result = this.progression.completeRun({
      harvestQuality: this.quality,
      landHealth: this.landHealth,
      discoveryCount: data?.discoveryCount ?? 0,
      totalHarvested: data?.totalHarvested ?? 0,
      seasonsCompleted: 4,
      newSeeds: data?.newSeeds ?? [],
      newBlessings: data?.newBlessings ?? [],
      newLore: data?.newLore ?? [],
      maMoments: data?.maMoments ?? 0,
      elderSeen: data?.elderSeen ?? false,
    });

    this.unlocks = result.unlocks;
  }

  create(): void {
    this.bgGfx = this.add.graphics().setDepth(0);
    this.particleGfx = this.add.graphics().setDepth(DEPTH.MOTES);

    // Draw parchment background
    this.drawBackground();

    // Floating motes in background
    for (let i = 0; i < 6; i++) {
      this.motes.push({
        x: 30 + Math.random() * (GAME_WIDTH - 60),
        y: 20 + Math.random() * (GAME_HEIGHT - 40),
        phase: Math.random() * Math.PI * 2,
        alpha: 0,
      });
    }

    // Animate text entries appearing
    this.revealContent();
  }

  private drawBackground(): void {
    // Deep background
    this.bgGfx.fillStyle(COLORS.VOID, 1);
    this.bgGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Parchment panel
    const panelX = 30;
    const panelY = 16;
    const panelW = GAME_WIDTH - 60;
    const panelH = GAME_HEIGHT - 32;

    // Panel shadow
    this.bgGfx.fillStyle(0x000000, 0.3);
    this.bgGfx.fillRoundedRect(panelX + 2, panelY + 2, panelW, panelH, 4);

    // Panel body
    this.bgGfx.fillStyle(COLORS.MIDNIGHT, 0.95);
    this.bgGfx.fillRoundedRect(panelX, panelY, panelW, panelH, 4);

    // Border
    this.bgGfx.lineStyle(1, COLORS.MUTED_SKY, 0.2);
    this.bgGfx.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);

    // Inner decorative line
    this.bgGfx.lineStyle(0.5, COLORS.MUTED_SKY, 0.08);
    this.bgGfx.strokeRoundedRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 2);

    // Quality-based accent line at top
    let accentColor: number = COLORS.STEEL_BLUE;
    if (this.quality > 80) accentColor = COLORS.PALE_GOLD;
    else if (this.quality > 60) accentColor = COLORS.FRESH_GREEN;
    else if (this.quality > 40) accentColor = COLORS.MUTED_SKY;

    this.bgGfx.fillStyle(accentColor, 0.3);
    this.bgGfx.fillRect(panelX + 8, panelY + 8, panelW - 16, 1);
  }

  private revealContent(): void {
    const cx = GAME_WIDTH / 2;
    let y = 30;
    let delay = 500;
    const lineDelay = 400;

    const parchmentHex = `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`;
    const greyHex = `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`;
    const goldHex = `#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`;
    const greenHex = `#${COLORS.FRESH_GREEN.toString(16).padStart(6, '0')}`;

    // Title — "Year [N] Complete"
    this.addRevealText(cx, y, `Year ${this.progression.totalRuns} Complete`, {
      fontFamily: 'monospace', fontSize: '9px', color: parchmentHex,
      letterSpacing: 3,
    }, delay);
    y += 16;
    delay += lineDelay;

    // Divider
    this.addRevealLine(y, delay);
    y += 8;
    delay += lineDelay * 0.5;

    // Stats
    this.addRevealText(cx, y, `Harvest Quality: ${this.quality}`, {
      fontFamily: 'monospace', fontSize: '6px', color: goldHex,
    }, delay);
    y += 10;
    delay += lineDelay * 0.7;

    this.addRevealText(cx, y, `Land Health: ${Math.round(this.landHealth * 100)}%`, {
      fontFamily: 'monospace', fontSize: '6px', color: greenHex,
    }, delay);
    y += 10;
    delay += lineDelay * 0.7;

    if (this.progression.bestQuality === this.quality && this.progression.totalRuns > 1) {
      this.addRevealText(cx, y, '~ Personal Best ~', {
        fontFamily: 'monospace', fontSize: '5px', color: goldHex,
      }, delay);
      y += 10;
      delay += lineDelay;
    }

    // Divider
    y += 2;
    this.addRevealLine(y, delay);
    y += 8;
    delay += lineDelay * 0.5;

    // Unlocks
    if (this.unlocks.length > 0) {
      this.addRevealText(cx, y, 'Discoveries', {
        fontFamily: 'monospace', fontSize: '7px', color: parchmentHex,
        letterSpacing: 2,
      }, delay);
      y += 12;
      delay += lineDelay;

      for (const unlock of this.unlocks) {
        if (y > GAME_HEIGHT - 40) break; // don't overflow

        // Icon based on type
        let icon = '·';
        if (unlock.startsWith('New seed')) icon = '❋';
        else if (unlock.startsWith('Blessing')) icon = '✦';
        else if (unlock.startsWith('Journal')) icon = '◆';
        else if (unlock.includes('upgraded')) icon = '▲';
        else if (unlock.includes('best')) icon = '★';

        this.addRevealText(cx, y, `${icon} ${unlock}`, {
          fontFamily: 'monospace', fontSize: '5px', color: greyHex,
          wordWrap: { width: 200 },
        }, delay);
        y += 9;
        delay += lineDelay * 0.8;
      }
    } else {
      this.addRevealText(cx, y, 'The seasons pass quietly.', {
        fontFamily: 'monospace', fontSize: '5px', color: greyHex,
      }, delay);
      y += 12;
      delay += lineDelay;
    }

    // Seeds count
    y += 4;
    this.addRevealText(cx, y, `Seeds known: ${this.progression.discoveredSeeds.length}/10`, {
      fontFamily: 'monospace', fontSize: '5px', color: greyHex,
    }, delay);
    y += 10;
    delay += lineDelay * 0.5;

    // Tool summary (compact)
    const tools = this.progression.tools;
    const toolStr = `Tools: Can ${tools.wateringCan} · Hoe ${tools.hoe} · Basket ${tools.basket}`;
    this.addRevealText(cx, y, toolStr, {
      fontFamily: 'monospace', fontSize: '5px', color: greyHex,
    }, delay);
    delay += lineDelay;

    // Continue prompt
    const continueDelay = delay + 1000;
    this.time.delayedCall(continueDelay, () => {
      const cont = this.add.text(cx, GAME_HEIGHT - 18, 'tap to begin next year', {
        fontFamily: 'monospace', fontSize: '6px', color: parchmentHex,
        letterSpacing: 1,
      }).setOrigin(0.5).setAlpha(0).setDepth(DEPTH.UI);

      this.tweens.add({
        targets: cont, alpha: { from: 0, to: 0.5 },
        duration: 1200, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.ready = true;
      const startNext = () => { if (this.ready) this.startNextRun(); };
      this.input.once('pointerdown', startNext);
      if (this.input.keyboard) this.input.keyboard.once('keydown-SPACE', startNext);
    });
  }

  private addRevealText(
    x: number, y: number, content: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    delay: number
  ): void {
    const text = this.add.text(x, y, content, style)
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(DEPTH.UI);
    this.textElements.push(text);

    this.time.delayedCall(delay, () => {
      this.tweens.add({
        targets: text,
        alpha: 1,
        y: y - 2, // slight rise
        duration: 600,
        ease: 'Sine.easeOut',
      });
    });
  }

  private addRevealLine(y: number, delay: number): void {
    const lineGfx = this.add.graphics().setDepth(DEPTH.UI).setAlpha(0);

    this.time.delayedCall(delay, () => {
      lineGfx.lineStyle(0.5, COLORS.MUTED_SKY, 0.15);
      lineGfx.lineBetween(60, y, GAME_WIDTH - 60, y);
      this.tweens.add({
        targets: lineGfx,
        alpha: 1,
        duration: 400,
      });
    });
  }

  update(time: number, _delta: number): void {
    const t = time / 1000;
    this.particleGfx.clear();

    for (const m of this.motes) {
      m.phase += 0.015;
      m.alpha = Math.min(0.4, m.alpha + 0.003);
      const pulse = 0.4 + Math.sin(m.phase) * 0.6;

      this.particleGfx.fillStyle(COLORS.PALE_GREEN, m.alpha * pulse * 0.15);
      this.particleGfx.fillCircle(
        m.x + Math.sin(t * 0.3 + m.phase) * 8,
        m.y + Math.cos(t * 0.2 + m.phase) * 5,
        3
      );
      this.particleGfx.fillStyle(COLORS.SOFT_WHITE, m.alpha * pulse * 0.3);
      this.particleGfx.fillCircle(
        m.x + Math.sin(t * 0.3 + m.phase) * 8,
        m.y + Math.cos(t * 0.2 + m.phase) * 5,
        1
      );
    }
  }

  private startNextRun(): void {
    this.ready = false;

    this.cameras.main.fadeOut(1500, 0x0d, 0x0b, 0x0e);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        runNumber: this.progression.nextRunNumber,
      });
    });
  }
}
