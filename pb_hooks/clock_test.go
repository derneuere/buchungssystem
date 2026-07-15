package main

import (
	"testing"
	"time"
)

// TestJetztOhneTestmodus: ohne TEST_MODE ignoriert jetzt() jeden Offset und
// liefert die echte Zeit (harte Gate → Produktion unbeeinflusst).
func TestJetztOhneTestmodus(t *testing.T) {
	// TEST_MODE ist in diesem Testprozess nicht gesetzt.
	setJetztOffsetSekunden(9_999_999)
	defer resetJetzt()

	diff := time.Since(jetzt())
	if diff < 0 {
		diff = -diff
	}
	if diff > 2*time.Second {
		t.Fatalf("jetzt() weicht ohne TEST_MODE von time.Now() ab: %v", diff)
	}
	if !testModeAktiv() {
		// ok — erwartet
	} else {
		t.Fatalf("testModeAktiv() sollte ohne TEST_MODE false sein")
	}
}

// TestJetztMitOffset: mit TEST_MODE=true wirkt der Offset (jetzt() ≈ now+10d),
// und resetJetzt() stellt Echtzeit wieder her.
func TestJetztMitOffset(t *testing.T) {
	t.Setenv("TEST_MODE", "true")
	defer resetJetzt()

	if !testModeAktiv() {
		t.Fatalf("testModeAktiv() sollte mit TEST_MODE=true true sein")
	}

	zehnTage := int64(10 * 24 * 60 * 60)
	setJetztOffsetSekunden(zehnTage)

	erwartet := time.Now().Add(10 * 24 * time.Hour)
	diff := erwartet.Sub(jetzt())
	if diff < 0 {
		diff = -diff
	}
	if diff > 2*time.Second {
		t.Fatalf("jetzt() mit +10d Offset weicht ab: %v", diff)
	}

	resetJetzt()
	diff = time.Since(jetzt())
	if diff < 0 {
		diff = -diff
	}
	if diff > 2*time.Second {
		t.Fatalf("jetzt() nach resetJetzt() sollte Echtzeit sein, weicht ab: %v", diff)
	}
}
