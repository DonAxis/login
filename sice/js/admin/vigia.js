// Función temporal de vigía esta funcion sirve para una acion concreta y se  vuelve a borrar

async function accionVigia() {
  const db = firebase.firestore();
  const PERIODO_VIEJO = '2026-1';
  const PERIODO_NUEVO = '2026-2';
  let log = [];

  try {
    // === 1. Copiar numeroPeriodos de "grupos" a "config" por carreraId ===
    const gruposSnap = await db.collection('grupos').get();
    const numeroPeriodosPorCarrera = {};
    gruposSnap.forEach(doc => {
      const data = doc.data();
      if (data.carreraId && data.numeroPeriodos !== undefined) {
        numeroPeriodosPorCarrera[data.carreraId] = data.numeroPeriodos;
      }
    });

    const configSnap = await db.collection('config').get();
    const batch1 = db.batch();
    let count1 = 0;
    configSnap.forEach(doc => {
      const data = doc.data();
      const np = numeroPeriodosPorCarrera[data.carreraId];
      if (np !== undefined) {
        batch1.update(doc.ref, { numeroPeriodos: np });
        count1++;
      }
    });
    await batch1.commit();
    log.push(`1. numeroPeriodos copiado a ${count1} docs de "config"`);

    // === 2. Actualizar "periodo" en "config": 2026-1 → 2026-2 ===
    const batch2 = db.batch();
    let count2 = 0;
    configSnap.forEach(doc => {
      if (doc.data().periodo === PERIODO_VIEJO) {
        batch2.update(doc.ref, { periodo: PERIODO_NUEVO });
        count2++;
      }
    });
    await batch2.commit();
    log.push(`2. "config" periodo actualizado en ${count2} docs`);

    // === 3. Actualizar "periodo" en "inscripcionesEspeciales" ===
    const inscSnap = await db.collection('inscripcionesEspeciales')
      .where('periodo', '==', PERIODO_VIEJO).get();
    const batch3 = db.batch();
    inscSnap.forEach(doc => batch3.update(doc.ref, { periodo: PERIODO_NUEVO }));
    await batch3.commit();
    log.push(`3. "inscripcionesEspeciales" actualizadas: ${inscSnap.size} docs`);

    // === 4. Actualizar "periodoAcademico" en "profesorMaterias" ===
    const pmSnap = await db.collection('profesorMaterias')
      .where('periodoAcademico', '==', PERIODO_VIEJO).get();
    const batch4 = db.batch();
    pmSnap.forEach(doc => batch4.update(doc.ref, { periodoAcademico: PERIODO_NUEVO }));
    await batch4.commit();
    log.push(`4. "profesorMaterias" actualizadas: ${pmSnap.size} docs`);

    // === 5. Actualizar "periodoIngreso" en "usuarios" donde rol == "alumno" ===
    const usuSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('periodoIngreso', '==', PERIODO_VIEJO).get();
    const batch5 = db.batch();
    usuSnap.forEach(doc => batch5.update(doc.ref, { periodoIngreso: PERIODO_NUEVO }));
    await batch5.commit();
    log.push(`5. "usuarios" alumnos actualizados: ${usuSnap.size} docs`);

    alert('✅ Vigía completado:\n' + log.join('\n'));
    console.log('Vigía completado:', log);

  } catch (error) {
    console.error('Error en accionVigia:', error);
    alert('❌ Error en vigía: ' + error.message + '\n\nRevisa la consola para más detalles.');
  }
}
