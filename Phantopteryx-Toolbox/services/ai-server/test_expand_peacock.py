#!/usr/bin/env python3
"""
Run AI expand on the bundled watercolor test image (testdata/peacock_watercolor_expand.png).

Usage (from repo root or ai-server/):
  cd ai-server && python3 test_expand_peacock.py
  cd ai-server && python3 test_expand_peacock.py --edge-only   # no SD; edge pad only (for layout preview)

Requires GPU + diffusers + HF weights (see README). Optional env overrides any EXPAND_SD_*.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

# region agent log
_DBG_LOG = "/Users/muyimoi/Library/Mobile Documents/com~apple~CloudDocs/我的文件/课程/帕森斯/GitHub/Phantopteryx Toolbox by Oneiron/.cursor/debug-ed2844.log"


def _dbg(hypothesis_id: str, location: str, message: str, data: dict | None = None) -> None:
    try:
        line = json.dumps(
            {
                "sessionId": "ed2844",
                "runId": "peacock-expand",
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

# ai-server as cwd for relative testdata paths
_HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(_HERE)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# Quality-oriented defaults for this asset (override with env if needed)
os.environ.setdefault("EXPAND_SD_STEPS", "10")
os.environ.setdefault("EXPAND_SD_GUIDANCE", "5.5")
os.environ.setdefault("EXPAND_SD_SEED", "42")
os.environ.setdefault("EXPAND_MASK_DILATE", "1")
os.environ.setdefault("EXPAND_SD_RING_SHARPEN", "0.28")
os.environ.setdefault(
    "EXPAND_SD_PROMPT",
    "seamless outpainting, same watercolor and ink illustration on textured cold press paper, "
    "visible paper grain and pigment blooms, hand drawn pencil outlines, soft sepia vignette wash "
    "continuing naturally at edges, crisp pigment edges in new areas, high resolution, coherent lighting",
)
os.environ.setdefault(
    "EXPAND_SD_NEGATIVE",
    "blur, blurry, bokeh, out of focus, soft focus, haze, foggy, smear, streak, motion blur, "
    "jpeg artifacts, plastic, 3d render, photo, oversharpen halos, text, watermark, border, frame, "
    "low resolution, muddy, washed out, empty gradient",
)


def main() -> int:
    import cv2
    import numpy as np

    from pipelines.common import encode_image
    from pipelines.expand import expand_image

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--edge-only",
        action="store_true",
        help="Use edge-replicate pad only (no Stable Diffusion). Writes peacock_watercolor_expand_edge.png",
    )
    ap.add_argument("--input", default="", help="Input image path. Defaults to bundled peacock watercolor image.")
    ap.add_argument(
        "--output",
        default="",
        help="Output image path. Defaults to input directory with _edge/_out suffix.",
    )
    args = ap.parse_args()

    default_inp = os.path.join(_HERE, "testdata", "peacock_watercolor_expand.png")
    inp = os.path.abspath(args.input) if args.input else default_inp
    if args.output:
        out = os.path.abspath(args.output)
    else:
        stem, ext = os.path.splitext(inp)
        suffix = "_edge" if args.edge_only else "_out"
        out = stem + suffix + (ext or ".png")
    _dbg(
        "H1",
        "test_expand_peacock.py:main",
        "start",
        {"inp_exists": os.path.isfile(inp), "edge_only": args.edge_only, "out_path": out, "inp_path": inp},
    )
    if not os.path.isfile(inp):
        print("Missing:", inp, file=sys.stderr)
        _dbg("H1", "test_expand_peacock.py:main", "missing_input", {"inp": inp})
        return 2

    bgr = cv2.imread(inp, cv2.IMREAD_UNCHANGED)
    if bgr is None:
        print("Cannot read image:", inp, file=sys.stderr)
        _dbg("H2", "test_expand_peacock.py:main", "imread_failed", {"inp": inp})
        return 2
    if bgr.ndim == 2:
        bgr = cv2.cvtColor(bgr, cv2.COLOR_GRAY2BGRA)
    elif bgr.shape[2] == 3:
        bgr = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)

    # Moderate expand (~10–12% per side) so margins are visible without tiny canvas
    left = right = top = bottom = 12.0
    print("Input:", bgr.shape[1], "x", bgr.shape[0], "expand % per side:", left, file=sys.stderr)
    print("EXPAND_SD_STEPS=", os.environ.get("EXPAND_SD_STEPS"), file=sys.stderr)
    _dbg(
        "H4",
        "test_expand_peacock.py:main",
        "before_expand",
        {"w": int(bgr.shape[1]), "h": int(bgr.shape[0]), "mode": "edge" if args.edge_only else "ai"},
    )

    if args.edge_only:
        expanded = expand_image(bgr, left, right, top, bottom, mode="edge")
        _dbg(
            "H4",
            "test_expand_peacock.py:main",
            "edge_expand_ok",
            {"out_w": int(expanded.shape[1]), "out_h": int(expanded.shape[0])},
        )
    else:
        try:
            expanded = expand_image(bgr, left, right, top, bottom, mode="ai")
        except Exception as e:  # noqa: BLE001
            _dbg(
                "H3",
                "test_expand_peacock.py:main",
                "ai_expand_exception",
                {"type": type(e).__name__, "msg": str(e)[:500]},
            )
            raise
        _dbg(
            "H3",
            "test_expand_peacock.py:main",
            "ai_expand_ok",
            {"out_w": int(expanded.shape[1]), "out_h": int(expanded.shape[0])},
        )

    ok = cv2.imwrite(out, expanded)
    if not ok:
        print("Failed to write:", out, file=sys.stderr)
        _dbg("H2", "test_expand_peacock.py:main", "imwrite_failed", {"out": out})
        return 1
    b64 = encode_image(expanded)
    print("Wrote:", out, expanded.shape[1], "x", expanded.shape[0], "png_b64_len=", len(b64), file=sys.stderr)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
