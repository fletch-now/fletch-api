package fletchwebhook

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type vector struct {
	Name             string `json:"name"`
	Secret           string `json:"secret"`
	Header           string `json:"header"`
	Body             string `json:"body"`
	Now              int64  `json:"now"`
	ToleranceSeconds int64  `json:"toleranceSeconds"`
	Valid            bool   `json:"valid"`
	Reason           string `json:"reason"`
}

func loadVectors(t *testing.T) []vector {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "fixtures", "vectors.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Vectors []vector `json:"vectors"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	return file.Vectors
}

func TestVectors(t *testing.T) {
	for _, v := range loadVectors(t) {
		t.Run(v.Name, func(t *testing.T) {
			got := Verify(v.Secret, v.Header, []byte(v.Body), time.Duration(v.ToleranceSeconds)*time.Second, time.Unix(v.Now, 0))
			if got != v.Valid {
				t.Fatalf("got %v, want %v: %s", got, v.Valid, v.Reason)
			}
		})
	}
}

func TestSignRoundTrip(t *testing.T) {
	header := SignWebhookBody("whsec_test", []byte(`{"id":"dl_1"}`), 1789200000)
	if !Verify("whsec_test", header, []byte(`{"id":"dl_1"}`), 5*time.Minute, time.Unix(1789200010, 0)) {
		t.Fatal("own signature did not verify")
	}
	if Verify("whsec_test", header, []byte(`{"id":"dl_2"}`), 5*time.Minute, time.Unix(1789200010, 0)) {
		t.Fatal("a different body verified")
	}
}
