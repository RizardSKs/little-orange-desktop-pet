import type { CareVisual } from './types';

export const CARE_DURATION_MS: Record<CareVisual, number | null> = {
  feed: 6000, play: 7000, clean: 6000, 'sleep-in': 4000, 'sleep-loop': null, wake: 3000,
};
export const CARE_COMMAND_CACHE_SIZE = 256;
export const CARE_SLEEP_CYCLE_MS = 18000;
