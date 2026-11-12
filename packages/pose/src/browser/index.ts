/**
 * Browser-only entry point for `@gym/pose`.
 *
 * Exports adapters that require the DOM (cameras, canvases). Node
 * consumers import from `@gym/pose` (the default entry) and never
 * see these types.
 */

export { MediaPipePoseSource } from './MediaPipePoseSource.js';
export type { MediaPipePoseSourceOptions } from './MediaPipePoseSource.js';
export { SkeletonRenderer } from './SkeletonRenderer.js';
export type {
  CanvasSize,
  SkeletonRenderOptions,
  SkeletonRendererOptions,
} from './SkeletonRenderer.js';
