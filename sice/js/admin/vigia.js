// Vigía — Reparación de periodo inválido en calificaciones e historialAcademico
// Cubre semestral (2026-2), cuatrimestral (2026-3) y trimestral (2026-4).
// Usa _calificacionFinal() de cambioPeriodo.js (cargado antes en controlAdmin.html).

async function accionVigia() {
  function invalido(p) {
    return !p || !/^\d{4}-\d+$/.test(String(p));
  }

  try {
    // 1. Cargar carreras y su periodoAnterior desde config/periodo_{carreraId}
    const carrerasSnap = await db.collection('carreras').get();
    const carreras = carrerasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const configSnaps = await Promise.all(
      carreras.map(c => db.collection('config').doc(`periodo_${c.id}`).get())
    );

    const carreraConfig = {};
    carreras.forEach((c, i) => {
      const cfg = configSnaps[i];
      if (!cfg.exists) return;
      const data = cfg.data();
      if (!data.periodoAnterior) return;
      carreraConfig[c.id] = {
        nombre: c.nombre || c.id,
        periodoActual: data.periodo,
        periodoAnterior: data.periodoAnterior
      };
    });

    if (Object.keys(carreraConfig).length === 0) {
      alert('No se encontró config de carreras con periodoAnterior. Nada que reparar.');
      return;
    }

    // 2. Leer TODAS las calificaciones y detectar las con periodo inválido
    const calSnap = await db.collection('calificaciones').get();

    const afectadosPorCarrera = {};
    calSnap.docs.forEach(doc => {
      const c = doc.data();
      if (!carreraConfig[c.carreraId]) return;
      if (invalido(c.periodo)) {
        if (!afectadosPorCarrera[c.carreraId]) afectadosPorCarrera[c.carreraId] = [];
        afectadosPorCarrera[c.carreraId].push(doc);
      }
    });

    const carrerasAfectadas = Object.keys(afectadosPorCarrera);
    if (carrerasAfectadas.length === 0) {
      alert('✅ Vigía: No se encontraron calificaciones con periodo inválido. Todo está bien.');
      return;
    }

    // 3. Mostrar resumen y confirmar
    let resumen = 'VIGÍA — Reparación de periodo en calificaciones\n\n';
    resumen += 'Carreras afectadas:\n';
    let totalDocs = 0;
    carrerasAfectadas.forEach(cid => {
      const cnt = afectadosPorCarrera[cid].length;
      const cfg = carreraConfig[cid];
      resumen += `• ${cfg.nombre}: ${cnt} calificaciones → periodo = "${cfg.periodoAnterior}"\n`;
      totalDocs += cnt;
    });
    resumen += `\nTotal a corregir: ${totalDocs} calificaciones\n\n¿Continuar?`;

    if (!confirm(resumen)) return;

    // 4. Corregir calificaciones.periodo
    let batch = db.batch();
    let bc = 0;
    let calCorregidas = 0;

    for (const cid of carrerasAfectadas) {
      const periodoAnterior = carreraConfig[cid].periodoAnterior;
      for (const doc of afectadosPorCarrera[cid]) {
        batch.update(doc.ref, { periodo: periodoAnterior });
        calCorregidas++;
        if (++bc === 499) {
          await batch.commit();
          batch = db.batch();
          bc = 0;
        }
      }
    }
    if (bc > 0) await batch.commit();

    // 5. Estampar periodoAcademico en historialAcademico
    // Agrupar calificaciones por alumno
    const calPorAlumno = {};
    for (const cid of carrerasAfectadas) {
      const periodoAnterior = carreraConfig[cid].periodoAnterior;
      for (const doc of afectadosPorCarrera[cid]) {
        const c = doc.data();
        if (!calPorAlumno[c.alumnoId]) {
          calPorAlumno[c.alumnoId] = { periodoAnterior, cals: {} };
        }
        calPorAlumno[c.alumnoId].cals[c.materiaId] = c;
      }
    }

    const alumnoIds = Object.keys(calPorAlumno);

    // Leer historialAcademico en lotes de 30
    const CHUNK = 30;
    const histSnaps = [];
    for (let i = 0; i < alumnoIds.length; i += CHUNK) {
      const lote = alumnoIds.slice(i, i + CHUNK);
      const snaps = await Promise.all(
        lote.map(id => db.collection('historialAcademico').doc(id).get())
      );
      histSnaps.push(...snaps);
    }

    batch = db.batch();
    bc = 0;
    let histActualizados = 0;
    const ahora = firebase.firestore.FieldValue.serverTimestamp();

    for (const histSnap of histSnaps) {
      if (!histSnap.exists) continue;
      const alumnoId = histSnap.id;
      const { periodoAnterior, cals } = calPorAlumno[alumnoId];
      const materiasExistentes = histSnap.data().materias || [];

      let cambiado = false;
      const materiasActualizadas = materiasExistentes.map(mat => {
        if (mat.periodoAcademico) return mat; // ya cerrada — no pisar
        const cal = cals[mat.materiaId];
        if (!cal) return mat;
        cambiado = true;
        const { calificacion, acr } = _calificacionFinal(cal);
        return Object.assign({}, mat, { calificacion, acr, periodoAcademico: periodoAnterior });
      });

      if (!cambiado) continue;

      batch.set(
        db.collection('historialAcademico').doc(alumnoId),
        { materias: materiasActualizadas, fechaActualizacion: ahora },
        { merge: true }
      );
      histActualizados++;

      if (++bc === 499) {
        await batch.commit();
        batch = db.batch();
        bc = 0;
      }
    }
    if (bc > 0) await batch.commit();

    alert(
      `✅ Vigía completada\n\n` +
      `Calificaciones corregidas: ${calCorregidas}\n` +
      `Historiales actualizados: ${histActualizados}`
    );

  } catch (e) {
    console.error('Error en Vigía:', e);
    alert('Error en Vigía: ' + e.message);
  }
}
