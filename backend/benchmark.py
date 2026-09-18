"""
benchmark.py — Offline accuracy + latency benchmarking for Coil OCR
=====================================================================
Usage:
  # With ground-truth CSV (image_path,expected_code)
  python benchmark.py --csv ground_truth.csv

  # Latency-only (no ground truth)
  python benchmark.py --dir ./test_images/

  # Single image debug mode (saves all intermediate images)
  python benchmark.py --debug path/to/coil.jpg
"""

import argparse
import csv
import logging
import time
from pathlib import Path

import cv2
import numpy as np

from ocr_service import (
    OcrResult, build_variants, clahe, denoise, detect_coil_circle,
    detect_text, polar_unwrap, remove_glare, to_gray, unwrap_rotations,
    upscale,
)

log = logging.getLogger("benchmark")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")


# ── Ground-truth accuracy benchmark ──────────────────────────────────────────

def run_accuracy_benchmark(csv_path: Path):
    """
    Evaluate OCR accuracy against a labeled CSV.
    CSV format: image_path,expected_code
    """
    rows = []
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((Path(row["image_path"]), row["expected_code"].strip().upper()))

    correct = 0
    partial = 0  # correct but different confidence
    total = len(rows)
    latencies = []

    print(f"\n{'Image':<35} {'Expected':<15} {'Got':<15} {'Conf':>6} {'ms':>6} {'✓'}")
    print("─" * 85)

    for path, expected in rows:
        if not path.exists():
            print(f"{str(path):<35} {'—':<15} {'FILE NOT FOUND':<15}")
            continue

        result: OcrResult = detect_text(str(path))
        latencies.append(result.latency_ms)

        match = "✓" if result.code == expected else "✗"
        if result.code == expected:
            correct += 1

        print(f"{path.name:<35} {expected:<15} {result.code or '—':<15} "
              f"{result.confidence:>5.1%} {result.latency_ms:>5.0f} {match}")

    print("─" * 85)
    print(f"\nResults: {correct}/{total} correct  ({correct/total:.1%} accuracy)")
    if latencies:
        print(f"Latency: avg={sum(latencies)/len(latencies):.0f}ms  "
              f"p95={sorted(latencies)[int(len(latencies)*0.95)]:.0f}ms  "
              f"max={max(latencies):.0f}ms")


# ── Latency-only benchmark ────────────────────────────────────────────────────

def run_latency_benchmark(image_dir: Path, n_warmup: int = 2):
    images = sorted(image_dir.glob("*.jpg")) + sorted(image_dir.glob("*.png"))
    if not images:
        print(f"No images found in {image_dir}")
        return

    # Warmup
    for img in images[:n_warmup]:
        detect_text(str(img))

    latencies = []
    for img in images:
        r = detect_text(str(img))
        latencies.append(r.latency_ms)
        print(f"  {img.name:<35} {r.code or '—':<15} {r.confidence:.1%}  {r.latency_ms:.0f}ms")

    print(f"\nLatency P50={sorted(latencies)[len(latencies)//2]:.0f}ms  "
          f"P95={sorted(latencies)[int(len(latencies)*0.95)]:.0f}ms  "
          f"Max={max(latencies):.0f}ms")


# ── Debug mode: save intermediate images ─────────────────────────────────────

def debug_single(image_path: Path, out_dir: Path = Path("debug_out")):
    """
    Run pipeline and save every intermediate image for visual inspection.
    Crucial for tuning parameters on new coil types.
    """
    out_dir.mkdir(exist_ok=True)
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"Cannot read {image_path}")
        return

    gray = to_gray(img)
    cv2.imwrite(str(out_dir / "01_gray.jpg"), gray)

    clean = remove_glare(gray)
    cv2.imwrite(str(out_dir / "02_glare_removed.jpg"), clean)

    circle = detect_coil_circle(clean)
    if circle:
        cx, cy, r = circle
        vis = cv2.cvtColor(clean, cv2.COLOR_GRAY2BGR)
        cv2.circle(vis, (cx, cy), r, (0, 255, 0), 3)
        cv2.circle(vis, (cx, cy), 5, (0, 0, 255), -1)
        cv2.imwrite(str(out_dir / "03_circle_detection.jpg"), vis)

        strip = polar_unwrap(clean, cx, cy, r)
        cv2.imwrite(str(out_dir / "04_polar_unwrap.jpg"), strip)

        strips = unwrap_rotations(strip, n=4)
        for i, s in enumerate(strips):
            cv2.imwrite(str(out_dir / f"05_rotation_{i}.jpg"), s)

            for name, variant in build_variants(s):
                cv2.imwrite(str(out_dir / f"06_strip{i}_{name}.jpg"), variant)
    else:
        print("No circle detected — check 02_glare_removed.jpg")

    result = detect_text(str(image_path))
    print(f"\nResult: {result}")
    print(f"Debug images saved to: {out_dir.resolve()}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Coil OCR Benchmark")
    parser.add_argument("--csv", help="Ground-truth CSV (image_path,expected_code)")
    parser.add_argument("--dir", help="Directory of images for latency benchmark")
    parser.add_argument("--debug", help="Single image debug mode")
    parser.add_argument("--debug-out", default="debug_out",
                        help="Output dir for debug images (default: debug_out)")
    args = parser.parse_args()

    if args.debug:
        debug_single(Path(args.debug), Path(args.debug_out))
    elif args.csv:
        run_accuracy_benchmark(Path(args.csv))
    elif args.dir:
        run_latency_benchmark(Path(args.dir))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()