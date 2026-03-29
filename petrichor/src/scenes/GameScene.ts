import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  MAP_WIDTH_TILES,
  MAP_HEIGHT_TILES,
  MAP_WIDTH,
  MAP_HEIGHT,
  DAYS_PER_SEASON,
  CAMERA_LERP,
  CAMERA_BREATHE_AMPLITUDE,
  CAMERA_BREATHE_PERIOD,
  DEPTH,
} from '../config/constants';
import { COLORS, TIME_PROFILES, Season, TimeOfDay } from '../config/palette';
import { Player } from '../entities/Player';
import { Mote } from '../entities/Mote';
import { CROP_CATALOG, CropData } from '../entities/Crop';
import { TimeSystem } from '../systems/TimeSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { WindSystem } from '../systems/WindSystem';
import { ExplorationSystem } from '../systems/ExplorationSystem';
import { SpiritSystem } from '../systems/SpiritSystem';
import { MaSystem, MaMomentType } from '../systems/MaSystem';
import { TouchControls } from '../ui/TouchControls';
import { HUD } from '../ui/HUD';
import { ParallaxManager } from '../rendering/ParallaxManager';
import { WeatherRenderer, WeatherType } from '../rendering/WeatherRenderer';
import { PaletteShader } from '../rendering/PaletteShader';
import { AmbientMixer } from '../audio/AmbientMixer';
import { ProgressionSystem } from '../systems/ProgressionSystem';

/**
 * Main gameplay scene.
 * Integrates farming, weather, wind, spirits, and the day/night cycle.
 */
export class GameScene extends Phaser.Scene {
  // Core systems
  private timeSystem!: TimeSystem;
  private farmingSystem!: FarmingSystem;
  private windSystem!: WindSystem;
  private explorationSystem!: ExplorationSystem;
  private spiritSystem!: SpiritSystem;
  private maSystem!: MaSystem;
  private touchControls!: TouchControls;
  private hud!: HUD;
  private parallax!: ParallaxManager;
  private weather!: WeatherRenderer;
  private ambientMixer!: AmbientMixer;

  // Entities
  private player!: Player;
  private motes: Mote[] = [];

  // Run counter (for procedural generation seeds)
  private runNumber = 1;

  // Terrain
  private terrainLayer!: Phaser.Tilemaps.TilemapLayer;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private treeSprites: Phaser.GameObjects.Image[] = [];
  private objectSprites: Phaser.GameObjects.Image[] = [];

  // Sky
  private skyGraphics!: Phaser.GameObjects.Graphics;

  // Camera
  private cameraBreathTime = 0;

  // Inventory
  private inventory: Map<string, number> = new Map();

  // Weather scheduling
  private weatherSchedule: Array<{ day: number; time: number; type: WeatherType; duration: number }> = [];
  private activeWeatherTimer: Phaser.Time.TimerEvent | null = null;
  private wasRainingToday = false;

  // Interaction cooldown (prevent rapid-fire)
  private interactCooldown = 0;

  // Tutorial hints (run 1 only)
  private tutorialStep = 0;
  private tutorialText: Phaser.GameObjects.Text | null = null;
  private tutorialBg: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: { runNumber?: number }): void {
    this.runNumber = data?.runNumber ?? 1;
  }

  create(): void {
    this.cameras.main.fadeIn(1500, 0x0d, 0x0b, 0x0e);

    // Initialize systems
    this.timeSystem = new TimeSystem(this, this.runNumber);
    this.farmingSystem = new FarmingSystem(this);

    // Load tool levels from meta-progression
    const progression = new ProgressionSystem();
    this.farmingSystem.setToolLevels(progression.tools);
    this.ambientMixer = new AmbientMixer(this);
    this.weather = new WeatherRenderer(this);

    // Sky background
    this.skyGraphics = this.add.graphics();
    this.skyGraphics.setDepth(DEPTH.BACKGROUND);
    this.skyGraphics.setScrollFactor(0);

    // Parallax backgrounds
    this.parallax = new ParallaxManager(this);
    this.parallax.createDefaultLayers();

    // Generate terrain
    this.generateTerrain();

    // Place trees and objects
    this.placeEnvironment();

    // Wind system (needs trees ref)
    this.windSystem = new WindSystem(this);
    this.windSystem.setTrees(this.treeSprites);

    // Exploration system
    this.explorationSystem = new ExplorationSystem(this);
    this.explorationSystem.generate('spring', this.runNumber);

    // Spirit system
    this.spiritSystem = new SpiritSystem(this);

    // Ma system
    this.maSystem = new MaSystem(this);

    // Spawn motes
    this.spawnMotes();

    // Give spirit system access to motes
    this.spiritSystem.initMotes(this.motes);

    // Create player at center of farm area
    this.player = new Player(this, MAP_WIDTH / 2, MAP_HEIGHT / 2);

    // UI
    this.touchControls = new TouchControls(this);
    this.hud = new HUD(this);

    // Camera
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);
    this.cameras.main.setRoundPixels(true);

    // Post-processing
    this.setupPostProcessing();

    // Audio
    this.setupAudio();

    // Time events
    this.timeSystem.events.on('day-change', this.onDayChange, this);
    this.timeSystem.events.on('season-change', this.onSeasonChange, this);
    this.timeSystem.events.on('time-phase-change', this.onTimePhaseChange, this);
    this.timeSystem.events.on('run-end', this.onRunEnd, this);

    // Farming events
    this.farmingSystem.events.on('crop-harvested', this.onCropHarvested, this);
    this.farmingSystem.events.on('crop-withered', this.onCropWithered, this);

    // Exploration events
    this.explorationSystem.events.on('discovery', this.onDiscovery, this);

    // Spirit events
    this.spiritSystem.events.on('thornback-appears', () => {
      // Subtle camera pull when Thornback appears
      this.cameras.main.zoomTo(0.95, 3000, 'Sine.easeInOut');
      this.time.delayedCall(8000, () => {
        this.cameras.main.zoomTo(1, 2000, 'Sine.easeInOut');
      });
    });

    // Ma system events
    this.maSystem.events.on('ma-start', () => {
      this.hud.fadeOut();
    });
    this.maSystem.events.on('ma-end', () => {
      this.hud.fadeIn();
    });
    this.maSystem.events.on('ma-complete', (type: MaMomentType) => {
      this.onMaComplete(type);
    });

    // Initial state
    this.hud.updateTime(this.timeSystem.state);
    this.inventory.set('turnip', 5);
    this.inventory.set('herb', 3);
    this.inventory.set('wildflower', 2);
    this.updateHudSeeds();

    // Generate weather schedule for this run
    this.generateWeatherSchedule();

    // Tutorial hints on first run
    if (this.runNumber === 1) {
      this.setupTutorial();
    }
  }

  private setupTutorial(): void {
    this.tutorialBg = this.add.graphics();
    this.tutorialBg.setDepth(DEPTH.UI + 10);
    this.tutorialBg.setScrollFactor(0);

    this.tutorialText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, '', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: `#${COLORS.PARCHMENT.toString(16).padStart(6, '0')}`,
      align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.UI + 11).setScrollFactor(0).setAlpha(0);

    this.tutorialStep = 0;
    this.showTutorialHint('Walk to the brown soil and select the HOE tool');
  }

  private showTutorialHint(text: string): void {
    if (!this.tutorialText || !this.tutorialBg) return;

    this.tutorialBg.clear();
    this.tutorialBg.fillStyle(COLORS.MIDNIGHT, 0.85);
    this.tutorialBg.fillRoundedRect(20, GAME_HEIGHT - 30, GAME_WIDTH - 40, 18, 3);

    this.tutorialText.setText(text);
    this.tweens.add({ targets: this.tutorialText, alpha: 1, duration: 600 });
  }

  private advanceTutorial(): void {
    if (!this.tutorialText || !this.tutorialBg) return;

    this.tutorialStep++;
    switch (this.tutorialStep) {
      case 1:
        this.showTutorialHint('Tap soil to till it. Now select WATER and tap again.');
        break;
      case 2:
        this.showTutorialHint('Select SEED, choose a crop, and tap tilled soil to plant.');
        break;
      case 3:
        this.showTutorialHint('Water your crops daily. Explore the forest for seeds.');
        this.time.delayedCall(6000, () => this.dismissTutorial());
        break;
      default:
        this.dismissTutorial();
    }
  }

  private dismissTutorial(): void {
    if (this.tutorialText) {
      this.tweens.add({
        targets: [this.tutorialText, this.tutorialBg],
        alpha: 0, duration: 800,
        onComplete: () => {
          this.tutorialText?.destroy();
          this.tutorialBg?.destroy();
          this.tutorialText = null;
          this.tutorialBg = null;
        },
      });
    }
  }

  update(time: number, delta: number): void {
    // Systems
    this.timeSystem.update(delta);
    this.touchControls.update();
    this.hud.update();
    this.ambientMixer.update();
    this.weather.update(delta, time);

    // Wind system
    this.windSystem.update(
      time,
      this.weather.windStrength,
      this.weather.windAngle,
      this.farmingSystem.allCrops
    );

    // Exploration system
    const playerPos = this.player.position;
    this.explorationSystem.setTimeOfDay(this.timeSystem.state.timeOfDay);
    this.explorationSystem.update(time, playerPos.x, playerPos.y, delta);

    // Spirit system
    this.spiritSystem.update(time, delta, playerPos.x, playerPos.y);

    // Ma system
    this.maSystem.update(time, delta);

    // Check Ma moment triggers
    if (!this.maSystem.isActive) {
      const state = this.timeSystem.state;
      const playerNearForest = playerPos.x < 9 * TILE_SIZE || playerPos.x > 21 * TILE_SIZE;
      const playerNearRiver = playerPos.x > 24 * TILE_SIZE;
      this.maSystem.checkTrigger(
        state.season,
        state.timeOfDay,
        this.weather.isRaining,
        playerNearForest,
        playerNearRiver,
        this.spiritSystem.landHealth
      );
    }

    // Interaction cooldown
    if (this.interactCooldown > 0) {
      this.interactCooldown -= delta;
    }

    // Player input
    const input = this.touchControls.input;
    const maBlocking = this.maSystem.isActive || this.explorationSystem.isPopupVisible;
    if (!maBlocking) {
      this.player.setMovement(input.moveX, input.moveY);
      if (input.tapped && this.interactCooldown <= 0) {
        this.handleInteraction();
        this.interactCooldown = 250;
      }
    } else if (this.maSystem.isActive) {
      // During Ma, player stands still
      this.player.setMovement(0, 0);
    } else {
      this.player.setMovement(input.moveX, input.moveY);
    }

    // Update entities
    this.player.update(delta);
    for (const mote of this.motes) {
      mote.update(time, delta);
    }

    // Camera breathing
    this.cameraBreathTime += delta / 1000;
    const breathOffset = Math.sin(this.cameraBreathTime * (Math.PI * 2 / CAMERA_BREATHE_PERIOD))
      * CAMERA_BREATHE_AMPLITUDE;
    this.cameras.main.setFollowOffset(0, breathOffset);

    // Visuals
    this.renderSky();
    this.parallax.update(this.cameras.main.scrollX, this.cameras.main.scrollY);
    this.updateTimeVisuals();

    // HUD
    this.hud.updateTime(this.timeSystem.state);
    const status = this.farmingSystem.getStatus();
    this.hud.updateFarmStatus(status.needsWater, status.readyToHarvest, this.farmingSystem.waterUsesRemaining);

    // Audio
    this.ambientMixer.setTimeOfDay(this.timeSystem.state.timeOfDay, this.timeSystem.state.season);
  }

  // --- Interaction ---

  private handleInteraction(): void {
    const tool = this.hud.currentTool;
    const { x: tileX, y: tileY } = this.player.facingTile;
    const playerPos = this.player.position;

    // Check for exploration discovery first (outside farm) — always allowed
    if (!this.farmingSystem.isInFarmBounds(tileX, tileY)) {
      const result = this.explorationSystem.interact(playerPos.x, playerPos.y);
      if (result && result.reward) {
        this.applyDiscoveryReward(result.reward);
      }
      return;
    }

    // No farming in winter — just walking and looking
    if (!this.timeSystem.isFarmingSeason()) return;

    switch (tool) {
      case 'hoe': {
        const tile = this.farmingSystem.till(tileX, tileY);
        if (tile) {
          this.player.useTool('hoe');
          // Update tilemap visual
          this.terrainLayer.putTileAt(8, tileX, tileY);
          if (this.tutorialStep === 0) this.advanceTutorial();
        }
        break;
      }

      case 'water': {
        const watered = this.farmingSystem.water(tileX, tileY);
        if (watered) {
          this.player.useTool('water');
          this.createWaterDroplets(tileX, tileY);
          if (this.tutorialStep === 1) this.advanceTutorial();
        }
        break;
      }

      case 'seed': {
        const tile = this.farmingSystem.getTile(tileX, tileY);

        // If crop is ready, harvest it (seed tool doubles as harvest)
        if (tile?.crop?.isReadyToHarvest) {
          const result = this.farmingSystem.harvest(tileX, tileY);
          if (result) {
            this.inventory.set(
              result.cropData.id,
              (this.inventory.get(result.cropData.id) || 0) + result.yield_
            );
            this.createHarvestParticles(tileX * TILE_SIZE + 8, tileY * TILE_SIZE + 8);
            this.player.useTool('seed');
            this.updateHudSeeds();
          }
          break;
        }

        // Otherwise, plant
        const seedData = this.hud.currentSeed;
        if (seedData) {
          const count = this.inventory.get(seedData.id) || 0;
          if (count > 0) {
            const crop = this.farmingSystem.plant(
              tileX, tileY, seedData, this.timeSystem.state.season
            );
            if (crop) {
              this.inventory.set(seedData.id, count - 1);
              this.player.useTool('seed');
              this.updateHudSeeds();
              if (this.tutorialStep === 2) this.advanceTutorial();
            }
          }
        }
        break;
      }
    }
  }

  private updateHudSeeds(): void {
    const season = this.timeSystem.state.season;
    const seasonSeeds = CROP_CATALOG.filter(c => c.seasons.includes(season));
    this.hud.setAvailableSeeds(seasonSeeds, this.inventory);
  }

  // --- Particle effects ---

  private createHarvestParticles(x: number, y: number): void {
    const gfx = this.add.graphics();
    gfx.setDepth(DEPTH.WEATHER_FRONT);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: number; size: number }> = [];
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        color: [COLORS.GOLDEN_WHEAT, COLORS.PALE_GOLD, COLORS.SOFT_WHITE, COLORS.FRESH_GREEN][Math.floor(Math.random() * 4)],
        size: 1 + Math.random() * 1.5,
      });
    }

    const timer = this.time.addEvent({
      delay: 16,
      repeat: 45,
      callback: () => {
        gfx.clear();
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.04;
          p.life -= 0.022;
          if (p.life > 0) {
            gfx.fillStyle(p.color, p.life * 0.9);
            gfx.fillCircle(p.x, p.y, p.size * p.life);
          }
        }
      },
    });

    this.time.delayedCall(780, () => { timer.destroy(); gfx.destroy(); });
  }

  private createWaterDroplets(tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    const gfx = this.add.graphics();
    gfx.setDepth(DEPTH.WEATHER_FRONT);

    const drops: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 0.8 + Math.random() * 1.2;
      drops.push({
        x: px + (Math.random() - 0.5) * 6,
        y: py - 2,
        vx: Math.cos(angle) * speed * 0.5,
        vy: Math.sin(angle) * speed,
        life: 1,
      });
    }

    const timer = this.time.addEvent({
      delay: 16,
      repeat: 25,
      callback: () => {
        gfx.clear();
        for (const d of drops) {
          d.x += d.vx;
          d.y += d.vy;
          d.vy += 0.06;
          d.life -= 0.04;
          if (d.life > 0) {
            gfx.fillStyle(COLORS.LIGHT_SKY, d.life * 0.6);
            gfx.fillCircle(d.x, d.y, 1);
          }
        }
      },
    });

    this.time.delayedCall(440, () => { timer.destroy(); gfx.destroy(); });
  }

  // --- Weather ---

  private generateWeatherSchedule(): void {
    this.weatherSchedule = [];

    // Spring: light rain on day 2 or 3
    const springRainDay = 2 + Math.floor(Math.random() * 2);
    this.weatherSchedule.push({
      day: springRainDay,
      time: 0.3 + Math.random() * 0.2, // afternoon-ish
      type: 'rain_light',
      duration: 50000 + Math.random() * 30000,
    });

    // Summer: potential heavy rain / storm day 6 or 7
    const summerStormDay = 6 + Math.floor(Math.random() * 2);
    this.weatherSchedule.push({
      day: summerStormDay,
      time: 0.4 + Math.random() * 0.2,
      type: Math.random() < 0.4 ? 'storm' : 'rain_heavy',
      duration: 40000 + Math.random() * 30000,
    });

    // Autumn: rain day 9 or 10, potential early frost day 12
    const autumnRainDay = 9 + Math.floor(Math.random() * 2);
    this.weatherSchedule.push({
      day: autumnRainDay,
      time: 0.2 + Math.random() * 0.2,
      type: 'rain_light',
      duration: 60000 + Math.random() * 20000,
    });

    // Late autumn frost
    this.weatherSchedule.push({
      day: 12,
      time: 0.05, // dawn
      type: 'clear', // frost is applied separately
      duration: 0,
    });

    // Winter: snow day 14-15, fog day 13
    this.weatherSchedule.push({
      day: 13,
      time: 0.1,
      type: 'fog',
      duration: 80000 + Math.random() * 40000,
    });

    this.weatherSchedule.push({
      day: 14 + Math.floor(Math.random() * 2),
      time: 0.15,
      type: 'snow',
      duration: 100000 + Math.random() * 50000,
    });
  }

  private checkWeatherSchedule(): void {
    const state = this.timeSystem.state;
    for (const event of this.weatherSchedule) {
      if (event.day === state.day && Math.abs(state.dayProgress - event.time) < 0.02) {
        if (event.type !== 'clear') {
          this.weather.setWeather(event.type);
          this.ambientMixer.setWeather(event.type);
          this.wasRainingToday = this.weather.isRaining;

          if (event.duration > 0) {
            if (this.activeWeatherTimer) this.activeWeatherTimer.destroy();
            this.activeWeatherTimer = this.time.delayedCall(event.duration, () => {
              this.weather.setWeather('clear');
              this.ambientMixer.setWeather('clear');
            });
          }
        }

        // Late autumn frost trigger
        if (event.day === 12) {
          this.weather.setFrost(0.6);
          this.farmingSystem.applyFrost(0.3);
        }
      }
    }
  }

  // --- Time events ---

  private onDiscovery(discovery: { id: string; type: string }): void {
    // Recalculate land health when discoveries are made
    this.spiritSystem.recalculateLandHealth(
      this.farmingSystem,
      this.explorationSystem.discoveryCount
    );
  }

  private applyDiscoveryReward(reward: { type: string; id: string; amount?: number }): void {
    switch (reward.type) {
      case 'seed':
        this.inventory.set(reward.id, (this.inventory.get(reward.id) || 0) + (reward.amount || 1));
        this.updateHudSeeds();
        break;
      case 'item':
        this.inventory.set(reward.id, (this.inventory.get(reward.id) || 0) + (reward.amount || 1));
        break;
      case 'blessing':
        this.spiritSystem.addBlessing(reward.id);
        break;
      case 'knowledge':
        // Journal entries — tracked for meta-progression (future)
        break;
    }
  }

  private onMaComplete(type: MaMomentType): void {
    const reward = this.maSystem.getReward();
    if (!reward) return;

    switch (reward.type) {
      case 'fertility':
        // Boost all soil fertility
        for (const tile of this.farmingSystem.grid.values()) {
          tile.fertility = Math.min(1, tile.fertility + reward.value);
        }
        this.farmingSystem.renderSoil();
        break;
      case 'motes':
        // Spawn new motes
        for (let i = 0; i < Math.floor(reward.value); i++) {
          const mote = this.spiritSystem.spawnMote();
          if (mote) this.motes.push(mote);
        }
        break;
      case 'blessing':
        this.spiritSystem.addBlessing('water_blessing');
        break;
      case 'knowledge':
        // Unlock winter foraging spots
        break;
    }

    // Recalculate land health after Ma reward
    this.spiritSystem.recalculateLandHealth(
      this.farmingSystem,
      this.explorationSystem.discoveryCount
    );
  }

  private onDayChange(): void {
    const state = this.timeSystem.state;

    // Advance farming
    this.farmingSystem.advanceDay(state.season, this.wasRainingToday);
    this.wasRainingToday = false;

    // Recalculate land health
    this.spiritSystem.recalculateLandHealth(
      this.farmingSystem,
      this.explorationSystem.discoveryCount
    );

    // Update seed availability for new season
    this.updateHudSeeds();

    // Frost: light in late autumn, heavy in winter
    if (state.season === 'winter') {
      this.weather.setFrost(0.5);
    } else if (state.season === 'autumn' && state.seasonDay >= DAYS_PER_SEASON) {
      this.weather.setFrost(0.25);
    } else {
      this.weather.setFrost(0);
    }

    // Drought check: if no rain for 3+ days and sunny
    if (state.day > 3 && !this.wasRainingToday) {
      this.farmingSystem.applyDroughtStress();
    }

    // Check weather schedule
    this.checkWeatherSchedule();

    // Grant seeds at season start (reward for continuing)
    if (state.seasonDay === 1) {
      this.grantSeasonalSeeds(state.season);
    }
  }

  private onSeasonChange(newSeason: Season): void {
    // Regenerate forest discoveries for new season
    this.explorationSystem.generate(newSeason, this.runNumber);

    // Light frost at start of autumn (kills non-hardy crops)
    if (newSeason === 'autumn') {
      this.farmingSystem.applyFrost(0.3);
    }

    // Winter epilogue — one contemplative day
    if (newSeason === 'winter') {
      this.enterWinter();
    }
  }

  /**
   * The winter epilogue: snow covers the land, tools are put away,
   * the player walks slowly through what they've built.
   * Pure vibes. Sunset triggers at the end of this day.
   */
  private enterWinter(): void {
    // Snow on all grass tiles
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
      for (let x = 0; x < MAP_WIDTH_TILES; x++) {
        const tile = this.terrainLayer.getTileAt(x, y);
        if (tile && tile.index < 8) {
          this.terrainLayer.putTileAt(40 + tile.index % 8, x, y);
        }
      }
    }

    // Frost and snow weather
    this.weather.setFrost(0.4);
    this.weather.setWeather('snow');

    // Slow the player — contemplative pace
    this.player.setSpeedMultiplier(0.6);

    // Hide farming tools — only walking and looking
    this.hud.setWinterMode(true);

    // Kill remaining crops (first real frost)
    this.farmingSystem.applyFrost(0.9);

    // Motes glow dimmer but are still present
    for (const mote of this.motes) {
      mote.setWinterMode(true);
    }
  }

  private onTimePhaseChange(newPhase: string): void {
    const state = this.timeSystem.state;

    // Check weather schedule more frequently
    this.checkWeatherSchedule();

    // Harvest sunset on last day at sunset phase
    if (newPhase === 'sunset' && state.day >= this.timeSystem['maxDays']) {
      this.time.delayedCall(3000, () => {
        this.startSunset();
      });
    }
  }

  private onRunEnd(): void {
    this.startSunset();
  }

  private startSunset(): void {
    this.scene.start('SunsetScene', {
      harvestQuality: this.farmingSystem.calculateHarvestQuality(),
      landHealth: this.spiritSystem.landHealth,
      discoveryCount: this.explorationSystem.discoveryCount,
      totalHarvested: this.farmingSystem.harvestedCount,
    });
  }

  private onCropHarvested(cropData: CropData, yield_: number): void {
    // Could trigger mote reactions, journal entries, etc.
    if (yield_ >= 6) {
      // Generous harvest — motes notice
      for (const mote of this.motes) {
        mote.show();
      }
    }
  }

  private onCropWithered(): void {
    // Motes dim slightly when crops wither — land health drops
    this.spiritSystem.recalculateLandHealth(
      this.farmingSystem,
      this.explorationSystem.discoveryCount
    );
  }

  private grantSeasonalSeeds(season: Season): void {
    const seasonCrops = CROP_CATALOG.filter(c => c.seasons.includes(season));
    for (const crop of seasonCrops) {
      const current = this.inventory.get(crop.id) || 0;
      if (current < 2) {
        // Grant at least 2 of each seasonal seed
        this.inventory.set(crop.id, Math.max(current, 2));
      }
    }
    this.updateHudSeeds();
  }

  // --- Terrain generation ---

  private generateTerrain(): void {
    this.tilemap = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: MAP_WIDTH_TILES,
      height: MAP_HEIGHT_TILES,
    });

    const tileset = this.tilemap.addTilesetImage('terrain', 'terrain', TILE_SIZE, TILE_SIZE)!;
    this.terrainLayer = this.tilemap.createBlankLayer('ground', tileset, 0, 0)!;
    this.terrainLayer.setDepth(DEPTH.TERRAIN);

    const farmStartX = 8, farmEndX = 22, farmStartY = 5, farmEndY = 15;
    const riverX = 25;

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
      for (let x = 0; x < MAP_WIDTH_TILES; x++) {
        if (x >= riverX && x <= riverX + 1) {
          this.terrainLayer.putTileAt(16 + (x + y) % 8, x, y);
        } else if (x >= farmStartX && x < farmEndX && y >= farmStartY && y < farmEndY) {
          this.terrainLayer.putTileAt((x + y * 3) % 8, x, y);
        } else if (y >= 9 && y <= 10 && x >= farmEndX && x < riverX) {
          this.terrainLayer.putTileAt(24 + (x + y) % 8, x, y);
        } else {
          this.terrainLayer.putTileAt(32 + (x * 3 + y * 7) % 8, x, y);
        }
      }
    }
  }

  private placeEnvironment(): void {
    const treePositions: Array<{ x: number; y: number; variant: number }> = [];

    for (let i = 0; i < 40; i++) {
      let tx: number, ty: number;
      do {
        tx = Math.floor(Math.random() * MAP_WIDTH_TILES);
        ty = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      } while (
        (tx >= 7 && tx < 23 && ty >= 4 && ty < 16) ||
        (tx >= 25) ||
        (ty >= 9 && ty <= 10 && tx >= 22)
      );
      treePositions.push({
        x: tx * TILE_SIZE + TILE_SIZE / 2,
        y: ty * TILE_SIZE + TILE_SIZE,
        variant: Math.floor(Math.random() * 3),
      });
    }

    treePositions.sort((a, b) => a.y - b.y);

    for (const tp of treePositions) {
      const tree = this.add.image(tp.x, tp.y, 'trees', tp.variant);
      tree.setOrigin(0.5, 1);
      tree.setDepth(DEPTH.ENTITIES + tp.y);
      this.treeSprites.push(tree);
    }

    for (let i = 0; i < 25; i++) {
      let ox: number, oy: number;
      do {
        ox = Math.floor(Math.random() * MAP_WIDTH_TILES);
        oy = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      } while (
        (ox >= 8 && ox < 22 && oy >= 5 && oy < 15) || (ox >= 25)
      );

      const variant = Math.floor(Math.random() * 5);
      const obj = this.add.image(
        ox * TILE_SIZE + TILE_SIZE / 2,
        oy * TILE_SIZE + TILE_SIZE,
        'objects', variant
      );
      obj.setOrigin(0.5, 1);
      obj.setDepth(DEPTH.GROUND_DECOR + oy * TILE_SIZE);
      this.objectSprites.push(obj);
    }
  }

  private spawnMotes(): void {
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 7 * TILE_SIZE + TILE_SIZE;
      const y = Math.random() * MAP_HEIGHT;
      this.motes.push(new Mote(this, x, y));
    }
    for (let i = 0; i < 4; i++) {
      const x = 23 * TILE_SIZE + Math.random() * 2 * TILE_SIZE;
      const y = Math.random() * MAP_HEIGHT;
      this.motes.push(new Mote(this, x, y));
    }
  }

  // --- Rendering ---

  private setupPostProcessing(): void {
    const renderer = this.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      if (renderer.pipelines.getPostPipeline('PaletteGrade')) {
        this.cameras.main.setPostPipeline(PaletteShader);
      }
    }
  }

  private setupAudio(): void {
    this.ambientMixer.registerLayer('wind', 0.3);
    this.ambientMixer.registerLayer('birds', 0.25);
    this.ambientMixer.registerLayer('crickets', 0.2);
    this.ambientMixer.registerLayer('rain_light', 0.4);
    this.ambientMixer.registerLayer('rain_heavy', 0.6);
    this.ambientMixer.registerLayer('thunder', 0.5);
    this.ambientMixer.setTimeOfDay(
      this.timeSystem.state.timeOfDay,
      this.timeSystem.state.season
    );
  }

  private renderSky(): void {
    const profile = this.timeSystem.currentProfile;
    this.skyGraphics.clear();

    const topColor = profile.skyGradientTop;
    const bottomColor = profile.skyGradientBottom;

    // Render in bands of 4 pixels for performance
    for (let y = 0; y < GAME_HEIGHT; y += 2) {
      const t = y / GAME_HEIGHT;
      const r = Math.floor(((topColor >> 16) & 0xFF) * (1 - t) + ((bottomColor >> 16) & 0xFF) * t);
      const g = Math.floor(((topColor >> 8) & 0xFF) * (1 - t) + ((bottomColor >> 8) & 0xFF) * t);
      const b = Math.floor((topColor & 0xFF) * (1 - t) + (bottomColor & 0xFF) * t);
      this.skyGraphics.fillStyle((r << 16) | (g << 8) | b, 1);
      this.skyGraphics.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  private updateTimeVisuals(): void {
    const { current, next, blend } = this.timeSystem.getBlendedProfile();
    const renderer = this.renderer;

    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const pipelines = this.cameras.main.getPostPipeline(PaletteShader);
      if (pipelines) {
        const pipeline = Array.isArray(pipelines) ? pipelines[0] : pipelines;
        if (pipeline instanceof PaletteShader) {
          const blendedProfile = {
            ...current,
            tint: {
              r: current.tint.r + (next.tint.r - current.tint.r) * blend,
              g: current.tint.g + (next.tint.g - current.tint.g) * blend,
              b: current.tint.b + (next.tint.b - current.tint.b) * blend,
            },
            brightness: current.brightness + (next.brightness - current.brightness) * blend,
            saturation: current.saturation + (next.saturation - current.saturation) * blend,
          };
          pipeline.setTimeProfile(blendedProfile, this.timeSystem.state.season);
        }
      }
    }
  }
}
