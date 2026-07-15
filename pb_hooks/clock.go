// Package main — clock.go
//
// Server-„Uhr" für den QA-/Testmodus. jetzt() liefert das „Geschäfts-Heute":
// im Normalbetrieb hart time.Now(); nur bei aktivem TEST_MODE wird ein
// atomarer Offset addiert, sodass die Zeit ab dem gesetzten Punkt normal
// weiterläuft (kein eingefrorenes Datum). Das Gating ist doppelt: ist
// TEST_MODE aus, ignoriert jetzt() den Offset vollständig (Produktion bleibt
// garantiert unbeeinflusst) und die Test-Routen werden gar nicht registriert.
package main

import (
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// clockOffsetSec ist die simulierte Zeitverschiebung in Sekunden (atomar
// gelesen/geschrieben, damit HTTP-Handler und Cron sie gefahrlos teilen).
var clockOffsetSec int64

// testModeAktiv ist true nur bei TEST_MODE == "true" oder "1".
func testModeAktiv() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("TEST_MODE")))
	return v == "true" || v == "1"
}

// jetzt liefert das „Geschäfts-Heute". Ohne Testmodus immer die echte Zeit;
// der Offset wird dann bewusst ignoriert (harte Gate).
func jetzt() time.Time {
	if !testModeAktiv() {
		return time.Now()
	}
	return time.Now().Add(time.Duration(atomic.LoadInt64(&clockOffsetSec)) * time.Second)
}

// setJetztOffsetSekunden setzt die simulierte Verschiebung (Sekunden).
func setJetztOffsetSekunden(sek int64) { atomic.StoreInt64(&clockOffsetSec, sek) }

// aktuellerOffsetSekunden liest die aktuelle Verschiebung.
func aktuellerOffsetSekunden() int64 { return atomic.LoadInt64(&clockOffsetSec) }

// resetJetzt setzt die Uhr auf Echtzeit zurück (Offset = 0).
func resetJetzt() { atomic.StoreInt64(&clockOffsetSec, 0) }
