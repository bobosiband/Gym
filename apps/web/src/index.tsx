import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AuthApiClient } from './api/AuthApiClient.js';
import { CatalogueApiClient } from './api/CatalogueApiClient.js';
import { FetchHttpClient } from './api/FetchHttpClient.js';
import { LoggingApiClient } from './api/LoggingApiClient.js';
import { App } from './app/App.js';
import { AppContext } from './app/AppContext.js';
import type { AppDependencies } from './app/AppDependencies.js';
import { AuthorizedRequest } from './auth/AuthorizedRequest.js';
import { SessionManager } from './auth/SessionManager.js';
import { TokenStore } from './auth/TokenStore.js';
import { Env } from './config/Env.js';
import { DefaultExerciseCounterRegistryFactory } from './counters/DefaultExerciseCounterRegistryFactory.js';
import { Navigator } from './routing/Navigator.js';
import './styles.css';
import { registerServiceWorker } from './sw/registerServiceWorker.js';
import { IdempotencyKey } from './util/IdempotencyKey.js';

/**
 * Browser entry point. Wires the dependency bundle, renders the app
 * into the root element, and kicks off the service worker
 * registration asynchronously so it never blocks first paint.
 */
function main(): void {
  const env = Env.load(import.meta.env as unknown as Record<string, string | undefined>);
  const http = new FetchHttpClient();
  const authApi = new AuthApiClient(http, env.authApiUrl);
  const loggingApi = new LoggingApiClient(http, env.loggingApiUrl);
  const catalogueApi = new CatalogueApiClient(http, env.catalogueApiUrl);
  const tokenStore = new TokenStore(window.localStorage);
  const session = new SessionManager(tokenStore, authApi);
  const authorized = new AuthorizedRequest(session);
  const navigator = new Navigator(window);
  const idempotency = new IdempotencyKey();

  const exerciseCounters = DefaultExerciseCounterRegistryFactory.create();
  const deps: AppDependencies = {
    authApi,
    loggingApi,
    catalogueApi,
    session,
    authorized,
    navigator,
    newIdempotencyKey: () => idempotency.next(),
    exerciseCounters,
  };

  const rootElement = document.getElementById('root');
  if (rootElement === null) {
    throw new Error('index.tsx: #root element missing from index.html');
  }
  createRoot(rootElement).render(
    <StrictMode>
      <AppContext.Provider value={deps}>
        <App />
      </AppContext.Provider>
    </StrictMode>
  );

  void registerServiceWorker();
}

main();
