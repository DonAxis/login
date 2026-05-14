// vigia.js — funciones de mantenimiento único (idempotentes, seguras de repetir)

function accionVigia() {
  eliminarSemestreActual();
}

// Elimina el campo semestreActual de todos los alumnos en usuarios/.
// Idempotente: si el campo ya no existe, no hace nada en ese documento.
async function eliminarSemestreActual() {
  if (!confirm(
    'ELIMINAR semestreActual\n\n' +
    'Quita el campo semestreActual de todos los alumnos\n' +
    'en la colección usuarios/.\n\n' +
    'Seguro de repetir.\n\n¿Continuar?'
  )) return;

  try {
    const snap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .get();

    let batch = db.batch();
    let count = 0;
    let total = 0;

    for (const doc of snap.docs) {
      if (!doc.data().hasOwnProperty('semestreActual')) continue;

      batch.update(doc.ref, {
        semestreActual: firebase.firestore.FieldValue.delete()
      });
      count++;
      total++;

      if (count === 499) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) await batch.commit();

    alert(`✓ Completado.\n${total} alumnos actualizados (campo eliminado).`);
  } catch (e) {
    console.error('Error en eliminarSemestreActual:', e);
    alert('Error: ' + e.message);
  }
}
