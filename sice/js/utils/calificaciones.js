// calificaciones.js
// Helpers de lógica de calificaciones para carreras con sistema normal (3 parciales)
// y carreras con examen final (2 parciales + examen final).
//
// Carreras con tieneExamenFinal = true (e.g. LAE, 9 trimestres):
//   - Solo 2 parciales (parcial1, parcial2). parcial3 almacena el examen final.
//   - calificación = promedio(p1, p2)
//   - Si promedio <= 7.5 → el alumno debe presentar examen final
//   - Si presentó examen final → calificación = valor del examen final (p3)
//   - NP en p1 o p2 → NP absoluto
//   - NP en p3 solo aplica si promedio(p1,p2) <= 7.5 (el examen era requerido)
//   - Reprobado: calificación numérica <= 7.5
//
// Carreras normales (tieneExamenFinal = false):
//   - 3 parciales, calificación = promedio de los parciales disponibles
//   - Reprobado: calificación numérica < 6

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
    // Solo usar el examen final si ambos parciales están capturados y el promedio <= 7.5
    if (vals.length === 2 && avg12 <= 7.5) {
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
function esReprobado(calificacion, tieneExamenFinal) {
  if (calificacion === 'NP') return true;
  if (calificacion === null || calificacion === undefined) return false;
  return tieneExamenFinal ? calificacion <= 7.5 : calificacion < 6;
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
