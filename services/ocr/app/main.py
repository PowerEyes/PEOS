from __future__ import annotations

import os
import re
import secrets
import logging
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field
from paddleocr import PaddleOCR

TOKEN = os.environ.get("OCR_SERVICE_TOKEN", "")
MAX_BYTES = int(os.environ.get("OCR_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
BLUR_THRESHOLD = float(os.environ.get("OCR_BLUR_THRESHOLD", "35"))
MODEL_DIR = Path(os.environ.get("OCR_MODEL_DIR", "/models/paddleocr"))


class EyeValues(BaseModel):
    sph: float | None = None
    cyl: float | None = None
    axis: int | None = None
    add: float | None = None


class RxValues(BaseModel):
    od: EyeValues
    os: EyeValues
    pd_far: float | None = None
    pd_near: float | None = None


class OCRResponse(BaseModel):
    values: RxValues
    confidence: dict[str, float | None]
    field_warnings: list[str]
    warnings: list[str]
    quality: dict[str, Any]
    raw_text: list[str] = Field(default_factory=list)
    raw_confidences: list[float] = Field(default_factory=list)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global engine
    if not TOKEN:
        raise RuntimeError("OCR_SERVICE_TOKEN must be set")
    if not MODEL_DIR.exists():
        raise RuntimeError(f"PaddleOCR model directory not found: {MODEL_DIR}")
    # Explicit local model paths and disabled updates prevent runtime downloads.
    engine = PaddleOCR(
        text_detection_model_dir=str(MODEL_DIR / "det"),
        text_recognition_model_dir=str(MODEL_DIR / "rec"),
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
        device=os.environ.get("OCR_DEVICE", "cpu"),
    )
    yield


app = FastAPI(title="PowerOS Local Prescription OCR", version="1.0.0", lifespan=lifespan)
engine: PaddleOCR
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def preprocess(image: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    if image is None or image.size == 0:
        raise HTTPException(422, "Invalid image")
    h, w = image.shape[:2]
    if max(h, w) > 6000 or min(h, w) < 250:
        raise HTTPException(422, "Image dimensions are unsupported")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Try cardinal rotations using OCR text confidence and retain the strongest.
    candidates: list[tuple[np.ndarray, int]] = [(image, 0)]
    for angle, rotate_code in [(90, cv2.ROTATE_90_CLOCKWISE), (180, cv2.ROTATE_180), (270, cv2.ROTATE_90_COUNTERCLOCKWISE)]:
        candidates.append((cv2.rotate(image, rotate_code), angle))
    processed: list[tuple[np.ndarray, int]] = []
    for candidate, angle in candidates:
        g = cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY)
        # Denoise, normalize illumination, and sharpen faint print without binarizing handwriting.
        denoised = cv2.fastNlMeansDenoising(g, None, 8, 7, 21)
        background = cv2.GaussianBlur(denoised, (0, 0), 21)
        normalized = cv2.divide(denoised, background, scale=245)
        sharpened = cv2.addWeighted(normalized, 1.35, cv2.GaussianBlur(normalized, (0, 0), 2), -0.35, 0)
        processed.append((cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR), angle))
    return processed[0][0], {"blur_score": round(blur, 2), "blurred": blur < BLUR_THRESHOLD, "rotations": processed}


def parse_ocr(result: Any) -> list[tuple[str, float]]:
    lines: list[tuple[str, float]] = []
    for page in result or []:
        data = getattr(page, "json", None)
        payload = data if isinstance(data, dict) else {}
        res = payload.get("res", payload)
        texts = res.get("rec_texts", []) if isinstance(res, dict) else []
        scores = res.get("rec_scores", []) if isinstance(res, dict) else []
        if not texts and isinstance(page, (list, tuple)):
            # Compatibility with PaddleOCR's legacy list result structure.
            for item in page:
                if isinstance(item, (list, tuple)) and len(item) >= 2 and isinstance(item[1], (list, tuple)) and len(item[1]) >= 2:
                    texts.append(str(item[1][0])); scores.append(float(item[1][1]))
        for text, score in zip(texts, scores):
            if str(text).strip():
                lines.append((str(text).strip(), float(score)))
    return lines


def parse_values(lines: list[tuple[str, float]]) -> tuple[dict[str, Any], dict[str, float | None], list[str]]:
    values: dict[str, Any] = {"od": {"sph": None, "cyl": None, "axis": None, "add": None}, "os": {"sph": None, "cyl": None, "axis": None, "add": None}, "pd_far": None, "pd_near": None}
    confidence: dict[str, float | None] = {f"{eye}.{key}": None for eye in ("od", "os") for key in ("sph", "cyl", "axis", "add")}
    confidence.update({"pd_far": None, "pd_near": None})
    warnings: list[str] = []
    normalized = [(re.sub(r"\b0D\b", "OD", re.sub(r"\bO5\b", "OS", re.sub(r"\s+", " ", text.upper().replace("−", "-").replace("–", "-").replace(",", ".")))), score) for text, score in lines]
    active_eye: str | None = None
    for line, score in normalized:
        eye_matches = list(re.finditer(r"\b(OD|OS|RIGHT|LEFT)\b", line))
        if eye_matches:
            active_eye = "od" if eye_matches[-1].group(1) in {"OD", "RIGHT"} else "os"
        # Printed prescriptions commonly put OD/OS on a heading line and the
        # measurements on the following lines. Carry that explicit heading
        # forward, but never infer an eye before an OD/OS heading is seen.
        if not eye_matches and active_eye is None:
            continue
        # Labeled fields avoid guessing unlabeled values. Accept decimal and signed diopters.
        for key, labels in (("sph", r"SPH|SP"), ("cyl", r"CYL|CY"), ("axis", r"AXIS|AX|\bA\b"), ("add", r"ADD|ADDITION")):
            match = re.search(rf"(?:{labels})\s*[:=]?\s*([+-]?\d{{1,3}}(?:\.\d{{1,2}})?)", line)
            if not match:
                continue
            preceding = [eye_match for eye_match in eye_matches if eye_match.start() < match.start()]
            eye = ("od" if preceding[-1].group(1) in {"OD", "RIGHT"} else "os") if preceding else active_eye
            if eye is None:
                continue
            number = float(match.group(1)); field = f"{eye}.{key}"
            if key == "axis": number = int(round(number))
            if not valid_range(key, number):
                warnings.append(f"{field}: extracted value is outside the expected range")
                continue
            values[eye][key] = number; confidence[field] = round(score, 4)
    for line, score in normalized:
        for key, pattern in (("pd_far", r"(?:PD|PUPILLARY DISTANCE)(?:\s*FAR)?\s*[:=]?\s*(\d{2}(?:\.\d)?)"), ("pd_near", r"PD\s*NEAR\s*[:=]?\s*(\d{2}(?:\.\d)?)")):
            m = re.search(pattern, line)
            if m:
                number = float(m.group(1))
                if valid_range(key, number): values[key] = number; confidence[key] = round(score, 4)
    for key, confidence_value in confidence.items():
        if confidence_value is None:
            warnings.append(f"{key}: not confidently extracted; verify manually")
        elif confidence_value < 0.75:
            warnings.append(f"{key}: low OCR confidence; verify manually")
    return values, confidence, list(dict.fromkeys(warnings))


def valid_range(key: str, value: float) -> bool:
    ranges = {"sph": (-30, 30), "cyl": (-15, 15), "axis": (0, 180), "add": (0, 10), "pd_far": (40, 80), "pd_near": (35, 75)}
    lo, hi = ranges[key]
    return lo <= value <= hi


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "paddleocr-local"}


@app.post("/v1/ocr/prescription", response_model=OCRResponse)
async def prescription_ocr(file: UploadFile = File(...), authorization: str | None = Header(default=None)) -> OCRResponse:
    if not TOKEN or not authorization or not secrets.compare_digest(authorization, f"Bearer {TOKEN}"):
        raise HTTPException(401, "Unauthorized")
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds upload limit")
    suffix = Path(file.filename or "scan.jpg").suffix[:10] or ".img"
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(content); tmp.flush()
        image = cv2.imread(tmp.name, cv2.IMREAD_COLOR)
    _, quality = preprocess(image)
    lines: list[tuple[str, float]] = []
    selected_angle = 0
    for candidate, angle in quality.pop("rotations"):
        candidate_lines = parse_ocr(engine.predict(candidate))
        if sum(score for _, score in candidate_lines) > sum(score for _, score in lines):
            lines, selected_angle = candidate_lines, angle
    values, confidence, field_warnings = parse_values(lines)
    warnings = list(field_warnings)
    if quality["blurred"]:
        warnings.append("Image appears blurred; retake in focus and verify every value.")
    if not lines:
        warnings.append("No readable printed text found. Handwriting may require manual entry.")
    quality["rotation_correction_degrees"] = selected_angle
    quality["orientation_corrected"] = selected_angle != 0
    return OCRResponse(values=values, confidence=confidence, field_warnings=field_warnings, warnings=warnings, quality=quality, raw_text=[line for line, _ in lines], raw_confidences=[score for _, score in lines])
