// vigia.js
// Función temporal de vigía - se puede borrar fácilmente

async function accionVigia() {
  if (!confirm(
    'ACCIÓN VIGÍA: Corrección masiva en colección "materias"\n\n' +
    'En todas las materias donde carreraId === "TAE":\n' +
    '1. carreraId → "TT"\n' +
    '2. codigoCarrera → "TT"\n' +
    '3. codigos[] → reemplazar "TAE-" por "TT-"\n' +
    '4. grupos[] → en cada grupo, codigoCompleto reemplazar "TAE-" por "TT-"\n\n' +
    '¿Ejecutar?'
  )) return;

  try {
    const snap = await db.collection('materias').where('carreraId', '==', 'TAE').get();

    if (snap.empty) {
      alert('No se encontraron materias con carreraId "TAE".');
      return;
    }

    const batch = db.batch();
    let count = 0;

    snap.forEach(function(doc) {
      const data = doc.data();
      const ref = db.collection('materias').doc(doc.id);
      const updates = {};

      // 1. carreraId
      updates.carreraId = 'TT';

      // 2. codigoCarrera
      updates.codigoCarrera = 'TT';

      // 3. codigos (array de strings)
      if (data.codigos && Array.isArray(data.codigos)) {
        updates.codigos = data.codigos.map(function(codigo) {
          if (typeof codigo === 'string') {
            return codigo.replace(/^TAE-/, 'TT-');
          }
          return codigo;
        });
      }

      // 4. grupos (array de maps con codigoCompleto)
      if (data.grupos && Array.isArray(data.grupos)) {
        updates.grupos = data.grupos.map(function(grupo) {
          const nuevoGrupo = Object.assign({}, grupo);
          if (typeof nuevoGrupo.codigoCompleto === 'string') {
            nuevoGrupo.codigoCompleto = nuevoGrupo.codigoCompleto.replace(/^TAE-/, 'TT-');
          }
          return nuevoGrupo;
        });
      }

      batch.update(ref, updates);
      count++;
    });

    await batch.commit();
    alert('✅ Vigía completado.\n\n' + count + ' materia(s) actualizada(s) de TAE → TT.\n\nCampos modificados:\n• carreraId\n• codigoCarrera\n• codigos[]\n• grupos[].codigoCompleto');

  } catch (error) {
    console.error('Error vigía:', error);
    alert('❌ Error al ejecutar vigía: ' + error.message);
  }
}

console.log('vigia.js cargado - función temporal lista');