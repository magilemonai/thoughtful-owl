import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/constants';
import { COLORS } from '../config/palette';

interface InventorySlot {
  id: string;
  name: string;
  count: number;
  color: number;
}

/**
 * Simple inventory overlay — shows collected seeds and harvested items.
 * Toggled by tapping the inventory icon on HUD.
 */
export class InventoryUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private slots: InventorySlot[] = [];
  private isOpen = false;
  private targetAlpha = 0;
  private currentAlpha = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI + 10);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);

    this.background = scene.add.graphics();
    this.container.add(this.background);
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.targetAlpha = this.isOpen ? 1 : 0;
    if (this.isOpen) {
      this.render();
    }
  }

  close(): void {
    this.isOpen = false;
    this.targetAlpha = 0;
  }

  setItems(inventory: Map<string, number>): void {
    this.slots = [];
    for (const [id, count] of inventory) {
      if (count > 0) {
        this.slots.push({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          count,
          color: COLORS.PARCHMENT,
        });
      }
    }
    if (this.isOpen) this.render();
  }

  update(): void {
    this.currentAlpha += (this.targetAlpha - this.currentAlpha) * 0.1;
    this.container.setAlpha(this.currentAlpha);
  }

  private render(): void {
    // Clear previous
    this.container.removeAll(true);

    this.background = this.scene.add.graphics();
    this.container.add(this.background);

    const panelW = 120;
    const panelH = Math.min(140, 20 + this.slots.length * 14);
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;

    // Panel background
    this.background.fillStyle(COLORS.MIDNIGHT, 0.9);
    this.background.fillRoundedRect(panelX, panelY, panelW, panelH, 3);
    this.background.lineStyle(1, COLORS.MUTED_SKY, 0.4);
    this.background.strokeRoundedRect(panelX, panelY, panelW, panelH, 3);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, panelY + 8, 'Seeds & Harvest', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    this.container.add(title);

    // Slots
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const sy = panelY + 20 + i * 14;

      const nameText = this.scene.add.text(panelX + 8, sy, slot.name, {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: `#${COLORS.WARM_GREY.toString(16).padStart(6, '0')}`,
      });
      this.container.add(nameText);

      const countText = this.scene.add.text(panelX + panelW - 8, sy, `×${slot.count}`, {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: `#${COLORS.PALE_GOLD.toString(16).padStart(6, '0')}`,
      }).setOrigin(1, 0);
      this.container.add(countText);
    }

    if (this.slots.length === 0) {
      const emptyText = this.scene.add.text(GAME_WIDTH / 2, panelY + panelH / 2 + 4, 'Nothing yet...', {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: `#${COLORS.STONE_GREY.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5);
      this.container.add(emptyText);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
