// controlAcademia.js — v3
// Acceso de solo lectura basado en materiasAutorizadas asignadas por el admin

const auth = firebase.auth();
let usuarioActual = null;
let materiasAcademia = [];  // materias únicas
let carrerasData = [];
let todasLasMaterias = []; // una entrada por asignación (grupo) en profesorMaterias
let materiaActual = null;  // materia seleccionada para detalle

// ===== NAVEGACIÓN =====

function ocultarTodasSecciones() {
  document.getElementById('menuAcademia').style.display = 'none';
  document.getElementById('seccionVerCarreras').style.display = 'none';
  document.getElementById('seccionDetalleMateria').style.display = 'none';
  document.getElementById('seccionProfesores').style.display = 'none';
  document.getElementById('seccionCalificaciones').style.display = 'none';
}

function mostrarMenu() {
  ocultarTodasSecciones();
  document.getElementById('menuAcademia').style.display = 'grid';
  document.getElementById('btnVolverMenu').style.display = 'none';
}

function volverMenu() {
  mostrarMenu();
}

function mostrarVerCarreras() {
  ocultarTodasSecciones();
  document.getElementById('seccionVerCarreras').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  mostrarMateriasPorCarrera();
}

function volverAMaterias() {
  materiaActual = null;
  mostrarVerCarreras();
}

function volverDetalleMateria() {
  if (!materiaActual) {
    mostrarVerCarreras();
    return;
  }
  ocultarTodasSecciones();
  document.getElementById('seccionDetalleMateria').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
}

function verDetalleMateria(idx) {
  materiaActual = todasLasMaterias[idx];
  ocultarTodasSecciones();
  document.getElementById('seccionDetalleMateria').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  document.getElementById('tituloDetalleMateria').textContent = materiaActual.nombre;
  document.getElementById('infoDetalleMateria').textContent =
    `${materiaActual.carreraNombre} · Grupo: ${materiaActual.codigoCompleto || materiaActual.codigoGrupo} · ${materiaActual.nombreTurno} · Periodo ${materiaActual.periodo}`;
}

function mostrarProfesoresMateria() {
  if (!materiaActual) return;
  ocultarTodasSecciones();
  document.getElementById('seccionProfesores').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  document.getElementById('tituloProfesores').textContent = materiaActual.nombre;

  const asignaciones = todasLasMaterias.filter(m => m.id === materiaActual.id);
  const container = document.getElementById('contenidoProfesores');

  if (asignaciones.length === 0) {
    container.innerHTML = '<p style="color:#999; text-align:center; padding:30px;">No hay profesores asignados a esta materia.</p>';
    return;
  }

  let html = '<div style="display:grid; gap:14px; padding:10px 0;">';
  asignaciones.forEach(asig => {
    const tieneProf = asig.profesorNombre && asig.profesorNombre !== 'Sin profesor';
    html += `
      <div style="background:white; border-radius:10px; padding:18px 20px; box-shadow:0 2px 8px rgba(0,0,0,0.08); border-left:4px solid ${asig.carreraColor || '#5e35b1'};">
        <div style="font-weight:700; font-size:1.05rem; color:#333; margin-bottom:8px;">
          ${tieneProf ? asig.profesorNombre : '<span style="color:#999; font-weight:400;">Sin profesor asignado</span>'}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:16px; color:#666; font-size:0.88rem;">
          <span>Carrera: <strong>${asig.carreraNombre}</strong></span>
          <span>Grupo: <strong>${asig.codigoCompleto || asig.codigoGrupo}</strong></span>
          <span>Turno: <strong>${asig.nombreTurno}</strong></span>
          <span>Periodo: <strong>${asig.periodo}</strong></span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function mostrarAlumnosMateria() {
  if (!materiaActual) return;
  verActaCalificaciones(materiaActual.asignacionId, materiaActual.nombre, materiaActual.codigoGrupo);
}

// ===== AUTENTICACIÓN =====

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert('Debes iniciar sesión');
    window.location.href = '../../index.html';
    return;
  }

  try {
    const userDocData = await obtenerUsuarioConCache(user.uid);

    if (!userDocData || userDocData.rol !== 'coordinador') {
      alert('Solo coordinadores pueden acceder');
      window.location.href = '../../index.html';
      return;
    }

    usuarioActual = userDocData;

    const tieneAcademiaUnica = usuarioActual.tieneAcademia && usuarioActual.academiaId;
    const tieneAcademias = usuarioActual.academias && usuarioActual.academias.length > 0;

    if (!tieneAcademiaUnica && !tieneAcademias) {
      alert('Tu usuario no tiene una academia asignada.\nContacta al administrador.');
      window.location.href = './controlCoordinador.html';
      return;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;
    document.getElementById('userRol').textContent = `Coordinador de ${usuarioActual.carreraId}`;

    if (tieneAcademias) {
      const nombres = usuarioActual.academias.map(a => a.academiaNombre).join(', ');
      document.getElementById('academiaNombre').textContent = nombres;
    } else {
      document.getElementById('academiaNombre').textContent = usuarioActual.academiaNombre || '';
    }

    await cargarDatos();

  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = '../../index.html';
  }
});

// ===== CARGA DE DATOS =====

async function cargarDatos() {
  try {
    await cargarCarreras();
    await cargarMateriasAcademia();
    actualizarEstadisticas();
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }
}

async function cargarCarreras() {
  try {
    const snapshot = await db.collection('carreras').get();
    carrerasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

// ===== CARGAR MATERIAS AUTORIZADAS =====
// Lee materiasAutorizadas del doc de academia → consulta profesorMaterias activas

async function cargarMateriasAcademia() {
  try {
    let academiaIds = [];
    if (usuarioActual.academias && usuarioActual.academias.length > 0) {
      academiaIds = usuarioActual.academias.map(a => a.academiaId);
    } else if (usuarioActual.academiaId) {
      academiaIds = [usuarioActual.academiaId];
    }

    if (academiaIds.length === 0) {
      materiasAcademia = [];
      todasLasMaterias = [];
      return;
    }

    // Obtener materiasAutorizadas de los docs de academia en paralelo
    const academiasPromises = academiaIds.map(id => db.collection('academias').doc(id).get());
    const academiasDocs = await Promise.all(academiasPromises);

    let materiasAutorizadas = [];
    academiasDocs.forEach(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data.materiasAutorizadas && data.materiasAutorizadas.length > 0) {
          materiasAutorizadas = [...new Set([...materiasAutorizadas, ...data.materiasAutorizadas])];
        }
      }
    });

    if (materiasAutorizadas.length === 0) {
      materiasAcademia = [];
      todasLasMaterias = [];
      return;
    }

    // Consultar profesorMaterias en lotes de 30 (límite de Firestore para 'in')
    const BATCH_SIZE = 30;
    const asignaciones = [];
    for (let i = 0; i < materiasAutorizadas.length; i += BATCH_SIZE) {
      const lote = materiasAutorizadas.slice(i, i + BATCH_SIZE);
      const snap = await db.collection('profesorMaterias')
        .where('materiaId', 'in', lote)
        .where('activa', '==', true)
        .get();
      snap.forEach(doc => asignaciones.push({ id: doc.id, ...doc.data() }));
    }

    // materiasAcademia = materias únicas (para estadísticas y referencia)
    const materiasMap = new Map();
    asignaciones.forEach(asig => {
      if (!materiasMap.has(asig.materiaId)) {
        const carrera = carrerasData.find(c => c.id === asig.carreraId);
        materiasMap.set(asig.materiaId, {
          id: asig.materiaId,
          nombre: asig.materiaNombre,
          carreraId: asig.carreraId,
          carreraNombre: carrera ? carrera.nombre : asig.carreraId,
          carreraColor: carrera ? (carrera.color || '#43a047') : '#43a047'
        });
      }
    });
    materiasAcademia = Array.from(materiasMap.values());

    // todasLasMaterias = una entrada por asignación activa (un grupo específico)
    todasLasMaterias = asignaciones.map(asig => {
      const carrera = carrerasData.find(c => c.id === asig.carreraId);
      return {
        id: asig.materiaId,
        nombre: asig.materiaNombre,
        carreraId: asig.carreraId,
        carreraNombre: carrera ? carrera.nombre : asig.carreraId,
        carreraColor: carrera ? (carrera.color || '#43a047') : '#43a047',
        asignacionId: asig.id,
        profesorId: asig.profesorId,
        profesorNombre: asig.profesorNombre || 'Sin profesor',
        codigoGrupo: asig.codigoGrupo || '',
        codigoCompleto: (asig.carreraId || '') + '-' + (asig.codigoGrupo || ''),
        turno: asig.turno,
        nombreTurno: asig.turnoNombre || turnoNombreDesde(asig.turno),
        periodo: asig.periodo || '-'
      };
    });

    console.log(`Academia: ${materiasAcademia.length} materias, ${todasLasMaterias.length} grupos activos`);

  } catch (error) {
    console.error('Error al cargar materias de academia:', error);
  }
}

function turnoNombreDesde(turno) {
  const nombres = { 1: 'Matutino', 2: 'Vespertino', 3: 'Nocturno', 4: 'Sabatino' };
  return nombres[turno] || 'Sin turno';
}

// ===== ESTADÍSTICAS =====

function actualizarEstadisticas() {
  document.getElementById('totalMaterias').textContent = materiasAcademia.length;
  const carrerasUnicas = new Set(materiasAcademia.map(m => m.carreraId));
  document.getElementById('totalCarreras').textContent = carrerasUnicas.size;
  const profesoresUnicos = new Set(todasLasMaterias.map(m => m.profesorId).filter(Boolean));
  document.getElementById('totalProfesores').textContent = profesoresUnicos.size;
}

// ===== MOSTRAR MATERIAS AGRUPADAS POR CARRERA =====

function mostrarMateriasPorCarrera() {
  const container = document.getElementById('contenidoCarreras');

  if (todasLasMaterias.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay materias autorizadas en tu academia.</p>
        <p style="margin-top: 8px; color: #666; font-size: 0.9rem;">
          Contacta al administrador para asignar materias desde "Gestionar Academias".
        </p>
      </div>
    `;
    return;
  }

  // Agrupar por carrera (guardando índice original para verDetalleMateria)
  const porCarrera = {};
  todasLasMaterias.forEach((m, idx) => {
    const cid = m.carreraId || 'sin-carrera';
    if (!porCarrera[cid]) {
      porCarrera[cid] = {
        nombre: m.carreraNombre || 'Sin Carrera',
        color: m.carreraColor || '#e0e0e0',
        siglas: cid,
        materias: []
      };
    }
    porCarrera[cid].materias.push({ ...m, _idx: idx });
  });

  const carrerasOrdenadas = Object.values(porCarrera).sort((a, b) =>
    a.nombre.localeCompare(b.nombre)
  );

  let html = '';

  carrerasOrdenadas.forEach((carrera, index) => {
    html += `
      <div class="carrera-section" data-carrera="${carrera.siglas}">
        <div class="carrera-header" onclick="toggleCarrera('carrera-${index}')">
          <h3>${carrera.nombre} <span style="font-weight:400; font-size:0.85rem; opacity:0.7;">(${carrera.siglas})</span></h3>
          <span class="carrera-toggle" id="toggle-carrera-${index}">−</span>
        </div>
        <div class="carrera-materias" id="carrera-${index}">
    `;

    carrera.materias.forEach(m => {
      html += `
        <div class="materia-card" data-nombre="${m.nombre.toLowerCase()}">
          <div class="materia-header">
            <h3>${m.nombre}</h3>
            <span class="carrera-badge" style="background: ${carrera.color}22; color: ${carrera.color};">
              ${carrera.siglas}
            </span>
          </div>
          <p class="materia-info"><strong>Periodo:</strong> ${m.periodo}</p>
          <p class="materia-info"><strong>Turno:</strong> ${m.nombreTurno}</p>
          <p class="materia-info"><strong>Grupo:</strong> ${m.codigoCompleto || m.codigoGrupo || '-'}</p>
          ${m.profesorNombre && m.profesorNombre !== 'Sin profesor'
            ? `<p class="materia-info"><strong>Profesor:</strong> ${m.profesorNombre}</p>`
            : '<p class="materia-info" style="color: #999;">Sin profesor asignado</p>'
          }
          <div class="materia-acciones">
            <button onclick="verDetalleMateria(${m._idx})" class="btn-ver">
              Ver
            </button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function toggleCarrera(carreraId) {
  const materias = document.getElementById(carreraId);
  const icon = document.getElementById('toggle-' + carreraId);
  if (materias.classList.contains('collapsed')) {
    materias.classList.remove('collapsed');
    icon.textContent = '−';
  } else {
    materias.classList.add('collapsed');
    icon.textContent = '+';
  }
}

function filtrarMateriasPorNombre() {
  const buscador = document.getElementById('buscadorMateria').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#contenidoCarreras .materia-card');
  const secciones = document.querySelectorAll('.carrera-section');

  if (!buscador) {
    cards.forEach(c => c.style.display = 'block');
    secciones.forEach(s => s.style.display = 'block');
    return;
  }

  cards.forEach(card => {
    const nombre = card.getAttribute('data-nombre') || '';
    card.style.display = nombre.includes(buscador) ? 'block' : 'none';
  });

  secciones.forEach(sec => {
    const hayVisibles = Array.from(sec.querySelectorAll('.materia-card'))
      .some(c => c.style.display !== 'none');
    sec.style.display = hayVisibles ? 'block' : 'none';
  });
}

// ===== VER ACTA DE CALIFICACIONES =====

async function verActaCalificaciones(asignacionId, materiaNombre, codigoGrupo) {
  if (!asignacionId) {
    alert('Esta materia no tiene un grupo asignado actualmente.');
    return;
  }

  ocultarTodasSecciones();
  document.getElementById('seccionCalificaciones').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  document.getElementById('btnVerOtraMateria').style.display = 'inline-block';

  const titulo = materiaNombre + (codigoGrupo ? ` — Grupo ${codigoGrupo}` : '');
  document.getElementById('infoMateriaCalif').textContent = titulo;

  const container = document.getElementById('contenidoCalificaciones');
  container.innerHTML = '<p style="text-align: center; color: #999;">Cargando calificaciones...</p>';

  try {
    const asigDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
    if (!asigDoc.exists) {
      container.innerHTML = '<p style="color: red; text-align: center;">Asignación no encontrada.</p>';
      return;
    }

    const asig = asigDoc.data();

    // Alumnos del grupo + inscripciones especiales en paralelo
    const [alumnosSnap, inscripcionesSnap] = await Promise.all([
      db.collection('usuarios')
        .where('rol', '==', 'alumno')
        .where('codigoGrupo', '==', asig.codigoGrupo)
        .where('activo', '==', true)
        .get(),
      db.collection('inscripcionesEspeciales')
        .where('asignacionId', '==', asignacionId)
        .get()
    ]);

    const alumnosMap = new Map();

    alumnosSnap.forEach(doc => {
      const a = doc.data();
      alumnosMap.set(doc.id, {
        id: doc.id,
        nombre: a.nombre || 'Sin nombre',
        matricula: a.matricula || '-',
        esEspecial: false
      });
    });

    // Inscripciones especiales (cargar alumnos que no están ya en el mapa)
    const alumnosEspecialesIds = [];
    inscripcionesSnap.forEach(doc => {
      const insc = doc.data();
      if (insc.alumnoId && !alumnosMap.has(insc.alumnoId)) {
        alumnosEspecialesIds.push(insc.alumnoId);
      }
    });

    if (alumnosEspecialesIds.length > 0) {
      const especialesPromises = alumnosEspecialesIds.map(id =>
        db.collection('usuarios').doc(id).get()
      );
      const especiales = await Promise.all(especialesPromises);
      especiales.forEach(doc => {
        if (doc.exists) {
          const a = doc.data();
          alumnosMap.set(doc.id, {
            id: doc.id,
            nombre: a.nombre || 'Sin nombre',
            matricula: a.matricula || '-',
            esEspecial: true
          });
        }
      });
    }

    if (alumnosMap.size === 0) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>No hay alumnos en el grupo <strong>${asig.codigoGrupo}</strong>.</p>
        </div>
      `;
      return;
    }

    // Calificaciones del grupo
    const califSnap = await db.collection('calificaciones')
      .where('profesorId', '==', asig.profesorId)
      .where('codigoGrupo', '==', asig.codigoGrupo)
      .get();

    const califMap = new Map();
    califSnap.forEach(doc => {
      const cal = doc.data();
      const parciales = cal.parciales || {};
      const faltas = cal.faltas || {};
      califMap.set(cal.alumnoId, {
        p1: parciales.parcial1 ?? null,
        p2: parciales.parcial2 ?? null,
        p3: parciales.parcial3 ?? null,
        promedio: cal.promedio ?? null,
        extraordinario: cal.extraordinario ?? null,
        ets: cal.ets ?? null,
        faltas: (faltas.falta1 || 0) + (faltas.falta2 || 0) + (faltas.falta3 || 0)
      });
    });

    const alumnos = Array.from(alumnosMap.values()).map(a => ({
      ...a,
      ...(califMap.get(a.id) || {
        p1: null, p2: null, p3: null,
        promedio: null, extraordinario: null, ets: null, faltas: 0
      })
    })).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const fmt = v => (v !== null && v !== undefined) ? v : '-';
    const colorProm = p => {
      if (p === null || p === undefined || p === 'NP') return '#555';
      return p >= 6 ? '#2e7d32' : '#c62828';
    };

    let html = `
      <div style="overflow-x: auto;">
        <table class="tabla-calificaciones">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Matrícula</th>
              <th>P1</th>
              <th>P2</th>
              <th>P3</th>
              <th>Promedio</th>
              <th>Extra</th>
              <th>ETS</th>
              <th>Faltas</th>
            </tr>
          </thead>
          <tbody>
    `;

    alumnos.forEach(a => {
      const prom = fmt(a.promedio);
      html += `
        <tr>
          <td>${a.nombre}${a.esEspecial ? ' <span style="color: #ff6f00; font-size: 0.8em;">★</span>' : ''}</td>
          <td>${a.matricula}</td>
          <td>${fmt(a.p1)}</td>
          <td>${fmt(a.p2)}</td>
          <td>${fmt(a.p3)}</td>
          <td><strong style="color: ${colorProm(a.promedio)};">${prom}</strong></td>
          <td>${fmt(a.extraordinario)}</td>
          <td>${fmt(a.ets)}</td>
          <td>${a.faltas}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
      <p style="margin-top: 10px; color: #666; font-size: 0.85rem;">
        Total: ${alumnos.length} alumno(s) | Grupo: ${asig.codigoGrupo} | Profesor: ${asig.profesorNombre || '-'}
        ${inscripcionesSnap.size > 0 ? ' | ★ Inscripción especial' : ''}
      </p>
    `;

    container.innerHTML = html;

  } catch (error) {
    console.error('Error al cargar acta:', error);
    container.innerHTML =
      '<p style="color: red; text-align: center;">Error: ' + error.message + '</p>';
  }
}

// ===== NAVEGACIÓN GENERAL =====

function volverCoordinador() {
  window.location.href = './controlCoordinador.html';
}

console.log('controlAcademia v2 — materias autorizadas por admin');
