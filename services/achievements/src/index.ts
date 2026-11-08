import { AchievementsWorker } from './AchievementsWorker.js';

/**
 * Default export consumed by Wrangler. A single instance of the
 * Worker class is reused across invocations within the same isolate.
 */
const worker = new AchievementsWorker();

export default {
  fetch: worker.fetch.bind(worker),
};
