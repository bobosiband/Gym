import type { PoseLandmark } from './PoseLandmark.js';

/**
 * Pure geometric helpers used by the rep counter. All methods are
 * static so the class is a namespace, not a service: there is no
 * state or configuration to pass in.
 */
export class ElbowAngle {
  private constructor() {
    // Not constructable.
  }

  /**
   * Angle (degrees, 0 to 180) at the elbow joint `b` formed by the
   * shoulder `a`, elbow `b`, and wrist `c` landmarks. Uses the dot
   * product on 2D (x, y) coordinates, which is enough for a rep
   * counter against a camera facing the exerciser.
   *
   * Returns `180` when a vector is zero-length (the two points
   * coincide); the counter interprets this as "arms straight" so a
   * degenerate frame does not spuriously trigger a rep.
   */
  public static betweenShoulderElbowWrist(
    shoulder: PoseLandmark,
    elbow: PoseLandmark,
    wrist: PoseLandmark
  ): number {
    const vectorA = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
    const vectorB = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
    const magA = Math.hypot(vectorA.x, vectorA.y);
    const magB = Math.hypot(vectorB.x, vectorB.y);
    if (magA === 0 || magB === 0) {
      return 180;
    }
    const dot = vectorA.x * vectorB.x + vectorA.y * vectorB.y;
    const cosine = Math.max(-1, Math.min(1, dot / (magA * magB)));
    const radians = Math.acos(cosine);
    return (radians * 180) / Math.PI;
  }
}
