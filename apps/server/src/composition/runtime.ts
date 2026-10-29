import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '@aegis/domain';

/** Process clock producing canonical ISO-8601 UTC timestamps (ms precision). */
export const systemClock: Clock = {
	now: () => new Date().toISOString(),
};

/** Entity id generator backed by the platform CSPRNG. */
export const uuidGenerator: IdGenerator = {
	generate: () => randomUUID(),
};
