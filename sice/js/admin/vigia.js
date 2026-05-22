// vigia.js — funciones de mantenimiento único (idempotentes, seguras de repetir)

function accionVigia() {
  migrarProfesorEnReportes();
}

// ─────────────────────────────────────────────────────────────────────────────
// migrarProfesorEnReportes
// Reemplaza el UID y nombre de un profesor eliminado en todos los documentos
// de reportesPrefecto donde aparezca (en profesoresPendientes y en profesores).
// Idempotente: si ya fue migrado, no hace nada en ese doc.
// ─────────────────────────────────────────────────────────────────────────────
async function migrarProfesorEnReportes() {
  const OLD_UID  = 'y916y3L99tR6PHwVlZSKLX08jk52';
  const NEW_UID  = 'k5pDfU9sTgcLc7fkPQuC8g0qaXO2';
  const NEW_NAME = 'María del Carmen Ramírez Martínez';

  const btn = document.getElementById('btnVigia');
  if (btn) btn.disabled = true;

  try {
    console.log('[Vigía] Buscando reportes con UID antiguo:', OLD_UID);

    // Leer TODOS los reportes (archivados incluidos — la migración aplica a todos)
    const snap = await db.collection('reportesPrefecto').get();

    if (snap.empty) {
      alert('No hay reportes en reportesPrefecto.');
      return;
    }

    let actualizados = 0;
    const batch = db.batch();

    snap.forEach(docSnap => {
      const data       = docSnap.data();
      const pendientes = Array.isArray(data.profesoresPendientes) ? data.profesoresPendientes : [];
      const profMap    = data.profesores || {};

      const enPendientes = pendientes.includes(OLD_UID);
      const enMapa       = OLD_UID in profMap;

      if (!enPendientes && !enMapa) return;

      const update = {};

      if (enPendientes) {
        update.profesoresPendientes = pendientes.map(uid => uid === OLD_UID ? NEW_UID : uid);
      }

      if (enMapa) {
        const vieja = profMap[OLD_UID];
        update[`profesores.${NEW_UID}`] = {
          nombre   : NEW_NAME,
          fecha    : vieja.fecha     || null,
          respuesta: vieja.respuesta || null
        };
        update[`profesores.${OLD_UID}`] = firebase.firestore.FieldValue.delete();
      }

      batch.update(docSnap.ref, update);
      actualizados++;
      console.log(`[Vigía] Doc ${docSnap.id} — pendientes:${enPendientes} mapa:${enMapa}`);
    });

    if (actualizados === 0) {
      alert(`UID ${OLD_UID} no encontrado en ningún reporte.\nPuede que ya haya sido migrado.`);
      return;
    }

    await batch.commit();
    alert(
      `Migración completada.\n\n` +
      `UID: ${OLD_UID}\n→ ${NEW_UID}\n\n` +
      `Nombre: ${NEW_NAME}\n` +
      `Documentos actualizados: ${actualizados}`
    );

  } catch (err) {
    console.error('[Vigía] Error en migración:', err);
    alert('Error en la migración. Ver consola para detalles.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

