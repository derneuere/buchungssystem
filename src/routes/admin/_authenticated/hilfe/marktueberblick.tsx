// /admin/marktueberblick — statischer Marktüberblick: ähnliche OSS-/SaaS-
// Buchungslösungen im Vergleich zum GDW-Buchungssystem. Reine Frontend-Seite
// ohne Backend; die Vergleichsdaten liegen als statische Konstante vor.
// Sichtbar für Personal (leitung/mitarbeiter), nicht für 'auskunft'.

import { Fragment, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ExternalLink, Scale } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/admin/_authenticated/hilfe/marktueberblick')({
  component: MarktueberblickPage,
})

type Art = 'oss' | 'saas' | 'beides'
type Merkmal = 'ja' | 'nein' | 'teilweise' | 'unbekannt'
type Relevanz = 'hoch' | 'mittel' | 'niedrig'

type Tool = {
  name: string
  art: Art
  fokus: string
  self_hosting: Merkmal
  mehrsprachig: Merkmal
  einbettbar: Merkmal
  gruppen_events: Merkmal
  ressourcen_personal: Merkmal
  preis: string
  lizenz: string
  relevanz_gdw: Relevanz
  bewertung: string
  quelle: string
}

// Statische Vergleichsdaten (Stand: Juli 2026). Preise/Features können sich
// jederzeit ändern — vor einer Entscheidung bitte an der Quelle prüfen.
const TOOLS: Tool[] = [
  {
    name: 'pretix',
    art: 'beides',
    fokus:
      'Event-Ticketing/Anmeldung für Konferenzen, Workshops, Museen; kapazitäts- und zeitslotbasiert. Deutscher Anbieter (rami.io, Berlin).',
    self_hosting: 'ja',
    mehrsprachig: 'ja',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'teilweise',
    preis:
      'Community-Edition gratis (self-host, Infra ~5-20 €/Mon.); Hosted (SaaS) 2,5 %/Ticket, max. 15 €; Enterprise-Plugins ab 499 €/Jahr',
    lizenz: 'AGPLv3 (mit Zusatzbedingungen); einzelne Plugins proprietär',
    relevanz_gdw: 'hoch',
    bewertung:
      'Bester Gesamt-Fit: deutsch, self-hostbar (EU/DSGVO), offizielles JS-Einbett-Widget + WordPress-Plugin, DE/EN, Zeitfenster-/Kontingent-Events und Gruppenprodukte. Schwäche: keine native Raum-/Referentenplanung (Sitzpläne nur Enterprise), stärker ticketing- als terminplanungsorientiert.',
    quelle: 'https://pretix.eu',
  },
  {
    name: 'Regiondo',
    art: 'saas',
    fokus:
      'Buchungssystem für Touren, Aktivitäten, Museen und Events; Freizeit-/Tourismusbranche. Europäischer Anbieter (München).',
    self_hosting: 'nein',
    mehrsprachig: 'ja',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'teilweise',
    preis:
      'SaaS ab 59 €/Mon. (Starter), Advanced ~117 €, Enterprise ~234 €/Mon., plus Transaktionsgebühren',
    lizenz: 'proprietär',
    relevanz_gdw: 'hoch',
    bewertung:
      'Inhaltlich am nächsten am Museums-/Führungs-Use-Case: Zeitfenster-Tickets, Besucherstromsteuerung, einbettbares Widget, EU-Anbieter. Schwäche: reines SaaS ohne self-host, laufende Kosten + Transaktionsgebühren, Referenten-/Personalzuordnung schwach dokumentiert.',
    quelle: 'https://pro.regiondo.com/industries/museum-events/',
  },
  {
    name: 'SimplyBook.me',
    art: 'saas',
    fokus:
      'Termin-, Klassen- und Gruppenbuchung für Dienstleister (Kurse, Touren, Beratungen). Anbieter in Zypern (EU, team.blue).',
    self_hosting: 'nein',
    mehrsprachig: 'ja',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'teilweise',
    preis:
      'Free (50 Buchungen/Mon.), Basic 13,9 €, Standard 29,9 €, Premium 59,9 €/Mon., Enterprise a.A.',
    lizenz: 'proprietär',
    relevanz_gdw: 'hoch',
    bewertung:
      "Nächste SaaS-Entsprechung: echte 'Classes' mit Kapazitätslimit, Instruktor-/Provider-Zuordnung, DE/EN-Widget, GDPR/ISO 27001. Schwäche: kein konfliktfreies Raummanagement (nur Custom-Feature), EU-Datenstandort erst im Enterprise-Tarif, kein self-host.",
    quelle: 'https://simplybook.me/en/pricing',
  },
  {
    name: 'Cal.com',
    art: 'beides',
    fokus:
      'Termin-/Meeting-Scheduling (Calendly-Alternative) mit Teams, Round-Robin und Zuweisung.',
    self_hosting: 'ja',
    mehrsprachig: 'ja',
    einbettbar: 'ja',
    gruppen_events: 'teilweise',
    ressourcen_personal: 'teilweise',
    preis:
      'Self-Host/Community gratis (AGPL); SaaS Free-Plan + Teams ab ~15 $/Nutzer/Mon.; einige Features nur Enterprise',
    lizenz: 'AGPLv3 (Enterprise-Teile kommerziell)',
    relevanz_gdw: 'hoch',
    bewertung:
      "Reifste OSS-Scheduling-Plattform mit Team-Zuweisung, DE/EN und flexiblem Embed-Widget. Schwäche: auf 1:1-/Team-Termine ausgelegt - Gruppen pro Slot nur über 'Seats', echte Raum-/Kapazitäts-/Seminarlogik fehlt und müsste nachgebaut werden.",
    quelle: 'https://cal.com',
  },
  {
    name: 'Indico',
    art: 'oss',
    fokus:
      'Institutionelles Event-Management (Konferenzen, Vorträge) inkl. Raumbuchungsmodul und Anmeldung; von CERN.',
    self_hosting: 'ja',
    mehrsprachig: 'ja',
    einbettbar: 'teilweise',
    gruppen_events: 'ja',
    ressourcen_personal: 'ja',
    preis: 'Kostenlos (Open Source, self-host)',
    lizenz: 'MIT',
    relevanz_gdw: 'mittel',
    bewertung:
      'Deckt Anmeldung, dediziertes Raumbuchungsmodul und Zeitpläne institutionell sehr umfassend ab, MIT-lizenziert, breit erprobt. Schwäche: schwergewichtig, akademisch geprägt und nicht als schlankes, in Fremd-Websites eingebettetes Buchungs-Frontend gedacht.',
    quelle: 'https://getindico.io',
  },
  {
    name: 'Acuity Scheduling (Squarespace)',
    art: 'saas',
    fokus:
      'Termin- und Kursbuchung für Dienstleister; Gruppenkurse/Workshops mit Kapazität und geteilten Ressourcen.',
    self_hosting: 'nein',
    mehrsprachig: 'teilweise',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'ja',
    preis:
      'Keine Free-Version (Test); Starter ~20 $, Standard ~34 $, Premium ~61 $/Mon.; jährlich ~20 % günstiger',
    lizenz: 'proprietär',
    relevanz_gdw: 'mittel',
    bewertung:
      'Eines der wenigen SaaS-Tools mit geteilten Ressourcen (Konfliktsperre) plus Gruppenkurse mit Kapazität und Personal-Kalender - inhaltlich nah am GDW-Bedarf. Schwäche: US-Hosting unter Squarespace (EU-Datenschutz kritisch), begrenzte Mehrsprachigkeit der Buchungsseite, kein Gratis-Tarif.',
    quelle: 'https://acuityscheduling.com/features/class-scheduling',
  },
  {
    name: 'alf.io',
    art: 'beides',
    fokus:
      'Datenschutzorientiertes Event-/Ticket-Reservierungssystem für Konferenzen, Workshops und Meetups.',
    self_hosting: 'ja',
    mehrsprachig: 'ja',
    einbettbar: 'teilweise',
    gruppen_events: 'ja',
    ressourcen_personal: 'teilweise',
    preis: 'Kostenlos (Open Source, self-host); optional gehostete/Support-Angebote',
    lizenz: 'GPLv3',
    relevanz_gdw: 'mittel',
    bewertung:
      'Starker DSGVO-Fokus mit Kategorien/Kontingenten und Check-in, passend für Seminar-Anmeldung mit Kapazität. Schwäche: ticket-/reservierungszentriert, ohne echte Raum- und Referentenplanung, kleinere Community als pretix.',
    quelle: 'https://alf.io',
  },
  {
    name: 'LibreBooking',
    art: 'oss',
    fokus:
      'Ressourcen-/Raumreservierung (Konferenzräume, Geräte) mit Kalender, Kontingenten und Warteliste. Nachfolger von Booked/phpScheduleIt.',
    self_hosting: 'ja',
    mehrsprachig: 'ja',
    einbettbar: 'teilweise',
    gruppen_events: 'teilweise',
    ressourcen_personal: 'ja',
    preis: 'Kostenlos (Open Source)',
    lizenz: 'GPLv3',
    relevanz_gdw: 'mittel',
    bewertung:
      'Kernstärke Raum-/Ressourcenplanung mit Kollisionsvermeidung, Kontingenten und Wartelisten, kostenlos. Schwäche: technisch/optisch angestaubtes PHP-Portal, nicht als öffentlich einbettbares Buchungs-Frontend für Führungen/Seminare konzipiert, keine Referenten-Zuordnung.',
    quelle: 'https://github.com/LibreBooking/librebooking',
  },
  {
    name: 'Microsoft Bookings',
    art: 'saas',
    fokus:
      'Termin-/Dienstleistungsbuchung im Microsoft-365-Ökosystem, mit Personal-/Servicezuordnung und Gruppentermin-Typen.',
    self_hosting: 'nein',
    mehrsprachig: 'teilweise',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'ja',
    preis:
      'Kein Einzelpreis; in vielen Microsoft-365-Business-/Enterprise-Plänen enthalten (setzt M365-Abo voraus)',
    lizenz: 'proprietär',
    relevanz_gdw: 'mittel',
    bewertung:
      'Unterstützt Gruppenservices mit Kapazität, Personal-Zuordnung und iFrame-Einbettung; EU-Datenresidenz über eigenen M365-Tenant möglich. Schwäche: nur eine Sprache pro Buchungsseite (kein DE/EN-Umschalter), kein dediziertes Raummanagement, starke Bindung ans Microsoft-Ökosystem.',
    quelle: 'https://learn.microsoft.com/en-us/microsoft-365/bookings/service-types',
  },
  {
    name: 'Setmore',
    art: 'saas',
    fokus:
      'Termin- und Klassenbuchung für kleine Betriebe/Dienstleister mit öffentlicher Booking-Page.',
    self_hosting: 'nein',
    mehrsprachig: 'teilweise',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'teilweise',
    preis: 'Free (bis 4 Nutzer); Pro ab ~5 $/Nutzer/Mon., Team ab ~9 $/Nutzer/Mon.',
    lizenz: 'proprietär',
    relevanz_gdw: 'mittel',
    bewertung:
      'Klassenbuchung mit Kapazitätslimit, Personalzuordnung und einbettbarer Buchungsseite bei großzügigem Gratis-Tarif - solide für wiederkehrende Führungen/Kurse. Schwäche: kein dediziertes Raummanagement, begrenzte Mehrsprachigkeit, US-Hosting (EU-Datenschutz gesondert prüfen).',
    quelle: 'https://www.setmore.com/features/class-booking',
  },
  {
    name: 'Easy!Appointments',
    art: 'oss',
    fokus: 'Selbstgehosteter Termin-Scheduler mit Dienstleistungen und Anbietern (Providern).',
    self_hosting: 'ja',
    mehrsprachig: 'ja',
    einbettbar: 'ja',
    gruppen_events: 'nein',
    ressourcen_personal: 'teilweise',
    preis: 'Kostenlos (Open Source, self-host); WordPress-Plugin/Support teils kommerziell',
    lizenz: 'GPLv3',
    relevanz_gdw: 'mittel',
    bewertung:
      'Leichtgewichtig, per iFrame/WordPress leicht einbettbar, DE-Übersetzung (21+ Sprachen) und Anbieter-Kalender. Schwäche: klar auf 1:1-Termine ausgelegt - keine Gruppen-/Seminarbuchung mit Kapazität und keine Raumverwaltung.',
    quelle: 'https://easyappointments.org',
  },
  {
    name: 'Bookwhen',
    art: 'saas',
    fokus: 'Buchung für Kurse, Klassen, Workshops und Events; KMU-Fokus. Anbieter in UK.',
    self_hosting: 'nein',
    mehrsprachig: 'unbekannt',
    einbettbar: 'ja',
    gruppen_events: 'ja',
    ressourcen_personal: 'teilweise',
    preis: 'Free (bis 50 Buchungen/Mon.); kostenpflichtige Pläne gestaffelt nach Buchungsvolumen',
    lizenz: 'proprietär',
    relevanz_gdw: 'mittel',
    bewertung:
      'Auf Kurse/Workshops mit Terminreihen, Kapazität und einbettbarem Kalender-Widget ausgelegt - funktional nah an wiederkehrenden Seminaren. Schwäche: UK-Anbieter (Post-Brexit-EU-Datenschutz prüfen), Mehrsprachigkeit unklar, keine echte Raum-/Referentenplanung.',
    quelle: 'https://bookwhen.com',
  },
  {
    name: 'Calendly',
    art: 'saas',
    fokus:
      '1:1- und Team-Meeting-Scheduling (B2B), zusätzlich Group-Events (ein Host, viele Teilnehmende).',
    self_hosting: 'nein',
    mehrsprachig: 'teilweise',
    einbettbar: 'ja',
    gruppen_events: 'teilweise',
    ressourcen_personal: 'teilweise',
    preis:
      'Free; Standard ~10-12 $/Nutzer/Mon., Teams ~16-20 $/Nutzer/Mon., Enterprise a.A.',
    lizenz: 'proprietär',
    relevanz_gdw: 'niedrig',
    bewertung:
      'Bekannter Marktreferenzpunkt: Group-Event-Typ mit Platzlimit und sauberer Einbettung, ähnlich Info-Terminen. Für GDW schwacher Fit: meeting-/kalenderzentriert ohne Raum-/Ressourcenverwaltung, keine Seminarstruktur mit Referentenplanung, begrenzte Mehrsprachigkeit, US-Anbieter.',
    quelle: 'https://calendly.com/help/group-event-type-overview',
  },
]

const ART_LABEL: Record<Art, string> = {
  oss: 'OSS',
  saas: 'SaaS',
  beides: 'OSS + SaaS',
}

const MERKMAL_LABEL: Record<Merkmal, string> = {
  ja: 'Ja',
  nein: 'Nein',
  teilweise: 'Teilweise',
  unbekannt: 'Unbekannt',
}

const RELEVANZ_LABEL: Record<Relevanz, string> = {
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
}

function ArtBadge({ art }: { art: Art }) {
  const variant = art === 'oss' ? 'default' : art === 'saas' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{ART_LABEL[art]}</Badge>
}

function RelevanzBadge({ relevanz }: { relevanz: Relevanz }) {
  const cls =
    relevanz === 'hoch'
      ? 'border-transparent bg-emerald-600 text-white'
      : relevanz === 'mittel'
        ? 'border-transparent bg-amber-500 text-amber-950'
        : 'border-transparent bg-muted text-muted-foreground'
  return <Badge className={cls}>{RELEVANZ_LABEL[relevanz]}</Badge>
}

// Ja = grün, Teilweise = amber, Nein/Unbekannt = gedämpft.
function MerkmalCell({ wert }: { wert: Merkmal }) {
  const cls =
    wert === 'ja'
      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
      : wert === 'teilweise'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'
  return <span className={cls}>{MERKMAL_LABEL[wert]}</span>
}

function MarktueberblickPage() {
  const [offen, setOffen] = useState<Record<string, boolean>>({})
  const anzahlSpalten = 11

  function toggle(name: string) {
    setOffen((s) => ({ ...s, [name]: !s[name] }))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Marktüberblick — Buchungslösungen
          </h1>
          <p className="text-sm text-muted-foreground">
            Ähnliche Open-Source- und SaaS-Lösungen im Vergleich
          </p>
        </div>
      </div>

      <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Dieses eigenentwickelte Buchungssystem der Gedenkstätte Deutscher Widerstand deckt
          Führungen und Seminare mit Gruppenkapazität, Raum-/Ressourcenplanung und
          Referent:innen-Zuordnung ab. Der folgende Überblick stellt gängige Open-Source- und
          SaaS-Lösungen gegenüber, die einen ähnlichen Zweck erfüllen — als Einordnung, um Aufwand,
          Funktionsumfang und Datenschutz-Eignung der eigenen Lösung besser bewerten zu können.
        </p>
        <p>
          Die Auswahl reicht von reinen Terminplanern über Event-Ticketing bis zu
          Ressourcen-/Raumverwaltung. Bewertet wird jeweils die Relevanz für den GDW-Anwendungsfall
          (Gruppen, Räume, Personal, Mehrsprachigkeit, Einbettbarkeit, EU-Datenschutz). Klicken Sie
          eine Zeile an, um Fokus und ausführliche Einschätzung zu sehen.
        </p>
        <p className="text-xs">
          Stand: Juli 2026. Preise und Funktionen der Fremdanbieter können sich jederzeit ändern —
          verbindlich ist immer die jeweils verlinkte Quelle.
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="relative w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Self-Hosting</TableHead>
                <TableHead>Gruppen/Events</TableHead>
                <TableHead>Ressourcen + Personal</TableHead>
                <TableHead>Mehrsprachig</TableHead>
                <TableHead>Einbettbar</TableHead>
                <TableHead className="min-w-[220px]">Preis</TableHead>
                <TableHead className="min-w-[160px]">Lizenz</TableHead>
                <TableHead>Relevanz GDW</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TOOLS.map((tool) => {
                const istOffen = !!offen[tool.name]
                return (
                  <Fragment key={tool.name}>
                    <TableRow
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggle(tool.name)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggle(tool.name)
                        }
                      }}
                      aria-expanded={istOffen}
                    >
                      <TableCell className="font-medium">
                        <a
                          href={tool.quelle}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {tool.name}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <ArtBadge art={tool.art} />
                      </TableCell>
                      <TableCell>
                        <MerkmalCell wert={tool.self_hosting} />
                      </TableCell>
                      <TableCell>
                        <MerkmalCell wert={tool.gruppen_events} />
                      </TableCell>
                      <TableCell>
                        <MerkmalCell wert={tool.ressourcen_personal} />
                      </TableCell>
                      <TableCell>
                        <MerkmalCell wert={tool.mehrsprachig} />
                      </TableCell>
                      <TableCell>
                        <MerkmalCell wert={tool.einbettbar} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tool.preis}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tool.lizenz}</TableCell>
                      <TableCell>
                        <RelevanzBadge relevanz={tool.relevanz_gdw} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronDown
                          className={cn(
                            'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                            istOffen && 'rotate-180',
                          )}
                          aria-hidden="true"
                        />
                      </TableCell>
                    </TableRow>
                    {istOffen && (
                      <TableRow key={`${tool.name}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={anzahlSpalten} className="bg-muted/30">
                          <div className="space-y-3 py-1">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Fokus
                              </p>
                              <p className="mt-1 text-sm">{tool.fokus}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Einschätzung für GDW
                              </p>
                              <p className="mt-1 text-sm leading-relaxed">{tool.bewertung}</p>
                            </div>
                            <a
                              href={tool.quelle}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              {tool.quelle}
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {TOOLS.length} Lösungen im Vergleich. Legende: Grün = vorhanden, Amber = teilweise/
        eingeschränkt, gedämpft = nicht vorhanden bzw. unbekannt.
      </p>
    </div>
  )
}
