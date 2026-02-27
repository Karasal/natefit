# NATEFIT GPU Backend

SMPL-based body scanning API. Takes front + side photos (+ optional LiDAR depth) and returns body measurements, composition, and 3D mesh.

## Architecture

```
POST /api/scan
  ┌─ HMR 2.0 inference (front + side images)
  ├─ Multi-view beta optimization (shared body shape)
  ├─ Optional: LiDAR depth alignment
  ├─ SMPL mesh → circumference extraction
  ├─ Body composition estimation (MLP or Navy/CUN-BAE)
  └─ Return: measurements + composition + mesh vertices
```

## Local Development

```bash
cd backend
pip install -r requirements.txt
python main.py
# Server runs at http://localhost:8000
```

Test with curl:
```bash
curl -X POST http://localhost:8000/api/scan \
  -F "front_image=@front.jpg" \
  -F "side_image=@side.jpg" \
  -F "height_cm=175" \
  -F "weight_kg=75" \
  -F "age=30" \
  -F "sex=male"
```

## Deploy to Modal (Serverless GPU)

```bash
pip install modal
modal setup  # One-time auth

# Download/setup model weights
modal run modal_deploy.py::download_models

# Deploy
modal deploy modal_deploy.py

# Local dev with hot reload
modal serve modal_deploy.py
```

## Model Weights

The pipeline needs these model files (place in Modal volume at `/models/`):

| File | Source | Size |
|------|--------|------|
| `hmr2_weights.pt` | [4D-Humans](https://github.com/shubham-goel/4D-Humans) | ~1.2 GB |
| `smpl/SMPL_NEUTRAL.pkl` | [SMPL](https://smpl.is.tue.mpg.de/) | ~40 MB |
| `body_comp_mlp.pt` | Train from DEXA data | ~1 MB |

Without pretrained weights, the pipeline runs with placeholder models (outputs will not be accurate but the API contract is functional).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HMR_WEIGHTS_PATH` | Path to HMR 2.0 checkpoint | None |
| `SMPL_MODEL_PATH` | Path to SMPL model directory | None |
| `COMPOSITION_WEIGHTS_PATH` | Path to body composition MLP | None |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `PORT` | Server port | `8000` |

## Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app + endpoints |
| `pipeline.py` | Orchestrates full scan flow |
| `hmr_inference.py` | HMR 2.0 image → SMPL params |
| `smpl_optimizer.py` | Multi-view shape optimization |
| `measurement_extractor.py` | SMPL mesh → circumferences |
| `body_composition.py` | Body fat / lean mass estimation |
| `depth_processor.py` | LiDAR depth → point cloud |
| `modal_deploy.py` | Modal serverless GPU deployment |
| `models.py` | Pydantic + dataclass models |
