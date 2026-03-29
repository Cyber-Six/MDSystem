"""
Prescription PDF generation route.

Direct HTML → PDF path using Jinja2 + WeasyPrint.
Optimized for constrained hardware (RPi 5) — no DOCX intermediate step.
"""

import base64
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from models.prescription import PrescriptionRequest
from utils.helpers import sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prescription", tags=["Prescription"])

# ── Template & asset setup ──────────────────────────────────────────────

SERVICE_ROOT = Path(__file__).resolve().parent.parent
PRESCRIPTION_TEMPLATE_DIR = SERVICE_ROOT / "templates" / "prescription"
ASSETS_DIR = SERVICE_ROOT / "assets"
LOGO_PATH = ASSETS_DIR / "tip_logo.jpg"

_jinja_env = Environment(
    loader=FileSystemLoader(str(PRESCRIPTION_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)

# Cache logo base64 at startup to avoid re-reading each request
_logo_base64: str | None = None


def _get_logo_base64() -> str | None:
    global _logo_base64
    if _logo_base64 is not None:
        return _logo_base64
    try:
        if LOGO_PATH.is_file():
            with open(LOGO_PATH, "rb") as f:
                _logo_base64 = base64.b64encode(f.read()).decode("ascii")
            logger.info("Loaded TIP logo from %s (%d bytes)", LOGO_PATH, len(_logo_base64))
        else:
            logger.warning("Logo file not found at %s", LOGO_PATH)
            _logo_base64 = ""
    except Exception as exc:
        logger.warning("Failed to load logo: %s", exc)
        _logo_base64 = ""
    return _logo_base64 or None


# ── Route ────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate_prescription_pdf(request: PrescriptionRequest):
    """
    Generate a prescription PDF directly from HTML template.

    Returns raw PDF bytes with the filename set to the request's filename field
    (default: ``prescription.pdf``).
    """
    try:
        template = _jinja_env.get_template("prescription.html")

        medications = [m.model_dump() for m in request.medications]

        html = template.render(
            patient_name=request.patient_name,
            patient_age=request.patient_age,
            patient_sex=request.patient_sex,
            date=request.date,
            medications=medications,
            notes=request.notes,
            doctor_name=request.doctor_name,
            license_no=request.license_no,
            ptr_no=request.ptr_no,
            logo_base64=_get_logo_base64(),
        )

        pdf_bytes = HTML(string=html).write_pdf()
        safe_name = sanitize_filename(request.filename) or "prescription"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.pdf"',
            },
        )
    except Exception as exc:
        logger.exception("Prescription PDF generation failed")
        raise HTTPException(status_code=500, detail=str(exc))
