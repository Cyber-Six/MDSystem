import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

from config import TEMPLATE_DIR
from models.document import DocumentGenerateRequest
from modules.docx_generator import generate_docx_bytes, resolve_template_path, list_templates
from modules.pdf_converter import docx_bytes_to_pdf
from modules.preview_renderer import generate_preview_html
from utils.helpers import encode_to_base64, sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/templates")
def get_templates():
    """List available .docx templates."""
    return {"templates": list_templates(TEMPLATE_DIR)}


@router.post("/generate")
def generate_document(request: DocumentGenerateRequest):
    """
    Generate a DOCX from a template and return the file bytes.
    Used by the Express backend to produce a downloadable DOCX.
    """
    try:
        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.tags, template_path)
        safe_name = sanitize_filename(request.template)

        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/preview")
def preview_document(request: DocumentGenerateRequest):
    """
    Generate a DOCX and return an HTML preview page (mammoth.js).
    """
    try:
        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.tags, template_path)
        docx_base64 = encode_to_base64(docx_bytes)
        safe_name = sanitize_filename(request.template)
        display_name = request.tags.get("NAME", request.template)

        html = generate_preview_html(display_name, docx_base64, safe_name)
        return HTMLResponse(content=html)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/pdf")
def generate_document_pdf(request: DocumentGenerateRequest):
    """
    Generate a DOCX then convert it to PDF (mammoth + WeasyPrint).
    Used for releasing medical documents as PDF.
    """
    try:
        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.tags, template_path)
        pdf_bytes = docx_bytes_to_pdf(docx_bytes)
        safe_name = sanitize_filename(request.template)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
