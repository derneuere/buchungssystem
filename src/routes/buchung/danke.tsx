import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SpracheProvider, useSprache } from '@/lib/sprache'

const searchSchema = z.object({
  id: z.string().optional(),
  lang: z.enum(['de', 'en']).catch('de').optional(),
})

export const Route = createFileRoute('/buchung/danke')({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: DankePage,
})

function DankePage() {
  const { lang } = Route.useSearch()
  return (
    <SpracheProvider sprache={lang ?? 'de'}>
      <DankeInhalt />
    </SpracheProvider>
  )
}

function DankeInhalt() {
  const { id, lang } = Route.useSearch()
  const { t } = useSprache()

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="mb-2 h-12 w-12 text-primary" aria-hidden="true" />
          <CardTitle className="text-2xl">{t('danke.title')}</CardTitle>
          <CardDescription>
            {id ? (
              <>
                {t('danke.vorgang')}{' '}
                <span className="font-mono font-medium text-foreground">{id}</span>
              </>
            ) : (
              t('danke.submitted')
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">{t('danke.body')}</p>
          <Button asChild className="min-h-11">
            <Link to="/" search={{ lang: lang === 'en' ? 'en' : undefined }}>
              {t('danke.again')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
