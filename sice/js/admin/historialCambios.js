// historialCambios.js
// Auditoría de cambios manuales de calificaciones (colección registroCambios)

let _histDatos = [];
let _histFiltroCarrera = '';
let _histFiltroOperador = '';

function mostrarHistorialCambios() {
  document.getElementById('modalHistorialCambios').style.display = 'block';
  cargarHistorialCambios();
}

function cerrarHistorialCambios() {
  document.getElementById('modalHistorialCambios').style.display = 'none';
}

async function cargarHistorialCambios() {
  const contStats  = document.getElementById('histStats');
  const contTabla  = document.getElementById('histTabla');
  const contFiltros = document.getElementById('histFiltros');

  contStats.innerHTML  = '<div style="text-align:center;padding:20px;color:#999;">Cargando registros...</div>';
  contTabla.innerHTML  = '';
  contFiltros.style.display = 'none';
  _histFiltroCarrera  = '';
  _histFiltroOperador = '';

  try {
    const snap = await db.collection('registroCambios')
      .orderBy('fechaCambio', 'desc')
      .get();

    _histDatos = [];
    snap.forEach(doc => _histDatos.push({ id: doc.id, ...doc.data() }));

    renderHistStats();
    renderHistTabla();
    contFiltros.style.display = 'flex';
  } catch (e) {
    contStats.innerHTML = '<div style="color:#d32f2f;padding:16px;">Error al cargar: ' + e.message + '</div>';
  }
}

function renderHistStats() {
  const datos = _histDatos;
  const total = datos.length;

  const porCarrera  = {};
  const porOperador = {};
  const porMateria  = {};
  const porPeriodo  = {};

  datos.forEach(d => {
    const c   = d.carreraId         || 'Sin carrera';
    const op  = d.cambiadoPorNombre || d.cambiadoPor || 'Desconocido';
    const mat = d.materiaNombre     || d.materiaId   || 'Sin materia';
    const per = d.periodo           || 'Sin periodo';

    porCarrera[c]   = (porCarrera[c]   || 0) + 1;
    porOperador[op] = (porOperador[op] || 0) + 1;
    porMateria[mat] = (porMateria[mat] || 0) + 1;
    porPeriodo[per] = (porPeriodo[per] || 0) + 1;
  });

  // Poblar selects de filtro
  const selC = document.getElementById('histSelCarrera');
  const selO = document.getElementById('histSelOperador');
  selC.innerHTML = '<option value="">Todas las carreras</option>';
  Object.keys(porCarrera).sort().forEach(c =>
    selC.innerHTML += `<option value="${c}">${c} (${porCarrera[c]})</option>`
  );
  selO.innerHTML = '<option value="">Todos los operadores</option>';
  Object.entries(porOperador).sort((a,b) => b[1]-a[1]).forEach(([op, n]) =>
    selO.innerHTML += `<option value="${op}">${op} (${n})</option>`
  );

  if (total === 0) {
    document.getElementById('histStats').innerHTML =
      '<div style="text-align:center;padding:30px;color:#999;">No hay cambios registrados todavía.</div>';
    return;
  }

  const topOps      = Object.entries(porOperador).sort((a,b)=>b[1]-a[1]).slice(0, 6);
  const topMaterias = Object.entries(porMateria).sort((a,b)=>b[1]-a[1]).slice(0, 6);
  const topPeriodos = Object.entries(porPeriodo).sort((a,b)=>b[1]-a[1]).slice(0, 5);

  function chip(label, n, color) {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:14px;font-size:0.79rem;white-space:nowrap;border:1px solid ${color}40;background:${color}12;">
      <strong style="color:${color};">${label}</strong><span style="color:#555;">${n}</span>
    </span>`;
  }

  function rankRow(label, n, color) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.82rem;border-bottom:1px solid #f0f0f0;">
      <span style="color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;" title="${label}">${label}</span>
      <span style="background:${color};color:white;padding:1px 8px;border-radius:10px;font-weight:700;font-size:0.73rem;margin-left:8px;flex-shrink:0;">${n}</span>
    </div>`;
  }

  document.getElementById('histStats').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;">

      <!-- Total -->
      <div style="background:linear-gradient(135deg,#bf360c,#e64a19);color:white;padding:16px 22px;border-radius:12px;min-width:130px;text-align:center;box-shadow:0 4px 14px rgba(191,54,12,0.35);flex-shrink:0;">
        <div style="font-size:2.4rem;font-weight:700;line-height:1;">${total}</div>
        <div style="font-size:0.78rem;opacity:0.9;margin-top:4px;">cambios registrados</div>
      </div>

      <!-- Por Carrera -->
      <div style="flex:1;min-width:200px;background:#fff8f0;border-radius:12px;padding:12px 16px;border-left:4px solid #e64a19;">
        <div style="font-size:0.72rem;font-weight:700;color:#bf360c;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px;">Por Carrera</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;">
          ${Object.entries(porCarrera).sort((a,b)=>b[1]-a[1]).map(([c,n])=>chip(c,n,'#e64a19')).join('')}
        </div>
      </div>

      <!-- Por Periodo -->
      <div style="flex:1;min-width:180px;background:#fce4ec;border-radius:12px;padding:12px 16px;border-left:4px solid #c2185b;">
        <div style="font-size:0.72rem;font-weight:700;color:#c2185b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px;">Por Periodo Académico</div>
        ${topPeriodos.map(([p,n])=>rankRow(p,n,'#c2185b')).join('')}
      </div>

      <!-- Top Operadores -->
      <div style="flex:1;min-width:200px;background:#f3e5f5;border-radius:12px;padding:12px 16px;border-left:4px solid #7b1fa2;">
        <div style="font-size:0.72rem;font-weight:700;color:#7b1fa2;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px;">Más cambios por operador</div>
        ${topOps.map(([op,n])=>rankRow(op,n,'#7b1fa2')).join('')}
      </div>

      <!-- Top Materias -->
      <div style="flex:1;min-width:220px;background:#e8f5e9;border-radius:12px;padding:12px 16px;border-left:4px solid #2e7d32;">
        <div style="font-size:0.72rem;font-weight:700;color:#2e7d32;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px;">Materias más editadas</div>
        ${topMaterias.map(([mat,n])=>rankRow(mat,n,'#2e7d32')).join('')}
      </div>

    </div>
  `;
}

function renderHistTabla() {
  let datos = _histDatos;
  if (_histFiltroCarrera)  datos = datos.filter(d => d.carreraId === _histFiltroCarrera);
  if (_histFiltroOperador) datos = datos.filter(d => (d.cambiadoPorNombre || d.cambiadoPor) === _histFiltroOperador);

  const cont = document.getElementById('histTabla');

  if (datos.length === 0) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">Sin registros para los filtros seleccionados.</div>';
    return;
  }

  function formatFecha(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
      + '<br><span style="color:#aaa;font-size:0.72rem;">'
      + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) + '</span>';
  }

  function diffCambio(antes, despues) {
    if (!antes || !despues) return '<span style="color:#ccc;">—</span>';
    const partes = [];

    const ap = antes.promedio  !== undefined ? antes.promedio  : null;
    const dp = despues.promedio !== undefined ? despues.promedio : null;
    if (String(ap) !== String(dp)) {
      const as = ap === null ? '<span style="color:#bbb;">—</span>' : `<span style="color:#999;">${ap}</span>`;
      const ds = dp === null ? '<span style="color:#bbb;">—</span>' : `<strong style="color:#bf360c;">${dp}</strong>`;
      partes.push(`${as} → ${ds}`);
    }

    if (antes.acreditacion !== despues.acreditacion) {
      const a = antes.acreditacion  || '—';
      const d = despues.acreditacion || '—';
      partes.push(`<span style="font-size:0.74rem;color:#666;">${a} → <strong style="color:#1565c0;">${d}</strong></span>`);
    }

    if (antes.periodoAcademico !== despues.periodoAcademico) {
      const a = antes.periodoAcademico  || '—';
      const d = despues.periodoAcademico || '—';
      partes.push(`<span style="font-size:0.72rem;color:#888;">período: ${a} → <strong>${d}</strong></span>`);
    }

    return partes.length ? partes.join('<br>') : '<span style="color:#ccc;font-size:0.78rem;">sin diff</span>';
  }

  function rolChip(rol) {
    const cfg = rol === 'coordinador'
      ? { bg:'#1565c020', color:'#1565c0', label:'Coordinador' }
      : { bg:'#bf360c18', color:'#bf360c', label:'Ctrl. Escolar' };
    return `<span style="background:${cfg.bg};color:${cfg.color};padding:2px 7px;border-radius:10px;font-size:0.7rem;font-weight:700;">${cfg.label}</span>`;
  }

  cont.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
      <thead>
        <tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;white-space:nowrap;">Fecha</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Alumno</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Materia</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Carrera</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Operador</th>
          <th style="padding:9px 10px;text-align:left;color:#555;font-weight:700;border-bottom:2px solid #e0e0e0;">Cambio</th>
        </tr>
      </thead>
      <tbody>
        ${datos.map((d, i) => `
          <tr style="border-bottom:1px solid #f0f0f0;${i%2===1?'background:#fafafa;':''}">
            <td style="padding:8px 10px;color:#777;white-space:nowrap;vertical-align:top;">${formatFecha(d.fechaCambio)}</td>
            <td style="padding:8px 10px;color:#333;vertical-align:top;max-width:160px;">
              <div style="font-weight:600;">${d.alumnoNombre || '—'}</div>
              <div style="font-size:0.72rem;color:#aaa;margin-top:1px;">${d.periodo || ''}</div>
            </td>
            <td style="padding:8px 10px;color:#333;vertical-align:top;max-width:180px;">
              <div title="${d.materiaNombre||''}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.materiaNombre || '—'}</div>
            </td>
            <td style="padding:8px 10px;vertical-align:top;">
              <span style="background:#bf360c;color:white;padding:2px 8px;border-radius:8px;font-size:0.75rem;font-weight:700;">${d.carreraId || '—'}</span>
            </td>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="font-weight:600;color:#333;font-size:0.82rem;">${d.cambiadoPorNombre || '—'}</div>
              <div style="margin-top:3px;">${rolChip(d.cambiadoPorRol)}</div>
            </td>
            <td style="padding:8px 10px;vertical-align:top;line-height:1.6;">${diffCambio(d.antes, d.despues)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align:right;padding:8px 6px 2px;font-size:0.76rem;color:#bbb;">${datos.length} de ${_histDatos.length} registros</div>
  `;
}

function histFiltrarCarrera(val) {
  _histFiltroCarrera = val;
  renderHistTabla();
}

function histFiltrarOperador(val) {
  _histFiltroOperador = val;
  renderHistTabla();
}

console.log('historialCambios.js cargado');
