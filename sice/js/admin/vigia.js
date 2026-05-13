// vigia.js — funciones de mantenimiento único (idempotentes, seguras de repetir)

function accionVigia() {
  migrarSemestreActual();
}

// Agrega semestreActual a alumnos que no lo tienen en usuarios/.
// Idempotente: solo toca documentos donde semestreActual es null/undefined/0.
async function migrarSemestreActual() {
  if (!confirm(
    'MIGRAR semestreActual\n\n' +
    'Lee todos los alumnos en usuarios/ y agrega el campo\n' +
    'semestreActual = periodo para los que no lo tengan.\n\n' +
    'Seguro de repetir (no pisa alumnos que ya lo tienen).\n\n¿Continuar?'
  )) return;

  try {
    const snap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .get();

    let batch = db.batch();
    let count = 0;
    let total = 0;

    for (const doc of snap.docs) {
      const a = doc.data();
      if (a.semestreActual) continue; // ya tiene — no tocar
      const semestre = Number(a.periodo);
      if (!semestre) continue;        // periodo no es un número válido — saltar

      batch.update(doc.ref, { semestreActual: semestre });
      count++;
      total++;

      if (count === 499) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) await batch.commit();

    alert(`✓ Migración completada.\n${total} alumnos actualizados con semestreActual.`);
  } catch (e) {
    console.error('Error en migrarSemestreActual:', e);
    alert('Error: ' + e.message);
  }
}
