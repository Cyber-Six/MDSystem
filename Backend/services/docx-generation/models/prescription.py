"""
Pydantic models for the prescription PDF generation endpoint.

This is a direct HTML→PDF path (skips DOCX) for lightweight
prescription generation on constrained hardware (RPi 5).
"""

from pydantic import BaseModel, Field


class PrescriptionMedication(BaseModel):
    """A single medication entry in the prescription."""
    name: str = Field(..., description="Drug/medicine name")
    dosage: str = Field("", description="Dosage (e.g. 500mg)")
    frequency: str = Field("", description="Frequency (e.g. TID, BID, PRN)")
    duration: str = Field("", description="Duration (e.g. 7 days)")
    quantity: str = Field("", description="Quantity with unit (e.g. 21 caps)")
    instructions: str = Field("", description="Special instructions (e.g. after meals)")


class PrescriptionRequest(BaseModel):
    """Request body for generating a prescription PDF."""
    patient_name: str = Field(..., description="Full name of the patient")
    patient_age: str = Field("", description="Patient age")
    patient_sex: str = Field("", description="Patient sex (Male/Female)")
    date: str = Field("", description="Prescription date")
    medications: list[PrescriptionMedication] = Field(..., min_length=1)
    notes: str = Field("", description="Additional prescriber notes")
    doctor_name: str = Field("", description="Prescribing physician name")
    license_no: str = Field("", description="PRC license number")
    ptr_no: str = Field("", description="PTR number")
    filename: str = Field("prescription", description="Output filename (without extension)")
