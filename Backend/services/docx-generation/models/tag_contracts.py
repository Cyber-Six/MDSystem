"""
Tag contracts per document type.

Each entry maps a template name to its expected Jinja2 tag definitions.
This serves as both documentation and runtime validation so callers know
exactly which tags a template requires.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TagField:
    """A single tag expected by a template."""
    name: str
    description: str
    required: bool = True
    example: str = ""


@dataclass(frozen=True)
class TemplateContract:
    """Defines the tag contract for one document template."""
    template: str
    display_name: str
    description: str
    tags: list[TagField] = field(default_factory=list)

    @property
    def required_tags(self) -> list[str]:
        return [t.name for t in self.tags if t.required]

    @property
    def all_tags(self) -> list[str]:
        return [t.name for t in self.tags]

    def validate(self, provided_tags: dict) -> list[str]:
        """Return list of missing required tag names."""
        return [t for t in self.required_tags if t not in provided_tags]

    def to_dict(self) -> dict:
        return {
            "template": self.template,
            "display_name": self.display_name,
            "description": self.description,
            "tags": [
                {
                    "name": t.name,
                    "description": t.description,
                    "required": t.required,
                    "example": t.example,
                }
                for t in self.tags
            ],
        }


# ---------------------------------------------------------------------------
# Contract definitions
# ---------------------------------------------------------------------------

MEDICAL_CERTIFICATE = TemplateContract(
    template="medical_certificate",
    display_name="Medical Certificate",
    description="Certifies a patient's medical condition or fitness.",
    tags=[
        TagField("NAME",       "Full name of the patient",       example="Juan Dela Cruz"),
        TagField("DATE",       "Date of certificate issuance",   example="2026-03-09"),
        TagField("DIAGNOSIS",  "Medical diagnosis or findings",  example="Acute Upper Respiratory Tract Infection"),
        TagField("LICENSE_NO", "Physician license number",       example="PRC-0012345"),
    ],
)

MEDICAL_CLEARANCE = TemplateContract(
    template="medical_clearance",
    display_name="Medical Clearance",
    description="Clears a patient for a specific purpose (employment, sports, travel, etc.).",
    tags=[
        TagField("NAME",       "Full name of the patient",       example="Juan Dela Cruz"),
        TagField("DATE",       "Date of clearance issuance",     example="2026-03-09"),
        TagField("PURPOSE",    "Purpose of clearance",           example="Pre-employment"),
        TagField("LICENSE_NO", "Physician license number",       example="PRC-0012345"),
    ],
)

PRESCRIPTION = TemplateContract(
    template="prescription",
    display_name="Prescription",
    description="Medication prescription for a patient.",
    tags=[
        TagField("NAME",       "Full name of the patient",       example="Juan Dela Cruz"),
        TagField("DATE",       "Date of prescription",           example="2026-03-09"),
        TagField("MEDICATION", "Prescribed medication details",  example="Amoxicillin 500mg — 1 cap TID x 7 days"),
        TagField("LICENSE_NO", "Physician license number",       example="PRC-0012345"),
        TagField("PTR_NO",     "Physician tax receipt number",   example="PTR-0067890"),
    ],
)

LAB_REFERRAL = TemplateContract(
    template="lab_referral",
    display_name="Lab Referral",
    description="Referral for laboratory or diagnostic tests.",
    tags=[
        TagField("NAME",       "Full name of the patient",       example="Juan Dela Cruz"),
        TagField("DATE",       "Date of referral",               example="2026-03-09"),
        TagField("TEST_TYPE",  "Type of laboratory test",        example="Complete Blood Count (CBC)"),
        TagField("LICENSE_NO", "Physician license number",       example="PRC-0012345"),
    ],
)


# ---------------------------------------------------------------------------
# Registry — look up a contract by template name
# ---------------------------------------------------------------------------

CONTRACTS: dict[str, TemplateContract] = {
    c.template: c
    for c in [MEDICAL_CERTIFICATE, MEDICAL_CLEARANCE, PRESCRIPTION, LAB_REFERRAL]
}


def get_contract(template_name: str) -> TemplateContract | None:
    """Return the contract for a template, or None if not registered."""
    return CONTRACTS.get(template_name)


def list_contracts() -> list[dict]:
    """Return all contracts as serialisable dicts."""
    return [c.to_dict() for c in CONTRACTS.values()]
