// Learning route progress (TryHackMe style). Everything stays in this browser: there is no API yet (docs/adr/0002).
(() => {
  'use strict';

  const KEY = 'ruta:v1';

  // localStorage can be unavailable (private mode, blocked storage): fall back to memory for the session.
  const storage = (() => {
    try {
      localStorage.setItem('ruta:probe', '1');
      localStorage.removeItem('ruta:probe');
      return localStorage;
    } catch {
      const mem = new Map();
      return { getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k) };
    }
  })();

  const load = () => {
    try {
      const data = JSON.parse(storage.getItem(KEY) || '{}');
      return { tareas: data.tareas || {}, preguntas: data.preguntas || {} };
    } catch {
      return { tareas: {}, preguntas: {} };
    }
  };

  let state = load();
  const save = () => {
    try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* keep the in-memory state for this session */ }
  };

  // Same normalisation as layouts/shortcodes/pregunta.html, plus an accent-free variant so "mascara" and "máscara" both work.
  const normalise = text => text.toLowerCase().trim().replace(/\s+/g, ' ');
  const withoutAccents = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '');

  const sha256 = async text => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  };

  const canCheck = Boolean(window.crypto && crypto.subtle);

  const doneIn = salas => Object.keys(state.tareas).filter(id => state.tareas[id] && salas.some(s => id.startsWith(s + 't'))).length;

  function refreshProgress() {
    document.querySelectorAll('.progreso').forEach(el => {
      const salas = el.dataset.salas.split(' ').filter(Boolean);
      const total = Number(el.dataset.total);
      const done = Math.min(doneIn(salas), total);
      el.querySelector('progress').value = done;
      el.querySelector('.progreso-texto').textContent = total === done && total > 0
        ? `Completado: ${total} de ${total} tareas`
        : `${done} de ${total} tareas`;
    });

    let next = null;
    document.querySelectorAll('.sala[data-sala]').forEach(el => {
      const done = doneIn([el.dataset.sala]);
      const complete = done >= Number(el.dataset.total);
      const isNext = !complete && !next;
      el.classList.toggle('completa', complete);
      el.classList.toggle('en-curso', !complete && done > 0);
      el.classList.toggle('siguiente', isNext);
      const status = el.querySelector('.nodo-estado');
      if (status) status.textContent = complete ? 'Completada' : isNext ? (done > 0 ? 'En curso · siguiente' : 'Siguiente') : done > 0 ? 'En curso' : '';
      if (isNext) next = el.querySelector('.nodo-texto a') || el.querySelector('a');
    });

    const continuar = document.getElementById('continuar');
    if (continuar && next) {
      const started = Object.values(state.tareas).some(Boolean);
      continuar.href = next.getAttribute('href');
      continuar.textContent = started ? `Continúa: ${next.textContent}` : `Empieza: ${next.textContent}`;
    } else if (continuar && document.querySelector('.sala[data-sala]')) {
      continuar.textContent = '¡Has completado todas las salas disponibles!';
    }
    drawCables();
  }

  // Network-style cabling between consecutive rooms: down, across, down. A cable lights up once the room it leaves is complete.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function drawCables() {
    document.querySelectorAll('[data-topologia]').forEach(topology => {
      const svg = topology.querySelector('svg.cables');
      if (!svg) return;
      const box = topology.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      svg.setAttribute('width', box.width);
      svg.setAttribute('height', box.height);
      const nodes = [...topology.querySelectorAll('.nodo')];
      const paths = nodes.slice(1).map((node, i) => {
        const from = nodes[i].querySelector('.nodo-equipo').getBoundingClientRect();
        const to = node.querySelector('.nodo-equipo').getBoundingClientRect();
        const x1 = from.left + from.width / 2 - box.left;
        const y1 = from.bottom - box.top;
        const x2 = to.left + to.width / 2 - box.left;
        const y2 = to.top - box.top;
        const ym = Math.round((y1 + y2) / 2);
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', `M${x1} ${y1} V${ym} H${x2} V${y2}`);
        path.setAttribute('class', `cable seg-${node.dataset.seg}${nodes[i].classList.contains('completa') ? ' encendido' : ''}`);
        return path;
      });
      svg.replaceChildren(...paths);
    });
  }

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => drawCables());
    document.querySelectorAll('[data-topologia]').forEach(t => observer.observe(t));
  } else {
    window.addEventListener('resize', drawCables);
  }

  function setTaskDone(task, done) {
    state.tareas[task.dataset.tarea] = done;
    if (!done) delete state.tareas[task.dataset.tarea];
    save();
    renderTask(task);
    refreshProgress();
  }

  function renderTask(task) {
    const done = Boolean(state.tareas[task.dataset.tarea]);
    task.classList.toggle('completa', done);
    task.querySelector('.tarea-estado').textContent = done ? 'Completada' : '';
    const button = task.querySelector('.tarea-completar');
    button.textContent = done ? 'Desmarcar' : 'Marcar como completada';
  }

  function setupQuestion(task, question, id) {
    const input = question.querySelector('input');
    const button = question.querySelector('.pregunta-comprobar');
    const status = question.querySelector('.pregunta-estado');
    const hashes = question.dataset.hashes.split(' ');

    const markCorrect = answer => {
      input.value = answer;
      input.readOnly = true;
      button.disabled = true;
      question.classList.add('correcta');
      status.textContent = 'Correcto.';
    };

    if (state.preguntas[id]) markCorrect(state.preguntas[id]);

    const check = async () => {
      const answer = normalise(input.value);
      if (!answer) return;
      if (!canCheck) {
        status.textContent = 'Para comprobar respuestas abre la guía por https o en localhost.';
        return;
      }
      const candidates = [...new Set([answer, withoutAccents(answer)])];
      const ok = (await Promise.all(candidates.map(sha256))).some(h => hashes.includes(h));
      if (!ok) {
        question.classList.remove('correcta');
        status.textContent = 'No es correcto. Revisa el texto de la tarea o abre la pista.';
        return;
      }
      state.preguntas[id] = input.value.trim();
      markCorrect(state.preguntas[id]);
      const pending = task.querySelectorAll('.pregunta:not(.correcta)').length;
      if (pending === 0) setTaskDone(task, true); else save();
    };

    button.addEventListener('click', check);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  }

  document.querySelectorAll('.tarea[data-tarea]').forEach(task => {
    const questions = task.querySelectorAll('.pregunta');
    const button = task.querySelector('.tarea-completar');
    // A task with questions is completed by answering them all; one without questions by the button.
    if (questions.length > 0 && canCheck) button.hidden = true;
    questions.forEach((q, i) => setupQuestion(task, q, `${task.dataset.tarea}q${i + 1}`));
    button.addEventListener('click', () => setTaskDone(task, !state.tareas[task.dataset.tarea]));
    renderTask(task);
  });

  document.querySelectorAll('[data-reiniciar]').forEach(button => button.addEventListener('click', () => {
    if (!window.confirm('¿Seguro que quieres borrar todo tu progreso de la ruta?')) return;
    state = { tareas: {}, preguntas: {} };
    try { storage.removeItem(KEY); } catch { /* nothing stored */ }
    refreshProgress();
  }));

  refreshProgress();
})();
