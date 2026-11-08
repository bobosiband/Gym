/**
 * Vitest setup file for React widget tests. Marks the current
 * environment as an "act" environment so React 18's test utilities
 * do not emit the "not configured to support act()" warning on
 * every batched update.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
