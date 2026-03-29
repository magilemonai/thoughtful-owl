import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';
import { TimeState } from '../systems/TimeSystem';
import { Season } from '../config/palette';
import { CropData } from '../entities/Crop';

/**
 * Minimal mobile HUD showing day, season, tool/seed selection, and farm status.
 * Fades during Ma moments. Tap tool icons to switch tools,
 * tap seed area to cycle available seeds.
 */
export class HUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private dayText: Phaser.GameObjects.Text;
  private seasonText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private toolGraphics: Phaser.GameObjects.Graphics;
  private seedInfoText: Phaser.GameObjects.Text;
  private selectedTool = 0;
  private selectedSeedIdx = 0;
  private availableSeeds: CropData[] = [];
  private alpha = 1;
  private targetAlpha = 1;

  private readonly tools = ['hoe', 'water', 'seed'];

  // Farm status
  private needsWater = 0;
  private readyToHarvest = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    const textShadow = {
      offsetX: 1, offsetY: 1, color: '#000', blur: 0, fill: true, stroke: false,
    };

    // Day indicator (top left)
    this.dayText = scene.add.text(4, 3, 'Day 1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: `#${COLORS.SOFT_WHITE.toString(16).padStart(6, '0')}`,
      shadow: textShadow,
    });
    this.container.add(this.dayText);

    // Season (below day)
    this.seasonText = scene.add.text(4, 13, 'Spring', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: `#${COLORS.PALE_GREEN.toString(16).padStart(6, '0')}`,
      shadow: textShadow,
    });
    this.container.add(this.seasonText);

    // Farm status (top center-right)
    this.statusText = scene.add.text(GAME_WIDTH - 4, 22, '', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`,
      shadow: textShadow,
      align: 'right',
    });
    this.statusText.setOrigin(1, 0);
    this.container.add(this.statusText);

    // Seed info (below tools)
    this.seedInfoText = scene.add.text(GAME_WIDTH - 4, 20, '', {
      fontFamily: 'monospace',
      fontSize: '5px',
      color: `#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`,
      shadow: textShadow,
      align: 'right',
    });
    this.seedInfoText.setOrigin(1, 0);
    this.seedInfoText.setAlpha(0);
    this.container.add(this.seedInfoText);

    // Tool selector (top right)
    this.toolGraphics = scene.add.graphics();
    this.container.add(this.toolGraphics);

    this.renderTools();
    this.setupToolInput();
  }

  updateTime(state: TimeState): void {
    this.dayText.setText(`Day ${state.day}`);
    const seasonName = state.season.charAt(0).toUpperCase() + state.season.slice(1);
    this.seasonText.setText(`${seasonName} ${state.seasonDay}/4`);

    const seasonColors: Record<Season, number> = {
      spring: COLORS.PALE_GREEN,
      summer: COLORS.GOLDEN_WHEAT,
      autumn: COLORS.SUNSET_ORANGE,
      winter: COLORS.LIGHT_SKY,
    };
    this.seasonText.setColor(`#${seasonColors[state.season].toString(16).padStart(6, '0')}`);
  }

  updateFarmStatus(needsWater: number, readyToHarvest: number): void {
    this.needsWater = needsWater;
    this.readyToHarvest = readyToHarvest;

    const parts: string[] = [];
    if (readyToHarvest > 0) {
      parts.push(`${readyToHarvest} ready`);
    }
    if (needsWater > 0) {
      parts.push(`${needsWater} thirsty`);
    }
    this.statusText.setText(parts.join(' | '));

    // Color code urgency
    if (readyToHarvest > 0) {
      this.statusText.setColor(`#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`);
    } else if (needsWater > 0) {
      this.statusText.setColor(`#${COLORS.LIGHT_SKY.toString(16).padStart(6, '0')}`);
    } else {
      this.statusText.setColor(`#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`);
    }
  }

  setAvailableSeeds(seeds: CropData[], inventory: Map<string, number>): void {
    this.availableSeeds = seeds.filter(s => (inventory.get(s.id) || 0) > 0);
    if (this.selectedSeedIdx >= this.availableSeeds.length) {
      this.selectedSeedIdx = 0;
    }
    this.updateSeedInfo(inventory);
  }

  get currentTool(): string {
    return this.tools[this.selectedTool];
  }

  get currentSeed(): CropData | null {
    if (this.availableSeeds.length === 0) return null;
    return this.availableSeeds[this.selectedSeedIdx];
  }

  selectTool(index: number): void {
    this.selectedTool = ((index % this.tools.length) + this.tools.length) % this.tools.length;
    this.renderTools();
    this.seedInfoText.setAlpha(this.selectedTool === 2 ? 0.8 : 0);
  }

  nextTool(): void {
    this.selectTool(this.selectedTool + 1);
  }

  cycleSeed(): void {
    if (this.availableSeeds.length <= 1) return;
    this.selectedSeedIdx = (this.selectedSeedIdx + 1) % this.availableSeeds.length;
    this.renderTools();
  }

  fadeOut(): void { this.targetAlpha = 0; }
  fadeIn(): void { this.targetAlpha = 1; }

  /** Hide tool bar for winter — only day/season text remains */
  setWinterMode(on: boolean): void {
    this.toolGraphics.setVisible(!on);
    this.seedInfoText.setVisible(!on);
  }

  update(): void {
    this.alpha += (this.targetAlpha - this.alpha) * 0.05;
    this.container.setAlpha(this.alpha);
  }

  private updateSeedInfo(inventory: Map<string, number>): void {
    if (this.availableSeeds.length === 0) {
      this.seedInfoText.setText('no seeds');
      return;
    }
    const seed = this.availableSeeds[this.selectedSeedIdx];
    const count = inventory.get(seed.id) || 0;
    this.seedInfoText.setText(`${seed.name} x${count}`);
  }

  private setupToolInput(): void {
    // Tool selection via tap on tool icons area
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const scale = this.scene.scale.zoom || 1;
      const px = pointer.x / scale;
      const py = pointer.y / scale;

      const startX = GAME_WIDTH - 56;
      const toolY = 4;
      const size = 14;
      const gap = 3;

      // Check if tap is in tool area
      if (py >= toolY && py <= toolY + size) {
        for (let i = 0; i < this.tools.length; i++) {
          const x = startX + i * (size + gap);
          if (px >= x && px <= x + size) {
            if (i === 2 && this.selectedTool === 2) {
              // Already on seed tool — cycle seeds instead
              this.cycleSeed();
            } else {
              this.selectTool(i);
            }
            return;
          }
        }
      }
    });
  }

  private renderTools(): void {
    this.toolGraphics.clear();

    const startX = GAME_WIDTH - 56;
    const y = 4;
    const size = 14;
    const gap = 3;

    for (let i = 0; i < this.tools.length; i++) {
      const x = startX + i * (size + gap);
      const isSelected = i === this.selectedTool;

      // Background
      this.toolGraphics.fillStyle(
        isSelected ? COLORS.SOFT_WHITE : COLORS.DARK_SLATE,
        isSelected ? 0.3 : 0.2
      );
      this.toolGraphics.fillRoundedRect(x, y, size, size, 2);

      if (isSelected) {
        this.toolGraphics.lineStyle(1, COLORS.SOFT_WHITE, 0.5);
        this.toolGraphics.strokeRoundedRect(x, y, size, size, 2);
      }

      const iconColor = isSelected ? COLORS.SOFT_WHITE : COLORS.WARM_GREY;
      this.toolGraphics.fillStyle(iconColor, 0.9);

      switch (this.tools[i]) {
        case 'hoe':
          this.toolGraphics.fillRect(x + 6, y + 2, 2, 8);
          this.toolGraphics.fillRect(x + 3, y + 10, 8, 2);
          break;
        case 'water':
          this.toolGraphics.fillRect(x + 4, y + 5, 6, 5);
          this.toolGraphics.fillRect(x + 3, y + 4, 4, 2);
          this.toolGraphics.fillRect(x + 9, y + 6, 2, 1);
          // Water drop
          this.toolGraphics.fillStyle(COLORS.LIGHT_SKY, 0.6);
          this.toolGraphics.fillRect(x + 10, y + 8, 1, 2);
          break;
        case 'seed':
          this.toolGraphics.fillRect(x + 4, y + 4, 6, 7);
          this.toolGraphics.fillRect(x + 5, y + 3, 4, 2);
          // Show seed color if available
          if (this.currentSeed && isSelected) {
            const seedColor = this.currentSeed.colors[3]; // harvest color
            this.toolGraphics.fillStyle(seedColor, 0.9);
          } else {
            this.toolGraphics.fillStyle(COLORS.GOLDEN_WHEAT, 0.8);
          }
          this.toolGraphics.fillRect(x + 6, y + 7, 2, 2);
          break;
      }

      // Notification dots
      if (i === 1 && this.needsWater > 0) {
        // Blue dot on water tool
        this.toolGraphics.fillStyle(COLORS.LIGHT_SKY, 0.8);
        this.toolGraphics.fillCircle(x + size - 2, y + 2, 2);
      }
      if (i === 2 && this.readyToHarvest > 0) {
        // Gold dot on seed tool (also used for harvesting)
        this.toolGraphics.fillStyle(COLORS.PALE_GOLD, 0.8);
        this.toolGraphics.fillCircle(x + size - 2, y + 2, 2);
      }
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
