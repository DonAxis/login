// vigia.js
// Función temporal de vigía - se puede borrar fácilmente

function accionVigia() {
  alert('Sin novedad al frente');
}


// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN: Agregar campo tieneExamenFinal a colección carreras
// Ejecutar UNA SOLA VEZ. Después de ejecutar, este botón puede quedar o
// puede eliminarse — no causa daño si se corre de nuevo (es idempotente).
//
// Qué hace:
//   - Lee todos los docs de 'carreras'
//   - Si numeroPeriodos === 9  →  tieneExamenFinal: true
//   - Cualquier otro valor     →  tieneExamenFinal: false
//   - NO modifica ningún otro campo existente
// ─────────────────────────────────────────────────────────────────────────────
async function migrarTieneExamenFinal() {
  const db = firebase.firestore();

  // PASO 1 — Leer todas las carreras y mostrar preview
  let snapshot;
  try {
    snapshot = await db.collection('carreras').get();
  } catch (e) {
    alert('Error al leer carreras: ' + e.message);
    return;
  }

  if (snapshot.empty) {
    alert('No se encontraron documentos en la colección carreras.');
    return;
  }

  // Construir lista de lo que se va a cambiar
  const lineas = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const valor = d.numeroPeriodos === 9 ? true : false;
    const yaExiste = d.tieneExamenFinal !== undefined;
    lineas.push(
      `• ${d.nombre || doc.id}  (numeroPeriodos: ${d.numeroPeriodos ?? '?'})` +
      `  →  tieneExamenFinal: ${valor}` +
      (yaExiste ? `  [ya tenía: ${d.tieneExamenFinal}]` : '  [campo nuevo]')
    );
  });

  const preview = lineas.join('\n');
  const confirmar = confirm(
    `Se agregarán/actualizarán ${snapshot.size} carrera(s):\n\n` +
    preview +
    '\n\n¿Continuar?'
  );

  if (!confirmar) {
    alert('Migración cancelada.');
    return;
  }

  // PASO 2 — Ejecutar en batch
  const batch = db.batch();
  snapshot.forEach(doc => {
    const valor = doc.data().numeroPeriodos === 9 ? true : false;
    batch.update(doc.ref, { tieneExamenFinal: valor });
  });

  try {
    await batch.commit();
    alert(
      `✓ Migración completada.\n` +
      `${snapshot.size} carrera(s) actualizadas con el campo tieneExamenFinal.`
    );
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  }
}
