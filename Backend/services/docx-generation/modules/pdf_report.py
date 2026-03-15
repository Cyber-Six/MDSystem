import base64
import logging
from datetime import datetime
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from config import REPORT_TEMPLATES_DIR
from modules.chart_generator import generate_chart_image

logger = logging.getLogger(__name__)


def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(REPORT_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )


def _generate_chart_b64_images(charts: list[dict]) -> list[str]:
    """
    Generate chart images and return them as base64-encoded data URIs
    suitable for embedding in HTML <img> tags.
    """
    images = []
    for chart_spec in charts:
        img_bytes = generate_chart_image(chart_spec)
        b64 = base64.b64encode(img_bytes).decode("ascii")
        images.append(f"data:image/png;base64,{b64}")
    return images


def render_report_html(
    title: str,
    columns: list[dict],
    data: list[dict],
    filters: dict | None = None,
    orientation: str = "portrait",
    template_name: str = "base.html",
    charts: list[dict] | None = None,
) -> str:
    """
    Render report data into an HTML string using a Jinja2 template.

    Args:
        title: Report title.
        columns: List of {"key": ..., "label": ...} column definitions.
        data: List of row dicts.
        filters: Optional filter summary to display in the header.
        orientation: Page orientation ("portrait" or "landscape").
        template_name: HTML template file in the reports/ directory.
        charts: Optional list of chart specs to generate and embed.

    Returns:
        Rendered HTML string.
    """
    env = _get_jinja_env()
    template = env.get_template(template_name)

    # Generate chart images if any
    chart_images = []
    if charts:
        logger.info("Generating %d chart(s) for report '%s'", len(charts), title)
        chart_images = _generate_chart_b64_images(charts)

    return template.render(
        title=title,
        columns=columns,
        data=data,
        filters=filters or {},
        orientation=orientation,
        generated_at=datetime.now().strftime("%B %d, %Y %I:%M %p"),
        row_count=len(data),
        chart_images=chart_images,
    )


def generate_report_pdf(
    title: str,
    columns: list[dict],
    data: list[dict],
    filters: dict | None = None,
    orientation: str = "portrait",
    template_name: str = "base.html",
    charts: list[dict] | None = None,
) -> bytes:
    """
    Render report data into a PDF.

    Returns:
        PDF content as bytes.
    """
    html_content = render_report_html(
        title=title,
        columns=columns,
        data=data,
        filters=filters,
        orientation=orientation,
        template_name=template_name,
        charts=charts,
    )

    logger.info("Generating report PDF: %s (%d rows)", title, len(data))
    return HTML(string=html_content).write_pdf()
