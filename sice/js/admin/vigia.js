// vigia.js — funciones de mantenimiento único (idempotentes, seguras de repetir)

async function resetearFaltasEnCero() {
  if (!confirm(
    'Resetear faltas 2do y 3er parcial en cero\n\n' +
    'Pondrá en null TODAS las falta2 y falta3 que actualmente valgan 0,\n' +
    'para que los profesores puedan capturarlas de nuevo.\n\n' +
    '¿Continuar?'
  )) return;

  try {
    const snap = await db.collection('calificaciones').get();
    const actualizaciones = [];

    snap.forEach(doc => {
      const f = doc.data().faltas || {};
      const upd = {};
      if (f.falta2 === 0) upd['faltas.falta2'] = null;
      if (f.falta3 === 0) upd['faltas.falta3'] = null;
      if (Object.keys(upd).length > 0) actualizaciones.push({ ref: doc.ref, upd });
    });

    if (actualizaciones.length === 0) {
      alert('No se encontraron documentos con falta2=0 o falta3=0.');
      return;
    }

    for (const { ref, upd } of actualizaciones) {
      await ref.update(upd);
    }

    alert(`Listo. ${actualizaciones.length} documentos actualizados — falta2/falta3 en cero reseteadas a null.`);
  } catch (err) {
    console.error('Error en resetearFaltasEnCero:', err);
    alert('Error: ' + err.message);
  }
}

function accionVigia() {
  resetearFaltasEnCero();
}
