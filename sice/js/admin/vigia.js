// Vigía — herramienta de mantenimiento puntual de un unico uso

function accionVigia() {
  migrarCamposFaltantesHistorial();
}

// Agrega acr, periodoAcademico y valida a los registros de materias[] en historialAcademico
// que no los tengan. No modifica campos que ya existen.
async function migrarCamposFaltantesHistorial() {
  if (!confirm(
    'MIGRACIÓN: Campos faltantes en historialAcademico\n\n' +
    'Agrega acr, periodoAcademico y valida a las materias que no los tengan.\n' +
    'Los campos existentes NO se modifican.\n\n' +
    '¿Continuar?'
  )) return;

  try {
    console.log('[vigia] Leyendo historialAcademico...');
    const snap = await db.collection('historialAcademico').get();
    console.log('[vigia] Documentos encontrados:', snap.size);

    let batch       = db.batch();
    let batchCount  = 0;
    let modificados = 0;
    let sinCambios  = 0;

    for (const doc of snap.docs) {
      const materias = doc.data().materias || [];
      let cambiado   = false;

      const materiasActualizadas = materias.map(m => {
        const faltanCampos = !('acr' in m) || !('periodoAcademico' in m) || !('valida' in m);
        if (!faltanCampos) return m;

        cambiado    = true;
        const upd   = Object.assign({}, m);
        if (!('acr'              in m)) upd.acr              = null;
        if (!('periodoAcademico' in m)) upd.periodoAcademico = null;
        if (!('valida'           in m)) upd.valida           = true;
        return upd;
      });

      if (!cambiado) { sinCambios++; continue; }

      batch.update(doc.ref, {
        materias:           materiasActualizadas,
        fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      batchCount++;
      modificados++;

      if (batchCount === 499) {
        await batch.commit();
        console.log('[vigia] Batch enviado —', modificados, 'alumnos procesados hasta ahora');
        batch      = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();

    const resumen =
      '✅ Migración completada\n\n' +
      'Modificados: '          + modificados + '\n' +
      'Sin cambios (completos): ' + sinCambios  + '\n' +
      'Total documentos: '     + snap.size;

    console.log('[vigia]', resumen);
    alert(resumen);

  } catch (e) {
    console.error('[vigia] Error:', e);
    alert('❌ Error en migración:\n' + e.message);
  }
}
