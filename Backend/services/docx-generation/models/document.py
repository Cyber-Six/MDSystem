from pydantic import BaseModel


class DocumentGenerateRequest(BaseModel):
    """Request to generate a DOCX or PDF from a template."""
    template: str                   # Template name (e.g. "medical_certificate")
    tags: dict[str, str] = {}       # Jinja2 tag values to render into the template

    class Config:
        json_schema_extra = {
            "example": {
                "template": "medical_certificate",
                "tags": {
                    "NAME": "Juan Dela Cruz",
                    "DATE": "2026-03-09",
                    "DIAGNOSIS": "Flu",
                    "LICENSE_NO": "12345"
                }
            }
        }
