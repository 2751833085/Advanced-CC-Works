from contextlib import asynccontextmanager
from typing import Literal, Optional

import cv2
import numpy as np
import json
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pipelines import (
    auto_enhance,
    decode_image,
    decode_optional_mask,
    encode_image,
    expand_image,
    fill_empty_region,
    remove_background,
    remove_object,
    style_transfer,
)

# region agent log
_DBG_LOG = "/Users/muyimoi/Library/Mobile Documents/com~apple~CloudDocs/我的文件/课程/帕森斯/GitHub/Phantopteryx Toolbox by Oneiron/.cursor/debug-ed2844.log"


def _dbg(hypothesis_id: str, location: str, message: str, data: dict | None = None) -> None:
    try:
        line = json.dumps(
            {
                "sessionId": "ed2844",
                "runId": "api-expand",
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data or {},
                "timestamp": int(time.time() * 1000),
            },
            ensure_ascii=False,
        )
        with open(_DBG_LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# endregion


@asynccontextmanager
async def lifespan(app: FastAPI):
    from pipelines.lama_inpaint import warmup_lama
    from pipelines.expand_sd import warmup_expand_sd

    warmup_lama()
    warmup_expand_sd()
    yield


class ImagePayload(BaseModel):
    image_base64: str


class EnhancePayload(ImagePayload):
    strength: float = 0.6


class ExpandPayload(ImagePayload):
    left: float = 0
    right: float = 0
    top: float = 0
    bottom: float = 0
    mode: Literal["ai", "edge", "mirror", "black"] = "ai"


class FillPayload(ImagePayload):
    mask_base64: str
    strength: float = 0.8


class RemoveObjectPayload(ImagePayload):
    mask_base64: str
    strength: float = 0.7


class StylePayload(ImagePayload):
    style: Literal["cinematic", "noir", "vintage", "cartoon"] = "cinematic"
    strength: float = 0.7


app = FastAPI(
    title="Phantopteryx Local AI Server",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ai/auto-enhance")
def ai_auto_enhance(payload: EnhancePayload):
    img = decode_image(payload.image_base64)
    out = auto_enhance(img, strength=payload.strength)
    return {"image_base64": encode_image(out)}


@app.post("/ai/expand")
def ai_expand(payload: ExpandPayload):
    t0 = time.time()
    img = decode_image(payload.image_base64)
    _dbg(
        "H1-expand-api-input",
        "ai-server/main.py:ai_expand",
        "request decoded",
        {
            "w": int(img.shape[1]),
            "h": int(img.shape[0]),
            "left": float(payload.left),
            "right": float(payload.right),
            "top": float(payload.top),
            "bottom": float(payload.bottom),
            "mode": payload.mode,
        },
    )
    try:
        out = expand_image(
            img,
            left_pct=payload.left,
            right_pct=payload.right,
            top_pct=payload.top,
            bottom_pct=payload.bottom,
            mode=payload.mode,
        )
    except Exception as e:  # noqa: BLE001
        _dbg(
            "H2-expand-api-fail",
            "ai-server/main.py:ai_expand",
            "expand_image exception",
            {"type": type(e).__name__, "msg": str(e)[:500], "elapsed_ms": int((time.time() - t0) * 1000)},
        )
        raise
    _dbg(
        "H3-expand-api-ok",
        "ai-server/main.py:ai_expand",
        "expand_image success",
        {"out_w": int(out.shape[1]), "out_h": int(out.shape[0]), "elapsed_ms": int((time.time() - t0) * 1000)},
    )
    return {"image_base64": encode_image(out)}


@app.post("/ai/fill-empty-region")
def ai_fill_empty(payload: FillPayload):
    img = decode_image(payload.image_base64)
    mask = decode_optional_mask(payload.mask_base64, img.shape[:2])
    out = fill_empty_region(img, mask, strength=payload.strength)
    return {"image_base64": encode_image(out)}


@app.post("/ai/remove-object")
def ai_remove_object(payload: RemoveObjectPayload):
    img = decode_image(payload.image_base64)
    mask = decode_optional_mask(payload.mask_base64, img.shape[:2])
    if mask.max() == 0:
        raise HTTPException(status_code=400, detail="mask_base64 has no painted area")
    out = remove_object(img, mask, strength=payload.strength)
    return {"image_base64": encode_image(out)}


@app.post("/ai/remove-bg")
def ai_remove_bg(payload: ImagePayload):
    img = decode_image(payload.image_base64)
    out = remove_background(img)
    return {"image_base64": encode_image(out)}


@app.post("/ai/style-transfer")
def ai_style(payload: StylePayload):
    img = decode_image(payload.image_base64)
    out = style_transfer(img, style=payload.style, strength=payload.strength)
    return {"image_base64": encode_image(out)}
