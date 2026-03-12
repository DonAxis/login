// vigia.js
// Función temporal de vigía - se puede borrar fácilmente

async function accionVigia() {
  if (!confirm(
    'ACCIÓN VIGÍA: Corrección masiva TAE → TT\n\n' +
    '=== Colección "materias" (carreraId === "TAE") ===\n' +
    '• carreraId → "TT"\n' +
    '• codigoCarrera → "TT"\n' +
    '• codigos[] → "TAE-XXXX" → "TT-XXXX"\n' +
    '• grupos[].codigoCompleto → "TAE-XXXX" → "TT-XXXX"\n\n' +
    '=== Colección "profesorMaterias" (carreraId === "TAE") ===\n' +
    '• carreraId → "TT"\n' +
    '• codigoGrupo → "TAE-XXXX" → "TT-XXXX"\n\n' +
    '=== Colección "usuarios" ===\n' +
    '• Alumnos con carreraId "TAE": carreraId → "TT", codigoGrupo → "TT-XXXX"\n' +
    '• Profesores con carreraId "TAE": carreraId → "TT"\n' +
    '• Profesores: en carreras[] reemplazar "TAE" → "TT"\n\n' +
    '¿Ejecutar?'
  )) return;

  var totalMaterias = 0;
  var totalPM = 0;
  var totalAlumnos = 0;
  var totalProfesores = 0;

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

    // ===== PARTE 3: Colección "usuarios" — alumnos con carreraId "TAE" =====
    var snapAlumnos = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('carreraId', '==', 'TAE')
      .get();

    if (!snapAlumnos.empty) {
      var batchAlumnos = db.batch();

      snapAlumnos.forEach(function(doc) {
        var data = doc.data();
        var ref = db.collection('usuarios').doc(doc.id);
        var updates = {};

        updates.carreraId = 'TT';

        if (typeof data.codigoGrupo === 'string') {
          updates.codigoGrupo = data.codigoGrupo.replace(/^TAE-/, 'TT-');
        }

        batchAlumnos.update(ref, updates);
        totalAlumnos++;
      });

      await batchAlumnos.commit();
    }

    // ===== PARTE 4: Colección "usuarios" — profesores =====
    var snapProfesores = await db.collection('usuarios')
      .where('rol', '==', 'profesor')
      .get();

    if (!snapProfesores.empty) {
      var batchProfesores = db.batch();
      var hayProfesoresQueActualizar = false;

      snapProfesores.forEach(function(doc) {
        var data = doc.data();
        var ref = db.collection('usuarios').doc(doc.id);
        var updates = {};
        var necesitaUpdate = false;

        // Si carreraId es "TAE", cambiar a "TT"
        if (data.carreraId === 'TAE') {
          updates.carreraId = 'TT';
          necesitaUpdate = true;
        }

        // Recorrer carreras[] y reemplazar "TAE" por "TT"
        if (data.carreras && Array.isArray(data.carreras)) {
          var tieneAE = false;
          var nuevasCarreras = data.carreras.map(function(c) {
            if (typeof c === 'string' && c === 'TAE') {
              tieneAE = true;
              return 'TT';
            }
            return c;
          });

          if (tieneAE) {
            updates.carreras = nuevasCarreras;
            necesitaUpdate = true;
          }
        }

        if (necesitaUpdate) {
          batchProfesores.update(ref, updates);
          totalProfesores++;
          hayProfesoresQueActualizar = true;
        }
      });

      if (hayProfesoresQueActualizar) {
        await batchProfesores.commit();
      }
    }

    alert(
      '✅ Vigía completado.\n\n' +
      '• materias: ' + totalMaterias + ' doc(s)\n' +
      '  → carreraId, codigoCarrera, codigos[], grupos[].codigoCompleto\n\n' +
      '• profesorMaterias: ' + totalPM + ' doc(s)\n' +
      '  → carreraId, codigoGrupo\n\n' +
      '• usuarios (alumnos): ' + totalAlumnos + ' doc(s)\n' +
      '  → carreraId, codigoGrupo\n\n' +
      '• usuarios (profesores): ' + totalProfesores + ' doc(s)\n' +
      '  → carreraId, carreras[]'
    );

  } catch (error) {
    console.error('Error vigía:', error);
    alert(
      '❌ Error: ' + error.message + '\n\n' +
      'Progreso antes del error:\n' +
      '• materias: ' + totalMaterias + '\n' +
      '• profesorMaterias: ' + totalPM + '\n' +
      '• usuarios (alumnos): ' + totalAlumnos + '\n' +
      '• usuarios (profesores): ' + totalProfesores
    );
  }
}

console.log('vigia.js cargado - función temporal lista');