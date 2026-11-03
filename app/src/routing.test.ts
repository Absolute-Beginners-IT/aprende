import { describe, expect, it } from 'vitest';
import { parseHash, scenarioHash } from './routing';

describe('parseHash', () => {
  it('opens the map when the hash is empty or unknown', () => {
    expect(parseHash('')).toEqual({ view: 'mapa' });
    expect(parseHash('#no-existe')).toEqual({ view: 'mapa' });
  });

  it('sends the old glossary tab to the map, now that the glossary lives in the guide', () => {
    expect(parseHash('#glosario')).toEqual({ view: 'mapa' });
  });

  it('reads a view and an optional scenario id', () => {
    expect(parseHash('#mi-infraestructura')).toEqual({ view: 'mi-infraestructura' });
    expect(parseHash('#escenarios')).toEqual({ view: 'escenarios' });
    expect(parseHash('#escenarios/sin-internet')).toEqual({ view: 'escenarios', scenarioId: 'sin-internet' });
  });

  it('opens the map of «Mi infraestructura» by default and its list with /lista', () => {
    expect(parseHash('#mi-infraestructura/lista')).toEqual({ view: 'mi-infraestructura', infraView: 'lista' });
    expect(parseHash('#mi-infraestructura/no-existe')).toEqual({ view: 'mi-infraestructura' });
    expect(parseHash('#mapa/lista')).toEqual({ view: 'mapa' });
  });

  it('builds the shareable hash of a scenario', () => {
    expect(scenarioHash('sin-internet')).toBe('#escenarios/sin-internet');
    expect(parseHash(scenarioHash('sin-internet'))).toEqual({ view: 'escenarios', scenarioId: 'sin-internet' });
  });
});
