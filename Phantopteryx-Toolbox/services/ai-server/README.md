# Local AI Server

## Requirements

- **Python 3.10+**
- **GPU strongly recommended** for `/ai/expand` with `mode=ai` (Stable Diffusion XL / SD1.5 inpainting via `diffusers`). CPU inference is possible but very slow and may OOM on large canvases.

## Start

```bash
python3 -m pip install -r ai-server/requirements.txt
uvicorn main:app --app-dir ai-server --host 127.0.0.1 --port 8765
```

On first use of **LaMa-backed** inpainting (`/ai/fill-empty-region`, `/ai/remove-object`), **LaMa** weights download automatically unless you set `LAMA_MODEL` (see below). **`/ai/expand` with `mode=ai` does not use LaMa** — it downloads the Hugging Face SD checkpoint configured by `EXPAND_SD_MODEL` instead.

## Inpainting (LaMa) — fill / remove-object only

| Variable | Purpose |
|----------|---------|
| `USE_OPENCV_FALLBACK=1` | Skip LaMa and use OpenCV Telea inpainting (offline dev, no weight download). |
| `LAMA_MODEL` | Absolute path to a `big-lama.pt` TorchScript checkpoint. If missing, startup/inference falls back to OpenCV when LaMa is used. |
| `LAMA_MODEL_URL` | Override download URL (default is the URL shipped with `simple-lama-inpainting`). |
| `LAMA_DEVICE` | `cpu`, `cuda`, or `mps` (Apple Silicon). If unset, CUDA is used when available, otherwise CPU. |
| `LAMA_EDGE_SIGMA` | Gaussian sigma (default `1.75`) for soft-compositing inpainted pixels over the original at the mask edge (reduces stair-stepping). Set `0` to restore hard binary paste. |

## AI Expand (`POST /ai/expand`, `mode=ai`) — Stable Diffusion (diffusers)

LaMa and OpenCV Telea are **not** used on this route. The server pads the canvas (edge-replicate), builds a binary mask over the new margins (optional dilation into the original), then runs **`StableDiffusionXLInpaintPipeline`** or **`StableDiffusionInpaintPipeline`** on RGB + mask.

| Variable | Purpose |
|----------|---------|
| `EXPAND_SD_PIPE_KIND` | `sdxl` (default) or `sd15`. |
| `EXPAND_SD_MODEL` | Hugging Face model id. Defaults: SDXL → `diffusers/stable-diffusion-xl-1.0-inpainting-0.1`; SD15 → `runwayml/stable-diffusion-inpainting`. |
| `EXPAND_SD_VARIANT` | Only used on **CUDA** for SDXL (`fp16` default). Ignored on CPU/MPS. |
| `EXPAND_SD_DEVICE` | Set to `cpu` to force CPU (slow). Otherwise: CUDA if available, else MPS, else CPU. |
| `EXPAND_SD_CPU_OFFLOAD` | `1` / `true` → `enable_model_cpu_offload()` to reduce VRAM at the cost of speed. |
| `EXPAND_SD_WARMUP` | `1` / `true` → load the SD pipeline at app startup (first request otherwise). |
| `EXPAND_SD_STEPS` | Inference steps (default `30` for SDXL, `32` for SD15). |
| `EXPAND_SD_GUIDANCE` | Classifier-free guidance (default `7` SDXL, `7.5` SD15). |
| `EXPAND_SD_PROMPT` | Positive prompt (default describes seamless continuation). |
| `EXPAND_SD_NEGATIVE` | Negative prompt (default discourages blur/streaks/watermarks). |
| `EXPAND_SD_SEED` | RNG seed (`0` = nondeterministic default per PyTorch). |
| `EXPAND_SD_RING_SHARPEN` | After SD, mild unsharp **only in the padding mask** (float, default `0.22`). Set `0` / `off` to disable. |
| `EXPAND_MASK_DILATE` | `cv2.dilate` iterations on padding mask (default `2`; `0` / `off` disables). |
| `EXPAND_MASK_KERNEL` | Odd kernel size for dilation (default `5`). |

The editor still **composites the original snapshot over the inner rectangle** after expand (`applyAiExpandComposite` in `apps/image-editor/scripts/ai/ai-tools.js`), so the subject stays sharp while the SD ring defines the new margin.

### Bundled expand QA image

A watercolor sample lives at **`ai-server/testdata/peacock_watercolor_expand.png`**. With GPU and dependencies installed, run:

```bash
cd ai-server && python3 test_expand_peacock.py
```

Output is written to **`ai-server/testdata/peacock_watercolor_expand_out.png`**. The script sets higher steps, stricter anti-blur negatives, and a slightly stronger ring sharpen by default; override any `EXPAND_SD_*` env var as needed.

## Health Check

```bash
curl http://127.0.0.1:8765/health
```

## Endpoints

- `POST /ai/auto-enhance`
- `POST /ai/expand`
- `POST /ai/remove-object`
- `POST /ai/remove-bg`
- `POST /ai/style-transfer`
- `POST /ai/fill-empty-region`

All endpoints accept base64 PNG payloads and return `{ "image_base64": "..." }`.

## Smoke test (offline)

```bash
cd ai-server && USE_OPENCV_FALLBACK=1 python3 smoke_inpaint.py
```

By default this hits `/health`, `/ai/fill-empty-region`, and `/ai/remove-object` with OpenCV Telea. **`/ai/expand` (mode=ai) is skipped** unless you set **`SMOKE_RUN_EXPAND_SD=1`** (requires GPU, large HF download, and full `diffusers` stack).

```bash
cd ai-server && SMOKE_RUN_EXPAND_SD=1 python3 smoke_inpaint.py
```
