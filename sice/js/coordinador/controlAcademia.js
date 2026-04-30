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

// Abre directamente la vista de alumnos/calificaciones desde la lista de materias
function abrirMateriaDirecto(idx) {
  materiaActual = todasLasMaterias[idx];
  verActaCalificaciones(materiaActual.asignacionId, materiaActual.nombre, materiaActual.codigoGrupo);
}

// Extrae turno, semestre y orden del codigoGrupo (ej. "TIAC-1201" → turno=1, semestre=2, orden=1)
function parsearCodigoGrupo(cg) {
  const m = (cg || '').match(/-(\d)(\d)(\d{2})$/);
  if (!m) return { turno: 9, semestre: 9, orden: 99 };
  return { turno: +m[1], semestre: +m[2], orden: +m[3] };
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

  // Agrupar por carrera → dentro, por codigoGrupo
  const porCarrera = {};
  todasLasMaterias.forEach((m, idx) => {
    const cid = m.carreraId || 'sin-carrera';
    if (!porCarrera[cid]) {
      porCarrera[cid] = { nombre: m.carreraNombre || 'Sin Carrera', siglas: cid, grupos: {} };
    }
    const cg = m.codigoGrupo || 'sin-grupo';
    if (!porCarrera[cid].grupos[cg]) {
      porCarrera[cid].grupos[cg] = { codigo: cg, sort: parsearCodigoGrupo(cg), materias: [] };
    }
    porCarrera[cid].grupos[cg].materias.push({ ...m, _idx: idx });
  });

  // Ordenar carreras por nombre; grupos por turno→semestre→orden; materias por nombre
  const carrerasOrdenadas = Object.values(porCarrera).sort((a, b) => a.nombre.localeCompare(b.nombre));

  let html = '';

  carrerasOrdenadas.forEach((carrera, ci) => {
    const gruposOrdenados = Object.values(carrera.grupos).sort((a, b) => {
      if (a.sort.turno !== b.sort.turno) return a.sort.turno - b.sort.turno;
      if (a.sort.semestre !== b.sort.semestre) return a.sort.semestre - b.sort.semestre;
      return a.sort.orden - b.sort.orden;
    });

    gruposOrdenados.forEach(g => {
      g.materias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    });

    html += `
      <div class="carrera-section" data-carrera="${carrera.siglas}">
        <div class="carrera-header" onclick="toggleCarrera('carrera-${ci}')">
          <h3>${carrera.nombre} <span style="font-weight:400; font-size:0.85rem; opacity:0.7;">(${carrera.siglas})</span></h3>
          <span class="carrera-toggle" id="toggle-carrera-${ci}">−</span>
        </div>
        <div class="carrera-materias" id="carrera-${ci}">
    `;

    gruposOrdenados.forEach(g => {
      const p = g.sort;
      const turnoNombre = { 1:'Matutino', 2:'Vespertino', 3:'Nocturno', 4:'Sabatino' }[p.turno] || '';
      const label = `${g.codigo}${turnoNombre ? ' · ' + turnoNombre : ''}${p.semestre < 9 ? ' · Semestre ' + p.semestre : ''}`;

      html += `
        <div class="grupo-section" data-grupo="${g.codigo}">
          <div class="grupo-header">${label}</div>
          <div class="grupo-materias">
      `;

      g.materias.forEach(m => {
        html += `
          <div class="materia-card" data-nombre="${m.nombre.toLowerCase()}"
               style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:11px 16px;">
            <div style="font-weight:600; color:#333; font-size:0.95rem;">${m.nombre}</div>
            <button onclick="abrirMateriaDirecto(${m._idx})" class="btn-ver" style="flex-shrink:0;">Ver</button>
          </div>
        `;
      });

      html += `
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
  const grupos = document.querySelectorAll('.grupo-section');
  const carreras = document.querySelectorAll('.carrera-section');

  if (!buscador) {
    cards.forEach(c => c.style.display = 'flex');
    grupos.forEach(g => g.style.display = 'block');
    carreras.forEach(s => s.style.display = 'block');
    return;
  }

  cards.forEach(card => {
    const nombre = card.getAttribute('data-nombre') || '';
    card.style.display = nombre.includes(buscador) ? 'flex' : 'none';
  });

  grupos.forEach(g => {
    g.style.display = Array.from(g.querySelectorAll('.materia-card'))
      .some(c => c.style.display !== 'none') ? 'block' : 'none';
  });

  carreras.forEach(s => {
    s.style.display = Array.from(s.querySelectorAll('.materia-card'))
      .some(c => c.style.display !== 'none') ? 'block' : 'none';
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

  const titulo = materiaNombre + (codigoGrupo ? ` — Semestre ${codigoGrupo}` : '');
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

    // Bloque de profesores (desde todasLasMaterias, sin lectura extra a Firestore)
    const materiaId = materiaActual ? materiaActual.id : null;
    const profesoresBloque = (() => {
      if (!materiaId) return '';
      const asignaciones = todasLasMaterias.filter(m => m.id === materiaId);
      if (asignaciones.length === 0) return '';

      // Agrupar por profesorId
      const porProf = {};
      asignaciones.forEach(a => {
        const pid = a.profesorId || '__sin__';
        if (!porProf[pid]) porProf[pid] = { nombre: a.profesorNombre || null, grupos: [] };
        porProf[pid].grupos.push(a);
      });

      const filas = Object.values(porProf).map(p => {
        const nombre = p.nombre || '<em style="color:#999;">Sin asignar</em>';
        const grupos = p.grupos.map(g =>
          `<span style="background:#f1f5f9; border-radius:4px; padding:2px 8px; font-size:0.8rem; color:#475569;">${g.codigoGrupo}</span>`
        ).join(' ');
        return `<div style="display:flex; align-items:center; gap:12px; padding:6px 0; border-bottom:1px solid #f1f5f9;">
          <span style="font-weight:600; color:#1e293b; min-width:200px;">${nombre}</span>
          <span style="display:flex; flex-wrap:wrap; gap:6px;">${grupos}</span>
        </div>`;
      }).join('');

      return `
        <div style="margin-bottom:20px; padding:14px 16px; background:#fafafa; border:1px solid #e2e8f0; border-radius:8px; border-left:3px solid #6F1D46;">
          <div style="font-size:0.78rem; font-weight:700; color:#6F1D46; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;">Profesores</div>
          ${filas}
        </div>
      `;
    })();

    let html = profesoresBloque + `
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
        Total: ${alumnos.length} alumno(s) | Semestre: ${asig.codigoGrupo} | Profesor: ${asig.profesorNombre || '-'}
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

console.log('controlAcademia v3 — grupos por semestre, profesores en acta');
