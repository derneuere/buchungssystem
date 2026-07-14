// Package main — service_ratelimit.go
//
// In-memory sliding-window rate limiter keyed by a hashed client IP (SPEC
// §4.3.4 — no Redis). Two windows are enforced simultaneously (e.g. 5/10min +
// 20/day). The plaintext IP is never stored or logged — only its SHA-256 hash.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// IPRateLimiter is a thread-safe two-window sliding-window limiter.
type IPRateLimiter struct {
	mu          sync.Mutex
	hits        map[string][]time.Time
	shortLimit  int
	shortWindow time.Duration
	longLimit   int
	longWindow  time.Duration
	lastSweep   time.Time
}

// NewIPRateLimiter builds a limiter enforcing shortLimit per shortWindow AND
// longLimit per longWindow.
func NewIPRateLimiter(shortLimit int, shortWindow time.Duration, longLimit int, longWindow time.Duration) *IPRateLimiter {
	return &IPRateLimiter{
		hits:        make(map[string][]time.Time),
		shortLimit:  shortLimit,
		shortWindow: shortWindow,
		longLimit:   longLimit,
		longWindow:  longWindow,
		lastSweep:   time.Now(),
	}
}

// hashKey returns the hex SHA-256 of the raw key (IP), so plaintext never lands
// in the map or any log line.
func hashKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// Allow records an attempt for key and reports whether it is permitted. When
// denied, retryAfterSeconds is the whole-second wait until the earliest window
// frees up.
func (rl *IPRateLimiter) Allow(rawKey string) (bool, int) {
	key := hashKey(rawKey)
	now := time.Now()

	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.sweepLocked(now)

	// prune this key's hits older than the long window
	kept := rl.hits[key][:0]
	for _, t := range rl.hits[key] {
		if now.Sub(t) < rl.longWindow {
			kept = append(kept, t)
		}
	}

	shortCount := 0
	var oldestShort, oldestLong time.Time
	for _, t := range kept {
		if now.Sub(t) < rl.shortWindow {
			if oldestShort.IsZero() || t.Before(oldestShort) {
				oldestShort = t
			}
			shortCount++
		}
		if oldestLong.IsZero() || t.Before(oldestLong) {
			oldestLong = t
		}
	}
	longCount := len(kept)

	if shortCount >= rl.shortLimit {
		rl.hits[key] = kept
		retry := int(rl.shortWindow.Seconds()) - int(now.Sub(oldestShort).Seconds())
		if retry < 1 {
			retry = 1
		}
		return false, retry
	}
	if longCount >= rl.longLimit {
		rl.hits[key] = kept
		retry := int(rl.longWindow.Seconds()) - int(now.Sub(oldestLong).Seconds())
		if retry < 1 {
			retry = 1
		}
		return false, retry
	}

	kept = append(kept, now)
	rl.hits[key] = kept
	return true, 0
}

// sweepLocked periodically drops empty/expired keys to bound memory. Caller
// must hold the mutex.
func (rl *IPRateLimiter) sweepLocked(now time.Time) {
	if now.Sub(rl.lastSweep) < rl.longWindow {
		return
	}
	rl.lastSweep = now
	for k, ts := range rl.hits {
		alive := ts[:0]
		for _, t := range ts {
			if now.Sub(t) < rl.longWindow {
				alive = append(alive, t)
			}
		}
		if len(alive) == 0 {
			delete(rl.hits, k)
		} else {
			rl.hits[k] = alive
		}
	}
}

// Middleware returns a route middleware that enforces the limit and answers 429
// with {retry_after_sekunden} when exceeded (SPEC §4.3.4).
func (rl *IPRateLimiter) Middleware() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		ok, retry := rl.Allow(e.RealIP())
		if !ok {
			return e.JSON(http.StatusTooManyRequests, map[string]any{
				"error":               "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
				"retry_after_sekunden": retry,
			})
		}
		return e.Next()
	}
}
