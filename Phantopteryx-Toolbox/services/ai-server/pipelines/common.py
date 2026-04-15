import base64
import io
from typing import Optional

import cv2
import numpy as np
from PIL import Image


def _strip_data_url(data: str) -> str:
    if "," in data and data.split(",", 1)[0].startswith("data:"):
        return data.split(",", 1)[1]
    return data


def decode_image(image_base64: str) -> np.ndarray:
    payload = base64.b64decode(_strip_data_url(image_base64))
    arr = np.frombuffer(payload, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Unable to decode image payload")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def decode_optional_mask(mask_base64: Optional[str], shape_hw: tuple[int, int]) -> np.ndarray:
    h, w = shape_hw
    if not mask_base64:
        return np.zeros((h, w), dtype=np.uint8)
    mask = decode_image(mask_base64)
    if mask.shape[:2] != (h, w):
        mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
    if mask.shape[2] == 4:
        alpha = mask[:, :, 3]
        gray = cv2.cvtColor(mask[:, :, :3], cv2.COLOR_BGR2GRAY)
        out = np.maximum(gray, alpha)
    else:
        out = cv2.cvtColor(mask[:, :, :3], cv2.COLOR_BGR2GRAY)
    return np.where(out > 10, 255, 0).astype(np.uint8)


def encode_image(image_bgra: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", image_bgra)
    if not ok:
        raise ValueError("Unable to encode output image")
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def mask_to_rgba(mask: np.ndarray) -> np.ndarray:
    rgba = np.zeros((mask.shape[0], mask.shape[1], 4), dtype=np.uint8)
    rgba[:, :, 0] = 255
    rgba[:, :, 3] = mask
    return rgba


def pil_to_bgra(image: Image.Image) -> np.ndarray:
    rgba = np.array(image.convert("RGBA"))
    return cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)


def bgra_to_pil(image_bgra: np.ndarray) -> Image.Image:
    rgba = cv2.cvtColor(image_bgra, cv2.COLOR_BGRA2RGBA)
    return Image.fromarray(rgba)
