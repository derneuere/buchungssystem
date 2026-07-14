// /admin/verfuegbarkeiten — Verwaltung der Verfügbarkeiten, filterbar nach
// Referent:in (SPEC §5.2). Nutzt dieselbe Manager-Komponente wie die
// Referenten-Detailseite.

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Referent } from '@/lib/types'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VerfuegbarkeitenManager } from '@/components/admin/VerfuegbarkeitenManager'

export const Route = createFileRoute('/admin/_authenticated/verfuegbarkeiten')({
  component: VerfuegbarkeitenPage,
})

function VerfuegbarkeitenPage() {
  const referentenQuery = useQuery({
    queryKey: ['admin', 'referenten', 'alle'],
    queryFn: () => pb.collection('referenten').getFullList<Referent>({ sort: 'name' }),
  })

  const [referentId, setReferentId] = useState<string>('')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verfügbarkeiten</h1>
        <p className="text-sm text-muted-foreground">
          Wochenmuster und Ausnahmen je Referent:in. Zur Bearbeitung bitte zunächst eine Person auswählen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referent:in wählen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referentenQuery.isLoading ? (
            <Skeleton className="h-10 w-72" />
          ) : (
            <div className="max-w-sm space-y-2">
              <Label htmlFor="verf-referent-filter">Referent:in</Label>
              <Select value={referentId} onValueChange={setReferentId}>
                <SelectTrigger id="verf-referent-filter">
                  <SelectValue placeholder="Referent:in wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(referentenQuery.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {!r.aktiv ? ' (inaktiv)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {referentId ? (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <CardDescription>
                  Verfügbarkeiten von {referentenQuery.data?.find((r) => r.id === referentId)?.name}
                </CardDescription>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/referenten/$id" params={{ id: referentId }}>
                    <ExternalLink className="h-4 w-4" />
                    Zum Referent:innen-Profil
                  </Link>
                </Button>
              </div>
              <VerfuegbarkeitenManager referentId={referentId} />
            </div>
          ) : (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              Bitte oben eine Person auswählen, um Verfügbarkeiten anzuzeigen oder zu bearbeiten.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
