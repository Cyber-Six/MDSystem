"""
Backward-compatible `/generate-docx` endpoint.

The original requirement specified `POST /generate-docx` as the primary
endpoint. The canonical routes now live under `/documents/*`, but this
legacy alias is kept so existing callers continue to work.
"""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from config import TEMPLATE_DIR
from models.document import DocumentGenerateRequest
from models.tag_contracts import get_contract
from modules.docx_generator import generate_docx_bytes, resolve_template_path
from utils.helpers import sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Legacy"])


@router.post("/generate-docx")
def generate_docx_legacy(request: DocumentGenerateRequest):
    """
    Legacy endpoint — equivalent to POST /documents/generate.
    Accepts { template, tags } and returns DOCX bytes.
    """
    try:
        contract = get_contract(request.template)
        if contract:
            missing = contract.validate(request.data)
            if missing:
                raise ValueError(f"Missing required tags: {', '.join(missing)}")

        template_path = resolve_template_path(TEMPLATE_DIR, request.template)
        docx_bytes = generate_docx_bytes(request.data, template_path)
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
