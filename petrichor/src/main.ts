import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, MAX_SCALE } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { SunsetScene } from './scenes/SunsetScene';
import { RunTransitionScene } from './scenes/RunTransitionScene';

/**
 * Petrichor — A Pastoral Loop Game
 *
 * Mobile-first, pixel-art farming game with
 * roguelike loops, spirit coexistence, and
 * moments of earned stillness.
 */

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WEBGL preferred, Canvas fallback for mobile
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: document.body,

  // Pixel-perfect rendering
  pixelArt: true,
  roundPixels: true,
  antialias: false,

  // Scale to fit mobile screens
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    max: {
      width: GAME_WIDTH * MAX_SCALE,
      height: GAME_HEIGHT * MAX_SCALE,
    },
  },

  // WebGL with canvas fallback
  render: {
    pixelArt: true,
    transparent: false,
    antialiasGL: false,
  },

  // Audio
  audio: {
    disableWebAudio: false,
  },

  // Physics (lightweight — we don't need much)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },

  // Scenes
  scene: [BootScene, TitleScene, GameScene, SunsetScene, RunTransitionScene],

  // Input
  input: {
    activePointers: 3, // support multi-touch
    touch: {
      capture: true,
    },
  },

  // Background color (deep night — shows during transitions)
  backgroundColor: '#0d0b0e',

  // Callbacks
  callbacks: {
    postBoot: (game: Phaser.Game) => {
      // Prevent context menu on mobile long-press
      game.canvas.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault();
      });

      // Handle visibility change (pause when hidden)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          game.scene.scenes.forEach(scene => {
            if (scene.scene.isActive()) {
              scene.scene.pause();
            }
          });
        } else {
          game.scene.scenes.forEach(scene => {
            if (scene.scene.isPaused()) {
              scene.scene.resume();
            }
          });
        }
      });
    },
  },
};

// Launch
new Phaser.Game(config);
