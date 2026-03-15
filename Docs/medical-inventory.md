# Medical Inventory — Developer Reference

Covers the three GraphQL modules that make up the medical inventory system:

| Module | Route | Access |
|---|---|---|
| `inventory` | `/medical-inventory/medical` | Medical staff only |
| `prescription` | `/medical-inventory/prescription` | Medical staff (issue) · Patient (view) |
| `medicine-request` | `/medical-inventory/medicine-request` | Patient (create) · Medical staff (approve/reject) |

All routes are protected by `jwtProtect`. Each module has a `medical-resolver.js` that enforces role and permission checks before delegating to `wrapper.js`.

---

## Shared Enums

These enums are defined in each module's `schema.graphql` and apply across all three:

| Enum | Values |
|---|---|
| `ItemCategory` | `Medicine`, `Supply` |
| `DosageUnit` | `mg`, `g`, `mcg`, `ml`, `L`, `IU` |
| `LocationDesignation` | `Arlegui`, `Casal`, `QuezonCity` |
| `SupplyUnit` (inventory only) | `pcs`, `box`, `pack`, `set`, `kit` |
| `RequestStatus` (medicine-request only) | `InProgress`, `Pending`, `Revision`, `RevisionSubmitted`, `Cancelled`, `Expired`, `Approved`, `Rejected` |
| `TransactionActionType` (prescription only) | `Issue`, `Return`, `Adjust` |

---

## Module 1: Inventory

Manages the master item catalogue (`MedicalItems`) and stock batches (`MedicineBatch` for medicines, `SupplyBatch` for consumables).

### Queries

#### `getMedicalItems`
```graphql
getMedicalItems(category: ItemCategory, active: Boolean, offset: Int, limit: Int): [MedicalItem!]
```
Returns all items. Both filters are optional — omitting them returns everything. Results are paged and sorted by `item_name ASC`.

#### `getMedicalItem`
```graphql
getMedicalItem(id: ID!): MedicalItem
```
Returns a single item by ID, or `null` if not found.

#### `getMedicalSupply`
```graphql
getMedicalSupply(medicalItemId: Int!, location: LocationDesignation, availableOnly: Boolean, offset: Int, limit: Int): [MedicineBatch!]
```
Returns batches for a medicine item. `availableOnly: true` filters out expired batches (`expiryDate > CURRENT_DATE`). Results sorted by `expiryDate ASC` (FEFO order).

#### `getSupplyBatches`
```graphql
getSupplyBatches(supplyItemId: Int!, location: LocationDesignation, availableOnly: Boolean, offset: Int, limit: Int): [SupplyBatch!]
```
Returns batches for a supply item. `availableOnly: true` filters out zero-quantity and expired batches.

---

### Mutations

#### `createMedicalItems`
```graphql
createMedicalItems(input: MedicalItemInput!): MedicalItem
```
Creates a new item in the catalogue. Returns `409` if `item_code` already exists.

```graphql
input MedicalItemInput {
  item_code: String!
  item_name: String!
  category: ItemCategory!
  description: String
}
```

#### `updateMedicalItems`
```graphql
updateMedicalItems(id: ID!, input: MedicalItemUpdateInput!): MedicalItem
```
Partially updates an item. Only provided non-null fields are updated. Always stamps `updated_at = current_timestamp`.

```graphql
input MedicalItemUpdateInput {
  item_code: String
  item_name: String
  category: ItemCategory
  description: String
  active: Boolean
}
```
Returns `400` if no valid fields are provided, `409` on duplicate item code, `404` if not found.

#### `deleteMedicalItems`
```graphql
deleteMedicalItems(id: ID!): Boolean
```
Soft-delete: sets `active = false`. Does not delete the row. Returns `true` on success, `404` if not found.

#### `addMedicalSupply`
```graphql
addMedicalSupply(input: MedicineBatchInput!): MedicineBatch
```
Adds a new medicine batch and bulk-inserts `quantity` individual `MedicineEntity` rows (one per physical unit). Validates the parent item is active first.

```graphql
input MedicineBatchInput {
  medicalItemId: Int!
  supplierName: String
  batchNumber: String!
  dosageUnit: DosageUnit!
  dosageValue: Int!
  expiryDate: Date!
  location: LocationDesignation!
  quantity: Int!
  notes: String
}
```

#### `addSupplyBatch`
```graphql
addSupplyBatch(input: SupplyBatchInput!): SupplyBatch
```
Adds a new consumable supply batch. `initialQuantity` and `currentQuantity` are both set to `input.initialQuantity` on creation.

#### `splitMedicalSupply`
```graphql
splitMedicalSupply(batchId: ID!, input: SplitMedicalSupplyInput!): SupplyBatch
```
Moves `quantity` units from an existing `SupplyBatch` to a new batch at `targetLocation`. Source batch `currentQuantity` is decremented; a new batch row is created with the split quantity. Returns `400` if insufficient quantity or target location equals source.

```graphql
input SplitMedicalSupplyInput {
  quantity: Int!
  targetLocation: LocationDesignation!
  notes: String
}
```

#### `updateMedicalSupply`
```graphql
updateMedicalSupply(batchId: ID!, input: MedicalSupplyUpdateInput!): MedicineBatch
```
Updates `expiryDate` and/or `notes` on a `MedicineBatch`. Returns `400` if neither field is provided.

#### `updateSupplyBatch`
```graphql
updateSupplyBatch(batchId: ID!, input: MedicalSupplyUpdateInput!): SupplyBatch
```
Updates `expiryDate` and/or `notes` on a `SupplyBatch`.

```graphql
input MedicalSupplyUpdateInput {
  expiryDate: Date
  notes: String
}
```

---

## Module 2: Prescription

Issues medicine prescriptions to patients. Creates a `MedicineTransactionLog` record and links individual `MedicineEntity` rows to it.

### Queries

#### `getAvailableMedicine`
```graphql
getAvailableMedicine(location: LocationDesignation, offset: Int, limit: Int): [AvailableMedicine!]
```
Returns medicine items joined with their non-expired batches. Filters: `active = true`, `category = 'Medicine'`, `expiryDate > CURRENT_DATE`. Optionally filters by location. Sorted by item name then expiry date.

#### `getPatientPrescriptions`
```graphql
getPatientPrescriptions(patientId: ID!, offset: Int, limit: Int): [PrescriptionTransaction!]
```
Returns all prescription transactions for a patient, each with an aggregated `items` array. Sorted by `issuedAt DESC`.

```graphql
type PrescriptionTransaction {
  id: ID!
  patientId: Int
  action: TransactionActionType
  quantity: Int
  issuedBy: Int
  issuedAt: Date
  notes: String
  items: [PrescriptionItem]  # [{ id, batchId, transactionId }]
}
```

---

### Mutations

#### `issuePrescription`
```graphql
issuePrescription(input: IssuePrescriptionInput!): PrescriptionTransaction
```
Issues medicine to a patient. Steps:
1. Creates a `MedicineTransactionLog` row with `action = 'Issue'` and total quantity
2. Inserts one `MedicineEntity` row per item in `input.items`
3. Sends a patient email notification via `enqueueNotificationEmail` (non-blocking — email failure does not abort the mutation)

```graphql
input IssuePrescriptionInput {
  patientId: Int!
  items: [PrescriptionItemInput!]!
  notes: String
}

input PrescriptionItemInput {
  batchId: Int!
  quantity: Int!
}
```

---

## Module 3: Medicine Request

Patients submit medicine requests. Medical staff review and approve or reject them. Approval creates a prescription transaction automatically.

### Queries

#### `getAvailableMedicine`
Same query as the prescription module — returns non-expired medicine batches. See [Module 2 — getAvailableMedicine](#getavailablemedicine) above.

#### `getMedicineStatus`
```graphql
getMedicineStatus: [MedicineRequest!]
```
Returns all requests for the authenticated patient (patientId resolved from context by the medical resolver).

#### `getMedicineRequestById`
```graphql
getMedicineRequestById(requestId: ID!): MedicineRequest
```
Returns a single request with its aggregated `items` array, or `null`.

#### `getMedicineRequests`
```graphql
getMedicineRequests(patientId: ID!, offset: Int, limit: Int): [MedicineRequest!]
```
Paged list of requests for a given patient. Sorted by `created_at DESC`.

#### `getAllMedicineRequests`
```graphql
getAllMedicineRequests(status: RequestStatus, offset: Int, limit: Int): [MedicineRequest!]
```
Medical staff view — returns all requests across all patients. Optional `status` filter. Defaults: `offset = 0`, `limit = 50`.

```graphql
type MedicineRequest {
  id: ID!
  patientId: Int
  status: RequestStatus
  transactionId: Int
  purpose: String
  notes: String
  approved_by: Int
  created_at: String
  items: [MedicineRequestItem]  # [{ id, batchId, requestId, quantity }]
}
```

---

### Mutations

#### `createMedicineRequest`
```graphql
createMedicineRequest(input: CreateMedicineRequestInput!): MedicineRequest
```
Submits a new medicine request with `status = 'Pending'`. Creates a `MedicineRequestLog` row and one `MedicineRequestEntity` row per item.

```graphql
input CreateMedicineRequestInput {
  purpose: String!
  notes: String
  items: [MedicineRequestItemInput!]!
}

input MedicineRequestItemInput {
  batchId: Int!
  quantity: Int!
}
```

#### `setStatusMedicineRequest`
```graphql
setStatusMedicineRequest(requestId: ID!, status: RequestStatus!, notes: String): MedicineRequest
```
Updates a pending request to `Approved`, `Rejected`, or `Cancelled`.

**Approval flow** (runs inside a database transaction with `SET CONSTRAINTS ALL DEFERRED` to resolve the circular FK between `MedicineTransactionLog` and `MedicineRequestLog`):
1. `BEGIN`
2. Insert `MedicineTransactionLog` (`action = 'Issue'`, total quantity)
3. Insert `MedicineEntity` rows for each requested item
4. Update `MedicineRequestLog` with `status = 'Approved'`, `transactionId`
5. `COMMIT` (or `ROLLBACK` on error)

**Rejection / Cancellation flow**: single `UPDATE` on `MedicineRequestLog` — no transaction needed.

After status update, sends a patient email via `enqueueNotificationEmail` for `Approved` or `Rejected` outcomes (non-blocking).

> **Constraint:** Only requests with `status = 'Pending'` can be updated. Any other status returns `400`.

---

## Email Notifications

Both prescription issuance and medicine request status changes send emails to the patient. All notifications use `enqueueNotificationEmail` from `services/emailservice.js` — a single BullMQ job that renders through `notificationTemplate`.

| Event | Trigger | Subject |
|---|---|---|
| Prescription issued | `issuePrescription` | `Prescription Issued` |
| Request approved | `setStatusMedicineRequest` status `Approved` | `Medicine Request Approved` |
| Request rejected | `setStatusMedicineRequest` status `Rejected` | `Medicine Request Rejected` |

Email failures are caught and logged — they do not roll back or fail the GraphQL mutation.

---

## Database Tables

| Table | Module | Purpose |
|---|---|---|
| `MedicalItems` | inventory | Master catalogue (medicines and supplies) |
| `MedicineBatch` | inventory | Medicine stock batches (per item, per location) |
| `MedicineEntity` | inventory / prescription | Individual physical medicine units linked to a batch |
| `SupplyBatch` | inventory | Consumable supply batches (quantity-tracked) |
| `MedicineTransactionLog` | prescription | Prescription issuance records |
| `MedicineRequestLog` | medicine-request | Patient medicine request records |
| `MedicineRequestEntity` | medicine-request | Line items within a medicine request |

---

## Query Builder Pattern

All dynamic SQL uses template literals with `Array.push()` as the `$N` index counter. `Array.push(value)` returns the new array length, which is the 1-based positional parameter index for pg.

```js
const params = [];
const conditions = [`"medicalItemId" = $1`]; // $1 always present
params.push(medicalItemId);

if (location) conditions.push(`location = $${params.push(location)}`);
if (availableOnly) conditions.push(`"expiryDate" > CURRENT_DATE`);

const sql = `
  SELECT * FROM "MedicineBatch"
  WHERE ${conditions.join(' AND ')}
  ORDER BY "expiryDate" ASC
  OFFSET $${params.push(offset)} LIMIT $${params.push(limit)}
`;
```

Dynamic SET builds for UPDATE mutations follow the same pattern using `Object.entries(input)` filtered against an `allowed` field list:

```js
const params = [];
const sets = Object.entries(input)
  .filter(([key, value]) => value !== null && value !== undefined && allowed.includes(key))
  .map(([key, value]) => `"${key}" = $${params.push(value)}`);

sets.push('"updated_at" = current_timestamp');
params.push(id);

const sql = `UPDATE "MedicalItems" SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
```
