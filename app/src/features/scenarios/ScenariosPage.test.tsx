// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScenariosPage } from './ScenariosPage';
import { content } from '../../content';

afterEach(cleanup);

const [first, second] = content.escenarios;

describe('ScenariosPage', () => {
  it('opens the scenario named in the link', () => {
    render(<ScenariosPage scenarioId={second.id} onChoose={() => {}} />);
    expect(screen.getByRole('button', { name: second.titulo }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(second.sintoma)).toBeTruthy();
  });

  it('falls back to the first scenario when the id does not exist', () => {
    render(<ScenariosPage scenarioId="no-existe" onChoose={() => {}} />);
    expect(screen.getByText(first.sintoma)).toBeTruthy();
  });

  it('reports the chosen scenario so the link can be shared', () => {
    const onChoose = vi.fn();
    render(<ScenariosPage scenarioId={first.id} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole('button', { name: second.titulo }));
    expect(onChoose).toHaveBeenCalledWith(second.id);
  });

  it('points to the guide to learn the concepts behind the scenario', () => {
    render(<ScenariosPage scenarioId={first.id} onChoose={() => {}} />);
    expect(screen.getByRole('link', { name: /ruta de aprendizaje/i }).getAttribute('href')).toMatch(/ruta\/$/);
  });
});
