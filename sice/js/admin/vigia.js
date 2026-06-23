// Vigía — herramienta de mantenimiento puntual. accionVigia() es la función activa.

async function accionVigia() {
  // Reparar calificaciones.promedio en carreras con tieneExamenFinal=true.
  // GARANTÍA: solo se actualiza el campo 'promedio' via batch.update().
  //            Los campos parciales (parcial1/2/3) NUNCA se tocan.

  // ── Funciones de cálculo (copiadas de calificaciones.js para que vigia sea autocontenido) ──

  function _toN(v) {
    if (v === null || v === undefined) return null;
    if (v === 'NP') return 'NP';
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  // Equivalente a calcularCalificacion(p1,p2,p3, tieneExamenFinal=true)
  function _calcular(p1, p2, p3) {
    if (p1 === 'NP' || p2 === 'NP') return 'NP';
    if (p1 === null || p2 === null) return null;
    const avg = (p1 + p2) / 2;
    if (avg < 6) return avg;      // reprobado, sin derecho a examen final
    if (avg >= 7.5) return avg;   // aprobado directo, sin examen final
    // 6 ≤ avg < 7.5 → necesitó examen final
    if (p3 === null) return avg;
    if (p3 === 'NP') return 'NP';
    return p3;                    // calificación definitiva = examen final
  }

  // Equivalente a redondearCalificacion
  function _redondear(cal) {
    if (cal === null || cal === 'NP') return cal;
    const n = parseFloat(cal);
    if (isNaN(n)) return cal;
    return n < 6 ? Math.floor(n) : Math.round(n);
  }

  function _iguales(a, b) {
    if (a === null && b === null) return true;
    if (a === 'NP' && b === 'NP') return true;
    if (a === null || b === null || a === 'NP' || b === 'NP') return false;
    return parseFloat(a) === parseFloat(b);
  }

  // ── Script principal ──

  const log = [];
  let revisados = 0, omitidos = 0;

  try {
    // 1. Carreras con tieneExamenFinal=true
    const carrerasSnap = await db.collection('carreras')
      .where('tieneExamenFinal', '==', true)
      .get();

    if (carrerasSnap.empty) {
      alert('No hay carreras con tieneExamenFinal=true.');
      return;
    }

    const carreraIds = carrerasSnap.docs.map(d => d.id);
    const carreraNombres = {};
    carrerasSnap.docs.forEach(d => { carreraNombres[d.id] = d.data().nombre; });
    log.push(`Carreras (${carreraIds.length}): ${carreraIds.map(id => carreraNombres[id] + ' (' + id + ')').join(', ')}`);

    // 2. Cargar todas las calificaciones de esas carreras (in chunks de 10 por límite de Firestore)
    const docs = [];
    for (let i = 0; i < carreraIds.length; i += 10) {
      const chunk = carreraIds.slice(i, i + 10);
      const snap = await db.collection('calificaciones')
        .where('carreraId', 'in', chunk)
        .get();
      snap.docs.forEach(d => docs.push({ ref: d.ref, data: d.data() }));
    }
    log.push(`Calificaciones encontradas: ${docs.length}`);

    // 3. Analizar cuáles necesitan corrección
    const correcciones = [];

    for (const { ref, data } of docs) {
      revisados++;

      // Si tiene ETS, extraordinario o acreditación manual → el promedio no es el dato
      // definitivo en esos casos, no tiene sentido tocarlo aquí.
      if (data.ets != null || data.extraordinario != null || data.acreditacion != null) {
        omitidos++;
        continue;
      }

      const p = data.parciales || {};
      const p1 = _toN(p.parcial1);
      const p2 = _toN(p.parcial2);
      const p3 = _toN(p.parcial3);

      // Sin al menos p1 no hay nada que calcular
      if (p1 === null && p2 === null) { omitidos++; continue; }

      const esperado = _redondear(_calcular(p1, p2, p3));
      const actual   = data.promedio !== undefined ? data.promedio : null;

      if (_iguales(actual, esperado)) continue;

      correcciones.push({
        ref,
        alumnoNombre:  data.alumnoNombre  || '?',
        materiaNombre: data.materiaNombre || '?',
        carreraId:     data.carreraId,
        actual,
        esperado,
        p1, p2, p3
      });
    }

    log.push(`Revisados: ${revisados} | Omitidos (ETS/extra/acr): ${omitidos} | A corregir: ${correcciones.length}`);

    if (correcciones.length === 0) {
      alert('✓ Sin correcciones necesarias. Todos los promedios son correctos.\n\n' + log.join('\n'));
      return;
    }

    // Mostrar resumen de los primeros 20 casos antes de confirmar
    const MAX = 20;
    const detalle = correcciones.slice(0, MAX).map(c =>
      `• ${c.alumnoNombre} | ${c.materiaNombre} (${c.carreraId})\n` +
      `  Almacenado: ${c.actual}  →  Correcto: ${c.esperado}  (P1=${c.p1} P2=${c.p2} P3=${c.p3})`
    ).join('\n');
    const extra = correcciones.length > MAX ? `\n... y ${correcciones.length - MAX} casos más` : '';

    const confirmar = confirm(
      `⚠️  Se corregirán ${correcciones.length} documentos.\n` +
      `Solo se actualiza el campo "promedio". Los parciales NO se modifican.\n\n` +
      `${detalle}${extra}\n\n¿Continuar?`
    );
    if (!confirmar) { alert('Cancelado.'); return; }

    // 4. Aplicar correcciones en batches de 499 (límite de Firestore)
    let batch = db.batch();
    let batchCount = 0;
    let corregidos = 0;

    for (const { ref, esperado } of correcciones) {
      batch.update(ref, { promedio: esperado });
      batchCount++;
      corregidos++;
      if (batchCount === 499) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    log.push(`✓ Corregidos: ${corregidos}`);
    alert('CORRECCIÓN COMPLETADA\n\n' + log.join('\n'));

  } catch (e) {
    console.error('vigia error:', e);
    alert('Error: ' + e.message + '\n\nLog parcial:\n' + log.join('\n'));
  }
}
