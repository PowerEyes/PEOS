"""Download PaddleOCR detection and recognition models once during provisioning."""
import os
from pathlib import Path
from paddleocr import PaddleOCR

root = Path(os.environ.get("OCR_MODEL_DIR", "./models/paddleocr"))
root.mkdir(parents=True, exist_ok=True)
PaddleOCR(
    text_detection_model_name=os.environ.get("OCR_DET_MODEL", "PP-OCRv5_server_det"),
    text_recognition_model_name=os.environ.get("OCR_REC_MODEL", "PP-OCRv5_server_rec"),
    text_detection_model_dir=str(root / "det"),
    text_recognition_model_dir=str(root / "rec"),
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=True,
    device="cpu",
)
print(f"Models provisioned in {root.resolve()}")
