package main

import "testing"

func TestBenoetigteReferenten(t *testing.T) {
	cases := []struct {
		name                          string
		minRef, betreuung, gruppe int
		want                          int
	}{
		{"betreuungsschluessel leer -> nur min", 1, 0, 30, 1},
		{"betreuungsschluessel leer, min 2", 2, 0, 100, 2},
		{"schluessel greift: ceil(30/15)=2", 1, 15, 30, 2},
		{"schluessel greift: ceil(31/15)=3", 1, 15, 31, 3},
		{"min gewinnt gegen schluessel", 3, 15, 10, 3},
		{"schluessel gewinnt gegen min", 1, 10, 45, 5},
		{"min < 1 wird auf 1 angehoben", 0, 0, 5, 1},
		{"exakte teilung ceil(30/10)=3", 1, 10, 30, 3},
		{"gruppe 1, schluessel 15 -> 1", 1, 15, 1, 1},
	}
	for _, c := range cases {
		if got := BenoetigteReferenten(c.minRef, c.betreuung, c.gruppe); got != c.want {
			t.Errorf("%s: BenoetigteReferenten(%d,%d,%d) = %d, want %d",
				c.name, c.minRef, c.betreuung, c.gruppe, got, c.want)
		}
	}
}

func TestItoa(t *testing.T) {
	cases := map[int]string{0: "0", 5: "5", 42: "42", -7: "-7", 1000: "1000"}
	for in, want := range cases {
		if got := itoa(in); got != want {
			t.Errorf("itoa(%d) = %q, want %q", in, got, want)
		}
	}
}
