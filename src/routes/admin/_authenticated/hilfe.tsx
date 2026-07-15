// /admin/hilfe — vollständiges Benutzerhandbuch (aus src/content/hilfe.md,
// per Workflow generiert), gerendert mit react-markdown.

import { createFileRoute, Link } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { Scale } from 'lucide-react'
import hilfeMd from '@/content/hilfe.md?raw'
import { istPersonal, useRolle } from '@/lib/use-rolle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/_authenticated/hilfe')({
  component: HilfePage,
})

function HilfePage() {
  const personal = istPersonal(useRolle())
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {personal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Marktüberblick
            </CardTitle>
            <CardDescription>
              Recherche vergleichbarer Buchungstools als Entscheidungsgrundlage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/marktueberblick">Marktüberblick öffnen</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <article
        className="prose prose-neutral max-w-none dark:prose-invert
          prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h2:mt-10 prose-h2:text-xl
          prose-h3:text-base prose-table:text-sm prose-code:before:content-none prose-code:after:content-none"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
          {hilfeMd}
        </ReactMarkdown>
      </article>
    </div>
  )
}
