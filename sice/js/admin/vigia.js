// Vigía — herramienta de mantenimiento puntual

// Repara historialAcademico.materias[] para alumnos cuyo historial no fue
// correctamente inicializado durante Cambiar Periodo (porque Boleta Global
// nunca se abrió antes del cambio de periodo).
// Idempotente: no pisa periodoAcademico que ya esté seteado.
async function repararHistorialPostCambioPeriodo() {
  const carreraId = prompt('ID de la carrera a reparar (ej: MAEADM):');
  if (!carreraId) return;
  const periodoArchivado = prompt('Periodo cerrado a reparar (ej: 2026-1):');
  if (!periodoArchivado) return;

  if (!confirm(
    `Reparar historialAcademico para carrera "${carreraId}", periodo "${periodoArchivado}".\n\n` +
    `Estampará periodoAcademico='${periodoArchivado}' en materias del semestre cerrado ` +
    `para alumnos cuyo historial quedó sin materias[] tras Cambiar Periodo.\n\n` +
    `Es seguro ejecutarlo varias veces (no pisa datos ya existentes).\n\n¿Continuar?`
  )) return;

  _asegurarModalGenerico();
  document.getElementById('contenidoModal').innerHTML = `
    <div style="background:white;padding:40px;border-radius:15px;text-align:center;max-width:500px;margin:20px auto;">
      <div style="font-size:18px;font-weight:600;margin-bottom:20px;">Reparando historial académico...</div>
      <div id="vigiaStatus" style="color:#666;font-size:14px;margin-bottom:10px;">Leyendo datos...</div>
      <div style="background:#e0e0e0;height:8px;border-radius:4px;overflow:hidden;">
        <div id="vigiaBar" style="background:linear-gradient(90deg,#1b5e20,#4caf50);height:100%;width:0%;transition:width 0.3s;"></div>
      </div>
    </div>
  `;
  document.getElementById('modalGenerico').style.display = 'flex';

  const setStatus = (msg, pct) => {
    const el = document.getElementById('vigiaStatus');
    if (el) el.textContent = msg;
    const bar = document.getElementById('vigiaBar');
    if (bar && pct !== undefined) bar.style.width = pct + '%';
  };

  const _calFinal = (cal) => {
    if (cal.ets != null)             return { calificacion: cal.ets,            acr: 'ETS' };
    if (cal.extraordinario != null)  return { calificacion: cal.extraordinario, acr: 'EXT' };
    const prom = cal.promedio ?? null;
    return { calificacion: prom, acr: prom !== null ? (cal.acreditacion || 'ORD') : null };
  };

  try {
    // 1. Calificaciones archivadas del periodo
    setStatus('Leyendo historialCalificaciones...', 10);
    const histCalSnap = await db.collection('historialCalificaciones')
      .where('carreraId', '==', carreraId)
      .where('periodoArchivado', '==', periodoArchivado)
      .get();

    if (histCalSnap.empty) {
      alert(`No se encontraron calificaciones archivadas para carrera "${carreraId}" en periodo "${periodoArchivado}".\nVerifica que el periodo sea correcto y que Cambiar Periodo haya corrido.`);
      document.getElementById('modalGenerico').style.display = 'none';
      return;
    }

    // Agrupar por alumnoId → { materiaId: calData }
    const calPorAlumno = {};
    histCalSnap.docs.forEach(doc => {
      const c = doc.data();
      if (!c.alumnoId) return;
      if (!calPorAlumno[c.alumnoId]) calPorAlumno[c.alumnoId] = {};
      calPorAlumno[c.alumnoId][c.materiaId] = c;
    });
    const alumnoIds = Object.keys(calPorAlumno);

    // 2. Materias de la carrera (grado y nombre)
    setStatus(`${alumnoIds.length} alumnos con calificaciones. Leyendo materias...`, 25);
    const materiasSnap = await db.collection('materias')
      .where('carreraId', '==', carreraId)
      .get();
    const materiaInfo = {};
    materiasSnap.docs.forEach(doc => {
      const m = doc.data();
      materiaInfo[doc.id] = { nombre: m.nombre || '', periodo: Number(m.periodo) || 0 };
    });

    // 3. historialAcademico de todos los alumnos afectados
    setStatus('Leyendo historialAcademico...', 40);
    const histSnaps = await Promise.all(
      alumnoIds.map(id => db.collection('historialAcademico').doc(id).get())
    );

    // 4. Reparar
    setStatus('Reparando documentos...', 60);
    let batchOp = db.batch();
    let batchCount = 0;
    let reparados = 0;
    let omitidos = 0;
    const ahora = firebase.firestore.FieldValue.serverTimestamp();

    for (let i = 0; i < alumnoIds.length; i++) {
      const alumnoId   = alumnoIds[i];
      const histSnap   = histSnaps[i];
      const calsAlumno = calPorAlumno[alumnoId];
      let materiasActualizadas = null;

      if (histSnap.exists && (histSnap.data().materias || []).length > 0) {
        // Doc tiene materias[] → solo estampar las del periodo que aún están null
        const existentes = histSnap.data().materias || [];
        let cambiado = false;
        const nuevas = existentes.map(mat => {
          if (mat.periodoAcademico) return mat;        // ya cerrada — no pisar
          const cal = calsAlumno[mat.materiaId];
          if (!cal) return mat;                        // sin calificación archivada
          const { calificacion, acr } = _calFinal(cal);
          cambiado = true;
          return Object.assign({}, mat, { calificacion, acr, periodoAcademico: periodoArchivado });
        });
        if (cambiado) materiasActualizadas = nuevas;

      } else {
        // Doc no existe o materias[] vacío → crear desde materias de la carrera
        if (Object.keys(materiaInfo).length === 0) { omitidos++; continue; }
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
            mat.periodoAcademico = periodoArchivado;
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
        setStatus(`Reparando... ${reparados}/${alumnoIds.length}`, 60 + (reparados / alumnoIds.length) * 35);
      }
    }

    if (batchCount > 0) await batchOp.commit();

    document.getElementById('contenidoModal').innerHTML = `
      <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
        <h3 style="color:#2e7d32;text-align:center;margin:0 0 20px 0;">Historial reparado</h3>
        <div style="background:#e8f5e9;border-radius:8px;padding:20px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
            <span>Calificaciones archivadas leídas:</span><strong>${histCalSnap.size}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
            <span>Alumnos con calificaciones:</span><strong>${alumnoIds.length}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
            <span>Historiales reparados:</span><strong style="color:#4caf50;">${reparados}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;">
            <span>Sin cambios (ya correctos):</span><strong style="color:#888;">${omitidos}</strong>
          </div>
        </div>
        <p style="color:#666;font-size:0.88rem;margin-bottom:16px;">
          Ya puedes abrir la Boleta Global de los alumnos afectados — las materias del periodo ${periodoArchivado} deberán aparecer con calificaciones en lugar de "Cursando".
        </p>
        <button onclick="cerrarModal()" style="width:100%;padding:12px;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
          Cerrar
        </button>
      </div>
    `;

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
