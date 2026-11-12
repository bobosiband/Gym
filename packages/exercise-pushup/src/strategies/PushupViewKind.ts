/**
 * Camera-angle classification for a push-up.
 *
 *  - `front` means the user is facing the camera; the shoulder-hip
 *    line sits close to vertical and hips or ankles are typically
 *    hidden by the torso.
 *  - `side` means the user is lying perpendicular to the camera; the
 *    shoulder-hip line sits close to horizontal and the whole body
 *    is usually visible lengthwise.
 *  - `unknown` is the initial reading before the view smoother has
 *    seen enough frames to settle, and the reading the detector
 *    reports whenever the current geometry falls between the two
 *    hysteresis bands.
 */
export type PushupViewKind = 'front' | 'side' | 'unknown';
