// vigia.js
// Función temporal de vigía - se puede borrar fácilmente

async function accionVigia() {
  if (!confirm(
    'ACCIÓN VIGÍA: Corrección en colección "calificaciones"\n\n' +
    'En TODOS los documentos donde faltas.falta2 === 0 o faltas.falta3 === 0:\n' +
    '• faltas.falta2: 0 → null\n' +
    '• faltas.falta3: 0 → null\n\n' +
    'NO se toca falta1 ni ningún otro campo.\n\n' +
    '¿Ejecutar?'
  )) return;

  var totalDocs = 0;
  var totalModificados = 0;

  try {
    var snap = await db.collection('calificaciones').get();
    totalDocs = snap.size;

    if (snap.empty) {
      alert('No se encontraron documentos en "calificaciones".');
      return;
    }

    // Firestore batch tiene límite de 500 operaciones
    var batchArray = [];
    var currentBatch = db.batch();
    var operaciones = 0;

    snap.forEach(function(doc) {
      var data = doc.data();
      var faltas = data.faltas;

      if (!faltas) return;

      var necesitaUpdate = false;
      var updates = {};

      if (faltas.falta2 === 0) {
        updates['faltas.falta2'] = null;
        necesitaUpdate = true;
      }

      if (faltas.falta3 === 0) {
        updates['faltas.falta3'] = null;
        necesitaUpdate = true;
      }

      if (necesitaUpdate) {
        var ref = db.collection('calificaciones').doc(doc.id);
        currentBatch.update(ref, updates);
        totalModificados++;
        operaciones++;

        // Si llegamos a 500, crear nuevo batch
        if (operaciones === 500) {
          batchArray.push(currentBatch);
          currentBatch = db.batch();
          operaciones = 0;
        }
      }
    });

    // Agregar el último batch si tiene operaciones
    if (operaciones > 0) {
      batchArray.push(currentBatch);
    }

    // Ejecutar todos los batches
    for (var i = 0; i < batchArray.length; i++) {
      await batchArray[i].commit();
    }

    alert(
      '✅ Vigía completado.\n\n' +
      '• Documentos revisados: ' + totalDocs + '\n' +
      '• Documentos modificados: ' + totalModificados + '\n' +
      '  → faltas.falta2: 0 → null\n' +
      '  → faltas.falta3: 0 → null\n\n' +
      'Batches ejecutados: ' + batchArray.length
    );

  } catch (error) {
    console.error('Error vigía:', error);
    alert(
      '❌ Error: ' + error.message + '\n\n' +
      'Docs revisados: ' + totalDocs + '\n' +
      'Docs modificados antes del error: ' + totalModificados
    );
  }
}

console.log('vigia.js cargado - función temporal lista');
