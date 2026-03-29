import Phaser from 'phaser';
import { GAME_WIDTH, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';
import { TimeState } from '../systems/TimeSystem';
import { Season } from '../config/palette';

/**
 * Minimal mobile HUD showing day, season, and tool selection.
 * Designed to be unobtrusive — fades out during Ma moments.
 */
export class HUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private dayText: Phaser.GameObjects.Text;
  private seasonText: Phaser.GameObjects.Text;
  private toolIcons: Phaser.GameObjects.Graphics;
  private selectedTool = 0;
  private alpha = 1;
  private targetAlpha = 1;

  private readonly tools = ['hoe', 'water', 'seed'];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    // Day indicator (top left)
    this.dayText = scene.add.text(4, 3, 'Day 1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: `#${COLORS.SOFT_WHITE.toString(16)}`,
      shadow: {
        offsetX: 1,
        offsetY: 1,
        color: '#000',
        blur: 0,
        fill: true,
        stroke: false,
      },
    });
    this.container.add(this.dayText);

    // Season indicator (top left, below day)
    this.seasonText = scene.add.text(4, 13, 'Spring', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: `#${COLORS.PALE_GREEN.toString(16)}`,
      shadow: {
        offsetX: 1,
        offsetY: 1,
        color: '#000',
        blur: 0,
        fill: true,
        stroke: false,
      },
    });
    this.container.add(this.seasonText);

    // Tool selector (bottom right)
    this.toolIcons = scene.add.graphics();
    this.container.add(this.toolIcons);

    this.renderTools();
  }

  updateTime(state: TimeState): void {
    this.dayText.setText(`Day ${state.day}`);

    const seasonName = state.season.charAt(0).toUpperCase() + state.season.slice(1);
    this.seasonText.setText(`${seasonName} - Day ${state.seasonDay}`);

    const seasonColors: Record<Season, number> = {
      spring: COLORS.PALE_GREEN,
      summer: COLORS.GOLDEN_WHEAT,
      autumn: COLORS.SUNSET_ORANGE,
      winter: COLORS.LIGHT_SKY,
    };
    this.seasonText.setColor(`#${seasonColors[state.season].toString(16).padStart(6, '0')}`);
  }

  selectTool(index: number): void {
    this.selectedTool = index % this.tools.length;
    this.renderTools();
  }

  nextTool(): void {
    this.selectTool(this.selectedTool + 1);
  }

  get currentTool(): string {
    return this.tools[this.selectedTool];
  }

  fadeOut(): void {
    this.targetAlpha = 0;
  }

  fadeIn(): void {
    this.targetAlpha = 1;
  }

  update(): void {
    this.alpha += (this.targetAlpha - this.alpha) * 0.05;
    this.container.setAlpha(this.alpha);
  }

  private renderTools(): void {
    this.toolIcons.clear();

    const startX = GAME_WIDTH - 56;
    const y = 4;
    const size = 14;
    const gap = 3;

    for (let i = 0; i < this.tools.length; i++) {
      const x = startX + i * (size + gap);

      // Background
      const isSelected = i === this.selectedTool;
      this.toolIcons.fillStyle(
        isSelected ? COLORS.SOFT_WHITE : COLORS.DARK_SLATE,
        isSelected ? 0.3 : 0.2
      );
      this.toolIcons.fillRoundedRect(x, y, size, size, 2);

      if (isSelected) {
        this.toolIcons.lineStyle(1, COLORS.SOFT_WHITE, 0.5);
        this.toolIcons.strokeRoundedRect(x, y, size, size, 2);
      }

      // Tool icon (simplified pixel icons)
      const iconColor = isSelected ? COLORS.SOFT_WHITE : COLORS.WARM_GREY;
      this.toolIcons.fillStyle(iconColor, 0.9);

      switch (this.tools[i]) {
        case 'hoe':
          // Hoe shape
          this.toolIcons.fillRect(x + 6, y + 2, 2, 8);
          this.toolIcons.fillRect(x + 3, y + 10, 8, 2);
          break;
        case 'water':
          // Watering can shape
          this.toolIcons.fillRect(x + 4, y + 5, 6, 5);
          this.toolIcons.fillRect(x + 3, y + 4, 4, 2);
          this.toolIcons.fillRect(x + 9, y + 6, 2, 1);
          break;
        case 'seed':
          // Seed bag
          this.toolIcons.fillRect(x + 4, y + 4, 6, 7);
          this.toolIcons.fillRect(x + 5, y + 3, 4, 2);
          this.toolIcons.fillStyle(COLORS.GOLDEN_WHEAT, 0.8);
          this.toolIcons.fillRect(x + 6, y + 7, 2, 2);
          break;
      }
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
