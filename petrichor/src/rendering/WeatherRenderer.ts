import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';

export type WeatherType = 'clear' | 'rain_light' | 'rain_heavy' | 'storm' | 'fog' | 'snow';

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
}

interface Snowflake {
  x: number;
  y: number;
  speed: number;
  drift: number;
  driftPhase: number;
  size: number;
  alpha: number;
}

interface Splash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Renders weather particle effects: rain, fog, snow, wind, frost, lightning.
 * All effects are procedural — no sprite assets needed.
 */
export class WeatherRenderer {
  private scene: Phaser.Scene;
  private currentWeather: WeatherType = 'clear';
  private targetWeather: WeatherType = 'clear';
  private transitionProgress = 1;
  private transitionSpeed = 0.008;

  // Rain system
  private rainDrops: RainDrop[] = [];
  private rainGraphics: Phaser.GameObjects.Graphics;
  private splashes: Splash[] = [];

  // Snow system
  private snowflakes: Snowflake[] = [];

  // Fog overlay
  private fogOverlay: Phaser.GameObjects.Graphics;
  private fogAlpha = 0;
  private fogTime = 0;

  // Frost overlay
  private frostOverlay: Phaser.GameObjects.Graphics;
  private frostAlpha = 0;
  private targetFrostAlpha = 0;

  // Lightning
  private lightningOverlay: Phaser.GameObjects.Graphics;
  private lightningAlpha = 0;
  private lightningTimer = 0;
  private nextLightningAt = 0;

  // Screen effects
  private screenShakeAmount = 0;

  // Wind
  private _windStrength = 0;
  private _targetWindStrength = 0;
  private _windAngle = 0.15;
  private windTime = 0;
  private windGustTimer = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.rainGraphics = scene.add.graphics();
    this.rainGraphics.setDepth(DEPTH.WEATHER_FRONT);
    this.rainGraphics.setScrollFactor(0);

    this.fogOverlay = scene.add.graphics();
    this.fogOverlay.setDepth(DEPTH.WEATHER_BEHIND);
    this.fogOverlay.setScrollFactor(0);

    this.frostOverlay = scene.add.graphics();
    this.frostOverlay.setDepth(DEPTH.WEATHER_FRONT - 1);
    this.frostOverlay.setScrollFactor(0);

    this.lightningOverlay = scene.add.graphics();
    this.lightningOverlay.setDepth(DEPTH.WEATHER_FRONT + 10);
    this.lightningOverlay.setScrollFactor(0);
  }

  get windStrength(): number { return this._windStrength; }
  get windAngle(): number { return this._windAngle; }
  get isRaining(): boolean {
    return this.currentWeather === 'rain_light' ||
      this.currentWeather === 'rain_heavy' ||
      this.currentWeather === 'storm';
  }

  setWeather(type: WeatherType, immediate = false): void {
    if (type === this.currentWeather && this.transitionProgress >= 1) return;
    this.targetWeather = type;
    this.transitionProgress = immediate ? 1 : 0;
    if (immediate) {
      this.currentWeather = type;
    }

    // Storms bring wind
    if (type === 'storm') {
      this._targetWindStrength = 2.5 + Math.random() * 1.5;
    } else if (type === 'rain_heavy') {
      this._targetWindStrength = 1.0 + Math.random() * 0.8;
    } else if (type === 'rain_light') {
      this._targetWindStrength = 0.3 + Math.random() * 0.4;
    } else if (type === 'clear' || type === 'fog') {
      this._targetWindStrength = 0.1 + Math.random() * 0.2;
    } else if (type === 'snow') {
      this._targetWindStrength = 0.2 + Math.random() * 0.3;
    }

    // Storms trigger lightning
    if (type === 'storm') {
      this.nextLightningAt = 3000 + Math.random() * 5000;
      this.lightningTimer = 0;
    }
  }

  setFrost(intensity: number): void {
    this.targetFrostAlpha = Math.max(0, Math.min(1, intensity));
  }

  setWind(strength: number, angle: number): void {
    this._targetWindStrength = strength;
    this._windAngle = angle;
  }

  update(delta: number, time: number): void {
    // Transition between weather states
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + this.transitionSpeed * delta);
      if (this.transitionProgress >= 1) {
        this.currentWeather = this.targetWeather;
      }
    }

    const effectiveWeather = this.transitionProgress >= 1 ? this.currentWeather : this.targetWeather;

    // Smooth wind
    this._windStrength += (this._targetWindStrength - this._windStrength) * 0.02;
    this.windTime += delta / 1000;

    // Wind gusts
    this.windGustTimer += delta;
    if (this.windGustTimer > 4000 + Math.random() * 6000) {
      this.windGustTimer = 0;
      if (this._windStrength > 0.5) {
        // Gust: temporarily boost wind
        const savedTarget = this._targetWindStrength;
        this._targetWindStrength = savedTarget * 1.8;
        this.scene.time.delayedCall(800 + Math.random() * 600, () => {
          this._targetWindStrength = savedTarget;
        });
      }
    }

    this.updateRain(delta, effectiveWeather);
    this.updateSnow(delta, effectiveWeather);
    this.updateFog(delta, effectiveWeather, time);
    this.updateFrost(delta);
    this.updateLightning(delta, effectiveWeather);
    this.updateScreenShake();
    this.render(time);
  }

  private updateRain(delta: number, weather: WeatherType): void {
    const isRaining = weather === 'rain_light' || weather === 'rain_heavy' || weather === 'storm';
    const targetCount = weather === 'rain_light' ? 80
      : weather === 'rain_heavy' ? 180
      : weather === 'storm' ? 300
      : 0;

    while (this.rainDrops.length < targetCount) {
      this.rainDrops.push(this.createRainDrop(true));
    }
    while (this.rainDrops.length > targetCount) {
      this.rainDrops.pop();
    }

    if (!isRaining) {
      this.splashes = [];
      return;
    }

    const windOffsetX = Math.sin(this._windAngle) * this._windStrength * 2;

    for (const drop of this.rainDrops) {
      drop.y += drop.speed * (delta / 16);
      drop.x += windOffsetX * (delta / 16);

      if (drop.y > GAME_HEIGHT + 10) {
        // Spawn splash at landing point
        if (Math.random() < 0.3) {
          this.splashes.push({
            x: drop.x,
            y: GAME_HEIGHT - 5 - Math.random() * 30,
            life: 1,
            maxLife: 1,
            size: 1 + Math.random() * 2,
          });
        }
        this.resetRainDrop(drop);
      }
      if (drop.x > GAME_WIDTH + 20 || drop.x < -20) {
        this.resetRainDrop(drop);
      }
    }

    // Update splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].life -= 0.06 * (delta / 16);
      if (this.splashes[i].life <= 0) {
        this.splashes.splice(i, 1);
      }
    }
  }

  private createRainDrop(randomY: boolean): RainDrop {
    return {
      x: Math.random() * (GAME_WIDTH + 40) - 20,
      y: randomY ? Math.random() * GAME_HEIGHT : -10 - Math.random() * 30,
      speed: 3.5 + Math.random() * 3,
      length: 4 + Math.random() * 6,
      alpha: 0.15 + Math.random() * 0.35,
    };
  }

  private resetRainDrop(drop: RainDrop): void {
    drop.x = Math.random() * (GAME_WIDTH + 40) - 20;
    drop.y = -10 - Math.random() * 30;
    drop.speed = 3.5 + Math.random() * 3;
    drop.alpha = 0.15 + Math.random() * 0.35;
  }

  private updateSnow(delta: number, weather: WeatherType): void {
    const isSnowing = weather === 'snow';
    const targetCount = isSnowing ? 120 : 0;

    while (this.snowflakes.length < targetCount) {
      this.snowflakes.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        speed: 0.3 + Math.random() * 0.6,
        drift: 0.3 + Math.random() * 0.5,
        driftPhase: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }
    while (this.snowflakes.length > targetCount) {
      this.snowflakes.pop();
    }

    if (!isSnowing) return;

    for (const flake of this.snowflakes) {
      flake.y += flake.speed * (delta / 16);
      flake.driftPhase += 0.02;
      flake.x += Math.sin(flake.driftPhase) * flake.drift * (delta / 16);
      flake.x += this._windStrength * 0.3 * (delta / 16);

      if (flake.y > GAME_HEIGHT + 5) {
        flake.y = -5;
        flake.x = Math.random() * GAME_WIDTH;
      }
      if (flake.x > GAME_WIDTH + 10) flake.x = -10;
      if (flake.x < -10) flake.x = GAME_WIDTH + 10;
    }
  }

  private updateFog(delta: number, weather: WeatherType, time: number): void {
    const targetFog = weather === 'fog' ? 0.35 : 0;
    this.fogAlpha += (targetFog - this.fogAlpha) * 0.008 * (delta / 16);
    this.fogTime = time;
  }

  private updateFrost(_delta: number): void {
    this.frostAlpha += (this.targetFrostAlpha - this.frostAlpha) * 0.02;
  }

  private updateLightning(delta: number, weather: WeatherType): void {
    if (weather !== 'storm') {
      this.lightningAlpha *= 0.9;
      return;
    }

    this.lightningTimer += delta;

    if (this.lightningTimer >= this.nextLightningAt) {
      // Flash!
      this.lightningAlpha = 0.6 + Math.random() * 0.3;
      this.screenShakeAmount = 1.5 + Math.random() * 2;

      // Double flash sometimes
      if (Math.random() < 0.4) {
        this.scene.time.delayedCall(100 + Math.random() * 150, () => {
          this.lightningAlpha = 0.4 + Math.random() * 0.2;
        });
      }

      // Schedule next
      this.lightningTimer = 0;
      this.nextLightningAt = 4000 + Math.random() * 10000;
    }

    // Decay flash
    this.lightningAlpha *= 0.88;
  }

  private updateScreenShake(): void {
    if (this.screenShakeAmount > 0.05) {
      const cam = this.scene.cameras.main;
      const shakeX = (Math.random() - 0.5) * this.screenShakeAmount;
      const shakeY = (Math.random() - 0.5) * this.screenShakeAmount;
      cam.setScroll(cam.scrollX + shakeX, cam.scrollY + shakeY);
      this.screenShakeAmount *= 0.9;
    }
  }

  private render(time: number): void {
    // --- Rain ---
    this.rainGraphics.clear();
    if (this.rainDrops.length > 0) {
      for (const drop of this.rainDrops) {
        this.rainGraphics.lineStyle(1, COLORS.PALE_CLOUD, drop.alpha);
        const dx = Math.sin(this._windAngle) * drop.length;
        const dy = Math.cos(this._windAngle) * drop.length;
        this.rainGraphics.lineBetween(drop.x, drop.y, drop.x + dx, drop.y + dy);
      }

      // Splashes
      for (const s of this.splashes) {
        const expand = (1 - s.life) * s.size * 2;
        this.rainGraphics.lineStyle(0.5, COLORS.PALE_CLOUD, s.life * 0.4);
        this.rainGraphics.strokeCircle(s.x, s.y, expand);
      }
    }

    // --- Snow ---
    if (this.snowflakes.length > 0) {
      for (const flake of this.snowflakes) {
        this.rainGraphics.fillStyle(COLORS.SOFT_WHITE, flake.alpha);
        this.rainGraphics.fillCircle(flake.x, flake.y, flake.size);
        // Subtle glow
        this.rainGraphics.fillStyle(COLORS.PALE_CLOUD, flake.alpha * 0.2);
        this.rainGraphics.fillCircle(flake.x, flake.y, flake.size * 2);
      }
    }

    // --- Fog ---
    this.fogOverlay.clear();
    if (this.fogAlpha > 0.005) {
      // Base fog layer
      this.fogOverlay.fillStyle(COLORS.PARCHMENT, this.fogAlpha * 0.6);
      this.fogOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Rolling fog wisps (multiple overlapping sine waves)
      for (let i = 0; i < 5; i++) {
        const baseY = GAME_HEIGHT * (0.25 + i * 0.15);
        const waveOffset = Math.sin(this.fogTime * 0.0002 + i * 1.7) * 15;
        const bandAlpha = this.fogAlpha * (0.2 + Math.sin(this.fogTime * 0.0003 + i * 2.3) * 0.15);

        if (bandAlpha > 0) {
          this.fogOverlay.fillStyle(COLORS.SOFT_WHITE, bandAlpha);
          // Draw as horizontal band with soft edges
          for (let x = 0; x < GAME_WIDTH; x += 4) {
            const localY = baseY + waveOffset + Math.sin(x * 0.03 + this.fogTime * 0.0001 + i) * 8;
            const h = 12 + Math.sin(x * 0.05 + i * 3) * 4;
            this.fogOverlay.fillRect(x, localY, 4, h);
          }
        }
      }
    }

    // --- Frost ---
    this.frostOverlay.clear();
    if (this.frostAlpha > 0.01) {
      // Screen-edge frost vignette
      this.frostOverlay.fillStyle(COLORS.SOFT_WHITE, this.frostAlpha * 0.15);
      this.frostOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Frost crystals at edges
      const crystalAlpha = this.frostAlpha * 0.5;
      this.frostOverlay.fillStyle(COLORS.PALE_CLOUD, crystalAlpha);

      // Top edge frost
      for (let x = 0; x < GAME_WIDTH; x += 3) {
        const h = (Math.sin(x * 0.1 + 47) * 0.5 + 0.5) * 8 * this.frostAlpha;
        this.frostOverlay.fillRect(x, 0, 2, h);
      }
      // Bottom edge frost
      for (let x = 0; x < GAME_WIDTH; x += 3) {
        const h = (Math.sin(x * 0.12 + 23) * 0.5 + 0.5) * 6 * this.frostAlpha;
        this.frostOverlay.fillRect(x, GAME_HEIGHT - h, 2, h);
      }
      // Left/right edge frost
      for (let y = 0; y < GAME_HEIGHT; y += 3) {
        const wL = (Math.sin(y * 0.09 + 17) * 0.5 + 0.5) * 5 * this.frostAlpha;
        const wR = (Math.sin(y * 0.11 + 31) * 0.5 + 0.5) * 5 * this.frostAlpha;
        this.frostOverlay.fillRect(0, y, wL, 2);
        this.frostOverlay.fillRect(GAME_WIDTH - wR, y, wR, 2);
      }

      // Random ice crystal specks
      this.frostOverlay.fillStyle(COLORS.SOFT_WHITE, crystalAlpha * 0.6);
      for (let i = 0; i < 20; i++) {
        const cx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * GAME_WIDTH;
        const cy = (Math.cos(i * 269.5 + 183.3) * 0.5 + 0.5) * GAME_HEIGHT;
        const edgeDist = Math.min(cx, cy, GAME_WIDTH - cx, GAME_HEIGHT - cy);
        if (edgeDist < 40) {
          const sparkle = Math.sin(time * 0.003 + i * 5) * 0.3 + 0.7;
          this.frostOverlay.fillStyle(COLORS.SOFT_WHITE, crystalAlpha * sparkle);
          this.frostOverlay.fillRect(cx, cy, 1, 1);
          this.frostOverlay.fillRect(cx - 1, cy, 3, 1);
          this.frostOverlay.fillRect(cx, cy - 1, 1, 3);
        }
      }
    }

    // --- Lightning ---
    this.lightningOverlay.clear();
    if (this.lightningAlpha > 0.01) {
      this.lightningOverlay.fillStyle(COLORS.SOFT_WHITE, this.lightningAlpha);
      this.lightningOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  destroy(): void {
    this.rainGraphics.destroy();
    this.fogOverlay.destroy();
    this.frostOverlay.destroy();
    this.lightningOverlay.destroy();
  }
}
