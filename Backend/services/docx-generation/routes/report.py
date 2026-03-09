import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

from models.report import ReportGenerateRequest
from modules.pdf_report import generate_report_pdf, render_report_html
from utils.helpers import sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/pdf")
def report_to_pdf(request: ReportGenerateRequest):
    """
    Generate a PDF report from structured data.
    Used for analytics: consultations, morbidity, inventory reports.
    """
    try:
        columns = [c.model_dump() for c in request.columns]
        pdf_bytes = generate_report_pdf(
            title=request.title,
            columns=columns,
            data=request.data,
            filters=request.filters,
            orientation=request.orientation,
            template_name=request.template,
        )
        safe_name = sanitize_filename(f"{request.report_type}_report")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )
    except Exception as exc:
        logger.error("Report PDF generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/preview")
def preview_report(request: ReportGenerateRequest):
    """
    Preview a report as an HTML page (same layout as the PDF).
    """
    try:
        columns = [c.model_dump() for c in request.columns]
        html = render_report_html(
            title=request.title,
            columns=columns,
            data=request.data,
            filters=request.filters,
            orientation=request.orientation,
            template_name=request.template,
        )
        return HTMLResponse(content=html)
    except Exception as exc:
        logger.error("Report preview failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
