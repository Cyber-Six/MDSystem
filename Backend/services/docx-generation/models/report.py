from typing import Any

from pydantic import BaseModel


class ReportColumn(BaseModel):
    """A single column definition for a report table."""
    key: str        # Data key in each row dict
    label: str      # Human-readable column header


class ReportChartSpec(BaseModel):
    """A chart to embed in the report."""
    graph: str                          # "bar", "line", "pie"
    datas: dict[str, Any]               # {labels, values, title?, xlabel?, ylabel?, colors?}


class ReportGenerateRequest(BaseModel):
    """Request to generate an analytics/report PDF or preview."""
    title: str
    report_type: str                    # "consultations", "morbidity", "inventory", etc.
    columns: list[ReportColumn]
    data: list[dict]
    charts: list[ReportChartSpec] = []  # Optional charts to embed in the report
    filters: dict = {}                  # Filter summary (e.g. {"date_from": "...", "date_to": "..."})
    orientation: str = "portrait"       # "portrait" or "landscape"
    template: str = "base.html"         # Report HTML template name (for custom layouts)

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Monthly Consultation Report",
                "report_type": "consultations",
                "columns": [
                    {"key": "date", "label": "Date"},
                    {"key": "patient", "label": "Patient"},
                    {"key": "diagnosis", "label": "Diagnosis"}
                ],
                "data": [
                    {"date": "2026-03-01", "patient": "Juan Dela Cruz", "diagnosis": "Flu"}
                ],
                "charts": [
                    {
                        "graph": "bar",
                        "datas": {
                            "labels": ["Jan", "Feb", "Mar"],
                            "values": [10, 25, 18],
                            "title": "Monthly Consultations"
                        }
                    }
                ],
                "filters": {"month": "March 2026"},
                "orientation": "landscape"
            }
        }
