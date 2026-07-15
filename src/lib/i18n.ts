// Wörterbuch für die zweisprachige ÖFFENTLICHE Buchungsstrecke (DE/EN).
// Umschaltung per URL-Param `?lang=en` (Default `de`). Das Admin-Panel bleibt
// unberührt (fest Deutsch). Flache Keys mit Punkt-Namespaces; `t()` (siehe
// src/lib/sprache.tsx) fällt bei fehlendem EN-Key auf DE, bei fehlendem DE-Key
// auf den Key-String zurück und ersetzt `{param}`-Platzhalter.

export type Sprache = 'de' | 'en'

type Dict = Record<string, string>

const de: Dict = {
  // common / Seiten-Chrome
  'common.skipToForm': 'Zum Formular springen',
  'common.institution': 'Gedenkstätte Deutscher Widerstand',
  'common.pageTitle': 'Führung oder Seminar anfragen',
  'common.foot.impressum': 'Impressum',
  'common.foot.datenschutz': 'Datenschutz',
  'common.optional': '(optional)',
  'common.pleaseSelect': 'Bitte wählen',
  'common.pleaseSelectOptional': 'Bitte wählen (optional)',
  'common.langSwitch': 'Sprache',
  'common.langDe': 'Deutsch',
  'common.langEn': 'English',

  // wizard
  'wizard.back': 'Zurück',
  'wizard.next': 'Weiter',
  'wizard.sending': 'Wird gesendet …',
  'wizard.submit': 'Anfrage verbindlich absenden',
  'wizard.stepHeading': '{step}. {titel}',
  'wizard.stepStatus': 'Schritt {step} von {count}: {titel}',
  'wizard.stepIndicator': 'Schritt {step} von {total}',
  'wizard.honeypot': 'Firma / Website (bitte freilassen)',
  'wizard.toast.rate': 'Zu viele Anfragen, bitte später erneut versuchen.',
  'wizard.toast.conflict': 'Der Termin ist leider gerade vergeben worden.',
  'wizard.toast.error':
    'Ihre Anfrage konnte leider nicht gesendet werden. Bitte versuchen Sie es erneut.',
  'wizard.toast.validation': 'Bitte prüfen Sie Ihre Angaben in Schritt {target}: {titel}.',

  // step titles
  'stepTitle.1': 'Angebotsart',
  'stepTitle.2': 'Thema',
  'stepTitle.3': 'Gruppengröße',
  'stepTitle.4': 'Wunschtermin',
  'stepTitle.5': 'Herkunft',
  'stepTitle.6': 'Kontaktdaten',
  'stepTitle.7': 'Zusammenfassung',

  // step: Angebotsart
  'stepAngebotsart.empty':
    'Aktuell sind keine Angebotsarten verfügbar. Bitte versuchen Sie es später erneut oder kontaktieren Sie die Gedenkstätte direkt.',
  'stepAngebotsart.ariaLabel': 'Angebotsart auswählen',
  'stepAngebotsart.duration': '{dauer_minuten} Minuten',
  'stepAngebotsart.roomRequired': 'benötigt Raum',

  // step: Thema
  'stepThema.empty':
    'Aktuell sind keine Themen verfügbar. Bitte versuchen Sie es später erneut oder kontaktieren Sie die Gedenkstätte direkt.',
  'stepThema.ariaLabel': 'Thema auswählen',

  // step: Gruppengröße
  'stepGruppe.label': 'Anzahl Teilnehmende',
  'stepGruppe.descRange': 'Zwischen {min} und {max} Personen für „{name}“.',
  'stepGruppe.descMin': 'Mindestens {min} Personen.',

  // step: Termin
  'stepTermin.loading': 'Verfügbarkeit wird geladen …',
  'stepTermin.dateHeading': 'Datum',
  'stepTermin.legend': 'Tage mit Punkt: nur noch wenige Termine frei',
  'stepTermin.noneTitle': 'Keine Termine frei',
  'stepTermin.noneDesc':
    'Für diesen Zeitraum sind aktuell keine Termine frei – bitte anderen Monat wählen oder die Gedenkstätte kontaktieren.',
  'stepTermin.prereq': 'Bitte wählen Sie zunächst Angebotsart, Thema und Gruppengröße aus.',
  'stepTermin.timeHeading': 'Uhrzeit am {datum}',
  'stepTermin.noSlots':
    'An diesem Tag sind keine Zeitfenster verfügbar. Bitte wählen Sie einen anderen Tag.',
  'stepTermin.slotAriaLabel': 'Uhrzeit auswählen',
  'stepTermin.slot': '{start}–{ende} Uhr',

  // step: Herkunft
  'stepHerkunft.land': 'Land',
  'stepHerkunft.bundesland': 'Bundesland',
  'stepHerkunft.einrichtungstyp': 'Einrichtungstyp',
  'stepHerkunft.einrichtungsname': 'Name der Einrichtung',
  'stepHerkunft.einrichtungsnamePh': 'z. B. Musterschule',
  'stepHerkunft.ort': 'Ort',

  // step: Kontakt
  'stepKontakt.name': 'Name',
  'stepKontakt.email': 'E-Mail',
  'stepKontakt.telefon': 'Telefon',
  'stepKontakt.anmerkungen': 'Anmerkungen',
  'stepKontakt.charCount': '{n}/{max} Zeichen',
  'stepKontakt.datenschutzLabel':
    'Ich habe die {link} zur Kenntnis genommen und bin mit der Verarbeitung meiner Daten zur Bearbeitung dieser Anfrage einverstanden.',
  'stepKontakt.datenschutzLink': 'Datenschutzerklärung',

  // step: Zusammenfassung
  'summary.edit': 'Bearbeiten',
  'summary.secAngebot': 'Angebot',
  'summary.angebotsart': 'Angebotsart',
  'summary.thema': 'Thema',
  'summary.gruppengroesse': 'Gruppengröße',
  'summary.personen': '{n} Personen',
  'summary.secWunschtermin': 'Wunschtermin',
  'summary.datum': 'Datum',
  'summary.uhrzeit': 'Uhrzeit',
  'summary.slot': '{start}–{ende} Uhr',
  'summary.secHerkunft': 'Herkunft',
  'summary.land': 'Land',
  'summary.bundesland': 'Bundesland',
  'summary.einrichtungstyp': 'Einrichtungstyp',
  'summary.einrichtung': 'Einrichtung',
  'summary.ort': 'Ort',
  'summary.secKontakt': 'Kontakt',
  'summary.name': 'Name',
  'summary.email': 'E-Mail',
  'summary.telefon': 'Telefon',
  'summary.nachricht': 'Nachricht',
  'summary.hinweis':
    'Dies ist eine Anfrage. Verbindlich wird die Buchung erst nach Bestätigung durch die Gedenkstätte.',

  // validation (zod)
  'validation.angebotsart': 'Bitte wählen Sie eine Angebotsart aus.',
  'validation.thema': 'Bitte wählen Sie ein Thema aus.',
  'validation.gruppeReq': 'Bitte geben Sie die Gruppengröße an.',
  'validation.gruppeInt': 'Bitte geben Sie eine ganze Zahl an.',
  'validation.gruppeMin': 'Mindestens {min} Teilnehmende für dieses Angebot.',
  'validation.gruppeMax': 'Höchstens {max} Teilnehmende für dieses Angebot.',
  'validation.datum': 'Bitte wählen Sie ein Datum aus.',
  'validation.slot': 'Bitte wählen Sie eine Uhrzeit aus.',
  'validation.land': 'Bitte geben Sie ein Land an.',
  'validation.bundesland': 'Bitte wählen Sie ein Bundesland aus.',
  'validation.kontaktName': 'Bitte geben Sie Ihren Namen an.',
  'validation.emailReq': 'Bitte geben Sie eine E-Mail-Adresse an.',
  'validation.emailInvalid': 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
  'validation.nachrichtMax': 'Höchstens 1000 Zeichen.',
  'validation.datenschutz': 'Bitte stimmen Sie der Datenschutzerklärung zu.',

  // Danke-Seite
  'danke.title': 'Vielen Dank für Ihre Anfrage',
  'danke.vorgang': 'Ihre Vorgangsnummer:',
  'danke.submitted': 'Ihre Anfrage wurde übermittelt.',
  'danke.body':
    'Wir haben Ihre Anfrage erhalten und senden Ihnen in Kürze eine Eingangsbestätigung per E-Mail mit einer Zusammenfassung Ihrer Angaben. Die Gedenkstätte Deutscher Widerstand prüft die Verfügbarkeit und meldet sich zeitnah bei Ihnen. Dies war eine unverbindliche Anfrage — verbindlich wird die Buchung erst nach Bestätigung durch die Gedenkstätte.',
  'danke.again': 'Weitere Anfrage stellen',
}

const en: Dict = {
  // common / page chrome
  'common.skipToForm': 'Skip to form',
  'common.institution': 'German Resistance Memorial Center',
  'common.pageTitle': 'Request a guided tour or seminar',
  'common.foot.impressum': 'Legal notice',
  'common.foot.datenschutz': 'Privacy policy',
  'common.optional': '(optional)',
  'common.pleaseSelect': 'Please select',
  'common.pleaseSelectOptional': 'Please select (optional)',
  'common.langSwitch': 'Language',
  'common.langDe': 'Deutsch',
  'common.langEn': 'English',

  // wizard
  'wizard.back': 'Back',
  'wizard.next': 'Next',
  'wizard.sending': 'Sending …',
  'wizard.submit': 'Submit request',
  'wizard.stepHeading': '{step}. {titel}',
  'wizard.stepStatus': 'Step {step} of {count}: {titel}',
  'wizard.stepIndicator': 'Step {step} of {total}',
  'wizard.honeypot': 'Company / website (please leave blank)',
  'wizard.toast.rate': 'Too many requests. Please try again later.',
  'wizard.toast.conflict': 'Unfortunately, this appointment has just been taken.',
  'wizard.toast.error': 'Your request could not be sent. Please try again.',
  'wizard.toast.validation': 'Please check your entries in step {target}: {titel}.',

  // step titles
  'stepTitle.1': 'Offering type',
  'stepTitle.2': 'Topic',
  'stepTitle.3': 'Group size',
  'stepTitle.4': 'Preferred date',
  'stepTitle.5': 'Origin',
  'stepTitle.6': 'Contact details',
  'stepTitle.7': 'Summary',

  // step: Angebotsart
  'stepAngebotsart.empty':
    'No offering types are currently available. Please try again later or contact the memorial directly.',
  'stepAngebotsart.ariaLabel': 'Select offering type',
  'stepAngebotsart.duration': '{dauer_minuten} minutes',
  'stepAngebotsart.roomRequired': 'room required',

  // step: Thema
  'stepThema.empty':
    'No topics are currently available. Please try again later or contact the memorial directly.',
  'stepThema.ariaLabel': 'Select topic',

  // step: Gruppengröße
  'stepGruppe.label': 'Number of participants',
  'stepGruppe.descRange': 'Between {min} and {max} people for “{name}”.',
  'stepGruppe.descMin': 'At least {min} people.',

  // step: Termin
  'stepTermin.loading': 'Loading availability …',
  'stepTermin.dateHeading': 'Date',
  'stepTermin.legend': 'Days marked with a dot: only a few appointments left',
  'stepTermin.noneTitle': 'No appointments available',
  'stepTermin.noneDesc':
    'There are currently no appointments available for this period – please choose another month or contact the memorial.',
  'stepTermin.prereq': 'Please first select the offering type, topic, and group size.',
  'stepTermin.timeHeading': 'Time on {datum}',
  'stepTermin.noSlots':
    'No time slots are available on this day. Please choose another day.',
  'stepTermin.slotAriaLabel': 'Select time',
  'stepTermin.slot': '{start}–{ende}',

  // step: Herkunft
  'stepHerkunft.land': 'Country',
  'stepHerkunft.bundesland': 'Federal state',
  'stepHerkunft.einrichtungstyp': 'Type of institution',
  'stepHerkunft.einrichtungsname': 'Name of institution',
  'stepHerkunft.einrichtungsnamePh': 'e.g. Example School',
  'stepHerkunft.ort': 'Town/city',

  // step: Kontakt
  'stepKontakt.name': 'Name',
  'stepKontakt.email': 'Email',
  'stepKontakt.telefon': 'Phone',
  'stepKontakt.anmerkungen': 'Comments',
  'stepKontakt.charCount': '{n}/{max} characters',
  'stepKontakt.datenschutzLabel':
    'I have read the {link} and consent to the processing of my data for the purpose of handling this request.',
  'stepKontakt.datenschutzLink': 'privacy policy',

  // step: Zusammenfassung
  'summary.edit': 'Edit',
  'summary.secAngebot': 'Offering',
  'summary.angebotsart': 'Offering type',
  'summary.thema': 'Topic',
  'summary.gruppengroesse': 'Group size',
  'summary.personen': '{n} people',
  'summary.secWunschtermin': 'Preferred date',
  'summary.datum': 'Date',
  'summary.uhrzeit': 'Time',
  'summary.slot': '{start}–{ende}',
  'summary.secHerkunft': 'Origin',
  'summary.land': 'Country',
  'summary.bundesland': 'Federal state',
  'summary.einrichtungstyp': 'Type of institution',
  'summary.einrichtung': 'Institution',
  'summary.ort': 'Town/city',
  'summary.secKontakt': 'Contact',
  'summary.name': 'Name',
  'summary.email': 'Email',
  'summary.telefon': 'Phone',
  'summary.nachricht': 'Message',
  'summary.hinweis':
    'This is a request. The booking becomes binding only after confirmation by the memorial.',

  // validation (zod)
  'validation.angebotsart': 'Please select an offering type.',
  'validation.thema': 'Please select a topic.',
  'validation.gruppeReq': 'Please enter the group size.',
  'validation.gruppeInt': 'Please enter a whole number.',
  'validation.gruppeMin': 'At least {min} participants for this offering.',
  'validation.gruppeMax': 'At most {max} participants for this offering.',
  'validation.datum': 'Please select a date.',
  'validation.slot': 'Please select a time.',
  'validation.land': 'Please enter a country.',
  'validation.bundesland': 'Please select a federal state.',
  'validation.kontaktName': 'Please enter your name.',
  'validation.emailReq': 'Please enter an email address.',
  'validation.emailInvalid': 'Please enter a valid email address.',
  'validation.nachrichtMax': 'At most 1000 characters.',
  'validation.datenschutz': 'Please agree to the privacy policy.',

  // Thank-you page
  'danke.title': 'Thank you for your request',
  'danke.vorgang': 'Your reference number:',
  'danke.submitted': 'Your request has been submitted.',
  'danke.body':
    'We have received your request and will shortly send you a confirmation of receipt by email with a summary of your details. The German Resistance Memorial Center will check availability and get back to you soon. This was a non-binding request — the booking becomes binding only after confirmation by the memorial.',
  'danke.again': 'Submit another request',
}

export const woerterbuch: Record<Sprache, Dict> = { de, en }
