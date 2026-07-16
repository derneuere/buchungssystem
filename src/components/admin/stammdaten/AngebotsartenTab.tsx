// Stammdaten-Tab „Angebotsarten" (SPEC §2.3/§5.2) — Sheet-Formular inkl.
// Zeitslot-Chip-Editor; Tabelle/CRUD-Plumbing kommt aus StammdatenCrud.

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import type { Angebotsart } from '@/lib/types'
import { adminKeys } from '@/lib/query'
import { formatDauer } from '@/lib/admin-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { StammdatenCrud, type StammdatenConfig } from './StammdatenCrud'

const ZEITSLOT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

type Form = {
  name: string
  name_en: string
  slug: string
  beschreibung: string
  beschreibung_en: string
  dauer_minuten: string
  benoetigt_raum: boolean
  min_teilnehmer: string
  max_teilnehmer: string
  min_referenten: string
  betreuungsschluessel: string
  zeitslots: string[]
  max_gruppen_parallel_pro_tag: string
  sort_order: string
  aktiv: boolean
}

function ZeitslotsEditor({ form, setForm }: { form: Form; setForm: Dispatch<SetStateAction<Form>> }) {
  const [neuerSlot, setNeuerSlot] = useState('')

  function handleAddSlot() {
    const trimmed = neuerSlot.trim()
    if (!ZEITSLOT_REGEX.test(trimmed)) {
      toast.error('Bitte eine Uhrzeit im Format HH:MM angeben (z.B. 09:00).')
      return
    }
    if (form.zeitslots.includes(trimmed)) {
      setNeuerSlot('')
      return
    }
    setForm((f) => ({ ...f, zeitslots: [...f.zeitslots, trimmed].sort() }))
    setNeuerSlot('')
  }

  return (
    <div className="space-y-2">
      <Label>Zeitslots (Startzeiten, Berliner Lokalzeit) *</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
        {form.zeitslots.length === 0 && <span className="text-sm text-muted-foreground">Noch keine Zeitslots.</span>}
        {form.zeitslots.map((slot) => (
          <Badge key={slot} variant="secondary" className="gap-1 pr-1">
            {slot}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, zeitslots: f.zeitslots.filter((s) => s !== slot) }))}
              aria-label={`Zeitslot ${slot} entfernen`}
              className="rounded-full hover:bg-background/50"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input type="time" value={neuerSlot} onChange={(e) => setNeuerSlot(e.target.value)} className="w-32" />
        <Button type="button" variant="outline" size="sm" onClick={handleAddSlot}>
          <Plus className="h-4 w-4" />
          Hinzufügen
        </Button>
      </div>
    </div>
  )
}

function FormFields({ form, setForm }: { form: Form; setForm: Dispatch<SetStateAction<Form>> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aa-name">Name *</Label>
          <Input id="aa-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aa-slug">Slug *</Label>
          <Input
            id="aa-slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="z.B. fuehrung"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="aa-name-en">Name (Englisch) — optional</Label>
        <Input
          id="aa-name-en"
          value={form.name_en}
          onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Wird in der englischen Buchungsansicht (?lang=en) angezeigt. Leer = deutscher Name.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="aa-beschreibung">Beschreibung</Label>
        <Textarea
          id="aa-beschreibung"
          rows={2}
          value={form.beschreibung}
          onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="aa-beschreibung-en">Beschreibung (Englisch) — optional</Label>
        <Textarea
          id="aa-beschreibung-en"
          rows={2}
          value={form.beschreibung_en}
          onChange={(e) => setForm((f) => ({ ...f, beschreibung_en: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aa-dauer">Dauer (Minuten) *</Label>
          <Input
            id="aa-dauer"
            type="number"
            min={15}
            value={form.dauer_minuten}
            onChange={(e) => setForm((f) => ({ ...f, dauer_minuten: e.target.value }))}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch
            id="aa-raum"
            checked={form.benoetigt_raum}
            onCheckedChange={(v) => setForm((f) => ({ ...f, benoetigt_raum: v }))}
          />
          <Label htmlFor="aa-raum" className="cursor-pointer font-normal">
            Benötigt Raum
          </Label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aa-min-teilnehmer">Min. Teilnehmer</Label>
          <Input
            id="aa-min-teilnehmer"
            type="number"
            min={1}
            value={form.min_teilnehmer}
            onChange={(e) => setForm((f) => ({ ...f, min_teilnehmer: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aa-max-teilnehmer">Max. Teilnehmer *</Label>
          <Input
            id="aa-max-teilnehmer"
            type="number"
            min={1}
            value={form.max_teilnehmer}
            onChange={(e) => setForm((f) => ({ ...f, max_teilnehmer: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aa-min-referenten">Min. Referenten (Basisbedarf) *</Label>
          <Input
            id="aa-min-referenten"
            type="number"
            min={1}
            value={form.min_referenten}
            onChange={(e) => setForm((f) => ({ ...f, min_referenten: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aa-betreuungsschluessel">Betreuungsschlüssel</Label>
          <Input
            id="aa-betreuungsschluessel"
            type="number"
            min={1}
            value={form.betreuungsschluessel}
            onChange={(e) => setForm((f) => ({ ...f, betreuungsschluessel: e.target.value }))}
            placeholder="Teilnehmer je Referent:in"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Benötigte Referent:innen = max(Basisbedarf, Gruppengröße ÷ Betreuungsschlüssel, aufgerundet). Leer = nur
        Basisbedarf.
      </p>

      <ZeitslotsEditor form={form} setForm={setForm} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aa-parallel">Max. parallele Gruppen/Tag</Label>
          <Input
            id="aa-parallel"
            type="number"
            min={1}
            value={form.max_gruppen_parallel_pro_tag}
            onChange={(e) => setForm((f) => ({ ...f, max_gruppen_parallel_pro_tag: e.target.value }))}
            placeholder="leer = globaler Default"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aa-sort">Reihenfolge</Label>
          <Input
            id="aa-sort"
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="aa-aktiv"
          checked={form.aktiv}
          onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))}
        />
        <Label htmlFor="aa-aktiv" className="cursor-pointer font-normal">
          Aktiv (im öffentlichen Formular buchbar)
        </Label>
      </div>
    </>
  )
}

const config: StammdatenConfig<Angebotsart, Form> = {
  collection: 'angebotsarten',
  queryKey: adminKeys.stammdaten('angebotsarten'),
  sort: 'sort_order,name',
  texte: {
    beschreibung: 'Führung, Seminar & Co.: Dauer, Raumbedarf, Bedarfsformel, Zeitslots.',
    neuButton: 'Neue Angebotsart',
    dialogNeu: 'Neue Angebotsart',
    dialogBearbeiten: 'Angebotsart bearbeiten',
    leer: 'Noch keine Angebotsarten angelegt.',
    erstellt: 'Angebotsart angelegt.',
    aktualisiert: 'Angebotsart aktualisiert.',
    geloescht: 'Angebotsart gelöscht.',
  },
  spalten: [
    {
      header: 'Name',
      className: 'font-medium',
      render: (a) => (
        <>
          {a.name}
          <div className="text-xs text-muted-foreground">{a.slug}</div>
        </>
      ),
    },
    { header: 'Dauer', render: (a) => formatDauer(a.dauer_minuten) },
    { header: 'Raum', render: (a) => (a.benoetigt_raum ? 'ja' : 'nein') },
    { header: 'Teilnehmer', render: (a) => `${a.min_teilnehmer ?? 1}–${a.max_teilnehmer}` },
    {
      header: 'Referentenbedarf',
      render: (a) => `min. ${a.min_referenten}${a.betreuungsschluessel ? `, 1 je ${a.betreuungsschluessel} Teiln.` : ''}`,
    },
    {
      header: 'Zeitslots',
      className: 'max-w-[12rem]',
      render: (a) => (
        <div className="flex flex-wrap gap-1">
          {a.zeitslots?.slice(0, 4).map((s) => (
            <Badge key={s} variant="outline" className="text-xs">
              {s}
            </Badge>
          ))}
          {a.zeitslots && a.zeitslots.length > 4 && (
            <span className="text-xs text-muted-foreground">+{a.zeitslots.length - 4}</span>
          )}
        </div>
      ),
    },
  ],
  emptyForm: () => ({
    name: '',
    name_en: '',
    slug: '',
    beschreibung: '',
    beschreibung_en: '',
    dauer_minuten: '60',
    benoetigt_raum: false,
    min_teilnehmer: '',
    max_teilnehmer: '30',
    min_referenten: '1',
    betreuungsschluessel: '',
    zeitslots: [],
    max_gruppen_parallel_pro_tag: '',
    sort_order: '0',
    aktiv: true,
  }),
  toForm: (a) => ({
    name: a.name,
    name_en: a.name_en ?? '',
    slug: a.slug,
    beschreibung: a.beschreibung ?? '',
    beschreibung_en: a.beschreibung_en ?? '',
    dauer_minuten: String(a.dauer_minuten),
    benoetigt_raum: a.benoetigt_raum,
    min_teilnehmer: a.min_teilnehmer != null ? String(a.min_teilnehmer) : '',
    max_teilnehmer: String(a.max_teilnehmer),
    min_referenten: String(a.min_referenten),
    betreuungsschluessel: a.betreuungsschluessel != null ? String(a.betreuungsschluessel) : '',
    zeitslots: [...(a.zeitslots ?? [])],
    max_gruppen_parallel_pro_tag:
      a.max_gruppen_parallel_pro_tag != null ? String(a.max_gruppen_parallel_pro_tag) : '',
    sort_order: String(a.sort_order ?? 0),
    aktiv: a.aktiv,
  }),
  validate: (form) => {
    if (!form.name.trim() || !form.slug.trim()) return 'Bitte Name und Slug angeben.'
    const dauer = Number(form.dauer_minuten)
    if (!Number.isFinite(dauer) || dauer < 15) return 'Dauer muss mindestens 15 Minuten betragen.'
    const maxTeilnehmer = Number(form.max_teilnehmer)
    if (!Number.isFinite(maxTeilnehmer) || maxTeilnehmer < 1) return 'Maximale Teilnehmerzahl muss mindestens 1 sein.'
    const minReferenten = Number(form.min_referenten)
    if (!Number.isFinite(minReferenten) || minReferenten < 1) return 'Mindestens 1 Referent:in erforderlich (Basisbedarf).'
    if (form.zeitslots.length === 0) return 'Bitte mindestens einen Zeitslot hinzufügen.'
    return null
  },
  toBody: (form) => ({
    name: form.name.trim(),
    name_en: form.name_en.trim(),
    slug: form.slug.trim(),
    beschreibung: form.beschreibung.trim() || undefined,
    beschreibung_en: form.beschreibung_en.trim(),
    dauer_minuten: Number(form.dauer_minuten),
    benoetigt_raum: form.benoetigt_raum,
    min_teilnehmer: form.min_teilnehmer ? Number(form.min_teilnehmer) : undefined,
    max_teilnehmer: Number(form.max_teilnehmer),
    min_referenten: Number(form.min_referenten),
    betreuungsschluessel: form.betreuungsschluessel ? Number(form.betreuungsschluessel) : undefined,
    zeitslots: form.zeitslots,
    max_gruppen_parallel_pro_tag: form.max_gruppen_parallel_pro_tag
      ? Number(form.max_gruppen_parallel_pro_tag)
      : undefined,
    sort_order: Number(form.sort_order) || 0,
    aktiv: form.aktiv,
  }),
  FormFields,
  aktivToggle: true,
  editorVariante: 'sheet',
  deleteTitle: (a) => `„${a.name}" löschen?`,
  deleteDescription: () =>
    'Falls die Angebotsart noch in Buchungen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren.',
  deleteFehlerRessource: 'Angebotsart',
}

export function AngebotsartenTab() {
  return <StammdatenCrud config={config} />
}
