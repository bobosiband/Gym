import {
  PoseLandmarkIndex,
  type PoseLandmark,
  type PoseLandmarks,
} from '../../../packages/pose/src/PoseLandmark.js';

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

/**
 * Parameters for {@link pushupFrame}. All inputs are in normalised
 * image coordinates (x increases right, y increases down) matching
 * MediaPipe Pose output. Ankles default to one torso-length past the
 * hips along the same x-axis so the body is a straight horizontal
 * line.
 */
export interface PushupFrameParams {
  /** Elbow angle per side (degrees). */
  readonly leftElbowDeg: number;
  readonly rightElbowDeg: number;
  /**
   * Shoulder y in normalised coords. Defaults to 0.5. Push-up down
   * phase increases this value; up phase decreases it.
   */
  readonly shoulderY?: number;
  /** Hip y in normalised coords. Defaults to `shoulderY + 0.02` (plank). */
  readonly hipY?: number;
  /**
   * Ankle y in normalised coords. Defaults to `hipY` for a straight
   * body. Lower the value (smaller y) to pike, raise it to sag.
   */
  readonly ankleY?: number;
  /** Visibility applied to every landmark. */
  readonly visibility?: number;
  /**
   * Visibility applied to the left elbow and wrist only (defaults to
   * `visibility`). Use this to model realistic single-arm occlusion
   * where the shoulder and torso are still visible but the limb is
   * out of frame or hidden by the body.
   */
  readonly leftArmVisibility?: number;
  /** Visibility applied to the right elbow and wrist only (defaults to `visibility`). */
  readonly rightArmVisibility?: number;
}

/**
 * Factory for whole-body push-up fixtures (side view). Returns a
 * 33-landmark frame with the nose, both arms, both hips, both knees,
 * and both ankles filled in so the posture gate, shoulder-drop
 * strategy, and elbow angle strategy can all be driven from a single
 * call.
 *
 * Body geometry (the user is horizontal to the camera):
 *  - Shoulders sit at `(0.35, shoulderY)` (left) and `(0.65, shoulderY)` (right).
 *  - Hips sit at `(0.55, hipY)` and `(0.85, hipY)` (0.2 along the body x-axis
 *    from the shoulders).
 *  - Knees halfway between hips and ankles on the same x-axis.
 *  - Ankles 0.2 past the hips in x.
 *  - Nose sits just above the shoulder midpoint so the front-view
 *    gate can see a face without the shoulder-hip tilt moving into
 *    the front band.
 *  - Elbows sit one unit below the shoulders in the local arm frame;
 *    the elbow angle is parameterised exactly by `leftElbowDeg` and
 *    `rightElbowDeg` the same way {@link armFrameAtAngle} does.
 */
export function pushupFrame(params: PushupFrameParams): PoseLandmarks {
  const shoulderY = params.shoulderY ?? 0.5;
  const hipY = params.hipY ?? shoulderY + 0.02;
  const ankleY = params.ankleY ?? hipY;
  const visibility = params.visibility ?? 0.95;
  const leftArmVisibility = params.leftArmVisibility ?? visibility;
  const rightArmVisibility = params.rightArmVisibility ?? visibility;
  const leftShoulderX = 0.35;
  const rightShoulderX = 0.65;
  const leftHipX = leftShoulderX + 0.2;
  const rightHipX = rightShoulderX + 0.2;
  const leftAnkleX = leftHipX + 0.2;
  const rightAnkleX = rightHipX + 0.2;
  const leftKneeX = (leftHipX + leftAnkleX) / 2;
  const rightKneeX = (rightHipX + rightAnkleX) / 2;
  const kneeY = (hipY + ankleY) / 2;

  const leftShoulder: PoseLandmark = { x: leftShoulderX, y: shoulderY, visibility };
  const rightShoulder: PoseLandmark = {
    x: rightShoulderX,
    y: shoulderY,
    visibility,
  };
  const noseX = (leftShoulderX + rightShoulderX) / 2;
  const nose: PoseLandmark = { x: noseX, y: shoulderY - 0.03, visibility };
  const leftRad = (params.leftElbowDeg * Math.PI) / 180;
  const rightRad = (params.rightElbowDeg * Math.PI) / 180;
  const leftElbow: PoseLandmark = {
    x: leftShoulderX,
    y: shoulderY + 0.1,
    visibility: leftArmVisibility,
  };
  const leftWrist: PoseLandmark = {
    x: leftShoulderX + Math.sin(leftRad) * 0.1,
    y: shoulderY + 0.1 - Math.cos(leftRad) * 0.1,
    visibility: leftArmVisibility,
  };
  const rightElbow: PoseLandmark = {
    x: rightShoulderX,
    y: shoulderY + 0.1,
    visibility: rightArmVisibility,
  };
  const rightWrist: PoseLandmark = {
    x: rightShoulderX + Math.sin(rightRad) * 0.1,
    y: shoulderY + 0.1 - Math.cos(rightRad) * 0.1,
    visibility: rightArmVisibility,
  };
  const leftHip: PoseLandmark = { x: leftHipX, y: hipY, visibility };
  const rightHip: PoseLandmark = { x: rightHipX, y: hipY, visibility };
  const leftKnee: PoseLandmark = { x: leftKneeX, y: kneeY, visibility };
  const rightKnee: PoseLandmark = { x: rightKneeX, y: kneeY, visibility };
  const leftAnkle: PoseLandmark = { x: leftAnkleX, y: ankleY, visibility };
  const rightAnkle: PoseLandmark = { x: rightAnkleX, y: ankleY, visibility };

  return sparseFrame({
    [PoseLandmarkIndex.Nose]: nose,
    [PoseLandmarkIndex.LeftShoulder]: leftShoulder,
    [PoseLandmarkIndex.RightShoulder]: rightShoulder,
    [PoseLandmarkIndex.LeftElbow]: leftElbow,
    [PoseLandmarkIndex.RightElbow]: rightElbow,
    [PoseLandmarkIndex.LeftWrist]: leftWrist,
    [PoseLandmarkIndex.RightWrist]: rightWrist,
    [PoseLandmarkIndex.LeftHip]: leftHip,
    [PoseLandmarkIndex.RightHip]: rightHip,
    [PoseLandmarkIndex.LeftKnee]: leftKnee,
    [PoseLandmarkIndex.RightKnee]: rightKnee,
    [PoseLandmarkIndex.LeftAnkle]: leftAnkle,
    [PoseLandmarkIndex.RightAnkle]: rightAnkle,
  });
}

/**
 * Readable alias around {@link pushupFrame}. Spells out "side view"
 * at the call site so side-view tests do not look like they could
 * also be front-view by accident.
 */
export function sidePushupFrame(params: PushupFrameParams): PoseLandmarks {
  return pushupFrame(params);
}

/**
 * Factory for a seated-arm-bend failure scenario: torso is vertical
 * (shoulders directly above hips), hips above knees which are above
 * ankles. Elbow angle is still parameterised so a test can bend the
 * arms without ever being in a push-up position.
 */
export function seatedFrame(elbowAngleDeg: number, visibility: number = 0.95): PoseLandmarks {
  const shoulderY = 0.2;
  const hipY = 0.5;
  const kneeY = 0.7;
  const ankleY = 0.9;
  const leftX = 0.45;
  const rightX = 0.55;
  const rad = (elbowAngleDeg * Math.PI) / 180;
  const nose: PoseLandmark = { x: (leftX + rightX) / 2, y: shoulderY - 0.05, visibility };
  const leftShoulder: PoseLandmark = { x: leftX, y: shoulderY, visibility };
  const rightShoulder: PoseLandmark = { x: rightX, y: shoulderY, visibility };
  const leftElbow: PoseLandmark = { x: leftX - 0.05, y: shoulderY + 0.1, visibility };
  const rightElbow: PoseLandmark = { x: rightX + 0.05, y: shoulderY + 0.1, visibility };
  const leftWrist: PoseLandmark = {
    x: leftX - 0.05 + Math.sin(rad) * 0.1,
    y: shoulderY + 0.1 - Math.cos(rad) * 0.1,
    visibility,
  };
  const rightWrist: PoseLandmark = {
    x: rightX + 0.05 + Math.sin(rad) * 0.1,
    y: shoulderY + 0.1 - Math.cos(rad) * 0.1,
    visibility,
  };
  const leftHip: PoseLandmark = { x: leftX, y: hipY, visibility };
  const rightHip: PoseLandmark = { x: rightX, y: hipY, visibility };
  const leftKnee: PoseLandmark = { x: leftX, y: kneeY, visibility };
  const rightKnee: PoseLandmark = { x: rightX, y: kneeY, visibility };
  const leftAnkle: PoseLandmark = { x: leftX, y: ankleY, visibility };
  const rightAnkle: PoseLandmark = { x: rightX, y: ankleY, visibility };
  return sparseFrame({
    [PoseLandmarkIndex.Nose]: nose,
    [PoseLandmarkIndex.LeftShoulder]: leftShoulder,
    [PoseLandmarkIndex.RightShoulder]: rightShoulder,
    [PoseLandmarkIndex.LeftElbow]: leftElbow,
    [PoseLandmarkIndex.RightElbow]: rightElbow,
    [PoseLandmarkIndex.LeftWrist]: leftWrist,
    [PoseLandmarkIndex.RightWrist]: rightWrist,
    [PoseLandmarkIndex.LeftHip]: leftHip,
    [PoseLandmarkIndex.RightHip]: rightHip,
    [PoseLandmarkIndex.LeftKnee]: leftKnee,
    [PoseLandmarkIndex.RightKnee]: rightKnee,
    [PoseLandmarkIndex.LeftAnkle]: leftAnkle,
    [PoseLandmarkIndex.RightAnkle]: rightAnkle,
  });
}

/**
 * Parameters for {@link frontPushupFrame}. Hips default to invisible
 * so front-view tests exercise the hip-absent paths of the view
 * detector and the side-view fallback.
 */
export interface FrontPushupFrameParams {
  /** Elbow angle per side (degrees). */
  readonly leftElbowDeg: number;
  readonly rightElbowDeg: number;
  /**
   * Shoulder y in normalised coords. Defaults to 0.3 so a 0.1-long
   * arm can drop the wrists to around 0.4, well above the frame edge.
   */
  readonly shoulderY?: number;
  /** Half-width of the shoulder line in normalised coords. Defaults to 0.15. */
  readonly shoulderHalfWidth?: number;
  /** Visibility applied to visible landmarks. */
  readonly visibility?: number;
  /** When true, include hips and ankles so the view detector can read tilt. */
  readonly hipsVisible?: boolean;
  /** Visibility applied to the left elbow and wrist only. */
  readonly leftArmVisibility?: number;
  /** Visibility applied to the right elbow and wrist only. */
  readonly rightArmVisibility?: number;
  /**
   * When `true` the arms extend upward from the shoulders (elbows
   * above the shoulder line) so the wrists end up above the
   * shoulders, matching an "arms-raised wave" scenario. Default
   * `false`: arms extend downward as in a real push-up.
   */
  readonly armsUp?: boolean;
}

/**
 * Factory for a front-view push-up fixture. The user faces the
 * camera: shoulders are wide, nose is just above the shoulder line,
 * and the arms drop below the shoulders so the front posture gate
 * sees wrists below shoulders. Hips and ankles are absent by default
 * so the view detector falls back to the shoulder-width-vs-arm-reach
 * ratio, exercising the no-hip path.
 */
export function frontPushupFrame(params: FrontPushupFrameParams): PoseLandmarks {
  const shoulderY = params.shoulderY ?? 0.3;
  const shoulderHalfWidth = params.shoulderHalfWidth ?? 0.15;
  const visibility = params.visibility ?? 0.95;
  const leftArmVisibility = params.leftArmVisibility ?? visibility;
  const rightArmVisibility = params.rightArmVisibility ?? visibility;

  const leftShoulderX = 0.5 - shoulderHalfWidth;
  const rightShoulderX = 0.5 + shoulderHalfWidth;
  const leftShoulder: PoseLandmark = { x: leftShoulderX, y: shoulderY, visibility };
  const rightShoulder: PoseLandmark = { x: rightShoulderX, y: shoulderY, visibility };
  const nose: PoseLandmark = { x: 0.5, y: shoulderY - 0.1, visibility };

  const leftRad = (params.leftElbowDeg * Math.PI) / 180;
  const rightRad = (params.rightElbowDeg * Math.PI) / 180;
  const direction = params.armsUp === true ? -1 : 1;
  const elbowY = shoulderY + direction * 0.1;
  const leftElbow: PoseLandmark = {
    x: leftShoulderX,
    y: elbowY,
    visibility: leftArmVisibility,
  };
  const leftWrist: PoseLandmark = {
    x: leftShoulderX - Math.sin(leftRad) * 0.1,
    y: elbowY - direction * Math.cos(leftRad) * 0.1,
    visibility: leftArmVisibility,
  };
  const rightElbow: PoseLandmark = {
    x: rightShoulderX,
    y: elbowY,
    visibility: rightArmVisibility,
  };
  const rightWrist: PoseLandmark = {
    x: rightShoulderX + Math.sin(rightRad) * 0.1,
    y: elbowY - direction * Math.cos(rightRad) * 0.1,
    visibility: rightArmVisibility,
  };

  const points: Partial<Record<PoseLandmarkIndex, PoseLandmark>> = {
    [PoseLandmarkIndex.Nose]: nose,
    [PoseLandmarkIndex.LeftShoulder]: leftShoulder,
    [PoseLandmarkIndex.RightShoulder]: rightShoulder,
    [PoseLandmarkIndex.LeftElbow]: leftElbow,
    [PoseLandmarkIndex.RightElbow]: rightElbow,
    [PoseLandmarkIndex.LeftWrist]: leftWrist,
    [PoseLandmarkIndex.RightWrist]: rightWrist,
  };

  if (params.hipsVisible === true) {
    const hipY = shoulderY + 0.2;
    points[PoseLandmarkIndex.LeftHip] = { x: leftShoulderX, y: hipY, visibility };
    points[PoseLandmarkIndex.RightHip] = { x: rightShoulderX, y: hipY, visibility };
  }

  return sparseFrame(points);
}

/**
 * A completely empty frame (every landmark at zero visibility).
 * Useful to drive the dropout-tolerance test path where no landmark
 * is trackable this frame.
 */
export function dropoutFrame(): PoseLandmarks {
  return sparseFrame({});
}
