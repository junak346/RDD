# AI Model Guide

## Honest status summary

* The repository ships a **complete, production-shaped inference service**
  (FastAPI) with a real YOLO/PyTorch backend and a modular severity engine.
* **No trained road-damage weights are bundled.** Training data and model
  weights are large binaries and must be supplied by the operator.
* When no trained model is available the service runs a **clearly-labelled
  demo engine**: deterministic image heuristics (not machine learning) whose
  every response carries `demo: true`, `model.engine: "demo"` and UI banners.
  Demo output must never be presented as real inference.
* Confidence scores are model estimates, **not guaranteed accuracy**.
  Severity is a documented heuristic, **not a professional civil-engineering
  assessment**.

## Engine selection (`AI_MODE`)

| Value | Behaviour |
|---|---|
| `auto` (default) | Use the real model when weights + ML stack are present; otherwise fall back to the demo engine with a loud startup warning and `demo: true` responses. |
| `real` | Real model only. If unavailable, the service starts degraded and `POST /predict` answers `503 MODEL_UNAVAILABLE` — it never silently substitutes demo behaviour. |
| `demo` | Force the demo engine (useful for UI development and demos). |

Verify what is active at any time:

```bash
curl http://localhost:8000/health      # {"engine": "demo"|"yolo", "demo": true|false, ...}
curl http://localhost:8000/model/info  # classes, thresholds, device
```

## Installing real inference (ML stack)

```bash
cd ai-service
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-ml.txt
# Tip: CPU-only machines can install a smaller torch first:
#   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

## Installing trained weights

1. Obtain a YOLO-compatible road-damage model (see datasets below) — typically
   a `.pt` file exported by Ultralytics after training.
2. Place it at the configured path (default shown):

```
ai-service/models/road_damage_yolo.pt      # or set MODEL_PATH to any location
```

3. Restart the service with `AI_MODE=real` (or leave `auto`) and verify
   `/health` reports `"engine": "yolo", "demo": false`.

Configuration knobs (`.env`, see `.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `MODEL_PATH` | `ai-service/models/road_damage_yolo.pt` | trained weights location |
| `MODEL_CONFIDENCE_THRESHOLD` | `0.35` | minimum detection confidence |
| `MODEL_IOU_THRESHOLD` | `0.45` | NMS IoU threshold |
| `MODEL_DEVICE` | `auto` | `auto` / `cpu` / `cuda` |
| `MODEL_NAME`, `MODEL_VERSION` | `road-damage-yolo`, `unversioned` | reported in every result |
| `AI_MAX_DETECTIONS` | `100` | result cap |

Docker: build with the ML stack and mount the weights:

```bash
docker build --build-arg INSTALL_ML=true -t rdd-ai ./ai-service
# docker-compose.yml already mounts ./ai-service/models → /app/models
```

## How the real YOLO backend works

`app/models/yolo_engine.py`:

1. Lazy-imports `ultralytics` (so the service boots without the ML stack).
2. Loads `YOLO(MODEL_PATH)` and reads the model's own class names.
3. Runs `model.predict(source, conf, iou, device)` on the decoded RGB image
   (converted to the BGR convention Ultralytics expects).
4. Emits `RawDetection` records — the same interface the demo engine produces.

Everything downstream (severity, visualisation, response schema, storage) is
engine-agnostic via the `DetectionEngine` interface (`app/models/base.py`).
`RawDetection` may include an optional `segmentation` polygon; the prediction
schema and backend detection record carry it as optional data. The official
detail UI displays a point count when a segmentation model supplies one and
shows `—` otherwise. Bounding boxes remain the universal minimum contract.

### Confidence gate and no-damage language

`PredictionService` filters engine outputs with
`confidence >= settings.confidence_threshold` before severity scoring,
summarisation, annotation and persistence. The backend applies the highest of
its environment baseline, any permitted administrative override and the
model-reported threshold; administrators may raise but never lower that gate.
When nothing remains, the AI response includes `No road damage detected.` in
warnings and the submission is preserved. No detections are fabricated to make
a report look successful.

### Swapping in another model

Implement `DetectionEngine` (two methods: `info()`, `predict()`) and register it
in `app/models/registry.py`. Examples that fit this interface: YOLOv8/v11/v12
variants, segmentation models (set the optional `RawDetection.segmentation`
polygon), ONNX / TensorRT runtimes, cloud vision APIs.

## Damage classes

`app/classes.json` defines the class catalogue (id, name, label, annotation
colour, severity prior). It is **configuration, not hard-coded logic** — add or
rename classes there and in your trained model. The installed RDD2022 India + Kent checkpoint catalogue (`app/classes.json`):

| id | name | label | severity prior |
|---|---|---|---|
| 0 | `longitudinal_crack` | Longitudinal Crack | 0.70 |
| 1 | `transverse_crack` | Transverse Crack | 0.70 |
| 2 | `alligator_crack` | Alligator Crack | 0.85 |
| 3 | `pothole` | Pothole | 1.00 |

The UI class palette, AI annotations and backend filters use these names. If a
different checkpoint is installed, update `app/classes.json` and the trained
model's class order together; see `AI_MODEL_DEPLOYMENT.md` for the installed
checkpoint's provenance and reported limitations.

## Severity estimation (all engines)

`app/services/severity.py`:

```
score = 0.50 · min(1, (bbox_area / image_area) / 0.25)   # apparent size
      + 0.30 · confidence                                # detector support
      + 0.20 · class_prior                               # classes.json
→ high (≥ 0.60) · moderate (≥ 0.35) · low
```

⚠️ This is an **estimation layer for triage/monitoring**, not a validated
engineering assessment. Do not use it as the sole basis for safety decisions.

## Suggested public datasets (research before use)

Training a real model requires road-damage imagery with bounding-box labels.
Widely-used public options (verify each licence before use):

* **RDD2022 / RDD2020** (World Bank Global Facility for Disaster Reduction &
  Recovery) — multi-country road damage images with YOLO-format labels
  covering longitudinal/transverse cracks, alligator cracks and potholes.
  This is the closest match to the class catalogue above.
* **CRACK500 / DeepCrack / CrackForest** — crack-segmentation datasets (crack
  class only).
* **AIGLE-RN / ESAR / Oxford RobotCar (road surface subsets)** — additional
  surface-damage imagery.

Do **not** download datasets without confirming their licence and terms.
After training with Ultralytics (`yolo detect train ...`), export the best
checkpoint as `road_damage_yolo.pt` and install it as described above.

## The demo engine (what it is / is not)

`app/models/demo_engine.py` computes grid-based darkness, gradient and texture
features and maps them to damage-like boxes. It exists so the entire product —
fresh camera capture → analysis → annotated report → public tracking → official
dashboard/map/audit — can be evaluated end to end without weights.

* ✅ clearly labelled everywhere (`demo: true`, warnings, UI banners)
* ✅ deterministic and fast
* ❌ **not** a trained model, **not** calibrated confidence, **not** a
  substitute for real inference in production

## Evaluation checklist for a real model

- [ ] `GET /health` → `engine: "yolo"`, `demo: false`
- [ ] `POST /predict` on sample images → sensible classes/confidences
- [ ] Confidence threshold tuned on your validation set
- [ ] Severity thresholds reviewed against engineering judgement
- [ ] Class catalogue matches the trained model's class names
- [ ] Inference latency acceptable on target hardware (CPU/GPU)
