

const ID_VIEJO = 'fkrWoQaTVeQbCxXTDLsIbeXHFD23';
const ID_NUEVO  = 'PgtRnRz87kTN6BqEFAjnOhdxw472';

// Ejecuta operaciones en lotes de 400 para no exceder el límite de 500 de Firestore
async function _commitEnLotes(operaciones) {
  const LOTE = 400;
  for (let i = 0; i < operaciones.length; i += LOTE) {
    const batch = db.batch();
    operaciones.slice(i, i + LOTE).forEach(op => op(batch));
    await batch.commit();
  }
}

async function accionVigia() {
  const confirmar = confirm(
    `⚠️ MIGRACIÓN DE PROFESOR\n\n` +
    `ID viejo: ${ID_VIEJO}\n` +
    `ID nuevo: ${ID_NUEVO}\n\n` +
    `Se actualizarán:\n` +
    `• profesorMaterias  (profesorId + profesorNombre)\n` +
    `• calificaciones    (profesorId + profesorNombre)\n` +
    `• reportesPrefecto  (pendientes y respondidos)\n\n` +
    `¿Continuar?`
  );
  if (!confirmar) return;

  try {
    const resumen = {
      profesorMaterias: 0,
      calificaciones: 0,
      reportesPendientes: 0,
      reportesHistoricos: 0,
    };

    // 1 — Obtener nombre del nuevo profesor
    const profNuevoDoc = await db.collection('usuarios').doc(ID_NUEVO).get();
    if (!profNuevoDoc.exists) {
      alert(`❌ Error: No se encontró el usuario con ID nuevo:\n${ID_NUEVO}`);
      return;
    }
    const nombreNuevo = profNuevoDoc.data().nombre;

    // 2 — profesorMaterias
    const pmSnap = await db.collection('profesorMaterias')
      .where('profesorId', '==', ID_VIEJO).get();

    const pmOps = pmSnap.docs.map(doc => batch =>
      batch.update(doc.ref, { profesorId: ID_NUEVO, profesorNombre: nombreNuevo })
    );
    if (pmOps.length) await _commitEnLotes(pmOps);
    resumen.profesorMaterias = pmOps.length;

    // 3 — calificaciones
    const calSnap = await db.collection('calificaciones')
      .where('profesorId', '==', ID_VIEJO).get();

    const calOps = calSnap.docs.map(doc => batch =>
      batch.update(doc.ref, { profesorId: ID_NUEVO, profesorNombre: nombreNuevo })
    );
    if (calOps.length) await _commitEnLotes(calOps);
    resumen.calificaciones = calOps.length;

    // 4 — reportesPrefecto
    // Firestore no permite consultar por clave de mapa, así que se leen todos
    // y se filtra en memoria. En este sistema el volumen es bajo (~600 usuarios).
    const rpSnap = await db.collection('reportesPrefecto').get();
    const rpOps = [];

    rpSnap.docs.forEach(doc => {
      const data = doc.data();
      const pendientes   = data.profesoresPendientes || [];
      const profesoresMap = data.profesores || {};

      const esPendiente   = pendientes.includes(ID_VIEJO);
      const tieneEntrada  = Object.prototype.hasOwnProperty.call(profesoresMap, ID_VIEJO);

      if (!esPendiente && !tieneEntrada) return;

      const update = {};

      // Array profesoresPendientes: reemplazar ID viejo por ID nuevo
      if (esPendiente) {
        update.profesoresPendientes = pendientes.map(id => id === ID_VIEJO ? ID_NUEVO : id);
        resumen.reportesPendientes++;
      }

      // Mapa profesores: mover entrada del ID viejo al nuevo
      if (tieneEntrada) {
        const entrada = { ...profesoresMap[ID_VIEJO] };
        // Si aún no respondió, actualizar el nombre al del nuevo profesor
        if (esPendiente) entrada.nombre = nombreNuevo;
        update[`profesores.${ID_NUEVO}`] = entrada;
        update[`profesores.${ID_VIEJO}`] = firebase.firestore.FieldValue.delete();
        if (!esPendiente) resumen.reportesHistoricos++;
      }

      rpOps.push(batch => batch.update(doc.ref, update));
    });

    if (rpOps.length) await _commitEnLotes(rpOps);

    const msg =
      `✅ Migración completada exitosamente\n\n` +
      `Nuevo profesor: ${nombreNuevo}\n` +
      `────────────────────────────────\n` +
      `profesorMaterias actualizados : ${resumen.profesorMaterias}\n` +
      `calificaciones actualizadas   : ${resumen.calificaciones}\n` +
      `reportesPrefecto pendientes   : ${resumen.reportesPendientes}\n` +
      `reportesPrefecto históricos   : ${resumen.reportesHistoricos}`;

    alert(msg);
    console.log('[vigia] Migración profesor:', resumen);

  } catch (error) {
    console.error('[vigia] Error en migración:', error);
    alert(`❌ Error durante la migración:\n${error.message}\n\nRevisa la consola para más detalles.`);
  }
}
