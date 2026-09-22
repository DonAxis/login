// Vigía — herramienta de mantenimiento puntual
// FASE ACTIVA: Detección de materiaIds huérfanos en historialAcademico (solo lectura)
// Huérfano = materiaId que está en historial pero ya NO existe en el catálogo de materias

async function accionVigia() {
  _vigiaAbrirPanel('Escaneando historialAcademico...', true);

  try {
    // ── 1. Localizar carrera Finanzas y Contabilidad ──────────────────────────
    const carrerasSnap = await db.collection('carreras').get();
    const carrera = carrerasSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .find(c => (c.nombre || '').toLowerCase().includes('finanzas'));

    if (!carrera) {
      _vigiaSetHtml('<p style="color:#c00;">No se encontró ninguna carrera con "finanzas" en el nombre.</p>');
      return;
    }

    // ── 2. Construir set de materiaIds válidos del catálogo actual ────────────
    const materiasSnap = await db.collection('materias')
      .where('carreraId', '==', carrera.id)
      .get();

    const catalogoValido = new Set(materiasSnap.docs.map(d => d.id));

    _vigiaSetHtml(`<p style="color:#555;">
      ⏳ Catálogo: <strong>${catalogoValido.size}</strong> materias válidas.<br>
      Cargando historiales de la carrera...
    </p>`);

    // ── 3. Cargar todos los historialAcademico de la carrera ──────────────────
    const historialesSnap = await db.collection('historialAcademico')
      .where('carreraId', '==', carrera.id)
      .get();

    _vigiaSetHtml(`<p style="color:#555;">
      ⏳ ${historialesSnap.size} historiales cargados. Buscando huérfanos...
    </p>`);

    // ── 4. Detectar entradas huérfanas ────────────────────────────────────────
    // orphanStats: { [materiaId]: { nombre, periodo, contSinCal, contConCal, alumnos[] } }
    const orphanStats = {};

    historialesSnap.docs.forEach(doc => {
      const hist          = doc.data();
      const alumnoNombre  = hist.alumnoNombre || doc.id;

      (hist.materias || []).forEach(m => {
        if (!m.materiaId || catalogoValido.has(m.materiaId)) return; // válida → ignorar

        if (!orphanStats[m.materiaId]) {
          orphanStats[m.materiaId] = {
            nombre:     m.materiaNombre || '(sin nombre)',
            periodo:    m.periodo ?? null,
            alumnos:    []
          };
        }

        orphanStats[m.materiaId].alumnos.push({
          alumnoId:        doc.id,
          alumnoNombre,
          calificacion:    m.calificacion    ?? null,
          periodoAcademico:m.periodoAcademico ?? null,
          acr:             m.acr             ?? null
        });
      });
    });

    const orphanIds = Object.keys(orphanStats);

    if (orphanIds.length === 0) {
      _vigiaSetHtml(`
        <div style="padding:14px 16px; background:#e8f5e9; border-radius:8px; color:#2e7d32; font-weight:700;">
          ✓ No hay materiaIds huérfanos en historialAcademico para esta carrera.
        </div>
        <p style="margin-top:10px; font-size:0.85rem; color:#777;">
          Catálogo: ${catalogoValido.size} materias &nbsp;|&nbsp; Historiales escaneados: ${historialesSnap.size}
        </p>`);
      return;
    }

    // Ordenar por periodo, luego nombre
    orphanIds.sort((a, b) => {
      const pa = Number(orphanStats[a].periodo) || 0;
      const pb = Number(orphanStats[b].periodo) || 0;
      return pa !== pb ? pa - pb : orphanStats[a].nombre.localeCompare(orphanStats[b].nombre);
    });

    // Clasificar: seguros (todos los alumnos tienen cal=null) vs con calificación (revisar)
    const seguros = orphanIds.filter(id =>
      orphanStats[id].alumnos.every(a => a.calificacion === null && a.periodoAcademico === null)
    );
    const conCal = orphanIds.filter(id =>
      orphanStats[id].alumnos.some(a => a.calificacion !== null || a.periodoAcademico !== null)
    );

    // ── 5. Reporte HTML ───────────────────────────────────────────────────────
    let html = `
      <div style="margin-bottom:14px; padding:10px 14px; background:#fff3e0;
                  border:1px solid #ffb74d; border-radius:8px; font-size:0.9rem;">
        <strong>Carrera:</strong> ${carrera.nombre} (${carrera.id})<br>
        <strong>Historiales escaneados:</strong> ${historialesSnap.size} &nbsp;|&nbsp;
        <strong>Catálogo actual:</strong> ${catalogoValido.size} materias<br>
        <strong>materiaIds huérfanos:</strong> ${orphanIds.length} total &nbsp;—&nbsp;
        <span style="color:#2e7d32; font-weight:700;">
          ${seguros.length} seguros de eliminar
        </span> &nbsp;|&nbsp;
        <span style="color:#c62828; font-weight:700;">
          ${conCal.length} con calificación (revisar)
        </span>
      </div>`;

    // ── SEGUROS ───────────────────────────────────────────────────────────────
    if (seguros.length > 0) {
      html += `
        <h4 style="color:#1b5e20; margin:16px 0 8px; font-size:0.95rem;">
          ✓ SEGUROS DE ELIMINAR — ningún alumno tiene calificación para estos IDs
        </h4>
        <p style="font-size:0.82rem; color:#666; margin-bottom:10px;">
          Aparecen en historialAcademico pero no existen en el catálogo actual.
          Todos los alumnos que los tienen tienen <code>calificacion: null</code> y
          <code>periodoAcademico: null</code>.
        </p>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-bottom:6px;">
          <thead>
            <tr style="background:#1b5e20; color:white;">
              <th style="padding:7px 10px; text-align:left;">Nombre en historial</th>
              <th style="padding:7px 10px; text-align:center;">Periodo</th>
              <th style="padding:7px 10px; text-align:center;">Alumnos afectados</th>
              <th style="padding:7px 10px; text-align:left;">materiaId (huérfano)</th>
            </tr>
          </thead>
          <tbody>`;

      seguros.forEach((id, i) => {
        const o  = orphanStats[id];
        const bg = i % 2 === 0 ? '#f1f8e9' : '#e8f5e9';
        html += `
            <tr style="background:${bg};">
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9;">${o.nombre}</td>
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9; text-align:center;">${o.periodo ?? '—'}</td>
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9; text-align:center; font-weight:700; color:#2e7d32;">${o.alumnos.length}</td>
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9; font-family:monospace; font-size:0.78rem; color:#555;">${id}</td>
            </tr>`;
      });

      html += `</tbody></table>`;
    }

    // ── CON CALIFICACIÓN ──────────────────────────────────────────────────────
    if (conCal.length > 0) {
      html += `
        <h4 style="color:#c62828; margin:20px 0 8px; font-size:0.95rem;">
          ⚠ REQUIEREN REVISIÓN MANUAL — tienen calificación en historial
        </h4>
        <p style="font-size:0.82rem; color:#666; margin-bottom:10px;">
          Son huérfanos (no están en el catálogo) pero algún alumno tiene calificación
          registrada. No se deben eliminar sin revisar caso por caso.
        </p>`;

      conCal.forEach(id => {
        const o           = orphanStats[id];
        const afectados   = o.alumnos.filter(a => a.calificacion !== null || a.periodoAcademico !== null);
        html += `
          <div style="margin-bottom:12px; border:1px solid #ef9a9a; border-radius:8px; overflow:hidden;">
            <div style="background:#ffebee; padding:8px 12px; display:flex; gap:12px; align-items:baseline; flex-wrap:wrap;">
              <strong style="color:#c62828;">${o.nombre}</strong>
              <span style="font-size:0.8rem; color:#555;">Periodo ${o.periodo ?? '?'}</span>
              <span style="font-family:monospace; font-size:0.78rem; color:#888;">${id}</span>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
              <thead>
                <tr style="background:#ffcdd2;">
                  <th style="padding:5px 10px; text-align:left;">Alumno</th>
                  <th style="padding:5px 10px; text-align:center;">Cal</th>
                  <th style="padding:5px 10px; text-align:center;">ACR</th>
                  <th style="padding:5px 10px; text-align:center;">Ciclo</th>
                </tr>
              </thead>
              <tbody>
                ${afectados.map(a => `
                  <tr style="border-bottom:1px solid #ffcdd2;">
                    <td style="padding:4px 10px;">${a.alumnoNombre}</td>
                    <td style="padding:4px 10px; text-align:center; font-weight:bold;">${a.calificacion ?? '-'}</td>
                    <td style="padding:4px 10px; text-align:center;">${a.acr ?? '-'}</td>
                    <td style="padding:4px 10px; text-align:center;">${a.periodoAcademico ?? '-'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      });
    }

    html += `
      <div style="margin-top:16px; padding:10px 14px; background:#e3f2fd; border-radius:8px; font-size:0.82rem; color:#555;">
        ⚠️ <strong>Solo lectura</strong> — ningún dato fue modificado.<br>
        Comparte los resultados para diseñar la Fase 2 (limpieza).
      </div>`;

    _vigiaSetHtml(html);

  } catch (e) {
    console.error('Error en accionVigia:', e);
    _vigiaSetHtml(`<p style="color:#c00;">Error: ${e.message}</p>`);
  }
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function _vigiaAbrirPanel(mensajeInicial, spinner) {
  let panel = document.getElementById('_vigiaPanel');
  if (panel) panel.remove();

  panel = document.createElement('div');
  panel.id = '_vigiaPanel';
  panel.style.cssText = `
    position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999;
    background:rgba(0,0,0,0.55); display:flex; align-items:flex-start;
    justify-content:center; padding:30px 16px; overflow-y:auto;`;
  panel.innerHTML = `
    <div style="background:white; border-radius:14px; width:100%; max-width:900px;
                box-shadow:0 8px 40px rgba(0,0,0,0.3); padding:28px 30px; position:relative;">
      <button onclick="document.getElementById('_vigiaPanel').remove()"
        style="position:absolute; top:14px; right:16px; background:#eee; border:none;
               border-radius:6px; padding:6px 14px; cursor:pointer; font-size:0.9rem; font-weight:600;">
        ✕ Cerrar
      </button>
      <h2 style="margin:0 0 4px; color:#1b5e20; font-size:1.15rem;">
        Vigía — Detección de huérfanos (solo lectura)
      </h2>
      <p style="margin:0 0 18px; color:#888; font-size:0.83rem;">
        Fase 1 · materiaIds en historialAcademico que no existen en el catálogo actual
      </p>
      <div id="_vigiaContenido">
        ${spinner ? '<p style="color:#555;">⏳ ' + mensajeInicial + '</p>' : mensajeInicial}
      </div>
    </div>`;
  document.body.appendChild(panel);
}

function _vigiaSetHtml(html) {
  const el = document.getElementById('_vigiaContenido');
  if (el) el.innerHTML = html;
}
