import type { PoseLandmarks } from '@gym/pose';

import type { PushupPositionEvaluation, PushupPositionGate } from './PushupPositionGate.js';
import type { ViewDetector } from './ViewDetector.js';
import type { PushupViewKind } from './PushupViewKind.js';

/**
 * Constructor arguments for {@link CompositePushupPositionGate}. A
 * named-object signature keeps the three collaborators readable at
 * every call site (the detector wires one per view plus the shared
 * {@link ViewDetector}).
 */
export interface CompositePushupPositionGateArgs {
  readonly viewDetector: ViewDetector;
  readonly frontGate: PushupPositionGate;
  readonly sideGate: PushupPositionGate;
}

/**
 * View-aware position gate. Observes the current view through the
 * injected {@link ViewDetector}, dispatches to either the front or
 * the side gate, and stamps the view onto the returned evaluation so
 * the UI can show it in the debug readout.
 *
 * While the view is `unknown` (initial warm-up or ambiguous geometry)
 * the composite defers to the side gate. The brief keeps the side
 * view as the historical default and this avoids rejecting frames
 * while the detector settles on a view.
 */
export class CompositePushupPositionGate implements PushupPositionGate {
  private readonly viewDetector: ViewDetector;
  private readonly frontGate: PushupPositionGate;
  private readonly sideGate: PushupPositionGate;

  public constructor(args: CompositePushupPositionGateArgs) {
    this.viewDetector = args.viewDetector;
    this.frontGate = args.frontGate;
    this.sideGate = args.sideGate;
  }

  public evaluate(landmarks: PoseLandmarks): PushupPositionEvaluation {
    const view = this.viewDetector.observe(landmarks);
    const gate = this.chooseGate(view);
    const evaluation = gate.evaluate(landmarks);
    return { ...evaluation, view };
  }

  private chooseGate(view: PushupViewKind): PushupPositionGate {
    return view === 'front' ? this.frontGate : this.sideGate;
  }
}
