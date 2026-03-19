import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response

from config import TEMPLATE_DIR
from models.document import DocumentGenerateRequest
from models.tag_contracts import get_contract, list_contracts
from modules.docx_generator import generate_docx_bytes, resolve_template_path, list_templates
from modules.pdf_converter import docx_bytes_to_pdf
from modules.preview_renderer import generate_preview_html
from utils.helpers import encode_to_base64, sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_tags(request: DocumentGenerateRequest) -> None:
    """Raise 400 if required tags are missing for a known template."""
    contract = get_contract(request.template)
    if contract:
        missing = contract.validate(request.data)
        if missing:
            raise ValueError(f"Missing required tags: {', '.join(missing)}")


def _wants_json(request: Request) -> bool:
    """Check if the caller prefers a JSON response (for Node.js API usage)."""
    accept = request.headers.get("accept", "")
    return "application/json" in accept


# ---------------------------------------------------------------------------
# Template info
# ---------------------------------------------------------------------------

@router.get("/templates")
def get_templates():
    """List available .docx templates."""
    return {"templates": list_templates(TEMPLATE_DIR)}


@router.get("/contracts")
def get_tag_contracts():
    """Return tag contracts for all registered document types."""
    return {"contracts": list_contracts()}


# ---------------------------------------------------------------------------
# Document generation
# ---------------------------------------------------------------------------

@router.post("/generate")
def generate_document(request: DocumentGenerateRequest, raw_request: Request):
    """
    Generate a DOCX from a template.

    Response format depends on the `Accept` header:
    - `Accept: application/json` → JSON with base64-encoded content (API-friendly)
    - Otherwise → raw DOCX binary stream (browser download)
    """
    try:
        _validate_tags(request)
        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.data, template_path)
        safe_name = sanitize_filename(request.template)

        if _wants_json(raw_request):
            return JSONResponse(content={
                "filename": f"{safe_name}.docx",
                "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "content_base64": encode_to_base64(docx_bytes),
                "size": len(docx_bytes),
            })

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
        _validate_tags(request)
        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.data, template_path)
        docx_base64 = encode_to_base64(docx_bytes)
        safe_name = sanitize_filename(request.template)
        display_name = request.data.get("NAME", request.template)

        html = generate_preview_html(display_name, docx_base64, safe_name)
        return HTMLResponse(content=html)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/pdf")
def generate_document_pdf(request: DocumentGenerateRequest, raw_request: Request):
    """
    Generate a DOCX then convert it to PDF (mammoth + WeasyPrint).

    Response format depends on the `Accept` header:
    - `Accept: application/json` → JSON with base64-encoded PDF (API-friendly)
    - Otherwise → raw PDF binary stream (browser download)
    """
    try:
        _validate_tags(request)
        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.data, template_path)
        pdf_bytes = docx_bytes_to_pdf(docx_bytes)
        safe_name = sanitize_filename(request.template)

        if _wants_json(raw_request):
            return JSONResponse(content={
                "filename": f"{safe_name}.pdf",
                "content_type": "application/pdf",
                "content_base64": encode_to_base64(pdf_bytes),
                "size": len(pdf_bytes),
            })

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
