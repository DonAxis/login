// Vigía — herramienta de mantenimiento puntual

async function accionVigia() {
  // Fusionar duplicado de Garcia Lopez Emilio Santiago (LD)
  // CONSERVAR: LnTHWg5HDxIQDy1CLpRm (tiene historial periodos 1-8)
  // ELIMINAR:  4ErhBhQNrTXOBjyOYqxv (duplicado, solo periodo 9)
  const UID_CONSERVAR = 'LnTHWg5HDxIQDy1CLpRm';
  const UID_BORRAR    = '4ErhBhQNrTXOBjyOYqxv';

  const db = firebase.firestore();
  const log = [];

  try {
    // 1. Leer periodo académico actual de LD
    const configDoc = await db.doc('config/periodo_LD').get();
    const periodoActualCarrera = configDoc.exists ? configDoc.data().periodo : null;
    log.push(`Periodo actual LD: ${periodoActualCarrera || '(no encontrado)'}`);

    // 2. Avanzar alumno conservado a periodo 9 con el grupo correcto
    const updateData = {
      periodo: 9,
      codigoGrupo: 'LD-1901',
      turno: 1,
    };
    if (periodoActualCarrera) {
      updateData.periodoActualCiclo = periodoActualCarrera;
    }
    await db.doc(`usuarios/${UID_CONSERVAR}`).update(updateData);
    log.push('✅ Alumno conservado actualizado: periodo=9, grupo=LD-1901, turno=1');

    // 3. Eliminar calificaciones del duplicado
    const califs = await db.collection('calificaciones')
      .where('alumnoId', '==', UID_BORRAR).get();
    if (!califs.empty) {
      const batch1 = db.batch();
      califs.forEach(doc => batch1.delete(doc.ref));
      await batch1.commit();
    }
    log.push(`✅ Calificaciones del duplicado eliminadas: ${califs.size} doc(s)`);

    // 4. Eliminar historialAcademico del duplicado
    const histRef = db.doc(`historialAcademico/${UID_BORRAR}`);
    const histDoc = await histRef.get();
    if (histDoc.exists) {
      await histRef.delete();
      log.push('✅ historialAcademico del duplicado eliminado');
    } else {
      log.push('ℹ️ historialAcademico del duplicado no existía');
    }

    // 5. Eliminar inscripcionesEspeciales del duplicado (si las tuviera)
    const insEsp = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', UID_BORRAR).get();
    if (!insEsp.empty) {
      const batch2 = db.batch();
      insEsp.forEach(doc => batch2.delete(doc.ref));
      await batch2.commit();
      log.push(`✅ InscripcionesEspeciales eliminadas: ${insEsp.size} doc(s)`);
    }

    // 6. Eliminar alumnoMaterias del duplicado (si las tuviera)
    const alumMat = await db.collection('alumnoMaterias')
      .where('alumnoId', '==', UID_BORRAR).get();
    if (!alumMat.empty) {
      const batch3 = db.batch();
      alumMat.forEach(doc => batch3.delete(doc.ref));
      await batch3.commit();
      log.push(`✅ AlumnoMaterias eliminados: ${alumMat.size} doc(s)`);
    }

    // 7. Eliminar usuario duplicado
    await db.doc(`usuarios/${UID_BORRAR}`).delete();
    log.push('✅ Usuario duplicado eliminado');

    alert('Vigía completado con éxito:\n\n' + log.join('\n'));
  } catch (err) {
    console.error('Error en vigía:', err);
    alert('Error: ' + err.message + '\n\nLog hasta el momento:\n' + log.join('\n'));
  }
}
