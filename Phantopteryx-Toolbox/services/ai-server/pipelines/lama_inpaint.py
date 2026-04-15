"""LaMa inpainting via simple-lama-inpainting, with optional OpenCV Telea fallback."""

from __future__ import annotations

import logging
import os
import threading
from typing import Optional

import cv2
import numpy as np

_logger = logging.getLogger(__name__)

_lama_lock = threading.Lock()
_lama_instance: Optional[object] = None
_lama_failed: bool = False


def _env_truthy(name: str) -> bool:
    v = os.environ.get(name, "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _compose_soft_bgr(
    bgr: np.ndarray,
    inpainted_bgr: np.ndarray,
    mask_u8: np.ndarray,
    sigma: float,
) -> np.ndarray:
    """Alpha-blend inpainted result over original using a blurred mask to soften jagged hole edges."""
    if sigma <= 0:
        hole = mask_u8 > 0
        out = bgr.copy()
        out[hole] = inpainted_bgr[hole]
        return out
    m = (mask_u8.astype(np.float32) > 127.0) * 255.0
    wmap = cv2.GaussianBlur(m, (0, 0), sigmaX=sigma, sigmaY=sigma)
    w = np.clip(wmap[:, :, np.newaxis] / 255.0, 0.0, 1.0)
    return (inpainted_bgr.astype(np.float32) * w + bgr.astype(np.float32) * (1.0 - w)).astype(np.uint8)


def _telea_bgra(
    img_bgra: np.ndarray,
    mask: np.ndarray,
    strength: float,
    fill_alpha_in_mask: bool,
) -> np.ndarray:
    if mask.max() == 0:
        return img_bgra
    bgr = img_bgra[:, :, :3].copy()
    alpha = img_bgra[:, :, 3].copy()
    radius = int(3 + 7 * max(0.0, min(1.0, strength)))
    if not fill_alpha_in_mask:
        radius = int(3 + 8 * max(0.0, min(1.0, strength)))
    filled = cv2.inpaint(bgr, mask, radius, cv2.INPAINT_TELEA)
    sigma = float(os.environ.get("LAMA_EDGE_SIGMA", "1.75"))
    composed_bgr = _compose_soft_bgr(bgr, filled, mask, sigma)
    if fill_alpha_in_mask:
        wmap = cv2.GaussianBlur((mask.astype(np.float32) > 127.0) * 255.0, (0, 0), sigmaX=max(sigma, 0.5), sigmaY=max(sigma, 0.5))
        new_alpha = np.where(wmap > 2.0, np.uint8(255), alpha)
    else:
        new_alpha = alpha
    return np.dstack([composed_bgr, new_alpha]).astype(np.uint8)


def _resolve_torch_device():
    import torch

    raw = os.environ.get("LAMA_DEVICE", "").strip().lower()
    if raw == "cpu":
        return torch.device("cpu")
    if raw == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    if raw == "mps":
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        _logger.warning("LAMA_DEVICE=mps requested but MPS is not available; using CPU")
        return torch.device("cpu")
    if raw:
        try:
            return torch.device(raw)
        except Exception as e:  # noqa: BLE001
            _logger.warning("Invalid LAMA_DEVICE=%r (%s); using auto", raw, e)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _get_simple_lama():
    global _lama_instance, _lama_failed
    if _lama_failed:
        return None
    if _lama_instance is not None:
        return _lama_instance
    with _lama_lock:
        if _lama_failed:
            return None
        if _lama_instance is not None:
            return _lama_instance
        try:
            from simple_lama_inpainting import SimpleLama

            device = _resolve_torch_device()
            _lama_instance = SimpleLama(device=device)
            _logger.info("LaMa (SimpleLama) loaded on %s", device)
        except Exception as e:  # noqa: BLE001
            _lama_failed = True
            _logger.warning("LaMa load failed, using OpenCV inpaint: %s", e)
            _lama_instance = None
        return _lama_instance


def warmup_lama() -> None:
    """Eager-load LaMa on process start (no-op if USE_OPENCV_FALLBACK or load fails)."""
    if _env_truthy("USE_OPENCV_FALLBACK"):
        return
    _get_simple_lama()


def lama_inpaint_bgra(
    img_bgra: np.ndarray,
    mask_u8: np.ndarray,
    strength: float = 0.8,
    *,
    fill_alpha_in_mask: bool = True,
) -> np.ndarray:
    """
    Inpaint BGRA using LaMa where mask > 0; optionally set alpha to 255 in masked pixels.

    Falls back to cv2.inpaint when USE_OPENCV_FALLBACK is set or LaMa is unavailable.
    """
    if mask_u8.max() == 0:
        return img_bgra
    if _env_truthy("USE_OPENCV_FALLBACK"):
        return _telea_bgra(img_bgra, mask_u8, strength, fill_alpha_in_mask)

    lama = _get_simple_lama()
    if lama is None:
        return _telea_bgra(img_bgra, mask_u8, strength, fill_alpha_in_mask)

    h, w = img_bgra.shape[:2]
    if mask_u8.shape[:2] != (h, w):
        mask_u8 = cv2.resize(mask_u8, (w, h), interpolation=cv2.INTER_NEAREST)
        mask_u8 = np.where(mask_u8 > 127, 255, 0).astype(np.uint8)

    bgr = img_bgra[:, :, :3]
    alpha = img_bgra[:, :, 3].copy()
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    try:
        from PIL import Image

        rgb_pil = Image.fromarray(rgb)
        mask_pil = Image.fromarray(mask_u8, mode="L")
        out_pil = lama(rgb_pil, mask_pil)
        out_rgb = np.asarray(out_pil.convert("RGB"), dtype=np.uint8)
        if out_rgb.shape[0] != h or out_rgb.shape[1] != w:
            out_rgb = out_rgb[:h, :w].copy()
        out_bgr = cv2.cvtColor(out_rgb, cv2.COLOR_RGB2BGR)
    except Exception as e:  # noqa: BLE001
        _logger.warning("LaMa inference failed, using OpenCV inpaint: %s", e)
        return _telea_bgra(img_bgra, mask_u8, strength, fill_alpha_in_mask)

    sigma = float(os.environ.get("LAMA_EDGE_SIGMA", "1.75"))
    composed_bgr = _compose_soft_bgr(bgr, out_bgr, mask_u8, sigma)
    if fill_alpha_in_mask:
        wmap = cv2.GaussianBlur((mask_u8.astype(np.float32) > 127.0) * 255.0, (0, 0), sigmaX=max(sigma, 0.5), sigmaY=max(sigma, 0.5))
        new_alpha = np.where(wmap > 2.0, np.uint8(255), alpha)
    else:
        new_alpha = alpha
    return np.dstack([composed_bgr, new_alpha]).astype(np.uint8)
