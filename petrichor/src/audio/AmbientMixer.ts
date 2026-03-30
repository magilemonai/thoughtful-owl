import Phaser from 'phaser';
import { TimeOfDay, Season } from '../config/palette';

interface AmbientLayer {
  key: string;
  sound: Phaser.Sound.BaseSound | null;
  baseVolume: number;
  currentVolume: number;
  targetVolume: number;
  loop: boolean;
}

/**
 * Dynamic ambient audio system.
 * Crossfades between layered ambient sounds based on
 * time of day, weather, and season.
 */
export class AmbientMixer {
  private scene: Phaser.Scene;
  private layers: Map<string, AmbientLayer> = new Map();
  private masterVolume = 0.7;
  private fadeSpeed = 0.02;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Register an ambient layer. Doesn't play it yet.
   */
  registerLayer(key: string, baseVolume: number = 0.5): void {
    this.layers.set(key, {
      key,
      sound: null,
      baseVolume,
      currentVolume: 0,
      targetVolume: 0,
      loop: true,
    });
  }

  /**
   * Set target volume for a layer (0 = silent, 1 = full baseVolume)
   */
  setLayerTarget(key: string, target: number): void {
    const layer = this.layers.get(key);
    if (layer) {
      layer.targetVolume = Math.max(0, Math.min(1, target));
    }
  }

  /**
   * Configure layers based on current time of day
   */
  setTimeOfDay(time: TimeOfDay, season: Season): void {
    // Wind - always present, varies by time
    this.setLayerTarget('wind', time === 'night' || time === 'deepNight' ? 0.3 : 0.5);

    // Birds - morning/afternoon only, not in winter
    const birdVolume = season === 'winter' ? 0.1 :
      (time === 'morning' || time === 'afternoon') ? 0.7 :
      (time === 'dawn' || time === 'goldenHour') ? 0.4 : 0;
    this.setLayerTarget('birds', birdVolume);

    // Crickets - evening/night
    const cricketVolume = (time === 'dusk' || time === 'night' || time === 'deepNight') ? 0.6 :
      time === 'dawn' ? 0.3 : 0;
    this.setLayerTarget('crickets', season === 'winter' ? 0 : cricketVolume);

    // Water - constant if near river (handled externally)
    // Fire - night only (handled externally)
  }

  /**
   * Set weather-related audio
   */
  setWeather(weather: string): void {
    this.setLayerTarget('rain_light', weather === 'rain_light' ? 0.8 : 0);
    this.setLayerTarget('rain_heavy', weather === 'rain_heavy' || weather === 'storm' ? 1.0 : 0);
    this.setLayerTarget('thunder', weather === 'storm' ? 0.6 : 0);
  }

  update(): void {
    for (const layer of this.layers.values()) {
      // Fade towards target
      const diff = layer.targetVolume - layer.currentVolume;
      if (Math.abs(diff) < 0.01) {
        layer.currentVolume = layer.targetVolume;
      } else {
        layer.currentVolume += diff * this.fadeSpeed;
      }

      const effectiveVolume = layer.currentVolume * layer.baseVolume * this.masterVolume;

      try {
        if (effectiveVolume > 0.01) {
          if (!layer.sound) {
            if (this.scene.cache.audio.exists(layer.key)) {
              layer.sound = this.scene.sound.add(layer.key, {
                loop: layer.loop,
                volume: effectiveVolume,
              });
              layer.sound.play();
            }
          } else if (layer.sound.isPlaying) {
            (layer.sound as any).setVolume?.(effectiveVolume);
          }
        } else if (layer.sound) {
          layer.sound.stop();
          layer.sound.destroy();
          layer.sound = null;
        }
      } catch {
        // Audio may fail on some mobile devices — continue silently
        layer.sound = null;
      }
    }
  }

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Generate procedural ambient sounds using Web Audio API.
   * Call this during boot to create audio assets without files.
   */
  static generateProceduralAudio(scene: Phaser.Scene): void {
    const audioContext = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (!audioContext) return;

    // Generate wind noise
    AmbientMixer.generateNoiseBuffer(scene, 'wind', 3, 'pink', 0.3);

    // Generate rain sounds
    AmbientMixer.generateNoiseBuffer(scene, 'rain_light', 2, 'white', 0.15);
    AmbientMixer.generateNoiseBuffer(scene, 'rain_heavy', 2, 'white', 0.4);

    // Generate cricket-like chirps
    AmbientMixer.generateCricketBuffer(scene, 'crickets', 4);

    // Generate bird-like calls
    AmbientMixer.generateBirdBuffer(scene, 'birds', 4);

    // Thunder rumble
    AmbientMixer.generateThunderBuffer(scene, 'thunder', 3);
  }

  private static generateNoiseBuffer(
    scene: Phaser.Scene,
    key: string,
    duration: number,
    type: 'white' | 'pink',
    amplitude: number
  ): void {
    const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11 * amplitude;
        b6 = white * 0.115926;
      } else {
        data[i] = white * amplitude;
      }
    }

    // Apply fade in/out
    const fadeSamples = sampleRate * 0.5;
    for (let i = 0; i < fadeSamples && i < length; i++) {
      const t = i / fadeSamples;
      data[i] *= t;
      data[length - 1 - i] *= t;
    }

    scene.cache.audio.add(key, { data: buffer } as unknown as HTMLAudioElement);
  }

  private static generateCricketBuffer(scene: Phaser.Scene, key: string, duration: number): void {
    const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Chirp pattern: short bursts at ~4500Hz
      const chirpFreq = 4500;
      const chirpRate = 5; // chirps per second
      const chirpEnv = Math.max(0, Math.sin(t * chirpRate * Math.PI * 2)) > 0.7 ? 1 : 0;
      const signal = Math.sin(t * chirpFreq * Math.PI * 2) * chirpEnv * 0.08;

      // Add slight randomization
      data[i] = signal * (0.8 + Math.random() * 0.2);
    }

    scene.cache.audio.add(key, { data: buffer } as unknown as HTMLAudioElement);
  }

  private static generateBirdBuffer(scene: Phaser.Scene, key: string, duration: number): void {
    const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Warbling tone that sweeps frequency
      const baseFreq = 2000 + Math.sin(t * 3) * 800;
      const warble = Math.sin(t * baseFreq * Math.PI * 2);
      // Intermittent calls
      const callPattern = Math.sin(t * 0.8) > 0.5 ? 1 : 0;
      const envelope = callPattern * Math.max(0, Math.sin(t * 4 * Math.PI));
      data[i] = warble * envelope * 0.06;
    }

    scene.cache.audio.add(key, { data: buffer } as unknown as HTMLAudioElement);
  }

  private static generateThunderBuffer(scene: Phaser.Scene, key: string, duration: number): void {
    const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Low rumble with exponential decay
      const noise = Math.random() * 2 - 1;
      const decay = Math.exp(-t * 1.5);
      const lowPass = Math.sin(t * 60 * Math.PI * 2) * 0.3;
      data[i] = (noise * 0.5 + lowPass) * decay * 0.4;
    }

    scene.cache.audio.add(key, { data: buffer } as unknown as HTMLAudioElement);
  }

  destroy(): void {
    for (const layer of this.layers.values()) {
      if (layer.sound) {
        layer.sound.stop();
        layer.sound.destroy();
      }
    }
    this.layers.clear();
  }
}
