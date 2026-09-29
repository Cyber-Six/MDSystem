
-- Set triggers for updated_at columns to auto-update on modification
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_UserCredentials
BEFORE UPDATE ON "UserCredentials"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_patientRawDocument
BEFORE UPDATE ON "patientRawDocument"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_MedicineRequestLog
BEFORE UPDATE ON "MedicineRequestLog"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_patientUpdateLog
BEFORE UPDATE ON "patientUpdateLog"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_patientSlot
BEFORE UPDATE ON "patientSlot"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- Medicine request rejection reason column (added post-initial build)
ALTER TABLE "MedicineRequestLog" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

-- Role management: insert new permission labels (idempotent)
CREATE INDEX ON "patientUpdateLog"("patientId", created_at DESC);
CREATE INDEX ON "UsersPersonal"(branch);
CREATE INDEX ON "patientUpdateLog"(status);

CREATE INDEX idx_schedule_date 
ON "ScheduleDateEntity" ("slotId","scheduledDate");

CREATE INDEX idx_usercredentials_status
  ON "UserCredentials"(credentials_status);

CREATE INDEX idx_medicalpersonnel_designation
  ON "MedicalPersonnel"(designation);

CREATE INDEX idx_medicalpersonnel_is_active
  ON "MedicalPersonnel"(is_active);

CREATE INDEX IF NOT EXISTS idx_medicine_batch_updated_at ON "MedicineBatch"("updated_at" DESC);
CREATE INDEX IF NOT EXISTS idx_supply_batch_updated_at ON "SupplyBatch"("updated_at" DESC);


ALTER TABLE "ScheduleDateEntity"
ADD CONSTRAINT schedule_unique_slot_date
UNIQUE ("slotId", "scheduledDate");

ALTER TABLE "DomainTypeCatalog"
ADD CONSTRAINT uniq_domain_name UNIQUE (domain, name);

CREATE UNIQUE INDEX uniq_domain_name_lower
ON "DomainTypeCatalog"(domain, LOWER(name));

CREATE UNIQUE INDEX uniq_allergen_type
ON "AllergenCatalog"(allergen, type);

ALTER TABLE "oralApplianceCatalog"
ADD CONSTRAINT uniq_oral_appliance_name UNIQUE (name);

ALTER TABLE "slotScheduler"
ADD CONSTRAINT slot_label_location_unique
UNIQUE (label, location);

ALTER TABLE "SlotCustomDate"
ADD CONSTRAINT "SlotCustomDate_slotScheduleId_scheduledDate_key"
UNIQUE ("slotScheduleId", "scheduledDate");

-- SlotCustomType enum + SlotCustomDate schema alignment
-- Step 1: Create the enum type if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SlotCustomType'
  ) THEN
    CREATE TYPE "SlotCustomType" AS ENUM ('Include', 'Exclude');
  END IF;
END$$;

-- Step 2: Add created_at column if missing (straightforward, no type conversion needed)
-- Step 3: Handle the "type" column â€” four cases covered:
--   a) column does not exist            â†’ add it as the enum type directly
--   b) column exists as TEXT/VARCHAR    â†’ convert it to the enum type
--   c) column exists as a wrong enum    â†’ migrate via temp column (avoids cast error)
--   d) column already is SlotCustomType â†’ nothing to do
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'SlotCustomDate' AND column_name = 'type';

  IF col_type IS NULL THEN
    -- Case (a): column missing â€” add as enum
    ALTER TABLE "SlotCustomDate"
      ADD COLUMN "type" "SlotCustomType" NOT NULL DEFAULT 'Include'::"SlotCustomType";

  ELSIF col_type IN ('text', 'character varying') THEN
    -- Case (b): column is text/varchar â€” cast existing values and change type
    ALTER TABLE "SlotCustomDate"
      ALTER COLUMN "type" TYPE "SlotCustomType"
        USING "type"::"SlotCustomType",
      ALTER COLUMN "type" SET NOT NULL,
      ALTER COLUMN "type" SET DEFAULT 'Include'::"SlotCustomType";

  ELSIF col_type = 'USER-DEFINED' THEN
    -- Case (c): column is an old/wrong enum type â€” migrate via temp column
    -- (Direct enum-to-enum cast fails; dropping CASCADE removes the column too,
    --  so we copy data out, drop the column, then recreate with the correct type.)
    ALTER TABLE "SlotCustomDate" ADD COLUMN "type_temp" TEXT;
    UPDATE "SlotCustomDate" SET "type_temp" = "type"::TEXT;
    ALTER TABLE "SlotCustomDate" DROP COLUMN "type";
    BEGIN
      DROP TYPE slotcustomtype;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- old enum already gone, continue
    END;
    ALTER TABLE "SlotCustomDate"
      ADD COLUMN "type" "SlotCustomType" NOT NULL DEFAULT 'Include'::"SlotCustomType";
    UPDATE "SlotCustomDate"
      SET "type" = "type_temp"::"SlotCustomType"
      WHERE "type_temp" IS NOT NULL;
    ALTER TABLE "SlotCustomDate" DROP COLUMN "type_temp";

  -- Case (d): already correct enum â€” skip
  END IF;
END$$;

-- Normalized generated-document setup for Prescription
INSERT INTO "documentTemplate" (template, description, "revisedDate", "createdBy")
SELECT 'Prescription', 'Prescription document template', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), mp.id
FROM (SELECT id FROM "MedicalPersonnel" ORDER BY id LIMIT 1) AS mp
WHERE NOT EXISTS (
  SELECT 1 FROM "documentTemplate" WHERE LOWER(template) = LOWER('Prescription')
);

INSERT INTO "documentRequirementsTag" (vartag)
SELECT seed.tag_name
FROM (
  VALUES
    ('complaints'),
    ('diagnosis'),
    ('medications'),
    ('instructions'),
    ('follow_up'),
    ('doctor_signature'),
    ('ptr_number'),
    ('license_number')
) AS seed(tag_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM "documentRequirementsTag" drt
  WHERE LOWER(drt.vartag) = LOWER(seed.tag_name)
);

INSERT INTO "documentRequirements" ("templateId", "requirementtagId")
SELECT dt.id, drt.id
FROM "documentTemplate" dt
JOIN "documentRequirementsTag" drt
  ON LOWER(drt.vartag) IN (
    'complaints',
    'diagnosis',
    'medications',
    'instructions',
    'follow_up',
    'doctor_signature',
    'ptr_number',
    'license_number'
  )
WHERE LOWER(dt.template) = LOWER('Prescription')
  AND NOT EXISTS (
    SELECT 1
    FROM "documentRequirements" dr
    WHERE dr."templateId" = dt.id
      AND dr."requirementtagId" = drt.id
  );

  -- Normalized generated-document setup for Medical Certificate
  INSERT INTO "documentTemplate" (template, description, "revisedDate", "createdBy")
  SELECT 'medical-certificate', 'Medical certificate document template', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), mp.id
  FROM (SELECT id FROM "MedicalPersonnel" ORDER BY id LIMIT 1) AS mp
  WHERE NOT EXISTS (
    SELECT 1
    FROM "documentTemplate"
    WHERE REPLACE(LOWER(template), ' ', '-') = LOWER('medical-certificate')
  );

  INSERT INTO "documentRequirementsTag" (vartag)
  SELECT seed.tag_name
  FROM (
    VALUES
      ('purpose'),
      ('diagnosis'),
      ('recommendations'),
      ('valid_from'),
      ('valid_until'),
      ('restrictions'),
      ('remarks'),
      ('doctor_signature'),
      ('ptr_number'),
      ('license_number')
  ) AS seed(tag_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM "documentRequirementsTag" drt
    WHERE LOWER(drt.vartag) = LOWER(seed.tag_name)
  );

  INSERT INTO "documentRequirements" ("templateId", "requirementtagId")
  SELECT dt.id, drt.id
  FROM "documentTemplate" dt
  JOIN "documentRequirementsTag" drt
    ON LOWER(drt.vartag) IN (
      'purpose',
      'diagnosis',
      'recommendations',
      'valid_from',
      'valid_until',
      'restrictions',
      'remarks',
      'doctor_signature',
      'ptr_number',
      'license_number'
    )
  WHERE REPLACE(LOWER(dt.template), ' ', '-') = LOWER('medical-certificate')
    AND NOT EXISTS (
      SELECT 1
      FROM "documentRequirements" dr
      WHERE dr."templateId" = dt.id
        AND dr."requirementtagId" = drt.id
    );

-- Prevent duplicate template-tag mappings before enforcing uniqueness.
DELETE FROM "documentRequirements" current_row
USING "documentRequirements" older_row
WHERE current_row.id > older_row.id
  AND current_row."templateId" = older_row."templateId"
  AND current_row."requirementtagId" = older_row."requirementtagId";

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_requirements_template_tag_unique
ON "documentRequirements" ("templateId", "requirementtagId");

-- Enforce non-null requirement references for all newly inserted rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "documentData"
    WHERE "requirementId" IS NULL
    LIMIT 1
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ck_documentdata_requirementid_not_null'
        AND conrelid = '"documentData"'::regclass
    ) THEN
      ALTER TABLE "documentData"
        ADD CONSTRAINT ck_documentdata_requirementid_not_null
        CHECK ("requirementId" IS NOT NULL) NOT VALID;
    END IF;
  ELSE
    ALTER TABLE "documentData"
      ALTER COLUMN "requirementId" SET NOT NULL;
  END IF;
END$$;

-- Ensure the normalized document tables are connected by foreign keys.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = '"documentRequirements"'::regclass
      AND c.confrelid = '"documentTemplate"'::regclass
      AND a.attname = 'templateId'
  ) THEN
    ALTER TABLE "documentRequirements"
      ADD CONSTRAINT fk_documentrequirements_template
      FOREIGN KEY ("templateId") REFERENCES "documentTemplate" (id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = '"documentRequirements"'::regclass
      AND c.confrelid = '"documentRequirementsTag"'::regclass
      AND a.attname = 'requirementtagId'
  ) THEN
    ALTER TABLE "documentRequirements"
      ADD CONSTRAINT fk_documentrequirements_requirementtag
      FOREIGN KEY ("requirementtagId") REFERENCES "documentRequirementsTag" (id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = '"PatientDocuments"'::regclass
      AND c.confrelid = '"documentTemplate"'::regclass
      AND a.attname = 'templateId'
  ) THEN
    ALTER TABLE "PatientDocuments"
      ADD CONSTRAINT fk_patientdocuments_template
      FOREIGN KEY ("templateId") REFERENCES "documentTemplate" (id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = '"documentData"'::regclass
      AND c.confrelid = '"PatientDocuments"'::regclass
      AND a.attname = 'documentId'
  ) THEN
    ALTER TABLE "documentData"
      ADD CONSTRAINT fk_documentdata_document
      FOREIGN KEY ("documentId") REFERENCES "PatientDocuments" (id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = '"documentData"'::regclass
      AND c.confrelid = '"documentRequirements"'::regclass
      AND a.attname = 'requirementId'
  ) THEN
    ALTER TABLE "documentData"
      ADD CONSTRAINT fk_documentdata_requirement
      FOREIGN KEY ("requirementId") REFERENCES "documentRequirements" (id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END$$;


INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
-- Infectious Diseases
('Hospitalization', 'COVID19', 'COVID-19', 'History of COVID-19 infection', true, NULL),
('Hospitalization', 'AMOEBIASIS', 'Amoebiasis', 'History of amoebic infection', true, NULL),
('Hospitalization', 'DENGUE', 'Dengue Fever', 'Hospitalization due to dengue infection', true, NULL),
('Hospitalization', 'TYPHOID', 'Typhoid Fever', 'Hospitalization due to typhoid infection', true, NULL),
('Hospitalization', 'PNEUMONIA', 'Pneumonia', 'Hospitalization due to pneumonia', true, NULL),
('Hospitalization', 'TB', 'Tuberculosis', 'Pulmonary infection', true, NULL),
('Hospitalization', 'HEPATITIS', 'Hepatitis', 'Hospitalization due to viral hepatitis', true, NULL),
('Hospitalization', 'MALARIA', 'Malaria', 'Parasitic infection', true, NULL),
-- Chronic / Systemic Conditions
('Hospitalization', 'ASTHMA', 'Bronchial Asthma', 'Chronic respiratory condition', true, NULL),
('Hospitalization', 'DIABETES', 'Diabetes', 'Chronic metabolic disorder', true, NULL),
('Hospitalization', 'HYPERTENSION', 'Hypertension', 'High blood pressure', true, NULL),
('Hospitalization', 'THYROID', 'Thyroid Problems', 'Endocrine disorder', true, NULL),
('Hospitalization', 'HEART', 'Heart Disease', 'Cardiac condition', true, NULL),
('Hospitalization', 'EPILEPSY', 'Epilepsy, Convulsion', 'Neurological disorder', true, NULL),
('Hospitalization', 'G6PD', 'G6PD Deficiency', 'Genetic enzyme deficiency', true, NULL),
-- Surgical / Emergency
('Hospitalization', 'APPENDICITIS', 'Appendicitis', 'Hospitalization for appendectomy', true, NULL),
('Hospitalization', 'SURGERY', 'Minor Surgery', 'Hospitalization for minor surgical procedures', true, NULL),
('Hospitalization', 'FRACTURE', 'Bone Fracture', 'Hospitalization due to fracture management', true, NULL),
-- Accidents / Trauma
('Hospitalization', 'ACCIDENT', 'Accident/Injury', 'Hospitalization due to vehicular or physical accident', true, NULL),
('Hospitalization', 'HANDICAP', 'Congenital Deformities', 'Congenital physical deformities', true, NULL),
-- Mental Health / Other
('Hospitalization', 'PSYCH', 'Psychiatric Illness', 'Mental health condition', true, NULL),
('Hospitalization', 'SYNCOPE', 'Syncope (Fainting)', 'History of fainting episodes', true, NULL),
('Hospitalization', 'UTI', 'Urinary Tract Infection', 'Hospitalization due to severe UTI', true, NULL);


INSERT INTO "AllergenCatalog" (type, allergen, "isValid", created_by)
VALUES
-- Food Allergies
('Food', 'Seafood', true, NULL),
('Food', 'Peanuts', true, NULL),
('Food', 'Tree Nuts', true, NULL),
('Food', 'Eggs', true, NULL),
('Food', 'Milk/Dairy', true, NULL),
-- Drug Allergies
('Drug', 'Antibiotics (Penicillin)', true, NULL),
('Drug', 'Sulfa Drugs', true, NULL),
('Drug', 'NSAIDs (Aspirin, Ibuprofen)', true, NULL),
-- Environmental Allergies
('Environmental', 'Dust Mites', true, NULL),
('Environmental', 'Mold', true, NULL),
('Environmental', 'Pollen', true, NULL),
('Environmental', 'Animal Fur/Dander', true, NULL),
-- Insect Allergies
('Insect', 'Mosquito Bites', true, NULL),
('Insect', 'Bee Stings', true, NULL),
('Insect', 'Ant Bites', true, NULL),
-- Chemical Allergies
('Chemical', 'Latex', true, NULL),
('Chemical', 'Nickel/Metal', true, NULL),
('Chemical', 'Cleaning Agents', true, NULL),
('Chemical', 'Fabric Conditioner', true, NULL),
-- Other / Irritant-type
('Other', 'Smoke', true, NULL),
('Other', 'Perfume/Cologne', true, NULL),
('Other', 'Soaps/Lotions', true, NULL);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
-- Medical Conditions
('MedicalCondition', 'HEART', 'Heart Condition', 'History of heart-related conditions', true, NULL),
('MedicalCondition', 'HBP', 'High Blood Pressure', 'History of hypertension', true, NULL),
('MedicalCondition', 'EPILEPSY', 'Epilepsy/Seizure', 'History of epilepsy or seizure disorder', true, NULL),
('MedicalCondition', 'PSYCH', 'Psychiatric Illness', 'History of psychiatric condition', true, NULL),
('MedicalCondition', 'ASTHMA', 'Bronchial Asthma', 'Chronic respiratory condition', true, NULL),
('MedicalCondition', 'DIABETES_I', 'Diabetes Type I', 'Insulin-dependent diabetes mellitus', true, NULL),
('MedicalCondition', 'DIABETES_II', 'Diabetes Type II', 'Non-insulin-dependent diabetes mellitus', true, NULL),
('MedicalCondition', 'HEPA', 'Hepatitis A', 'History of Hepatitis A infection', true, NULL),
('MedicalCondition', 'HEPB', 'Hepatitis B', 'History of Hepatitis B infection', true, NULL),
('MedicalCondition', 'HEPC', 'Hepatitis C', 'History of Hepatitis C infection', true, NULL),
('MedicalCondition', 'HEPD', 'Hepatitis D', 'History of Hepatitis D infection', true, NULL),
('MedicalCondition', 'HEPE', 'Hepatitis E', 'History of Hepatitis E infection', true, NULL),
('MedicalCondition', 'AMOEBIASIS', 'Amoebiasis', 'History of amoebic infection', true, NULL),
('MedicalCondition', 'TB', 'Tuberculosis', 'History of pulmonary tuberculosis', true, NULL),
('MedicalCondition', 'TYPHOID', 'Typhoid Fever', 'History of typhoid infection', true, NULL);


INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('VisualAcuity', 'CONTACTS', 'With Contact Lenses', 'Visual acuity measured while wearing contact lenses', true, NULL),
('VisualAcuity', 'GLASSES', 'With Eye Glasses', 'Visual acuity measured while wearing eyeglasses', true, NULL),
('VisualAcuity', 'UNAIDED', 'Without Correction', 'Visual acuity measured without corrective lenses', true, NULL),
('VisualAcuity', 'PINHOLE', 'With Pinhole', 'Visual acuity measured using pinhole occluder', true, NULL),
('VisualAcuity', 'OTHER', 'Other', 'Other visual acuity measurement method (please specify)', true, NULL);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('Immunization', 'TETANUS', 'Anti-Tetanus', 'Recent tetanus vaccination', true, NULL),
('Immunization', 'RABIES', 'Anti-Rabies Vaccine', 'Recent rabies vaccination', true, NULL),
('Immunization', 'VARICELLA', 'Chicken Pox', 'Varicella vaccination', true, NULL),
-- COVID Vaccines (explicit doses and boosters)
('Immunization', 'COVID_DOSE1', 'COVID Vaccine (1st Dose)', 'First dose of COVID-19 vaccine', true, NULL),
('Immunization', 'COVID_DOSE2', 'COVID Vaccine (2nd Dose)', 'Second dose of COVID-19 vaccine', true, NULL),
('Immunization', 'COVID_BOOSTER1', 'COVID Vaccine Booster (1st)', 'First booster dose of COVID-19 vaccine', true, NULL),
('Immunization', 'COVID_BOOSTER2', 'COVID Vaccine Booster (2nd)', 'Second booster dose of COVID-19 vaccine', true, NULL),
('Immunization', 'COVID_BOOSTER3', 'COVID Vaccine Booster (3rd)', 'Third booster dose of COVID-19 vaccine', true, NULL),
-- Other Common Vaccines in PH
('Immunization', 'FLU', 'Flu Vaccine', 'Influenza vaccination', true, NULL),
('Immunization', 'HEPA', 'Hepatitis A', 'Hepatitis A vaccination', true, NULL),
('Immunization', 'HEPB', 'Hepatitis B', 'Hepatitis B vaccination', true, NULL),
('Immunization', 'HPV', 'HPV Vaccine', 'Human papillomavirus vaccination', true, NULL),
('Immunization', 'MMR', 'MMR (Measles, Mumps, Rubella)', 'MMR vaccination', true, NULL),
('Immunization', 'PNEUMO', 'Pneumonia Vaccine', 'Pneumococcal vaccination', true, NULL),
('Immunization', 'POLIO', 'Polio Vaccine', 'Poliomyelitis vaccination', true, NULL),
('Immunization', 'DPT', 'DPT (Diphtheria, Pertussis, Tetanus)', 'DPT vaccination', true, NULL),
('Immunization', 'BCG', 'BCG (Tuberculosis)', 'Bacillus Calmetteâ€“GuÃ©rin vaccination', true, NULL);


INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('Operation', 'APPENDECTOMY', 'Appendectomy', 'Surgical removal of the appendix', true, NULL),
('Operation', 'TONSILLECTOMY', 'Tonsillectomy', 'Surgical removal of tonsils', true, NULL),
('Operation', 'CHOLECYSTECTOMY', 'Cholecystectomy', 'Surgical removal of the gallbladder', true, NULL),
('Operation', 'CESAREAN', 'Cesarean Section', 'Surgical delivery of a baby', true, NULL),
('Operation', 'HERNIA', 'Hernia Repair', 'Surgical correction of hernia', true, NULL),
('Operation', 'FRACTURE_FIX', 'Fracture Fixation', 'Surgical management of bone fracture', true, NULL),
('Operation', 'ORIF', 'Open Reduction Internal Fixation', 'Bone fracture repair with plates/screws', true, NULL),
('Operation', 'BIOPSY', 'Biopsy', 'Surgical removal of tissue sample for diagnosis', true, NULL),
('Operation', 'CYST_REMOVAL', 'Cyst Removal', 'Excision of cysts', true, NULL),
('Operation', 'LAPAROTOMY', 'Exploratory Laparotomy', 'Abdominal exploratory surgery', true, NULL),
('Operation', 'DENTAL_SURGERY', 'Dental Surgery', 'Surgical extraction or correction of teeth', true, NULL),
('Operation', 'EYE_SURGERY', 'Eye Surgery', 'Surgical correction of eye conditions', true, NULL),
('Operation', 'EAR_SURGERY', 'Ear Surgery', 'Surgical correction of ear conditions', true, NULL),
('Operation', 'SKIN_GRAFT', 'Skin Graft', 'Surgical procedure for skin repair', true, NULL),
('Operation', 'MINOR_SURGERY', 'Minor Surgery', 'Small surgical procedures (e.g., excision of lumps)', true, NULL);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
-- Antibiotics
('Medication', 'AMOXICILLIN', 'Amoxicillin', 'Common antibiotic for bacterial infections', true, NULL),
('Medication', 'AZITHROMYCIN', 'Azithromycin', 'Antibiotic often used for respiratory infections', true, NULL),
('Medication', 'CIPROFLOXACIN', 'Ciprofloxacin', 'Antibiotic for urinary tract and gastrointestinal infections', true, NULL),
-- Pain / Fever
('Medication', 'PARACETAMOL', 'Paracetamol', 'Analgesic and antipyretic for pain and fever', true, NULL),
('Medication', 'IBUPROFEN', 'Ibuprofen', 'NSAID for pain, inflammation, and fever', true, NULL),
('Medication', 'NAPROXEN', 'Naproxen', 'NSAID for musculoskeletal pain', true, NULL),
-- Respiratory / Asthma
('Medication', 'SALBUTAMOL', 'Salbutamol', 'Bronchodilator for asthma attacks', true, NULL),
('Medication', 'MONTELUKAST', 'Montelukast', 'Anti-asthma maintenance medication', true, NULL),
('Medication', 'BUDESONIDE', 'Budesonide Inhaler', 'Steroid inhaler for asthma control', true, NULL),
-- Gastrointestinal
('Medication', 'OMEPRAZOLE', 'Omeprazole', 'Proton pump inhibitor for acid reflux', true, NULL),
('Medication', 'LOPERAMIDE', 'Loperamide', 'Antidiarrheal medication', true, NULL),
-- Chronic Conditions
('Medication', 'METFORMIN', 'Metformin', 'Oral hypoglycemic for diabetes', true, NULL),
('Medication', 'LOSARTAN', 'Losartan', 'Antihypertensive medication', true, NULL),
-- Mental Health
('Medication', 'SERTRALINE', 'Sertraline', 'Antidepressant (SSRI)', true, NULL),
('Medication', 'DIAZEPAM', 'Diazepam', 'Anxiolytic and muscle relaxant', true, NULL);

INSERT INTO "oralApplianceCatalog" (name, description, archable, "isActive")
VALUES
('Dental Brace', 'Orthodontic appliance used to align teeth', true, true),
('Dental Bridge', 'Fixed dental restoration replacing missing teeth', true, true),
('Jacket Crown', 'Full coverage crown for damaged teeth', true, true),
('Dentures', 'Removable replacement for missing teeth', true, true),
('Bite Plane', 'Appliance to correct bite or relieve TMJ stress', true, true),
('Palatal Expander', 'Orthodontic device to widen upper jaw', true, true),
('Night Guard', 'Protective appliance worn during sleep to prevent grinding', true, true),
('Retainers', 'Appliance to maintain teeth position after braces', true, true),
('Space Maintainer', 'Appliance to preserve space for permanent teeth', true, true),
('Lingual Brace', 'Orthodontic braces placed on the inner side of teeth', true, true),
('Clear Aligners', 'Transparent removable orthodontic appliance (e.g., Invisalign)', true, true),
('Partial Denture', 'Removable appliance replacing some missing teeth', true, true),
('Full Denture', 'Removable appliance replacing all teeth in an arch', true, true),
('Occlusal Splint', 'Appliance to stabilize bite and reduce jaw pain', true, true),
('Sports Mouth Guard', 'Protective appliance worn during sports activities', true, true);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('DentalProcedure', 'CLEANING', 'Dental Cleaning (Prophylaxis)', 'Routine cleaning and scaling', true, NULL),
('DentalProcedure', 'FILLING', 'Dental Filling', 'Restoration of decayed tooth', true, NULL),
('DentalProcedure', 'EXTRACTION', 'Tooth Extraction', 'Removal of tooth due to decay or damage', true, NULL),
('DentalProcedure', 'ROOTCANAL', 'Root Canal Treatment', 'Endodontic procedure to save infected tooth', true, NULL),
('DentalProcedure', 'BRACES', 'Dental Braces', 'Orthodontic appliance for teeth alignment', true, NULL),
('DentalProcedure', 'RETAINER', 'Retainers', 'Appliance to maintain teeth position after braces', true, NULL),
('DentalProcedure', 'BRIDGE', 'Dental Bridge', 'Fixed restoration replacing missing teeth', true, NULL),
('DentalProcedure', 'CROWN', 'Jacket Crown', 'Full coverage crown for damaged tooth', true, NULL),
('DentalProcedure', 'DENTURE', 'Dentures', 'Removable replacement for missing teeth', true, NULL),
('DentalProcedure', 'IMPLANT', 'Dental Implant', 'Surgical placement of artificial tooth root', true, NULL),
('DentalProcedure', 'SCALING', 'Deep Scaling', 'Treatment for gum disease', true, NULL),
('DentalProcedure', 'WHITENING', 'Teeth Whitening', 'Cosmetic procedure to lighten teeth color', true, NULL),
('DentalProcedure', 'BITEPLANE', 'Bite Plane', 'Appliance to correct bite or relieve TMJ stress', true, NULL),
('DentalProcedure', 'EXPANDER', 'Palatal Expander', 'Orthodontic device to widen upper jaw', true, NULL),
('DentalProcedure', 'NIGHTGUARD', 'Night Guard', 'Protective appliance worn during sleep to prevent grinding', true, NULL);


INSERT INTO "slotScheduler" (label, location, "scheduleFlags", "morningAllowed", "afternoonAllowed", notes, "isActive", "containsCustomDates", "whitelistOnly")
VALUES
('Medical Consultation', 'Arlegui', 63, 20, 15, 'Weekly medical consultation, Mon-Sat', true, false, false),
('Medical Consultation', 'Casal', 63, 25, 20, 'Weekly medical consultation, Mon-Sat', true, false, false),
('Medical Consultation', 'QuezonCity', 63, 30, 25, 'Weekly medical consultation, Mon-Sat', true, false, false),
('Dental Consultation', 'Arlegui', 63, 15, 10, 'Weekly dental consultation, Mon-Sat', true, false, false),
('Dental Consultation', 'Casal', 63, 20, 15, 'Weekly dental consultation, Mon-Sat', true, false, false),
('Dental Consultation', 'QuezonCity', 63, 25, 20, 'Weekly dental consultation, Mon-Sat', true, false, false);

INSERT INTO "Announcement" (title, content, "isActive")
VALUES
('System Maintenance Notice', 'The system will be down for maintenance on Saturday, 10:00 PM - 12:00 AM.', true),
('New Feature Release: Patient Portal', 'We are excited to announce the launch of our new patient portal, allowing you to easily access your medical records and appointments online.', true),
('COVID-19 Vaccination Drive', 'Join us for our upcoming COVID-19 vaccination drive on Friday, 9:00 AM - 4:00 PM at all branches. Walk-ins welcome!', true);

INSERT INTO "rolesTable" (label, data)
VALUES
('IS_STAFF', 'Marks user as an active staff member'),
('PRIVILEGED_TO_PERFORM_ON_SUPERIOR', 'Allows actions on superior accounts'),

('ALLOW_TO_APPROVE_EMR', 'Permission to approve electronic medical records'),
('ALLOW_TO_EDIT_EMR', 'Permission to edit electronic medical records'),
('ALLOW_TO_VIEW_EMR', 'Permission to view electronic medical records'),
('ALLOW_TO_SET_VITAL_SIGN', 'Permission to set vital signs'),
('ALLOW_TO_SET_DENTAL_RECORD', 'Permission to set dental records'),
('ALLOW_TO_EDIT_CATALOGS', 'Permission to edit EMR catalogs'),

('ALLOW_TO_APPROVE_PROFILE', 'Permission to approve user profiles'),
('ALLOW_TO_VIEW_PROFILE', 'Permission to view user profiles'),
('ALLOW_TO_EDIT_PROFILE', 'Permission to edit user profiles'),
('ALLOW_TO_UPDATE_EMAIL_IDENTIFIER', 'Permission to update email identifiers'),

('ALLOW_TO_APPROVE_APPOINTMENT', 'Permission to approve appointments'),
('ALLOW_TO_VIEW_APPOINTMENT', 'Permission to view appointment records'),
('ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION', 'Permission to view appointment configuration'),
('ALLOW_TO_EDIT_APPOINTMENT_CONFIGURATION', 'Permission to edit appointment configuration'),

('ALLOW_TO_CRUD_ANNOUNCEMENT', 'Permission to create, read, update, and delete announcements'),

('ALLOW_TO_VIEW_CONSULTATION', 'Permission to view consultations'),
('ALLOW_TO_EDIT_CONSULTATION', 'Permission to edit consultations'),

('ALLOW_TO_VIEW_INVENTORY', 'Permission to view inventory'),
('ALLOW_TO_EDIT_INVENTORY', 'Permission to edit inventory'),
('ALLOW_TO_DISPENSE_MEDICINE', 'Permission to dispense medicine'),
('ALLOW_TO_MANAGE_MEDICINE_REQUESTS', 'Permission to manage medicine requests'),
('ALLOW_TO_PRESCRIBE', 'Permission to prescribe medicines'),
('ALLOW_TO_APPROVE_MEDICINE_REQUEST', 'Permission to approve medicine requests'),
('ALLOW_TO_CONFIGURE_INVENTORY', 'Permission to configure inventory settings and thresholds'),

('ALLOW_TO_ACCESS_HEALTH_CHAT', 'Permission to access health chat features'),

('ALLOW_TO_VIEW_ANALYTICS', 'Permission to view analytics and reports'),
('ALLOW_TO_EXPORT_ANALYTICS', 'Permission to export analytics data'),

('ALLOW_TO_VIEW_DOCUMENTS', 'Permission to view documents'),
('ALLOW_TO_MANAGE_DOCUMENTS', 'Permission to manage (create/edit/delete) documents'),
('ALLOW_TO_GENERATE_DOCUMENTS', 'Permission to generate documents'),

('ALLOW_TO_ACCESS_ROLE_MANAGEMENT', 'Permission to access role management panel'),
('ALLOW_TO_EDIT_ROLE_MANAGEMENT', 'Permission to edit roles and templates')
ON CONFLICT (label) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_preferences_id ON "UsersPreferences"(id);

-- Missing rolesTable entries (idempotent â€” safe to re-run)
-- Uses NOT EXISTS instead of ON CONFLICT because some environments do not
-- enforce a unique constraint on rolesTable.label.
INSERT INTO "rolesTable" (label, data)
SELECT v.label, v.data
FROM (VALUES
  ('ALLOW_TO_SET_VITAL_SIGN',                'Permission to set vital signs'),
  ('ALLOW_TO_CONFIGURE_INVENTORY',           'Permission to configure inventory settings and thresholds'),
  ('ALLOW_TO_SEND_NOTIFICATION_TO_PATIENTS', 'Permission to send push notifications and alerts to patients'),
  ('ALLOW_TO_VIEW_DOCUMENTS',                'Permission to view documents'),
  ('ALLOW_TO_MANAGE_DOCUMENTS',              'Permission to manage (create/edit/delete) documents'),
  ('ALLOW_TO_GENERATE_DOCUMENTS',            'Permission to generate documents')
) AS v(label, data)
WHERE NOT EXISTS (
  SELECT 1
  FROM "rolesTable" r
  WHERE r.label = v.label
);

-- Student programs (added post-initial build)
INSERT INTO student_programs (label)
SELECT seed.label
FROM (VALUES
  ('BS Architecture'),
  ('BS Chemical Engineering'),
  ('BS Civil Engineering'),
  ('BS Computer Engineering'),
  ('BS Electrical Engineering'),
  ('BS Electronics Engineering'),
  ('BS Industrial Engineering'),
  ('BS Mechanical Engineering'),
  ('BS Environmental and Sanitary Engineering'),
  ('BS Computer Science'),
  ('BS Data Science and Analytics'),
  ('BS Entertainment and Multimedia Computing'),
  ('BS Information Technology'),
  ('BS Information Systems'),
  ('BS Accountancy'),
  ('BS Accounting Information Systems'),
  ('BSBA Financial Management'),
  ('BSBA Human Resource Management'),
  ('BSBA Logistics and Supply Chain Management'),
  ('BSBA Marketing Management'),
  ('Bachelor of Arts in English Language'),
  ('Bachelor of Arts in Political Science'),
  ('Bachelor of Secondary Education Major in English'),
  ('Bachelor of Secondary Education Major in Mathematics'),
  ('Bachelor of Secondary Education Major in Sciences'),
  ('Bachelor of Special Needs Education'),
  ('Teaching Certificate Program')
) AS seed(label)
WHERE NOT EXISTS (
  SELECT 1
  FROM student_programs existing
  WHERE LOWER(existing.label) = LOWER(seed.label)
);


CREATE INDEX ON "UsersPersonal"(identifier);

CREATE INDEX ON "UsersPersonal"(identifier);

CREATE INDEX ON "UsersPersonalLog"(user_id, created_at DESC);

CREATE INDEX ON "patientUpdateLog"("patientId", created_at DESC);

ALTER TABLE "rolesMap"
ADD CONSTRAINT rolesmap_unique UNIQUE ("personnelId", "rolesId");
