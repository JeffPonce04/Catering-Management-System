import base64
import os
import tempfile
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Dear Babs Face Verification", version="1.0.0")


class VerifyPayload(BaseModel):
    reference_image: str = Field(min_length=100)
    captured_image: str = Field(min_length=100)
    threshold: float = Field(default=0.30, ge=0.05, le=0.60)


def decode_image(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid base64 image payload") from exc


@app.get("/health")
def health():
    return {"status": "ok", "engine": "DeepFace/Facenet512"}


@app.post("/verify")
def verify(payload: VerifyPayload):
    # DeepFace loads its model on first use; allow the caller a long timeout.
    try:
        from deepface import DeepFace
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Face engine dependencies are not installed") from exc

    reference = decode_image(payload.reference_image)
    captured = decode_image(payload.captured_image)
    if len(reference) > 8 * 1024 * 1024 or len(captured) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds the 8 MB limit")

    paths = []
    try:
        for raw in (reference, captured):
            handle = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            handle.write(raw)
            handle.close()
            paths.append(handle.name)

        result = DeepFace.verify(
            img1_path=paths[0],
            img2_path=paths[1],
            model_name="Facenet512",
            detector_backend="opencv",
            distance_metric="cosine",
            enforce_detection=True,
            align=True,
            silent=True,
        )
        distance = float(result.get("distance", 1.0))
        verified = distance <= payload.threshold
        return {
            "verified": verified,
            "distance": distance,
            "confidence": max(0.0, min(1.0, 1.0 - distance)),
            "message": "Face verified" if verified else "Face does not match the enrolled profile",
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="A clear face could not be detected in both images") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face verification engine failed: {type(exc).__name__}") from exc
    finally:
        for path in paths:
            try:
                os.remove(path)
            except OSError:
                pass
