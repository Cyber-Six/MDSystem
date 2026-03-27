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


INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
-- Infectious Diseases
('Hospitalization', 'COVID19', 'COVID-19', 'History of COVID-19 infection', true, 1),
('Hospitalization', 'AMOEBIASIS', 'Amoebiasis', 'History of amoebic infection', true, 1),
('Hospitalization', 'DENGUE', 'Dengue Fever', 'Hospitalization due to dengue infection', true, 1),
('Hospitalization', 'TYPHOID', 'Typhoid Fever', 'Hospitalization due to typhoid infection', true, 1),
('Hospitalization', 'PNEUMONIA', 'Pneumonia', 'Hospitalization due to pneumonia', true, 1),
('Hospitalization', 'TB', 'Tuberculosis', 'Pulmonary infection', true, 1),
('Hospitalization', 'HEPATITIS', 'Hepatitis', 'Hospitalization due to viral hepatitis', true, 1),
('Hospitalization', 'MALARIA', 'Malaria', 'Parasitic infection', true, 1),
-- Chronic / Systemic Conditions
('Hospitalization', 'ASTHMA', 'Bronchial Asthma', 'Chronic respiratory condition', true, 1),
('Hospitalization', 'DIABETES', 'Diabetes', 'Chronic metabolic disorder', true, 1),
('Hospitalization', 'HYPERTENSION', 'Hypertension', 'High blood pressure', true, 1),
('Hospitalization', 'THYROID', 'Thyroid Problems', 'Endocrine disorder', true, 1),
('Hospitalization', 'HEART', 'Heart Disease', 'Cardiac condition', true, 1),
('Hospitalization', 'EPILEPSY', 'Epilepsy, Convulsion', 'Neurological disorder', true, 1),
('Hospitalization', 'G6PD', 'G6PD Deficiency', 'Genetic enzyme deficiency', true, 1),
-- Surgical / Emergency
('Hospitalization', 'APPENDICITIS', 'Appendicitis', 'Hospitalization for appendectomy', true, 1),
('Hospitalization', 'SURGERY', 'Minor Surgery', 'Hospitalization for minor surgical procedures', true, 1),
('Hospitalization', 'FRACTURE', 'Bone Fracture', 'Hospitalization due to fracture management', true, 1),
-- Accidents / Trauma
('Hospitalization', 'ACCIDENT', 'Accident/Injury', 'Hospitalization due to vehicular or physical accident', true, 1),
('Hospitalization', 'HANDICAP', 'Congenital Deformities', 'Congenital physical deformities', true, 1),
-- Mental Health / Other
('Hospitalization', 'PSYCH', 'Psychiatric Illness', 'Mental health condition', true, 1),
('Hospitalization', 'SYNCOPE', 'Syncope (Fainting)', 'History of fainting episodes', true, 1),
('Hospitalization', 'UTI', 'Urinary Tract Infection', 'Hospitalization due to severe UTI', true, 1);


INSERT INTO "AllergenCatalog" (type, allergen, "isValid", created_by)
VALUES
-- Food Allergies
('Food', 'Seafood', true, 1),
('Food', 'Peanuts', true, 1),
('Food', 'Tree Nuts', true, 1),
('Food', 'Eggs', true, 1),
('Food', 'Milk/Dairy', true, 1),
-- Drug Allergies
('Drug', 'Antibiotics (Penicillin)', true, 1),
('Drug', 'Sulfa Drugs', true, 1),
('Drug', 'NSAIDs (Aspirin, Ibuprofen)', true, 1),
-- Environmental Allergies
('Environmental', 'Dust Mites', true, 1),
('Environmental', 'Mold', true, 1),
('Environmental', 'Pollen', true, 1),
('Environmental', 'Animal Fur/Dander', true, 1),
-- Insect Allergies
('Insect', 'Mosquito Bites', true, 1),
('Insect', 'Bee Stings', true, 1),
('Insect', 'Ant Bites', true, 1),
-- Chemical Allergies
('Chemical', 'Latex', true, 1),
('Chemical', 'Nickel/Metal', true, 1),
('Chemical', 'Cleaning Agents', true, 1),
('Chemical', 'Fabric Conditioner', true, 1),
-- Other / Irritant-type
('Other', 'Smoke', true, 1),
('Other', 'Perfume/Cologne', true, 1),
('Other', 'Soaps/Lotions', true, 1);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
-- Medical Conditions
('MedicalCondition', 'HEART', 'Heart Condition', 'History of heart-related conditions', true, 1),
('MedicalCondition', 'HBP', 'High Blood Pressure', 'History of hypertension', true, 1),
('MedicalCondition', 'EPILEPSY', 'Epilepsy/Seizure', 'History of epilepsy or seizure disorder', true, 1),
('MedicalCondition', 'PSYCH', 'Psychiatric Illness', 'History of psychiatric condition', true, 1),
('MedicalCondition', 'ASTHMA', 'Bronchial Asthma', 'Chronic respiratory condition', true, 1),
('MedicalCondition', 'DIABETES_I', 'Diabetes Type I', 'Insulin-dependent diabetes mellitus', true, 1),
('MedicalCondition', 'DIABETES_II', 'Diabetes Type II', 'Non-insulin-dependent diabetes mellitus', true, 1),
('MedicalCondition', 'HEPA', 'Hepatitis A', 'History of Hepatitis A infection', true, 1),
('MedicalCondition', 'HEPB', 'Hepatitis B', 'History of Hepatitis B infection', true, 1),
('MedicalCondition', 'HEPC', 'Hepatitis C', 'History of Hepatitis C infection', true, 1),
('MedicalCondition', 'HEPD', 'Hepatitis D', 'History of Hepatitis D infection', true, 1),
('MedicalCondition', 'HEPE', 'Hepatitis E', 'History of Hepatitis E infection', true, 1),
('MedicalCondition', 'AMOEBIASIS', 'Amoebiasis', 'History of amoebic infection', true, 1),
('MedicalCondition', 'TB', 'Tuberculosis', 'History of pulmonary tuberculosis', true, 1),
('MedicalCondition', 'TYPHOID', 'Typhoid Fever', 'History of typhoid infection', true, 1);


INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('VisualAcuity', 'CONTACTS', 'With Contact Lenses', 'Visual acuity measured while wearing contact lenses', true, 1),
('VisualAcuity', 'GLASSES', 'With Eye Glasses', 'Visual acuity measured while wearing eyeglasses', true, 1),
('VisualAcuity', 'UNAIDED', 'Without Correction', 'Visual acuity measured without corrective lenses', true, 1),
('VisualAcuity', 'PINHOLE', 'With Pinhole', 'Visual acuity measured using pinhole occluder', true, 1),
('VisualAcuity', 'OTHER', 'Other', 'Other visual acuity measurement method (please specify)', true, 1);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('Immunization', 'TETANUS', 'Anti-Tetanus', 'Recent tetanus vaccination', true, 1),
('Immunization', 'RABIES', 'Anti-Rabies Vaccine', 'Recent rabies vaccination', true, 1),
('Immunization', 'VARICELLA', 'Chicken Pox', 'Varicella vaccination', true, 1),
-- COVID Vaccines (explicit doses and boosters)
('Immunization', 'COVID_DOSE1', 'COVID Vaccine (1st Dose)', 'First dose of COVID-19 vaccine', true, 1),
('Immunization', 'COVID_DOSE2', 'COVID Vaccine (2nd Dose)', 'Second dose of COVID-19 vaccine', true, 1),
('Immunization', 'COVID_BOOSTER1', 'COVID Vaccine Booster (1st)', 'First booster dose of COVID-19 vaccine', true, 1),
('Immunization', 'COVID_BOOSTER2', 'COVID Vaccine Booster (2nd)', 'Second booster dose of COVID-19 vaccine', true, 1),
('Immunization', 'COVID_BOOSTER3', 'COVID Vaccine Booster (3rd)', 'Third booster dose of COVID-19 vaccine', true, 1),
-- Other Common Vaccines in PH
('Immunization', 'FLU', 'Flu Vaccine', 'Influenza vaccination', true, 1),
('Immunization', 'HEPA', 'Hepatitis A', 'Hepatitis A vaccination', true, 1),
('Immunization', 'HEPB', 'Hepatitis B', 'Hepatitis B vaccination', true, 1),
('Immunization', 'HPV', 'HPV Vaccine', 'Human papillomavirus vaccination', true, 1),
('Immunization', 'MMR', 'MMR (Measles, Mumps, Rubella)', 'MMR vaccination', true, 1),
('Immunization', 'PNEUMO', 'Pneumonia Vaccine', 'Pneumococcal vaccination', true, 1),
('Immunization', 'POLIO', 'Polio Vaccine', 'Poliomyelitis vaccination', true, 1),
('Immunization', 'DPT', 'DPT (Diphtheria, Pertussis, Tetanus)', 'DPT vaccination', true, 1),
('Immunization', 'BCG', 'BCG (Tuberculosis)', 'Bacillus Calmette–Guérin vaccination', true, 1);


INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
('Operation', 'APPENDECTOMY', 'Appendectomy', 'Surgical removal of the appendix', true, 1),
('Operation', 'TONSILLECTOMY', 'Tonsillectomy', 'Surgical removal of tonsils', true, 1),
('Operation', 'CHOLECYSTECTOMY', 'Cholecystectomy', 'Surgical removal of the gallbladder', true, 1),
('Operation', 'CESAREAN', 'Cesarean Section', 'Surgical delivery of a baby', true, 1),
('Operation', 'HERNIA', 'Hernia Repair', 'Surgical correction of hernia', true, 1),
('Operation', 'FRACTURE_FIX', 'Fracture Fixation', 'Surgical management of bone fracture', true, 1),
('Operation', 'ORIF', 'Open Reduction Internal Fixation', 'Bone fracture repair with plates/screws', true, 1),
('Operation', 'BIOPSY', 'Biopsy', 'Surgical removal of tissue sample for diagnosis', true, 1),
('Operation', 'CYST_REMOVAL', 'Cyst Removal', 'Excision of cysts', true, 1),
('Operation', 'LAPAROTOMY', 'Exploratory Laparotomy', 'Abdominal exploratory surgery', true, 1),
('Operation', 'DENTAL_SURGERY', 'Dental Surgery', 'Surgical extraction or correction of teeth', true, 1),
('Operation', 'EYE_SURGERY', 'Eye Surgery', 'Surgical correction of eye conditions', true, 1),
('Operation', 'EAR_SURGERY', 'Ear Surgery', 'Surgical correction of ear conditions', true, 1),
('Operation', 'SKIN_GRAFT', 'Skin Graft', 'Surgical procedure for skin repair', true, 1),
('Operation', 'MINOR_SURGERY', 'Minor Surgery', 'Small surgical procedures (e.g., excision of lumps)', true, 1);

INSERT INTO "DomainTypeCatalog" (domain, code, name, description, "isValid", created_by)
VALUES
-- Antibiotics
('Medication', 'AMOXICILLIN', 'Amoxicillin', 'Common antibiotic for bacterial infections', true, 1),
('Medication', 'AZITHROMYCIN', 'Azithromycin', 'Antibiotic often used for respiratory infections', true, 1),
('Medication', 'CIPROFLOXACIN', 'Ciprofloxacin', 'Antibiotic for urinary tract and gastrointestinal infections', true, 1),
-- Pain / Fever
('Medication', 'PARACETAMOL', 'Paracetamol', 'Analgesic and antipyretic for pain and fever', true, 1),
('Medication', 'IBUPROFEN', 'Ibuprofen', 'NSAID for pain, inflammation, and fever', true, 1),
('Medication', 'NAPROXEN', 'Naproxen', 'NSAID for musculoskeletal pain', true, 1),
-- Respiratory / Asthma
('Medication', 'SALBUTAMOL', 'Salbutamol', 'Bronchodilator for asthma attacks', true, 1),
('Medication', 'MONTELUKAST', 'Montelukast', 'Anti-asthma maintenance medication', true, 1),
('Medication', 'BUDESONIDE', 'Budesonide Inhaler', 'Steroid inhaler for asthma control', true, 1),
-- Gastrointestinal
('Medication', 'OMEPRAZOLE', 'Omeprazole', 'Proton pump inhibitor for acid reflux', true, 1),
('Medication', 'LOPERAMIDE', 'Loperamide', 'Antidiarrheal medication', true, 1),
-- Chronic Conditions
('Medication', 'METFORMIN', 'Metformin', 'Oral hypoglycemic for diabetes', true, 1),
('Medication', 'LOSARTAN', 'Losartan', 'Antihypertensive medication', true, 1),
-- Mental Health
('Medication', 'SERTRALINE', 'Sertraline', 'Antidepressant (SSRI)', true, 1),
('Medication', 'DIAZEPAM', 'Diazepam', 'Anxiolytic and muscle relaxant', true, 1);

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
('DentalProcedure', 'CLEANING', 'Dental Cleaning (Prophylaxis)', 'Routine cleaning and scaling', true, 1),
('DentalProcedure', 'FILLING', 'Dental Filling', 'Restoration of decayed tooth', true, 1),
('DentalProcedure', 'EXTRACTION', 'Tooth Extraction', 'Removal of tooth due to decay or damage', true, 1),
('DentalProcedure', 'ROOTCANAL', 'Root Canal Treatment', 'Endodontic procedure to save infected tooth', true, 1),
('DentalProcedure', 'BRACES', 'Dental Braces', 'Orthodontic appliance for teeth alignment', true, 1),
('DentalProcedure', 'RETAINER', 'Retainers', 'Appliance to maintain teeth position after braces', true, 1),
('DentalProcedure', 'BRIDGE', 'Dental Bridge', 'Fixed restoration replacing missing teeth', true, 1),
('DentalProcedure', 'CROWN', 'Jacket Crown', 'Full coverage crown for damaged tooth', true, 1),
('DentalProcedure', 'DENTURE', 'Dentures', 'Removable replacement for missing teeth', true, 1),
('DentalProcedure', 'IMPLANT', 'Dental Implant', 'Surgical placement of artificial tooth root', true, 1),
('DentalProcedure', 'SCALING', 'Deep Scaling', 'Treatment for gum disease', true, 1),
('DentalProcedure', 'WHITENING', 'Teeth Whitening', 'Cosmetic procedure to lighten teeth color', true, 1),
('DentalProcedure', 'BITEPLANE', 'Bite Plane', 'Appliance to correct bite or relieve TMJ stress', true, 1),
('DentalProcedure', 'EXPANDER', 'Palatal Expander', 'Orthodontic device to widen upper jaw', true, 1),
('DentalProcedure', 'NIGHTGUARD', 'Night Guard', 'Protective appliance worn during sleep to prevent grinding', true, 1);


INSERT INTO "slotScheduler" (label, location, "scheduleFlags", "morningAllowed", "afternoonAllowed", notes, "isActive", "containsCustomDates", "whitelistOnly")
VALUES
('Medical Consultation', 'Arlegui', 63, 20, 15, 'Weekly medical consultation, Mon-Sat', true, false, false),
('Medical Consultation', 'Casal', 63, 25, 20, 'Weekly medical consultation, Mon-Sat', true, false, false),
('Medical Consultation', 'QuezonCity', 63, 30, 25, 'Weekly medical consultation, Mon-Sat', true, false, false),
('Dental Consultation', 'Arlegui', 63, 15, 10, 'Weekly dental consultation, Mon-Sat', true, false, false),
('Dental Consultation', 'Casal', 63, 20, 15, 'Weekly dental consultation, Mon-Sat', true, false, false),
('Dental Consultation', 'QuezonCity', 63, 25, 20, 'Weekly dental consultation, Mon-Sat', true, false, false);

INSERT INTO "Announcement" (title, content, pubmat, "isActive")
VALUES
('System Maintenance Notice', 'The system will be down for maintenance on Saturday, 10:00 PM - 12:00 AM.', 'd6067d73-64e3-4b1a-a593-5a80b70c9120', true),
('New Feature Release: Patient Portal', 'We are excited to announce the launch of our new patient portal, allowing you to easily access your medical records and appointments online.', 'a1f5c8e2-3b9d-4c2e-9f8a-7b6d5c4e3f21', true),
('COVID-19 Vaccination Drive', 'Join us for our upcoming COVID-19 vaccination drive on Friday, 9:00 AM - 4:00 PM at all branches. Walk-ins welcome!', 'c3e8f9a1-2d4b-4e5f-8a7c-6b5d4e3f2a10', true);

INSERT INTO "rolesTable" (label, data)
VALUES
('IS_STAFF', 'Marks user as an active staff member'),
('PRIVILEGED_TO_PERFORM_ON_SUPERIOR', 'Allows actions on superior accounts'),

('ALLOW_TO_APPROVE_EMR', 'Permission to approve electronic medical records'),
('ALLOW_TO_EDIT_EMR', 'Permission to edit electronic medical records'),
('ALLOW_TO_VIEW_EMR', 'Permission to view electronic medical records'),
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
('ALLOW_TO_MANAGE_MEDICINE_REQUESTS', 'Permission to manage medicine requests'),
('ALLOW_TO_PRESCRIBE', 'Permission to prescribe medicines');
