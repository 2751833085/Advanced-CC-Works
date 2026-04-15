import cv2
import numpy as np

from .lama_inpaint import lama_inpaint_bgra


def _pad(img_bgra: np.ndarray, left: int, right: int, top: int, bottom: int, mode: str) -> np.ndarray:
    h, w = img_bgra.shape[:2]
    nw, nh = w + left + right, h + top + bottom
    if mode == "black":
        out = np.zeros((nh, nw, 4), dtype=np.uint8)
        out[:, :, 3] = 255
    elif mode == "transparent":
        out = np.zeros((nh, nw, 4), dtype=np.uint8)
        out[top : top + h, left : left + w] = img_bgra
    elif mode == "mirror":
        out = cv2.copyMakeBorder(img_bgra, top, bottom, left, right, cv2.BORDER_REFLECT)
    elif mode == "edge":
        out = cv2.copyMakeBorder(img_bgra, top, bottom, left, right, cv2.BORDER_REPLICATE)
    else:
        out = cv2.copyMakeBorder(img_bgra, top, bottom, left, right, cv2.BORDER_REPLICATE)
    out[top:top + h, left:left + w] = img_bgra
    return out


def fill_empty_region(
    img_bgra: np.ndarray,
    mask: np.ndarray,
    strength: float = 0.8,
    *,
    fill_alpha_in_mask: bool = True,
) -> np.ndarray:
    return lama_inpaint_bgra(
        img_bgra, mask, strength=strength, fill_alpha_in_mask=fill_alpha_in_mask
    )


def expand_image(
    img_bgra: np.ndarray,
    left_pct: float,
    right_pct: float,
    top_pct: float,
    bottom_pct: float,
    mode: str = "ai",
) -> np.ndarray:
    h, w = img_bgra.shape[:2]
    left = max(0, int(round(w * left_pct / 100.0)))
    right = max(0, int(round(w * right_pct / 100.0)))
    top = max(0, int(round(h * top_pct / 100.0)))
    bottom = max(0, int(round(h * bottom_pct / 100.0)))
    if mode != "ai":
        return _pad(img_bgra, left, right, top, bottom, mode)
    from .expand_sd import expand_image_sd

    return expand_image_sd(img_bgra, left, right, top, bottom)
