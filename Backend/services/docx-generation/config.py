import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from Backend root
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
env_path = BACKEND_ROOT / ".env"
load_dotenv(dotenv_path=env_path)

# ---------------------------------------------------------------------------
# Service binding
# ---------------------------------------------------------------------------
SERVICE_PORT = int(os.getenv("DOCX_GENERATED_PORT", "3002"))
SERVICE_HOST = os.getenv("DOCX_SERVICE_HOST", "127.0.0.1")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL = os.getenv("DOCX_LOG_LEVEL", "INFO").upper()

# ---------------------------------------------------------------------------
# Template directories
# ---------------------------------------------------------------------------

# Directory containing .docx template files (medical_certificate.docx, etc.)
# If TEMPLATE_PATH is relative, resolve it from the Backend root.
_raw_template_path = os.getenv("TEMPLATE_PATH", "")
if _raw_template_path and not os.path.isabs(_raw_template_path):
    TEMPLATE_DIR = str(BACKEND_ROOT / _raw_template_path)
else:
    TEMPLATE_DIR = _raw_template_path

# Directory for storing generated output files (optional, for debugging)
SERVICE_ROOT = Path(__file__).resolve().parent
GENERATED_DIR = SERVICE_ROOT / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

# Internal Jinja2 template directories (HTML preview page, report layout)
TEMPLATES_DIR = SERVICE_ROOT / "templates"
PREVIEW_TEMPLATES_DIR = TEMPLATES_DIR / "preview"
REPORT_TEMPLATES_DIR = TEMPLATES_DIR / "reports"
