import { type ReactNode, useId } from 'react'

interface SectionProps {
  title: string
  children: ReactNode
  actions?: ReactNode
}

export function Section({ title, children, actions }: SectionProps) {
  const headingId = useId()

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section__header">
        <h2 id={headingId}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}
