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

/**
 * Renders weather particle effects: rain, fog, snow, wind.
 * All effects are procedural — no sprite assets needed.
 */
export class WeatherRenderer {
  private scene: Phaser.Scene;
  private currentWeather: WeatherType = 'clear';
  private targetWeather: WeatherType = 'clear';
  private transitionProgress = 1;
  private transitionSpeed = 0.005;

  // Rain system
  private rainDrops: RainDrop[] = [];
  private rainGraphics: Phaser.GameObjects.Graphics;
  private splashEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // Fog overlay
  private fogOverlay: Phaser.GameObjects.Graphics;
  private fogAlpha = 0;

  // Wind
  private windStrength = 0;
  private windAngle = 0.15; // radians offset from vertical

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.rainGraphics = scene.add.graphics();
    this.rainGraphics.setDepth(DEPTH.WEATHER_FRONT);
    this.rainGraphics.setScrollFactor(0);

    this.fogOverlay = scene.add.graphics();
    this.fogOverlay.setDepth(DEPTH.WEATHER_BEHIND);
    this.fogOverlay.setScrollFactor(0);
  }

  setWeather(type: WeatherType, immediate = false): void {
    if (type === this.currentWeather && this.transitionProgress >= 1) return;
    this.targetWeather = type;
    this.transitionProgress = immediate ? 1 : 0;
    if (immediate) {
      this.currentWeather = type;
    }
  }

  setWind(strength: number, angle: number): void {
    this.windStrength = strength;
    this.windAngle = angle;
  }

  update(delta: number): void {
    // Transition between weather states
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + this.transitionSpeed * delta);
      if (this.transitionProgress >= 1) {
        this.currentWeather = this.targetWeather;
      }
    }

    const effectiveWeather = this.transitionProgress >= 1 ? this.currentWeather : this.targetWeather;

    this.updateRain(delta, effectiveWeather);
    this.updateFog(delta, effectiveWeather);
    this.render();
  }

  private updateRain(delta: number, weather: WeatherType): void {
    const isRaining = weather === 'rain_light' || weather === 'rain_heavy' || weather === 'storm';
    const targetCount = weather === 'rain_light' ? 60
      : weather === 'rain_heavy' ? 150
      : weather === 'storm' ? 250
      : 0;

    // Spawn/remove drops to match target
    while (this.rainDrops.length < targetCount) {
      this.rainDrops.push(this.createRainDrop(true));
    }
    while (this.rainDrops.length > targetCount) {
      this.rainDrops.pop();
    }

    if (!isRaining) return;

    const windOffsetX = Math.sin(this.windAngle) * this.windStrength * 2;

    for (const drop of this.rainDrops) {
      drop.y += drop.speed * (delta / 16);
      drop.x += windOffsetX * (delta / 16);

      if (drop.y > GAME_HEIGHT + 10) {
        this.resetRainDrop(drop, false);
      }
      if (drop.x > GAME_WIDTH + 20 || drop.x < -20) {
        this.resetRainDrop(drop, false);
      }
    }
  }

  private createRainDrop(randomY: boolean): RainDrop {
    return {
      x: Math.random() * (GAME_WIDTH + 40) - 20,
      y: randomY ? Math.random() * GAME_HEIGHT : -10 - Math.random() * 30,
      speed: 3 + Math.random() * 3,
      length: 4 + Math.random() * 6,
      alpha: 0.2 + Math.random() * 0.4,
    };
  }

  private resetRainDrop(drop: RainDrop, _randomY: boolean): void {
    drop.x = Math.random() * (GAME_WIDTH + 40) - 20;
    drop.y = -10 - Math.random() * 30;
    drop.speed = 3 + Math.random() * 3;
    drop.alpha = 0.2 + Math.random() * 0.4;
  }

  private updateFog(_delta: number, weather: WeatherType): void {
    const targetFog = weather === 'fog' ? 0.35 : 0;
    this.fogAlpha += (targetFog - this.fogAlpha) * 0.01;
  }

  private render(): void {
    // Rain
    this.rainGraphics.clear();
    if (this.rainDrops.length > 0) {
      for (const drop of this.rainDrops) {
        this.rainGraphics.lineStyle(1, COLORS.PALE_CLOUD, drop.alpha);
        const dx = Math.sin(this.windAngle) * drop.length;
        const dy = Math.cos(this.windAngle) * drop.length;
        this.rainGraphics.lineBetween(drop.x, drop.y, drop.x + dx, drop.y + dy);
      }
    }

    // Fog
    this.fogOverlay.clear();
    if (this.fogAlpha > 0.01) {
      this.fogOverlay.fillStyle(COLORS.PARCHMENT, this.fogAlpha);
      this.fogOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Layered fog wisps
      for (let i = 0; i < 3; i++) {
        const y = GAME_HEIGHT * (0.4 + i * 0.2);
        const alpha = this.fogAlpha * 0.5 * Math.sin(Date.now() * 0.0003 + i * 2);
        this.fogOverlay.fillStyle(COLORS.SOFT_WHITE, Math.max(0, alpha));
        this.fogOverlay.fillRect(0, y - 10, GAME_WIDTH, 20);
      }
    }
  }

  destroy(): void {
    this.rainGraphics.destroy();
    this.fogOverlay.destroy();
    this.splashEmitter?.destroy();
  }
}
