import threading
import time

_start_time = time.time()

_stats = {
    "requests": 0,
    "success": 0,
    "total_latency_ms": 0.0,
}

_ocr_lock = threading.Lock()
