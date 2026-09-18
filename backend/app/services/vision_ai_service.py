"""
vision_ai_service.py — Multi-Provider Vision AI OCR Engine for STEELSCAN

Cascading Architecture:
1. Groq Cloud Vision (llama-3.2-11b-vision-preview / llama-3.2-90b-vision-preview) [Primary: ~300ms]
2. Google Gemini 2.0 Flash (gemini-2.0-flash / gemini-1.5-flash) [Fallback 1: High Accuracy]
3. OpenRouter Free Vision (llama-3.2-11b-vision-instruct:free) [Fallback 2]
"""

import base64
import logging
import os
import re
from typing import Optional, Tuple

import cv2
import requests
from app.config import GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY

log = logging.getLogger("vision_ai")

COIL_PROMPT = (
    "You are an industrial OCR system for steel coil manufacturing plants. "
    "Steel coils have an identification code (8 to 16 numeric digits, typically 10 to 14 digits) "
    "stenciled, painted in white or yellow, or printed along the circular curve of the coil or inner eye. "
    "Carefully inspect the image: find the circular/curved or horizontal coil number. "
    "Return ONLY the numeric digits (0-9) as a single continuous string. "
    "Do NOT include spaces, dashes, letters, markdown, or explanations. "
    "If no steel coil numeric code is visible, respond ONLY with 'NONE'."
)

NOISE_PATTERN = re.compile(r"^(.)\1{5,}$")


def _prepare_image_b64(image_path: str, max_dim: int = 1280) -> Optional[str]:
    """
    Read and optimize image for fast API transmission.
    Downscales large 4K/high-res camera captures to max_dim (default 1280px)
    and encodes to efficient JPEG base64 string.
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            if os.path.exists(image_path):
                with open(image_path, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            return None

        h, w = img.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            img = cv2.resize(
                img,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_AREA,
            )

        success, buffer = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        if success:
            return base64.b64encode(buffer).decode("utf-8")

        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except Exception as exc:
        log.warning(f"Error encoding image {image_path}: {exc}")
        return None


def _validate_extracted_code(code: str) -> bool:
    """Validate that code meets coil requirements (8 to 16 digits, not repetitive noise)."""
    if not code:
        return False
    if not (8 <= len(code) <= 16):
        return False
    if not code.isdigit():
        return False
    if NOISE_PATTERN.match(code):
        return False
    return True


def _extract_digits(raw_text: str) -> Optional[str]:
    """Clean and extract valid steel coil digits from LLM output."""
    if not raw_text or "none" in raw_text.lower():
        return None

    # First, strip non-digits to test continuous string
    digits_only = re.sub(r"[^0-9]", "", raw_text)
    if _validate_extracted_code(digits_only):
        return digits_only

    # If extra numbers exist, look for any standalone 8-16 digit sequence
    matches = re.findall(r"\b\d{8,16}\b", raw_text)
    for match in matches:
        if _validate_extracted_code(match):
            return match

    # If length exceeds 16 because of concatenated noise, pick the longest valid chunk
    if len(digits_only) > 16:
        # Check if first 10-14 digits or last 10-14 digits match
        for chunk_len in range(14, 7, -1):
            sub = digits_only[:chunk_len]
            if _validate_extracted_code(sub):
                return sub

    return None


# =====================================================================
# 1. GROQ CLOUD VISION (PRIMARY)
# =====================================================================

def call_groq_vision(image_path: str) -> Optional[Tuple[str, float, str]]:
    """
    Call Groq Cloud Vision API.
    Fastest inference speed (~300-500ms).
    """
    if not GROQ_API_KEY:
        log.info("Groq API key not configured, skipping Groq.")
        return None

    b64 = _prepare_image_b64(image_path)
    if not b64:
        return None

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    # Try 11b first, then 90b
    models_to_try = [
        "llama-3.2-11b-vision-preview",
        "llama-3.2-90b-vision-preview",
    ]

    for model_name in models_to_try:
        try:
            log.info(f"Trying Groq Vision model: {model_name}...")
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": COIL_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                            },
                        ],
                    }
                ],
                "max_tokens": 40,
                "temperature": 0.05,
            }

            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                digits = _extract_digits(content)
                if digits:
                    log.info(f"✓ Groq Vision ({model_name}) SUCCESS: {digits}")
                    return digits, 0.98, f"groq_{model_name}"
                else:
                    log.info(f"Groq Vision responded but no valid coil digits found: '{content}'")
            else:
                log.warning(f"Groq API {model_name} returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            log.warning(f"Groq Vision {model_name} error: {exc}")

    return None


# =====================================================================
# 2. GOOGLE GEMINI 2.0 FLASH (FALLBACK 1)
# =====================================================================

def call_gemini_vision(image_path: str) -> Optional[Tuple[str, float, str]]:
    """
    Call Google Gemini 2.0 Flash Vision API.
    Industry-leading visual recognition for curved, distorted, or low-contrast text.
    """
    if not GEMINI_API_KEY:
        log.info("Gemini API key not configured, skipping Gemini.")
        return None

    b64 = _prepare_image_b64(image_path)
    if not b64:
        return None

    models_to_try = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-2.5-flash",
    ]

    for model_name in models_to_try:
        try:
            log.info(f"Trying Google Gemini Vision model: {model_name}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": COIL_PROMPT},
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": b64,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 256,
                    "thinkingConfig": {
                        "thinkingBudget": 0
                    },
                },
            }

            resp = requests.post(url, json=payload, headers=headers, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        content = parts[0].get("text", "").strip()
                        digits = _extract_digits(content)
                        if digits:
                            log.info(f"✓ Gemini Vision ({model_name}) SUCCESS: {digits}")
                            return digits, 0.98, f"gemini_{model_name}"
                        else:
                            log.info(f"Gemini Vision responded but no valid coil digits found: '{content}'")
            else:
                log.warning(f"Gemini API {model_name} returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            log.warning(f"Gemini Vision {model_name} error: {exc}")

    return None


# =====================================================================
# 3. OPENROUTER FREE VISION (FALLBACK 2)
# =====================================================================

def call_openrouter_vision(image_path: str) -> Optional[Tuple[str, float, str]]:
    """
    Call OpenRouter Free Vision API.
    """
    if not OPENROUTER_API_KEY:
        log.info("OpenRouter API key not configured, skipping OpenRouter.")
        return None

    b64 = _prepare_image_b64(image_path)
    if not b64:
        return None

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://steelscan.local",
        "X-Title": "STEELSCAN",
    }

    models_to_try = [
        "google/gemma-4-26b-a4b-it:free",
        "inclusionai/ling-3.0-flash-vl:free",
    ]

    for model_name in models_to_try:
        try:
            log.info(f"Trying OpenRouter Vision model: {model_name}...")
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": COIL_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                            },
                        ],
                    }
                ],
                "max_tokens": 40,
                "temperature": 0.05,
            }

            resp = requests.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "").strip()
                    digits = _extract_digits(content)
                    if digits:
                        log.info(f"✓ OpenRouter Vision ({model_name}) SUCCESS: {digits}")
                        return digits, 0.94, "openrouter_vision"
            else:
                log.warning(f"OpenRouter API returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            log.warning(f"OpenRouter Vision error with {model_name}: {exc}")

    return None


# =====================================================================
# MAIN CASCADE: Groq -> Gemini -> OpenRouter
# =====================================================================

def run_vision_ai_ocr(image_path: str) -> Optional[Tuple[str, float, str]]:
    """
    Execute multi-provider Vision AI:
    1. Google Gemini Flash (gemini-3.6-flash / 3.7-flash) [Active, 100% accurate]
    2. Groq Cloud Vision (llama-3.2-vision)
    3. OpenRouter Free Vision
    """
    # 1. Google Gemini Flash (Verified working with user's key)
    res = call_gemini_vision(image_path)
    if res:
        return res

    # 2. Groq Vision
    log.info("Gemini returned no result, failing over to Groq Vision...")
    res = call_groq_vision(image_path)
    if res:
        return res

    # 3. OpenRouter Free
    log.info("Groq returned no result, failing over to OpenRouter Vision...")
    res = call_openrouter_vision(image_path)
    if res:
        return res

    log.warning("All Vision AI providers returned no valid coil code.")
    return None
