// Vigía — herramienta de mantenimiento puntual

// Repara historialAcademico.materias[] para TODAS las carreras que hayan ejecutado
// Cambiar Periodo, usando el periodoAnterior guardado en config/periodo_{carreraId}.
// Idempotente: no pisa periodoAcademico ya seteado ni materias sin calificación archivada.
async function repararHistorialPostCambioPeriodo() {
  if (!confirm(
    'REPARAR HISTORIAL ACADÉMICO — TODAS LAS CARRERAS\n\n' +
    'Busca alumnos cuyo historialAcademico.materias[] quedó sin actualizar\n' +
    'tras Cambiar Periodo (cuando Boleta Global nunca se abrió antes del cambio).\n\n' +
    'Usa el periodo anterior de cada carrera como referencia.\n' +
    'No pisa datos ya correctos. Seguro de ejecutar varias veces.\n\n' +
    '¿Continuar?'
  )) return;

  _asegurarModalGenerico();
  document.getElementById('contenidoModal').innerHTML = `
    <div style="background:white;padding:40px;border-radius:15px;text-align:center;max-width:560px;margin:20px auto;">
      <div style="font-size:18px;font-weight:600;margin-bottom:16px;">Reparando historial académico...</div>
      <div id="vigiaStatus" style="color:#666;font-size:14px;margin-bottom:12px;">Leyendo carreras...</div>
      <div style="background:#e0e0e0;height:8px;border-radius:4px;overflow:hidden;">
        <div id="vigiaBar" style="background:linear-gradient(90deg,#1b5e20,#4caf50);height:100%;width:0%;transition:width 0.4s;"></div>
      </div>
      <div id="vigiaLog" style="margin-top:16px;text-align:left;font-size:0.82rem;color:#555;max-height:160px;overflow-y:auto;"></div>
    </div>
  `;
  document.getElementById('modalGenerico').style.display = 'flex';

  const setStatus = (msg, pct) => {
    const el = document.getElementById('vigiaStatus');
    if (el) el.textContent = msg;
    const bar = document.getElementById('vigiaBar');
    if (bar && pct !== undefined) bar.style.width = Math.min(pct, 100) + '%';
  };
  const addLog = (msg) => {
    const el = document.getElementById('vigiaLog');
    if (!el) return;
    const line = document.createElement('div');
    line.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  };

  const _calFinal = (cal) => {
    if (cal.ets != null)            return { calificacion: cal.ets,            acr: 'ETS' };
    if (cal.extraordinario != null) return { calificacion: cal.extraordinario, acr: 'EXT' };
    const prom = cal.promedio ?? null;
    return { calificacion: prom, acr: prom !== null ? (cal.acreditacion || 'ORD') : null };
  };

  try {
    // 1. Todas las carreras + sus configs en paralelo
    setStatus('Leyendo carreras...', 5);
    const carrerasSnap = await db.collection('carreras').get();
    const configSnaps  = await Promise.all(
      carrerasSnap.docs.map(d => db.collection('config').doc(`periodo_${d.id}`).get())
    );

    // Solo carreras que ya tuvieron cambio de periodo (periodoAnterior seteado)
    const carrerasARepparar = [];
    carrerasSnap.docs.forEach((doc, i) => {
      const cfg = configSnaps[i];
      if (!cfg.exists) return;
      const periodoAnterior = cfg.data().periodoAnterior || null;
      if (!periodoAnterior) return;
      carrerasARepparar.push({
        carreraId:       doc.id,
        nombre:          doc.data().nombre || doc.id,
        periodoAnterior
      });
    });

    if (!carrerasARepparar.length) {
      document.getElementById('contenidoModal').innerHTML = `
        <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
          <h3 style="color:#1565c0;text-align:center;margin:0 0 16px 0;">Sin carreras que reparar</h3>
          <p style="color:#666;text-align:center;">Ninguna carrera tiene registro de cambio de periodo anterior.</p>
          <button onclick="cerrarModal()" style="width:100%;margin-top:16px;padding:12px;background:#667eea;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Cerrar</button>
        </div>
      `;
      return;
    }

    addLog(`${carrerasARepparar.length} carrera(s) con periodo anterior detectadas.`);

    let totalReparados = 0;
    let totalOmitidos  = 0;
    const resumenCarreras = [];

    // 2. Procesar cada carrera
    for (let ci = 0; ci < carrerasARepparar.length; ci++) {
      const { carreraId, nombre, periodoAnterior } = carrerasARepparar[ci];
      const pct = 10 + (ci / carrerasARepparar.length) * 85;
      setStatus(`Procesando: ${nombre} (${periodoAnterior})...`, pct);
      addLog(`▶ ${nombre} — periodo ${periodoAnterior}`);

      // Calificaciones archivadas del periodo cerrado (fuente primaria)
      const histCalSnap = await db.collection('historialCalificaciones')
        .where('carreraId', '==', carreraId)
        .where('periodoArchivado', '==', periodoAnterior)
        .get();

      let calSourceDocs = histCalSnap.docs;
      let usandoFallback = false;

      if (histCalSnap.empty) {
        // historialCalificaciones vacío: el archivar falló durante el cambio de periodo
        // (calificaciones.periodo era número de grado, no ciclo escolar).
        // Fallback: leer calificaciones activas directamente. Solo confiable si los
        // profesores NO han guardado calificaciones del nuevo periodo aún.
        const calFallback = await db.collection('calificaciones')
          .where('carreraId', '==', carreraId)
          .get();

        if (calFallback.empty) {
          addLog(`  ↳ Sin datos en ninguna fuente — omitida.`);
          resumenCarreras.push({ nombre, periodoAnterior, reparados: 0, omitidos: 0, sinDatos: true, fallback: false });
          continue;
        }
        calSourceDocs = calFallback.docs;
        usandoFallback = true;
        addLog(`  ↳ ⚠ historialCalificaciones vacío. Usando calificaciones activas (${calFallback.size} docs) como respaldo.`);
      }

      // Agrupar calificaciones por alumnoId
      const calPorAlumno = {};
      calSourceDocs.forEach(doc => {
        const c = doc.data();
        if (!c.alumnoId) return;
        if (!calPorAlumno[c.alumnoId]) calPorAlumno[c.alumnoId] = {};
        calPorAlumno[c.alumnoId][c.materiaId] = c;
      });
      const alumnoIds = Object.keys(calPorAlumno);

      // Materias de la carrera (grado y nombre)
      const materiasSnap = await db.collection('materias').where('carreraId', '==', carreraId).get();
      const materiaInfo  = {};
      materiasSnap.docs.forEach(doc => {
        const m = doc.data();
        materiaInfo[doc.id] = { nombre: m.nombre || '', periodo: Number(m.periodo) || 0 };
      });

      // historialAcademico de todos los alumnos afectados
      const histSnaps = await Promise.all(
        alumnoIds.map(id => db.collection('historialAcademico').doc(id).get())
      );

      // Reparar
      let batchOp    = db.batch();
      let batchCount = 0;
      let reparados  = 0;
      let omitidos   = 0;
      const ahora    = firebase.firestore.FieldValue.serverTimestamp();

      for (let i = 0; i < alumnoIds.length; i++) {
        const alumnoId   = alumnoIds[i];
        const histSnap   = histSnaps[i];
        const calsAlumno = calPorAlumno[alumnoId];
        let materiasActualizadas = null;

        if (histSnap.exists && (histSnap.data().materias || []).length > 0) {
          // Doc tiene materias[] → estampar solo las que faltan periodoAcademico
          const existentes = histSnap.data().materias || [];
          let cambiado = false;
          const nuevas = existentes.map(mat => {
            if (mat.periodoAcademico) return mat;       // ya cerrada — no pisar
            const cal = calsAlumno[mat.materiaId];
            if (!cal) return mat;                       // sin calificación archivada — no tocar
            const { calificacion, acr } = _calFinal(cal);
            cambiado = true;
            return Object.assign({}, mat, { calificacion, acr, periodoAcademico: periodoAnterior });
          });
          if (cambiado) materiasActualizadas = nuevas;

        } else if (Object.keys(materiaInfo).length > 0) {
          // Doc no existe o materias[] vacío → crear desde catálogo de la carrera
          materiasActualizadas = Object.entries(materiaInfo).map(([matId, matData]) => {
            const mat = {
              materiaId:        matId,
              materiaNombre:    matData.nombre,
              periodo:          matData.periodo,
              calificacion:     null,
              acr:              null,
              periodoAcademico: null,
              valida:           true
            };
            const cal = calsAlumno[matId];
            if (cal) {
              const { calificacion, acr } = _calFinal(cal);
              mat.calificacion     = calificacion;
              mat.acr              = acr;
              mat.periodoAcademico = periodoAnterior;
            }
            return mat;
          });
        }

        if (!materiasActualizadas) { omitidos++; continue; }

        batchOp.set(
          db.collection('historialAcademico').doc(alumnoId),
          { materias: materiasActualizadas, fechaActualizacion: ahora },
          { merge: true }
        );
        batchCount++;
        reparados++;

        if (batchCount >= 490) {
          await batchOp.commit();
          batchOp = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) await batchOp.commit();

      totalReparados += reparados;
      totalOmitidos  += omitidos;
      resumenCarreras.push({ nombre, periodoAnterior, reparados, omitidos, sinDatos: false, fallback: usandoFallback });
      addLog(`  ↳ ${reparados} reparados, ${omitidos} sin cambios.${usandoFallback ? ' (respaldo desde calificaciones activas)' : ''}`);
    }

    // 3. Resumen final
    setStatus('Completado.', 100);
    const hayFallback = resumenCarreras.some(r => r.fallback);
    const filasResumen = resumenCarreras.map(r =>
      `<tr style="border-bottom:1px solid #eee;${r.fallback ? 'background:#fff8e1;' : ''}">
        <td style="padding:7px 10px;">${r.nombre}${r.fallback ? ' <span style="font-size:0.75rem;color:#f57f17;">⚠ respaldo</span>' : ''}</td>
        <td style="padding:7px 10px;text-align:center;color:#666;">${r.periodoAnterior}</td>
        <td style="padding:7px 10px;text-align:center;font-weight:700;color:${r.reparados > 0 ? '#2e7d32' : '#888'};">${r.sinDatos ? '—' : r.reparados}</td>
        <td style="padding:7px 10px;text-align:center;color:#888;">${r.sinDatos ? 'Sin datos' : r.omitidos}</td>
      </tr>`
    ).join('');

    setTimeout(() => {
      document.getElementById('contenidoModal').innerHTML = `
        <div style="background:white;padding:30px;border-radius:15px;max-width:600px;margin:20px auto;">
          <h3 style="color:#2e7d32;text-align:center;margin:0 0 20px 0;">Historial reparado</h3>
          <div style="background:#e8f5e9;border-radius:8px;padding:16px 20px;margin-bottom:18px;display:flex;gap:30px;justify-content:center;">
            <div style="text-align:center;">
              <div style="font-size:2rem;font-weight:800;color:#2e7d32;">${totalReparados}</div>
              <div style="font-size:0.82rem;color:#555;">historiales reparados</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:2rem;font-weight:800;color:#888;">${totalOmitidos}</div>
              <div style="font-size:0.82rem;color:#555;">sin cambios (ya correctos)</div>
            </div>
          </div>
          <div style="overflow-x:auto;margin-bottom:18px;">
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
              <thead>
                <tr style="background:#43a047;color:white;">
                  <th style="padding:8px 10px;text-align:left;">Carrera</th>
                  <th style="padding:8px 10px;text-align:center;">Periodo</th>
                  <th style="padding:8px 10px;text-align:center;">Reparados</th>
                  <th style="padding:8px 10px;text-align:center;">Sin cambios</th>
                </tr>
              </thead>
              <tbody>${filasResumen}</tbody>
            </table>
          </div>
          ${hayFallback ? `
          <div style="background:#fff3e0;border-left:4px solid #f57f17;padding:12px 15px;border-radius:4px;margin-bottom:14px;font-size:0.82rem;color:#e65100;">
            <strong>⚠ Carreras marcadas con "respaldo"</strong> usaron las calificaciones activas porque
            <code>historialCalificaciones</code> estaba vacío (el archivado del cambio de periodo falló).
            Esto es correcto si los profesores aún <em>no</em> han guardado calificaciones del nuevo periodo.
            Si ya guardaron, esas materias podrían tener el ciclo incorrecto — revisa con el coordinador.
          </div>` : ''}
          <p style="color:#666;font-size:0.85rem;margin-bottom:16px;">
            Los alumnos reparados ya pueden ver su Boleta Global con calificaciones en lugar de "Cursando".
          </p>
          <button onclick="cerrarModal()" style="width:100%;padding:12px;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
            Cerrar
          </button>
        </div>
      `;
    }, 600);

  } catch (error) {
    console.error('Error en repararHistorialPostCambioPeriodo:', error);
    document.getElementById('contenidoModal').innerHTML = `
      <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
        <h3 style="color:#d32f2f;text-align:center;margin:0 0 20px 0;">Error</h3>
        <div style="background:#ffebee;border-left:4px solid #f44336;padding:15px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;color:#c62828;">${error.message}</p>
        </div>
        <button onclick="cerrarModal()" style="width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Cerrar</button>
      </div>
    `;
  }
}

function accionVigia() {
  repararHistorialPostCambioPeriodo();
}
