import Phaser from 'phaser';
import {
  PLAYER_SPEED,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  TILE_SIZE,
  DEPTH,
} from '../config/constants';
import { COLORS } from '../config/palette';

type Direction = 'down' | 'up' | 'left' | 'right';
type PlayerState = 'idle' | 'walk' | 'tool' | 'sit';

/**
 * Player entity with pixel-art sprite generation,
 * 4-directional movement, and tool-use animations.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;
  private direction: Direction = 'down';
  private state: PlayerState = 'idle';
  private moveVector = { x: 0, y: 0 };

  // Tool usage
  private toolTimer = 0;
  private currentTool: string | null = null;
  private speedMultiplier = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Generate player spritesheet if not already cached
    if (!scene.textures.exists('player')) {
      this.generatePlayerSprite();
    }

    this.sprite = scene.add.sprite(x, y, 'player', 0);
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setOrigin(0.5, 1); // anchor at feet

    this.createAnimations();
  }

  setMovement(x: number, y: number): void {
    this.moveVector.x = x;
    this.moveVector.y = y;
  }

  useTool(tool: string): void {
    if (this.state === 'tool') return;
    this.state = 'tool';
    this.currentTool = tool;
    this.toolTimer = 400; // ms
    this.sprite.play(`player_tool_${this.direction}`);
  }

  sit(): void {
    this.state = 'sit';
    this.sprite.play(`player_sit_${this.direction}`);
  }

  stand(): void {
    if (this.state === 'sit') {
      this.state = 'idle';
    }
  }

  setSpeedMultiplier(mult: number): void {
    this.speedMultiplier = mult;
  }

  get position(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get facing(): Direction {
    return this.direction;
  }

  get isSitting(): boolean {
    return this.state === 'sit';
  }

  get facingTile(): { x: number; y: number } {
    const px = Math.floor(this.sprite.x / TILE_SIZE);
    const py = Math.floor((this.sprite.y - PLAYER_HEIGHT / 2) / TILE_SIZE);
    switch (this.direction) {
      case 'up': return { x: px, y: py - 1 };
      case 'down': return { x: px, y: py + 1 };
      case 'left': return { x: px - 1, y: py };
      case 'right': return { x: px + 1, y: py };
    }
  }

  update(delta: number): void {
    // Tool use cooldown
    if (this.state === 'tool') {
      this.toolTimer -= delta;
      if (this.toolTimer <= 0) {
        this.state = 'idle';
        this.currentTool = null;
      }
      return; // can't move while using tool
    }

    if (this.state === 'sit') return; // can't move while sitting

    const isMoving = Math.abs(this.moveVector.x) > 0.1 || Math.abs(this.moveVector.y) > 0.1;

    if (isMoving) {
      // Determine direction from movement
      if (Math.abs(this.moveVector.x) > Math.abs(this.moveVector.y)) {
        this.direction = this.moveVector.x > 0 ? 'right' : 'left';
      } else {
        this.direction = this.moveVector.y > 0 ? 'down' : 'up';
      }

      // Normalize and apply speed
      const len = Math.sqrt(this.moveVector.x ** 2 + this.moveVector.y ** 2);
      const nx = this.moveVector.x / len;
      const ny = this.moveVector.y / len;

      this.sprite.x += nx * PLAYER_SPEED * this.speedMultiplier * (delta / 1000);
      this.sprite.y += ny * PLAYER_SPEED * this.speedMultiplier * (delta / 1000);

      if (this.state !== 'walk') {
        this.state = 'walk';
      }
      this.sprite.play(`player_walk_${this.direction}`, true);
    } else {
      if (this.state === 'walk') {
        this.state = 'idle';
      }
      this.sprite.play(`player_idle_${this.direction}`, true);
    }

    // Y-sort depth: entities lower on screen render on top
    this.sprite.setDepth(DEPTH.ENTITIES + this.sprite.y);
  }

  /**
   * Generate a pixel-art player spritesheet procedurally.
   * 16×32 frames, 4 directions × (4 walk + 2 idle + 3 tool + 2 sit) = 44 frames
   */
  private generatePlayerSprite(): void {
    const frameW = PLAYER_WIDTH;
    const frameH = PLAYER_HEIGHT;
    const directions: Direction[] = ['down', 'up', 'left', 'right'];
    const cols = 11;
    const rows = 4;

    const g = this.scene.add.graphics();

    for (let row = 0; row < rows; row++) {
      const dir = directions[row];

      for (let col = 0; col < cols; col++) {
        const ox = col * frameW;
        const oy = row * frameH;
        const isWalk = col >= 2 && col < 6;
        const walkFrame = col - 2;
        const isTool = col >= 6 && col < 9;
        const isSit = col >= 9;

        // Body offset for walk bobbing
        const bobY = isWalk ? Math.sin(walkFrame * Math.PI / 2) * -1 : 0;
        const sitY = isSit ? 4 : 0;

        // Head (4×4 pixels)
        g.fillStyle(COLORS.WARM_AMBER);
        g.fillRect(ox + 6, oy + 4 + bobY + sitY, 4, 4);

        // Hair
        g.fillStyle(COLORS.EARTH);
        if (dir === 'down') {
          g.fillRect(ox + 5, oy + 3 + bobY + sitY, 6, 2);
        } else if (dir === 'up') {
          g.fillRect(ox + 5, oy + 3 + bobY + sitY, 6, 3);
        } else {
          g.fillRect(ox + 6, oy + 3 + bobY + sitY, 4, 2);
          if (dir === 'left') g.fillRect(ox + 5, oy + 3 + bobY + sitY, 2, 3);
          else g.fillRect(ox + 9, oy + 3 + bobY + sitY, 2, 3);
        }

        // Eyes (only when facing down or sides)
        if (dir === 'down') {
          g.fillStyle(COLORS.VOID);
          g.fillRect(ox + 7, oy + 6 + bobY + sitY, 1, 1);
          g.fillRect(ox + 9, oy + 6 + bobY + sitY, 1, 1);
        } else if (dir === 'left') {
          g.fillStyle(COLORS.VOID);
          g.fillRect(ox + 6, oy + 6 + bobY + sitY, 1, 1);
        } else if (dir === 'right') {
          g.fillStyle(COLORS.VOID);
          g.fillRect(ox + 9, oy + 6 + bobY + sitY, 1, 1);
        }

        // Torso (6×6)
        g.fillStyle(COLORS.FOREST_GREEN);
        const torsoY = oy + 8 + bobY + sitY;
        g.fillRect(ox + 5, torsoY, 6, 6);

        // Arms
        if (isTool) {
          g.fillRect(ox + 3, torsoY - 2, 2, 4);
          g.fillRect(ox + 11, torsoY - 2, 2, 4);
        } else {
          const armSwing = isWalk ? Math.sin(walkFrame * Math.PI / 2) * 2 : 0;
          g.fillRect(ox + 3, torsoY + 1 + armSwing, 2, 4);
          g.fillRect(ox + 11, torsoY + 1 - armSwing, 2, 4);
        }

        if (!isSit) {
          // Legs (pants)
          g.fillStyle(COLORS.DARK_SLATE);
          const legY = torsoY + 6;
          const legSplit = isWalk ? Math.sin(walkFrame * Math.PI / 2) * 2 : 0;
          g.fillRect(ox + 5, legY, 3, 6 + legSplit);
          g.fillRect(ox + 8, legY, 3, 6 - legSplit);

          // Boots
          g.fillStyle(COLORS.EARTH);
          g.fillRect(ox + 5, legY + 5 + legSplit, 3, 2);
          g.fillRect(ox + 8, legY + 5 - legSplit, 3, 2);
        } else {
          // Sitting: legs tucked
          g.fillStyle(COLORS.DARK_SLATE);
          g.fillRect(ox + 4, torsoY + 6, 8, 3);
        }
      }
    }

    g.generateTexture('player', cols * frameW, rows * frameH);
    g.destroy();

    // Define spritesheet frames
    const texture = this.scene.textures.get('player');
    let frameIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        texture.add(frameIndex, 0, col * frameW, row * frameH, frameW, frameH);
        frameIndex++;
      }
    }
  }

  private createAnimations(): void {
    const directions: Direction[] = ['down', 'up', 'left', 'right'];
    const cols = 11;

    directions.forEach((dir, row) => {
      const base = row * cols;

      // Idle: frames 0-1
      this.scene.anims.create({
        key: `player_idle_${dir}`,
        frames: [{ key: 'player', frame: base }, { key: 'player', frame: base + 1 }],
        frameRate: 2,
        repeat: -1,
      });

      // Walk: frames 2-5
      this.scene.anims.create({
        key: `player_walk_${dir}`,
        frames: [
          { key: 'player', frame: base + 2 },
          { key: 'player', frame: base + 3 },
          { key: 'player', frame: base + 4 },
          { key: 'player', frame: base + 5 },
        ],
        frameRate: 8,
        repeat: -1,
      });

      // Tool: frames 6-8
      this.scene.anims.create({
        key: `player_tool_${dir}`,
        frames: [
          { key: 'player', frame: base + 6 },
          { key: 'player', frame: base + 7 },
          { key: 'player', frame: base + 8 },
        ],
        frameRate: 6,
        repeat: 0,
      });

      // Sit: frames 9-10
      this.scene.anims.create({
        key: `player_sit_${dir}`,
        frames: [{ key: 'player', frame: base + 9 }, { key: 'player', frame: base + 10 }],
        frameRate: 2,
        repeat: -1,
      });
    });
  }
}
