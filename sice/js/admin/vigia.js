// vigia.js
// Función temporal de vigía - se puede borrar fácilmente

async function accionVigia() {
  if (!confirm(
    'ACCIÓN VIGÍA: Corrección masiva TAE → TT\n\n' +
    '=== Colección "materias" (donde carreraId === "TAE") ===\n' +
    '1. carreraId → "TT"\n' +
    '2. codigoCarrera → "TT"\n' +
    '3. codigos[] → "TAE-XXXX" → "TT-XXXX"\n' +
    '4. grupos[].codigoCompleto → "TAE-XXXX" → "TT-XXXX"\n\n' +
    '=== Colección "profesorMaterias" (donde carreraId === "TAE") ===\n' +
    '5. carreraId → "TT"\n' +
    '6. codigoGrupo → "TAE-XXXX" → "TT-XXXX"\n\n' +
    '¿Ejecutar?'
  )) return;

  var totalMaterias = 0;
  var totalPM = 0;

  try {
    // ===== PARTE 1: Colección "materias" =====
    var snapMaterias = await db.collection('materias').where('carreraId', '==', 'TAE').get();

    if (!snapMaterias.empty) {
      var batchMaterias = db.batch();

      snapMaterias.forEach(function(doc) {
        var data = doc.data();
        var ref = db.collection('materias').doc(doc.id);
        var updates = {};

        updates.carreraId = 'TT';
        updates.codigoCarrera = 'TT';

        if (data.codigos && Array.isArray(data.codigos)) {
          updates.codigos = data.codigos.map(function(codigo) {
            if (typeof codigo === 'string') {
              return codigo.replace(/^TAE-/, 'TT-');
            }
            return codigo;
          });
        }

        if (data.grupos && Array.isArray(data.grupos)) {
          updates.grupos = data.grupos.map(function(grupo) {
            var nuevoGrupo = Object.assign({}, grupo);
            if (typeof nuevoGrupo.codigoCompleto === 'string') {
              nuevoGrupo.codigoCompleto = nuevoGrupo.codigoCompleto.replace(/^TAE-/, 'TT-');
            }
            return nuevoGrupo;
          });
        }

        batchMaterias.update(ref, updates);
        totalMaterias++;
      });

      await batchMaterias.commit();
    }

    // ===== PARTE 2: Colección "profesorMaterias" =====
    var snapPM = await db.collection('profesorMaterias').where('carreraId', '==', 'TAE').get();

    if (!snapPM.empty) {
      var batchPM = db.batch();

      snapPM.forEach(function(doc) {
        var data = doc.data();
        var ref = db.collection('profesorMaterias').doc(doc.id);
        var updates = {};

        updates.carreraId = 'TT';

        if (typeof data.codigoGrupo === 'string') {
          updates.codigoGrupo = data.codigoGrupo.replace(/^TAE-/, 'TT-');
        }

        batchPM.update(ref, updates);
        totalPM++;
      });

      await batchPM.commit();
    }

    alert(
      '✅ Vigía completado.\n\n' +
      '• materias: ' + totalMaterias + ' documento(s) actualizado(s)\n' +
      '  → carreraId, codigoCarrera, codigos[], grupos[].codigoCompleto\n\n' +
      '• profesorMaterias: ' + totalPM + ' documento(s) actualizado(s)\n' +
      '  → carreraId, codigoGrupo'
    );

  } catch (error) {
    console.error('Error vigía:', error);
    alert(
      '❌ Error al ejecutar vigía: ' + error.message + '\n\n' +
      'Progreso antes del error:\n' +
      '• materias: ' + totalMaterias + '\n' +
      '• profesorMaterias: ' + totalPM
    );
  }
}

console.log('vigia.js cargado - función temporal lista');