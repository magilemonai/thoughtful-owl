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
  active: boolean;
}

interface Snowflake {
  x: number;
  y: number;
  speed: number;
  drift: number;
  driftPhase: number;
  size: number;
  alpha: number;
  active: boolean;
}

interface Splash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

// Pool sizes — pre-allocated, never resized
const MAX_RAIN_DROPS = 300;
const MAX_SNOWFLAKES = 120;
const MAX_SPLASHES = 60;

/**
 * Renders weather particle effects: rain, fog, snow, wind, frost, lightning.
 * Uses pre-allocated particle pools to avoid GC pressure on mobile.
 */
export class WeatherRenderer {
  private scene: Phaser.Scene;
  private currentWeather: WeatherType = 'clear';
  private targetWeather: WeatherType = 'clear';
  private transitionProgress = 1;
  private transitionSpeed = 0.008;

  // Pre-allocated particle pools
  private rainPool: RainDrop[];
  private activeRainCount = 0;
  private snowPool: Snowflake[];
  private activeSnowCount = 0;
  private splashPool: Splash[];
  private activeSplashCount = 0;

  // Graphics layers
  private rainGraphics: Phaser.GameObjects.Graphics;
  private fogOverlay: Phaser.GameObjects.Graphics;
  private frostOverlay: Phaser.GameObjects.Graphics;
  private lightningOverlay: Phaser.GameObjects.Graphics;

  // Fog
  private fogAlpha = 0;
  private fogTime = 0;

  // Frost
  private frostAlpha = 0;
  private targetFrostAlpha = 0;

  // Lightning
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

    // Pre-allocate all particle pools
    this.rainPool = new Array(MAX_RAIN_DROPS);
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      this.rainPool[i] = { x: 0, y: 0, speed: 0, length: 0, alpha: 0, active: false };
    }

    this.snowPool = new Array(MAX_SNOWFLAKES);
    for (let i = 0; i < MAX_SNOWFLAKES; i++) {
      this.snowPool[i] = { x: 0, y: 0, speed: 0, drift: 0, driftPhase: 0, size: 0, alpha: 0, active: false };
    }

    this.splashPool = new Array(MAX_SPLASHES);
    for (let i = 0; i < MAX_SPLASHES; i++) {
      this.splashPool[i] = { x: 0, y: 0, life: 0, maxLife: 0, size: 0, active: false };
    }
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
    this.updateFrost();
    this.updateLightning(delta, effectiveWeather);
    this.updateScreenShake();
    this.render(time);
  }

  private updateRain(delta: number, weather: WeatherType): void {
    const isRaining = weather === 'rain_light' || weather === 'rain_heavy' || weather === 'storm';
    const targetCount = weather === 'rain_light' ? 80
      : weather === 'rain_heavy' ? 180
      : weather === 'storm' ? MAX_RAIN_DROPS
      : 0;

    // Activate/deactivate drops to match target count
    while (this.activeRainCount < targetCount) {
      const drop = this.rainPool[this.activeRainCount];
      this.initRainDrop(drop, true);
      drop.active = true;
      this.activeRainCount++;
    }
    while (this.activeRainCount > targetCount) {
      this.activeRainCount--;
      this.rainPool[this.activeRainCount].active = false;
    }

    if (!isRaining) {
      this.activeSplashCount = 0;
      return;
    }

    const windOffsetX = Math.sin(this._windAngle) * this._windStrength * 2;

    for (let i = 0; i < this.activeRainCount; i++) {
      const drop = this.rainPool[i];
      drop.y += drop.speed * (delta / 16);
      drop.x += windOffsetX * (delta / 16);

      if (drop.y > GAME_HEIGHT + 10) {
        // Spawn splash at landing point (reuse from pool)
        if (Math.random() < 0.3 && this.activeSplashCount < MAX_SPLASHES) {
          const splash = this.splashPool[this.activeSplashCount];
          splash.x = drop.x;
          splash.y = GAME_HEIGHT - 5 - Math.random() * 30;
          splash.life = 1;
          splash.maxLife = 1;
          splash.size = 1 + Math.random() * 2;
          splash.active = true;
          this.activeSplashCount++;
        }
        this.initRainDrop(drop, false);
      }
      if (drop.x > GAME_WIDTH + 20 || drop.x < -20) {
        this.initRainDrop(drop, false);
      }
    }

    // Update splashes — compact active ones forward
    let writeIdx = 0;
    for (let i = 0; i < this.activeSplashCount; i++) {
      const s = this.splashPool[i];
      s.life -= 0.06 * (delta / 16);
      if (s.life > 0) {
        if (writeIdx !== i) {
          // Swap to compact
          const tmp = this.splashPool[writeIdx];
          this.splashPool[writeIdx] = this.splashPool[i];
          this.splashPool[i] = tmp;
        }
        writeIdx++;
      } else {
        s.active = false;
      }
    }
    this.activeSplashCount = writeIdx;
  }

  private initRainDrop(drop: RainDrop, randomY: boolean): void {
    drop.x = Math.random() * (GAME_WIDTH + 40) - 20;
    drop.y = randomY ? Math.random() * GAME_HEIGHT : -10 - Math.random() * 30;
    drop.speed = 3.5 + Math.random() * 3;
    drop.length = 4 + Math.random() * 6;
    drop.alpha = 0.15 + Math.random() * 0.35;
  }

  private updateSnow(delta: number, weather: WeatherType): void {
    const isSnowing = weather === 'snow';
    const targetCount = isSnowing ? MAX_SNOWFLAKES : 0;

    while (this.activeSnowCount < targetCount) {
      const flake = this.snowPool[this.activeSnowCount];
      flake.x = Math.random() * GAME_WIDTH;
      flake.y = Math.random() * GAME_HEIGHT;
      flake.speed = 0.3 + Math.random() * 0.6;
      flake.drift = 0.3 + Math.random() * 0.5;
      flake.driftPhase = Math.random() * Math.PI * 2;
      flake.size = 0.5 + Math.random() * 1.5;
      flake.alpha = 0.3 + Math.random() * 0.5;
      flake.active = true;
      this.activeSnowCount++;
    }
    while (this.activeSnowCount > targetCount) {
      this.activeSnowCount--;
      this.snowPool[this.activeSnowCount].active = false;
    }

    if (!isSnowing) return;

    for (let i = 0; i < this.activeSnowCount; i++) {
      const flake = this.snowPool[i];
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

  private updateFrost(): void {
    this.frostAlpha += (this.targetFrostAlpha - this.frostAlpha) * 0.02;
  }

  private updateLightning(delta: number, weather: WeatherType): void {
    if (weather !== 'storm') {
      this.lightningAlpha *= 0.9;
      return;
    }

    this.lightningTimer += delta;

    if (this.lightningTimer >= this.nextLightningAt) {
      this.lightningAlpha = 0.6 + Math.random() * 0.3;
      this.screenShakeAmount = 1.5 + Math.random() * 2;

      if (Math.random() < 0.4) {
        this.scene.time.delayedCall(100 + Math.random() * 150, () => {
          this.lightningAlpha = 0.4 + Math.random() * 0.2;
        });
      }

      this.lightningTimer = 0;
      this.nextLightningAt = 4000 + Math.random() * 10000;
    }

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
    this.rainGraphics.clear();

    // --- Rain ---
    if (this.activeRainCount > 0) {
      for (let i = 0; i < this.activeRainCount; i++) {
        const drop = this.rainPool[i];
        this.rainGraphics.lineStyle(1, COLORS.PALE_CLOUD, drop.alpha);
        const dx = Math.sin(this._windAngle) * drop.length;
        const dy = Math.cos(this._windAngle) * drop.length;
        this.rainGraphics.lineBetween(drop.x, drop.y, drop.x + dx, drop.y + dy);
      }

      // Splashes
      for (let i = 0; i < this.activeSplashCount; i++) {
        const s = this.splashPool[i];
        const expand = (1 - s.life) * s.size * 2;
        this.rainGraphics.lineStyle(0.5, COLORS.PALE_CLOUD, s.life * 0.4);
        this.rainGraphics.strokeCircle(s.x, s.y, expand);
      }
    }

    // --- Snow ---
    if (this.activeSnowCount > 0) {
      for (let i = 0; i < this.activeSnowCount; i++) {
        const flake = this.snowPool[i];
        this.rainGraphics.fillStyle(COLORS.SOFT_WHITE, flake.alpha);
        this.rainGraphics.fillCircle(flake.x, flake.y, flake.size);
        this.rainGraphics.fillStyle(COLORS.PALE_CLOUD, flake.alpha * 0.2);
        this.rainGraphics.fillCircle(flake.x, flake.y, flake.size * 2);
      }
    }

    // --- Fog ---
    this.fogOverlay.clear();
    if (this.fogAlpha > 0.005) {
      this.fogOverlay.fillStyle(COLORS.PARCHMENT, this.fogAlpha * 0.6);
      this.fogOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      for (let i = 0; i < 5; i++) {
        const baseY = GAME_HEIGHT * (0.25 + i * 0.15);
        const waveOffset = Math.sin(this.fogTime * 0.0002 + i * 1.7) * 15;
        const bandAlpha = this.fogAlpha * (0.2 + Math.sin(this.fogTime * 0.0003 + i * 2.3) * 0.15);

        if (bandAlpha > 0) {
          this.fogOverlay.fillStyle(COLORS.SOFT_WHITE, bandAlpha);
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
      this.frostOverlay.fillStyle(COLORS.SOFT_WHITE, this.frostAlpha * 0.15);
      this.frostOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      const crystalAlpha = this.frostAlpha * 0.5;
      this.frostOverlay.fillStyle(COLORS.PALE_CLOUD, crystalAlpha);

      // Edge frost
      for (let x = 0; x < GAME_WIDTH; x += 3) {
        const h = (Math.sin(x * 0.1 + 47) * 0.5 + 0.5) * 8 * this.frostAlpha;
        this.frostOverlay.fillRect(x, 0, 2, h);
      }
      for (let x = 0; x < GAME_WIDTH; x += 3) {
        const h = (Math.sin(x * 0.12 + 23) * 0.5 + 0.5) * 6 * this.frostAlpha;
        this.frostOverlay.fillRect(x, GAME_HEIGHT - h, 2, h);
      }
      for (let y = 0; y < GAME_HEIGHT; y += 3) {
        const wL = (Math.sin(y * 0.09 + 17) * 0.5 + 0.5) * 5 * this.frostAlpha;
        const wR = (Math.sin(y * 0.11 + 31) * 0.5 + 0.5) * 5 * this.frostAlpha;
        this.frostOverlay.fillRect(0, y, wL, 2);
        this.frostOverlay.fillRect(GAME_WIDTH - wR, y, wR, 2);
      }

      // Frost crystal specks
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
