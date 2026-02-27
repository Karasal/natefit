"""NATEFIT GPU Backend — FastAPI application.

Provides the /api/scan endpoint for SMPL-based body scanning.
Receives front + side images (+ optional LiDAR depth), returns
body measurements, composition, and 3D mesh data.
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image

from models import HealthResponse, ScanResponse, Sex
from pipeline import ScanPipeline

# ── Logging ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# ── Global pipeline instance ─────────────────────────────────────────────

pipeline: ScanPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize pipeline on startup, clean up on shutdown."""
    global pipeline

    logger.info("Starting NATEFIT GPU backend...")
    pipeline = ScanPipeline(
        hmr_weights_path=os.getenv("HMR_WEIGHTS_PATH"),
        smpl_model_path=os.getenv("SMPL_MODEL_PATH"),
        composition_weights_path=os.getenv("COMPOSITION_WEIGHTS_PATH"),
    )
    logger.info("Pipeline ready")

    yield

    logger.info("Shutting down NATEFIT GPU backend")
    pipeline = None


# ── FastAPI app ──────────────────────────────────────────────────────────

app = FastAPI(
    title="NATEFIT Scan API",
    description="SMPL-based body scanning with LiDAR depth support",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://natefit-liard.vercel.app",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        gpu_available=torch.cuda.is_available(),
        model_loaded=pipeline is not None,
    )


@app.post("/api/scan", response_model=ScanResponse)
async def process_scan(
    front_image: UploadFile = File(..., description="Front-facing JPEG image"),
    side_image: UploadFile = File(..., description="Side-profile JPEG image"),
    height_cm: float = Form(..., description="Subject height in cm"),
    weight_kg: float = Form(..., description="Subject weight in kg"),
    age: int = Form(..., description="Subject age in years"),
    sex: str = Form(..., description="Subject sex: male or female"),
    depth_front: UploadFile | None = File(None, description="Front LiDAR depth (raw float32)"),
    depth_side: UploadFile | None = File(None, description="Side LiDAR depth (raw float32)"),
    camera_intrinsics: str | None = Form(None, description="JSON camera intrinsics"),
):
    """Process a body scan from two images + optional LiDAR depth.

    Returns body measurements, composition, 3D mesh data, and confidence score.
    """
    if pipeline is None:
        return JSONResponse(
            status_code=503,
            content={"error": "Pipeline not initialized. Server starting up."},
        )

    try:
        # Validate sex
        sex_lower = sex.lower()
        if sex_lower not in ("male", "female"):
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid sex: {sex}. Must be 'male' or 'female'."},
            )

        # Validate ranges
        if not (50 < height_cm < 300):
            return JSONResponse(
                status_code=400,
                content={"error": f"Height must be between 50-300 cm, got {height_cm}"},
            )
        if not (20 < weight_kg < 500):
            return JSONResponse(
                status_code=400,
                content={"error": f"Weight must be between 20-500 kg, got {weight_kg}"},
            )
        if not (10 <= age <= 120):
            return JSONResponse(
                status_code=400,
                content={"error": f"Age must be between 10-120, got {age}"},
            )

        # Load images
        front_bytes = await front_image.read()
        side_bytes = await side_image.read()

        front_pil = Image.open(__import__("io").BytesIO(front_bytes)).convert("RGB")
        side_pil = Image.open(__import__("io").BytesIO(side_bytes)).convert("RGB")

        # Load depth data (if provided)
        depth_front_bytes = await depth_front.read() if depth_front else None
        depth_side_bytes = await depth_side.read() if depth_side else None

        # Parse camera intrinsics
        intrinsics = None
        if camera_intrinsics:
            try:
                intrinsics = json.loads(camera_intrinsics)
            except json.JSONDecodeError:
                logger.warning("Invalid camera intrinsics JSON, ignoring")

        # Run pipeline
        result = pipeline.process(
            front_image=front_pil,
            side_image=side_pil,
            height_cm=height_cm,
            weight_kg=weight_kg,
            age=int(age),
            sex=sex_lower,
            depth_front_bytes=depth_front_bytes,
            depth_side_bytes=depth_side_bytes,
            camera_intrinsics=intrinsics,
        )

        return result

    except Exception as e:
        logger.exception("Scan processing failed")
        return JSONResponse(
            status_code=500,
            content={"error": f"Scan processing failed: {str(e)}"},
        )


# ── Local development server ────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
        log_level="info",
    )
