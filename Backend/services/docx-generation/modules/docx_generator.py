import io
import os
import logging
from pathlib import Path

from docxtpl import DocxTemplate

logger = logging.getLogger(__name__)


def resolve_template_path(template_dir: str, template_name: str) -> str:
    """
    Resolve a template name to a full path, preventing path traversal.

    Args:
        template_dir: Root directory containing .docx templates.
        template_name: Template name (without .docx extension).

    Returns:
        Absolute path to the .docx template file.

    Raises:
        FileNotFoundError: If the template does not exist.
        ValueError: If the resolved path escapes the template directory.
    """
    safe_name = Path(template_name).name  # strip any directory components
    candidate = os.path.join(template_dir, f"{safe_name}.docx")

    real_path = os.path.realpath(candidate)
    real_dir = os.path.realpath(template_dir)
    if not real_path.startswith(real_dir + os.sep) and real_path != real_dir:
        raise ValueError("Invalid template name")

    if not os.path.isfile(real_path):
        raise FileNotFoundError(f"Template not found: {safe_name}.docx")

    return real_path


def generate_docx_bytes(tags: dict, template_path: str) -> bytes:
    """
    Render a .docx template with the given tag values and return raw bytes.

    Args:
        tags: Dictionary of Jinja2 tag values.
        template_path: Absolute path to the .docx template.

    Returns:
        Rendered DOCX file as bytes.
    """
    logger.info("Generating DOCX with tags: %s", list(tags.keys()))

    doc = DocxTemplate(template_path)
    doc.render(tags)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    docx_bytes = buf.getvalue()
    logger.info("DOCX generated: %d bytes", len(docx_bytes))
    return docx_bytes


def list_templates(template_dir: str) -> list[dict]:
    """
    List available .docx templates in the template directory.

    Returns:
        List of dicts with 'name' (stem) and 'filename'.
    """
    if not template_dir or not os.path.isdir(template_dir):
        return []

    return [
        {"name": f.stem, "filename": f.name}
        for f in sorted(Path(template_dir).glob("*.docx"))
    ]
