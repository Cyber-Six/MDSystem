# Electronic Medical Record (EMR) - Patient Endpoint

The **Patient EMR** endpoint (`/emr`) provides read-only access to patient medical records. Patients can view their own health data including vital signs, dental records, allergies, medical history, and other clinical information.

---

## Endpoint

```
POST /emr
Middleware: jwtProtect("patient")
```

---

## Overview

This endpoint is accessible **only to patients**. It provides read-only queries to fetch personal medical records and history. Staff members cannot access this endpoint—they use `/staff/emr` instead.

**Key Responsibility:** Allows authenticated patients to view their complete medical profile and history.

---

## Permissions

All queries require patient authentication only. No additional permission checks are needed beyond JWT validation.

---

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `DentalLegend` | `PRESENT`, `DUE_FILLING_DECAYED`, `DUE_EXTRACTION`, `ROOT_FRAGMENT`, `MISSING_DUE_TO_CARIES`, `MISSING_DUE_TO_OTHER_CAUSES`, `IMPACTED_TOOTH`, `SUPERNUMERARY_TOOTH`, `UNERUPTED`, `ECTOPIC_ERUPTION`, `DIASTEMA`, `ROTATED`, `FRACTURE`, `ABRADED`, `ATTRITION`, `MOBILITY`, `AMALGAM_FILLING`, `COMPOSITE_FILLING`, `GOLD_FILLING`, `INLAY_FILLING`, `CEMENTED_CROWN`, `BRIDGE_ABUTMENT`, `PONTIC`, `ROOT_CANAL`, `EXTRACTION`, `JACKET_CROWN` |
| `DomainType` | `VisualAcuity`, `MedicalCondition`, `Medication`, `Hospitalization`, `Operation`, `Immunization`, `DentalProcedure` |
| `UpdateStatus` | `InProgress`, `Pending`, `Revision`, `RevisionSubmitted`, `Cancelled`, `Expired`, `Approved`, `Rejected` |
| `UpdateScope` | `Medical`, `Dental`, `Both` |
| `ALLERGEN_TYPE` | `Food`, `Drug`, `Environmental`, `Insect`, `Chemical`, `Other` |
| `allergy_status` | `Active`, `Resolved`, `Suspected` |
| `severity` | `Mild`, `Moderate`, `Severe`, `Unknown` |
| `arch_designation` | `None`, `Upper`, `Lower`, `Both` |
| `appliance_status` | `Active`, `Lost`, `Replaced`, `Discontinued`, `Pending`, `Returned`, `Failed` |
| `DesignationBranch` | `Manila`, `QuezonCity`, `Both` |

### Core Types

#### VitalSigns
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `height_cm` | `Float!` | Height in centimeters |
| `weight_kg` | `Float!` | Weight in kilograms |
| `blood_pressure` | `String!` | Format: "120/80" |
| `heart_rate` | `Int!` | Beats per minute |
| `temperature` | `Float!` | Celsius |
| `notes` | `String` | Additional clinical notes |
| `recorded_at` | `Date` | When measurements were taken |
| `created_at` | `Date` | Record creation timestamp |

#### DentalRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `notes` | `String` | Clinical notes |
| `ToothPlacements` | `[ToothPlacement!]!` | Tooth-specific findings |
| `oralFindings` | `[OralFindingRecord!]!` | Oral health observations |
| `created_at` | `Date` | Record creation timestamp |

#### ToothPlacement
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `toothIndex` | `Int!` | Tooth number/position (1-32) |
| `legend` | `DentalLegend!` | Tooth status/condition |

#### OralFindingRecord
| Field | Type | Description |
|-------|------|-------------|
| `oralFindingId` | `ID!` | FK to OralFindingCatalog |
| `status` | `String!` | Observation status |
| `notes` | `String` | Additional notes |

#### OralFindingCatalog
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `name` | `String!` | Finding name (e.g., "Gingival Inflammation") |
| `description` | `String` | Detailed description |
| `isActive` | `Boolean!` | Whether catalog entry is active |
| `created_at` | `Date` | Creation timestamp |

#### AllergyProfile
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `allergyRecords` | `[AllergyRecord!]!` | Individual allergy entries |
| `status` | `UpdateStatus` | Profile status (Approved, InProgress, etc.) |

#### AllergyRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `allergen` | `String!` | Allergen name |
| `type` | `ALLERGEN_TYPE!` | Allergen category |
| `status` | `allergy_status!` | Current status (Active, Resolved, Suspected) |
| `severity` | `severity!` | Reaction severity |
| `date_identified` | `Date` | When allergy was identified |

#### DentalHistory
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `seenByDentist` | `Boolean!` | Visit history |
| `lastVisitDate` | `Date` | Last dental visit |
| `purpose` | `String` | Reason for last visit |
| `lastDentalCleaning` | `String` | Cleaning frequency range |
| `status` | `UpdateStatus` | Profile status |

#### OralApplianceProfile
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `applianceRecords` | `[OralApplianceRecord!]!` | Active appliances |
| `status` | `UpdateStatus` | Profile status |

#### OralApplianceRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | |
| `applianceName` | `String!` | Type of appliance |
| `status` | `appliance_status!` | Current status |
| `dateIssued` | `Date` | When appliance was issued |
| `arch` | `arch_designation!` | Which arch (Upper/Lower/Both) |

#### MedicalHistory / Hospitalization / Operation / Immunization
Patterns for capturing medical events with associated catalog types.

---

## Queries

### Profile Updates
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getUpdateTicket` | None | `UpdateTicket` | Get current active update ticket for logged-in patient |
| `getProfile` | None | `StudentProfile` / `EmployeeProfile` | Get active/in-revision profile |

### Dental & Oral Health
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getDentalHistory` | None | `DentalHistory` | Get current dental history |
| `getDentalRecord` | None | `DentalRecord` | Get active/in-revision dental record |
| `getOralApplianceProfile` | `approved?: Boolean` | `OralApplianceProfile` | Get appliance records |
| `getDentalPhotoRecord` | None | `DentalPhotoRecord` | Get dental photos (if any) |

### Medical Records
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getVitalSigns` | None | `VitalSigns` | Get latest vital signs |
| `getAllergyProfile` | None | `AllergyProfile` | Get active allergies |
| `getMedicationProfile` | None | `MedicationProfile` | Get current medications |
| `getEmergencyContact` | `approved?: Boolean` | `EmergencyContact` | Get emergency contact info |
| `getMedicalHistory` | None | `MedicalHistory` | Get medical history |
| `getHospitalizationProfile` | None | `HospitalizationProfile` | Get hospitalization records |
| `getOperationProfile` | None | `OperationProfile` | Get operation records |
| `getImmunizationProfile` | None | `ImmunizationProfile` | Get vaccination records |
| `getVisualAcuityProfile` | None | `VisualAcuityProfile` | Get vision records |

### ObGyn (Female Patients)
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getObgynHistory` | None | `ObGynHistory` | Get menstrual and gynecology info |

### Lifestyle
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getLifestyle` | None | `Lifestyle` | Get lifestyle factors (smoking, alcohol, vaping) |

### Procedures & Procedures
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getDentalProcedureProfile` | None | `DentalProcedureProfile` | Get dental procedures |
| `getProcedureDomain` | None | `[DomainType!]` | Get available procedure domains |

### Catalogs (Reference Data)
| Query | Parameters | Returns | Description |
|-------|-----------|---------|-------------|
| `getDomainCatalogs` | `domain?: DomainType, filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[DomainCatalog!]` | Get procedure type options |
| `getAllergenCatalogs` | `type?: ALLERGEN_TYPE, filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[AllergenCatalog!]` | Get allergen options |
| `getOralApplianceCatalogs` | `filterIsValid?: Boolean, offset?: Int, limit?: Int` | `[OralApplianceTag!]` | Get appliance type options |
| `searchDomainCatalogs` | `domain!: String, filterIsValid?: Boolean, names!: [String!]` | `[DomainCatalog!]` | Search for domain types by name |
| `searchAllergenCatalogs` | `allergens!: [String!], filterIsValid?: Boolean` | `[AllergenCatalog!]` | Search allergens by name |
| `searchOralApplianceCatalogs` | `names!: [String!], filterIsValid?: Boolean` | `[OralApplianceTag!]` | Search appliances by name |

### Searching Patients

**Note:** This is available on the **Medical/Staff endpoint only**, not on the patient endpoint.

---

## Mutations

**The Patient endpoint is READ-ONLY.** All mutations that create, update, or submit profile changes are available on the medical/staff endpoint (`/staff/emr` or through patient submission endpoints).

---

## Example Queries

### Get Current Medical Profile
```graphql
{
  getProfile {
    id
    status
    program
    year
  }
}
```

### Get Active Allergies
```graphql
{
  getAllergyProfile {
    id
    status
    allergyRecords {
      allergen
      type
      status
      severity
      date_identified
    }
  }
}
```

### Get Dental Records with Findings
```graphql
{
  getDentalRecord {
    id
    notes
    ToothPlacements {
      toothIndex
      legend
    }
    oralFindings {
      oralFindingId
      status
      notes
    }
  }
}
```

### Get Vital Signs
```graphql
{
  getVitalSigns {
    id
    height_cm
    weight_kg
    blood_pressure
    heart_rate
    temperature
    recorded_at
  }
}
```

### Search Allergen Catalog
```graphql
{
  searchAllergenCatalogs(allergens: ["Penicillin", "Peanuts"], filterIsValid: true) {
    id
    allergen
    type
  }
}
```

---

## Notes

- **Patient isolation:** Patients only see their own data. No cross-patient queries available.
- **Read-only:** This endpoint does not accept mutations. Use `/staff/emr` or tenant-specific endpoints to create/update records.
- **Catalog queries:** Patients can browse procedure types, allergens, and appliance options for reference.
- **Update workflow:** When patients need to update their profile, they submit via the patient portal. Staff approves/rejects via `/staff/emr`.
- **Timestamp fields:** Use `created_at` to see when records were created in the system.

---

## Related Endpoints

- **Patient Portal**: `/patient/*` — For patient-initiated profile updates and submissions
- **Medical/Staff EMR**: `/staff/emr` — For staff-managed records and catalog administration
- **Consultation**: `/consultation` — For virtual/onsite medical consultations
- **Health Chat**: `/health-chat` — For patient-doctor messaging
