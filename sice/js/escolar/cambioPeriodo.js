// ===== FUNCIONES DE PERIODO - MODIFICADO PARA SOPORTAR DIFERENTES TIPOS =====

// MODIFICADO: Generar lista de periodos disponibles según el tipo de carrera
function generarPeriodos(periodosAnio = 2) {
  const periodos = [];
  for (let year = 2024; year <= 2030; year++) {
    for (let periodo = 1; periodo <= periodosAnio; periodo++) {
      periodos.push(`${year}-${periodo}`);
    }
  }
  return periodos;
}

// NUEVA FUNCIÓN: Calcular siguiente periodo basado en el tipo de carrera
function calcularSiguientePeriodo(periodoActual, periodosAnio = 2) {
  const [year, periodo] = periodoActual.split('-').map(n => parseInt(n));
  
  if (periodo < periodosAnio) {
    // Todavía hay periodos en el año actual
    return `${year}-${periodo + 1}`;
  } else {
    // Pasar al primer periodo del siguiente año
    return `${year + 1}-1`;
  }
}

// NUEVA FUNCIÓN: Obtener nombre del periodo según el tipo
function obtenerNombrePeriodo(periodosAnio) {
  switch(periodosAnio) {
    case 2: return 'Semestre';
    case 3: return 'Cuatrimestre';
    case 4: return 'Trimestre';
    default: return 'Periodo';
  }
}

// Cargar periodo actual de la carrera
async function cargarPeriodoCarrera(carreraId) {
  try {
    const docRef = db.collection('config').doc(`periodo_${carreraId}`);
    const doc = await docRef.get();
    
    if (doc.exists) {
      return doc.data().periodo || '2026-1';
    } else {
      // Crear documento inicial si no existe
      await docRef.set({
        carreraId: carreraId,
        periodo: '2026-1',
        fechaCambio: firebase.firestore.FieldValue.serverTimestamp(),
        periodoAnterior: null
      });
      return '2026-1';
    }
  } catch (error) {
    console.error('Error al cargar periodo de carrera:', error);
    return '2026-1';
  }
}

// MODIFICADO: Mostrar modal de cambio de periodo con cálculo automático según tipo de carrera
async function mostrarCambioPeriodo(carreraId, periodoActual) {
  try {
    // Obtener información de la carrera para saber el tipo de periodo
    const carreraDoc = await db.collection('carreras').doc(carreraId).get();
    
    if (!carreraDoc.exists) {
      alert('Error: Carrera no encontrada');
      return;
    }
    
    const carreraData = carreraDoc.data();
    const periodosAnio = carreraData.periodosAnio || 2; // Por defecto semestral
    const tipoPeriodoNombre = carreraData.tipoPeriodoNombre || 'Semestral';
    const nombrePeriodo = obtenerNombrePeriodo(periodosAnio);
    
    // Calcular siguiente periodo automáticamente según el tipo de carrera
    const siguientePeriodo = calcularSiguientePeriodo(periodoActual, periodosAnio);
    
    const html = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 700px; margin: 20px auto;">
        <h3 style="margin: 0 0 20px 0; color: #216A32;">Cambiar Periodo Académico</h3>
        
        <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <strong style="color: #333;">Carrera:</strong>
            <span style="color: #666;">${carreraData.nombre}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
            <strong style="color: #333;">Tipo de periodo:</strong>
            <span style="color: #666;">${tipoPeriodoNombre} (${periodosAnio} ${periodosAnio > 1 ? 'periodos' : 'periodo'} por año)</span>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-around; gap: 20px;">
            <div style="text-align: center;">
              <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">${nombrePeriodo} actual:</div>
              <div style="font-size: 2rem; font-weight: bold; color: #216A32;">${periodoActual}</div>
            </div>
            
            <div style="font-size: 3rem; color: #999;">→</div>
            
            <div style="text-align: center;">
              <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">Siguiente ${nombrePeriodo.toLowerCase()}:</div>
              <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">${siguientePeriodo}</div>
            </div>
          </div>
        </div>
        
        <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <strong>Acciones al cambiar periodo:</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Se archivará 1 registro por grupo con todas las materias y profesores del periodo</li>
            <li>Las asignaciones de profesores se eliminarán (armar grupos desde cero)</li>
            <li>Las calificaciones se guardarán en el historial y en el historial académico de cada alumno</li>
            <li>Las materias dejarán de mostrarse como "Cursando" en Boleta Global</li>
          </ul>
        </div>
        <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <strong>Avance de alumnos — manual:</strong>
          <p style="margin: 5px 0 0 0;">Los alumnos <strong>no avanzan automáticamente</strong>. Después del cambio de periodo, ve a "Gestionar Alumnos" y avanza o desactiva cada alumno individualmente.</p>
        </div>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <strong>IMPORTANTE:</strong>
          <p style="margin: 5px 0 0 0;">Esta acción solo afectará a tu carrera. Otras carreras mantienen su periodo independiente.</p>
        </div>
        
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <strong>ADVERTENCIA:</strong>
          <p style="margin: 5px 0 0 0;">Esta acción no se puede deshacer. Verifica que todo esté correcto antes de continuar.</p>
        </div>
        
        <form onsubmit="ejecutarCambioPeriodoCarrera(event, '${carreraId}', '${periodoActual}', '${siguientePeriodo}', ${periodosAnio}, ${carreraData.numeroPeriodos || 9})">
          <div style="display: flex; gap: 10px;">
            <button type="submit" style="flex: 1; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.1rem;">
              Avanzar a ${siguientePeriodo}
            </button>
            <button type="button" onclick="cerrarModal()" style="flex: 1; padding: 14px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.1rem;">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById('contenidoModal').innerHTML = html;
    document.getElementById('modalGenerico').style.display = 'flex';
    
  } catch (error) {
    console.error('Error al mostrar modal de cambio de periodo:', error);
    alert('Error al cargar información de la carrera');
  }
}

// MODIFICADO: Ejecutar cambio de periodo con validación del tipo de periodo
async function ejecutarCambioPeriodoCarrera(event, carreraId, periodoActual, siguientePeriodo, periodosAnio, numeroPeriodos) {
  numeroPeriodos = numeroPeriodos || 9;
  event.preventDefault();
  
  // El nuevoPeriodo ya viene como parámetro calculado
  const nuevoPeriodo = siguientePeriodo;
  const nombrePeriodo = obtenerNombrePeriodo(periodosAnio);
  
  const confirmacion = confirm(
    `CONFIRMAR CAMBIO DE PERIODO\n\n` +
    `De: ${periodoActual}\n` +
    `A: ${nuevoPeriodo}\n` +
    `Tipo: ${nombrePeriodo} (${periodosAnio} periodos por año)\n\n` +
    `Esta acción:\n` +
    `- Archivará los grupos del periodo con sus asignaciones de profesores\n` +
    `- Eliminará asignaciones de profesores (armar grupos desde cero)\n` +
    `- Guardará calificaciones en historial y actualizará historial académico\n\n` +
    `Los alumnos NO avanzan automáticamente.\n` +
    `Avanza a cada alumno manualmente desde "Gestionar Alumnos".\n\n` +
    `¿Continuar?`
  );
  
  if (!confirmacion) return;
  
  try {
    // Mostrar progreso
    document.getElementById('contenidoModal').innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 15px; text-align: center; max-width: 500px; margin: 20px auto;">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 20px;">Cambiando periodo...</div>
        <div style="color: #666; margin-bottom: 20px;">Por favor espera, esto puede tomar unos momentos.</div>
        <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="progressBar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div id="progressText" style="margin-top: 10px; color: #666; font-size: 14px;">Iniciando...</div>
      </div>
    `;
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    let gruposArchivados = 0;
    let asignacionesDesactivadas = 0;
    let calificacionesArchivadas = 0;

    // 1. ARCHIVAR GRUPOS (15%)
    progressBar.style.width = '15%';
    progressText.textContent = 'Archivando grupos...';

    await archivarGrupos(carreraId, periodoActual);
    gruposArchivados = await contarGruposArchivados(carreraId, periodoActual);

    // 2. CARGAR ALUMNOS para historialAcademico (sin avanzarlos)
    progressBar.style.width = '25%';
    progressText.textContent = 'Cargando datos de alumnos...';

    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('carreraId', '==', carreraId)
      .where('activo', '==', true)
      .get();

    const alumnoDataMap = {};
    alumnosSnap.docs.forEach(doc => {
      const a = doc.data();
      alumnoDataMap[doc.id] = { nombre: a.nombre, matricula: a.matricula, semestreActual: a.semestreActual };
    });

    // 3. ARCHIVAR CALIFICACIONES (50%)
    progressBar.style.width = '50%';
    progressText.textContent = 'Archivando calificaciones...';

    const resultCals = await archivarCalificaciones(carreraId, periodoActual);
    calificacionesArchivadas = resultCals.contador;

    // 3.5 ACTUALIZAR HISTORIAL ACADÉMICO (incluye periodoAcademico en materias[])
    progressBar.style.width = '70%';
    progressText.textContent = 'Actualizando historial académico...';

    await actualizarHistorialAcademico(carreraId, periodoActual, resultCals.docs, alumnoDataMap);

    // 4. ELIMINAR ASIGNACIONES DEL PERIODO (para que el coordinador arme grupos nuevos)
    progressBar.style.width = '85%';
    progressText.textContent = 'Eliminando asignaciones del periodo...';

    // Borrar TODAS las asignaciones de la carrera (sin filtro de periodo para no depender de índices)
    const asignacionesSnap = await db.collection('profesorMaterias')
      .where('carreraId', '==', carreraId)
      .get();

    for (let i = 0; i < asignacionesSnap.docs.length; i += 499) {
      const batchDel = db.batch();
      asignacionesSnap.docs.slice(i, i + 499).forEach(doc => {
        batchDel.delete(doc.ref);
        asignacionesDesactivadas++;
      });
      await batchDel.commit();
    }
    
    // 4.5 LIMPIAR HORARIOS DEL PERIODO (quedan obsoletos al cambiar periodo)
    try {
      const horariosSnap = await db.collection('horarios')
        .where('carreraId', '==', carreraId)
        .get();
      if (!horariosSnap.empty) {
        const batchH = db.batch();
        horariosSnap.forEach(doc => batchH.delete(doc.ref));
        await batchH.commit();
      }
    } catch (e) {
      console.warn('No se pudieron limpiar horarios:', e);
    }

    // 5. ACTUALIZAR CONFIGURACION DEL PERIODO (10%)
    progressBar.style.width = '95%';
    progressText.textContent = 'Actualizando configuración...';
    
    await db.collection('config').doc(`periodo_${carreraId}`).update({
      periodo: nuevoPeriodo,
      periodoAnterior: periodoActual,
      fechaCambio: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 6. COMPLETADO
    progressBar.style.width = '100%';
    progressText.textContent = 'Cambio completado!';
    
    // Mostrar resumen
    setTimeout(() => {
      const html = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; margin: 20px auto;">
          <h3 style="margin: 0 0 20px 0; color: #216A32; text-align: center;">
            Cambio de Periodo Completado
          </h3>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="text-align: center; margin-bottom: 15px;">
              <div style="font-size: 0.9rem; color: #666;">Periodo actualizado:</div>
              <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">${nuevoPeriodo}</div>
            </div>
          </div>
          
          <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 15px 0; color: #2e7d32;">Resumen de acciones:</h4>
            <div style="display: grid; gap: 10px;">
              <div style="display: flex; justify-content: space-between; padding: 8px; background: white; border-radius: 4px;">
                <span>Grupos archivados:</span>
                <strong>${gruposArchivados}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px; background: white; border-radius: 4px;">
                <span>Calificaciones archivadas:</span>
                <strong>${calificacionesArchivadas}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px; background: white; border-radius: 4px;">
                <span>Asignaciones de profesores eliminadas:</span>
                <strong>${asignacionesDesactivadas}</strong>
              </div>
            </div>
          </div>

          <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <strong>Siguiente paso — Alumnos:</strong>
            <p style="margin: 5px 0 0 0;">
              Los alumnos <strong>no avanzan automáticamente</strong>. Ve a "Gestionar Alumnos"
              y usa el botón <em>Avanzar Periodo</em> o <em>Desactivar</em> en cada alumno.
            </p>
          </div>
          
          <button onclick="location.reload()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.1rem;">
            Actualizar Panel
          </button>
        </div>
      `;
      
      document.getElementById('contenidoModal').innerHTML = html;
    }, 1000);
    
  } catch (error) {
    console.error('Error al cambiar periodo:', error);
    
    document.getElementById('contenidoModal').innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px auto;">
        <h3 style="color: #d32f2f; text-align: center; margin: 0 0 20px 0;">Error al Cambiar Periodo</h3>
        <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; color: #c62828;">${error.message}</p>
        </div>
        <button onclick="cerrarModal()" style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Cerrar
        </button>
      </div>
    `;
  }
}

// Calcula el nuevo codigoGrupo en formato CARRERA-SSGG (ej: "TIAC-1201" → "TIAC-1301")
function calcularNuevoCodigoGrupo(codigoGrupoActual, nuevoSemestre) {
  if (!codigoGrupoActual) return null;
  const guion = codigoGrupoActual.lastIndexOf('-');
  if (guion === -1) return null;
  const carrera = codigoGrupoActual.substring(0, guion);
  const sufijo = codigoGrupoActual.substring(guion + 1);
  if (sufijo.length < 4) return null;
  const grupoNum = sufijo.substring(2, 4);
  const nuevoSemestreStr = nuevoSemestre.toString().padStart(2, '0');
  return `${carrera}-${nuevoSemestreStr}${grupoNum}`;
}

// Archivar grupos del periodo que termina.
// Crea 1 documento en historialGrupos por codigoGrupo con todas las materias y profesores
// que tuvieron asignación ese periodo (fuente: profesorMaterias).
// También marca los documentos de grupos como activo:false.
async function archivarGrupos(carreraId, periodoActual) {
  try {
    const [pmSnap, gruposSnap] = await Promise.all([
      db.collection('profesorMaterias')
        .where('carreraId', '==', carreraId)
        .where('periodo', '==', periodoActual)
        .get(),
      db.collection('grupos')
        .where('carreraId', '==', carreraId)
        .where('activo', '==', true)
        .get()
    ]);

    // Agrupar asignaciones por codigoGrupo
    const byGrupo = {};
    pmSnap.docs.forEach(doc => {
      const pm = doc.data();
      const cg = pm.codigoGrupo;
      if (!cg) return;
      if (!byGrupo[cg]) {
        byGrupo[cg] = { turno: pm.turno || null, turnoNombre: pm.turnoNombre || '', materias: [] };
      }
      byGrupo[cg].materias.push({
        materiaId:     pm.materiaId     || '',
        materiaNombre: pm.materiaNombre || '',
        materiaCodigo: pm.materiaCodigo || '',
        profesorId:    pm.profesorId    || '',
        profesorNombre: pm.profesorNombre || ''
      });
    });

    let batch = db.batch();
    let batchCount = 0;

    // 1 documento por codigoGrupo con todas las materias/profesores
    for (const [codigoGrupo, data] of Object.entries(byGrupo)) {
      const histRef = db.collection('historialGrupos').doc();
      batch.set(histRef, {
        codigoGrupo,
        carreraId,
        periodoAcademico: periodoActual,
        turno:       data.turno,
        turnoNombre: data.turnoNombre,
        materias:    data.materias,
        fechaArchivado: firebase.firestore.FieldValue.serverTimestamp()
      });
      batchCount++;
      if (batchCount === 499) { await batch.commit(); batch = db.batch(); batchCount = 0; }
    }

    // Marcar grupos como archivados
    gruposSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        activo: false,
        archivado: true,
        fechaArchivado: firebase.firestore.FieldValue.serverTimestamp()
      });
      batchCount++;
    });

    if (batchCount > 0) await batch.commit();
    console.log(`Grupos archivados: ${Object.keys(byGrupo).length} grupos, ${pmSnap.size} asignaciones`);

  } catch (error) {
    console.error('Error al archivar grupos:', error);
    throw error;
  }
}

// Contar grupos archivados en el periodo
async function contarGruposArchivados(carreraId, periodo) {
  try {
    const snap = await db.collection('historialGrupos')
      .where('carreraId', '==', carreraId)
      .where('periodoAcademico', '==', periodo)
      .get();
    return snap.size;
  } catch (error) {
    console.error('Error al contar grupos archivados:', error);
    return 0;
  }
}

// Archivar calificaciones — filtra por carreraId en query (evita N+1 reads)
// Requiere índice compuesto en Firestore: calificaciones → periodo ASC, carreraId ASC
async function archivarCalificaciones(carreraId, periodoActual) {
  try {
    const calificacionesSnap = await db.collection('calificaciones')
      .where('periodo', '==', periodoActual)
      .where('carreraId', '==', carreraId)
      .get();

    let batch = db.batch();
    let batchCount = 0;
    let contador = 0;

    for (const calDoc of calificacionesSnap.docs) {
      const historialRef = db.collection('historialCalificaciones').doc();
      batch.set(historialRef, {
        ...calDoc.data(),
        calificacionOriginalId: calDoc.id,
        periodoArchivado: periodoActual,
        fechaArchivado: firebase.firestore.FieldValue.serverTimestamp()
      });
      contador++;
      batchCount++;

      if (batchCount === 499) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`Calificaciones archivadas: ${contador}`);
    return { contador, docs: calificacionesSnap.docs };

  } catch (error) {
    console.error('Error al archivar calificaciones:', error);
    throw error;
  }
}

// Calificación final efectiva del alumno en una materia:
// ETS tiene prioridad, luego EXT, luego la ordinaria (promedio).
function _calificacionFinal(cal) {
  if (cal.ets !== null && cal.ets !== undefined)              return { calificacion: cal.ets,            acr: 'ETS' };
  if (cal.extraordinario !== null && cal.extraordinario !== undefined) return { calificacion: cal.extraordinario, acr: 'EXT' };
  const prom = cal.promedio ?? null;
  return { calificacion: prom, acr: prom !== null ? 'ORD' : null };
}

// Escribe/actualiza historialAcademico/{alumnoId}:
//   · materias[]  → cierra el semestre actual seteando periodoAcademico en TODAS las materias
//                   del semestre que termina (con o sin calificación capturada)
//   · periodos[]  → arrayUnion con el registro histórico del periodo (solo alumnos con calificaciones)
async function actualizarHistorialAcademico(carreraId, periodoActual, calsDocs, alumnoDataMap) {
  try {
    // Agrupar calificaciones por alumnoId → { materiaId: calData }
    const calPorAlumno = {};
    for (const calDoc of calsDocs) {
      const c = calDoc.data();
      if (!c.alumnoId) continue;
      if (!calPorAlumno[c.alumnoId]) calPorAlumno[c.alumnoId] = {};
      calPorAlumno[c.alumnoId][c.materiaId] = c;
    }

    // Procesar TODOS los alumnos de la carrera (no solo los que tienen calificaciones)
    const alumnoIds = Object.keys(alumnoDataMap);
    if (!alumnoIds.length) return;

    // Leer historialAcademico de todos en paralelo
    const histSnaps = await Promise.all(
      alumnoIds.map(id => db.collection('historialAcademico').doc(id).get())
    );
    const histSnapMap = Object.fromEntries(histSnaps.map(s => [s.id, s]));

    let batch = db.batch();
    let batchCount = 0;

    for (const alumnoId of alumnoIds) {
      const info       = alumnoDataMap[alumnoId] || {};
      const calsAlumno = calPorAlumno[alumnoId] || {};   // vacío si el alumno no tiene calificaciones
      const semActual  = info.semestreActual || null;
      const tieneCals  = Object.keys(calsAlumno).length > 0;

      // ── Registro histórico del periodo (solo si hay calificaciones registradas) ──
      const periodoEntry = tieneCals ? {
        periodo:  periodoActual,
        semestre: semActual,
        materias: Object.values(calsAlumno).map(m => ({
          materiaId:       m.materiaId       || '',
          materiaNombre:   m.materiaNombre   || '',
          materiaCodigo:   m.materiaCodigo   || '',
          parciales:       m.parciales       || {},
          faltas:          m.faltas          || {},
          promedio:        m.promedio        ?? null,
          extraordinario:  m.extraordinario  ?? null,
          ets:             m.ets             ?? null,
          profesorId:      m.profesorId      || '',
          profesorNombre:  m.profesorNombre  || '',
          calificacionId:  `${alumnoId}_${m.materiaId}`
        }))
      } : null;

      // ── Cerrar semestre en materias[]: poner periodoAcademico a TODAS las materias del semestre ──
      // Esto hace que boleta global deje de mostrarlas como "Cursando"
      const histSnap = histSnapMap[alumnoId];
      let materiasActualizadas = null;

      if (histSnap && histSnap.exists) {
        const materiasExistentes = histSnap.data().materias || [];
        let cambiado = false;
        materiasActualizadas = materiasExistentes.map(mat => {
          // Si conocemos el semestre, solo cerrar materias de ese semestre
          if (semActual !== null && mat.periodo !== semActual) return mat;
          if (mat.periodoAcademico) return mat; // ya cerrada — no pisar
          // Cerrar la materia: usar calificación si existe, mantener la actual si no
          const cal = calsAlumno[mat.materiaId];
          if (cal) {
            const { calificacion, acr } = _calificacionFinal(cal);
            cambiado = true;
            return Object.assign({}, mat, { calificacion, acr, periodoAcademico: periodoActual });
          }
          // Sin calificación: cerrar el periodo sin modificar cal/acr
          cambiado = true;
          return Object.assign({}, mat, { periodoAcademico: periodoActual });
        });
        if (!cambiado) materiasActualizadas = null;
      }

      if (!periodoEntry && !materiasActualizadas) continue;

      const writeData = {
        alumnoId,
        alumnoNombre: info.nombre || '',
        matricula:    info.matricula || '',
        carreraId,
        fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (periodoEntry)           writeData.periodos = firebase.firestore.FieldValue.arrayUnion(periodoEntry);
      if (materiasActualizadas)   writeData.materias = materiasActualizadas;

      batch.set(db.collection('historialAcademico').doc(alumnoId), writeData, { merge: true });
      batchCount++;

      if (batchCount === 499) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();
    console.log(`historialAcademico actualizado para ${alumnoIds.length} alumnos`);

  } catch (error) {
    console.error('Error al actualizar historialAcademico:', error);
    throw error;
  }
}

// Ver historial de calificaciones de un alumno
async function verHistorialCalificacionesAlumno(alumnoId) {
  try {
    const snap = await db.collection('historialCalificaciones')
      .where('alumnoId', '==', alumnoId)
      .orderBy('fechaArchivado', 'desc')
      .get();
    
    if (snap.empty) {
      mostrarMensajeModal('No hay calificaciones en el historial', 'info');
      return;
    }
    
    // Obtener datos del alumno
    const alumnoDoc = await db.collection('usuarios').doc(alumnoId).get();
    const alumno = alumnoDoc.data();
    
    // Agrupar por periodo
    const calificacionesPorPeriodo = {};
    snap.forEach(doc => {
      const data = doc.data();
      const periodo = data.periodoArchivado;
      
      if (!calificacionesPorPeriodo[periodo]) {
        calificacionesPorPeriodo[periodo] = [];
      }
      
      calificacionesPorPeriodo[periodo].push(data);
    });
    
    // Construir HTML
    let html = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 900px; margin: 20px auto; max-height: 80vh; overflow-y: auto;">
        <h3 style="margin: 0 0 10px 0; color: #216A32;">Historial de Calificaciones</h3>
        <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
          <strong>Alumno:</strong> ${alumno.nombre}<br>
          <strong>Matrícula:</strong> ${alumno.matricula}
        </div>
    `;
    
    const periodos = Object.keys(calificacionesPorPeriodo).sort().reverse();
    
    for (const periodo of periodos) {
      const calificaciones = calificacionesPorPeriodo[periodo];
      
      html += `
        <div style="margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: #667eea; color: white; padding: 15px; font-weight: 600; font-size: 18px;">
            Periodo: ${periodo}
          </div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="background: #f5f5f5;">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Materia</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Parcial 1</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Parcial 2</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Parcial 3</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Promedio</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      calificaciones.forEach(cal => {
        const p1 = cal.parciales?.parcial1 ?? '-';
        const p2 = cal.parciales?.parcial2 ?? '-';
        const p3 = cal.parciales?.parcial3 ?? '-';
        
        // Calcular promedio
        let promedio = '-';
        const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
        
        if (tieneNP) {
          promedio = '5.0';
        } else {
          const cals = [p1, p2, p3]
            .filter(c => c !== '-' && c !== null && c !== undefined)
            .map(c => parseFloat(c))
            .filter(c => !isNaN(c));
          
          if (cals.length > 0) {
            promedio = (cals.reduce((a, b) => a + b, 0) / cals.length).toFixed(1);
          }
        }
        
        html += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px;">${cal.materiaNombre || 'Sin nombre'}</td>
            <td style="padding: 12px; text-align: center; font-weight: bold;">${p1}</td>
            <td style="padding: 12px; text-align: center; font-weight: bold;">${p2}</td>
            <td style="padding: 12px; text-align: center; font-weight: bold;">${p3}</td>
            <td style="padding: 12px; text-align: center; font-weight: bold; background: #f0f7ff;">${promedio}</td>
          </tr>
        `;
      });
      
      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
    html += `
        <button onclick="cerrarModal()" style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 20px;">
          Cerrar
        </button>
      </div>
    `;
    
    document.getElementById('contenidoModal').innerHTML = html;
    document.getElementById('modalGenerico').style.display = 'flex';
    
  } catch (error) {
    console.error('Error al ver historial:', error);
    alert('Error al cargar historial de calificaciones');
  }
}

// Mostrar mensaje en modal
function mostrarMensajeModal(mensaje, tipo) {
  const colores = {
    info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
    success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#f44336', text: '#c62828' }
  };
  
  const color = colores[tipo] || colores.info;
  
  const html = `
    <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px auto;">
      <div style="background: ${color.bg}; border-left: 4px solid ${color.border}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <div style="color: ${color.text}; font-size: 16px;">${mensaje}</div>
      </div>
      <button onclick="cerrarModal()" style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
        Cerrar
      </button>
    </div>
  `;
  
  document.getElementById('contenidoModal').innerHTML = html;
  document.getElementById('modalGenerico').style.display = 'flex';
}

// Avanza UN alumno al siguiente período (actualiza semestreActual, periodo, codigoGrupo)
// No archiva calificaciones — eso lo hace el cambio de periodo general o historialAcademicoMasivo
async function avanzarAlumnoIndividual(alumnoId) {
  try {
    const alumnoDoc = await db.collection('usuarios').doc(alumnoId).get();
    if (!alumnoDoc.exists) { alert('Alumno no encontrado'); return; }
    const alumno = alumnoDoc.data();

    const carreraDoc = await db.collection('carreras').doc(alumno.carreraId).get();
    const carrera = carreraDoc.data();
    const periodosAnio = carrera?.periodosAnio || 2;
    const numeroPeriodos = carrera?.numeroPeriodos || 9;

    const periodoActual = alumno.periodo;
    const siguientePeriodo = calcularSiguientePeriodo(periodoActual, periodosAnio);
    const nuevoSemestre = (alumno.semestreActual || 1) + 1;
    const esPasante = nuevoSemestre > numeroPeriodos;
    const nuevoCodigoGrupo = esPasante
      ? `${alumno.carreraId}-PASANTE`
      : calcularNuevoCodigoGrupo(alumno.codigoGrupo, nuevoSemestre);
    const nombrePeriodo = obtenerNombrePeriodo(periodosAnio);

    const confirmacion = confirm(
      `AVANZAR ALUMNO AL SIGUIENTE ${nombrePeriodo.toUpperCase()}\n\n` +
      `Alumno: ${alumno.nombre}\n` +
      `Matrícula: ${alumno.matricula || '-'}\n\n` +
      `${nombrePeriodo} actual: ${periodoActual}\n` +
      `${nombrePeriodo} siguiente: ${siguientePeriodo}\n` +
      `Semestre: ${alumno.semestreActual || 1} → ${nuevoSemestre}\n` +
      (esPasante
        ? `Estado: PASANTE (completó ${numeroPeriodos} periodos)\n`
        : `Grupo nuevo: ${nuevoCodigoGrupo || '(sin grupo calculado)'}\n`) +
      `\nNota: solo actualiza el registro del alumno. Las calificaciones\n` +
      `se archivan al ejecutar el cambio de periodo general.\n\n` +
      `¿Continuar?`
    );
    if (!confirmacion) return;

    const updateData = {
      periodo: siguientePeriodo,
      semestreActual: nuevoSemestre,
      codigoGrupo: nuevoCodigoGrupo,
      ultimoCambio: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (esPasante) updateData.pasante = true;
    await db.collection('usuarios').doc(alumnoId).update(updateData);

    const msg = esPasante
      ? `✓ ${alumno.nombre} marcado como PASANTE`
      : `✓ ${alumno.nombre} avanzado al ${nombrePeriodo.toLowerCase()} ${siguientePeriodo}`;
    alert(msg);

  } catch (error) {
    console.error('Error al avanzar alumno:', error);
    alert('Error: ' + error.message);
  }
}

// Garantiza que exista la infraestructura de modal (modalGenerico / contenidoModal)
// Para páginas que no tengan modal propio (ej: controlAdmin)
function _asegurarModalGenerico() {
  if (!document.getElementById('modalGenerico')) {
    const overlay = document.createElement('div');
    overlay.id = 'modalGenerico';
    overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;overflow-y:auto;';
    overlay.innerHTML = '<div id="contenidoModal" style="width:100%;max-height:90vh;overflow-y:auto;"></div>';
    document.body.appendChild(overlay);
    if (typeof cerrarModal === 'undefined') {
      window.cerrarModal = () => { overlay.style.display = 'none'; };
    }
  }
}

// Genera/reconstruye historialAcademico/{alumnoId} para TODOS los alumnos.
// Lee historialCalificaciones (periodos pasados) + calificaciones activas (periodo actual).
// Idempotente: sobreescribe el documento completo cada vez.
async function generarHistorialAcademicoMasivo() {
  const confirmado = confirm(
    'GENERAR HISTORIAL ACADÉMICO MASIVO\n\n' +
    'Lee historialCalificaciones y calificaciones activas para\n' +
    'reconstruir el expediente histórico de cada alumno.\n\n' +
    'Es seguro ejecutarlo varias veces (sobreescribe).\n\n¿Continuar?'
  );
  if (!confirmado) return;

  _asegurarModalGenerico();

  document.getElementById('contenidoModal').innerHTML = `
    <div style="background:white;padding:40px;border-radius:15px;text-align:center;max-width:500px;margin:20px auto;">
      <div style="font-size:18px;font-weight:600;margin-bottom:20px;">Generando Historial Académico...</div>
      <div style="color:#666;margin-bottom:20px;">Por favor espera, esto puede tomar unos momentos.</div>
      <div style="background:#e0e0e0;height:8px;border-radius:4px;overflow:hidden;">
        <div id="vigiaProgressBar" style="background:linear-gradient(90deg,#1b5e20,#4caf50);height:100%;width:0%;transition:width 0.3s;"></div>
      </div>
      <div id="vigiaProgressText" style="margin-top:10px;color:#666;font-size:14px;">Leyendo datos...</div>
    </div>
  `;
  document.getElementById('modalGenerico').style.display = 'flex';

  const progressBar = document.getElementById('vigiaProgressBar');
  const progressText = document.getElementById('vigiaProgressText');

  try {
    progressText.textContent = 'Leyendo historialCalificaciones...';
    progressBar.style.width = '10%';
    const histSnap = await db.collection('historialCalificaciones').get();

    progressText.textContent = 'Leyendo calificaciones activas...';
    progressBar.style.width = '25%';
    const calSnap = await db.collection('calificaciones').get();

    progressText.textContent = 'Leyendo alumnos...';
    progressBar.style.width = '40%';
    const alumnosSnap = await db.collection('usuarios').where('rol', '==', 'alumno').get();

    const alumnoDataMap = {};
    alumnosSnap.docs.forEach(doc => {
      const a = doc.data();
      alumnoDataMap[doc.id] = { nombre: a.nombre || '', matricula: a.matricula || '', carreraId: a.carreraId || '' };
    });

    progressText.textContent = 'Procesando historial...';
    progressBar.style.width = '55%';

    const porAlumno = {};
    const agregar = (c, periodoKey) => {
      if (!c.alumnoId || !periodoKey) return;
      if (!porAlumno[c.alumnoId]) porAlumno[c.alumnoId] = {};
      if (!porAlumno[c.alumnoId][periodoKey]) porAlumno[c.alumnoId][periodoKey] = [];
      porAlumno[c.alumnoId][periodoKey].push({
        materiaId: c.materiaId || '',
        materiaNombre: c.materiaNombre || '',
        materiaCodigo: c.materiaCodigo || '',
        parciales: c.parciales || {},
        faltas: c.faltas || {},
        promedio: c.promedio ?? null,
        extraordinario: c.extraordinario ?? null,
        ets: c.ets ?? null,
        profesorId: c.profesorId || '',
        profesorNombre: c.profesorNombre || '',
        calificacionId: `${c.alumnoId}_${c.materiaId}`
      });
    };

    histSnap.docs.forEach(doc => { const c = doc.data(); agregar(c, c.periodoArchivado || c.periodo || ''); });
    calSnap.docs.forEach(doc => { const c = doc.data(); agregar(c, c.periodo || ''); });

    progressText.textContent = 'Escribiendo historialAcademico...';
    progressBar.style.width = '70%';

    const alumnoIds = Object.keys(porAlumno);
    let escritos = 0;

    for (let i = 0; i < alumnoIds.length; i += 499) {
      const lote = alumnoIds.slice(i, i + 499);
      const batch = db.batch();
      for (const alumnoId of lote) {
        const info = alumnoDataMap[alumnoId] || {};
        const periodosArray = Object.keys(porAlumno[alumnoId]).sort().map(periodo => ({
          periodo,
          materias: porAlumno[alumnoId][periodo]
        }));
        batch.set(db.collection('historialAcademico').doc(alumnoId), {
          alumnoId,
          alumnoNombre: info.nombre || '',
          matricula: info.matricula || '',
          carreraId: info.carreraId || '',
          periodos: periodosArray,
          fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        escritos++;
      }
      await batch.commit();
      const progreso = 70 + (escritos / alumnoIds.length) * 28;
      progressBar.style.width = `${progreso}%`;
      progressText.textContent = `Escribiendo... ${escritos}/${alumnoIds.length} alumnos`;
    }

    progressBar.style.width = '100%';
    setTimeout(() => {
      document.getElementById('contenidoModal').innerHTML = `
        <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
          <h3 style="color:#2e7d32;text-align:center;margin:0 0 20px 0;">Historial Académico Generado</h3>
          <div style="background:#e8f5e9;border-radius:8px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
              <span>Registros archivados leídos:</span><strong>${histSnap.size}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
              <span>Calificaciones activas:</span><strong>${calSnap.size}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;">
              <span>Documentos escritos:</span><strong style="color:#4caf50;">${escritos}</strong>
            </div>
          </div>
          <button onclick="cerrarModal()" style="width:100%;padding:12px;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
            Cerrar
          </button>
        </div>
      `;
    }, 800);

  } catch (error) {
    console.error('Error en generarHistorialAcademicoMasivo:', error);
    document.getElementById('contenidoModal').innerHTML = `
      <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
        <h3 style="color:#d32f2f;text-align:center;margin:0 0 20px 0;">Error</h3>
        <div style="background:#ffebee;border-left:4px solid #f44336;padding:15px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;color:#c62828;">${error.message}</p>
        </div>
        <button onclick="cerrarModal()" style="width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
          Cerrar
        </button>
      </div>
    `;
  }
}

console.log('Sistema de Cambio de Periodo cargado con soporte para diferentes tipos de periodos (Semestral, Cuatrimestral, Trimestral)');