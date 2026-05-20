// vigia.js — funciones de mantenimiento único (idempotentes, seguras de repetir)

function accionVigia() {
  diagnosticarReportesPrefecto();
}

// ─────────────────────────────────────────────────────────────────────────────
// diagnosticarReportesPrefecto
// Busca reportes de prefecto con profesores pendientes y detecta casos donde
// el profesor no ve el reporte a pesar de estar asignado al grupo del alumno.
//
// Causas que detecta:
//  A) UID en profesoresPendientes no corresponde a ningún doc en `usuarios`
//     → profesorMaterias.profesorId fue guardado con un UID incorrecto
//  B) Profesor actualmente en profesorMaterias del grupo del alumno
//     pero AUSENTE del mapa `profesores` del reporte
//     → fue asignado al grupo DESPUÉS de crear el reporte (o el codigoGrupo difiere)
//  C) Profesor en `profesores` pero ya NO existe en profesorMaterias del grupo
//     → fue desasignado; el reporte quedó "huérfano" para ese profesor
//
// Resultado: alert con resumen + console.table con detalles
// ─────────────────────────────────────────────────────────────────────────────
async function diagnosticarReportesPrefecto() {
  const btn = document.getElementById('btnVigia');
  if (btn) btn.disabled = true;

  try {
    console.log('[Vigía] Iniciando diagnóstico de reportes prefecto…');

    // 1. Obtener todos los reportes con profesores aún pendientes
    const snapReportes = await db.collection('reportesPrefecto')
      .where('archivado', '==', false)
      .get();

    if (snapReportes.empty) {
      alert('No hay reportes activos. Nada que diagnosticar.');
      return;
    }

    const reportes = snapReportes.docs.map(d => ({ id: d.id, ...d.data() }));
    const reportesConPendientes = reportes.filter(r =>
      Array.isArray(r.profesoresPendientes) && r.profesoresPendientes.length > 0
    );

    console.log(`[Vigía] Total reportes activos: ${reportes.length} | Con pendientes: ${reportesConPendientes.length}`);

    if (reportesConPendientes.length === 0) {
      alert('No hay reportes con profesores pendientes. Todos respondieron o están archivados.');
      return;
    }

    // 2. Obtener todos los UIDs únicos referenciados en profesoresPendientes
    const uidsReferenciadosSet = new Set();
    reportesConPendientes.forEach(r => {
      r.profesoresPendientes.forEach(uid => uidsReferenciadosSet.add(uid));
    });
    const uidsReferenciados = [...uidsReferenciadosSet];

    // 3. Verificar cuáles de esos UIDs existen en `usuarios` (batch de 30 máx por in-query)
    const usuariosEncontrados = {};
    const chunkSize = 30;
    for (let i = 0; i < uidsReferenciados.length; i += chunkSize) {
      const chunk = uidsReferenciados.slice(i, i + chunkSize);
      const snapUsuarios = await db.collection('usuarios')
        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      snapUsuarios.forEach(doc => {
        usuariosEncontrados[doc.id] = doc.data();
      });
    }

    // 4. Obtener codigosGrupo únicos de los reportes para consultar profesorMaterias
    const gruposSet = new Set();
    reportesConPendientes.forEach(r => { if (r.codigoGrupo) gruposSet.add(r.codigoGrupo); });
    const grupos = [...gruposSet];

    // profesoresPorGrupo: { codigoGrupo → { [profesorId]: profesorNombre } }
    const profesoresPorGrupo = {};
    for (const grupo of grupos) {
      const snapPM = await db.collection('profesorMaterias')
        .where('codigoGrupo', '==', grupo)
        .where('activa', '==', true)
        .get();
      const mapa = {};
      snapPM.forEach(doc => {
        const d = doc.data();
        if (d.profesorId) mapa[d.profesorId] = d.profesorNombre || '(sin nombre)';
      });
      profesoresPorGrupo[grupo] = mapa;
    }

    // 5. Analizar cada reporte
    const filas = [];

    for (const reporte of reportesConPendientes) {
      const { id, alumnoNombre, codigoGrupo, fechaSolicitud,
              profesoresPendientes: pendientes,
              profesores: profesoresMap } = reporte;

      const profesoresActualesEnGrupo = profesoresPorGrupo[codigoGrupo] || {};
      const fechaStr = fechaSolicitud
        ? new Date(fechaSolicitud).toLocaleDateString('es-MX')
        : '?';

      // Causa A: UID en pendientes que no existe en `usuarios`
      for (const uid of pendientes) {
        if (!usuariosEncontrados[uid]) {
          filas.push({
            reporteId: id,
            alumno: alumnoNombre,
            grupo: codigoGrupo,
            fecha: fechaStr,
            causa: 'A — UID no existe en usuarios',
            uidProblema: uid,
            nombreRegistrado: profesoresMap?.[uid]?.nombre || '(no registrado)',
            detalle: 'profesorMaterias.profesorId no coincide con ningún Firebase Auth UID'
          });
        }
      }

      // Causa B: Profesor actualmente en profesorMaterias pero ausente del reporte
      for (const [profesorId, profesorNombre] of Object.entries(profesoresActualesEnGrupo)) {
        const estaEnMapa    = profesoresMap && profesorId in profesoresMap;
        const estaEnPending = pendientes.includes(profesorId);
        if (!estaEnMapa && !estaEnPending) {
          filas.push({
            reporteId: id,
            alumno: alumnoNombre,
            grupo: codigoGrupo,
            fecha: fechaStr,
            causa: 'B — Profesor en grupo pero ausente del reporte',
            uidProblema: profesorId,
            nombreRegistrado: profesorNombre,
            detalle: 'Fue asignado al grupo después de crear el reporte, o el codigoGrupo difiere'
          });
        }
      }

      // Causa C: UID en pendientes que YA no tiene materias activas en el grupo
      for (const uid of pendientes) {
        if (!(uid in profesoresActualesEnGrupo)) {
          // Solo reportar si SÍ existe en usuarios (si no existe ya lo captura Causa A)
          if (usuariosEncontrados[uid]) {
            filas.push({
              reporteId: id,
              alumno: alumnoNombre,
              grupo: codigoGrupo,
              fecha: fechaStr,
              causa: 'C — Profesor ya no está activo en el grupo',
              uidProblema: uid,
              nombreRegistrado: profesoresMap?.[uid]?.nombre || usuariosEncontrados[uid]?.nombre || '?',
              detalle: 'Fue desasignado del grupo; el reporte quedó en su lista pero puede ser irrelevante'
            });
          }
        }
      }
    }

    // 6. Mostrar resultados
    if (filas.length === 0) {
      alert(
        `Diagnóstico completado.\n` +
        `Reportes con pendientes: ${reportesConPendientes.length}\n\n` +
        `No se encontraron inconsistencias. Si un profesor no ve su reporte, ` +
        `verificar que su UID en profesorMaterias.profesorId coincida con su Firebase Auth UID.`
      );
    } else {
      console.table(filas);

      const resumenCausas = filas.reduce((acc, f) => {
        const c = f.causa.charAt(0);
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});

      const lineasResumen = Object.entries(resumenCausas)
        .map(([c, n]) => `  Causa ${c}: ${n} caso(s)`).join('\n');

      alert(
        `Diagnóstico completado.\n\n` +
        `Reportes analizados: ${reportesConPendientes.length}\n` +
        `Inconsistencias encontradas: ${filas.length}\n\n` +
        `${lineasResumen}\n\n` +
        `Ver consola (F12 → Console) para el detalle completo (console.table).`
      );
    }

  } catch (err) {
    console.error('[Vigía] Error en diagnóstico:', err);
    alert('Error al diagnosticar. Ver consola para detalles.');
  } finally {
    if (btn) btn.disabled = false;
  }
}
