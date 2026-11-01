import {
  PoseLandmarkIndex,
  type PoseLandmark,
  type PoseLandmarks,
} from '../../../apps/pushup-counter/src/PoseLandmark.js';

/**
 * Build a 33-landmark MediaPipe-shaped frame with only the indices
 * used by the push-up counter populated. The remaining slots are
 * placeholders with zero visibility so the counter ignores them.
 */
function sparseFrame(points: Partial<Record<PoseLandmarkIndex, PoseLandmark>>): PoseLandmarks {
  const result: PoseLandmark[] = [];
  for (let index = 0; index < 33; index += 1) {
    const landmark = points[index as PoseLandmarkIndex];
    result.push(landmark ?? { x: 0, y: 0, visibility: 0 });
  }
  return result;
}

/**
 * Factory for push-up frame fixtures. Positions a single arm (right
 * side) so the elbow angle is parameterised by {@link elbowAngleDeg}.
 * The shoulder sits at the origin and the elbow one unit below; the
 * wrist is placed so the angle at the elbow is exactly the requested
 * value.
 */
export function armFrameAtAngle(elbowAngleDeg: number, visibility: number = 0.95): PoseLandmarks {
  const shoulder: PoseLandmark = { x: 0, y: 0, visibility };
  const elbow: PoseLandmark = { x: 0, y: 1, visibility };
  const radians = (elbowAngleDeg * Math.PI) / 180;
  const wrist: PoseLandmark = {
    x: Math.sin(radians),
    y: 1 - Math.cos(radians),
    visibility,
  };
  return sparseFrame({
    [PoseLandmarkIndex.RightShoulder]: shoulder,
    [PoseLandmarkIndex.RightElbow]: elbow,
    [PoseLandmarkIndex.RightWrist]: wrist,
  });
}
