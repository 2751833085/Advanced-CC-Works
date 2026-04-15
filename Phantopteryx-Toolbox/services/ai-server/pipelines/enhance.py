import cv2
import numpy as np


def auto_enhance(img_bgra: np.ndarray, strength: float = 0.6) -> np.ndarray:
    strength = max(0.0, min(1.0, float(strength)))
    bgr = img_bgra[:, :, :3]
    alpha = img_bgra[:, :, 3].copy()

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5 + 2.0 * strength, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    lab2 = cv2.merge([l2, a, b])
    enhanced = cv2.cvtColor(lab2, cv2.COLOR_LAB2BGR)

    enhanced = cv2.detailEnhance(enhanced, sigma_s=8 + 20 * strength, sigma_r=0.1 + 0.25 * strength)
    blend = cv2.addWeighted(bgr, 1.0 - 0.7 * strength, enhanced, 0.7 * strength, 0)

    out = np.dstack([blend, alpha])
    return out.astype(np.uint8)
