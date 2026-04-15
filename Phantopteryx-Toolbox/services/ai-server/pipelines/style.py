import cv2
import numpy as np


def style_transfer(img_bgra: np.ndarray, style: str = "cinematic", strength: float = 0.7) -> np.ndarray:
    strength = max(0.0, min(1.0, float(strength)))
    bgr = img_bgra[:, :, :3]
    alpha = img_bgra[:, :, 3]

    if style == "noir":
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        bw = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        out = cv2.addWeighted(bgr, 1.0 - strength, bw, strength, 0)
    elif style == "cartoon":
        out = cv2.stylization(bgr, sigma_s=60, sigma_r=0.45)
    elif style == "vintage":
        mat = np.array(
            [[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]],
            dtype=np.float32,
        )
        sepia = cv2.transform(bgr, mat)
        sepia = np.clip(sepia, 0, 255).astype(np.uint8)
        out = cv2.addWeighted(bgr, 1.0 - strength, sepia, strength, 0)
    else:  # cinematic default
        out = cv2.detailEnhance(bgr, sigma_s=10 + 20 * strength, sigma_r=0.12 + 0.2 * strength)
        hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1.0 + 0.3 * strength), 0, 255).astype(np.uint8)
        out = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    return np.dstack([out, alpha]).astype(np.uint8)
