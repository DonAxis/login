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
// Sistema Maestría (esMaestria=true, código empieza con 'M' o nombre empieza con 'maestr'):
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
function esReprobado(calificacion, tieneExamenFinal) {
  if (calificacion === 'NP') return true;
  if (calificacion === null || calificacion === undefined) return false;
  return tieneExamenFinal ? calificacion < 7.5 : calificacion < 6;
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
