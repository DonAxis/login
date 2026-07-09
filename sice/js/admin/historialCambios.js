// historialCambios.js
// Panel de auditoría — dos estados:
//   "lista"   → 1 lectura (config/cambiosResumen) → muestra materias con conteo
//   "detalle" → N lecturas where(materiaNombre==x) → muestra cambios de esa materia

let _histResumen        = null;
let _histMatActual      = '';
let _histDetalleDatos   = [];
let _histSoloSospechosos = false;

// ─── Abrir / cerrar ──────────────────────────────────────────────────────────

function mostrarHistorialCambios() {
  document.getElementById('modalHistorialCambios').style.display = 'block';
  cargarHistorialCambios();
}

function cerrarHistorialCambios() {
  document.getElementById('modalHistorialCambios').style.display = 'none';
  _histResumen      = null;
  _histMatActual    = '';
  _histDetalleDatos = [];
}

// ─── Estado "lista" ──────────────────────────────────────────────────────────

async function cargarHistorialCambios() {
  _uiEstadoLista();
  document.getElementById('histStats').innerHTML =
    '<div style="text-align:center;padding:30px;color:#999;">Cargando resumen...</div>';
  document.getElementById('histTabla').innerHTML = '';

  try {
    const doc = await db.collection('config').doc('cambiosResumen').get();
    if (!doc.exists) {
      _histMostrarSinResumen();
      return;
    }
    _histResumen = doc.data();
    renderHistLista();
  } catch (e) {
    document.getElementById('histStats').innerHTML =
      '<div style="color:#d32f2f;padding:16px;">Error al cargar: ' + e.message + '</div>';
  }
}

function _histMostrarSinResumen() {
  document.getElementById('histStats').innerHTML = `
    <div style="text-align:center;padding:50px 20px;color:#aaa;">
      <div style="font-size:3rem;margin-bottom:14px;">📊</div>
      <p style="font-size:1rem;color:#666;margin-bottom:4px;">No hay resumen generado todavía.</p>
      <p style="font-size:0.85rem;">Presiona <strong style="color:#bf360c;">Recalcular resumen</strong> para construirlo.</p>
      <p style="font-size:0.78rem;color:#bbb;margin-top:6px;">Lee todos los registros una sola vez y guarda el resultado en Firestore.</p>
    </div>
  `;
}

function renderHistLista(query) {
  if (!_histResumen) return;
  const r = _histResumen;

  let materias = r.materias || [];
  if (query) {
    const q = query.toLowerCase();
    materias = materias.filter(m => m.nombre.toLowerCase().includes(q));
  }

  const topOps = (r.porOperador || []).slice(0, 6);
  const topPer = (r.porPeriodo  || []).slice(0, 5);
  const porCarrera = r.porCarrera || {};

  function chip(label, n, color) {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:14px;
      font-size:0.79rem;white-space:nowrap;border:1px solid ${color}40;background:${color}12;">
      <strong style="color:${color};">${label}</strong><span style="color:#555;">${n}</span></span>`;
  }

  function rankRow(label, n, color) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;
      font-size:0.82rem;border-bottom:1px solid #f0f0f0;">
      <span style="color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;"
        title="${label}">${label}</span>
      <span style="background:${color};color:white;padding:1px 8px;border-radius:10px;
        font-weight:700;font-size:0.73rem;margin-left:8px;flex-shrink:0;">${n}</span></div>`;
  }

  const fechaCalc = r.fechaCalculo
    ? (r.fechaCalculo.toDate ? r.fechaCalculo.toDate() : new Date(r.fechaCalculo))
        .toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric',
          hour:'2-digit', minute:'2-digit' })
    : '—';

  document.getElementById('histStats').innerHTML = `

    <!-- Tarjetas de resumen -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">

      <div style="background:linear-gradient(135deg,#bf360c,#e64a19);color:white;padding:12px 18px;
          border-radius:10px;text-align:center;flex-shrink:0;min-width:110px;
          box-shadow:0 3px 12px rgba(191,54,12,0.35);">
        <div style="font-size:1.8rem;font-weight:700;line-height:1;">${r.total ?? 0}</div>
        <div style="font-size:0.72rem;opacity:0.9;margin-top:3px;">cambios reales</div>
      </div>

      <div style="flex:1;min-width:160px;background:#fff8f0;border-radius:10px;
          padding:10px 14px;border-left:4px solid #e64a19;">
        <div style="font-size:0.69rem;font-weight:700;color:#bf360c;margin-bottom:6px;
            text-transform:uppercase;letter-spacing:0.5px;">Por Carrera</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${Object.entries(porCarrera).sort((a,b)=>b[1]-a[1]).map(([c,n])=>chip(c,n,'#e64a19')).join('')}
        </div>
      </div>

      <div style="flex:1;min-width:160px;background:#f3e5f5;border-radius:10px;
          padding:10px 14px;border-left:4px solid #7b1fa2;">
        <div style="font-size:0.69rem;font-weight:700;color:#7b1fa2;margin-bottom:6px;
            text-transform:uppercase;letter-spacing:0.5px;">Top Operadores</div>
        ${topOps.map(o => rankRow(o.nombre, o.count, '#7b1fa2')).join('')}
      </div>

      <div style="flex:1;min-width:140px;background:#fce4ec;border-radius:10px;
          padding:10px 14px;border-left:4px solid #c2185b;">
        <div style="font-size:0.69rem;font-weight:700;color:#c2185b;margin-bottom:6px;
            text-transform:uppercase;letter-spacing:0.5px;">Por Periodo</div>
        ${topPer.map(p => rankRow(p.periodo, p.count, '#c2185b')).join('')}
      </div>

    </div>

    <!-- Lista de materias -->
    <div style="border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
      <div style="background:#f5f5f5;padding:9px 14px;border-bottom:1px solid #e0e0e0;
          display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.77rem;font-weight:700;color:#555;">
          MATERIAS CON CAMBIOS
          <span style="color:#aaa;font-weight:400;">(${materias.length})</span>
        </span>
        <span style="font-size:0.72rem;color:#bbb;">Toca una para ver el detalle</span>
      </div>

      <div style="max-height:40vh;overflow-y:auto;">
        ${materias.length === 0
          ? '<div style="text-align:center;padding:20px;color:#aaa;font-size:0.85rem;">Sin resultados.</div>'
          : materias.map(m => `
            <div data-mat="${encodeURIComponent(m.nombre)}" onclick="histSelMateria(this)"
              style="display:flex;justify-content:space-between;align-items:center;
                padding:9px 14px;border-bottom:1px solid #f5f5f5;cursor:pointer;transition:background 0.1s;"
              onmouseover="this.style.background='#fff8f0'"
              onmouseout="this.style.background=''">
              <span style="color:#333;font-size:0.88rem;">${m.nombre}</span>
              <span style="background:#bf360c;color:white;padding:2px 10px;border-radius:10px;
                font-weight:700;font-size:0.75rem;flex-shrink:0;margin-left:10px;">${m.count}</span>
            </div>`).join('')
        }
      </div>

      <div style="background:#fafafa;padding:5px 14px;border-top:1px solid #f0f0f0;
          font-size:0.71rem;color:#ccc;text-align:right;">
        Calculado: ${fechaCalc}
      </div>
    </div>
  `;
}

function histBuscarMateria(q) {
  renderHistLista(q);
}

// ─── Estado "detalle" ─────────────────────────────────────────────────────────

function histSelMateria(el) {
  const nombre = decodeURIComponent(el.dataset.mat);
  seleccionarMateria(nombre);
}

async function seleccionarMateria(nombre) {
  _histMatActual = nombre;
  _uiEstadoDetalle();

  document.getElementById('histStats').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="background:#bf360c;color:white;padding:4px 14px;border-radius:8px;
        font-size:0.88rem;font-weight:700;">${nombre}</span>
      <span style="color:#aaa;font-size:0.82rem;">Cargando...</span>
    </div>`;
  document.getElementById('histTabla').innerHTML = '';

  try {
    const snap = await db.collection('registroCambios')
      .where('materiaNombre', '==', nombre)
      .get();

    _histDetalleDatos = [];
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      // Excluir null→algo
      const antP = (d.antes  && d.antes.promedio  !== undefined) ? d.antes.promedio  : null;
      const desP = (d.despues && d.despues.promedio !== undefined) ? d.despues.promedio : null;
      if (antP === null && desP !== null) return;
      _histDetalleDatos.push(d);
    });

    // Ordenar por fecha desc sin índice compuesto
    _histDetalleDatos.sort((a, b) => {
      const ta = a.fechaCambio ? (a.fechaCambio.toMillis ? a.fechaCambio.toMillis()
        : new Date(a.fechaCambio).getTime()) : 0;
      const tb = b.fechaCambio ? (b.fechaCambio.toMillis ? b.fechaCambio.toMillis()
        : new Date(b.fechaCambio).getTime()) : 0;
      return tb - ta;
    });

    renderHistDetalle();
  } catch (e) {
    document.getElementById('histStats').innerHTML =
      '<div style="color:#d32f2f;padding:12px;">Error: ' + e.message + '</div>';
  }
}

// ─── Helpers de análisis ─────────────────────────────────────────────────────

function _esRegistroCalif(d) {
  return d.antes && d.antes.parciales !== undefined;
}

function _esSospechoso(antes, despues) {
  if (!antes || !despues) return false;

  // Parcial que subió
  if (antes.parciales && despues.parciales) {
    for (const k of ['parcial1', 'parcial2', 'parcial3']) {
      const a = antes.parciales[k], b = despues.parciales[k];
      if (typeof a === 'number' && typeof b === 'number' && b > a) return true;
    }
  }

  // Falta que bajó
  if (antes.faltas && despues.faltas) {
    for (const k of ['falta1', 'falta2', 'falta3']) {
      const a = antes.faltas[k], b = despues.faltas[k];
      if (typeof a === 'number' && typeof b === 'number' && b < a) return true;
    }
  }

  // Promedio pasó de reprobado a aprobado (umbral 6 o 7.5)
  const ap = antes.promedio, dp = despues.promedio;
  if (typeof ap === 'number' && typeof dp === 'number') {
    if ((ap < 6 && dp >= 6) || (ap < 7.5 && dp >= 7.5)) return true;
  }

  return false;
}

function _diffCalifFaltas(antes, despues) {
  if (!antes || !despues) return '<span style="color:#ccc;">—</span>';

  const filas = [];

  // Parciales
  const etiqP = { parcial1: 'P1', parcial2: 'P2', parcial3: 'P3' };
  for (const [k, label] of Object.entries(etiqP)) {
    const a = (antes.parciales || {})[k];
    const b = (despues.parciales || {})[k];
    if (a === undefined && b === undefined) continue;
    if (String(a) === String(b)) continue;

    const subio = typeof a === 'number' && typeof b === 'number' && b > a;
    const bajo  = typeof a === 'number' && typeof b === 'number' && b < a;
    const color = subio ? '#bf360c' : (bajo ? '#1565c0' : '#555');
    const icono = subio ? ' ↑' : (bajo ? ' ↓' : '');
    const aStr  = a === null || a === undefined ? '—' : a;
    const bStr  = b === null || b === undefined ? '—' : b;

    filas.push(
      `<span style="font-size:0.78rem;">` +
      `<strong style="color:#888;min-width:20px;display:inline-block;">${label}</strong> ` +
      `<span style="color:#aaa;">${aStr}</span> → ` +
      `<strong style="color:${color};">${bStr}${icono}</strong>` +
      `</span>`
    );
  }

  // Faltas
  const etiqF = { falta1: 'F1', falta2: 'F2', falta3: 'F3' };
  for (const [k, label] of Object.entries(etiqF)) {
    const a = (antes.faltas || {})[k];
    const b = (despues.faltas || {})[k];
    if (a === undefined && b === undefined) continue;
    if (String(a) === String(b)) continue;

    const bajo  = typeof a === 'number' && typeof b === 'number' && b < a;
    const subio = typeof a === 'number' && typeof b === 'number' && b > a;
    // Falta que baja es sospechoso → naranja; falta que sube es normal → azul
    const color = bajo ? '#e65100' : (subio ? '#1565c0' : '#555');
    const icono = bajo ? ' ↓' : (subio ? ' ↑' : '');
    const aStr  = a === null || a === undefined ? '—' : a;
    const bStr  = b === null || b === undefined ? '—' : b;

    filas.push(
      `<span style="font-size:0.78rem;">` +
      `<strong style="color:#888;min-width:20px;display:inline-block;">${label}</strong> ` +
      `<span style="color:#aaa;">${aStr}</span> → ` +
      `<strong style="color:${color};">${bStr}${icono}</strong>` +
      `</span>`
    );
  }

  // Promedio resultante
  const ap = antes.promedio, dp = despues.promedio;
  if (String(ap) !== String(dp)) {
    const subio = typeof ap === 'number' && typeof dp === 'number' && dp > ap;
    const color = subio ? '#bf360c' : '#555';
    filas.push(
      `<span style="font-size:0.78rem;border-top:1px dashed #eee;display:block;padding-top:2px;margin-top:2px;">` +
      `<strong style="color:#888;min-width:20px;display:inline-block;">Prom</strong> ` +
      `<span style="color:#aaa;">${ap ?? '—'}</span> → ` +
      `<strong style="color:${color};">${dp ?? '—'}</strong>` +
      `</span>`
    );
  }

  if (filas.length === 0) {
    return '<span style="color:#ccc;font-size:0.78rem;">sin diff</span>';
  }
  return filas.join('<br>');
}

function _diffBoletaGlobal(antes, despues) {
  if (!antes || !despues) return '<span style="color:#ccc;">—</span>';
  const partes = [];
  const ap = antes.promedio, dp = despues.promedio;
  if (String(ap) !== String(dp)) {
    partes.push(`<span style="font-size:0.78rem;"><strong style="color:#888;">Prom</strong> ` +
      `<span style="color:#aaa;">${ap ?? '—'}</span> → <strong style="color:#7b1fa2;">${dp ?? '—'}</strong></span>`);
  }
  if (antes.acreditacion !== despues.acreditacion) {
    partes.push(`<span style="font-size:0.75rem;color:#666;">${antes.acreditacion||'—'} → ` +
      `<strong style="color:#1565c0;">${despues.acreditacion||'—'}</strong></span>`);
  }
  if (antes.periodoAcademico !== despues.periodoAcademico) {
    partes.push(`<span style="font-size:0.72rem;color:#aaa;">período: ${antes.periodoAcademico||'—'} → ` +
      `<strong>${despues.periodoAcademico||'—'}</strong></span>`);
  }
  return partes.length ? partes.join('<br>') : '<span style="color:#ccc;font-size:0.78rem;">sin diff</span>';
}

// ─── Render detalle ───────────────────────────────────────────────────────────

function renderHistDetalle() {
  // Solo registros del panel de calificaciones (tienen parciales/faltas)
  const califDatos = _histDetalleDatos.filter(_esRegistroCalif);
  const sospechosos = califDatos.filter(d => _esSospechoso(d.antes, d.despues));

  const mostrar = _histSoloSospechosos ? sospechosos : califDatos;

  // Header con stats + botón de filtro
  document.getElementById('histStats').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="background:#bf360c;color:white;padding:5px 14px;border-radius:8px;
        font-size:0.9rem;font-weight:700;">${_histMatActual}</span>

      <span style="background:#e3f2fd;color:#1565c0;border:1px solid #1565c040;
        padding:4px 12px;border-radius:8px;font-size:0.8rem;font-weight:600;">
        ${califDatos.length} cambios en calificaciones/faltas
      </span>

      ${sospechosos.length > 0 ? `
        <span style="background:#fff3e0;color:#e65100;border:1px solid #e6510040;
          padding:4px 12px;border-radius:8px;font-size:0.8rem;font-weight:700;">
          ⚠ ${sospechosos.length} sospechosos
        </span>` : `
        <span style="background:#e8f5e9;color:#2e7d32;border:1px solid #2e7d3240;
          padding:4px 12px;border-radius:8px;font-size:0.8rem;font-weight:600;">
          ✓ Sin irregularidades detectadas
        </span>`}

      <button onclick="histToggleSospechosos()"
        style="margin-left:auto;padding:5px 14px;border-radius:8px;font-size:0.82rem;
          font-weight:600;cursor:pointer;transition:all 0.2s;
          background:${_histSoloSospechosos ? '#e65100' : '#fff3e0'};
          color:${_histSoloSospechosos ? 'white' : '#e65100'};
          border:2px solid #e65100${_histSoloSospechosos ? '' : '80'};">
        ${_histSoloSospechosos ? '⚠ Mostrando solo sospechosos' : '⚠ Solo sospechosos'}
      </button>
    </div>`;

  if (mostrar.length === 0) {
    document.getElementById('histTabla').innerHTML =
      `<div style="text-align:center;padding:30px;color:#999;">
        ${_histSoloSospechosos ? 'No hay registros sospechosos en esta materia.' : 'Sin cambios de calificaciones/faltas para esta materia.'}
      </div>`;
    return;
  }

  function formatFecha(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
      + '<br><span style="color:#aaa;font-size:0.72rem;">'
      + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) + '</span>';
  }

  function rolChip(rol) {
    const cfg = rol === 'coordinador'
      ? { bg:'#1565c020', color:'#1565c0', label:'Coordinador' }
      : { bg:'#bf360c18', color:'#bf360c', label:'Ctrl. Escolar' };
    return `<span style="background:${cfg.bg};color:${cfg.color};padding:2px 7px;
      border-radius:10px;font-size:0.7rem;font-weight:700;">${cfg.label}</span>`;
  }

  document.getElementById('histTabla').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
      <thead>
        <tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;white-space:nowrap;width:1%"></th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;white-space:nowrap;">Fecha</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Alumno</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Carrera</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Operador</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Cambio</th>
        </tr>
      </thead>
      <tbody>
        ${mostrar.map((d, i) => {
          const sosp = _esSospechoso(d.antes, d.despues);
          const rowBg = sosp ? '#fff8f0' : (i%2===1 ? '#fafafa' : '');
          const borderL = sosp ? 'border-left:3px solid #e65100;' : '';
          return `
          <tr style="border-bottom:1px solid #f0f0f0;background:${rowBg};${borderL}">
            <td style="padding:8px 6px;text-align:center;vertical-align:top;">
              ${sosp ? '<span title="Cambio sospechoso" style="font-size:1rem;">⚠</span>' : ''}
            </td>
            <td style="padding:8px 10px;color:#777;white-space:nowrap;vertical-align:top;">${formatFecha(d.fechaCambio)}</td>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="font-weight:600;color:#333;">${d.alumnoNombre || '—'}</div>
              <div style="font-size:0.72rem;color:#aaa;">${d.periodo || ''}</div>
            </td>
            <td style="padding:8px 10px;vertical-align:top;">
              <span style="background:#bf360c;color:white;padding:2px 8px;border-radius:8px;
                font-size:0.75rem;font-weight:700;">${d.carreraId || '—'}</span>
            </td>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="font-weight:600;color:#333;font-size:0.82rem;">${d.cambiadoPorNombre || '—'}</div>
              <div style="margin-top:3px;">${rolChip(d.cambiadoPorRol)}</div>
            </td>
            <td style="padding:8px 10px;vertical-align:top;line-height:1.7;">${_diffCalifFaltas(d.antes, d.despues)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="text-align:right;padding:8px 6px 2px;font-size:0.76rem;color:#bbb;">
      ${mostrar.length} de ${califDatos.length} registros
    </div>
  `;
}

function histToggleSospechosos() {
  _histSoloSospechosos = !_histSoloSospechosos;
  renderHistDetalle();
}

function volverALista() {
  _histMatActual       = '';
  _histDetalleDatos    = [];
  _histSoloSospechosos = false;
  _uiEstadoLista();
  renderHistLista();
}

// ─── Recalcular resumen ───────────────────────────────────────────────────────
// Lee TODO registroCambios una sola vez, aplica el filtro null→algo,
// guarda el resumen en config/cambiosResumen.

async function recalcularResumen() {
  if (!confirm('Esto leerá todos los documentos de registroCambios.\n¿Continuar?')) return;

  const btn = document.getElementById('histBtnRecalcular');
  btn.disabled = true;
  btn.textContent = 'Calculando...';
  _uiEstadoLista();
  document.getElementById('histStats').innerHTML =
    '<div style="text-align:center;padding:30px;color:#999;">Leyendo todos los registros — puede tardar unos segundos...</div>';
  document.getElementById('histTabla').innerHTML = '';

  try {
    const snap = await db.collection('registroCambios').get();

    const porCarrera  = {};
    const porOperador = {};
    const porMateria  = {};
    const porPeriodo  = {};
    let total = 0;
    let totalBruto = 0;

    snap.forEach(doc => {
      totalBruto++;
      const d = doc.data();
      // Excluir null→algo
      const antP = (d.antes  && d.antes.promedio  !== undefined) ? d.antes.promedio  : null;
      const desP = (d.despues && d.despues.promedio !== undefined) ? d.despues.promedio : null;
      if (antP === null && desP !== null) return;

      total++;
      const c   = d.carreraId         || 'Sin carrera';
      const op  = d.cambiadoPorNombre || d.cambiadoPor || 'Desconocido';
      const mat = d.materiaNombre     || d.materiaId   || 'Sin materia';
      const per = d.periodo           || 'Sin periodo';

      porCarrera[c]   = (porCarrera[c]   || 0) + 1;
      porOperador[op] = (porOperador[op] || 0) + 1;
      porMateria[mat] = (porMateria[mat] || 0) + 1;
      porPeriodo[per] = (porPeriodo[per] || 0) + 1;
    });

    const materias = Object.entries(porMateria)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, count]) => ({ nombre, count }));

    const porOperadorArr = Object.entries(porOperador)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nombre, count]) => ({ nombre, count }));

    const porPeriodoArr = Object.entries(porPeriodo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([periodo, count]) => ({ periodo, count }));

    const resumen = {
      total, totalBruto,
      materias,
      porCarrera,
      porOperador: porOperadorArr,
      porPeriodo:  porPeriodoArr,
      fechaCalculo: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('config').doc('cambiosResumen').set(resumen);

    _histResumen = { ...resumen, fechaCalculo: new Date() };
    renderHistLista();

  } catch (e) {
    document.getElementById('histStats').innerHTML =
      '<div style="color:#d32f2f;padding:16px;">Error al recalcular: ' + e.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Recalcular resumen';
  }
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function _uiEstadoLista() {
  document.getElementById('histFiltros').style.display = 'flex';
  document.getElementById('histBtnVolver').style.display = 'none';
  document.getElementById('histBuscarMateria').style.display = '';
  document.getElementById('histBuscarMateria').value = '';
}

function _uiEstadoDetalle() {
  document.getElementById('histFiltros').style.display = 'flex';
  document.getElementById('histBtnVolver').style.display = '';
  document.getElementById('histBuscarMateria').style.display = 'none';
}

console.log('historialCambios.js cargado');
