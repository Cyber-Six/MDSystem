import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from Backend root
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Service binding
SERVICE_PORT = int(os.getenv("DOCX_GENERATED_PORT", "3002"))
SERVICE_HOST = os.getenv("DOCX_SERVICE_HOST", "127.0.0.1")

# Directory containing .docx template files (medical_certificate.docx, etc.)
TEMPLATE_DIR = os.getenv("TEMPLATE_PATH", "")

# Internal directories (relative to this service)
SERVICE_ROOT = Path(__file__).resolve().parent
TEMPLATES_DIR = SERVICE_ROOT / "templates"
PREVIEW_TEMPLATES_DIR = TEMPLATES_DIR / "preview"
REPORT_TEMPLATES_DIR = TEMPLATES_DIR / "reports"
