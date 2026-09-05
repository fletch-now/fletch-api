"""Verify the X-Fletch-Signature header on a webhook delivery from Fletch.

The header is ``t=<unix seconds>,v1=<hex>`` where the hex is HMAC-SHA256 over the
exact bytes ``b"<t>." + body`` keyed with the endpoint's ``whsec_`` secret. The
timestamp is inside the signed string, so a captured body cannot be replayed
later with a fresh header; ``tolerance_seconds`` bounds how old (or how far in
the future) a delivery may be. Standard library only.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import time
from typing import Optional, Tuple, Union

SIGNATURE_HEX_LENGTH = 64
ASCII_DIGITS = re.compile(r"[0-9]+")


def parse_signature_header(header: str) -> Optional[Tuple[int, str]]:
    """Return (timestamp, lowercase hex digest) or None when the header is malformed.

    Unknown fields are ignored so a later scheme (v2=...) can be added beside
    v1 without breaking receivers on this version.
    """
    timestamp = None
    signature = None
    for part in header.split(","):
        key, separator, value = part.partition("=")
        if not separator:
            continue
        key = key.strip()
        value = value.strip()
        if key == "t":
            timestamp = value
        elif key == "v1":
            signature = value
    if timestamp is None or signature is None:
        return None
    # str.isdigit accepts any Unicode digit, which int() may then refuse; the
    # other verifiers take ASCII only, so this one does too.
    if not ASCII_DIGITS.fullmatch(timestamp) or len(signature) != SIGNATURE_HEX_LENGTH:
        return None
    try:
        bytes.fromhex(signature)
    except ValueError:
        return None
    return int(timestamp), signature.lower()


def _digest(secret: str, timestamp: int, body: bytes) -> bytes:
    return hmac.new(secret.encode("utf-8"), f"{timestamp}.".encode("ascii") + body, hashlib.sha256).digest()


def sign_webhook_body(secret: str, body: Union[bytes, str], timestamp: int) -> str:
    raw = body.encode("utf-8") if isinstance(body, str) else body
    return f"t={timestamp},v1={_digest(secret, timestamp, raw).hex()}"


def verify_fletch_signature(
    secret: str,
    header: str,
    body: Union[bytes, str],
    tolerance_seconds: int = 300,
    now: Optional[int] = None,
) -> bool:
    """True when the header signs this body with this secret and is within tolerance.

    ``body`` must be the raw request bytes (or the exact string they decode to),
    never a re-serialized object: a reordered key or a changed space changes the
    digest.
    """
    parsed = parse_signature_header(header)
    if parsed is None:
        return False
    timestamp, signature = parsed
    current = int(time.time()) if now is None else now
    if abs(current - timestamp) > tolerance_seconds:
        return False
    raw = body.encode("utf-8") if isinstance(body, str) else body
    return hmac.compare_digest(bytes.fromhex(signature), _digest(secret, timestamp, raw))
