// Vigía — herramienta de mantenimiento puntual
// FASE ACTIVA: Detección de materias fantasma en Finanzas y Contabilidad (solo lectura)

async function accionVigia() {
  _vigiaAbrirPanel('Detectando materias sin calificaciones...', true);

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

    // ── 2. Cargar todas las materias de la carrera ────────────────────────────
    const materiasSnap = await db.collection('materias')
      .where('carreraId', '==', carrera.id)
      .get();

    const materias = materiasSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const pa = Number(a.periodo) || 0, pb = Number(b.periodo) || 0;
        return pa !== pb ? pa - pb : (a.nombre || '').localeCompare(b.nombre || '');
      });

    if (materias.length === 0) {
      _vigiaSetHtml(`<p style="color:#c00;">No se encontraron materias para <strong>${carrera.nombre}</strong>.</p>`);
      return;
    }

    _vigiaSetHtml(`<p style="color:#555;">Carrera: <strong>${carrera.nombre}</strong> (${carrera.id})<br>
      Materias encontradas: <strong>${materias.length}</strong><br>
      Consultando calificaciones... (${materias.length} queries, espera un momento)</p>`);

    // ── 3. Verificar existencia de calificaciones para cada materia ───────────
    // limit(1) → barato: solo necesitamos saber si existe al menos un doc
    const checks = await Promise.all(
      materias.map(async mat => {
        const snap = await db.collection('calificaciones')
          .where('materiaId', '==', mat.id)
          .limit(1)
          .get();
        return { ...mat, tieneCal: !snap.empty };
      })
    );

    const conCal  = checks.filter(m => m.tieneCal);
    const sinCal  = checks.filter(m => !m.tieneCal);

    // ── 4. Construir reporte HTML ─────────────────────────────────────────────
    // Agrupar por periodo
    const porPeriodo = {};
    checks.forEach(m => {
      const p = Number(m.periodo) || 0;
      if (!porPeriodo[p]) porPeriodo[p] = [];
      porPeriodo[p].push(m);
    });
    const periodos = Object.keys(porPeriodo).map(Number).sort((a, b) => a - b);

    let html = `
      <div style="margin-bottom:14px; padding:10px 14px; background:#e3f2fd; border-radius:8px; font-size:0.9rem;">
        <strong>Carrera:</strong> ${carrera.nombre} &nbsp;|&nbsp;
        <strong>Total materias:</strong> ${materias.length} &nbsp;|&nbsp;
        <span style="color:#2e7d32; font-weight:700;">✓ Con calificaciones: ${conCal.length}</span> &nbsp;|&nbsp;
        <span style="color:#c62828; font-weight:700;">✗ Sin calificaciones: ${sinCal.length}</span>
      </div>
      <p style="font-size:0.82rem; color:#666; margin-bottom:12px;">
        🟢 Al menos un alumno tiene calificación registrada &nbsp; 🔴 Ningún alumno tiene calificación
      </p>`;

    periodos.forEach(p => {
      const mats = porPeriodo[p];
      const label = p === 0 ? 'Sin periodo' : `Periodo ${p}`;
      const haySinCal = mats.some(m => !m.tieneCal);
      const headerColor = haySinCal ? '#b71c1c' : '#1b5e20';
      html += `
        <div style="margin-bottom:6px; margin-top:14px; font-weight:700; font-size:0.9rem;
                    color:${headerColor}; border-bottom:2px solid ${headerColor}; padding-bottom:3px;">
          ${label} &nbsp;<span style="font-weight:400; font-size:0.8rem;">(${mats.length} materias)</span>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-bottom:4px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:5px 8px; text-align:left; border:1px solid #e0e0e0;">Estado</th>
              <th style="padding:5px 8px; text-align:left; border:1px solid #e0e0e0;">Nombre</th>
              <th style="padding:5px 8px; text-align:left; border:1px solid #e0e0e0;">materiaId</th>
              <th style="padding:5px 8px; text-align:center; border:1px solid #e0e0e0;">Activo</th>
            </tr>
          </thead>
          <tbody>`;

      mats.forEach(m => {
        const bg    = m.tieneCal ? '#f1f8e9' : '#ffebee';
        const icon  = m.tieneCal ? '🟢' : '🔴';
        const activ = m.activo === false ? '<span style="color:#c62828;">NO</span>' : 'sí';
        html += `
            <tr style="background:${bg};">
              <td style="padding:5px 8px; border:1px solid #e0e0e0; text-align:center;">${icon}</td>
              <td style="padding:5px 8px; border:1px solid #e0e0e0;">${m.nombre || '—'}</td>
              <td style="padding:5px 8px; border:1px solid #e0e0e0; font-family:monospace; font-size:0.78rem; color:#555;">${m.id}</td>
              <td style="padding:5px 8px; border:1px solid #e0e0e0; text-align:center;">${activ}</td>
            </tr>`;
      });

      html += `</tbody></table>`;
    });

    // ── 5. Lista final de candidatos a eliminar ───────────────────────────────
    if (sinCal.length > 0) {
      html += `
        <div style="margin-top:20px; padding:14px 16px; background:#fff3e0; border:2px solid #ff9800;
                    border-radius:8px;">
          <h4 style="margin:0 0 10px; color:#e65100;">
            Candidatos a eliminar (${sinCal.length} materias — ningún alumno tiene calificación)
          </h4>
          <p style="font-size:0.82rem; color:#666; margin:0 0 10px;">
            Revisa esta lista contra la boleta. Si confirmas que son duplicados, pasa a la Fase 2.
          </p>
          <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
              <tr style="background:#e65100; color:white;">
                <th style="padding:6px 10px; text-align:left;">#</th>
                <th style="padding:6px 10px; text-align:left;">Nombre</th>
                <th style="padding:6px 10px; text-align:center;">Periodo</th>
                <th style="padding:6px 10px; text-align:left;">materiaId</th>
                <th style="padding:6px 10px; text-align:center;">activo</th>
              </tr>
            </thead>
            <tbody>`;

      sinCal.forEach((m, i) => {
        const activ = m.activo === false
          ? '<span style="color:#c62828; font-weight:700;">false</span>'
          : '<span style="color:#2e7d32;">true</span>';
        html += `
              <tr style="background:${i % 2 === 0 ? '#fff8e1' : '#fff3e0'};">
                <td style="padding:5px 10px; border-bottom:1px solid #ffe0b2;">${i + 1}</td>
                <td style="padding:5px 10px; border-bottom:1px solid #ffe0b2;">${m.nombre || '—'}</td>
                <td style="padding:5px 10px; border-bottom:1px solid #ffe0b2; text-align:center;">${m.periodo || '—'}</td>
                <td style="padding:5px 10px; border-bottom:1px solid #ffe0b2; font-family:monospace; font-size:0.78rem;">${m.id}</td>
                <td style="padding:5px 10px; border-bottom:1px solid #ffe0b2; text-align:center;">${activ}</td>
              </tr>`;
      });

      html += `
            </tbody>
          </table>
          <p style="margin:12px 0 0; font-size:0.8rem; color:#888;">
            ⚠️ Solo lectura — ningún dato fue modificado. Comparte esta lista antes de ejecutar la Fase 2.
          </p>
        </div>`;
    } else {
      html += `
        <div style="margin-top:16px; padding:12px 16px; background:#e8f5e9; border-radius:8px; color:#2e7d32; font-weight:700;">
          ✓ No se encontraron materias sin calificaciones. No hay duplicados que limpiar.
        </div>`;
    }

    _vigiaSetHtml(html);

  } catch (e) {
    console.error('Error en accionVigia:', e);
    _vigiaSetHtml(`<p style="color:#c00;">Error: ${e.message}</p>`);
  }
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function _vigiaAbrirPanel(mensajeInicial, spinner) {
  let panel = document.getElementById('_vigiaPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = '_vigiaPanel';
    panel.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999;
      background:rgba(0,0,0,0.55); display:flex; align-items:flex-start;
      justify-content:center; padding:30px 16px; overflow-y:auto;`;
    panel.innerHTML = `
      <div style="background:white; border-radius:14px; width:100%; max-width:860px;
                  box-shadow:0 8px 40px rgba(0,0,0,0.3); padding:28px 30px; position:relative;">
        <button onclick="document.getElementById('_vigiaPanel').remove()"
          style="position:absolute; top:14px; right:16px; background:#eee; border:none;
                 border-radius:6px; padding:6px 14px; cursor:pointer; font-size:0.9rem; font-weight:600;">
          ✕ Cerrar
        </button>
        <h2 style="margin:0 0 4px; color:#1b5e20; font-size:1.15rem;">Vigía — Detección (solo lectura)</h2>
        <p style="margin:0 0 18px; color:#888; font-size:0.83rem;">
          Fase 1 · Materias sin calificaciones · Finanzas y Contabilidad
        </p>
        <div id="_vigiaContenido">
          ${spinner ? '<p style="color:#555;">⏳ ' + mensajeInicial + '</p>' : mensajeInicial}
        </div>
      </div>`;
    document.body.appendChild(panel);
  }
}

function _vigiaSetHtml(html) {
  const el = document.getElementById('_vigiaContenido');
  if (el) el.innerHTML = html;
}
