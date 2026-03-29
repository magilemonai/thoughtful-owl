import Phaser from 'phaser';
import { TimeOfDayProfile, SEASON_MODIFIERS, Season } from '../config/palette';

/**
 * Full-screen post-processing pipeline for time-of-day color grading.
 * Applies tint, brightness, saturation, and vignette via a single shader pass.
 */
export class PaletteShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private currentTint = { r: 1, g: 1, b: 1 };
  private targetTint = { r: 1, g: 1, b: 1 };
  private currentBrightness = 1;
  private targetBrightness = 1;
  private currentSaturation = 1;
  private targetSaturation = 1;
  private vignetteStrength = 0.3;
  private lerpSpeed = 0.02;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'PaletteGrade' as string,
      fragShader: `
        precision mediump float;

        uniform sampler2D uMainSampler;
        uniform vec3 uTint;
        uniform float uBrightness;
        uniform float uSaturation;
        uniform float uVignetteStrength;

        varying vec2 outTexCoord;

        void main() {
            vec4 color = texture2D(uMainSampler, outTexCoord);
            color.rgb *= uTint;
            color.rgb *= uBrightness;
            float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(luma), color.rgb, uSaturation);
            vec2 center = outTexCoord - 0.5;
            float dist = length(center);
            float vignette = 1.0 - smoothstep(0.3, 0.75, dist) * uVignetteStrength;
            color.rgb *= vignette;
            color.rgb = clamp(color.rgb, 0.0, 1.0);
            gl_FragColor = color;
        }
      `,
    });
  }

  setTimeProfile(profile: TimeOfDayProfile, season?: Season): void {
    this.targetTint.r = profile.tint.r;
    this.targetTint.g = profile.tint.g;
    this.targetTint.b = profile.tint.b;
    this.targetBrightness = profile.brightness;
    this.targetSaturation = profile.saturation;

    if (season) {
      const mod = SEASON_MODIFIERS[season];
      this.targetTint.r += mod.tintShift.r;
      this.targetTint.g += mod.tintShift.g;
      this.targetTint.b += mod.tintShift.b;
      this.targetSaturation *= mod.saturation;
    }
  }

  setLerpSpeed(speed: number): void {
    this.lerpSpeed = speed;
  }

  setVignette(strength: number): void {
    this.vignetteStrength = strength;
  }

  onPreRender(): void {
    const lerp = this.lerpSpeed;
    this.currentTint.r += (this.targetTint.r - this.currentTint.r) * lerp;
    this.currentTint.g += (this.targetTint.g - this.currentTint.g) * lerp;
    this.currentTint.b += (this.targetTint.b - this.currentTint.b) * lerp;
    this.currentBrightness += (this.targetBrightness - this.currentBrightness) * lerp;
    this.currentSaturation += (this.targetSaturation - this.currentSaturation) * lerp;

    this.set1f('uBrightness', this.currentBrightness);
    this.set1f('uSaturation', this.currentSaturation);
    this.set1f('uVignetteStrength', this.vignetteStrength);
    this.set3f('uTint', this.currentTint.r, this.currentTint.g, this.currentTint.b);
  }
}
