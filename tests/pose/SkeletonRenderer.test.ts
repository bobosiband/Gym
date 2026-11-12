import { describe, expect, it } from 'vitest';

import { PoseLandmarkIndex, type PoseLandmark } from '../../packages/pose/src/PoseLandmark.js';
import { SkeletonRenderer } from '../../packages/pose/src/browser/SkeletonRenderer.js';

type DrawCall =
  | { readonly op: 'strokeStyle'; readonly value: string }
  | { readonly op: 'fillStyle'; readonly value: string }
  | { readonly op: 'moveTo'; readonly x: number; readonly y: number }
  | { readonly op: 'lineTo'; readonly x: number; readonly y: number }
  | { readonly op: 'stroke' }
  | { readonly op: 'fill' }
  | { readonly op: 'clearRect' }
  | { readonly op: 'arc'; readonly x: number; readonly y: number; readonly r: number }
  | { readonly op: 'setTransform'; readonly a: number; readonly d: number; readonly e: number };

/**
 * Minimal stand-in for CanvasRenderingContext2D. The renderer only
 * uses the methods below, so the stub records them in order. This
 * keeps the pose package tests node-only (no jsdom, no node-canvas).
 */
class StubContext {
  public readonly calls: DrawCall[] = [];
  private _strokeStyle: string = '#000';
  private _fillStyle: string = '#000';
  public lineWidth: number = 1;

  public get strokeStyle(): string {
    return this._strokeStyle;
  }
  public set strokeStyle(value: string) {
    this._strokeStyle = value;
    this.calls.push({ op: 'strokeStyle', value });
  }
  public get fillStyle(): string {
    return this._fillStyle;
  }
  public set fillStyle(value: string) {
    this._fillStyle = value;
    this.calls.push({ op: 'fillStyle', value });
  }

  public beginPath(): void {}
  public save(): void {}
  public restore(): void {}
  public moveTo(x: number, y: number): void {
    this.calls.push({ op: 'moveTo', x, y });
  }
  public lineTo(x: number, y: number): void {
    this.calls.push({ op: 'lineTo', x, y });
  }
  public stroke(): void {
    this.calls.push({ op: 'stroke' });
  }
  public fill(): void {
    this.calls.push({ op: 'fill' });
  }
  public clearRect(): void {
    this.calls.push({ op: 'clearRect' });
  }
  public arc(x: number, y: number, r: number): void {
    this.calls.push({ op: 'arc', x, y, r });
  }
  public setTransform(a: number, _b: number, _c: number, d: number, e: number): void {
    this.calls.push({ op: 'setTransform', a, d, e });
  }
}

function emptyLandmarks(): PoseLandmark[] {
  const result: PoseLandmark[] = [];
  for (let i = 0; i < 33; i += 1) {
    result.push({ x: 0, y: 0, visibility: 0 });
  }
  return result;
}

function fullBodyLandmarks(visibility: number = 0.95): PoseLandmark[] {
  const frame = emptyLandmarks();
  frame[PoseLandmarkIndex.LeftShoulder] = { x: 0.3, y: 0.4, visibility };
  frame[PoseLandmarkIndex.RightShoulder] = { x: 0.7, y: 0.4, visibility };
  frame[PoseLandmarkIndex.LeftElbow] = { x: 0.3, y: 0.5, visibility };
  frame[PoseLandmarkIndex.RightElbow] = { x: 0.7, y: 0.5, visibility };
  frame[PoseLandmarkIndex.LeftWrist] = { x: 0.3, y: 0.6, visibility };
  frame[PoseLandmarkIndex.RightWrist] = { x: 0.7, y: 0.6, visibility };
  frame[PoseLandmarkIndex.LeftHip] = { x: 0.35, y: 0.6, visibility };
  frame[PoseLandmarkIndex.RightHip] = { x: 0.65, y: 0.6, visibility };
  frame[PoseLandmarkIndex.LeftKnee] = { x: 0.35, y: 0.75, visibility };
  frame[PoseLandmarkIndex.RightKnee] = { x: 0.65, y: 0.75, visibility };
  frame[PoseLandmarkIndex.LeftAnkle] = { x: 0.35, y: 0.9, visibility };
  frame[PoseLandmarkIndex.RightAnkle] = { x: 0.65, y: 0.9, visibility };
  return frame;
}

const SIZE = { width: 640, height: 480 };

describe('SkeletonRenderer', () => {
  it('clears the canvas before drawing', () => {
    const ctx = new StubContext();
    const renderer = new SkeletonRenderer();
    renderer.render(ctx as unknown as CanvasRenderingContext2D, fullBodyLandmarks(), SIZE, {
      mirrored: false,
    });
    expect(ctx.calls[0]?.op).toBe('setTransform');
    expect(ctx.calls[1]?.op).toBe('clearRect');
  });

  it('draws segments and joints in the good colour when every endpoint is confident', () => {
    const ctx = new StubContext();
    const renderer = new SkeletonRenderer({
      goodColor: '#00ff00',
      lowConfidenceColor: '#999999',
    });
    renderer.render(ctx as unknown as CanvasRenderingContext2D, fullBodyLandmarks(), SIZE, {
      mirrored: false,
    });
    const strokeColours = ctx.calls
      .filter((call): call is Extract<DrawCall, { op: 'strokeStyle' }> => call.op === 'strokeStyle')
      .map((call) => call.value);
    const fillColours = ctx.calls
      .filter((call): call is Extract<DrawCall, { op: 'fillStyle' }> => call.op === 'fillStyle')
      .map((call) => call.value);
    expect(strokeColours.every((c) => c === '#00ff00')).toBe(true);
    expect(fillColours.every((c) => c === '#00ff00')).toBe(true);
  });

  it('uses the low-confidence colour for segments whose endpoint is below the visibility threshold', () => {
    const ctx = new StubContext();
    const renderer = new SkeletonRenderer({
      goodColor: '#00ff00',
      lowConfidenceColor: '#777777',
      minVisibility: 0.5,
    });
    const landmarks = fullBodyLandmarks();
    landmarks[PoseLandmarkIndex.LeftWrist] = { x: 0.3, y: 0.6, visibility: 0.1 };
    renderer.render(ctx as unknown as CanvasRenderingContext2D, landmarks, SIZE, {
      mirrored: false,
    });
    const strokeColours = ctx.calls
      .filter((call): call is Extract<DrawCall, { op: 'strokeStyle' }> => call.op === 'strokeStyle')
      .map((call) => call.value);
    expect(strokeColours).toContain('#777777');
    expect(strokeColours).toContain('#00ff00');
  });

  it('applies a mirrored transform when mirrored is true', () => {
    const ctx = new StubContext();
    const renderer = new SkeletonRenderer();
    renderer.render(ctx as unknown as CanvasRenderingContext2D, fullBodyLandmarks(), SIZE, {
      mirrored: true,
    });
    const mirrorTransform = ctx.calls.find(
      (call): call is Extract<DrawCall, { op: 'setTransform' }> =>
        call.op === 'setTransform' && call.a === -1 && call.e === SIZE.width
    );
    expect(mirrorTransform).toBeDefined();
  });

  it('does not apply a mirrored transform when mirrored is false', () => {
    const ctx = new StubContext();
    const renderer = new SkeletonRenderer();
    renderer.render(ctx as unknown as CanvasRenderingContext2D, fullBodyLandmarks(), SIZE, {
      mirrored: false,
    });
    const mirrorTransform = ctx.calls.find(
      (call): call is Extract<DrawCall, { op: 'setTransform' }> =>
        call.op === 'setTransform' && call.a === -1
    );
    expect(mirrorTransform).toBeUndefined();
  });

  it('clear emits a clearRect at identity transform', () => {
    const ctx = new StubContext();
    const renderer = new SkeletonRenderer();
    renderer.clear(ctx as unknown as CanvasRenderingContext2D, SIZE);
    expect(ctx.calls).toContainEqual({ op: 'setTransform', a: 1, d: 1, e: 0 });
    expect(ctx.calls).toContainEqual({ op: 'clearRect' });
  });
});
