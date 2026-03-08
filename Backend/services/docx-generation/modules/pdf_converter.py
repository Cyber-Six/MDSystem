import io
import logging

import mammoth
from weasyprint import HTML

logger = logging.getLogger(__name__)


def docx_bytes_to_pdf(docx_bytes: bytes) -> bytes:
    """
    Convert in-memory DOCX bytes to PDF using mammoth (DOCX → HTML)
    and WeasyPrint (HTML → PDF).

    Args:
        docx_bytes: Raw DOCX content.

    Returns:
        Rendered PDF as bytes.

    Raises:
        RuntimeError: If conversion fails.
    """
    try:
        result = mammoth.convert_to_html(io.BytesIO(docx_bytes))
        html = _wrap_html(result.value)
        logger.info("DOCX→HTML conversion done. Warnings: %s", result.messages)
    except Exception as exc:
        raise RuntimeError(f"DOCX to HTML conversion failed: {exc}") from exc

    try:
        return HTML(string=html).write_pdf()
    except Exception as exc:
        raise RuntimeError(f"HTML to PDF conversion failed: {exc}") from exc


def _wrap_html(body: str) -> str:
    """Wrap a bare HTML fragment in a full document with basic print styles."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page {{ margin: 20mm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 12pt; }}
  td, th {{ border: 1px solid #ccc; padding: 4pt 6pt; font-size: 10pt; }}
  p {{ margin: 0 0 6pt; }}
</style>
</head>
<body>{body}</body>
</html>"""
