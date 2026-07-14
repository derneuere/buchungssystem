package main

import "testing"

func TestSanitize(t *testing.T) {
	cases := []struct {
		name   string
		in     string
		maxLen int
		want   string
	}{
		{"strips html tags", "Hallo <script>alert(1)</script>Welt", 0, "Hallo alert(1)Welt"},
		{"strips angle content", "<b>fett</b>", 0, "fett"},
		{"trims whitespace", "  Text  ", 0, "Text"},
		{"removes control chars", "a\x00b\x07c", 0, "abc"},
		{"keeps newline and tab", "a\nb\tc", 0, "a\nb\tc"},
		{"caps length", "abcdefgh", 3, "abc"},
		{"plain text untouched", "Klasse 10b, Musterschule", 0, "Klasse 10b, Musterschule"},
	}
	for _, c := range cases {
		if got := sanitize(c.in, c.maxLen); got != c.want {
			t.Errorf("%s: sanitize(%q,%d) = %q, want %q", c.name, c.in, c.maxLen, got, c.want)
		}
	}
}

func TestSlotGehoertZuAngebot(t *testing.T) {
	// Indirect: parseStart + local minute matching are exercised via a real
	// record in integration; here we only cover parseStart robustness.
	if _, err := parseStart("2026-08-01T10:00:00Z"); err != nil {
		t.Errorf("parseStart RFC3339 failed: %v", err)
	}
	if _, err := parseStart("not-a-date"); err == nil {
		t.Errorf("parseStart should reject garbage")
	}
}
