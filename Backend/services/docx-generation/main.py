import os
import logging
import uvicorn
import io
import base64
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from docxtpl import DocxTemplate
from pydantic import BaseModel


# ============================================================================
# Configuration
# ============================================================================

env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Document Generation API", version="1.0.0")

TEMPLATE_PATH = os.getenv("TEMPLATE_PATH")
print(f"Using template path: {TEMPLATE_PATH}")


# ============================================================================
# Models
# ============================================================================

class DocumentRequest(BaseModel):
    """Request model for document generation"""
    tags: dict[str, str] = {}
    name: str | None = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "tags": {
                    "company": "Acme Corp",
                    "date": "2024-01-01"
                }
            }
        }


# ============================================================================
# Core Functions
# ============================================================================

def generate_docx_bytes(context: dict, template_path: str) -> bytes:
    """
    Generate DOCX document in memory.
    
    Args:
        context: Dictionary of tags to fill in the template
        template_path: Path to the DOCX template file
        
    Returns:
        DOCX file as bytes
        
    Raises:
        FileNotFoundError: If template file doesn't exist
        Exception: If document generation fails
    """
    try:
        logger.info(f"Generating DOCX with context: {list(context.keys())}")
        
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template file not found at {template_path}")
        
        # Load and render template
        doc = DocxTemplate(template_path)
        doc.render(context)
        
        # Save to bytes
        docx_bytes_io = io.BytesIO()
        doc.save(docx_bytes_io)
        docx_bytes_io.seek(0)
        docx_bytes = docx_bytes_io.getvalue()
        
        logger.info(f"DOCX generated successfully: {len(docx_bytes)} bytes")
        return docx_bytes
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error generating DOCX: {error_msg}", exc_info=True)
        raise Exception(error_msg) from e


def encode_to_base64(data: bytes) -> str:
    """Convert bytes to base64 string."""
    return base64.b64encode(data).decode('utf-8')


def sanitize_filename(name: str) -> str:
    """Sanitize name to be safe for use in filenames."""
    return "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in name)


def load_file(filename: str) -> str:
    """
    Load file from the current directory.
    
    Args:
        filename: Name of the file to load
        
    Returns:
        File contents as string
    """
    file_path = Path(__file__).resolve().parent / filename
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


def generate_preview_html(context: dict, docx_base64: str) -> str:
    """
    Generate the HTML preview page by loading and rendering the template.
    
    Args:
        context: Dictionary of template variables
        docx_base64: Base64 encoded DOCX content
        
    Returns:
        Complete HTML page as string
    """
    safe_name = sanitize_filename(context.get('name', 'document'))
    
    # Load external files
    styles = load_file('styles.css')
    script = load_file('script.js')
    template = load_file('template.html')
    
    # Render template with variables
    html = template.format(
        styles=styles,
        context=context,
        name=context.get('name', ''),
        script=script.format(docx_base64=docx_base64, safe_name=safe_name)
    )
    
    return html


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Document Generation API"}


@app.post("/generate-docx")
def generate_docx_post(request: DocumentRequest):
    """Generate document via POST request with multiple tags."""
    context = request.tags.copy()
    if request.name:
        context['name'] = request.name
    return _handle_document_generation(context)


@app.get("/generate-docx")
def generate_docx_get(name: str = Query(..., description="Name to render into the DOCX")):
    """Generate document via GET request."""
    return _handle_document_generation({"name": name})


@app.get("/docx-generation")
def docx_generation_alias(name: str = Query(..., description="Name to render into the DOCX")):
    """Alias endpoint for compatibility."""
    return _handle_document_generation({"name": name})


def _handle_document_generation(context: dict) -> HTMLResponse:
    """
    Main document generation handler - processes context and returns preview.
    
    Args:
        context: Dictionary of variables to fill in the template
        
    Returns:
        HTMLResponse with preview page
    """
    try:
        # Generate DOCX
        docx_bytes = generate_docx_bytes(context, TEMPLATE_PATH)
        
        # Encode to base64
        docx_base64 = encode_to_base64(docx_bytes)
        
        # Generate HTML preview
        html_content = generate_preview_html(context, docx_base64)
        
        return HTMLResponse(content=html_content)
        
    except FileNotFoundError:
        logger.error("Template not found")
        raise HTTPException(status_code=404, detail="Template file not found")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Error generating document: {error_msg}")


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    port = int(os.getenv("DOCX_GENERATED_PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    
    logger.info(f"Starting Document Generation API on {host}:{port}")
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
