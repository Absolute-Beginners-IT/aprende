// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { InventoryOverview } from './DeviceInspector';

afterEach(cleanup);

describe('InventoryOverview', () => {
  it('explains every gesture of the map in «Cómo se usa el mapa»', () => {
    render(<InventoryOverview empty findings={[]} />);
    const hints = within(screen.getByRole('list', { name: 'Cómo se usa el mapa' })).getAllByRole('listitem').map(li => li.textContent).join('\n');
    expect(hints).toMatch(/tipo de enlace .*puertos de cada lado/);
    expect(hints).toMatch(/Pulsa en una línea para abrir su ficha/);
    expect(hints).toMatch(/Ctrl \+ clic .*Mayúsculas pulsada.*Agrupar/);
    expect(hints).toMatch(/«Colocar por capas»/);
    expect(hints).toMatch(/leyenda .*gestión y de energía/);
    expect(hints).toMatch(/«Exportar el esquema \(JSON\)».*«Importar el esquema \(JSON\)»/);
  });
});
