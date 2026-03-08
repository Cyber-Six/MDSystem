# mds-docx-generation.service

## How JS Communicates with the Service

The Python service runs as a standalone **FastAPI HTTP server**. The Express backend communicates with it via HTTP over localhost.

```
Express (JS) → HTTP POST → FastAPI (Python) → rendered HTML preview / DOCX bytes
```

From any JS file in the backend:
```js
// axios.post(`http://127.0.0.1:${DOCX_GENERATED_PORT}/generate-docx`, { tags: { NAME: 'Juan', DATE: '2026-03-09' } })
```

The service must be running separately before the Express server uses it.

---

## Tag System (docxtpl)

Templates are `.docx` files using Jinja2-style tags via `docxtpl`:
- Use `{{ TAG_NAME }}` inside the `.docx` template file
- Pass `tags: { TAG_NAME: "value" }` in the POST body to `/generate-docx`
- Common tags per document type should be defined and standardized (see Tasks below)

---

## Setup

### Paths
- **Service root:** `Backend/services/docx-generation/`
- **Virtual environment:** `Backend/services/docx-generation/venv/`
- **Templates:** stored path configured via `TEMPLATE_PATH` in `Backend/.env`

### Steps

1. Ensure Python 3.10+ is installed
2. Create the virtual environment inside the service directory:
   ```bash
   cd Backend/services/docx-generation
   python3 -m venv venv
   ```
3. Activate it:
   ```bash
   source venv/bin/activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Set required env variables in `Backend/.env`:
   ```env
   DOCX_GENERATED_PORT=8000
   TEMPLATE_PATH=/absolute/path/to/template.docx
   ```
6. Run the service:
   ```bash
   python main.py
   ```

---

## Tasks

- [ ] FastAPI service with `POST /generate-docx` and `GET /health` endpoints
- [ ] Template rendering using `docxtpl` (Jinja2 tags inside `.docx`)
- [ ] In-browser HTML preview via `mammoth.js`
- [ ] DOCX download from preview page
- [ ] Add a dedicated Express route (e.g. `POST /api/documents/generate`) that proxies to the FastAPI service
- [ ] PDF export — requires `docx2pdf` (needs LibreOffice installed on the server)
- [ ] Define tag contracts per document type:
  - **Medical Certificate:** `{{ NAME }}`, `{{ DATE }}`, `{{ DIAGNOSIS }}`, `{{ LICENSE_NO }}`
  - **Medical Clearance:** `{{ NAME }}`, `{{ DATE }}`, `{{ PURPOSE }}`, `{{ LICENSE_NO }}`
  - **Prescription:** `{{ NAME }}`, `{{ DATE }}`, `{{ MEDICATION }}`, `{{ LICENSE_NO }}`, `{{ PTR_NO }}`
  - **Lab Referral:** `{{ NAME }}`, `{{ DATE }}`, `{{ TEST_TYPE }}`, `{{ LICENSE_NO }}`
- [ ] Create `.docx` template files per document type and place them in the configured `TEMPLATE_PATH` directory
- [ ] Support multiple templates — update the endpoint to accept a `template` selector in the request body
- [ ] Optionally manage the service lifecycle from the Node.js backend using `child_process` to auto-start/stop it

