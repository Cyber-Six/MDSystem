import logging
import uvicorn
from fastapi import FastAPI

from config import SERVICE_HOST, SERVICE_PORT
from routes.document import router as document_router
from routes.report import router as report_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-28s  %(levelname)-7s  %(message)s",
)
logger = logging.getLogger("mds-document-service")

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MDS Document Service",
    version="2.0.0",
    description="Unified service for DOCX generation, PDF export, and report generation.",
)

app.include_router(document_router)
app.include_router(report_router)


@app.get("/health")
def health_check():
    """Readiness / liveness probe."""
    return {
        "status": "healthy",
        "service": "MDS Document Service",
    }


# ---------------------------------------------------------------------------
# Entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("Starting MDS Document Service on %s:%s", SERVICE_HOST, SERVICE_PORT)
    uvicorn.run(app, host=SERVICE_HOST, port=SERVICE_PORT, log_level="info")
