import Phaser from 'phaser';
import {
  DAY_DURATION_SECONDS,
  DAYS_PER_SEASON,
  SEASONS_PER_RUN,
  TIME_PHASE_DURATIONS,
  SEASON_NAMES,
} from '../config/constants';
import {
  TIME_PROFILES,
  TIME_OF_DAY_ORDER,
  TimeOfDay,
  TimeOfDayProfile,
  Season,
} from '../config/palette';

export interface TimeState {
  day: number;           // 1-16
  season: Season;
  seasonDay: number;     // 1-4 within the season
  timeOfDay: TimeOfDay;
  dayProgress: number;   // 0-1 progress through current day
  phaseProgress: number; // 0-1 progress through current time phase
  totalElapsed: number;  // total seconds elapsed this run
}

/**
 * Manages the day/night cycle, seasons, and time-of-day transitions.
 * Emits events when time phases, days, and seasons change.
 */
export class TimeSystem {
  private scene: Phaser.Scene;
  private elapsed = 0; // seconds into current day
  private currentDay = 1;
  private paused = false;
  private timeScale = 1;

  // Event emitter for time changes
  readonly events: Phaser.Events.EventEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();
  }

  get state(): TimeState {
    const dayProgress = this.elapsed / DAY_DURATION_SECONDS;
    const seasonIndex = Math.floor((this.currentDay - 1) / DAYS_PER_SEASON);
    const season = SEASON_NAMES[Math.min(seasonIndex, SEASON_NAMES.length - 1)];
    const seasonDay = ((this.currentDay - 1) % DAYS_PER_SEASON) + 1;
    const { phase, phaseProgress } = this.getTimePhase(dayProgress);

    return {
      day: this.currentDay,
      season,
      seasonDay,
      timeOfDay: phase,
      dayProgress,
      phaseProgress,
      totalElapsed: (this.currentDay - 1) * DAY_DURATION_SECONDS + this.elapsed,
    };
  }

  get currentProfile(): TimeOfDayProfile {
    return TIME_PROFILES[this.state.timeOfDay];
  }

  /**
   * Returns the current and next time-of-day profiles with blend factor
   * for smooth transitions between phases.
   */
  getBlendedProfile(): { current: TimeOfDayProfile; next: TimeOfDayProfile; blend: number } {
    const { timeOfDay, phaseProgress } = this.state;
    const currentIndex = TIME_OF_DAY_ORDER.indexOf(timeOfDay);
    const nextIndex = (currentIndex + 1) % TIME_OF_DAY_ORDER.length;

    return {
      current: TIME_PROFILES[TIME_OF_DAY_ORDER[currentIndex]],
      next: TIME_PROFILES[TIME_OF_DAY_ORDER[nextIndex]],
      blend: phaseProgress,
    };
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  setTimeScale(scale: number): void { this.timeScale = scale; }

  update(delta: number): void {
    if (this.paused) return;

    const prevState = this.state;
    this.elapsed += (delta / 1000) * this.timeScale;

    if (this.elapsed >= DAY_DURATION_SECONDS) {
      this.elapsed = 0;
      this.currentDay++;

      if (this.currentDay > DAYS_PER_SEASON * SEASONS_PER_RUN) {
        this.events.emit('run-end');
        return;
      }

      this.events.emit('day-change', this.state);

      const newSeason = this.state.season;
      if (newSeason !== prevState.season) {
        this.events.emit('season-change', newSeason, prevState.season);
      }
    }

    // Check for time-of-day phase change
    if (this.state.timeOfDay !== prevState.timeOfDay) {
      this.events.emit('time-phase-change', this.state.timeOfDay, prevState.timeOfDay);
    }
  }

  private getTimePhase(dayProgress: number): { phase: TimeOfDay; phaseProgress: number } {
    let accumulated = 0;
    for (const phaseName of TIME_OF_DAY_ORDER) {
      const duration = TIME_PHASE_DURATIONS[phaseName];
      if (dayProgress < accumulated + duration) {
        const phaseProgress = (dayProgress - accumulated) / duration;
        return { phase: phaseName, phaseProgress };
      }
      accumulated += duration;
    }
    return { phase: 'deepNight', phaseProgress: 1 };
  }

  /**
   * Reset for a new run
   */
  reset(): void {
    this.elapsed = 0;
    this.currentDay = 1;
    this.paused = false;
  }

  /**
   * Check if current season allows farming
   */
  isFarmingSeason(): boolean {
    const season = this.state.season;
    return season !== 'winter';
  }
}
