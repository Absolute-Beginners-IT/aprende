// Step figures: SVG drawings in ./figures/<platform>/<name>.svg, keyed by <platform>/<name>.
// They are inlined so they follow the page theme (they paint with its CSS variables) and work in the offline file.
const files = import.meta.glob<string>('./figures/**/*.svg', { query: '?raw', import: 'default', eager: true })

export const figures: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.replace(/^\.\/figures\//, '').replace(/\.svg$/, ''), svg]),
)
