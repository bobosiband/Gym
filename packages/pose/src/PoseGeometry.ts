import type { PoseLandmark } from './PoseLandmark.js';

/**
 * Pure geometric helpers used by rep detectors. Static methods; the
 * class is a namespace, never instantiated.
 */
export class PoseGeometry {
  private constructor() {
    // Not constructable.
  }

  /**
   * Angle (degrees, 0 to 180) at joint `b` formed by points `a`, `b`,
   * `c`. Operates on 2D (x, y) only; the z coordinate is ignored.
   *
   * Returns `180` when a vector is zero-length (two points coincide)
   * so a degenerate frame does not spuriously trigger a rep for a
   * detector that watches the joint fully extend.
   */
  public static jointAngleDegrees(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };
    const magAb = Math.hypot(ab.x, ab.y);
    const magCb = Math.hypot(cb.x, cb.y);
    if (magAb === 0 || magCb === 0) {
      return 180;
    }
    const dot = ab.x * cb.x + ab.y * cb.y;
    const cosine = Math.max(-1, Math.min(1, dot / (magAb * magCb)));
    const radians = Math.acos(cosine);
    return (radians * 180) / Math.PI;
  }
}
