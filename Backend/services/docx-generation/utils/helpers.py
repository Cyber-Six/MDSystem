import base64
import re


def encode_to_base64(data: bytes) -> str:
    """Convert bytes to base64 string."""
    return base64.b64encode(data).decode("utf-8")


def sanitize_filename(name: str) -> str:
    """Sanitize a string to be safe for use in filenames."""
    return re.sub(r"[^\w\-]", "_", name).strip("_")
