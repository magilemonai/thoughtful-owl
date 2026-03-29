import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  MAP_WIDTH_TILES,
  MAP_HEIGHT_TILES,
  MAP_WIDTH,
  MAP_HEIGHT,
  CAMERA_LERP,
  CAMERA_BREATHE_AMPLITUDE,
  CAMERA_BREATHE_PERIOD,
  DEPTH,
  SEASON_NAMES,
} from '../config/constants';
import { COLORS, TIME_PROFILES, Season } from '../config/palette';
import { Player } from '../entities/Player';
import { Mote } from '../entities/Mote';
import { Crop, CROP_CATALOG, CropData } from '../entities/Crop';
import { TimeSystem } from '../systems/TimeSystem';
import { TouchControls } from '../ui/TouchControls';
import { HUD } from '../ui/HUD';
import { ParallaxManager } from '../rendering/ParallaxManager';
import { WeatherRenderer } from '../rendering/WeatherRenderer';
import { PaletteShader } from '../rendering/PaletteShader';
import { AmbientMixer } from '../audio/AmbientMixer';

interface SoilTile {
  tileX: number;
  tileY: number;
  tilled: boolean;
  watered: boolean;
  crop: Crop | null;
}

/**
 * Main gameplay scene.
 * Manages the farm, exploration, time cycle, weather, spirits, and Ma moments.
 */
export class GameScene extends Phaser.Scene {
  // Core systems
  private timeSystem!: TimeSystem;
  private touchControls!: TouchControls;
  private hud!: HUD;
  private parallax!: ParallaxManager;
  private weather!: WeatherRenderer;
  private ambientMixer!: AmbientMixer;

  // Entities
  private player!: Player;
  private motes: Mote[] = [];
  private farmGrid: Map<string, SoilTile> = new Map();
  private crops: Crop[] = [];

  // Terrain
  private terrainLayer!: Phaser.Tilemaps.TilemapLayer;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private treeSprites: Phaser.GameObjects.Image[] = [];
  private objectSprites: Phaser.GameObjects.Image[] = [];

  // Sky
  private skyGraphics!: Phaser.GameObjects.Graphics;

  // Camera
  private cameraBreathTime = 0;

  // Farming state
  private selectedSeedIndex = 0;
  private inventory: Map<string, number> = new Map();

  // Ma system
  private maActive = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(1500, 0x0d, 0x0b, 0x0e);

    // Initialize systems
    this.timeSystem = new TimeSystem(this);
    this.ambientMixer = new AmbientMixer(this);
    this.weather = new WeatherRenderer(this);

    // Sky background (rendered behind everything)
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

    // Spawn motes in forested areas
    this.spawnMotes();

    // Create player at center of farm area
    const farmCenterX = MAP_WIDTH / 2;
    const farmCenterY = MAP_HEIGHT / 2;
    this.player = new Player(this, farmCenterX, farmCenterY);

    // UI
    this.touchControls = new TouchControls(this);
    this.hud = new HUD(this);

    // Camera setup
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);
    this.cameras.main.setRoundPixels(true);

    // Set up post-processing pipeline
    this.setupPostProcessing();

    // Audio setup
    this.setupAudio();

    // Time system events
    this.timeSystem.events.on('day-change', this.onDayChange, this);
    this.timeSystem.events.on('season-change', this.onSeasonChange, this);
    this.timeSystem.events.on('time-phase-change', this.onTimePhaseChange, this);
    this.timeSystem.events.on('run-end', this.onRunEnd, this);

    // Initialize time display
    this.hud.updateTime(this.timeSystem.state);

    // Initialize seed inventory
    this.inventory.set('turnip', 5);
    this.inventory.set('herb', 3);

    // Schedule weather events
    this.scheduleWeather();
  }

  update(time: number, delta: number): void {
    // Update systems
    this.timeSystem.update(delta);
    this.touchControls.update();
    this.hud.update();
    this.ambientMixer.update();
    this.weather.update(delta);

    // Player input
    const input = this.touchControls.input;

    if (!this.maActive) {
      this.player.setMovement(input.moveX, input.moveY);

      // Handle tap interactions
      if (input.tapped) {
        this.handleInteraction();
      }
    } else {
      this.player.setMovement(0, 0);
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

    // Update sky gradient based on time
    this.renderSky();

    // Update parallax
    this.parallax.update(this.cameras.main.scrollX, this.cameras.main.scrollY);

    // Update time-of-day visual profile
    this.updateTimeVisuals();

    // Update HUD
    this.hud.updateTime(this.timeSystem.state);

    // Update ambient audio based on time
    this.ambientMixer.setTimeOfDay(this.timeSystem.state.timeOfDay, this.timeSystem.state.season);
  }

  private generateTerrain(): void {
    // Create tilemap from data
    this.tilemap = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: MAP_WIDTH_TILES,
      height: MAP_HEIGHT_TILES,
    });

    const tileset = this.tilemap.addTilesetImage('terrain', 'terrain', TILE_SIZE, TILE_SIZE)!;
    this.terrainLayer = this.tilemap.createBlankLayer('ground', tileset, 0, 0)!;
    this.terrainLayer.setDepth(DEPTH.TERRAIN);

    // Generate terrain layout
    // Center area: farm (grass)
    // Edges: forest floor
    // River along one side
    const farmStartX = 8;
    const farmEndX = 22;
    const farmStartY = 5;
    const farmEndY = 15;
    const riverX = 25;

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
      for (let x = 0; x < MAP_WIDTH_TILES; x++) {
        // River
        if (x >= riverX && x <= riverX + 1) {
          const waterFrame = 16 + (x + y) % 8; // Row 2 (water)
          this.terrainLayer.putTileAt(waterFrame, x, y);
          continue;
        }

        // Farm area
        if (x >= farmStartX && x < farmEndX && y >= farmStartY && y < farmEndY) {
          const grassFrame = (x + y * 3) % 8; // Row 0 (grass variants)
          this.terrainLayer.putTileAt(grassFrame, x, y);
          continue;
        }

        // Path from farm to river
        if (y >= 9 && y <= 10 && x >= farmEndX && x < riverX) {
          const pathFrame = 24 + (x + y) % 8; // Row 3 (path)
          this.terrainLayer.putTileAt(pathFrame, x, y);
          continue;
        }

        // Forest floor (everything else)
        const forestFrame = 32 + (x * 3 + y * 7) % 8; // Row 4
        this.terrainLayer.putTileAt(forestFrame, x, y);
      }
    }
  }

  private placeEnvironment(): void {
    // Place trees around the forest edges
    const treePositions: Array<{ x: number; y: number; variant: number }> = [];

    for (let i = 0; i < 40; i++) {
      let tx: number, ty: number;
      // Place in forested areas (outside farm area)
      do {
        tx = Math.floor(Math.random() * MAP_WIDTH_TILES);
        ty = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      } while (
        (tx >= 7 && tx < 23 && ty >= 4 && ty < 16) || // Not in farm
        (tx >= 25) || // Not in river
        (ty >= 9 && ty <= 10 && tx >= 22) // Not on path
      );

      treePositions.push({
        x: tx * TILE_SIZE + TILE_SIZE / 2,
        y: ty * TILE_SIZE + TILE_SIZE,
        variant: Math.floor(Math.random() * 3),
      });
    }

    // Sort by Y for proper layering
    treePositions.sort((a, b) => a.y - b.y);

    for (const tp of treePositions) {
      const tree = this.add.image(tp.x, tp.y, 'trees', tp.variant);
      tree.setOrigin(0.5, 1);
      tree.setDepth(DEPTH.ENTITIES + tp.y);
      this.treeSprites.push(tree);
    }

    // Place rocks, bushes, flowers, mushrooms, stumps
    for (let i = 0; i < 25; i++) {
      let ox: number, oy: number;
      do {
        ox = Math.floor(Math.random() * MAP_WIDTH_TILES);
        oy = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      } while (
        (ox >= 8 && ox < 22 && oy >= 5 && oy < 15) ||
        (ox >= 25)
      );

      const variant = Math.floor(Math.random() * 5);
      const obj = this.add.image(
        ox * TILE_SIZE + TILE_SIZE / 2,
        oy * TILE_SIZE + TILE_SIZE,
        'objects',
        variant
      );
      obj.setOrigin(0.5, 1);
      obj.setDepth(DEPTH.GROUND_DECOR + oy * TILE_SIZE);
      this.objectSprites.push(obj);
    }
  }

  private spawnMotes(): void {
    // Spawn motes near trees (forested areas)
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 7 * TILE_SIZE + TILE_SIZE; // Left forest
      const y = Math.random() * MAP_HEIGHT;
      const mote = new Mote(this, x, y);
      this.motes.push(mote);
    }
    for (let i = 0; i < 4; i++) {
      const x = 23 * TILE_SIZE + Math.random() * 2 * TILE_SIZE; // Right of farm, near river
      const y = Math.random() * MAP_HEIGHT;
      const mote = new Mote(this, x, y);
      this.motes.push(mote);
    }
  }

  private handleInteraction(): void {
    const tool = this.hud.currentTool;
    const { x: tileX, y: tileY } = this.player.facingTile;
    const key = `${tileX},${tileY}`;

    // Check bounds (farm area only for farming)
    const inFarm = tileX >= 8 && tileX < 22 && tileY >= 5 && tileY < 15;
    if (!inFarm) return;

    switch (tool) {
      case 'hoe': {
        if (!this.farmGrid.has(key)) {
          // Till the soil
          this.farmGrid.set(key, {
            tileX, tileY,
            tilled: true,
            watered: false,
            crop: null,
          });
          // Update tilemap to show tilled soil
          this.terrainLayer.putTileAt(8, tileX, tileY); // Soil tile
          this.player.useTool('hoe');
        }
        break;
      }
      case 'water': {
        const soil = this.farmGrid.get(key);
        if (soil && soil.tilled) {
          soil.watered = true;
          this.terrainLayer.putTileAt(11, tileX, tileY); // Watered soil
          if (soil.crop) {
            soil.crop.water();
          }
          this.player.useTool('water');
        }
        break;
      }
      case 'seed': {
        const soil = this.farmGrid.get(key);
        if (soil && soil.tilled && !soil.crop) {
          const availableCrops = this.getAvailableSeeds();
          if (availableCrops.length > 0) {
            const cropData = availableCrops[this.selectedSeedIndex % availableCrops.length];
            const count = this.inventory.get(cropData.id) || 0;
            if (count > 0) {
              const crop = new Crop(this, tileX, tileY, cropData);
              soil.crop = crop;
              this.crops.push(crop);
              this.inventory.set(cropData.id, count - 1);
              this.player.useTool('seed');
            }
          }
        } else if (soil?.crop?.isReadyToHarvest) {
          // Harvest
          const yield_ = soil.crop.harvest();
          if (yield_ > 0) {
            // Add to inventory and give feedback
            const cropId = soil.crop.data.id;
            this.inventory.set(cropId, (this.inventory.get(cropId) || 0) + yield_);
            soil.crop.destroy();
            soil.crop = null;
            this.terrainLayer.putTileAt(8, tileX, tileY); // Back to tilled soil

            // Harvest particle burst
            this.createHarvestParticles(tileX * TILE_SIZE + 8, tileY * TILE_SIZE + 8);
          }
        }
        break;
      }
    }

    // Tool cycling on double-tap (handled via HUD button area)
    this.hud.nextTool();
  }

  private getAvailableSeeds(): CropData[] {
    const season = this.timeSystem.state.season;
    return CROP_CATALOG.filter(c =>
      c.seasons.includes(season) && (this.inventory.get(c.id) || 0) > 0
    );
  }

  private createHarvestParticles(x: number, y: number): void {
    const gfx = this.add.graphics();
    gfx.setDepth(DEPTH.WEATHER_FRONT);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: number }> = [];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        color: [COLORS.GOLDEN_WHEAT, COLORS.PALE_GOLD, COLORS.SOFT_WHITE, COLORS.FRESH_GREEN][Math.floor(Math.random() * 4)],
      });
    }

    const timer = this.time.addEvent({
      delay: 16,
      repeat: 40,
      callback: () => {
        gfx.clear();
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.03; // gravity
          p.life -= 0.025;
          if (p.life > 0) {
            gfx.fillStyle(p.color, p.life * 0.8);
            gfx.fillCircle(p.x, p.y, 1.5 * p.life);
          }
        }
      },
    });

    this.time.delayedCall(700, () => {
      timer.destroy();
      gfx.destroy();
    });
  }

  private setupPostProcessing(): void {
    // Apply palette shader as post-processing if WebGL is available
    const renderer = this.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const pipeline = renderer.pipelines.getPostPipeline('PaletteGrade') as PaletteShader;
      if (pipeline) {
        this.cameras.main.setPostPipeline(PaletteShader);
      }
    }
  }

  private setupAudio(): void {
    // Register ambient layers
    this.ambientMixer.registerLayer('wind', 0.3);
    this.ambientMixer.registerLayer('birds', 0.25);
    this.ambientMixer.registerLayer('crickets', 0.2);
    this.ambientMixer.registerLayer('rain_light', 0.4);
    this.ambientMixer.registerLayer('rain_heavy', 0.6);
    this.ambientMixer.registerLayer('thunder', 0.5);

    // Set initial time of day audio
    this.ambientMixer.setTimeOfDay(
      this.timeSystem.state.timeOfDay,
      this.timeSystem.state.season
    );
  }

  private scheduleWeather(): void {
    // Schedule some weather events throughout the run
    // Rain on days 3, 7, 11 (one per season except winter)
    this.timeSystem.events.on('day-change', (state: { day: number; season: Season }) => {
      if (state.day === 3 || state.day === 7) {
        this.time.delayedCall(30000, () => { // rain in the afternoon
          this.weather.setWeather('rain_light');
          this.ambientMixer.setWeather('rain_light');
          // Clear rain after a while
          this.time.delayedCall(60000, () => {
            this.weather.setWeather('clear');
            this.ambientMixer.setWeather('clear');
          });
        });
      }
      if (state.day === 11) {
        this.time.delayedCall(20000, () => {
          this.weather.setWeather('rain_heavy');
          this.ambientMixer.setWeather('rain_heavy');
          this.time.delayedCall(45000, () => {
            this.weather.setWeather('rain_light');
            this.ambientMixer.setWeather('rain_light');
            this.time.delayedCall(30000, () => {
              this.weather.setWeather('clear');
              this.ambientMixer.setWeather('clear');
            });
          });
        });
      }
      if (state.day === 14) {
        // Fog in winter
        this.weather.setWeather('fog');
        this.time.delayedCall(90000, () => {
          this.weather.setWeather('clear');
        });
      }
    });
  }

  private renderSky(): void {
    const profile = this.timeSystem.currentProfile;
    this.skyGraphics.clear();

    const topColor = profile.skyGradientTop;
    const bottomColor = profile.skyGradientBottom;

    for (let y = 0; y < GAME_HEIGHT; y++) {
      const t = y / GAME_HEIGHT;
      const r = Math.floor(((topColor >> 16) & 0xFF) * (1 - t) + ((bottomColor >> 16) & 0xFF) * t);
      const g = Math.floor(((topColor >> 8) & 0xFF) * (1 - t) + ((bottomColor >> 8) & 0xFF) * t);
      const b = Math.floor((topColor & 0xFF) * (1 - t) + (bottomColor & 0xFF) * t);
      this.skyGraphics.fillStyle((r << 16) | (g << 8) | b, 1);
      this.skyGraphics.fillRect(0, y, GAME_WIDTH, 1);
    }
  }

  private updateTimeVisuals(): void {
    const { current, next, blend } = this.timeSystem.getBlendedProfile();

    // Update post-processing shader
    const renderer = this.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const pipelines = this.cameras.main.getPostPipeline(PaletteShader);
      if (pipelines) {
        const pipeline = Array.isArray(pipelines) ? pipelines[0] : pipelines;
        if (pipeline instanceof PaletteShader) {
          // Blend between current and next profile
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

  // --- Time events ---

  private onDayChange(state: { day: number }): void {
    // Advance crop growth
    for (const soil of this.farmGrid.values()) {
      if (soil.crop) {
        soil.crop.advanceDay();
      }
      // Reset watering
      if (soil.watered) {
        soil.watered = false;
        this.terrainLayer.putTileAt(8, soil.tileX, soil.tileY);
      }
    }
  }

  private onSeasonChange(newSeason: Season, _oldSeason: Season): void {
    // Update terrain tiles for season
    if (newSeason === 'winter') {
      // Snow overlay on grass tiles
      for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
          const tile = this.terrainLayer.getTileAt(x, y);
          if (tile && tile.index < 8) {
            // Replace grass with snow variant
            this.terrainLayer.putTileAt(40 + tile.index % 8, x, y);
          }
        }
      }
    }
  }

  private onTimePhaseChange(newPhase: string, _oldPhase: string): void {
    // Check for Ma moment triggers
    if (newPhase === 'sunset' && this.timeSystem.state.day === 12) {
      // Harvest sunset! Transition to sunset scene
      this.time.delayedCall(5000, () => {
        this.scene.start('SunsetScene', {
          harvestQuality: this.calculateHarvestQuality(),
          timeSystem: this.timeSystem.state,
        });
      });
    }
  }

  private onRunEnd(): void {
    this.scene.start('SunsetScene', {
      harvestQuality: this.calculateHarvestQuality(),
      timeSystem: this.timeSystem.state,
    });
  }

  private calculateHarvestQuality(): number {
    // Score based on crops harvested, motes present, etc.
    let score = 0;
    score += this.crops.filter(c => c.isReadyToHarvest).length * 10;
    score += this.motes.length * 5;
    return Math.min(100, score);
  }
}
