// Vigía — herramienta de mantenimiento puntual de un unico uso

function accionVigia() {
  migrarNumeroParciales();
}

// Agrega numeroParciales: 1 a todas las carreras de maestría
// detectadas por patrón (código empieza con 'M' o nombre empieza con 'maestr').
// Idempotente: solo actualiza los docs que aún no tienen el campo en 1.
async function migrarNumeroParciales() {
  const CONFIRMACION = confirm(
    'Vigia: agregar numeroParciales=1 a todas las carreras de maestría.\n\n' +
    'Solo se actualizarán docs sin el campo o con valor distinto de 1.\n\n¿Continuar?'
  );
  if (!CONFIRMACION) return;

  try {
    const snap = await db.collection('carreras').get();
    if (snap.empty) { alert('No se encontraron carreras.'); return; }

    const maestrias = [];
    snap.forEach(doc => {
      const d = doc.data();
      const nombreNorm = (d.nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const esMaestria = nombreNorm.startsWith('maestria');
      if (esMaestria && d.numeroParciales !== 1) {
        maestrias.push({ id: doc.id, nombre: d.nombre });
      }
    });

    if (maestrias.length === 0) {
      alert('Todas las maestrías ya tienen numeroParciales=1. Sin cambios.');
      return;
    }

    const lista = maestrias.map(m => `• ${m.nombre} (${m.id})`).join('\n');
    const ok = confirm(`Se actualizarán ${maestrias.length} carrera(s):\n\n${lista}\n\n¿Confirmar?`);
    if (!ok) return;

    const batch = db.batch();
    maestrias.forEach(m => {
      batch.update(db.collection('carreras').doc(m.id), { numeroParciales: 1 });
    });
    await batch.commit();

    alert(`✓ ${maestrias.length} carrera(s) actualizadas con numeroParciales=1.`);
  } catch (error) {
    console.error('Vigia error:', error);
    alert('Error: ' + error.message);
  }
}
