import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  JOYSTICK_RADIUS,
  JOYSTICK_DEAD_ZONE,
  TAP_THRESHOLD_MS,
  TAP_THRESHOLD_DISTANCE,
  DEPTH,
} from '../config/constants';
import { COLORS } from '../config/palette';

export interface TouchInput {
  moveX: number;  // -1 to 1
  moveY: number;  // -1 to 1
  tapped: boolean;
  tapX: number;
  tapY: number;
}

/**
 * Mobile-first virtual joystick + tap-to-interact system.
 * Left side of screen: joystick for movement.
 * Right side / tap: interact with world.
 */
export class TouchControls {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  // Joystick state
  private joystickActive = false;
  private joystickBaseX = 0;
  private joystickBaseY = 0;
  private joystickX = 0;
  private joystickY = 0;
  private joystickPointerId: number = -1;

  // Tap detection
  private tapStartTime = 0;
  private tapStartX = 0;
  private tapStartY = 0;
  private tapped = false;
  private tapWorldX = 0;
  private tapWorldY = 0;

  // Keyboard fallback (for desktop testing)
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keySpace: Phaser.Input.Keyboard.Key | null = null;

  // Output
  readonly input: TouchInput = { moveX: 0, moveY: 0, tapped: false, tapX: 0, tapY: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTH.UI);
    this.graphics.setScrollFactor(0);

    this.setupTouch();
    this.setupKeyboard();
  }

  private setupTouch(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Left half = joystick
      if (pointer.x < GAME_WIDTH * this.scene.scale.zoom * 0.5) {
        if (!this.joystickActive) {
          this.joystickActive = true;
          this.joystickBaseX = pointer.x;
          this.joystickBaseY = pointer.y;
          this.joystickX = pointer.x;
          this.joystickY = pointer.y;
          this.joystickPointerId = pointer.id;
        }
      } else {
        // Right half = potential tap
        this.tapStartTime = Date.now();
        this.tapStartX = pointer.x;
        this.tapStartY = pointer.y;
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive && pointer.id === this.joystickPointerId) {
        this.joystickX = pointer.x;
        this.joystickY = pointer.y;

        // Dynamic base drift — if finger exceeds radius, base follows
        const dx = this.joystickX - this.joystickBaseX;
        const dy = this.joystickY - this.joystickBaseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > JOYSTICK_RADIUS * 1.3) {
          const angle = Math.atan2(dy, dx);
          this.joystickBaseX = this.joystickX - Math.cos(angle) * JOYSTICK_RADIUS;
          this.joystickBaseY = this.joystickY - Math.sin(angle) * JOYSTICK_RADIUS;
        }
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive && pointer.id === this.joystickPointerId) {
        this.joystickActive = false;
        this.joystickPointerId = -1;
      } else {
        // Check if it was a tap
        const elapsed = Date.now() - this.tapStartTime;
        const dx = pointer.x - this.tapStartX;
        const dy = pointer.y - this.tapStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (elapsed < TAP_THRESHOLD_MS && dist < TAP_THRESHOLD_DISTANCE) {
          this.tapped = true;
          this.tapWorldX = pointer.worldX;
          this.tapWorldY = pointer.worldY;

          // Haptic feedback on mobile (where supported)
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        }
      }
    });
  }

  private setupKeyboard(): void {
    if (this.scene.input.keyboard) {
      this.cursors = this.scene.input.keyboard.createCursorKeys();
      this.keySpace = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
  }

  update(): void {
    // Reset tap (consumed per frame)
    this.input.tapped = this.tapped;
    this.input.tapX = this.tapWorldX;
    this.input.tapY = this.tapWorldY;
    this.tapped = false;

    // Joystick movement
    if (this.joystickActive) {
      const dx = this.joystickX - this.joystickBaseX;
      const dy = this.joystickY - this.joystickBaseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > JOYSTICK_DEAD_ZONE) {
        const clamped = Math.min(dist, JOYSTICK_RADIUS);
        this.input.moveX = (dx / dist) * (clamped / JOYSTICK_RADIUS);
        this.input.moveY = (dy / dist) * (clamped / JOYSTICK_RADIUS);
      } else {
        this.input.moveX = 0;
        this.input.moveY = 0;
      }
    } else {
      this.input.moveX = 0;
      this.input.moveY = 0;
    }

    // Keyboard override
    if (this.cursors) {
      if (this.cursors.left.isDown) this.input.moveX = -1;
      if (this.cursors.right.isDown) this.input.moveX = 1;
      if (this.cursors.up.isDown) this.input.moveY = -1;
      if (this.cursors.down.isDown) this.input.moveY = 1;
    }
    if (this.keySpace?.isDown) {
      this.input.tapped = true;
      // Tap position = player facing tile (handled by GameScene)
    }

    this.render();
  }

  private render(): void {
    this.graphics.clear();

    if (this.joystickActive) {
      const scale = this.scene.scale.zoom || 1;
      const bx = this.joystickBaseX / scale;
      const by = this.joystickBaseY / scale;
      const jx = this.joystickX / scale;
      const jy = this.joystickY / scale;

      // Base circle
      this.graphics.lineStyle(1, COLORS.SOFT_WHITE, 0.2);
      this.graphics.strokeCircle(bx, by, JOYSTICK_RADIUS);

      // Thumb position
      const dx = jx - bx;
      const dy = jy - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      const thumbX = bx + Math.cos(angle) * clampedDist;
      const thumbY = by + Math.sin(angle) * clampedDist;

      this.graphics.fillStyle(COLORS.SOFT_WHITE, 0.3);
      this.graphics.fillCircle(thumbX, thumbY, 8);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
