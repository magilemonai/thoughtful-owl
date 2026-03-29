/**
 * Elder entity — placeholder module.
 * The Thornback Elder's rendering and behavior is handled by SpiritSystem.
 * This file exists for future expansion when additional Elders are added.
 *
 * Future Elders (V2+):
 * - The Greycurrent (water) — serpentine shape beneath the river
 * - The Deepwarm (earth) — felt as ground tremors and warmth
 * - The Listless (wind) — visible only in swirling leaves and grass
 */

export interface ElderState {
  id: string;
  visible: boolean;
  favorLevel: number; // 0-1
  lastSeenDay: number;
}
