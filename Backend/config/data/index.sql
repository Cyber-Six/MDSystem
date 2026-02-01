CREATE INDEX ON "patientUpdateLog"("patientId", created_at DESC);
CREATE INDEX ON "UsersPersonal"(branch);
CREATE INDEX ON "patientUpdateLog"(status);

ALTER TABLE "DomainTypeCatalog"
ADD CONSTRAINT uniq_domain_name UNIQUE (domain, name);

CREATE UNIQUE INDEX uniq_domain_name_lower
ON "DomainTypeCatalog"(domain, LOWER(name));

CREATE UNIQUE INDEX uniq_allergen_type
ON "AllergenCatalog"(allergen, type);

ALTER TABLE "oralApplianceCatalog"
ADD CONSTRAINT uniq_oral_appliance_name UNIQUE (name);
