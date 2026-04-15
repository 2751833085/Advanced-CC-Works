import numpy as np

from rembg import remove

from .common import bgra_to_pil, pil_to_bgra


def remove_background(img_bgra: np.ndarray) -> np.ndarray:
    pil = bgra_to_pil(img_bgra)
    out = remove(pil)
    if hasattr(out, "convert"):
        return pil_to_bgra(out.convert("RGBA"))
    # rembg may return bytes depending on runtime mode
    return img_bgra
