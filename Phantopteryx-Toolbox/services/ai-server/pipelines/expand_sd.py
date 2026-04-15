"""AI canvas expand via Stable Diffusion inpainting (diffusers). LaMa is not used on this path."""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Optional
import json
import time

import cv2
import numpy as np
import torch
from PIL import Image

from .expand import _pad

_logger = logging.getLogger(__name__)

_pipe: Optional[Any] = None
_pipe_cache_key: Optional[tuple[str, str]] = None
_pipe_lock = threading.Lock()
_infer_lock = threading.Lock()

# region agent log
_DBG_LOG = "/Users/muyimoi/Library/Mobile Documents/com~apple~CloudDocs/我的文件/课程/帕森斯/GitHub/Phantopteryx Toolbox by Oneiron/.cursor/debug-ed2844.log"


def _dbg(hypothesis_id: str, location: str, message: str, data: dict | None = None) -> None:
    try:
        line = json.dumps(
            {
                "sessionId": "ed2844",
                "runId": "peacock-expand-perf",
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


def _env_str(name: str, default: str) -> str:
    v = os.environ.get(name)
    return default if v is None or not str(v).strip() else str(v).strip()


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _device_and_dtype() -> tuple[torch.device, torch.dtype]:
    if os.environ.get("EXPAND_SD_DEVICE", "").strip().lower() == "cpu":
        return torch.device("cpu"), torch.float32
    if torch.cuda.is_available():
        return torch.device("cuda"), torch.float16
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps"), torch.float32
    return torch.device("cpu"), torch.float32


def _align8(n: int) -> int:
    return max(8, (int(n) // 8) * 8)


def _max_infer_side(dev: torch.device) -> int:
    raw = os.environ.get("EXPAND_SD_MAX_INFER_SIDE", "").strip()
    if raw:
        try:
            return max(512, int(raw))
        except ValueError:
            pass
    if str(dev).startswith("mps"):
        return 1152
    if str(dev).startswith("cpu"):
        return 1024
    return 2048


def _bgra_to_rgb_np_on_white(img_bgra: np.ndarray) -> np.ndarray:
    """RGB uint8, white behind transparent pixels (better for SD than black)."""
    b, g, r, a = cv2.split(img_bgra)
    rgb = cv2.merge([r, g, b])
    af = a.astype(np.float32) / 255.0
    bg = np.full_like(rgb, 255, dtype=np.float32)
    out = (rgb.astype(np.float32) * af[..., None] + bg * (1.0 - af[..., None])).astype(np.uint8)
    return out


def _build_padding_mask(h: int, w: int, left: int, right: int, top: int, bottom: int) -> np.ndarray:
    mask = np.zeros((h, w), dtype=np.uint8)
    if top > 0:
        mask[:top, :] = 255
    if bottom > 0:
        mask[h - bottom :, :] = 255
    if left > 0:
        mask[:, :left] = 255
    if right > 0:
        mask[:, w - right :] = 255
    return mask


def _dilate_mask(mask: np.ndarray, kernel_size: int, iterations: int) -> np.ndarray:
    if iterations <= 0 or mask.max() == 0:
        return mask
    k = max(3, int(kernel_size))
    if k % 2 == 0:
        k += 1
    kernel = np.ones((k, k), dtype=np.uint8)
    return cv2.dilate(mask, kernel, iterations=iterations)


def _mask_dilate_iters() -> int:
    raw = os.environ.get("EXPAND_MASK_DILATE", "2").strip()
    if raw.lower() in ("0", "off", "false", "no"):
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 2


def _mask_kernel() -> int:
    try:
        k = int(os.environ.get("EXPAND_MASK_KERNEL", "5").strip() or "5")
    except ValueError:
        k = 5
    k = max(3, k)
    if k % 2 == 0:
        k += 1
    return k


def _prefill_mode() -> str:
    m = os.environ.get("EXPAND_SD_PREFILL", "mirror").strip().lower()
    if m in ("mirror", "edge"):
        return m
    return "mirror"


def _prefill_sigma() -> float:
    raw = os.environ.get("EXPAND_SD_PREFILL_SIGMA", "1.15").strip()
    if raw.lower() in ("0", "off", "false", "no"):
        return 0.0
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 1.15


def _ring_blur_prefill(img_bgra: np.ndarray, ring_mask: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0.0 or ring_mask.max() == 0:
        return img_bgra
    bgr = img_bgra[:, :, :3]
    blur = cv2.GaussianBlur(bgr, (0, 0), sigmaX=sigma)
    m = (ring_mask > 0).astype(np.float32)[..., np.newaxis]
    mix = bgr.astype(np.float32) * (1.0 - m) + blur.astype(np.float32) * m
    out = img_bgra.copy()
    out[:, :, :3] = np.clip(mix, 0, 255).astype(np.uint8)
    return out


def _get_inpaint_pipe() -> tuple[Any, str]:
    global _pipe, _pipe_cache_key
    kind = _env_str("EXPAND_SD_PIPE_KIND", "sdxl").lower()
    if kind not in ("sdxl", "sd15"):
        kind = "sdxl"
    model_id = _env_str(
        "EXPAND_SD_MODEL",
        "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
        if kind == "sdxl"
        else "runwayml/stable-diffusion-inpainting",
    )
    cache_key = (kind, model_id)
    with _pipe_lock:
        # region agent log
        _dbg(
            "H-cache",
            "expand_sd.py:_get_inpaint_pipe",
            "pipe_lookup",
            {"cache_hit": bool(_pipe is not None and _pipe_cache_key == cache_key), "kind": kind, "model_id": model_id},
        )
        # endregion
        if _pipe is not None and _pipe_cache_key == cache_key:
            return _pipe, kind
        device, dtype = _device_and_dtype()
        t_load = time.time()
        _logger.info("Loading expand SD inpaint (%s): %s on %s", kind, model_id, device)
        extra: dict[str, Any] = {}
        if kind == "sdxl" and device.type == "cuda":
            v = os.environ.get("EXPAND_SD_VARIANT", "fp16").strip()
            if v:
                extra["variant"] = v
        if kind == "sd15":
            from diffusers import StableDiffusionInpaintPipeline

            pipe = StableDiffusionInpaintPipeline.from_pretrained(
                model_id,
                torch_dtype=dtype,
                **extra,
            )
        else:
            from diffusers import StableDiffusionXLInpaintPipeline

            pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
                model_id,
                torch_dtype=dtype,
                **extra,
            )
        if os.environ.get("EXPAND_SD_CPU_OFFLOAD", "").lower() in ("1", "true", "yes"):
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(device)
        try:
            pipe.enable_attention_slicing()
        except Exception:  # noqa: BLE001
            pass
        try:
            pipe.enable_vae_slicing()
        except Exception:  # noqa: BLE001
            pass
        _pipe = pipe
        _pipe_cache_key = cache_key
        # region agent log
        _dbg(
            "H-load",
            "expand_sd.py:_get_inpaint_pipe",
            "pipe_ready",
            {"load_ms": int((time.time() - t_load) * 1000), "device": str(device), "dtype": str(dtype), "kind": kind},
        )
        # endregion
        return _pipe, kind


def warmup_expand_sd() -> None:
    """Optional eager load (call from FastAPI lifespan if EXPAND_SD_WARMUP=1)."""
    if os.environ.get("EXPAND_SD_WARMUP", "").lower() not in ("1", "true", "yes"):
        return
    _get_inpaint_pipe()


def expand_image_sd(
    img_bgra: np.ndarray,
    left: int,
    right: int,
    top: int,
    bottom: int,
) -> np.ndarray:
    t_total = time.time()
    # region agent log
    _dbg(
        "H3",
        "expand_sd.py:expand_image_sd",
        "enter",
        {"h": int(img_bgra.shape[0]), "w": int(img_bgra.shape[1]), "left": left, "right": right, "top": top, "bottom": bottom},
    )
    # endregion
    if left + right + top + bottom <= 0:
        return img_bgra
    prefill = _prefill_mode()
    padded = _pad(img_bgra, left, right, top, bottom, "mirror" if prefill == "mirror" else "edge")
    ph, pw = padded.shape[:2]
    mask = _build_padding_mask(ph, pw, left, right, top, bottom)
    dit = _mask_dilate_iters()
    if dit > 0:
        mask = _dilate_mask(mask, _mask_kernel(), dit)
    sigma = _prefill_sigma()
    padded = _ring_blur_prefill(padded, mask, sigma)
    # region agent log
    _dbg(
        "H1",
        "expand_sd.py:expand_image_sd",
        "prefill_ready",
        {
            "prefill": prefill,
            "prefill_sigma": sigma,
            "mask_nonzero": int(np.count_nonzero(mask)),
            "mask_ratio": float(np.count_nonzero(mask) / float(mask.size)),
            "dilate_iters": dit,
        },
    )
    # endregion

    tw, th = _align8(pw), _align8(ph)
    work_bgra = padded
    work_mask = mask
    if (tw, th) != (pw, ph):
        work_bgra = cv2.resize(padded, (tw, th), interpolation=cv2.INTER_LINEAR)
        work_mask = cv2.resize(mask, (tw, th), interpolation=cv2.INTER_NEAREST)
        work_mask = np.where(work_mask > 127, 255, 0).astype(np.uint8)

    rgb = _bgra_to_rgb_np_on_white(work_bgra)
    init_pil = Image.fromarray(rgb)
    mask_pil = Image.fromarray(work_mask, mode="L")

    pipe, kind = _get_inpaint_pipe()
    dev = next(pipe.unet.parameters()).device
    max_side = _max_infer_side(dev)
    scaled_for_infer = False
    if max(tw, th) > max_side:
        scale = float(max_side) / float(max(tw, th))
        tw2 = _align8(int(tw * scale))
        th2 = _align8(int(th * scale))
        work_bgra = cv2.resize(work_bgra, (tw2, th2), interpolation=cv2.INTER_AREA)
        work_mask = cv2.resize(work_mask, (tw2, th2), interpolation=cv2.INTER_NEAREST)
        work_mask = np.where(work_mask > 127, 255, 0).astype(np.uint8)
        tw, th = tw2, th2
        init_pil = Image.fromarray(_bgra_to_rgb_np_on_white(work_bgra))
        mask_pil = Image.fromarray(work_mask, mode="L")
        scaled_for_infer = True
        # region agent log
        _dbg(
            "H9",
            "expand_sd.py:expand_image_sd",
            "downscaled_for_infer",
            {"max_side": max_side, "scaled_w": tw, "scaled_h": th, "source_w": pw, "source_h": ph},
        )
        # endregion
    model_hint = os.environ.get("EXPAND_SD_MODEL", "")
    prompt = _env_str(
        "EXPAND_SD_PROMPT",
        "seamless outpainting, same watercolor and ink illustration on textured cold press paper, "
        "visible paper grain and pigment blooms, hand drawn pencil outlines, soft sepia vignette wash "
        "continuing naturally at edges, sharp fine detail, high resolution, coherent lighting",
    )
    neg = _env_str(
        "EXPAND_SD_NEGATIVE",
        "blur, blurry, bokeh, out of focus, soft focus, haze, foggy, smear, streak, motion blur, "
        "jpeg artifacts, plastic, 3d render, photo, oversharpen halos, text, watermark, border, frame, "
        "low resolution, muddy, washed out",
    )
    turbo_like = "turbo" in model_hint.lower() or "lightning" in model_hint.lower()
    if turbo_like:
        d_steps = 4
        d_guidance = 0.0
    elif kind == "sdxl":
        # On non-CUDA devices, SDXL latency is dominated by inference;
        # lower defaults keep interactive usage responsive while preserving quality knobs via env overrides.
        if str(dev).startswith("mps"):
            d_steps = 10
            d_guidance = 5.5
        elif str(dev).startswith("cpu"):
            d_steps = 12
            d_guidance = 5.5
        else:
            d_steps = 30
            d_guidance = 7.0
    else:
        d_steps = 32
        d_guidance = 7.5
    steps = max(1, _env_int("EXPAND_SD_STEPS", d_steps))
    guidance = max(0.0, _env_float("EXPAND_SD_GUIDANCE", d_guidance))
    seed = _env_int("EXPAND_SD_SEED", 0)
    gen = torch.Generator(device=dev)
    if seed != 0:
        gen = gen.manual_seed(seed)

    kw: dict[str, Any] = dict(
        prompt=prompt,
        negative_prompt=neg,
        image=init_pil,
        mask_image=mask_pil,
        height=th,
        width=tw,
        num_inference_steps=steps,
        guidance_scale=guidance,
        strength=1.0,
        generator=gen,
    )
    if kind == "sdxl":
        # Keep prompt embedding consistent for dual-encoder SDXL pipelines.
        kw["prompt_2"] = prompt
        kw["negative_prompt_2"] = neg

    # region agent log
    _dbg(
        "H2",
        "expand_sd.py:expand_image_sd",
        "infer_args",
        {
            "kind": kind,
            "device": str(dev),
            "steps": steps,
            "guidance": guidance,
            "strength": kw["strength"],
            "seed": seed,
            "target_w": tw,
            "target_h": th,
            "scaled_for_infer": scaled_for_infer,
            "max_infer_side": max_side,
        },
    )
    # endregion

    t_infer = time.time()
    t_wait = time.time()
    # region agent log
    _dbg(
        "H8",
        "expand_sd.py:expand_image_sd",
        "waiting_infer_lock",
        {"kind": kind, "target_w": tw, "target_h": th},
    )
    # endregion
    with _infer_lock:
        waited_ms = int((time.time() - t_wait) * 1000)
        # region agent log
        _dbg(
            "H8",
            "expand_sd.py:expand_image_sd",
            "acquired_infer_lock",
            {"waited_ms": waited_ms, "kind": kind},
        )
        # endregion
        out_pil = pipe(**kw).images[0]
    # region agent log
    _dbg(
        "H-infer",
        "expand_sd.py:expand_image_sd",
        "infer_done",
        {"infer_ms": int((time.time() - t_infer) * 1000), "kind": kind, "steps": steps, "guidance": guidance},
    )
    # endregion
    out_rgb = np.array(out_pil.convert("RGB"), dtype=np.uint8)
    ring = work_mask > 127
    raw_rs = os.environ.get("EXPAND_SD_RING_SHARPEN", "0.22").strip()
    if raw_rs.lower() in ("0", "off", "false", "no"):
        sh = 0.0
    elif not raw_rs:
        sh = 0.22
    else:
        try:
            sh = max(0.0, float(raw_rs))
        except ValueError:
            sh = 0.22
    if sh > 0.0 and ring.any():
        bgr = cv2.cvtColor(out_rgb, cv2.COLOR_RGB2BGR)
        blur = cv2.GaussianBlur(bgr, (0, 0), sigmaX=0.9)
        sharp = cv2.addWeighted(bgr, 1.0 + sh, blur, -sh, 0.0)
        m = ring.astype(np.float32)[..., None]
        mix = bgr.astype(np.float32) * (1.0 - m) + sharp.astype(np.float32) * m
        out_rgb = cv2.cvtColor(np.clip(mix, 0, 255).astype(np.uint8), cv2.COLOR_BGR2RGB)
    if (tw, th) != (pw, ph):
        out_rgb = cv2.resize(out_rgb, (pw, ph), interpolation=cv2.INTER_LANCZOS4)
    out_bgr = cv2.cvtColor(out_rgb, cv2.COLOR_RGB2BGR)
    out = np.dstack([out_bgr, np.full((ph, pw), 255, dtype=np.uint8)]).astype(np.uint8)
    # region agent log
    _dbg(
        "H4",
        "expand_sd.py:expand_image_sd",
        "done",
        {"out_w": int(out.shape[1]), "out_h": int(out.shape[0]), "ring_sharpen": sh, "total_ms": int((time.time() - t_total) * 1000)},
    )
    # endregion
    return out
