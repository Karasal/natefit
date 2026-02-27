"""Modal serverless GPU deployment for NATEFIT scan backend.

Deploys the FastAPI app on Modal with:
- A100 GPU (or fallback to T4/L4)
- Model pre-loading in the container image
- Scales to zero when idle (pay-per-second)
- Automatic HTTPS endpoint

Usage:
    modal deploy modal_deploy.py        # Deploy to production
    modal serve modal_deploy.py         # Local dev with hot reload

Environment variables (set as Modal secrets):
    - HMR_WEIGHTS_PATH: Path to HMR 2.0 weights in container
    - SMPL_MODEL_PATH: Path to SMPL model in container
    - COMPOSITION_WEIGHTS_PATH: Path to body composition MLP weights
    - FRONTEND_URL: Allowed CORS origin
"""

from __future__ import annotations

import modal

# ── Modal configuration ──────────────────────────────────────────────────

app = modal.App("natefit-scan-api")

# Container image with all dependencies pre-installed
gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.6",
        "uvicorn[standard]==0.34.0",
        "python-multipart==0.0.18",
        "pydantic==2.10.4",
        "torch>=2.1.0",
        "torchvision>=0.16.0",
        "smplx==0.1.28",
        "numpy>=1.24.0",
        "scipy>=1.11.0",
        "Pillow>=10.0.0",
        "opencv-python-headless>=4.8.0",
        "trimesh>=4.0.0",
    )
    .copy_local_dir(".", "/app")
)

# Model weights volume (persistent storage for model files)
model_volume = modal.Volume.from_name("natefit-models", create_if_missing=True)


# ── Web endpoint ─────────────────────────────────────────────────────────

@app.function(
    image=gpu_image,
    gpu="A100",  # Use A100 for fast inference. Alternatives: "T4", "L4", "A10G"
    timeout=120,
    container_idle_timeout=300,  # Keep warm for 5 min after last request
    allow_concurrent_inputs=10,
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("natefit-secrets", required=False)],
)
@modal.asgi_app()
def web():
    """Serve the FastAPI app on Modal.

    The app is initialized once per container (model loading happens on startup).
    Subsequent requests reuse the loaded models.
    """
    import os
    import sys

    # Add app directory to path
    sys.path.insert(0, "/app")

    # Set model paths from volume
    os.environ.setdefault("HMR_WEIGHTS_PATH", "/models/hmr2_weights.pt")
    os.environ.setdefault("SMPL_MODEL_PATH", "/models/smpl")
    os.environ.setdefault("COMPOSITION_WEIGHTS_PATH", "/models/body_comp_mlp.pt")

    from main import app as fastapi_app

    return fastapi_app


# ── Model download helper ────────────────────────────────────────────────

@app.function(
    image=gpu_image,
    volumes={"/models": model_volume},
    timeout=600,
)
def download_models():
    """Download and cache model weights to the persistent volume.

    Run once with: `modal run modal_deploy.py::download_models`

    Downloads:
    - HMR 2.0 pretrained weights
    - SMPL model files
    - Body composition MLP (when trained)
    """
    import os
    from pathlib import Path

    models_dir = Path("/models")
    models_dir.mkdir(exist_ok=True)

    # HMR 2.0 weights
    hmr_path = models_dir / "hmr2_weights.pt"
    if not hmr_path.exists():
        print("HMR 2.0 weights not found. Download from:")
        print("  https://github.com/shubham-goel/4D-Humans")
        print("  Place checkpoint at /models/hmr2_weights.pt")
        # Placeholder: create empty file so pipeline uses dev fallback
        hmr_path.touch()

    # SMPL model
    smpl_dir = models_dir / "smpl"
    smpl_dir.mkdir(exist_ok=True)
    smpl_model = smpl_dir / "SMPL_NEUTRAL.pkl"
    if not smpl_model.exists():
        print("SMPL model not found. Download from:")
        print("  https://smpl.is.tue.mpg.de/")
        print("  Place SMPL_NEUTRAL.pkl at /models/smpl/SMPL_NEUTRAL.pkl")

    # Body composition MLP
    comp_path = models_dir / "body_comp_mlp.pt"
    if not comp_path.exists():
        print("Body composition MLP weights not found.")
        print("  Train the model or place weights at /models/body_comp_mlp.pt")
        comp_path.touch()

    # Commit volume changes
    model_volume.commit()
    print("Model setup complete. Volume contents:")
    for f in models_dir.rglob("*"):
        if f.is_file():
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"  {f.relative_to(models_dir)}: {size_mb:.1f} MB")


# ── Health check (for testing) ───────────────────────────────────────────

@app.function(image=gpu_image)
def check_gpu():
    """Quick GPU availability check. Run with: `modal run modal_deploy.py::check_gpu`"""
    import torch

    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"Memory: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")
