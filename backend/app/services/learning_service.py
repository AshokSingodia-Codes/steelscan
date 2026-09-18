"""
learning_service.py — Human-in-the-Loop Self-Learning & Reinforcement Engine

Tracks operator manual corrections (ground truth) against raw OCR predictions
to dynamically build a plant-specific digit confusion matrix P(actual | predicted)
and numeric coil code pattern memory.
"""

import logging
import re
from collections import defaultdict
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session

from app.database import OCRFeedbackMemory, india_now

log = logging.getLogger("coil_learning")

DIGIT_ONLY_RE = re.compile(r"^[0-9]{4,32}$")
TARGET_LEN = 10


class LearningEngine:
    def __init__(self):
        # In-memory cached confusion matrix: { (raw_char, corrected_char): count }
        self._memory_cache: Dict[Tuple[str, str], int] = defaultdict(int)
        self._cache_loaded = False

    def load_cache_from_db(self, db: Session) -> None:
        try:
            records = db.query(OCRFeedbackMemory).all()
            self._memory_cache.clear()

            for rec in records:
                self._memory_cache[(rec.raw_char, rec.corrected_char)] = rec.frequency_count

            self._cache_loaded = True
            log.info(f"Loaded {len(records)} self-learning confusion rules into memory cache.")
        except Exception as exc:
            log.warning(f"Could not load OCR feedback memory from DB: {exc}")

    def learn_from_correction(
        self,
        raw_candidates: List[str],
        corrected_code: str,
        db: Session,
    ) -> None:
        """
        Invoked when an operator saves/edits a code.
        Compares top raw predictions with operator ground-truth to record confusion pairs.
        """
        corrected_clean = re.sub(r"\D", "", str(corrected_code or ""))

        if not corrected_clean or not DIGIT_ONLY_RE.match(corrected_clean):
            return

        if not raw_candidates:
            return

        top_prediction = re.sub(r"\D", "", str(raw_candidates[0]))

        if not top_prediction or top_prediction == corrected_clean:
            return

        # If length matches, calculate positional digit substitutions
        if len(top_prediction) == len(corrected_clean):
            for raw_c, corr_c in zip(top_prediction, corrected_clean):
                if raw_c != corr_c and raw_c.isdigit() and corr_c.isdigit():
                    self._update_feedback_pair(raw_c, corr_c, db)

        log.info(
            f"Self-learning engine updated from operator edit: "
            f"raw='{top_prediction}' -> corrected='{corrected_clean}'"
        )

    def _update_feedback_pair(self, raw_char: str, corrected_char: str, db: Session) -> None:
        try:
            key = (raw_char, corrected_char)
            self._memory_cache[key] += 1

            record = (
                db.query(OCRFeedbackMemory)
                .filter(
                    OCRFeedbackMemory.raw_char == raw_char,
                    OCRFeedbackMemory.corrected_char == corrected_char,
                )
                .first()
            )

            if record:
                record.frequency_count += 1
                record.updated_at = india_now()
            else:
                record = OCRFeedbackMemory(
                    raw_char=raw_char,
                    corrected_char=corrected_char,
                    frequency_count=1,
                    updated_at=india_now(),
                )
                db.add(record)

            db.commit()

        except Exception as exc:
            db.rollback()
            log.warning(f"Failed to record feedback pair ({raw_char} -> {corrected_char}): {exc}")

    def apply_reinforcement_scoring(
        self,
        candidates: List[Tuple[str, float]],
        db: Session,
    ) -> List[Tuple[str, float]]:
        """
        Applies learned confusion matrix weights and numeric pattern bonuses to raw candidate pairs.
        """
        if not self._cache_loaded:
            self.load_cache_from_db(db)

        if not candidates:
            return candidates

        boosted: List[Tuple[str, float]] = []

        for code, raw_conf in candidates:
            clean_code = re.sub(r"\D", "", str(code))

            if not clean_code:
                continue

            conf = float(raw_conf)

            # Bonus for 10-digit standard industrial coil serial format
            if len(clean_code) == TARGET_LEN:
                conf *= 1.25

            # Apply confusion matrix candidate generation
            possible_corrections = self._generate_learned_substitutions(clean_code)

            boosted.append((clean_code, min(conf, 1.0)))

            for alt_code, sub_bonus in possible_corrections:
                if alt_code != clean_code:
                    boosted.append((alt_code, min(conf * (0.80 + sub_bonus), 0.95)))

        return boosted

    def _generate_learned_substitutions(self, code: str) -> List[Tuple[str, float]]:
        """
        Generates alternative codes by substituting digits based on learned confusion counts.
        """
        results = []

        for (raw_c, corr_c), count in self._memory_cache.items():
            if count >= 2 and raw_c in code:
                alt = code.replace(raw_c, corr_c)
                weight_bonus = min(count * 0.05, 0.15)
                results.append((alt, weight_bonus))

        return results

    def status(self) -> dict:
        return {
            "cached_rules": len(self._memory_cache),
            "top_substitutions": [
                f"{raw}->{corr} (x{cnt})"
                for (raw, corr), cnt in sorted(
                    self._memory_cache.items(), key=lambda x: x[1], reverse=True
                )[:5]
            ],
        }


# Global singleton instance
learning_engine = LearningEngine()
