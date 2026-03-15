"""
Matplotlib chart generator for embedding charts in documents and reports.

Supports chart types: bar, line, pie.

Usage:
    from modules.chart_generator import generate_chart_image

    # Bar chart
    img_bytes = generate_chart_image({
        "graph": "bar",
        "datas": {
            "labels": ["Jan", "Feb", "Mar"],
            "values": [10, 25, 18],
            "title": "Monthly Consultations",
            "xlabel": "Month",
            "ylabel": "Count"
        }
    })

    # Pie chart
    img_bytes = generate_chart_image({
        "graph": "pie",
        "datas": {
            "labels": ["Flu", "Cough", "Fever"],
            "values": [40, 30, 30],
            "title": "Diagnosis Distribution"
        }
    })
"""

import io
import logging

import matplotlib
matplotlib.use("Agg")  # non-interactive backend (no GUI)
import matplotlib.pyplot as plt

logger = logging.getLogger(__name__)

# Supported chart types
SUPPORTED_CHARTS = {"bar", "line", "pie"}


def generate_chart_image(chart_spec: dict, fmt: str = "png", dpi: int = 150) -> bytes:
    """
    Generate a chart image from a specification dict.

    Args:
        chart_spec: Dict with keys:
            - graph: Chart type ("bar", "line", "pie")
            - datas: Dict with chart data:
                - labels: list of labels
                - values: list of numeric values
                - title: (optional) chart title
                - xlabel: (optional) x-axis label
                - ylabel: (optional) y-axis label
                - colors: (optional) list of colors
        fmt: Image format ("png", "jpg", "svg").
        dpi: Resolution in dots per inch.

    Returns:
        Image bytes.

    Raises:
        ValueError: If chart type is unsupported or data is invalid.
    """
    graph_type = chart_spec.get("graph", "").lower()
    if graph_type not in SUPPORTED_CHARTS:
        raise ValueError(
            f"Unsupported chart type: '{graph_type}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_CHARTS))}"
        )

    datas = chart_spec.get("datas", {})
    labels = datas.get("labels", [])
    values = datas.get("values", [])

    if not labels or not values:
        raise ValueError("Chart 'datas' must include non-empty 'labels' and 'values'")
    if len(labels) != len(values):
        raise ValueError(
            f"labels ({len(labels)}) and values ({len(values)}) must be the same length"
        )

    title = datas.get("title", "")
    xlabel = datas.get("xlabel", "")
    ylabel = datas.get("ylabel", "")
    colors = datas.get("colors", None)

    fig, ax = plt.subplots(figsize=(7, 4))

    try:
        if graph_type == "bar":
            _draw_bar(ax, labels, values, colors)
        elif graph_type == "line":
            _draw_line(ax, labels, values, colors)
        elif graph_type == "pie":
            _draw_pie(ax, labels, values, colors)

        if title:
            ax.set_title(title, fontsize=12, fontweight="bold", pad=12)
        if xlabel and graph_type != "pie":
            ax.set_xlabel(xlabel)
        if ylabel and graph_type != "pie":
            ax.set_ylabel(ylabel)

        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format=fmt, dpi=dpi, bbox_inches="tight")
        buf.seek(0)
        img_bytes = buf.getvalue()

        logger.info(
            "Chart generated: type=%s, points=%d, size=%d bytes",
            graph_type, len(labels), len(img_bytes),
        )
        return img_bytes
    finally:
        plt.close(fig)


def is_chart_spec(value) -> bool:
    """Check if a tag value is a chart specification (dict with 'graph' key)."""
    return isinstance(value, dict) and "graph" in value and "datas" in value


# ---------------------------------------------------------------------------
# Internal drawing helpers
# ---------------------------------------------------------------------------

def _draw_bar(ax, labels, values, colors):
    bar_colors = colors or ["#4C9BE8"]
    if len(bar_colors) == 1:
        bar_colors = bar_colors * len(labels)
    ax.bar(labels, values, color=bar_colors[:len(labels)])
    ax.tick_params(axis="x", rotation=45 if len(labels) > 6 else 0)


def _draw_line(ax, labels, values, colors):
    color = colors[0] if colors else "#4C9BE8"
    ax.plot(labels, values, marker="o", color=color, linewidth=2)
    ax.tick_params(axis="x", rotation=45 if len(labels) > 6 else 0)
    ax.grid(True, alpha=0.3)


def _draw_pie(ax, labels, values, colors):
    pie_colors = colors or plt.cm.Set3.colors[:len(labels)]
    ax.pie(
        values,
        labels=labels,
        colors=pie_colors[:len(labels)],
        autopct="%1.1f%%",
        startangle=90,
    )
    ax.axis("equal")
