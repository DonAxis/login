// =============================================================================
// consultar-boleta — "Ventanilla" de consulta de calificaciones para alumnos
// =============================================================================
// Corre en Google Cloud Run functions (NO en ninguna computadora local).
//
// Recibe:   { matricula, email }
// Verifica: que exista un alumno con esa matrícula Y ese correo
// Devuelve: SOLO los datos que la página pública ya muestra hoy
//           (nombre, grupo, carrera, materias con calificaciones, horario).
//           NUNCA devuelve tutor, teléfono ni datos de otros alumnos.
//
// Replica exactamente la lógica actual de:
//   - index.html              → consultarAlumno / cargarMateriasYCalificaciones (alumno normal)
//   - controlAlumnoEspecial.js → PARTE 7 (alumno especial)
//   - calificaciones.js        → obtenerTieneExamenFinal / obtenerEsUnParcial
//
// Respuesta: { estado: 'ok' | 'no_encontrado' | 'inactivo' | 'datos_invalidos' | 'error', ... }
// =============================================================================

const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Sitios que pueden usar esta ventanilla (localhost solo para pruebas)
const ORIGENES_PERMITIDOS = [
  'https://ilbcontrol.mx',
  'https://www.ilbcontrol.mx',
  'http://localhost:8000'
];

functions.http('consultarBoleta', async (req, res) => {
  // ── CORS: solo responder a nuestro sitio ──
  const origen = req.get('Origin');
  if (ORIGENES_PERMITIDOS.includes(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ estado: 'error' });
  }

  try {
    // La página envía JSON como texto plano (evita una petición extra de "permiso" en redes lentas)
    let cuerpo = req.body;
    if (typeof cuerpo === 'string') {
      try { cuerpo = JSON.parse(cuerpo); } catch (e) { cuerpo = {}; }
    }
    if (Buffer.isBuffer(cuerpo)) {
      try { cuerpo = JSON.parse(cuerpo.toString('utf8')); } catch (e) { cuerpo = {}; }
    }

    const matricula = String((cuerpo && cuerpo.matricula) || '').trim();
    const email = String((cuerpo && cuerpo.email) || '').trim().toLowerCase();

    if (!matricula || !email || matricula.length > 40 || email.length > 120) {
      return res.status(400).json({ estado: 'datos_invalidos' });
    }

    // ── 1. Buscar alumno (misma consulta que index.html) ──
    const snap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('matricula', '==', matricula)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(200).json({ estado: 'no_encontrado' });
    }

    const docAlumno = snap.docs[0];
    const a = docAlumno.data();

    if (a.activo === false) {
      return res.status(200).json({ estado: 'inactivo' });
    }

    // Solo los campos que la página pública necesita
    const alumno = {
      id: docAlumno.id,
      nombre: a.nombre || '',
      matricula: a.matricula || '',
      email: a.email || '',
      codigoGrupo: a.codigoGrupo || null,
      tipoAlumno: a.tipoAlumno || null,
      carreraId: a.carreraId || null,
      activo: true
    };

    // ── 2. Carrera, materias y horario en paralelo ──
    const esEspecial = alumno.tipoAlumno === 'especial';

    const [carrera, resultadoMaterias, horarioUrl] = await Promise.all([
      leerCarrera(alumno.carreraId),
      esEspecial ? materiasEspecial(alumno.id) : materiasNormal(alumno.id, alumno.codigoGrupo),
      leerHorario(alumno.codigoGrupo)
    ]);

    return res.status(200).json({
      estado: 'ok',
      alumno,
      carrera,
      materias: resultadoMaterias.materias,
      aviso: resultadoMaterias.aviso,   // null | 'sin_grupo' | 'sin_materias' | 'sin_inscripciones'
      horarioUrl
    });

  } catch (error) {
    console.error('consultarBoleta error:', error && error.message);
    return res.status(500).json({ estado: 'error' });
  }
});

// ── Carrera: nombre + sistema de calificación (igual que calificaciones.js) ──
async function leerCarrera(carreraId) {
  const vacio = { nombre: null, tieneExamenFinal: false, esUnParcial: false, esMaestria: false };
  if (!carreraId) return vacio;
  const doc = await db.collection('carreras').doc(carreraId).get();
  if (!doc.exists) return vacio;
  const d = doc.data();
  const esMaestria = (d.codigo || '').startsWith('M') ||
                     (d.nombre || '').toLowerCase().startsWith('maestr');
  return {
    nombre: d.nombre || null,
    tieneExamenFinal: d.tieneExamenFinal === true,
    esUnParcial: esMaestria || d.numeroParciales === 1,
    esMaestria
  };
}

// ── Horario del grupo ──
async function leerHorario(codigoGrupo) {
  if (!codigoGrupo) return null;
  try {
    const doc = await db.collection('horarios').doc(codigoGrupo).get();
    return doc.exists ? (doc.data().url || null) : null;
  } catch (e) {
    return null;
  }
}

// ── Convierte un doc de calificaciones al formato que usa la página ──
function leerCalificacion(calDoc) {
  let parcial1 = '-', parcial2 = '-', parcial3 = '-';
  let extraordinario = null, ets = null;
  if (calDoc && calDoc.exists) {
    const data = calDoc.data();
    const p = data.parciales || {};
    parcial1 = p.parcial1 ?? '-';
    parcial2 = p.parcial2 ?? '-';
    parcial3 = p.parcial3 ?? '-';
    extraordinario = data.extraordinario ?? null;
    ets = data.ets ?? null;
    // Fallback: Boleta Global guarda en promedio+acreditacion, no en ets/extraordinario
    const acreditacion = data.acreditacion ?? null;
    const promedio = data.promedio ?? null;
    if (ets === null && acreditacion === 'ETS') ets = promedio;
    if (extraordinario === null && acreditacion === 'EXT') extraordinario = promedio;
  }
  return { parcial1, parcial2, parcial3, extraordinario, ets };
}

// Lee varios docs de calificaciones en UNA sola petición a Firestore
async function leerCalificaciones(alumnoId, materiaIds) {
  if (materiaIds.length === 0) return [];
  const refs = materiaIds.map(id => db.collection('calificaciones').doc(`${alumnoId}_${id}`));
  return db.getAll(...refs);
}

// ── Alumno normal: materias de su grupo (igual que index.html) ──
async function materiasNormal(alumnoId, codigoGrupo) {
  if (!codigoGrupo) return { materias: [], aviso: 'sin_grupo' };

  const snap = await db.collection('profesorMaterias')
    .where('codigoGrupo', '==', codigoGrupo)
    .where('activa', '==', true)
    .get();

  if (snap.empty) return { materias: [], aviso: 'sin_materias' };

  const asignaciones = snap.docs.map(d => d.data());
  const calDocs = await leerCalificaciones(alumnoId, asignaciones.map(m => m.materiaId));

  const materias = asignaciones.map((m, i) => ({
    nombre: m.materiaNombre,
    codigo: m.codigoGrupo,
    profesor: m.profesorNombre,
    periodo: m.periodo || m.periodoAcademico || '',
    ...leerCalificacion(calDocs[i])
  }));

  return { materias, aviso: null };
}

// ── Alumno especial: materias inscritas (igual que controlAlumnoEspecial.js PARTE 7) ──
async function materiasEspecial(alumnoId) {
  const snap = await db.collection('inscripcionesEspeciales')
    .where('alumnoId', '==', alumnoId)
    .where('activa', '==', true)
    .get();

  if (snap.empty) return { materias: [], aviso: 'sin_inscripciones' };

  const inscripciones = snap.docs.map(d => d.data());
  const calDocs = await leerCalificaciones(alumnoId, inscripciones.map(i => i.materiaId));

  const materias = inscripciones.map((insc, i) => ({
    nombre: insc.materiaNombre,
    codigo: insc.materiaCodigo || '',
    profesor: insc.profesorNombre || 'Sin asignar',
    periodo: '',
    ...leerCalificacion(calDocs[i])
  }));

  materias.sort((x, y) => (x.nombre || '').localeCompare(y.nombre || ''));
  return { materias, aviso: null };
}
