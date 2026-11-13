"""Generate MediaPipe Pose landmark fixtures from video clips.

Usage:
    python scripts/pose_fixture_generator.py \
        --video test-videos/front-10.mov \
        --output packages/exercise-pushup/test/fixtures/front-10.json \
        --model /tmp/mp_models/pose_landmarker_full.task \
        --target-fps 10

The script samples the video at ``target_fps`` (default 10), runs
MediaPipe Pose on every sampled frame via the Tasks API, and writes a
JSON file of the form::

    {
      "source": "front-10.mov",
      "width": 1920,
      "height": 1080,
      "frames": [
        {
          "timestampMs": 0,
          "landmarks": [
            {"x": 0.52, "y": 0.41, "z": -0.1, "visibility": 0.98},
            ...
          ]
        },
        ...
      ]
    }

Landmarks follow the MediaPipe Pose 33-point index layout. ``x`` and
``y`` are normalised to ``[0, 1]``; ``z`` and ``visibility`` are taken
directly from MediaPipe.

The repo ignores ``test-videos/`` so the raw clips never leak into git;
only the generated JSONs are committed.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List

import cv2  # type: ignore[import]
import mediapipe as mp  # type: ignore[import]
from mediapipe.tasks.python import vision  # type: ignore[import]
from mediapipe.tasks.python.core.base_options import BaseOptions  # type: ignore[import]


@dataclass(frozen=True)
class Landmark:
    """Flattened MediaPipe landmark, JSON-serialisable."""

    x: float
    y: float
    z: float
    visibility: float


@dataclass(frozen=True)
class Frame:
    """One sampled video frame plus its pose landmarks."""

    timestamp_ms: int
    landmarks: List[Landmark]


def extract(video_path: Path, model_path: Path, target_fps: float) -> tuple[int, int, List[Frame]]:
    """Run MediaPipe Pose over ``video_path`` at ``target_fps``.

    Returns the video resolution (width, height) and the list of
    sampled frames. Frames without a detected pose are represented by
    33 zero-visibility placeholder landmarks so the fixture length
    equals the number of sampled frames.
    """

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {video_path}")
    source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    sample_interval = max(1, int(round(source_fps / target_fps)))
    frames: List[Frame] = []

    options = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_segmentation_masks=False,
    )
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        index = 0
        sampled = 0
        while True:
            ok, bgr = capture.read()
            if not ok:
                break
            if index % sample_interval == 0:
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int(round((sampled / target_fps) * 1000))
                result = landmarker.detect_for_video(image, timestamp_ms)
                landmarks: List[Landmark] = []
                if result.pose_landmarks:
                    pose = result.pose_landmarks[0]
                    for lm in pose:
                        landmarks.append(
                            Landmark(
                                x=float(lm.x),
                                y=float(lm.y),
                                z=float(lm.z),
                                visibility=float(lm.visibility),
                            )
                        )
                else:
                    landmarks = [Landmark(0.0, 0.0, 0.0, 0.0) for _ in range(33)]
                frames.append(Frame(timestamp_ms=timestamp_ms, landmarks=landmarks))
                sampled += 1
            index += 1
    capture.release()
    return width, height, frames


def write_fixture(output_path: Path, source_name: str, width: int, height: int, frames: List[Frame]) -> None:
    """Serialise ``frames`` as a JSON fixture at ``output_path``."""

    payload = {
        "source": source_name,
        "width": width,
        "height": height,
        "frames": [
            {
                "timestampMs": frame.timestamp_ms,
                "landmarks": [
                    {
                        "x": lm.x,
                        "y": lm.y,
                        "z": lm.z,
                        "visibility": lm.visibility,
                    }
                    for lm in frame.landmarks
                ],
            }
            for frame in frames
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle)
        handle.write("\n")


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Generate pose fixtures from video clips.")
    parser.add_argument("--video", type=Path, required=True, help="Input video file (mov or mp4).")
    parser.add_argument("--output", type=Path, required=True, help="Output JSON path.")
    parser.add_argument("--model", type=Path, required=True, help="PoseLandmarker .task model.")
    parser.add_argument("--target-fps", type=float, default=10.0, help="Sampling rate (Hz).")
    args = parser.parse_args(argv)

    width, height, frames = extract(args.video, args.model, args.target_fps)
    write_fixture(args.output, args.video.name, width, height, frames)
    print(f"Wrote {args.output} ({len(frames)} frames)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
