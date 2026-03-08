from jinja2 import Environment, FileSystemLoader, select_autoescape

from config import PREVIEW_TEMPLATES_DIR


def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(PREVIEW_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )


def generate_preview_html(name: str, docx_base64: str, safe_name: str) -> str:
    """
    Render the in-browser DOCX preview page.

    Args:
        name: Display name shown in the preview header.
        docx_base64: Base64-encoded DOCX bytes for mammoth.js.
        safe_name: Sanitized filename used for the download link.

    Returns:
        Complete HTML page as a string.
    """
    env = _get_jinja_env()
    template = env.get_template("template.html")

    return template.render(
        name=name,
        docx_base64=docx_base64,
        safe_name=safe_name,
    )
