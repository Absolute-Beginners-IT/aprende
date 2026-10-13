import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('shows the manual title', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Manual de Switching' })).toBeInTheDocument()
  })
})
