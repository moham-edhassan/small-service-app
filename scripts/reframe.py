#!/usr/bin/env python3
import math
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np


TARGET_W = 1080
TARGET_H = 1920
TARGET_ASPECT = TARGET_W / TARGET_H


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def detect_face_center(detector, frame_rgb, width: int, height: int):
    result = detector.process(frame_rgb)
    if not result.detections:
        return None

    best = max(result.detections, key=lambda detection: detection.score[0] if detection.score else 0)
    box = best.location_data.relative_bounding_box
    cx = (box.xmin + box.width / 2.0) * width
    cy = (box.ymin + box.height / 2.0) * height
    size = max(box.width * width, box.height * height)
    return cx, cy, size


def crop_frame(frame, center_x: float, center_y: float):
    height, width = frame.shape[:2]

    if width / height > TARGET_ASPECT:
        crop_h = height
        crop_w = int(round(crop_h * TARGET_ASPECT))
    else:
        crop_w = width
        crop_h = int(round(crop_w / TARGET_ASPECT))

    crop_w = min(crop_w, width)
    crop_h = min(crop_h, height)
    x1 = int(round(clamp(center_x - crop_w / 2.0, 0, width - crop_w)))
    y1 = int(round(clamp(center_y - crop_h / 2.0, 0, height - crop_h)))
    cropped = frame[y1 : y1 + crop_h, x1 : x1 + crop_w]
    return cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: reframe.py <input.mp4> <output.mp4>")

    input_path = sys.argv[1]
    output_path = Path(sys.argv[2])

    capture = cv2.VideoCapture(input_path)
    if not capture.isOpened():
        raise SystemExit(f"Could not open {input_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_video = str(output_path.with_suffix(".silent.mp4"))
    writer = cv2.VideoWriter(temp_video, cv2.VideoWriter_fourcc(*"mp4v"), fps, (TARGET_W, TARGET_H))

    mp_face_detection = mp.solutions.face_detection
    center_x = width / 2.0
    center_y = height / 2.0
    velocity_x = 0.0
    velocity_y = 0.0
    frame_index = 0
    last_detection = None
    detection_interval = max(1, int(round(fps / 6.0)))

    with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.55) as detector:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % detection_interval == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                last_detection = detect_face_center(detector, rgb, width, height)

            if last_detection is not None:
                target_x, target_y, face_size = last_detection
                target_y = target_y - face_size * 0.12
            else:
                target_x, target_y = width / 2.0, height / 2.0

            stiffness = 0.08
            damping = 0.72
            velocity_x = velocity_x * damping + (target_x - center_x) * stiffness
            velocity_y = velocity_y * damping + (target_y - center_y) * stiffness
            max_step = width * 0.025
            center_x += clamp(velocity_x, -max_step, max_step)
            center_y += clamp(velocity_y, -max_step, max_step)

            framed = crop_frame(frame, center_x, center_y)
            writer.write(framed)
            frame_index += 1

    capture.release()
    writer.release()

    if total_frames and frame_index < max(1, math.floor(total_frames * 0.95)):
        raise SystemExit("Reframing stopped before most frames were processed")

    import subprocess

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            temp_video,
            "-i",
            input_path,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(output_path),
        ],
        check=True,
    )
    Path(temp_video).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
