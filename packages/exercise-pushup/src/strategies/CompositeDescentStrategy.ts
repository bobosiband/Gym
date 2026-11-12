import type { PoseLandmarks } from '@gym/pose';

import type { DescentStrategy } from './DescentStrategy.js';
import type { ViewDetector } from './ViewDetector.js';

/**
 * Constructor arguments for {@link CompositeDescentStrategy}.
 */
export interface CompositeDescentStrategyArgs {
  readonly viewDetector: ViewDetector;
  readonly frontStrategy: DescentStrategy;
  readonly sideStrategy: DescentStrategy;
}

/**
 * View-aware descent strategy. Keeps both underlying strategies in
 * lockstep (both receive every `reset`, `markUp`, and `observe` call)
 * so neither drifts stale if the view flips mid-rep, but delegates
 * `isDescentSufficient` to the one that matches the current view.
 *
 * When the view detector reports `unknown` (during the initial
 * warm-up or ambiguous geometry) the composite defers to the side
 * strategy, matching the dispatch rule used by
 * {@link CompositePushupPositionGate}.
 */
export class CompositeDescentStrategy implements DescentStrategy {
  private readonly viewDetector: ViewDetector;
  private readonly frontStrategy: DescentStrategy;
  private readonly sideStrategy: DescentStrategy;

  public constructor(args: CompositeDescentStrategyArgs) {
    this.viewDetector = args.viewDetector;
    this.frontStrategy = args.frontStrategy;
    this.sideStrategy = args.sideStrategy;
  }

  public reset(): void {
    this.frontStrategy.reset();
    this.sideStrategy.reset();
  }

  public markUp(landmarks: PoseLandmarks): void {
    this.frontStrategy.markUp(landmarks);
    this.sideStrategy.markUp(landmarks);
  }

  public observe(landmarks: PoseLandmarks): void {
    this.frontStrategy.observe(landmarks);
    this.sideStrategy.observe(landmarks);
  }

  public isDescentSufficient(): boolean {
    const view = this.viewDetector.getView();
    return view === 'front'
      ? this.frontStrategy.isDescentSufficient()
      : this.sideStrategy.isDescentSufficient();
  }
}
