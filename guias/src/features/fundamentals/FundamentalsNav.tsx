import type { Fundamental } from '../../domain/schema'
import { fundamentalsHref } from '../../lib/useHashRoute'

interface FundamentalsNavProps {
  articles: Fundamental[]
  /** Article currently open, if any. */
  article?: string
  /** Only the list of articles, for a tree whose «Fundamentos» entry already links the index. */
  nested?: boolean
}

/** Sidebar of the fundamentals: the articles in the order they are meant to be read. */
export function FundamentalsNav({ articles, article, nested = false }: FundamentalsNavProps) {
  const list = (
    // biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none.
    <ol role="list">
      {articles.map((item) => (
        <li key={item.id}>
          <a href={fundamentalsHref(item.id)} aria-current={item.id === article ? 'page' : undefined}>
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  )

  if (nested) {
    return (
      <nav className="task-nav task-nav--nested" aria-label="Artículos">
        {list}
      </nav>
    )
  }

  return (
    <nav className="task-nav" aria-label="Artículos">
      <a className="task-nav__sheet" href={fundamentalsHref()} aria-current={article ? undefined : 'page'}>
        Índice de fundamentos
      </a>
      <div className="task-nav__group">
        <p>Fundamentos</p>
        {list}
      </div>
    </nav>
  )
}
