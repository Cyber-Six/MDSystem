import re

from pydantic import BaseModel, model_validator


def _normalize_keys(data: dict[str, str]) -> dict[str, str]:
    """Strip angle brackets from keys: '<NAME>' -> 'NAME'."""
    return {re.sub(r"^<|>$", "", k): v for k, v in data.items()}


def _strip_docx_ext(name: str) -> str:
    """Remove .docx extension if present: 'example.docx' -> 'example'."""
    return name.removesuffix(".docx")


class DocumentGenerateRequest(BaseModel):
    """Request to generate a DOCX or PDF from a template.

    Accepts either ``data`` or ``tags`` for the placeholder values.
    Template name can be provided with or without the .docx extension.
    Keys in data/tags may use angle brackets (e.g. ``<NAME>``) which are
    stripped automatically.
    """
    template: str
    data: dict[str, str] | None = None
    tags: dict[str, str] | None = None

    @model_validator(mode="after")
    def _merge_data_and_tags(self) -> "DocumentGenerateRequest":
        # Merge data + tags (data takes priority), default to empty dict
        merged: dict[str, str] = {}
        if self.tags:
            merged.update(self.tags)
        if self.data:
            merged.update(self.data)
        self.data = _normalize_keys(merged)
        self.tags = self.data  # keep tags in sync for backward compat
        # Normalize template name
        self.template = _strip_docx_ext(self.template)
        return self

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "template": "medical_certificate.docx",
                    "data": {
                        "<NAME>": "Juan Dela Cruz",
                        "<DATE>": "2026-03-09",
                        "<DIAGNOSIS>": "Flu",
                        "<LICENSE_NO>": "12345"
                    }
                },
                {
                    "template": "medical_certificate",
                    "tags": {
                        "NAME": "Juan Dela Cruz",
                        "DATE": "2026-03-09",
                        "DIAGNOSIS": "Flu",
                        "LICENSE_NO": "12345"
                    }
                }
            ]
        }
