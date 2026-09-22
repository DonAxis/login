// Vigía — herramienta de mantenimiento puntual
// FASE ACTIVA: Detección + limpieza de materiaIds huérfanos en historialAcademico
// Huérfano = materiaId que está en historial pero ya NO existe en el catálogo de materias

// IDs huérfanos confirmados por la Fase 1 (Finanzas y Contabilidad)
const _ORPHAN_IDS = new Set([
  'zLmf6XH1Uu5Znv9TTT6M', // AUDITORIA 1 (FUNDAMENTOS) nnn        — periodo 6
  'DAu3zpUA75ZpEwDtKbwA',  // AUDITORIA 2 (CONTROL INTERNO)         — periodo 7
  'CbEOZiNdxR5nxpRVuIN9',  // FINANZAS I (INTRODUCCION)             — periodo 7
  'kga3RKQEIdRXfUmsXIYG',  // AUDITORIA III (...NNN)                — periodo 8
  'c3lTWSUcyuXDUdFogj1E',  // FINANZAS II (FINANZAS EN LA EMPRESA)  — periodo 8
  'r0hToVzsuzYDHmPyGTTS',  // FINANZAS II (FINANZAS EN LA EMPRESA)  — periodo 8
  'mdn9AEyAoV8aH3lFdD7x',  // SEMINARIO DE TTTULACION I             — periodo 8
  '1xCqcfg3WJiOwFKAySNz',  // FINANZAS III (INVERSION EN ACTIVOS)   — periodo 9
]);

async function accionVigia() {
  _vigiaAbrirPanel('Verificando calificaciones reales antes de limpiar…', true);

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

    // ── 2. Verificar que ningún doc de calificaciones tiene promedio real ─────
    // Para cada huérfano: query calificaciones where materiaId == id
    // Si alguno tiene promedio != null → ABORTAR, mostrar advertencia
    _vigiaSetHtml(`<p style="color:#555;">⏳ Verificando calificaciones (${_ORPHAN_IDS.size} IDs)…</p>`);

    const orphanArr   = Array.from(_ORPHAN_IDS);
    const calQueries  = orphanArr.map(mid =>
      db.collection('calificaciones').where('materiaId', '==', mid).get()
    );
    const calResults = await Promise.all(calQueries);

    const bloqueados = []; // { materiaId, alumnoId, promedio }
    calResults.forEach((snap, i) => {
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (d.promedio !== null && d.promedio !== undefined) {
          bloqueados.push({
            materiaId:    orphanArr[i],
            alumnoId:     d.alumnoId,
            alumnoNombre: d.alumnoNombre,
            promedio:     d.promedio
          });
        }
      });
    });

    if (bloqueados.length > 0) {
      let html = `
        <div style="padding:14px 16px; background:#ffebee; border:2px solid #c62828;
                    border-radius:8px; color:#c62828; font-weight:700; margin-bottom:16px;">
          ⛔ LIMPIEZA ABORTADA — se encontraron calificaciones reales en la colección
          <code>calificaciones</code> para algunos de los IDs huérfanos.<br>
          <span style="font-weight:400; font-size:0.88rem;">
            Estos datos no son artifacts y NO deben eliminarse automáticamente.
            Revisar manualmente caso por caso.
          </span>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <thead>
            <tr style="background:#c62828; color:white;">
              <th style="padding:7px 10px; text-align:left;">materiaId</th>
              <th style="padding:7px 10px; text-align:left;">Alumno</th>
              <th style="padding:7px 10px; text-align:center;">Promedio</th>
            </tr>
          </thead>
          <tbody>
            ${bloqueados.map((b, i) => `
              <tr style="background:${i % 2 ? '#fff' : '#fff8f8'}">
                <td style="padding:5px 10px; font-family:monospace; font-size:0.78rem;">${b.materiaId}</td>
                <td style="padding:5px 10px;">${b.alumnoNombre || b.alumnoId}</td>
                <td style="padding:5px 10px; text-align:center; font-weight:700;">${b.promedio}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      _vigiaSetHtml(html);
      return;
    }

    // ── 3. Cargar historialAcademico de la carrera ─────────────────────────────
    _vigiaSetHtml(`<p style="color:#555;">⏳ Verificación OK — cargando historiales…</p>`);

    const historialesSnap = await db.collection('historialAcademico')
      .where('carreraId', '==', carrera.id)
      .get();

    // ── 4. Identificar docs y entradas a eliminar ─────────────────────────────
    // afectados: [ { docId, alumnoNombre, materiasAEliminar: [{materiaId, materiaNombre, calificacion, periodoAcademico}] } ]
    const afectados = [];

    historialesSnap.docs.forEach(doc => {
      const hist     = doc.data();
      const huerfanas = (hist.materias || []).filter(m => _ORPHAN_IDS.has(m.materiaId));
      if (huerfanas.length === 0) return;
      afectados.push({
        docId:            doc.id,
        alumnoNombre:     hist.alumnoNombre || doc.id,
        matricula:        hist.matricula || '—',
        totalMaterias:    (hist.materias || []).length,
        materiasAEliminar: huerfanas.map(m => ({
          materiaId:        m.materiaId,
          materiaNombre:    m.materiaNombre || '(sin nombre)',
          calificacion:     m.calificacion  ?? null,
          periodoAcademico: m.periodoAcademico ?? null
        }))
      });
    });

    if (afectados.length === 0) {
      _vigiaSetHtml(`
        <div style="padding:14px 16px; background:#e8f5e9; border-radius:8px; color:#2e7d32; font-weight:700;">
          ✓ No se encontraron entradas huérfanas en historialAcademico para esta carrera.
          Nada que limpiar.
        </div>`);
      return;
    }

    // ── 5. Mostrar plan de limpieza + botón de confirmación ───────────────────
    const totalEntradas = afectados.reduce((s, a) => s + a.materiasAEliminar.length, 0);

    let html = `
      <div style="margin-bottom:16px; padding:12px 16px; background:#e8f5e9;
                  border:1px solid #66bb6a; border-radius:8px; font-size:0.9rem;">
        <strong style="color:#1b5e20;">✓ Verificación OK</strong> — ningún ID huérfano tiene
        calificación real en la colección <code>calificaciones</code>.<br>
        <strong>Los valores <code>calificacion: 0</code> son artifacts del vigia-0 (ver CLAUDE.md),
        no calificaciones reales.</strong>
      </div>

      <div style="margin-bottom:16px; padding:10px 14px; background:#fff3e0;
                  border:1px solid #ffb74d; border-radius:8px; font-size:0.88rem;">
        <strong>Carrera:</strong> ${carrera.nombre} &nbsp;|&nbsp;
        <strong>Alumnos afectados:</strong> ${afectados.length} &nbsp;|&nbsp;
        <strong>Entradas a eliminar:</strong> ${totalEntradas}
        &nbsp;(de ${_ORPHAN_IDS.size} IDs huérfanos)
      </div>

      <h4 style="margin:0 0 10px; color:#333; font-size:0.95rem;">
        Lo que se va a eliminar de <code>historialAcademico.materias[]</code>:
      </h4>`;

    afectados.forEach(a => {
      html += `
        <div style="margin-bottom:12px; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
          <div style="background:#f5f5f5; padding:8px 12px; font-size:0.88rem;">
            <strong>${a.alumnoNombre}</strong>
            <span style="color:#888; margin-left:8px;">Matrícula: ${a.matricula}</span>
            <span style="color:#888; margin-left:8px; font-size:0.8rem;">
              (${a.materiasAEliminar.length} entrada${a.materiasAEliminar.length > 1 ? 's' : ''}
              de ${a.totalMaterias} totales)
            </span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
            <thead>
              <tr style="background:#e0e0e0;">
                <th style="padding:5px 10px; text-align:left;">Nombre en historial (huérfano)</th>
                <th style="padding:5px 10px; text-align:center;">Cal</th>
                <th style="padding:5px 10px; text-align:center;">Ciclo</th>
              </tr>
            </thead>
            <tbody>
              ${a.materiasAEliminar.map((m, i) => `
                <tr style="background:${i % 2 ? '#fff' : '#fafafa'}; color:#c00;">
                  <td style="padding:4px 10px; border-bottom:1px solid #eee;">
                    <del>${m.materiaNombre}</del>
                  </td>
                  <td style="padding:4px 10px; border-bottom:1px solid #eee; text-align:center;">
                    ${m.calificacion !== null ? `<span style="color:#888">${m.calificacion} (artifact)</span>` : '—'}
                  </td>
                  <td style="padding:4px 10px; border-bottom:1px solid #eee; text-align:center;">
                    ${m.periodoAcademico ?? '—'}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    });

    html += `
      <div style="margin-top:20px; padding:14px 16px; background:#fff8e1;
                  border:1px solid #ffd54f; border-radius:8px; font-size:0.88rem; color:#5d4037;">
        ⚠️ Esta acción <strong>modifica Firestore</strong>: reescribe <code>materias[]</code>
        en ${afectados.length} documentos de <code>historialAcademico</code>.
        Las calificaciones en la colección <code>calificaciones</code> <strong>no se tocan</strong>.
      </div>
      <div style="margin-top:16px; text-align:center;">
        <button id="_vigiaBtn_ejecutar"
          onclick="_vigiaEjecutarLimpieza()"
          style="background:#c62828; color:white; border:none; border-radius:8px;
                 padding:12px 32px; font-size:1rem; font-weight:700; cursor:pointer;
                 box-shadow:0 2px 8px rgba(0,0,0,0.2);">
          Ejecutar limpieza (${afectados.length} documentos)
        </button>
      </div>`;

    // Guardar datos en variable global para el botón
    window._vigiaAfectados    = afectados;
    window._vigiaCarreraNombre = carrera.nombre;

    _vigiaSetHtml(html);

  } catch (e) {
    console.error('Error en accionVigia:', e);
    _vigiaSetHtml(`<p style="color:#c00;">Error: ${e.message}</p>`);
  }
}

async function _vigiaEjecutarLimpieza() {
  const afectados = window._vigiaAfectados;
  if (!afectados || afectados.length === 0) return;

  const btn = document.getElementById('_vigiaBtn_ejecutar');
  if (btn) { btn.disabled = true; btn.textContent = 'Ejecutando…'; }

  _vigiaSetHtml(`<p style="color:#555;">⏳ Escribiendo cambios en Firestore (${afectados.length} documentos)…</p>`);

  try {
    // Releer los docs actuales justo antes de escribir (estado fresco)
    const docIds  = afectados.map(a => a.docId);
    const snaps   = await Promise.all(docIds.map(id => db.collection('historialAcademico').doc(id).get()));

    const batch = db.batch();

    snaps.forEach(snap => {
      if (!snap.exists) return;
      const materiasActuales = snap.data().materias || [];
      const materiasFiltradas = materiasActuales.filter(m => !_ORPHAN_IDS.has(m.materiaId));
      batch.update(snap.ref, { materias: materiasFiltradas });
    });

    await batch.commit();

    // Resumen de éxito
    const totalEliminadas = afectados.reduce((s, a) => s + a.materiasAEliminar.length, 0);
    let html = `
      <div style="padding:16px 20px; background:#e8f5e9; border:2px solid #2e7d32;
                  border-radius:10px; color:#1b5e20; margin-bottom:20px;">
        <div style="font-size:1.2rem; font-weight:700; margin-bottom:6px;">
          ✅ Limpieza completada
        </div>
        <div style="font-size:0.9rem;">
          Se eliminaron <strong>${totalEliminadas} entradas huérfanas</strong>
          de <strong>${afectados.length} documentos</strong> en
          <code>historialAcademico</code>.<br>
          La boleta de calificaciones de ${window._vigiaCarreraNombre} ya no
          mostrará materias duplicadas.
        </div>
      </div>
      <h4 style="margin:0 0 10px; font-size:0.93rem; color:#333;">Alumnos actualizados:</h4>
      <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
        <thead>
          <tr style="background:#2e7d32; color:white;">
            <th style="padding:7px 10px; text-align:left;">Alumno</th>
            <th style="padding:7px 10px; text-align:center;">Matrícula</th>
            <th style="padding:7px 10px; text-align:center;">Entradas eliminadas</th>
          </tr>
        </thead>
        <tbody>
          ${afectados.map((a, i) => `
            <tr style="background:${i % 2 ? '#fff' : '#f1f8e9'}">
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9;">${a.alumnoNombre}</td>
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9; text-align:center;">${a.matricula}</td>
              <td style="padding:6px 10px; border-bottom:1px solid #c8e6c9; text-align:center;
                         font-weight:700; color:#2e7d32;">${a.materiasAEliminar.length}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    _vigiaSetHtml(html);
    window._vigiaAfectados    = null;
    window._vigiaCarreraNombre = null;

  } catch (e) {
    console.error('Error en _vigiaEjecutarLimpieza:', e);
    _vigiaSetHtml(`<p style="color:#c00;">Error al escribir en Firestore: ${e.message}</p>`);
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
