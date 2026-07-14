// /admin/hilfe — vollständiges Benutzerhandbuch (aus src/content/hilfe.md,
// per Workflow generiert), gerendert mit react-markdown.

import { createFileRoute } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import hilfeMd from '@/content/hilfe.md?raw'

export const Route = createFileRoute('/admin/_authenticated/hilfe')({
  component: HilfePage,
})

function HilfePage() {
  return (
    <div className="mx-auto max-w-3xl">
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
