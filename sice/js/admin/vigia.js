// vigia.js
// Diagnóstico: detecta alumnos con calificaciones de una carrera incorrecta
// Se activa desde el botón "Acción Vigía" en el panel admin

function accionVigia() {
  _vigiaInyectarModal();
  document.getElementById('vigiaModal').style.display = 'flex';
  _vigiaEjecutarDiagnostico();
}

// ── Modal ──────────────────────────────────────────────────────────────────

function _vigiaInyectarModal() {
  if (document.getElementById('vigiaModal')) return;

  const html = `
  <div id="vigiaModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%;
       background:rgba(0,0,0,0.65); z-index:9000; align-items:flex-start; justify-content:center;
       overflow-y:auto; backdrop-filter:blur(3px);">
    <div style="background:white; padding:35px; border-radius:18px; max-width:1000px; width:95%;
                margin:40px auto; box-shadow:0 25px 80px rgba(0,0,0,0.4);">

      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center;
                  margin-bottom:20px; padding-bottom:16px; border-bottom:3px solid #1b5e20;">
        <div>
          <h2 style="margin:0; color:#1b5e20; font-size:1.6rem;">Diagnóstico Vigía</h2>
          <p style="margin:6px 0 0 0; color:#555; font-size:0.9rem;">
            Alumnos con calificaciones de una carrera que no corresponde a la suya
          </p>
        </div>
        <button onclick="document.getElementById('vigiaModal').style.display='none'"
          style="background:none; border:none; font-size:2rem; cursor:pointer; color:#999;
                 width:40px; height:40px; border-radius:50%; transition:background 0.2s;"
          onmouseover="this.style.background='#f5f5f5'"
          onmouseout="this.style.background='none'">&times;</button>
      </div>

      <!-- Estado / progreso -->
      <div id="vigiaEstado" style="text-align:center; padding:30px; color:#555; font-size:1rem;">
        Cargando alumnos...
      </div>

      <!-- Resumen -->
      <div id="vigiaResumen" style="display:none; margin-bottom:18px; padding:16px 20px;
           border-radius:10px; font-size:0.95rem;"></div>

      <!-- Tabla de resultados -->
      <div id="vigiaTablaWrap" style="display:none; overflow-x:auto;">
        <table id="vigiaTabla" style="width:100%; border-collapse:collapse; font-size:0.88rem;">
          <thead>
            <tr style="background:#1b5e20; color:white;">
              <th style="padding:10px 12px; text-align:left;">Alumno</th>
              <th style="padding:10px 12px; text-align:left;">Carrera del alumno</th>
              <th style="padding:10px 12px; text-align:left;">Materia</th>
              <th style="padding:10px 12px; text-align:left;">Carrera en calificación</th>
              <th style="padding:10px 12px; text-align:left;">Grupo</th>
              <th style="padding:10px 12px; text-align:left;">Periodo</th>
              <th style="padding:10px 12px; text-align:left;">Parciales</th>
            </tr>
          </thead>
          <tbody id="vigiaTbody"></tbody>
        </table>
      </div>

      <!-- Sin problemas -->
      <div id="vigiaSinProblemas" style="display:none; text-align:center; padding:30px;">
        <div style="font-size:2.5rem;">✅</div>
        <p style="color:#2e7d32; font-weight:700; font-size:1.1rem; margin:10px 0 4px 0;">
          Sin anomalías detectadas
        </p>
        <p style="color:#555; font-size:0.9rem;">
          Todos los alumnos tienen calificaciones únicamente de su propia carrera.
        </p>
      </div>

    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

// ── Diagnóstico principal ─────────────────────────────────────────────────

async function _vigiaEjecutarDiagnostico() {
  const elEstado      = document.getElementById('vigiaEstado');
  const elResumen     = document.getElementById('vigiaResumen');
  const elTablaWrap   = document.getElementById('vigiaTablaWrap');
  const elTbody       = document.getElementById('vigiaTbody');
  const elSinProblemas = document.getElementById('vigiaSinProblemas');

  // Reset visual
  elResumen.style.display     = 'none';
  elTablaWrap.style.display   = 'none';
  elSinProblemas.style.display = 'none';
  elEstado.style.display      = 'block';
  elEstado.textContent        = 'Cargando alumnos...';
  elTbody.innerHTML           = '';

  try {
    // ── 1. Leer todos los alumnos ─────────────────────────────────────────
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .get();

    const alumnoMap = {}; // uid → { nombre, carreraId }
    alumnosSnap.forEach(doc => {
      const d = doc.data();
      alumnoMap[doc.id] = {
        nombre:   d.nombre   || '(sin nombre)',
        carreraId: d.carreraId || '(sin carrera)'
      };
    });

    const totalAlumnos = Object.keys(alumnoMap).length;
    elEstado.textContent = `Alumnos cargados: ${totalAlumnos}. Escaneando calificaciones...`;

    // ── 2. Leer todas las calificaciones ─────────────────────────────────
    const calSnap = await db.collection('calificaciones').get();

    elEstado.textContent = `Procesando ${calSnap.size} registros de calificaciones...`;

    // ── 3. Cruzar datos ───────────────────────────────────────────────────
    const anomalias = [];

    calSnap.forEach(doc => {
      const c = doc.data();
      const alumno = alumnoMap[c.alumnoId];

      if (!alumno) return; // alumno no encontrado (quizás fue borrado)

      if (alumno.carreraId !== c.carreraId) {
        // Resumir parciales
        const p = c.parciales || {};
        const f = c.faltas    || {};
        const parcialesTexto = [
          p.parcial1 != null ? `P1:${p.parcial1}` : null,
          p.parcial2 != null ? `P2:${p.parcial2}` : null,
          p.parcial3 != null ? `P3/EF:${p.parcial3}` : null,
        ].filter(Boolean).join(' | ') || '—';

        anomalias.push({
          alumnoNombre:     alumno.nombre,
          alumnoCarreraId:  alumno.carreraId,
          materiaNombre:    c.materiaNombre  || '(desconocida)',
          calCarreraId:     c.carreraId      || '(sin carrera)',
          codigoGrupo:      c.codigoGrupo    || '—',
          periodo:          c.periodo        || '—',
          parciales:        parcialesTexto,
          calDocId:         doc.id
        });
      }
    });

    // ── 4. Mostrar resultados ─────────────────────────────────────────────
    elEstado.style.display = 'none';

    if (anomalias.length === 0) {
      elSinProblemas.style.display = 'block';
      return;
    }

    // Resumen
    const alumnosAfectados = [...new Set(anomalias.map(a => a.alumnoNombre))].length;
    elResumen.style.display = 'block';
    elResumen.style.background = '#fff3e0';
    elResumen.style.borderLeft = '5px solid #e65100';
    elResumen.innerHTML = `
      <strong style="color:#e65100; font-size:1.05rem;">
        ⚠️ Se encontraron ${anomalias.length} calificación(es) con carrera incorrecta
      </strong>
      <span style="color:#555; margin-left:12px;">
        en ${alumnosAfectados} alumno(s) distinto(s) — de ${calSnap.size} registros totales escaneados
      </span>`;

    // Tabla
    elTablaWrap.style.display = 'block';

    // Ordenar por alumno para agrupar visualmente
    anomalias.sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre));

    let ultimoAlumno = null;
    anomalias.forEach((a, i) => {
      const esNuevoAlumno = a.alumnoNombre !== ultimoAlumno;
      ultimoAlumno = a.alumnoNombre;

      const tr = document.createElement('tr');
      tr.style.background = i % 2 === 0 ? '#fff8f0' : '#fff';
      tr.style.borderBottom = '1px solid #ffe0b2';

      tr.innerHTML = `
        <td style="padding:9px 12px; font-weight:${esNuevoAlumno ? '700' : '400'}; color:#333;">
          ${esNuevoAlumno ? a.alumnoNombre : '↳'}
        </td>
        <td style="padding:9px 12px; color:#2e7d32; font-weight:600;">${a.alumnoCarreraId}</td>
        <td style="padding:9px 12px; color:#333;">${a.materiaNombre}</td>
        <td style="padding:9px 12px; color:#c62828; font-weight:700;">${a.calCarreraId}</td>
        <td style="padding:9px 12px; color:#555;">${a.codigoGrupo}</td>
        <td style="padding:9px 12px; color:#555;">${a.periodo}</td>
        <td style="padding:9px 12px; color:#555; font-size:0.82rem;">${a.parciales}</td>`;

      elTbody.appendChild(tr);
    });

  } catch (err) {
    console.error('[Vigía] Error en diagnóstico:', err);
    elEstado.style.display = 'block';
    elEstado.innerHTML = `<span style="color:#c62828;">Error: ${err.message}</span>`;
  }
}
