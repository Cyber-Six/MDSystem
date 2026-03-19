# Medicine Request Workflow - Data Flow Analysis

## Overview
Investigation of the medicine request workflow from patient request creation through staff approval/dispensing, identifying where medicine details (names, descriptions) are lost in the data flow.

---

## 1. PATIENT SIDE: Medicine Request Creation

### File: `mds-patient/src/modules/medicine-request/medicine-request-page.jsx`

#### Initial Form State
```javascript
const [formData, setFormData] = useState({
  purpose: '',
  location: '',
  items: []  // Array of { itemCode, quantity }
});

const [selectedMedicinesByCode, setSelectedMedicinesByCode] = useState({});
// Maps itemCode → { item_code, item_name, category, batches[] }
```

#### Step 1: Fetch Available Medicines (Line 130-168)
**Query:** `GetAvailableMedicine`
```graphql
query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
  getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
    id
    item_code
    item_name
    category
  }
}
```

**Response includes:**
- ✅ `item_name` - Medicine name (PRESENT at this stage)
- ✅ `item_code` - Medicine code
- ✅ `category` - Medicine category
- Medicine grouped by `item_code` for selection

#### Step 2: Patient Selects Medicine (Line 199)
```javascript
const handleMedicineToggle = (itemCode, medicineGroup) => {
  setFormData({
    ...formData,
    items: [...formData.items, { itemCode, quantity: 1 }]
  });
  setSelectedMedicinesByCode({
    ...selectedMedicinesByCode,
    [itemCode]: medicineGroup  // Stores FULL medicine object
  });
};
```

**At this point:**
- Patient has selected medicines with names
- `selectedMedicinesByCode` contains full medicine details including `item_name`

#### Step 3: Submit Request Mutation (Line 342-385)
```javascript
// Build requestItems for submission (Line 343-350)
const requestItems = formData.items.map(item => {
  const medicineGroup = selectedMedicinesByCode[item.itemCode];
  const batchId = medicineGroup.batches[0]?.id;
  return { batchId: parseInt(batchId, 10), quantity: 1 };
});

// Submit mutation
mutation CreateMedicineRequest($input: CreateMedicineRequestInput!) {
  createMedicineRequest(input: $input) {
    id
    patientId
    status
    purpose
    created_at
    items {
      id
      medicineId
      quantity
    }
  }
}
```

**Data Sent to Backend:**
```javascript
{
  input: {
    purpose: string,
    location: LocationDesignation,
    items: [
      { batchId: number, quantity: number },
      // ❌ NO medicine name/details sent
    ]
  }
}
```

**Issue #1:** Patient frontend only sends `batchId` and `quantity`, not medicine names.

---

## 2. BACKEND: GraphQL Schema & Resolvers

### File: `Backend/routes/medical-inventory/medicine-request/schema.graphql`

```graphql
type MedicineRequestItem {
  id: ID!
  batchId: Int
  medicineId: Int
  requestId: Int
  quantity: Int
  # ❌ NO item_name, item_code, or other medicine details
}

type MedicineRequest {
  id: ID!
  patientId: Int
  status: RequestStatus
  purpose: String
  notes: String
  approved_by: Int
  created_at: String
  items: [MedicineRequestItem]
  # ❌ NO medicine details included
}

type Query {
  getAllMedicineRequests(status: RequestStatus, location: LocationDesignation, offset: Int, limit: Int): [MedicineRequest!]
  getMedicineRequests(patientId: ID!, offset: Int, limit: Int): [MedicineRequest!]
}
```

### File: `Backend/routes/medical-inventory/medicine-request/resolvers/wrapper/wrapper.js`

#### Critical Query: `_getAllMedicineRequests` (Line 84-95)

```javascript
_getAllMedicineRequests: async (_, { location, status, offset = 0, limit = 50 }, { res }) => {
  const sql = `
    SELECT mrl.*, ${ITEMS_AGG}
    FROM "MedicineRequestLog" mrl
    LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
    WHERE 
      location = COALESCE($1, location) AND 
      status = COALESCE($2, status)
    GROUP BY mrl.id
    ORDER BY mrl.created_at DESC
    OFFSET $3 LIMIT $4
  `;
  const result = await db.query(sql, [location, status, offset, limit]);
  return result.rows;
};
```

#### The ITEMS_AGG Constant (Line 8-16)

```javascript
const ITEMS_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', mre.id,
        'batchId', mre."medicineId",
        'medicineId', mre."medicineId",
        'requestId', mre."requestId",
        'quantity', mre.quantity
        # ❌ MISSING: item_name, item_code, description
      )
    ) FILTER (WHERE mre.id IS NOT NULL),
    '[]'
  ) AS items
`;
```

**Issue #2 - ROOT CAUSE:** The query joins only with `MedicineRequestEntity` but does NOT join with:
- `MedicalItems` (which has `item_name`, `item_code`, `description`)
- `MedicineBatch` (which has batch details)

**Result Returned by Backend to Staff:**
```javascript
{
  id: number,
  patientId: number,
  status: "Pending",
  purpose: string,
  notes: null,
  approved_by: null,
  created_at: timestamp,
  items: [
    {
      id: number,
      batchId: number,
      medicineId: number,
      requestId: number,
      quantity: number
      # ❌ NO item_name, item_code
    }
  ]
}
```

#### Comparison with Other Queries

The same pattern affects these queries:
- `_getMedicineStatus` (Line 50-63) - Patient's requests
- `_getMedicineRequestById` (Line 65-77)
- `_getMedicineRequests` (Line 79-91) - All patient requests

---

## 3. STAFF SIDE: Medicine Request Approval

### File: `mds-staff/src/modules/medical-inventory/medicine-request-service.jsx`

#### Service Function: `fetchAllMedicineRequests` (Line 74-95)

```javascript
export const fetchAllMedicineRequests = async (status = null, offset = 0, limit = 50) => {
  const data = await sendGraphQL(
    `query GetAllMedicineRequests($status: RequestStatus, $offset: Int, $limit: Int) {
      getAllMedicineRequests(status: $status, offset: $offset, limit: $limit) {
        id
        patientId
        status
        purpose
        notes
        approved_by
        created_at
        items {
          id
          medicineId
          requestId
          quantity
          # ❌ NO item_name requested
        }
      }
    }`,
    { status, offset, limit },
  );
  return data.getAllMedicineRequests ?? [];
};
```

**Data received:** Only `medicineId` and `quantity`, no medicine names.

---

## 4. STAFF UI: Request Display & Modal

### File: `mds-staff/src/modules/medical-inventory/medical-inventory.jsx`

#### Data Enrichment Function (Line 354-366)

```javascript
const enrichRequestItems = useCallback((requestItems = []) => {
  return requestItems.map((item) => {
    const batchId = item?.batchId ?? item?.medicineId;
    const batch = batches.find((b) => String(b.id) === String(batchId));
    const medicine = batch ? items.find((i) => String(i.id) === String(batch.medicalItemId)) : null;
    return {
      ...item,
      batchId,
      medicineId: item?.medicineId ?? batchId,
      itemId: medicine?.id || batch?.medicalItemId || null,
      itemName: medicine?.item_name || `Batch #${batchId}`,  // ⚠️ Fallback to Batch ID
    };
  });
}, [batches, items]);
```

**Strategy:** Frontend tries to enriches items by:
1. Finding the batch by ID
2. Cross-referencing with loaded medical items
3. Extracting `item_name`
4. Falls back to `Batch #${batchId}` if not found

**Problem:** This only works if:
- ✅ Batch data is already loaded in `batches` array
- ✅ Medical item data is already loaded in `items` array

### File: `mds-staff/src/modules/medical-inventory/components/dispense-queue/dispense-queue.jsx`

#### Display in Table (Line 152-158)

```javascript
<td className="px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300">
  {req.items?.map((item, idx) => (
    <div key={idx} className="text-xs">
      {item.itemName || '—'}
      {item.quantity && ` (qty: ${item.quantity})`}
    </div>
  )) || '—'}
</td>
```

**What shows:**
- ✅ If `item.itemName` exists (from enrichment): Shows medicine name
- ❌ If enrichment fails: Shows `—` (dash/empty)
- ⚠️ Cannot show medicine name in modal without proper data

### File: `mds-staff/src/modules/medical-inventory/components/dispense-queue/request-action-modal.jsx`

#### Modal Display (Line 39-47)

```javascript
<div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3">
  <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Request</p>
  <p className="text-xs font-medium text-secondary-700 dark:text-neutral-300">#{request.id}</p>
  {request.items?.[0] && (
    <p className="text-[10px] text-secondary-600 dark:text-neutral-400 mt-1">
      {request.items[0].quantity} unit(s) requested
      # ❌ NO medicine name shown here
    </p>
  )}
</div>
```

**Issue #3:** Modal shows:
- ✅ Request ID
- ✅ Quantity
- ❌ Medicine name (NOT available)

---

## 5. Data Flow Summary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Patient Request Creation (mds-patient)                          │
│                                                                 │
│ 1. Query: GetAvailableMedicine                                 │
│    Returns: {item_code, item_name, category, ...}             │
│                                                                 │
│ 2. Patient selects: itemCode → {item_name, batches}           │
│    Stores in: selectedMedicinesByCode (HAS item_name)         │
│                                                                 │
│ 3. Submit Mutation: CreateMedicineRequest                     │
│    Sends: {purpose, location, items: [{batchId, quantity}]}   │
│    ❌ item_name NOT sent to backend                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend Processing (Backend/routes/medical-inventory)           │
│                                                                 │
│ 1. Insert into MedicineRequestLog + MedicineRequestEntity     │
│    Stores: purpose, location, batchId, quantity               │
│    ❌ item_name NOT stored (no field needed, can look up)     │
│                                                                 │
│ 2. Query: getAllMedicineRequests                              │
│    SQL: SELECT mrl.*, ITEMS_AGG                               │
│    Joins: MedicineRequestLog + MedicineRequestEntity          │
│    ❌ NO JOIN with MedicalItems (missing item_name)           │
│    Returns: {id, patientId, status, purpose, items: [...]}    │
│    items: [{id, batchId, medicineId, quantity}]              │
│    ❌ item_name NOT included in response                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Staff Request Approval (mds-staff)                             │
│                                                                 │
│ 1. fetchAllMedicineRequests()                                 │
│    Receives: {id, patientId, status, items: [{...}]}          │
│    ❌ items[] has NO item_name                                │
│                                                                 │
│ 2. enrichRequestItems() tries to enrich:                       │
│    - Looks up batch by ID in loaded batches[]                 │
│    - Looks up medicine by medicalItemId in loaded items[]      │
│    - Extracts item_name from medicine                         │
│    ✅ Works IF batches/items already loaded                   │
│    ⚠️ Falls back to "Batch #ID" if not found                  │
│                                                                 │
│ 3. Display in DispenseQueue table                             │
│    Shows: item.itemName (or "Batch #ID")                      │
│                                                                 │
│ 4. Display in RequestActionModal                              │
│    Shows: Request ID, Quantity                                │
│    ❌ Medicine name NOT displayed in modal                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Findings

### ✅ What Works
1. Patient can see medicine names when selecting (has full data in frontend cache)
2. Batches with available medicines are displayed correctly
3. Staff can approve/reject requests (only needs ID)
4. Location filtering works

### ❌ What's Broken
1. **Backend query doesn't include medicine names** - The `_getAllMedicineRequests` query in wrapper.js only joins `MedicineRequestEntity` but NOT `MedicalItems`
2. **Modal doesn't show medicine details** - RequestActionModal can't display what medicine was requested
3. **Fallback UX is poor** - Enrichment fails silently, shows "Batch #ID" or "—"
4. **Round-trip inefficiency** - Should be fetched from DB once, not reconstructed on frontend

### 🔴 Root Cause
**Backend SQL Query Missing Join:**
```sql
-- CURRENT (BROKEN):
SELECT mrl.*, ITEMS_AGG
FROM "MedicineRequestLog" mrl
LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id

-- NEEDED:
SELECT mrl.*, ITEMS_AGG_WITH_NAMES
FROM "MedicineRequestLog" mrl
LEFT JOIN "MedicineRequestEntity" mre ON mre."requestId" = mrl.id
LEFT JOIN "MedicalItems" mi ON mi.id = mre."medicineId"  -- ← MISSING
```

---

## Impact Assessment

### Critical
- **Staff cannot see what medicine was requested** in the approval modal (shows quantity only)
- **Poor visibility in request queue** if frontend enrichment fails

### High
- **Unnecessary frontend complexity** - enrichment function should not be needed
- **Potential data inconsistency** - if batch/item data isn't preloaded, modal shows nothing

### Medium
- **Performance impact** - enrichment requires looping through batches/items arrays
- **Testing difficulty** - data flow unclear, enrichment is implicit

---

## Solution Options

### Option 1: Fix Backend Query (Recommended)
- Add JOIN with `MedicalItems` in `ITEMS_AGG` aggregation
- Include `item_name`, `item_code`, `category` in response
- Update GraphQL schema if needed
- Remove enrichment from frontend

### Option 2: Hybrid Approach
- Keep backend as-is but add separate query to fetch missing details
- Staff loads request → detects missing details → calls separate query
- More API calls but less backend changes

### Option 3: Frontend-Only Fix
- Keep backend query same, improve frontend enrichment
- Preload ALL batches + items before loading requests
- Add better error handling when enrichment fails