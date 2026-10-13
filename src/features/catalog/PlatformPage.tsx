import type { Catalog } from '../../domain/buildCatalog'
import { type Platform, TASK_GROUPS } from '../../domain/schema'
import { runbookHref } from '../../lib/useHashRoute'
import { Section } from '../../ui/Section'
import { GROUP_LABELS, STATUS_LABELS } from '../labels'

interface PlatformPageProps {
  catalog: Catalog
  platform: Platform
}

export function PlatformPage({ catalog, platform }: PlatformPageProps) {
  const runbooks = catalog.procedures
    .filter((procedure) => procedure.platform === platform.id)
    .flatMap((procedure) => {
      const concept = catalog.concepts.find((item) => item.id === procedure.task)
      return concept ? [{ procedure, concept }] : []
    })

  return (
    <div>
      <header className="page-header">
        <p className="eyebrow">
          {platform.vendor} · {platform.os}
        </p>
        <h1>{platform.name}</h1>
        <p className="lead">{platform.summary}</p>
        <p className="muted">Modelos: {platform.models.join(', ')}</p>
      </header>

      {TASK_GROUPS.map((group) => {
        const inGroup = runbooks.filter(({ concept }) => concept.group === group)
        if (inGroup.length === 0) return null

        return (
          <Section key={group} title={GROUP_LABELS[group]}>
            <ul className="cards">
              {inGroup.map(({ procedure, concept }) => (
                <li key={concept.id}>
                  <a className="card" href={runbookHref(platform.id, concept.id)}>
                    <strong>{concept.title}</strong>
                    <span>{concept.summary}</span>
                    <span className="muted">{STATUS_LABELS[procedure.status.level]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )
      })}

      <Section title="Redes de seguridad">
        <p>Mecanismos propios de este sistema para deshacer un cambio. Conviene conocerlos antes de tocar nada.</p>
        <ul className="plain-list">
          {platform.safetyNets.map((net) => (
            <li key={net.name}>
              <h3>{net.name}</h3>
              <p>{net.description}</p>
              {net.commands && (
                <pre>
                  {net.commands.map((command) => (
                    <code key={command}>{command}</code>
                  ))}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cómo se guarda la configuración">
        <p>{platform.configPersistence}</p>
      </Section>

      <Section title="Modos de la CLI">
        <table>
          <thead>
            <tr>
              <th>Modo</th>
              <th>Prompt</th>
              <th>Cómo se entra</th>
              <th>Para qué sirve</th>
            </tr>
          </thead>
          <tbody>
            {platform.cliModes.map((mode) => (
              <tr key={mode.name}>
                <td>{mode.name}</td>
                <td>
                  <code>{mode.prompt}</code>
                </td>
                <td>{mode.enter}</td>
                <td>{mode.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Fuentes">
        <ul>
          {platform.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="muted">
          {STATUS_LABELS[platform.status.level]} · {platform.status.firmware} · revisada el {platform.status.reviewed}
        </p>
      </Section>
    </div>
  )
}
