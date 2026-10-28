import { CatalogueWorker } from './CatalogueWorker.js';

/**
 * Framework-expected entry file. Wrangler points `main` here; the default
 * export is the Worker instance Cloudflare invokes for every request.
 */
export default new CatalogueWorker();
