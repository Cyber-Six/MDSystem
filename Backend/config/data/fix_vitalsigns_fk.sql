-- Fix VitalSigns foreign key constraints
-- The constraints are currently pointing in the wrong direction

-- Drop the incorrect foreign keys
ALTER TABLE "VitalSigns" DROP CONSTRAINT IF EXISTS "VitalSigns_id_fkey";
ALTER TABLE "VitalSigns" DROP CONSTRAINT IF EXISTS "VitalSigns_id_fkey1";

-- Add the correct foreign keys pointing FROM patientUpdateLog and Consultation TO VitalSigns
ALTER TABLE "patientUpdateLog"
  ADD CONSTRAINT fk_patientUpdateLog_vitalSignsId
  FOREIGN KEY ("vitalSignsId") REFERENCES "VitalSigns" ("id")
  DEFERRABLE INITIALLY IMMEDIATE
  ON DELETE SET NULL;

ALTER TABLE "Consultation"
  ADD CONSTRAINT fk_Consultation_vitalSignsId
  FOREIGN KEY ("vitalSignsId") REFERENCES "VitalSigns" ("id")
  DEFERRABLE INITIALLY IMMEDIATE
  ON DELETE SET NULL;
