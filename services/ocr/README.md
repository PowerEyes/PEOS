# PowerOS local prescription OCR

This internal FastAPI service runs PaddleOCR models locally. After Python wheels and model weights are installed, inference has no hosted OCR dependency and can run offline. It does not persist source images; the ERP uploads the original to the existing private Supabase `prescriptions` bucket and sends a resized working image to this service.

## Requirements

- Linux server/container host, Python 3.10–3.12 (Docker uses 3.11), 4+ GB RAM for the server recognition model, and enough disk for Python dependencies and model weights.
- PaddlePaddle/PaddleOCR model distribution downloads are needed only during provisioning. Review the upstream PaddleOCR and PaddlePaddle licenses and pin/model-checksum your deployment artifacts.
- OCR quality varies with print, handwriting, scan quality and layout. Field confidence is PaddleOCR text-line confidence for the matched labeled line; it is a review signal, not calibrated probability or clinical validation. Do not use OCR output as a prescription without optometrist verification.

## Provision models (online, once)

From `services/ocr` in a Python environment:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export OCR_MODEL_DIR="$PWD/models/paddleocr"
python download_models.py
```

The provisioning process initializes PP-OCRv5 server detection and recognition weights into `models/paddleocr/{det,rec}`. Verify that both directories contain the model inference files before packaging. Package that directory with the deployment image or mount it read-only. Runtime uses explicit local directories and fails startup if absent; it does not fetch hosted models. Keep `models/` out of source control if storing weights externally.

## Run locally

Set the same strong secret in the OCR and ERP environments:

```sh
export OCR_SERVICE_TOKEN="$(openssl rand -hex 32)"
export OCR_MODEL_DIR="$PWD/models/paddleocr"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

The service exposes `/health` and authenticated `POST /v1/ocr/prescription` multipart field `file`. It accepts image uploads only, caps payload size, validates dimensions, preprocesses illumination/noise, checks blur and evaluates cardinal rotations. JSON includes OD/OS values, per-field confidence, warnings, image quality and extracted text. The parser fills only explicitly labeled values; ambiguous and handwritten fields stay empty for manual correction.

## Docker/internal deployment

1. Provision models as above and store the `models` volume on the private server.
2. Create `services/ocr/.env` from `.env.example`; set a cryptographically random `OCR_SERVICE_TOKEN`.
3. Build and start with `docker compose up -d --build`. Do not publish port 8000 or place it on a public network. Put it on the same private network as the ERP; permit only the ERP workload to connect, and add TLS/mTLS when crossing host boundaries.
4. In `apps/erp/.env.local` (and production server secrets), set `OCR_SERVICE_URL=http://ocr:8000` and the identical `OCR_SERVICE_TOKEN`. Restart Next.js after changing environment values.
5. Back up the existing private Supabase prescriptions bucket and restrict access through its existing RLS policies. Original images stay in that bucket. Keep OCR request logs free of image bytes and patient content.

Production should use a private service network, secret manager, non-root container runtime, resource limits, health checks, patching, and encrypted storage/backups. Scale with one worker per model instance; benchmark memory before adding replicas. CPU execution is selected by default; provision a compatible PaddlePaddle GPU build separately if needed.

## ERP workflow

The authenticated ERP route verifies the staff session, rate-limits and proxies to this private endpoint. The prescription form stores the uploaded original in the existing private bucket, shows editable values and confidence/quality warnings, then saves through the current `prescriptions` table. OCR records remain `pending` and the existing order-side database gate prevents unapproved use. The optometrist approval action records `approved_by`, `approved_at` and an audit row. OCR confidence/warnings are recorded in `prescription_audit_log` metadata.

## Checks

Run service tests with `pip install pytest && PYTHONPATH=. pytest`; run ERP checks with `pnpm --filter @poweros/erp build`; and exercise the browser prescription upload/review/approval flow against a test Supabase project and a running local OCR service. Use synthetic or de-identified scans in tests. OCR does not promise perfect extraction; optometrist approval is mandatory.
