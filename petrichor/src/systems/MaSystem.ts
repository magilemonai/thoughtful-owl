import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/constants';
import { COLORS, Season, TimeOfDay } from '../config/palette';

export type MaMomentType = 'petrichor' | 'deep_green' | 'first_frost' | 'moonlit_silence';

interface MaMoment {
  type: MaMomentType;
  season: Season;
  name: string;
  description: string;
  rewardDescription: string;
  triggerTime?: TimeOfDay;
  duration: number; // ms
  triggered: boolean;
}

interface MaReward {
  type: 'fertility' | 'motes' | 'knowledge' | 'blessing';
  value: number;
  description: string;
}

/**
 * The Ma System — moments of stillness and beauty.
 *
 * Each season has one potential Ma moment triggered by specific conditions.
 * When triggered, gameplay pauses, the screen transforms, and the player
 * "breathes with" the moment. Completing it grants a mechanical reward.
 *
 * Ma moments are the soul of Petrichor. They must feel earned, never routine.
 */
export class MaSystem {
  private scene: Phaser.Scene;
  readonly events: Phaser.Events.EventEmitter;

  private moments: MaMoment[];
  private activeMoment: MaMoment | null = null;
  private momentPhase: 'entering' | 'holding' | 'rewarding' | 'exiting' | null = null;
  private momentTimer = 0;
  private holdProgress = 0; // 0-1, how long the player has been still
  private holdRequired = 3000; // ms of stillness needed

  // Visual layers
  private overlayGraphics: Phaser.GameObjects.Graphics;
  private particleGraphics: Phaser.GameObjects.Graphics;
  private textContainer: Phaser.GameObjects.Container;

  // Per-moment particle state
  private maParticles: Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; color: number; size: number; phase: number;
  }> = [];

  // Breath mechanic (tap and hold)
  private isHolding = false;
  private breathCycle = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();

    this.overlayGraphics = scene.add.graphics();
    this.overlayGraphics.setDepth(DEPTH.MA_OVERLAY);
    this.overlayGraphics.setScrollFactor(0);

    this.particleGraphics = scene.add.graphics();
    this.particleGraphics.setDepth(DEPTH.MA_OVERLAY + 1);
    this.particleGraphics.setScrollFactor(0);

    this.textContainer = scene.add.container(0, 0);
    this.textContainer.setDepth(DEPTH.MA_OVERLAY + 2);
    this.textContainer.setScrollFactor(0);
    this.textContainer.setAlpha(0);

    this.moments = [
      {
        type: 'petrichor',
        season: 'spring',
        name: 'Petrichor',
        description: 'The first rain. Hold to breathe with the land.',
        rewardDescription: 'The soil remembers this kindness.',
        triggerTime: 'afternoon',
        duration: 12000,
        triggered: false,
      },
      {
        type: 'deep_green',
        season: 'summer',
        name: 'The Deep Green',
        description: 'Light through the canopy. Walk slowly.',
        rewardDescription: 'The motes reveal a hidden path.',
        triggerTime: 'afternoon',
        duration: 10000,
        triggered: false,
      },
      {
        type: 'first_frost',
        season: 'autumn',
        name: 'First Frost',
        description: 'Everything crystalline. Be still.',
        rewardDescription: 'The Deepwarm stirs beneath your feet.',
        triggerTime: 'dawn',
        duration: 10000,
        triggered: false,
      },
      {
        type: 'moonlit_silence',
        season: 'autumn',
        name: 'Moonlit Silence',
        description: 'The river holds the moon. Sit and watch.',
        rewardDescription: 'The Greycurrent grants its blessing.',
        triggerTime: 'night',
        duration: 14000,
        triggered: false,
      },
    ];

    // Touch/hold input for breath mechanic
    scene.input.on('pointerdown', () => { this.isHolding = true; });
    scene.input.on('pointerup', () => { this.isHolding = false; });
  }

  get isActive(): boolean {
    return this.activeMoment !== null;
  }

  /**
   * Check if conditions are met for a Ma moment.
   * Called by GameScene when relevant conditions change.
   */
  checkTrigger(
    season: Season,
    timeOfDay: TimeOfDay,
    isRaining: boolean,
    playerNearForest: boolean,
    playerNearRiver: boolean,
    landHealth: number
  ): boolean {
    if (this.activeMoment) return false;

    for (const moment of this.moments) {
      if (moment.triggered) continue;
      if (moment.season !== season) continue;

      switch (moment.type) {
        case 'petrichor':
          // Triggers when rain starts in spring
          if (isRaining && timeOfDay === 'afternoon') {
            this.triggerMoment(moment);
            return true;
          }
          break;

        case 'deep_green':
          // Triggers when player is in the forest during summer afternoon
          if (playerNearForest && timeOfDay === 'afternoon' && landHealth > 0.5) {
            this.triggerMoment(moment);
            return true;
          }
          break;

        case 'first_frost':
          // Triggers at dawn on late autumn day
          if (timeOfDay === 'dawn') {
            this.triggerMoment(moment);
            return true;
          }
          break;

        case 'moonlit_silence':
          // Triggers at night near the river in autumn
          if (playerNearRiver && timeOfDay === 'night' && landHealth > 0.4) {
            this.triggerMoment(moment);
            return true;
          }
          break;
      }
    }
    return false;
  }

  private triggerMoment(moment: MaMoment): void {
    moment.triggered = true;
    this.activeMoment = moment;
    this.momentPhase = 'entering';
    this.momentTimer = 0;
    this.holdProgress = 0;
    this.maParticles = [];
    this.breathCycle = 0;

    this.events.emit('ma-start', moment.type);
    this.initMomentParticles(moment.type);
    this.showMomentText(moment);
  }

  update(time: number, delta: number): void {
    if (!this.activeMoment || !this.momentPhase) return;

    this.momentTimer += delta;

    switch (this.momentPhase) {
      case 'entering':
        this.updateEntering(time, delta);
        break;
      case 'holding':
        this.updateHolding(time, delta);
        break;
      case 'rewarding':
        this.updateRewarding(time, delta);
        break;
      case 'exiting':
        this.updateExiting(time, delta);
        break;
    }

    this.renderOverlay(time);
    this.renderParticles(time, delta);
  }

  private updateEntering(_time: number, _delta: number): void {
    // 2-second fade in
    if (this.momentTimer > 2000) {
      this.momentPhase = 'holding';
      this.momentTimer = 0;
    }
  }

  private updateHolding(_time: number, delta: number): void {
    // Player holds screen to "breathe"
    if (this.isHolding) {
      this.holdProgress += delta / this.holdRequired;
      this.breathCycle += delta * 0.003;
    } else {
      // Slowly decay if not holding
      this.holdProgress = Math.max(0, this.holdProgress - delta / (this.holdRequired * 3));
    }

    // Complete when fully held
    if (this.holdProgress >= 1) {
      this.momentPhase = 'rewarding';
      this.momentTimer = 0;
      this.events.emit('ma-complete', this.activeMoment!.type);
    }

    // Timeout — auto-complete at 80% of duration even without holding
    if (this.momentTimer > this.activeMoment!.duration * 0.8) {
      this.holdProgress = Math.max(this.holdProgress, 0.6); // partial credit
      this.momentPhase = 'rewarding';
      this.momentTimer = 0;
      this.events.emit('ma-complete', this.activeMoment!.type);
    }
  }

  private updateRewarding(_time: number, _delta: number): void {
    // Show reward text for 3 seconds
    if (this.momentTimer > 3000) {
      this.momentPhase = 'exiting';
      this.momentTimer = 0;
    }
  }

  private updateExiting(_time: number, _delta: number): void {
    if (this.momentTimer > 2000) {
      this.endMoment();
    }
  }

  getReward(): MaReward | null {
    if (!this.activeMoment) return null;

    const quality = Math.min(1, this.holdProgress);

    switch (this.activeMoment.type) {
      case 'petrichor':
        return {
          type: 'fertility',
          value: 0.1 + quality * 0.15,
          description: 'Soil fertility restored across the farm.',
        };
      case 'deep_green':
        return {
          type: 'motes',
          value: 2 + Math.floor(quality * 3),
          description: 'New motes have appeared in the grove.',
        };
      case 'first_frost':
        return {
          type: 'knowledge',
          value: quality,
          description: 'Winter foraging knowledge gained.',
        };
      case 'moonlit_silence':
        return {
          type: 'blessing',
          value: quality,
          description: 'The river blesses your next season.',
        };
    }
  }

  private endMoment(): void {
    this.activeMoment = null;
    this.momentPhase = null;
    this.textContainer.setAlpha(0);
    this.textContainer.removeAll(true);
    this.overlayGraphics.clear();
    this.particleGraphics.clear();
    this.events.emit('ma-end');
  }

  private showMomentText(moment: MaMoment): void {
    this.textContainer.removeAll(true);

    // Moment name
    const name = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.25, moment.name, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
      letterSpacing: 4,
    }).setOrigin(0.5);
    this.textContainer.add(name);

    // Instruction
    const desc = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.25 + 16, moment.description, {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`,
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.textContainer.add(desc);

    // Fade in
    this.scene.tweens.add({
      targets: this.textContainer,
      alpha: 1,
      duration: 2000,
      ease: 'Sine.easeInOut',
    });
  }

  private initMomentParticles(type: MaMomentType): void {
    this.maParticles = [];

    switch (type) {
      case 'petrichor':
        // Soft rain particles + earth-tone rising particles
        for (let i = 0; i < 40; i++) {
          this.maParticles.push({
            x: Math.random() * GAME_WIDTH,
            y: GAME_HEIGHT + Math.random() * 20,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.2 - Math.random() * 0.4,
            life: 1,
            color: [COLORS.EARTH, COLORS.WARM_GREY, COLORS.PALE_GREEN][Math.floor(Math.random() * 3)],
            size: 1 + Math.random() * 2,
            phase: Math.random() * Math.PI * 2,
          });
        }
        break;

      case 'deep_green':
        // Light shaft particles — golden motes drifting down
        for (let i = 0; i < 30; i++) {
          this.maParticles.push({
            x: GAME_WIDTH * 0.2 + Math.random() * GAME_WIDTH * 0.6,
            y: -10 - Math.random() * GAME_HEIGHT,
            vx: (Math.random() - 0.5) * 0.2,
            vy: 0.15 + Math.random() * 0.3,
            life: 1,
            color: [COLORS.PALE_GOLD, COLORS.GOLDEN_WHEAT, COLORS.SOFT_WHITE][Math.floor(Math.random() * 3)],
            size: 0.5 + Math.random() * 2,
            phase: Math.random() * Math.PI * 2,
          });
        }
        break;

      case 'first_frost':
        // Crystalline sparkles — static, twinkling
        for (let i = 0; i < 50; i++) {
          this.maParticles.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            vx: 0,
            vy: 0,
            life: 1,
            color: [COLORS.SOFT_WHITE, COLORS.PALE_CLOUD, COLORS.LIGHT_SKY][Math.floor(Math.random() * 3)],
            size: 0.5 + Math.random() * 1,
            phase: Math.random() * Math.PI * 2,
          });
        }
        break;

      case 'moonlit_silence':
        // Silvery motes rising from water
        for (let i = 0; i < 25; i++) {
          this.maParticles.push({
            x: GAME_WIDTH * 0.3 + Math.random() * GAME_WIDTH * 0.4,
            y: GAME_HEIGHT * 0.6 + Math.random() * GAME_HEIGHT * 0.3,
            vx: (Math.random() - 0.5) * 0.1,
            vy: -0.1 - Math.random() * 0.2,
            life: 1,
            color: [COLORS.PALE_CLOUD, COLORS.LIGHT_SKY, COLORS.SOFT_WHITE][Math.floor(Math.random() * 3)],
            size: 1 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2,
          });
        }
        break;
    }
  }

  private renderOverlay(time: number): void {
    this.overlayGraphics.clear();
    if (!this.activeMoment || !this.momentPhase) return;

    const t = time / 1000;

    // Phase-based alpha
    let overlayAlpha = 0;
    if (this.momentPhase === 'entering') {
      overlayAlpha = Math.min(1, this.momentTimer / 2000) * 0.4;
    } else if (this.momentPhase === 'holding') {
      overlayAlpha = 0.4;
    } else if (this.momentPhase === 'rewarding') {
      overlayAlpha = 0.4 - (this.momentTimer / 3000) * 0.1;
    } else if (this.momentPhase === 'exiting') {
      overlayAlpha = 0.3 * (1 - this.momentTimer / 2000);
    }

    // Moment-specific overlay color
    let overlayColor: number = COLORS.MIDNIGHT;
    switch (this.activeMoment.type) {
      case 'petrichor': overlayColor = COLORS.DEEP_FOREST; break;
      case 'deep_green': overlayColor = COLORS.DEEP_FOREST; break;
      case 'first_frost': overlayColor = COLORS.STEEL_BLUE; break;
      case 'moonlit_silence': overlayColor = COLORS.MIDNIGHT; break;
    }

    this.overlayGraphics.fillStyle(overlayColor, overlayAlpha);
    this.overlayGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Cinematic bars
    const barHeight = 12;
    this.overlayGraphics.fillStyle(0x000000, overlayAlpha * 1.5);
    this.overlayGraphics.fillRect(0, 0, GAME_WIDTH, barHeight);
    this.overlayGraphics.fillRect(0, GAME_HEIGHT - barHeight, GAME_WIDTH, barHeight);

    // Breath indicator (during holding phase)
    if (this.momentPhase === 'holding') {
      const breathAlpha = 0.3 + Math.sin(this.breathCycle) * 0.15;
      const radius = 15 + this.holdProgress * 20;

      // Breath circle
      this.overlayGraphics.lineStyle(1, COLORS.SOFT_WHITE, breathAlpha * (this.isHolding ? 1 : 0.3));
      this.overlayGraphics.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, radius);

      // Progress arc
      if (this.holdProgress > 0) {
        this.overlayGraphics.lineStyle(1.5, COLORS.PALE_GOLD, 0.5);
        this.overlayGraphics.beginPath();
        this.overlayGraphics.arc(
          GAME_WIDTH / 2, GAME_HEIGHT * 0.7, radius + 3,
          -Math.PI / 2,
          -Math.PI / 2 + this.holdProgress * Math.PI * 2,
          false
        );
        this.overlayGraphics.strokePath();
      }

      // "Hold" hint
      if (this.holdProgress < 0.1 && !this.isHolding) {
        const hintAlpha = 0.3 + Math.sin(t * 2) * 0.2;
        this.overlayGraphics.fillStyle(COLORS.SOFT_WHITE, hintAlpha);
        // Small dot at center of breath circle
        this.overlayGraphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, 2);
      }
    }

    // Reward text (during rewarding phase)
    if (this.momentPhase === 'rewarding' && this.momentTimer < 500) {
      // Show reward description
      const rewardAlpha = Math.min(1, this.momentTimer / 500);
      if (rewardAlpha > 0.5 && this.textContainer.list.length < 3) {
        const rewardText = this.scene.add.text(
          GAME_WIDTH / 2, GAME_HEIGHT * 0.6,
          this.activeMoment.rewardDescription,
          {
            fontFamily: 'monospace',
            fontSize: '6px',
            color: `#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`,
            letterSpacing: 1,
          }
        ).setOrigin(0.5);
        this.textContainer.add(rewardText);
      }
    }
  }

  private renderParticles(time: number, delta: number): void {
    this.particleGraphics.clear();
    if (!this.activeMoment) return;

    const t = time / 1000;
    const dt = delta / 1000;

    for (const p of this.maParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += dt * 2;

      // Wrap/recycle
      if (p.y < -10) p.y = GAME_HEIGHT + 10;
      if (p.y > GAME_HEIGHT + 10) p.y = -10;
      if (p.x < -10) p.x = GAME_WIDTH + 10;
      if (p.x > GAME_WIDTH + 10) p.x = -10;

      // Moment-specific rendering
      const momentAlpha = this.momentPhase === 'exiting'
        ? (1 - this.momentTimer / 2000)
        : this.momentPhase === 'entering'
          ? Math.min(1, this.momentTimer / 2000)
          : 1;

      switch (this.activeMoment.type) {
        case 'petrichor': {
          // Rising earth-tone motes (the scent made visible)
          const breathInfluence = this.isHolding ? 1.3 : 0.8;
          const alpha = (0.3 + Math.sin(p.phase) * 0.2) * momentAlpha;
          p.vy = -0.2 * breathInfluence - Math.sin(p.phase * 0.5) * 0.1;
          this.particleGraphics.fillStyle(p.color, alpha);
          this.particleGraphics.fillCircle(p.x, p.y, p.size * (0.8 + Math.sin(p.phase) * 0.2));
          break;
        }

        case 'deep_green': {
          // Light shafts — columns of gold descending
          const shaftAlpha = (0.15 + Math.sin(p.phase * 0.5) * 0.1) * momentAlpha;
          this.particleGraphics.fillStyle(p.color, shaftAlpha);
          this.particleGraphics.fillCircle(p.x, p.y, p.size);
          // Trailing glow
          this.particleGraphics.fillStyle(p.color, shaftAlpha * 0.3);
          this.particleGraphics.fillCircle(p.x, p.y - 3, p.size * 2);
          break;
        }

        case 'first_frost': {
          // Static sparkles that twinkle
          const twinkle = Math.sin(t * 3 + p.phase * 5) > 0.7 ? 1 : 0.1;
          const alpha = twinkle * 0.6 * momentAlpha;
          this.particleGraphics.fillStyle(p.color, alpha);
          this.particleGraphics.fillRect(p.x, p.y, 1, 1);
          if (twinkle > 0.5) {
            this.particleGraphics.fillRect(p.x - 1, p.y, 3, 1);
            this.particleGraphics.fillRect(p.x, p.y - 1, 1, 3);
          }
          break;
        }

        case 'moonlit_silence': {
          // Silvery motes — slow, dreamy
          const alpha = (0.3 + Math.sin(p.phase * 0.3) * 0.2) * momentAlpha;
          this.particleGraphics.fillStyle(p.color, alpha * 0.15);
          this.particleGraphics.fillCircle(p.x, p.y, p.size * 3);
          this.particleGraphics.fillStyle(p.color, alpha * 0.5);
          this.particleGraphics.fillCircle(p.x, p.y, p.size);
          break;
        }
      }
    }
  }

  /**
   * Reset all moments for a new run.
   */
  reset(): void {
    for (const m of this.moments) {
      m.triggered = false;
    }
    this.endMoment();
  }

  destroy(): void {
    this.overlayGraphics.destroy();
    this.particleGraphics.destroy();
    this.textContainer.destroy();
    this.events.removeAllListeners();
  }
}
