package main

import (
	"reflect"
	"testing"
)

func TestParseHHMM(t *testing.T) {
	cases := []struct {
		in   string
		want int
		ok   bool
	}{
		{"00:00", 0, true},
		{"09:30", 570, true},
		{"23:59", 1439, true},
		{"9:30", 0, false},   // wrong length
		{"24:00", 0, false},  // hour out of range
		{"12:60", 0, false},  // minute out of range
		{"ab:cd", 0, false},  // non-numeric
		{"1230", 0, false},   // missing colon
	}
	for _, c := range cases {
		got, ok := parseHHMM(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("parseHHMM(%q) = (%d,%v), want (%d,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestMinutesToHHMM(t *testing.T) {
	cases := map[int]string{0: "00:00", 570: "09:30", 1439: "23:59", 600: "10:00"}
	for in, want := range cases {
		if got := minutesToHHMM(in); got != want {
			t.Errorf("minutesToHHMM(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestOverlaps(t *testing.T) {
	cases := []struct {
		aVon, aBis, bVon, bBis int
		want                   bool
	}{
		{600, 690, 690, 780, false}, // back-to-back -> no overlap
		{600, 690, 660, 720, true},  // partial overlap
		{600, 720, 630, 660, true},  // b inside a
		{630, 660, 600, 720, true},  // a inside b
		{600, 690, 700, 760, false}, // disjoint
		{600, 690, 500, 590, false}, // disjoint before
	}
	for _, c := range cases {
		if got := overlaps(c.aVon, c.aBis, c.bVon, c.bBis); got != c.want {
			t.Errorf("overlaps(%d,%d,%d,%d) = %v, want %v", c.aVon, c.aBis, c.bVon, c.bBis, got, c.want)
		}
	}
}

// Puffer semantics: a slot at 12:00-13:30 with a 30-min buffer must collide with
// an existing 10:00-12:00 booking (its expanded window 11:30-14:00 overlaps).
func TestOverlapsMitPuffer(t *testing.T) {
	slotVon, slotBis := 12 * 60, 13*60+30
	puffer := 30
	bVon, bBis := 10*60, 12*60 // existing booking
	if !overlaps(slotVon-puffer, slotBis+puffer, bVon, bBis) {
		t.Errorf("expected collision with 30min puffer, got none")
	}
	// Without puffer they are back-to-back (12:00 == 12:00) -> no collision.
	if overlaps(slotVon, slotBis, bVon, bBis) {
		t.Errorf("expected no collision without puffer")
	}
}

func TestMergeIntervals(t *testing.T) {
	cases := []struct {
		in   []Interval
		want []Interval
	}{
		{nil, nil},
		{
			in:   []Interval{{540, 720}, {700, 780}}, // overlapping
			want: []Interval{{540, 780}},
		},
		{
			in:   []Interval{{540, 600}, {600, 660}}, // touching -> merge
			want: []Interval{{540, 660}},
		},
		{
			in:   []Interval{{800, 900}, {540, 600}}, // unsorted, disjoint
			want: []Interval{{540, 600}, {800, 900}},
		},
		{
			in:   []Interval{{540, 540}, {600, 660}}, // empty dropped
			want: []Interval{{600, 660}},
		},
	}
	for i, c := range cases {
		got := mergeIntervals(c.in)
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("case %d: mergeIntervals(%v) = %v, want %v", i, c.in, got, c.want)
		}
	}
}

func TestSubtractInterval(t *testing.T) {
	cases := []struct {
		base []Interval
		cut  Interval
		want []Interval
	}{
		{ // cut in the middle -> splits
			base: []Interval{{540, 720}},
			cut:  Interval{600, 660},
			want: []Interval{{540, 600}, {660, 720}},
		},
		{ // cut left edge
			base: []Interval{{540, 720}},
			cut:  Interval{500, 600},
			want: []Interval{{600, 720}},
		},
		{ // cut right edge
			base: []Interval{{540, 720}},
			cut:  Interval{700, 800},
			want: []Interval{{540, 700}},
		},
		{ // cut covers everything
			base: []Interval{{540, 720}},
			cut:  Interval{500, 800},
			want: []Interval{},
		},
		{ // no overlap -> unchanged
			base: []Interval{{540, 720}},
			cut:  Interval{800, 900},
			want: []Interval{{540, 720}},
		},
		{ // empty cut -> unchanged
			base: []Interval{{540, 720}},
			cut:  Interval{600, 600},
			want: []Interval{{540, 720}},
		},
	}
	for i, c := range cases {
		got := subtractInterval(c.base, c.cut)
		if len(got) == 0 && len(c.want) == 0 {
			continue
		}
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("case %d: subtractInterval(%v, %v) = %v, want %v", i, c.base, c.cut, got, c.want)
		}
	}
}
