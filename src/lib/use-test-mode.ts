// QA-/Testmodus-Hooks. `useTestStatus` fragt GET /api/test/status ab; läuft der
// Server ohne TEST_MODE (Produktion), liefert die Route 404 → `data` bleibt
// `undefined`, und alles Testmodus-Bezogene (Nav-Eintrag, Banner) bleibt
// unsichtbar. `useJetzt` liefert das simulierte „Jetzt", das clientseitig
// weitertickt; Fallback ist die echte Zeit.

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { testStatus } from './api'
import { isAuthenticated } from './pocketbase'
import type { TestStatus } from './types'

export const TEST_STATUS_KEY = ['test', 'status'] as const

export function useTestStatus() {
  return useQuery<TestStatus>({
    queryKey: TEST_STATUS_KEY,
    queryFn: testStatus,
    enabled: isAuthenticated(),
    retry: false, // 404 (TEST_MODE aus) / 401 NICHT wiederholen
    throwOnError: false, // Fehler nicht werfen → data bleibt undefined
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Simuliertes „Jetzt", das clientseitig weitertickt (Offset auf die reale Zeit
 * addiert). Ohne aktiven Testmodus die echte Zeit. Der interne 30-Sekunden-Tick
 * hält datumsabhängige Ableitungen (z.B. Ist-Erfassungs-Freischaltung) aktuell.
 */
export function useJetzt(): Date {
  const { data } = useTestStatus()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  if (data?.test_mode) {
    return new Date(Date.now() + data.offset_sekunden * 1000)
  }
  return new Date()
}
