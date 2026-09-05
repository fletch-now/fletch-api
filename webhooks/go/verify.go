// Package fletchwebhook verifies the X-Fletch-Signature header on a webhook
// delivery from Fletch.
//
// The header is "t=<unix seconds>,v1=<hex>" where the hex is HMAC-SHA256 over
// the exact bytes "<t>." + body keyed with the endpoint's whsec_ secret. The
// timestamp is inside the signed string, so a captured body cannot be replayed
// later with a fresh header; the tolerance bounds how old (or how far in the
// future) a delivery may be. Standard library only.
package fletchwebhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const signatureHexLength = 64

// ParsedSignature is the timestamp and digest carried by a well-formed header.
type ParsedSignature struct {
	Timestamp int64
	Signature []byte
}

// ParseSignatureHeader returns the timestamp and digest, or ok=false when the
// header is malformed. Unknown fields are ignored so a later scheme (v2=...)
// can be added beside v1 without breaking receivers on this version.
func ParseSignatureHeader(header string) (ParsedSignature, bool) {
	var timestamp, signature string
	var haveTimestamp, haveSignature bool
	for _, part := range strings.Split(header, ",") {
		key, value, found := strings.Cut(part, "=")
		if !found {
			continue
		}
		switch strings.TrimSpace(key) {
		case "t":
			timestamp, haveTimestamp = strings.TrimSpace(value), true
		case "v1":
			signature, haveSignature = strings.TrimSpace(value), true
		}
	}
	if !haveTimestamp || !haveSignature {
		return ParsedSignature{}, false
	}
	if timestamp == "" || strings.Trim(timestamp, "0123456789") != "" {
		return ParsedSignature{}, false
	}
	seconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return ParsedSignature{}, false
	}
	if len(signature) != signatureHexLength {
		return ParsedSignature{}, false
	}
	digest, err := hex.DecodeString(signature)
	if err != nil {
		return ParsedSignature{}, false
	}
	return ParsedSignature{Timestamp: seconds, Signature: digest}, true
}

func digest(secret string, timestamp int64, body []byte) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strconv.FormatInt(timestamp, 10)))
	mac.Write([]byte("."))
	mac.Write(body)
	return mac.Sum(nil)
}

// SignWebhookBody produces the header value Fletch would send for this body.
func SignWebhookBody(secret string, body []byte, timestamp int64) string {
	return "t=" + strconv.FormatInt(timestamp, 10) + ",v1=" + hex.EncodeToString(digest(secret, timestamp, body))
}

// Verify reports whether header signs body with secret and its timestamp is
// within tolerance of now. Pass the raw request bytes, never a re-serialized
// struct: a reordered key or a changed space changes the digest.
func Verify(secret, header string, body []byte, tolerance time.Duration, now time.Time) bool {
	parsed, ok := ParseSignatureHeader(header)
	if !ok {
		return false
	}
	age := now.Unix() - parsed.Timestamp
	if age < 0 {
		age = -age
	}
	if age > int64(tolerance/time.Second) {
		return false
	}
	return hmac.Equal(parsed.Signature, digest(secret, parsed.Timestamp, body))
}

// VerifyNow is Verify against the clock with the default five-minute tolerance.
func VerifyNow(secret, header string, body []byte) bool {
	return Verify(secret, header, body, 5*time.Minute, time.Now())
}
