// Explanatory visuals of the learning route (shortcodes recorrido-web and evolucion-red).
// The pages already show the drawing and every step as text; this script turns them into a step-by-step simulation
// and stage tabs. Everything it shows comes from the markup, so the content lives in site/data/visuales/.
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVG = 'http://www.w3.org/2000/svg';

  function recorrido(fig) {
    const svg = fig.querySelector('svg');
    const pasos = [...fig.querySelectorAll('.viz__paso')].map((li) => ({
      li,
      en: li.dataset.en,
      desde: li.dataset.desde,
      tipo: li.dataset.tipo,
      fase: li.dataset.fase,
      cambia: (li.dataset.cambia || '').split(' ').filter(Boolean),
      pantalla: li.dataset.pantalla ? JSON.parse(li.dataset.pantalla) : null,
      nombre: li.querySelector('[data-campo="nombre"]').textContent,
      origen: li.querySelector('[data-campo="origen"]').textContent,
      destino: li.querySelector('[data-campo="destino"]').textContent,
      quien: li.querySelector('.viz__quien b').textContent,
    }));
    const nodos = Object.fromEntries([...svg.querySelectorAll('.viz__nodo')].map((g) => [g.dataset.nodo, g]));
    const centro = (id) => [Number(nodos[id].dataset.x), Number(nodos[id].dataset.y)];
    const cables = [...svg.querySelectorAll('.viz__cable')];
    const cable = (a, b) => cables.find((c) => c.dataset.enlace === [a, b].sort().join('-'));
    const paquete = svg.querySelector('.viz__paquete');
    const etiqueta = svg.querySelector('.viz__etiqueta');
    const caja = svg.querySelector('.viz__caja');
    const titulo = svg.querySelector('.viz__titulo');
    const direcciones = svg.querySelector('.viz__direcciones');
    const fase = fig.querySelector('.viz__fase');
    const botonReproducir = fig.querySelector('[data-accion="reproducir"]');
    const ancho = Number(fig.dataset.ancho);
    // The optional screen (a browser or a terminal): each step may change its bar, lines or padlock; the rest carries over.
    const pantalla = svg.querySelector('.viz__pantalla');
    const barra = pantalla && pantalla.querySelector('.viz__url, .viz__barra-texto');
    const lineas = pantalla ? [...pantalla.querySelectorAll('.viz__linea')] : [];
    const inicial = pantalla ? JSON.parse(pantalla.dataset.inicial) : {};
    const estados = [];
    pasos.reduce((estado, p) => { const s = { ...estado, ...(p.pantalla || {}) }; estados.push(s); return s; }, inicial);

    // Each step gets a numbered button; the colour says whether it carries a question or an answer.
    const saltos = fig.querySelector('.viz__saltos');
    const botones = pasos.map((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `viz__salto viz__salto--${p.tipo}`;
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', `Paso ${i + 1}: ${p.quien}`);
      b.addEventListener('click', () => { parar(); ir(i, false); });
      saltos.append(b);
      return b;
    });

    let actual = -1;
    let reproduciendo = false;
    let marco = 0;
    let espera = 0;
    let tecleo = 0;

    function colocar(x, y) {
      paquete.setAttribute('transform', `translate(${x} ${y})`);
      // The name card stays inside the drawing: clamped at the sides, and below the dot near the top edge.
      const w = Number(caja.getAttribute('width'));
      const cx = Math.min(Math.max(x, 12 + w / 2), ancho - 12 - w / 2);
      etiqueta.setAttribute('transform', `translate(${cx - x} ${y < 120 ? 96 : 0})`);
    }
    function tspan(texto, cambiado) {
      const t = document.createElementNS(SVG, 'tspan');
      t.textContent = texto;
      if (cambiado) t.setAttribute('class', 'viz__cambiado');
      return t;
    }
    function etiquetar(p) {
      titulo.textContent = p.nombre;
      titulo.classList.toggle('viz__cambiado', p.cambia.includes('nombre'));
      direcciones.replaceChildren(tspan('de '), tspan(p.origen, p.cambia.includes('origen')), tspan(' a '), tspan(p.destino, p.cambia.includes('destino')));
      const w = Math.max(titulo.getComputedTextLength(), direcciones.getComputedTextLength()) + 28;
      caja.setAttribute('width', w);
      caja.setAttribute('x', -w / 2);
      paquete.dataset.tipo = p.tipo;
      if (!reduce) { etiqueta.classList.remove('viz__destello'); void etiqueta.getBBox(); etiqueta.classList.add('viz__destello'); }
    }
    function marcarCambios(p) {
      for (const campo of ['nombre', 'origen', 'destino']) {
        p.li.querySelector(`[data-campo="${campo}"]`).classList.toggle('viz__cambiado', p.cambia.includes(campo));
      }
    }
    function pintarPantalla(i) {
      if (!pantalla) return;
      clearInterval(tecleo);
      const estado = i < 0 ? inicial : estados[i];
      const nuevo = i >= 0 && pasos[i].pantalla;
      pantalla.classList.toggle('viz__pantalla--lista', Boolean(estado.candado));
      lineas.forEach((l, k) => { l.textContent = (estado.lineas || [])[k] || ''; });
      if (nuevo && nuevo.teclear && !reduce) {
        const texto = estado.barra;
        let n = 0;
        barra.textContent = '';
        tecleo = setInterval(() => {
          n += 1;
          barra.textContent = texto.slice(0, n) + (n < texto.length ? '▏' : '');
          if (n >= texto.length) clearInterval(tecleo);
        }, 55);
      } else barra.textContent = estado.barra || '';
    }
    function narrar(i) {
      pasos.forEach((p, k) => p.li.classList.toggle('is-actual', k === i));
      botones.forEach((b, k) => { b.classList.toggle('is-actual', k === i); b.classList.toggle('is-hecho', k < i); });
      Object.entries(nodos).forEach(([id, g]) => g.classList.toggle('is-activo', i >= 0 && id === pasos[i].en));
      fase.textContent = i < 0 ? 'Listo para empezar' : `Paso ${i + 1} de ${pasos.length} · ${pasos[i].fase}`;
    }
    function ir(i, animar) {
      cancelAnimationFrame(marco);
      clearTimeout(espera);
      actual = i;
      const p = pasos[i];
      paquete.hidden = false;
      cables.forEach((c) => c.classList.remove('is-activo'));
      narrar(i);
      marcarCambios(p);
      pintarPantalla(i);
      const llegar = () => {
        // Label first: the card is clamped inside the drawing with its new width.
        etiquetar(p);
        colocar(...centro(p.en));
        if (reproduciendo) espera = setTimeout(siguiente, 2400);
      };
      if (!p.desde) { llegar(); return; }
      const c = cable(p.desde, p.en);
      c.classList.add('is-activo');
      if (!animar || reduce) { llegar(); return; }
      // While travelling, the card still shows the packet as the previous device sent it.
      etiquetar({ ...pasos[i - 1], cambia: [] });
      const largo = c.getTotalLength();
      const inicio = c.getPointAtLength(0);
      const [ax, ay] = centro(p.desde);
      const haciaDelante = Math.hypot(inicio.x - ax, inicio.y - ay) < 2;
      const duracion = Math.max(700, largo * 4.5);
      const t0 = performance.now();
      const paso = (ahora) => {
        const k = Math.min(1, (ahora - t0) / duracion);
        const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
        const pt = c.getPointAtLength((haciaDelante ? e : 1 - e) * largo);
        colocar(pt.x, pt.y);
        if (k < 1) marco = requestAnimationFrame(paso);
        else llegar();
      };
      marco = requestAnimationFrame(paso);
    }
    function siguiente() {
      if (actual >= pasos.length - 1) { parar(); return; }
      ir(actual + 1, true);
    }
    function parar() {
      reproduciendo = false;
      clearTimeout(espera);
      botonReproducir.textContent = 'Reproducir';
    }
    function inicio() {
      parar();
      cancelAnimationFrame(marco);
      actual = -1;
      paquete.hidden = true;
      cables.forEach((c) => c.classList.remove('is-activo'));
      pasos.forEach((p) => p.li.classList.remove('is-actual'));
      narrar(-1);
      pintarPantalla(-1);
      // Before the first step, the panel shows the opening of the story instead of nothing.
      pasos[0].li.classList.add('is-actual');
    }

    botonReproducir.addEventListener('click', () => {
      if (reproduciendo) { parar(); return; }
      if (actual >= pasos.length - 1) inicio();
      reproduciendo = true;
      botonReproducir.textContent = 'Pausar';
      siguiente();
    });
    fig.querySelector('[data-accion="siguiente"]').addEventListener('click', () => { parar(); if (actual >= pasos.length - 1) inicio(); siguiente(); });
    fig.querySelector('[data-accion="anterior"]').addEventListener('click', () => { parar(); if (actual > 0) ir(actual - 1, false); else inicio(); });
    fig.querySelector('[data-accion="inicio"]').addEventListener('click', inicio);

    fig.querySelector('.viz__controles').hidden = false;
    saltos.hidden = false;
    fig.classList.add('viz--activa');
    inicio();
  }

  function evolucion(fig) {
    const etapas = [...fig.querySelectorAll('.viz__etapa')].map((li) => ({ li, muestra: li.dataset.muestra.split(' ').filter(Boolean) }));
    const elementos = [...fig.querySelectorAll('[data-elemento]')];
    const pestanas = [...fig.querySelectorAll('[data-etapa]')];
    const mostrar = (i) => {
      elementos.forEach((el) => el.classList.toggle('is-oculto', !etapas[i].muestra.includes(el.dataset.elemento)));
      etapas.forEach((e, k) => e.li.classList.toggle('is-actual', k === i));
      pestanas.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    };
    pestanas.forEach((b, i) => b.addEventListener('click', () => mostrar(i)));
    fig.querySelector('.viz__pestanas').hidden = false;
    fig.classList.add('viz--activa');
    mostrar(0);
  }

  document.querySelectorAll('.viz-recorrido').forEach(recorrido);
  document.querySelectorAll('.viz-evolucion').forEach(evolucion);
})();
