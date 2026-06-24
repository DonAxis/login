// calificaciones.js
// Helpers de lógica de calificaciones.
//
// Sistema Normal (tieneExamenFinal=false, esMaestria=false):
//   - 3 parciales, calificación = promedio de los parciales disponibles
//   - Reprobado: calificación < 6
//
// Sistema Examen Final (tieneExamenFinal=true, ej. LAE):
//   - 2 parciales + examen final en parcial3
//   - avg >= 7.5 → aprobado sin examen (7.5 redondea a 8)
//   - 6 <= avg < 7.5 → debe presentar examen final; calificación = p3
//   - avg < 6 → sin derecho a examen final, va directo a extraordinario
//   - Reprobado: calificación < 7.5
//
// Sistema Maestría / Un Parcial (obtenerEsUnParcial=true):
//   - Maestría: código empieza con 'M' o nombre empieza con 'maestr' (detección por patrón)
//   - Otras carreras: campo numeroParciales === 1 en Firestore (ej. UPAV)
//   - Solo 1 calificación (parcial1) y 1 falta (falta1)
//   - Sin extraordinario, sin ETS, sin parciales adicionales
//   - Reprobado: calificación < 6

/**
 * Calcula la calificación final de un alumno en una materia.
 * @param {number|'NP'|null} p1
 * @param {number|'NP'|null} p2
 * @param {number|'NP'|null} p3  — en carreras con examen final, este campo es el examen final
 * @param {boolean} tieneExamenFinal
 * @returns {number|'NP'|null}   — null si aún no hay datos suficientes
 */
function calcularCalificacion(p1, p2, p3, tieneExamenFinal) {
  if (tieneExamenFinal) {
    if (p1 === 'NP' || p2 === 'NP') return 'NP';
    const vals = [p1, p2].filter(v => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    const avg12 = vals.reduce((a, b) => a + b, 0) / vals.length;
    // Solo usar el examen final si avg está en rango [6, 7.5)
    if (vals.length === 2 && avg12 >= 6 && avg12 < 7.5) {
      if (p3 === 'NP') return 'NP';
      if (p3 !== null && p3 !== undefined) return p3;
      // Examen final aún pendiente: devolver avg12 (indica que se requiere examen)
    }
    return avg12;
  } else {
    if (p1 === 'NP' || p2 === 'NP' || p3 === 'NP') return 'NP';
    const vals = [p1, p2, p3].filter(v => v !== null && v !== undefined);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
}

/**
 * Determina si una calificación es reprobatoria.
 * @param {number|'NP'|null} calificacion
 * @param {boolean} tieneExamenFinal
 * @returns {boolean}
 */
/**
 * @param {number|'NP'|null} calificacion
 * @param {boolean} tieneExamenFinal
 * @param {{ p3?: any, extraordinario?: any }} [ctx]
 *   p3            — valor de parcial3 (examen final); si está seteado el umbral baja a 6
 *   extraordinario — si está seteado el umbral es siempre 6
 */
function esReprobado(calificacion, tieneExamenFinal, { p3 = null, extraordinario = null } = {}) {
  if (calificacion === 'NP') return true;
  if (calificacion === null || calificacion === undefined) return false;
  if (!tieneExamenFinal) return calificacion < 6;
  // tieneExamenFinal=true:
  // si ya presentó examen final (p3) o extraordinario → umbral 6 (aprobado con >=6)
  const p3Set    = p3            !== null && p3            !== undefined;
  const extraSet = extraordinario !== null && extraordinario !== undefined;
  if (p3Set || extraSet) return calificacion < 6;
  // solo parciales pendientes → umbral 7.5
  return calificacion < 7.5;
}

/**
 * Lee tieneExamenFinal de una carrera con caché en sessionStorage.
 * Evita releer Firestore en cada render dentro de la misma sesión.
 * Requiere que firebase.js (y por tanto `db`) ya esté cargado.
 * @param {string} carreraId
 * @returns {Promise<boolean>}
 */
async function obtenerTieneExamenFinal(carreraId) {
  if (!carreraId) return false;
  const cacheKey = `carrera_examenFinal_${carreraId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached !== null) return cached === 'true';
  try {
    const doc = await db.collection('carreras').doc(carreraId).get();
    const valor = doc.exists ? (doc.data().tieneExamenFinal === true) : false;
    sessionStorage.setItem(cacheKey, String(valor));
    return valor;
  } catch (e) {
    console.warn('obtenerTieneExamenFinal error:', e.message);
    return false;
  }
}

/**
 * Detecta si una carrera es de tipo Maestría (solo 1 parcial + 1 falta).
 * Condición: código empieza con 'M' O nombre empieza con 'maestr' (sin distinción de acento).
 * @param {string} carreraId
 * @returns {Promise<boolean>}
 */
async function obtenerEsMaestria(carreraId) {
  if (!carreraId) return false;
  const cacheKey = `carrera_esMaestria_${carreraId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached !== null) return cached === 'true';
  try {
    // Nota: si ya se llamó obtenerEsUnParcial, el cache ya está poblado.
    const doc = await db.collection('carreras').doc(carreraId).get();
    const data = doc.exists ? doc.data() : {};
    const valor = (data.codigo || '').startsWith('M') ||
                  (data.nombre || '').toLowerCase().startsWith('maestr');
    sessionStorage.setItem(cacheKey, String(valor));
    return valor;
  } catch (e) {
    console.warn('obtenerEsMaestria error:', e.message);
    return false;
  }
}

/**
 * Detecta si una carrera usa sistema de 1 solo parcial.
 * Cubre: Maestrías (por patrón código/nombre) + carreras con numeroParciales === 1 en Firestore.
 * Lee el doc de carreras UNA vez y actualiza también el cache de obtenerEsMaestria.
 * @param {string} carreraId
 * @returns {Promise<boolean>}
 */
async function obtenerEsUnParcial(carreraId) {
  if (!carreraId) return false;
  const cacheKey = `carrera_esUnParcial_${carreraId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached !== null) return cached === 'true';
  try {
    const doc = await db.collection('carreras').doc(carreraId).get();
    let valor = false;
    if (doc.exists) {
      const d = doc.data();
      const esMaestria = (d.codigo || '').startsWith('M') ||
                         (d.nombre  || '').toLowerCase().startsWith('maestr');
      sessionStorage.setItem(`carrera_esMaestria_${carreraId}`, String(esMaestria));
      valor = esMaestria || d.numeroParciales === 1;
    }
    sessionStorage.setItem(cacheKey, String(valor));
    return valor;
  } catch (e) {
    console.warn('obtenerEsUnParcial error:', e.message);
    return false;
  }
}

/**
 * Redondea una calificación final (no parcial).
 * < 6  → Math.floor  (5.9 → 5, 5.5 → 5)
 * >= 6 → Math.round  (6.5 → 7, 6.4 → 6)
 * @param {number|string|'NP'|null} cal
 * @returns {number|'NP'|null}
 */
function redondearCalificacion(cal) {
  if (cal === null || cal === undefined || cal === 'NP') return cal;
  const n = Number(cal);
  if (isNaN(n)) return cal;
  if (n < 6) return Math.floor(n);
  return Math.round(n);
}

/**
 * Registra un cambio de calificación en historialCalificaciones (tipo: 'cambio').
 * Se distingue de los registros de archivo de fin de periodo (tipo: 'archivo').
 * Falla silenciosamente para no interrumpir el flujo principal.
 *
 * @param {object} opts
 * @param {string} opts.docId           — ID del doc en calificaciones ({alumnoId}_{materiaId})
 * @param {string} opts.alumnoId
 * @param {string} opts.alumnoNombre
 * @param {string} opts.materiaId
 * @param {string} opts.materiaNombre
 * @param {string|null} opts.carreraId
 * @param {string|null} opts.periodo
 * @param {object} opts.antes           — snapshot de campos antes del cambio
 * @param {object} opts.despues         — snapshot de campos después del cambio
 * @param {object} opts.usuario         — { uid, nombre, rol }
 */
async function registrarCambioCalificacion({
  docId, alumnoId, alumnoNombre, materiaId, materiaNombre,
  carreraId, periodo, antes, despues, usuario
}) {
  try {
    await db.collection('registroCambios').add({
      calificacionDocId: docId,
      alumnoId,
      alumnoNombre,
      materiaId,
      materiaNombre,
      carreraId:         carreraId  || null,
      periodo:           periodo    || null,
      cambiadoPor:       usuario.uid,
      cambiadoPorNombre: usuario.nombre,
      cambiadoPorRol:    usuario.rol,
      fechaCambio:       firebase.firestore.FieldValue.serverTimestamp(),
      antes,
      despues
    });
  } catch (e) {
    console.warn('registrarCambioCalificacion error:', e.message);
  }
}
