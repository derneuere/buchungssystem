// Geteilte Badge-Komponenten für Referent:innen-Kandidat:innen: Eignung
// (geeignet/eingeschränkt/Konflikt) und relative Auslastung (über/im/unter ⌀).
// Werden im BestaetigenDialog und in der Referent:innen-Planung identisch genutzt.

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReferentKandidat } from '@/lib/types'

export function EignungBadge({ k }: { k: ReferentKandidat }) {
  if (k.warnstufe === 'hart') {
    return (
      <Badge
        variant="outline"
        className="border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        Konflikt
      </Badge>
    )
  }
  if (k.warnstufe === 'weich') {
    const grund = !k.themaMatch ? 'Thema nicht hinterlegt' : 'außerhalb der Verfügbarkeit'
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        title={grund}
      >
        eingeschränkt
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    >
      geeignet
    </Badge>
  )
}

export function AuslastungBadge({ rel }: { rel: ReferentKandidat['auslastung_relativ'] }) {
  const map = {
    ueber: {
      label: 'über ⌀',
      cls: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    unter: {
      label: 'unter ⌀',
      cls: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
    },
    schnitt: { label: 'im ⌀', cls: 'text-muted-foreground' },
  }[rel]
  return (
    <Badge variant="outline" className={cn('shrink-0', map.cls)}>
      {map.label}
    </Badge>
  )
}
