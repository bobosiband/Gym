import { createContext, useContext } from 'react';

import type { AppDependencies } from './AppDependencies.js';

/**
 * React context carrying the application's dependency bundle. The
 * context has no default (`null`) so a screen rendered outside the
 * provider surfaces as a runtime error during development rather
 * than silently using a stub.
 */
export const AppContext = createContext<AppDependencies | null>(null);

/**
 * Return the current {@link AppDependencies}. Throws if the hook is
 * used outside the provider.
 */
export function useAppDependencies(): AppDependencies {
  const deps = useContext(AppContext);
  if (deps === null) {
    throw new Error('useAppDependencies: AppContext provider missing');
  }
  return deps;
}
