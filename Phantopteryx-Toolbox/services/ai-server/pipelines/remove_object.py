import numpy as np

from .lama_inpaint import lama_inpaint_bgra


def remove_object(img_bgra: np.ndarray, mask: np.ndarray, strength: float = 0.7) -> np.ndarray:
    if mask.max() == 0:
        return img_bgra
    return lama_inpaint_bgra(
        img_bgra, mask, strength=strength, fill_alpha_in_mask=False
    )
