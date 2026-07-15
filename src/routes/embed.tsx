import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BuchungsWizard } from '@/components/booking/BuchungsWizard'
import { SpracheProvider } from '@/lib/sprache'

export const Route = createFileRoute('/embed')({ component: EmbedPage })

/**
 * Chromeless iFrame-Ziel für die TYPO3-Einbettung (SPEC §7). Meldet die
 * eigene Inhaltshöhe per postMessage an das Elternfenster, damit `embed.js`
 * (public/embed.js) das iFrame ohne inneren Scrollbalken dynamisch resizen
 * kann. Der ResizeObserver beobachtet `document.body` und feuert damit bei
 * Mount, jedem Layout-Resize UND jedem Wizard-Schrittwechsel (der Schrittinhalt
 * ändert die Höhe von `document.body`).
 */
function EmbedPage() {
  const { lang } = Route.useSearch()

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return

    const postHeight = () => {
      window.parent.postMessage(
        { type: 'gdw-buchung:resize', height: document.documentElement.scrollHeight },
        '*',
      )
    }

    postHeight()
    const ro = new ResizeObserver(postHeight)
    ro.observe(document.body)
    window.addEventListener('load', postHeight)

    return () => {
      ro.disconnect()
      window.removeEventListener('load', postHeight)
    }
  }, [])

  return (
    <SpracheProvider sprache={lang ?? 'de'}>
      <main className="bg-transparent">
        <BuchungsWizard showChrome={false} />
      </main>
    </SpracheProvider>
  )
}
