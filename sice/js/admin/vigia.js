// Vigía — herramienta de mantenimiento puntual

// Corrige profesorMaterias donde periodo quedó como ciclo escolar ('2026-1')
// en lugar del número de grado (1, 2, 3...).
// Busca el grado correcto en la colección materias via materiaId.
async function accionVigia() {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Ejecutando...'; }

  try {
    // Obtener todos los docs activos de profesorMaterias
    const snap = await db.collection('profesorMaterias').where('activa', '==', true).get();

    const CICLO_PATTERN = /^\d{4}-\d+$/; // detecta strings tipo '2026-1'
    const malos = snap.docs.filter(doc => {
      const p = doc.data().periodo;
      return typeof p === 'string' && CICLO_PATTERN.test(p);
    });

    if (malos.length === 0) {
      alert('Vigía: No se encontraron documentos con periodo incorrecto. Todo está bien.');
      if (btn) { btn.disabled = false; btn.textContent = 'Ejecutar Vigía'; }
      return;
    }

    console.log(`Vigía: encontrados ${malos.length} docs con periodo incorrecto:`, malos.map(d => d.id));

    // Recopilar materiaIds únicos para leerlos en batch
    const materiaIds = [...new Set(malos.map(d => d.data().materiaId).filter(Boolean))];

    // Leer todas las materias necesarias en paralelo
    const materiaDocs = await Promise.all(
      materiaIds.map(id => db.collection('materias').doc(id).get())
    );
    const gradoPorMateriaId = {};
    materiaDocs.forEach(doc => {
      if (doc.exists) {
        const grado = doc.data().periodo;
        if (grado != null) gradoPorMateriaId[doc.id] = Number(grado);
      }
    });

    // Aplicar correcciones en batch
    const batch = db.batch();
    const errores = [];
    let corregidos = 0;

    malos.forEach(doc => {
      const materiaId = doc.data().materiaId;
      const gradoCorrecto = gradoPorMateriaId[materiaId];
      if (gradoCorrecto != null) {
        batch.update(doc.ref, { periodo: gradoCorrecto });
        corregidos++;
        console.log(`  Corrigiendo ${doc.id}: '${doc.data().periodo}' → ${gradoCorrecto}`);
      } else {
        errores.push(`${doc.id}: materiaId '${materiaId}' no encontrado en colección materias`);
        console.warn(`  Sin grado para ${doc.id} (materiaId: ${materiaId})`);
      }
    });

    await batch.commit();

    let msg = `Vigía completado.\n\n✅ Corregidos: ${corregidos} de ${malos.length}`;
    if (errores.length) msg += `\n\n⚠️ Sin resolver (${errores.length}):\n` + errores.join('\n');
    alert(msg);

  } catch (e) {
    console.error('Error en Vigía:', e);
    alert('Error en Vigía: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Ejecutar Vigía'; }
  }
}
