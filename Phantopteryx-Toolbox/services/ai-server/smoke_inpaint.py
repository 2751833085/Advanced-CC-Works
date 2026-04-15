#!/usr/bin/env python3
"""Smoke-test inpainting routes (uses USE_OPENCV_FALLBACK=1 by default for CI/offline).

Set SMOKE_RUN_EXPAND_SD=1 to also POST /ai/expand (mode=ai), which loads Stable Diffusion
and needs a GPU with enough VRAM plus HF model download — off by default for CI.
"""

import base64
import os
import sys

os.environ.setdefault("USE_OPENCV_FALLBACK", "1")
RUN_EXPAND_SD = os.environ.get("SMOKE_RUN_EXPAND_SD", "").lower() in ("1", "true", "yes")

import numpy as np  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from pipelines.common import encode_image, mask_to_rgba  # noqa: E402


def _b64_png(bgra: np.ndarray) -> str:
    return encode_image(bgra)


def main() -> int:
    h, w = 64, 64
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[:, :, 0] = 200
    img[:, :, 1] = 100
    img[:, :, 2] = 50
    img[:, :, 3] = 255

    mask = np.zeros((h, w), dtype=np.uint8)
    mask[18:46, 18:46] = 255
    mask_b64 = _b64_png(mask_to_rgba(mask))
    img_b64 = _b64_png(img)

    with TestClient(app) as client:
        r = client.get("/health")
        r.raise_for_status()

        r = client.post(
            "/ai/fill-empty-region",
            json={"image_base64": img_b64, "mask_base64": mask_b64, "strength": 0.8},
        )
        r.raise_for_status()
        out = r.json()["image_base64"]
        assert len(base64.b64decode(out)) > 100

        if RUN_EXPAND_SD:
            r = client.post(
                "/ai/expand",
                json={
                    "image_base64": img_b64,
                    "left": 10,
                    "right": 10,
                    "top": 10,
                    "bottom": 10,
                    "mode": "ai",
                },
            )
            r.raise_for_status()
            assert "image_base64" in r.json()
        else:
            print("smoke_inpaint: skip /ai/expand (set SMOKE_RUN_EXPAND_SD=1 to run SD)", file=sys.stderr)

        r = client.post(
            "/ai/remove-object",
            json={"image_base64": img_b64, "mask_base64": mask_b64, "strength": 0.7},
        )
        r.raise_for_status()
        assert "image_base64" in r.json()

    print("smoke_inpaint: ok", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
