CREATE INDEX ON "patientUpdateLog"("patientId", created_at DESC);
CREATE INDEX ON "UsersPersonal"(branch);
CREATE INDEX ON "patientUpdateLog"(status);

CREATE INDEX idx_schedule_date 
ON "ScheduleDateEntity" ("slotId","scheduledDate");

ALTER TABLE "ScheduleDateEntity"
ADD CONSTRAINT schedule_unique_slot_date
UNIQUE ("slotId", "scheduledDate");

CREATE INDEX idx_patientSlot_scheduler_date 
ON "patientSlot" ("slotSchedulerId","scheduledDate");

ALTER TABLE "DomainTypeCatalog"
ADD CONSTRAINT uniq_domain_name UNIQUE (domain, name);

CREATE UNIQUE INDEX uniq_domain_name_lower
ON "DomainTypeCatalog"(domain, LOWER(name));

CREATE UNIQUE INDEX uniq_allergen_type
ON "AllergenCatalog"(allergen, type);

ALTER TABLE "oralApplianceCatalog"
ADD CONSTRAINT uniq_oral_appliance_name UNIQUE (name);
