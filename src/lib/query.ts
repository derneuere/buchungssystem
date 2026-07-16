import { QueryClient } from '@tanstack/react-query'

// Minimale Query-Key-Factory für geteilten Admin-Code (StammdatenCrud u.a.).
// Konsistent mit der Inline-Konvention ['admin', <feature>, ...], damit die
// globale Invalidierung über das Präfix ['admin'] weiter greift.
export const adminKeys = {
  alle: ['admin'] as const,
  stammdaten: (collection: string) => ['admin', collection] as const,
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
