// Vigía — herramienta de mantenimiento puntual
// FASE ACTIVA: Auditoría de periodos fantasma en historialAcademico
// Busca entradas de 2026-3 / 2026-4 en periodos[] y materias[] con periodoAcademico
// estampado pero sin calificación real (daño de los cambios de periodo vacíos)

async function accionVigia() {
  _vigiaAbrirPanel('Escaneando historiales académicos…', true);

  try {
    // ── 1. Cargar todos los historiales (sistema es pequeño, ~600 alumnos) ─────
    const snap = await db.collection('historialAcademico').get();

    _vigiaSetHtml(`<p style="color:#555;">⏳ ${snap.size} historiales cargados. Analizando…</p>`);

    const PERIODOS_FANTASMA = new Set(['2026-3', '2026-4']);

    // Resultados
    // periodosVacios: alumnos con entries en periodos[] para ciclos fantasma
    // materiasHuerfanas: materias con periodoAcademico fantasma pero calificacion null/0
    // materiasDoble: alumnos donde el mismo periodoAcademico aparece en 2+ trimesters
    const periodosVacios    = [];
    const materiasEstampadas = []; // periodoAcademico fantasma + sin calificacion real
    const periodosDuplicados = []; // mismo ciclo en 2+ semestres distintos del alumno

    snap.docs.forEach(doc => {
      const h   = doc.data();
      const nom = h.alumnoNombre || doc.id;
      const mat = h.matricula    || '—';
      const car = h.carreraId    || '—';

      // ── periodos[] fantasma ──────────────────────────────────────────────────
      const pFantasma = (h.periodos || []).filter(p => PERIODOS_FANTASMA.has(p.periodo));
      if (pFantasma.length > 0) {
        periodosVacios.push({
          alumnoId: doc.id, nom, mat, car,
          periodos: pFantasma.map(p => ({
            ciclo:    p.periodo,
            semestre: p.semestre,
            nMaterias: (p.materias || []).length,
            conCal:    (p.materias || []).filter(m => m.calificacion != null && m.calificacion !== 0).length
          }))
        });
      }

      // ── materias[] con periodoAcademico pero sin calificación ────────────────
      const mEstamp = (h.materias || []).filter(m =>
        m.periodoAcademico != null &&
        (m.calificacion === null || m.calificacion === 0 || m.calificacion === undefined)
      );
      if (mEstamp.length > 0) {
        materiasEstampadas.push({
          alumnoId: doc.id, nom, mat, car,
          materias: mEstamp.map(m => ({
            nombre:    m.materiaNombre || m.materiaId,
            semestre:  m.periodo,
            ciclo:     m.periodoAcademico,
            cal:       m.calificacion  ?? null,
            acr:       m.acr           ?? null
          }))
        });
      }

      // ── mismo ciclo en 2+ semestres distintos ────────────────────────────────
      const cicloASemestre = {};
      (h.materias || []).forEach(m => {
        if (!m.periodoAcademico || m.calificacion === null || m.calificacion === undefined) return;
        if (!cicloASemestre[m.periodoAcademico]) cicloASemestre[m.periodoAcademico] = new Set();
        cicloASemestre[m.periodoAcademico].add(m.periodo);
      });
      const conflictos = Object.entries(cicloASemestre)
        .filter(([, semestres]) => semestres.size > 1)
        .map(([ciclo, semestres]) => ({ ciclo, semestres: Array.from(semestres).sort() }));

      if (conflictos.length > 0) {
        periodosDuplicados.push({ alumnoId: doc.id, nom, mat, car, conflictos });
      }
    });

    // ── Render ─────────────────────────────────────────────────────────────────
    let html = `
      <div style="margin-bottom:14px; padding:10px 14px; background:#e3f2fd;
                  border-radius:8px; font-size:0.88rem;">
        <strong>Historiales escaneados:</strong> ${snap.size} &nbsp;|&nbsp;
        <strong>Con periodos fantasma (periodos[]):</strong> ${periodosVacios.length} &nbsp;|&nbsp;
        <strong>Con materias estampadas sin calificación:</strong> ${materiasEstampadas.length} &nbsp;|&nbsp;
        <strong>Con ciclo duplicado en 2+ semestres:</strong> ${periodosDuplicados.length}
      </div>`;

    // ── PERIODOS FANTASMA ────────────────────────────────────────────────────
    html += _seccion(
      '📦 Entradas en periodos[] para ciclos 2026-3 / 2026-4',
      periodosVacios.length === 0
        ? '<p style="color:#2e7d32; font-weight:600; margin:0;">✓ Ninguna — historial limpio.</p>'
        : periodosVacios.map(a => `
            <div style="margin-bottom:10px; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
              <div style="background:#f5f5f5; padding:6px 12px; font-size:0.85rem;">
                <strong>${a.nom}</strong>
                <span style="color:#888; margin-left:8px;">${a.mat} | ${a.car}</span>
              </div>
              ${a.periodos.map(p => `
                <div style="padding:5px 14px; font-size:0.82rem; border-top:1px solid #eee;
                            color:${p.conCal > 0 ? '#c00' : '#555'}">
                  Ciclo <strong>${p.ciclo}</strong> — Semestre ${p.semestre},
                  ${p.nMaterias} materias, <strong>${p.conCal} con calificación</strong>
                  ${p.conCal > 0 ? '⚠️' : '(vacío)'}
                </div>`).join('')}
            </div>`).join('')
    );

    // ── MATERIAS ESTAMPADAS SIN CALIFICACIÓN ─────────────────────────────────
    html += _seccion(
      '🔖 Materias con periodoAcademico estampado pero sin calificación real',
      materiasEstampadas.length === 0
        ? '<p style="color:#2e7d32; font-weight:600; margin:0;">✓ Ninguna.</p>'
        : materiasEstampadas.map(a => `
            <div style="margin-bottom:10px; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
              <div style="background:#fff8e1; padding:6px 12px; font-size:0.85rem;">
                <strong>${a.nom}</strong>
                <span style="color:#888; margin-left:8px;">${a.mat} | ${a.car}</span>
              </div>
              <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <tr style="background:#ffeedd;">
                  <th style="padding:4px 10px; text-align:left;">Materia</th>
                  <th style="padding:4px 10px; text-align:center;">Semestre</th>
                  <th style="padding:4px 10px; text-align:center;">Ciclo estampado</th>
                  <th style="padding:4px 10px; text-align:center;">Cal</th>
                </tr>
                ${a.materias.map((m, i) => `
                  <tr style="background:${i%2?'#fff':'#fffde7'}">
                    <td style="padding:4px 10px; border-bottom:1px solid #eee;">${m.nombre}</td>
                    <td style="padding:4px 10px; border-bottom:1px solid #eee; text-align:center;">${m.semestre ?? '?'}</td>
                    <td style="padding:4px 10px; border-bottom:1px solid #eee; text-align:center;
                               color:${['2026-3','2026-4'].includes(m.ciclo)?'#c00':'#555'}">
                      ${m.ciclo}
                    </td>
                    <td style="padding:4px 10px; border-bottom:1px solid #eee; text-align:center;">
                      ${m.cal ?? 'null'}
                    </td>
                  </tr>`).join('')}
              </table>
            </div>`).join('')
    );

    // ── CICLO DUPLICADO EN 2+ SEMESTRES ──────────────────────────────────────
    html += _seccion(
      '⚠️ Alumnos con el mismo ciclo académico en 2 o más semestres distintos',
      periodosDuplicados.length === 0
        ? '<p style="color:#2e7d32; font-weight:600; margin:0;">✓ Ninguno — sin colisiones de ciclo.</p>'
        : periodosDuplicados.map(a => `
            <div style="margin-bottom:10px; border:1px solid #ef9a9a; border-radius:6px; overflow:hidden;">
              <div style="background:#ffebee; padding:6px 12px; font-size:0.85rem;">
                <strong>${a.nom}</strong>
                <span style="color:#888; margin-left:8px;">${a.mat} | ${a.car}</span>
              </div>
              ${a.conflictos.map(c => `
                <div style="padding:5px 14px; font-size:0.82rem; border-top:1px solid #ffcdd2; color:#c62828;">
                  Ciclo <strong>${c.ciclo}</strong> aparece en semestres: ${c.semestres.join(', ')}
                </div>`).join('')}
            </div>`).join('')
    );

    html += `<div style="margin-top:14px; padding:10px 14px; background:#f5f5f5;
                         border-radius:8px; font-size:0.82rem; color:#777;">
      Solo lectura — ningún dato fue modificado.
    </div>`;

    _vigiaSetHtml(html);

  } catch (e) {
    console.error('Error en accionVigia:', e);
    _vigiaSetHtml(`<p style="color:#c00;">Error: ${e.message}</p>`);
  }
}

function _seccion(titulo, contenido) {
  return `
    <h4 style="margin:20px 0 8px; font-size:0.93rem; color:#333; border-bottom:2px solid #eee;
               padding-bottom:4px;">${titulo}</h4>
    ${contenido}`;
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
    <div style="background:white; border-radius:14px; width:100%; max-width:960px;
                box-shadow:0 8px 40px rgba(0,0,0,0.3); padding:28px 30px; position:relative;">
      <button onclick="document.getElementById('_vigiaPanel').remove()"
        style="position:absolute; top:14px; right:16px; background:#eee; border:none;
               border-radius:6px; padding:6px 14px; cursor:pointer; font-size:0.9rem; font-weight:600;">
        ✕ Cerrar
      </button>
      <h2 style="margin:0 0 4px; color:#1565c0; font-size:1.15rem;">
        Vigía — Auditoría de periodos fantasma
      </h2>
      <p style="margin:0 0 18px; color:#888; font-size:0.83rem;">
        Solo lectura · busca residuos de cambios de periodo vacíos (2026-3, 2026-4)
        y colisiones de ciclo en historialAcademico
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
