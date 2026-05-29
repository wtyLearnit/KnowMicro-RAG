"""
苏格拉底之窗 - Service Exceptions
"""
from typing import Optional
import httpx


class ExternalServiceError(Exception):
    """Raised when an upstream LLM or embedding API call fails.

    Carries a user-presentable message plus the originating service name and
    HTTP status code (when available) so the API layer can translate it into a
    clean response instead of leaking a raw 500.
    """

    def __init__(
        self,
        message: str,
        *,
        service: str = "",
        status_code: Optional[int] = None,
    ):
        self.message = message
        self.service = service
        self.status_code = status_code
        super().__init__(message)


def extract_api_error(response: httpx.Response) -> str:
    """Pull a human-readable error message out of an OpenAI-compatible error body."""
    try:
        data = response.json()
    except Exception:
        return (response.text or "").strip()[:300]

    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            return str(err.get("message") or err)
        if isinstance(err, str):
            return err
        if data.get("message"):
            return str(data["message"])
    return (response.text or "").strip()[:300]


def describe_exception(exc: Exception) -> str:
    """Return a non-empty description for an exception.

    Some low-level httpx errors (e.g. ConnectError) carry an empty message,
    which would otherwise produce a useless '...：' with nothing after it.
    """
    text = str(exc).strip()
    return text if text else type(exc).__name__
