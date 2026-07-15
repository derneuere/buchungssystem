import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { z } from 'zod'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query'

import appCss from '../styles.css?url'

// Sprachumschaltung der ÖFFENTLICHEN Buchungsstrecke per `?lang=en` (Default de).
// Zentral im Root, damit `lang` app-weit typisiert lesbar ist. `.catch('de')`
// fängt ungültige Werte ab, `.optional()` erlaubt Fehlen. Admin-Routen
// konsumieren den Sprach-Provider nicht → dort ohne Wirkung.
const rootSearchSchema = z.object({
  lang: z.enum(['de', 'en']).catch('de').optional(),
})

// Setzt die Theme-Klasse (.dark/.light) vor dem ersten Paint, um FOUC zu vermeiden.
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>) => rootSearchSchema.parse(search),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Buchung – Gedenkstätte Deutscher Widerstand' },
      {
        name: 'description',
        content:
          'Führungen und Seminare der Gedenkstätte Deutscher Widerstand online anfragen.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
