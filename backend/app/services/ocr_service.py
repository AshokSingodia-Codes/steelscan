"""
ocr_service.py — ROI-first Hybrid Industrial Coil OCR

Best for:
- white painted numbers on steel coil
- vertical / tilted / curved text
- low contrast industrial images
- faster than full-image OCR loops

Workflow:
1. Detect white painted digit regions using OpenCV
2. Create rotated/cropped ROI candidates
3. Run PaddleOCR first on small ROIs
4. If needed, run EasyOCR fallback only on best ROIs
5. Vote/stitch digit candidates

IMPORTANT WINDOWS FIX:
Torch is preloaded before PaddleOCR.
On Windows, if PaddleOCR/Paddle loads first and EasyOCR/Torch loads later,
Torch may fail with:
WinError 127 torch/lib/shm.dll
"""

from __future__ import annotations

import logging
import os
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session
from app.services.learning_service import learning_engine

# ============================================================
# WINDOWS DLL LOAD ORDER FIX
# ============================================================
# This must run BEFORE PaddleOCR/Paddle is imported anywhere.
# Your debug proved:
#   PaddleOCR first -> Torch later -> shm.dll WinError 127
#   Torch first     -> Paddle later -> OK
try:
    import torch  # noqa: F401

    TORCH_PRELOAD_OK = True
    TORCH_PRELOAD_ERROR = None
    TORCH_PRELOAD_VERSION = torch.__version__
except Exception as exc:
    TORCH_PRELOAD_OK = False
    TORCH_PRELOAD_ERROR = str(exc)
    TORCH_PRELOAD_VERSION = "unavailable"

import cv2
import numpy as np

log = logging.getLogger("coil_ocr")

if TORCH_PRELOAD_OK:
    log.info(f"Torch preloaded before PaddleOCR: {TORCH_PRELOAD_VERSION}")
else:
    log.warning(f"Torch preload failed before PaddleOCR: {TORCH_PRELOAD_ERROR}")


# ============================================================
# CONFIG
# ============================================================

MIN_LEN = 8
MAX_LEN = 16
TARGET_LEN = 10

MAX_IMAGE_DIM = 1600

MAX_PADDLE_CALLS = 18
MAX_EASY_CALLS = 8

PADDLE_FAST_EXIT_CONF = 0.80
VOTE_FAST_EXIT_CONF = 0.55

CODE_RE = re.compile(r"^[0-9]{8,16}$")
NOISE_RE = re.compile(r"^(.)\1{5,}$")

_paddle_cache: dict = {}
_easy_cache: dict = {}


# ============================================================
# RESULT MODEL — keep compatible with main.py
# ============================================================

@dataclass
class OcrResult:
    code: str = ""
    confidence: float = 0.0
    vote_count: int = 0
    total_votes: int = 0
    latency_ms: float = 0.0
    pipeline_used: str = ""
    candidates: list = field(default_factory=list)

    @property
    def success(self) -> bool:
        return bool(self.code) and self.confidence >= 0.25

    def __str__(self) -> str:
        if self.success:
            return (
                f"✓ {self.code} conf={self.confidence:.0%} "
                f"votes={self.vote_count}/{self.total_votes} "
                f"{self.latency_ms:.0f}ms [{self.pipeline_used}]"
            )
        return f"✗ No code {self.latency_ms:.0f}ms"


# ============================================================
# OCR ENGINES
# ============================================================

def _get_paddle():
    pid = os.getpid()

    if pid not in _paddle_cache:
        # Safety: ensure torch is already loaded before Paddle.
        # Do not remove this. It prevents Windows DLL order conflict.
        if not TORCH_PRELOAD_OK:
            raise RuntimeError(
                f"Torch preload failed before PaddleOCR: {TORCH_PRELOAD_ERROR}"
            )

        from paddleocr import PaddleOCR

        log.info("Initialising PaddleOCR ROI mode...")

        attempts = [
            {
                "lang": "en",
                "use_angle_cls": False,
                "device": "cpu",
                "show_log": False,
            },
            {
                "lang": "en",
                "use_angle_cls": False,
                "device": "cpu",
            },
            {
                "lang": "en",
                "use_angle_cls": False,
                "use_gpu": False,
                "show_log": False,
            },
            {
                "lang": "en",
                "use_gpu": False,
            },
            {
                "lang": "en",
            },
        ]

        last_error = None

        for kwargs in attempts:
            try:
                _paddle_cache[pid] = PaddleOCR(**kwargs)
                log.info(f"PaddleOCR ready: {list(kwargs.keys())}")
                break
            except Exception as exc:
                last_error = exc

        if pid not in _paddle_cache:
            raise RuntimeError(f"PaddleOCR init failed: {last_error}")

    return _paddle_cache[pid]


def _get_easyocr():
    pid = os.getpid()

    if pid not in _easy_cache:
        # Safety: torch is already imported at module load.
        # Importing easyocr after this should not reload torch DLLs.
        if not TORCH_PRELOAD_OK:
            raise RuntimeError(
                f"EasyOCR cannot start because Torch preload failed: {TORCH_PRELOAD_ERROR}"
            )

        import easyocr

        model_dir = os.environ.get("EASYOCR_MODEL_DIR", "./ocr_models/easy")
        os.makedirs(model_dir, exist_ok=True)

        log.info("Initialising EasyOCR fallback...")
        _easy_cache[pid] = easyocr.Reader(
            ["en"],
            gpu=False,
            verbose=False,
            model_storage_directory=model_dir,
        )
        log.info("EasyOCR ready.")

    return _easy_cache[pid]


# ============================================================
# BASIC UTILS
# ============================================================

def _resize_if_large(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    max_dim = max(h, w)

    if max_dim <= MAX_IMAGE_DIM:
        return bgr

    scale = MAX_IMAGE_DIM / max_dim
    return cv2.resize(
        bgr,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_AREA,
    )


def _digits_only(text: str) -> str:
    return re.sub(r"[^0-9]", "", str(text))


def validate_code(code: str) -> bool:
    if not code:
        return False

    if not CODE_RE.match(code):
        return False

    if NOISE_RE.match(code):
        return False

    return MIN_LEN <= len(code) <= MAX_LEN


def _safe_crop(img: np.ndarray, x0: int, y0: int, x1: int, y1: int) -> np.ndarray:
    h, w = img.shape[:2]

    x0 = max(0, min(w - 1, x0))
    x1 = max(0, min(w, x1))
    y0 = max(0, min(h - 1, y0))
    y1 = max(0, min(h, y1))

    if x1 <= x0 or y1 <= y0:
        return img[0:0, 0:0]

    return img[y0:y1, x0:x1]


def _remove_glare_fast(gray: np.ndarray) -> np.ndarray:
    bright = cv2.threshold(gray, 248, 255, cv2.THRESH_BINARY)[1]

    if cv2.countNonZero(bright) < 30:
        return gray

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    glare = cv2.dilate(bright, kernel, iterations=1)

    return cv2.inpaint(gray, glare, 3, cv2.INPAINT_TELEA)


# ============================================================
# WHITE DIGIT MASK
# ============================================================

def _white_digit_mask(bgr: np.ndarray, gray: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    hsv_mask = cv2.inRange(
        hsv,
        np.array([0, 0, 135]),
        np.array([180, 105, 255]),
    )

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0]
    lab_mask = cv2.threshold(l_channel, 145, 255, cv2.THRESH_BINARY)[1]

    clahe = cv2.createCLAHE(
        clipLimit=3.0,
        tileGridSize=(8, 8),
    ).apply(gray)

    adaptive = cv2.adaptiveThreshold(
        clahe,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        41,
        -9,
    )

    tophat_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, tophat_kernel)
    tophat_mask = cv2.threshold(
        tophat,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )[1]

    mask = cv2.bitwise_or(hsv_mask, lab_mask)
    mask = cv2.bitwise_or(mask, adaptive)
    mask = cv2.bitwise_or(mask, tophat_mask)

    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))

    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, open_kernel, iterations=1)

    return mask


# ============================================================
# ROI DETECTION
# ============================================================

def _expand_box(x: int, y: int, w: int, h: int, img_w: int, img_h: int, pad: int = 18):
    return (
        max(0, x - pad),
        max(0, y - pad),
        min(img_w, x + w + pad),
        min(img_h, y + h + pad),
    )


def _score_roi(mask_crop: np.ndarray, x: int, y: int, w: int, h: int, img_w: int, img_h: int) -> float:
    area = w * h

    if area <= 0:
        return 0.0

    white = cv2.countNonZero(mask_crop)
    density = white / area

    aspect = max(w / max(h, 1), h / max(w, 1))
    aspect_score = min(aspect / 5.0, 1.0)

    right_bias = x / max(img_w, 1)
    top_bias = 1.0 - (y / max(img_h, 1))
    size_score = min(area / (img_w * img_h * 0.12), 1.0)

    return (
        density * 2.5
        + aspect_score * 1.8
        + size_score * 1.2
        + right_bias * 0.8
        + top_bias * 0.4
    )


def _find_rois(bgr: np.ndarray, gray: np.ndarray, mask: np.ndarray) -> list[tuple[str, np.ndarray]]:
    img_h, img_w = gray.shape[:2]

    rois: list[tuple[str, np.ndarray, float]] = []

    kernels = [
        ("h_long", (25, 5)),
        ("v_long", (5, 25)),
        ("medium", (17, 9)),
        ("square", (15, 15)),
        ("wide", (45, 7)),
        ("tall", (7, 45)),
    ]

    for k_name, k_size in kernels:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, k_size)

        grouped = cv2.dilate(mask, kernel, iterations=1)
        grouped = cv2.morphologyEx(grouped, cv2.MORPH_CLOSE, kernel, iterations=1)

        contours, _ = cv2.findContours(
            grouped,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        for idx, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)

            if area < 80:
                continue

            x, y, w, h = cv2.boundingRect(cnt)

            if w < 8 or h < 8:
                continue

            if w * h > img_w * img_h * 0.65:
                continue

            x0, y0, x1, y1 = _expand_box(x, y, w, h, img_w, img_h, pad=22)

            crop_gray = _safe_crop(gray, x0, y0, x1, y1)
            crop_mask = _safe_crop(mask, x0, y0, x1, y1)

            if crop_gray.size == 0:
                continue

            score = _score_roi(crop_mask, x0, y0, x1 - x0, y1 - y0, img_w, img_h)

            if score < 0.18:
                continue

            rois.append((f"{k_name}_{idx}", crop_gray, score))

    fallback_boxes = [
        ("right_half", img_w // 2, 0, img_w, img_h),
        ("top_half", 0, 0, img_w, img_h // 2),
        ("right_top", img_w // 2, 0, img_w, img_h // 2),
        ("full", 0, 0, img_w, img_h),
    ]

    for name, x0, y0, x1, y1 in fallback_boxes:
        crop = _safe_crop(gray, x0, y0, x1, y1)

        if crop.size:
            rois.append((name, crop, 0.10))

    rois = sorted(rois, key=lambda x: x[2], reverse=True)

    unique: list[tuple[str, np.ndarray]] = []
    seen = set()

    for name, crop, score in rois:
        key = (crop.shape[0], crop.shape[1], int(score * 100))

        if key in seen:
            continue

        seen.add(key)
        unique.append((name, crop))

        if len(unique) >= 10:
            break

    log.info(f"ROI candidates: {[name for name, _ in unique]}")

    return unique


# ============================================================
# PREPROCESSING VARIANTS
# ============================================================

def _upscale(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]

    if h < 60:
        factor = 4.0
    elif h < 120:
        factor = 3.0
    else:
        factor = 2.0

    new_w = min(int(w * factor), 1900)
    new_h = min(int(h * factor), 900)

    return cv2.resize(
        img,
        (new_w, new_h),
        interpolation=cv2.INTER_CUBIC,
    )


def _build_variants(gray: np.ndarray) -> list[tuple[str, np.ndarray]]:
    variants = []

    gray = _remove_glare_fast(gray)

    clahe = cv2.createCLAHE(
        clipLimit=4.0,
        tileGridSize=(4, 4),
    ).apply(gray)

    blur = cv2.GaussianBlur(clahe, (0, 0), 1.2)
    sharp = cv2.addWeighted(clahe, 2.2, blur, -1.2, 0)

    variants.append(("sharp", _upscale(sharp)))

    local_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    local_mask = _white_digit_mask(local_bgr, gray)

    masked = np.zeros_like(gray)
    masked[local_mask > 0] = 255

    variants.append(("white", _upscale(masked)))

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thick = cv2.dilate(masked, kernel, iterations=1)

    variants.append(("thick", _upscale(thick)))

    return variants


def _orientations(img: np.ndarray) -> list[tuple[str, np.ndarray]]:
    return [
        ("r0", img),
        ("r90", cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)),
        ("r180", cv2.rotate(img, cv2.ROTATE_180)),
        ("r270", cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)),
    ]


# ============================================================
# OCR PARSING
# ============================================================

def _correct_common_ocr_errors(text: str) -> str:
    replacements = {
        'B': '8', 'b': '8',
        'O': '0', 'o': '0', 'D': '0', 'Q': '0',
        'I': '1', 'l': '1', '|': '1',
        'S': '5', 's': '5',
        'Z': '2', 'z': '2',
        'G': '6', 'g': '6',
        'A': '4'
    }
    corrected = "".join(replacements.get(char, char) for char in text)
    return corrected

def _parse_paddle(raw) -> list[tuple[str, float]]:
    out: list[tuple[str, float]] = []

    if not raw:
        return out

    lines = raw[0] if isinstance(raw, list) and raw and isinstance(raw[0], list) else raw

    if not lines:
        return out

    for item in lines:
        try:
            text = ""
            conf = 0.0

            if isinstance(item, dict):
                text = item.get("text") or item.get("transcription") or ""
                conf = float(item.get("score") or item.get("confidence") or 0.0)

            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                rec = item[1]

                if isinstance(rec, dict):
                    text = rec.get("text") or rec.get("transcription") or ""
                    conf = float(rec.get("score") or rec.get("confidence") or 0.0)

                elif isinstance(rec, (list, tuple)) and len(rec) >= 2:
                    text = rec[0]
                    conf = float(rec[1])

            corrected_text = _correct_common_ocr_errors(text)
            code = _digits_only(corrected_text)

            if validate_code(code):
                out.append((code, conf))

        except Exception:
            continue

    return out


def _run_paddle(img: np.ndarray, tag: str) -> list[tuple[str, float]]:
    ocr = _get_paddle()

    bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR) if img.ndim == 2 else img

    try:
        try:
            raw = ocr.ocr(bgr, cls=False)
        except TypeError:
            raw = ocr.ocr(bgr)

        results = _parse_paddle(raw)

        if results:
            log.info(f"Paddle {tag}: {results}")

        return results

    except Exception as exc:
        log.debug(f"Paddle failed {tag}: {exc}")
        return []


def _run_easyocr(img: np.ndarray, tag: str) -> list[tuple[str, float]]:
    reader = _get_easyocr()

    try:
        results = reader.readtext(
            img,
            allowlist="0123456789",
            detail=1,
            paragraph=False,
            rotation_info=[0],
        )

        out = []

        for _bbox, text, conf in results:
            corrected_text = _correct_common_ocr_errors(text)
            code = _digits_only(corrected_text)

            if validate_code(code):
                out.append((code, float(conf)))

        if out:
            log.info(f"EasyOCR {tag}: {out}")

        return out

    except Exception as exc:
        log.debug(f"EasyOCR failed {tag}: {exc}")
        return []


# ============================================================
# STITCHING + VOTING
# ============================================================

def _overlap_merge(a: str, b: str, min_overlap: int = 4) -> Optional[str]:
    if a in b:
        return b

    if b in a:
        return a

    max_overlap = min(len(a), len(b))

    for overlap in range(max_overlap, min_overlap - 1, -1):
        if a[-overlap:] == b[:overlap]:
            return a + b[overlap:]

        if b[-overlap:] == a[:overlap]:
            return b + a[overlap:]

    return None


def _stitch_codes(codes: list[str]) -> list[str]:
    result = set(codes)
    unique = list(set(codes))

    for a in unique:
        for b in unique:
            if a == b:
                continue

            merged = _overlap_merge(a, b)

            if merged and validate_code(merged):
                result.add(merged)

    return list(result)


def _vote(weighted: list[tuple[str, float]], db: Optional[Session] = None) -> tuple[str, float, int, int]:
    if not weighted:
        return "", 0.0, 0, 0

    raw_codes = [c for c, _ in weighted]
    stitched = _stitch_codes(raw_codes)

    avg_conf = (
        sum(float(conf) for _, conf in weighted) / len(weighted)
        if weighted
        else 0.0
    )

    combined = list(weighted)

    for code in stitched:
        if code not in raw_codes:
            combined.append((code, max(avg_conf, 0.35)))

    if db:
        combined = learning_engine.apply_reinforcement_scoring(combined, db)

    score = defaultdict(float)
    count = defaultdict(int)

    for code, conf in combined:
        conf = max(float(conf), 0.20)

        if len(code) == TARGET_LEN:
            conf *= 3.2
        elif abs(len(code) - TARGET_LEN) == 1:
            conf *= 1.5

        score[code] += conf
        count[code] += 1

    best = max(score, key=score.get)
    total = sum(score.values()) or 1.0

    final_conf = min(score[best] / total, 1.0)

    return best, final_conf, count[best], len(combined)


def _good_enough(weighted: list[tuple[str, float]], db: Optional[Session] = None) -> bool:
    if not weighted:
        return False

    best, conf, _vc, total = _vote(weighted, db)

    return bool(best) and len(best) == TARGET_LEN and conf >= VOTE_FAST_EXIT_CONF and total >= 2


# ============================================================
# MAIN OCR PIPELINE
# ============================================================

def detect_text(image_path: str, db: Optional[Session] = None) -> OcrResult:
    t0 = time.perf_counter()

    if not os.path.isfile(image_path) or os.path.getsize(image_path) == 0:
        return OcrResult(latency_ms=0.0, pipeline_used="missing_file")

    # ============================================================
    # 1. VISION AI FIRST (Groq -> Gemini -> OpenRouter)
    # ============================================================
    log.info("Executing Vision AI First pipeline (Groq -> Gemini -> OpenRouter)...")
    try:
        from app.services.vision_ai_service import run_vision_ai_ocr
        vision_res = run_vision_ai_ocr(image_path)
        if vision_res:
            code, conf, pipe_name = vision_res
            elapsed = (time.perf_counter() - t0) * 1000
            log.info(f"✓ Vision AI Primary Success: {code} ({conf:.0%}) via {pipe_name} in {elapsed:.0f}ms")
            return OcrResult(
                code=code,
                confidence=conf,
                vote_count=1,
                total_votes=1,
                latency_ms=elapsed,
                pipeline_used=pipe_name,
                candidates=[code],
            )
        log.warning("Vision AI returned no code. Triggering local OCR fallback (Hough + Polar + Paddle + Easy)...")
    except Exception as exc:
        log.warning(f"Vision AI error: {exc}. Triggering local OCR fallback...")

    # ============================================================
    # 2. LOCAL OCR FALLBACK (Hough Circle + Polar Warp + PaddleOCR + EasyOCR)
    # ============================================================
    bgr = cv2.imread(image_path)

    if bgr is None:
        raise FileNotFoundError(f"cv2.imread failed: {image_path}")

    bgr = _resize_if_large(bgr)

    # 1. Use HoughCircles to find the actual center of the coil's hole
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=100,
        param1=50, param2=30, minRadius=int(bgr.shape[1]*0.1), maxRadius=int(bgr.shape[1]*0.5)
    )

    h_bgr, w_bgr = bgr.shape[:2]
    if circles is not None:
        circles = np.round(circles[0, :]).astype("int")
        cx, cy, r = circles[0]
        center = (float(cx), float(cy))
        max_radius = min(w_bgr - cx, h_bgr - cy, cx, cy)
        if max_radius < 50:
            center = (w_bgr / 2.0, h_bgr / 2.0)
            max_radius = min(w_bgr, h_bgr) / 2.0
    else:
        center = (w_bgr / 2.0, h_bgr / 2.0)
        max_radius = min(w_bgr, h_bgr) / 2.0

    # 2. Polar Unwarp using the exact detected center
    circum = int(2 * np.pi * max_radius)
    polar_bgr = cv2.warpPolar(
        bgr,
        (int(max_radius), circum),
        center,
        max_radius,
        cv2.INTER_LINEAR + cv2.WARP_POLAR_LINEAR
    )
    unwarped_bgr = cv2.rotate(polar_bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)

    log.info(f"Local Fallback: Image unwarped {unwarped_bgr.shape[1]}×{unwarped_bgr.shape[0]}")

    weighted: list[tuple[str, float]] = []
    
    # 3. PaddleOCR on unwarped image
    ocr = _get_paddle()
    try:
        try:
            raw = ocr.ocr(unwarped_bgr, cls=True)
        except TypeError:
            raw = ocr.ocr(unwarped_bgr)
            
        results = _parse_paddle(raw)
        if results:
            log.info(f"Paddle Full-Image: {results}")
            weighted.extend(results)
    except Exception as exc:
        log.debug(f"Paddle failed on full image: {exc}")

    # Fallback to EasyOCR if Paddle had no good code
    if not _good_enough(weighted, db):
        reader = _get_easyocr()
        try:
            results = reader.readtext(
                unwarped_bgr,
                allowlist="0123456789",
                detail=1,
                paragraph=False,
                rotation_info=[0],
            )
            for _bbox, text, conf in results:
                corrected_text = _correct_common_ocr_errors(text)
                code = _digits_only(corrected_text)
                if validate_code(code):
                    weighted.append((code, float(conf)))
            if weighted:
                log.info(f"EasyOCR Fallback: {weighted}")
        except Exception as exc:
            log.debug(f"EasyOCR failed on full image: {exc}")

    elapsed = (time.perf_counter() - t0) * 1000
    raw_codes = [c for c, _ in weighted]

    result = OcrResult(
        latency_ms=elapsed,
        pipeline_used="local_hough_polar_fallback",
        candidates=raw_codes,
    )

    if weighted:
        best, conf, vc, tv = _vote(weighted, db)
        result.code = best
        result.confidence = conf
        result.vote_count = vc
        result.total_votes = tv

    result.latency_ms = (time.perf_counter() - t0) * 1000

    if not result.code:
        log.warning("No valid code detected by any pipeline.")
        return result

    log.info(str(result))
    return result


def detect_code(image_path: str, db: Optional[Session] = None) -> str:
    result = detect_text(image_path, db)
    return result.code if result.success else ""