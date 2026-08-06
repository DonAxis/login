// Vigía — Reparación de periodo en calificaciones
// Problema: cuando profesorMaterias.periodo se guardó como número (ej: 2, 3) en vez de
// string académico (ej: "2026-2", "2026-3"), las calificaciones quedan con periodo inválido.
// Consecuencias:
//   · "Cambiar Periodo" no las archiva ni sella periodoAcademico en historialAcademico
//   · Boleta Global muestra esas materias como "Cursando" indefinidamente
//   · "Acta por Materia" no las incluye en el selector de periodos
//
// Esta función recorre TODAS las carreras, detecta calificaciones con periodo inválido,
// les asigna el periodoAnterior de su carrera y sella historialAcademico.
// Es idempotente: sólo modifica docs con periodo que no cumpla el formato YYYY-N.

async function accionVigia() {
  function invalido(p) {
    return !p || !/^\d{4}-\d+$/.test(String(p));
  }

  try {
    // 1. Cargar todas las carreras y el config de periodo de cada una
    const carrerasSnap = await db.collection('carreras').get();
    const carreras = carrerasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const configSnaps = await Promise.all(
      carreras.map(c => db.collection('config').doc(`periodo_${c.id}`).get())
    );

    // Mapa carreraId → { nombre, periodoActual, periodoAnterior }
    // Solo carreras que ya tuvieron un cambio de periodo (tienen periodoAnterior)
    const carreraConfig = {};
    carreras.forEach((c, i) => {
      const cfg = configSnaps[i];
      if (!cfg.exists) return;
      const data = cfg.data();
      if (!data.periodoAnterior) return;
      carreraConfig[c.id] = {
        nombre:          c.nombre || c.id,
        periodoActual:   data.periodo,
        periodoAnterior: data.periodoAnterior
      };
    });

    if (Object.keys(carreraConfig).length === 0) {
      alert('Ninguna carrera tiene "periodoAnterior" registrado.\nEjecuta "Cambiar Periodo" primero en cada carrera.');
      return;
    }

    // 2. Leer TODAS las calificaciones y detectar las afectadas
    const calSnap = await db.collection('calificaciones').get();

    const afectadosPorCarrera = {};
    calSnap.docs.forEach(doc => {
      const c = doc.data();
      if (!carreraConfig[c.carreraId]) return;   // carrera sin config o sin periodoAnterior
      if (invalido(c.periodo)) {
        if (!afectadosPorCarrera[c.carreraId]) afectadosPorCarrera[c.carreraId] = [];
        afectadosPorCarrera[c.carreraId].push(doc);
      }
    });

    const carrerasAfectadas = Object.keys(afectadosPorCarrera);
    const totalCals = carrerasAfectadas.reduce((s, cid) => s + afectadosPorCarrera[cid].length, 0);

    if (totalCals === 0) {
      alert('✅ Sin problemas detectados.\nNo hay calificaciones con periodo inválido en ninguna carrera.');
      return;
    }

    // 3. Confirmar con resumen por carrera
    const resumen = carrerasAfectadas.map(cid => {
      const cfg = carreraConfig[cid];
      return `  • ${cfg.nombre}: ${afectadosPorCarrera[cid].length} calificaciones → periodo "${cfg.periodoAnterior}"`;
    }).join('\n');

    const ok = confirm(
      `VIGÍA — REPARACIÓN DE PERIODO EN CALIFICACIONES\n\n` +
      `Carreras afectadas:\n${resumen}\n\n` +
      `Total: ${totalCals} calificaciones\n\n` +
      `Acciones:\n` +
      `  1. Corrige "periodo" en cada calificación afectada\n` +
      `  2. Sella "periodoAcademico" en historialAcademico de cada alumno\n\n` +
      `Los datos ya válidos no se modifican.\n\n¿Continuar?`
    );
    if (!ok) return;

    // 4. Corregir calificaciones.periodo
    let batch = db.batch();
    let bc = 0;

    for (const cid of carrerasAfectadas) {
      const periodoAnterior = carreraConfig[cid].periodoAnterior;
      for (const doc of afectadosPorCarrera[cid]) {
        batch.update(doc.ref, { periodo: periodoAnterior });
        if (++bc === 499) { await batch.commit(); batch = db.batch(); bc = 0; }
      }
    }
    if (bc > 0) await batch.commit();

    // 5. Actualizar historialAcademico — agrupar por alumnoId
    const calPorAlumno = {};
    carrerasAfectadas.forEach(cid => {
      const periodoAnterior = carreraConfig[cid].periodoAnterior;
      afectadosPorCarrera[cid].forEach(doc => {
        const c = doc.data();
        if (!c.alumnoId) return;
        if (!calPorAlumno[c.alumnoId]) calPorAlumno[c.alumnoId] = { periodoAnterior, cals: {} };
        calPorAlumno[c.alumnoId].cals[c.materiaId] = c;
      });
    });

    const alumnoIds = Object.keys(calPorAlumno);
    const histSnaps = await Promise.all(
      alumnoIds.map(id => db.collection('historialAcademico').doc(id).get())
    );

    batch = db.batch(); bc = 0;
    const ahora = firebase.firestore.FieldValue.serverTimestamp();
    let alumnosActualizados = 0;

    for (const histSnap of histSnaps) {
      if (!histSnap.exists) continue;
      const { periodoAnterior, cals } = calPorAlumno[histSnap.id];
      let cambiado = false;

      const materiasActualizadas = (histSnap.data().materias || []).map(mat => {
        if (mat.periodoAcademico) return mat;     // ya sellada — no pisar
        const cal = cals[mat.materiaId];
        if (!cal) return mat;                     // esta materia no fue afectada
        cambiado = true;
        const { calificacion, acr } = _calificacionFinal(cal);
        return Object.assign({}, mat, { calificacion, acr, periodoAcademico: periodoAnterior });
      });

      if (!cambiado) continue;
      batch.set(
        db.collection('historialAcademico').doc(histSnap.id),
        { materias: materiasActualizadas, fechaActualizacion: ahora },
        { merge: true }
      );
      alumnosActualizados++;
      if (++bc === 499) { await batch.commit(); batch = db.batch(); bc = 0; }
    }
    if (bc > 0) await batch.commit();

    alert(
      `✅ Vigía completado\n\n` +
      `• ${totalCals} calificaciones corregidas\n` +
      `• ${alumnosActualizados} alumnos actualizados en historial académico\n\n` +
      `Detalle por carrera:\n${resumen}\n\n` +
      `Boleta Global ya no mostrará esas materias como "Cursando".\n` +
      `"Acta por Materia" ya incluirá esos periodos en el selector.`
    );

  } catch (e) {
    console.error('[Vigía] Error:', e);
    alert('Error en Vigía: ' + e.message);
  }
}
