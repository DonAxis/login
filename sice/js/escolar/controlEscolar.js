// controlEscolar.js - Sistema completo para Control Escolar
const auth = firebase.auth();
let usuarioActual = null;
let carrerasData = [];
let materiasData = [];
let alumnosData = [];
let carreraSeleccionada = null;
let grupoSeleccionado = null;
let materiaSeleccionada = null;
let periodoActual = '2026-1';
let listaHistorial = [];
let inscEspPorGrupo = {}; // { codigoGrupo: [{ alumnoId, materiaId }] } — especiales activos de la carrera seleccionada

// ===== PROTECCIÓN DE PÁGINA =====
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'https://ilbcontrol.mx/sice/';
    return;
  }

  try {
    const userData = await obtenerUsuarioConCache(user.uid);

    if (!userData || userData.rol !== 'controlEscolar') {
      alert('Solo personal de Control Escolar puede acceder');
      window.location.href = 'https://ilbcontrol.mx/sice/';
      return;
    }

    usuarioActual = userData;
    
    document.getElementById('nombreUsuario').textContent = usuarioActual.nombre;
    
    await inicializar();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = 'https://ilbcontrol.mx/sice/';
  }
});

async function cerrarSesion() {
  if (confirm('¿Cerrar sesión?')) {
    try {
      await auth.signOut();
      window.location.href = 'https://ilbcontrol.mx/sice/';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cerrar sesión');
    }
  }
}

// ===== INICIALIZACIÓN =====
async function inicializar() {
  console.log('Inicializando Control Escolar...');

  try {
    await cargarPeriodoActual();
  } catch (e) { console.error('Error periodo:', e); }

  try {
    await cargarCarreras();
  } catch (e) { console.error('Error carreras:', e); }

  // Alumnos y materias no bloquean el render de carreras
  await Promise.allSettled([cargarAlumnos(), cargarMaterias()]);

  actualizarEstadisticas();
  mostrarCarreras();

  // Restaurar panel desde hash del navegador (recarga en pestaña específica)
  const hashPanel = location.hash.replace('#', '').split('/')[0];
  const panelesValidos = ['alumnos', 'editar', 'aprobar', 'boletaGlobal', 'buscar', 'exAlumnos', 'config'];
  const panelInicial = panelesValidos.includes(hashPanel) ? hashPanel : 'alumnos';
  mostrarPanelEscolar(panelInicial, true);
  history.replaceState({ panel: panelInicial, nivel: 'panel' }, '', '#' + panelInicial);
}

async function cargarPeriodoActual() {
  // El periodo es por carrera (config/periodo_{carreraId}), no hay periodo global.
  // Se actualiza al seleccionar una carrera.
  document.getElementById('periodoActual').textContent = '-';
}


async function cargarCarreras() {
  try {
    const snapshot = await db.collection('carreras')
      .where('activo', '==', true)
      .get();
    
    carrerasData = [];
    snapshot.forEach(doc => {
      carrerasData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(carrerasData.length + ' carreras cargadas');
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

async function cargarAlumnos() {
  try {
    const snapshot = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('activo', '==', true)
      .get();
    
    alumnosData = [];
    snapshot.forEach(doc => {
      alumnosData.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    
    console.log(alumnosData.length + ' alumnos cargados');
  } catch (error) {
    console.error('Error al cargar alumnos:', error);
  }
}

async function cargarMaterias() {
  try {
    const snapshot = await db.collection('materias').get();
    
    materiasData = [];
    snapshot.forEach(doc => {
      materiasData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(materiasData.length + ' materias cargadas');
  } catch (error) {
    console.error('Error al cargar materias:', error);
  }
}

function actualizarEstadisticas() {
  document.getElementById('totalCarreras').textContent = carrerasData.length;
  document.getElementById('totalAlumnos').textContent = alumnosData.length;
  document.getElementById('totalMaterias').textContent = materiasData.length;
}

async function cargarAlumnosSiNecesario() {
  if (alumnosData.length > 0) return;
  await cargarAlumnos();
}

async function cargarMateriasSiNecesario() {
  if (materiasData.length > 0) return;
  await cargarMaterias();
}

// ===== MOSTRAR CARRERAS =====
function mostrarCarreras() {
  const container = document.getElementById('menuCarreras');

  if (carrerasData.length === 0) {
    container.innerHTML = '<div class="sin-datos">No hay carreras registradas</div>';
    return;
  }

  const secciones = [
    { label: 'Técnico Superior Universitario', prefijos: ['T'], carreras: [] },
    { label: 'Licenciatura',                   prefijos: ['L', 'U'], carreras: [] },
    { label: 'Maestría',                       prefijos: ['M'], carreras: [] },
  ];
  const otras = [];

  carrerasData
    .filter(carrera => !CARRERAS_OCULTAS.includes(carrera.codigo))
    .forEach(carrera => {
      const prefijo = (carrera.codigo || '').charAt(0).toUpperCase();
      const seccion = secciones.find(s => s.prefijos.includes(prefijo));
      if (seccion) seccion.carreras.push(carrera);
      else otras.push(carrera);
    });

  if (otras.length > 0) secciones.push({ label: 'Otras', prefijos: [], carreras: otras });

  let html = '';
  secciones.forEach(seccion => {
    if (seccion.carreras.length === 0) return;
    html += `<div style="grid-column:1/-1; margin: 20px 0 8px; font-size:1.1rem; font-weight:bold; color:#6A2135; border-bottom:2px solid #6A2135; padding-bottom:6px;">${seccion.label}</div>`;
    seccion.carreras.forEach(carrera => {
      html += `
        <div class="carrera-card" onclick="seleccionarCarrera('${carrera.id}')">
          <h3>${carrera.nombre}</h3>
          <p>Código: ${carrera.codigo}</p>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

// ===== SELECCIONAR CARRERA → muestra grupos =====
async function seleccionarCarrera(carreraId, skipHistory = false) {
  carreraSeleccionada = carrerasData.find(c => c.id === carreraId);
  if (!carreraSeleccionada) return;

  inscEspPorGrupo = {};

  try {
    const [configDoc, inscSnap] = await Promise.all([
      db.collection('config').doc(`periodo_${carreraId}`).get(),
      db.collection('inscripcionesEspeciales')
        .where('carreraId', '==', carreraId)
        .where('activa', '==', true)
        .get()
    ]);
    periodoActual = configDoc.exists ? (configDoc.data().periodo || '2026-1') : '2026-1';
    inscSnap.docs.forEach(doc => {
      const d = doc.data();
      if (!d.codigoGrupo || !d.alumnoId || !d.materiaId) return;
      if (!inscEspPorGrupo[d.codigoGrupo]) inscEspPorGrupo[d.codigoGrupo] = [];
      inscEspPorGrupo[d.codigoGrupo].push({ alumnoId: d.alumnoId, materiaId: d.materiaId });
    });
  } catch (e) {
    periodoActual = '2026-1';
  }
  document.getElementById('periodoActual').textContent = periodoActual;

  document.getElementById('menuCarreras').style.display = 'none';
  grupoSeleccionado = null;
  mostrarGruposCarrera();
  if (!skipHistory) {
    history.pushState({ panel: 'alumnos', nivel: 'grupos', carreraId }, '', '#alumnos/grupos');
  }
}

function mostrarGruposCarrera() {
  document.getElementById('gruposContainer').classList.add('active');

  const alumnosCarrera = alumnosData.filter(a =>
    a.carreraId === carreraSeleccionada.id && a.tipoAlumno !== 'especial' && a.codigoGrupo
  );

  // Grupos únicos: normales + grupos donde hay especiales inscritos
  const gruposUnicos = [...new Set([
    ...alumnosCarrera.map(a => a.codigoGrupo),
    ...Object.keys(inscEspPorGrupo)
  ])].sort();

  let html = `<div style="grid-column:1/-1; margin-bottom:10px;">
    <h2 class="titulo-seccion">${carreraSeleccionada.nombre}</h2>
    <p style="color:#666;">Selecciona un grupo</p>
  </div>`;

  if (gruposUnicos.length === 0) {
    html += '<div style="grid-column:1/-1;" class="sin-datos">No hay grupos con alumnos en esta carrera</div>';
  } else {
    gruposUnicos.forEach(codigo => {
      const normales  = alumnosCarrera.filter(a => a.codigoGrupo === codigo).length;
      const especiales = new Set((inscEspPorGrupo[codigo] || []).map(i => i.alumnoId)).size;
      const total = normales + especiales;
      html += `
        <div class="grupo-card" onclick="seleccionarGrupo('${codigo.replace(/'/g, "\\'")}')">
          <h4>${codigo}</h4>
          <p style="font-weight:bold; color:#6A2135;">${total} alumno${total !== 1 ? 's' : ''}</p>
        </div>`;
    });
  }

  const tieneEspeciales = alumnosData.some(a => a.carreraId === carreraSeleccionada.id && a.tipoAlumno === 'especial');
  if (tieneEspeciales) {
    html += `
      <div class="grupo-card" onclick="verAlumnosEspeciales()" style="background:#fff3cd; border-left:4px solid #ff9800;">
        <h4>Especiales</h4>
        <p>Alumnos de grupos cambiantes</p>
      </div>`;
  }

  document.getElementById('gruposGrid').innerHTML = html;
}

// ===== SELECCIONAR GRUPO → muestra opciones =====
function seleccionarGrupo(codigoGrupo, skipHistory = false) {
  grupoSeleccionado = { codigoGrupo };

  const normalesGrupo  = alumnosData.filter(a => a.codigoGrupo === codigoGrupo && a.tipoAlumno !== 'especial').length;
  const especialesGrupo = new Set((inscEspPorGrupo[codigoGrupo] || []).map(i => i.alumnoId)).size;
  const totalAlumnos = normalesGrupo + especialesGrupo;

  const html = `
    <div style="grid-column:1/-1; margin-bottom:10px;">
      <button onclick="history.back()" class="btn-volver" style="margin-bottom:10px;">← Grupos</button>
      <h2 class="titulo-seccion">${codigoGrupo}</h2>
    </div>
    <div style="grid-column:1/-1; display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:20px;">

      <div class="opcion-card">
        <h3>Por Alumno</h3>
        <p>${totalAlumnos} alumnos en este grupo</p>
        <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap; justify-content:center;">
          <button onclick="verAlumnosGrupo()" class="btn-accion">Ver Alumnos</button>
        </div>
      </div>

      <div class="opcion-card">
        <h3>Por Materia</h3>
        <p>Materias del grupo ${codigoGrupo}</p>
        <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap; justify-content:center;">
          <button onclick="verMateriasGrupo()" class="btn-accion">Ver Materias</button>
        </div>
      </div>

      <div class="opcion-card">
        <h3>Acta Histórica</h3>
        <p>Genera actas de periodos anteriores</p>
        <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap; justify-content:center;">
          <button onclick="verActaHistorica()" class="btn-accion">Ver Periodos</button>
        </div>
      </div>

    </div>`;

  document.getElementById('gruposGrid').innerHTML = html;
  if (!skipHistory) {
    history.pushState(
      { panel: 'alumnos', nivel: 'opciones', carreraId: carreraSeleccionada.id, grupo: codigoGrupo },
      '', '#alumnos/opciones'
    );
  }
}

// ===== VER ALUMNOS DEL GRUPO =====
function verAlumnosGrupo() {
  const grupo = grupoSeleccionado.codigoGrupo;

  const normales = alumnosData.filter(a => a.codigoGrupo === grupo && a.tipoAlumno !== 'especial');

  const alumnoIdsEsp = new Set((inscEspPorGrupo[grupo] || []).map(i => i.alumnoId));
  const especiales = alumnosData.filter(a => alumnoIdsEsp.has(a.uid));

  const alumnos = [...normales, ...especiales].sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (alumnos.length === 0) {
    mostrarLista(`<h2 class="titulo-seccion">Alumnos — ${grupo}</h2>
      <div class="sin-datos">No hay alumnos en este grupo</div>`);
    return;
  }

  let html = `
    <h2 class="titulo-seccion">Alumnos — ${grupo}</h2>
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <p style="margin:0; color:#666;">Total: ${alumnos.length} alumnos</p>
      <button onclick="generarListaObservacionesPDF()" class="btn-accion" style="white-space:nowrap;">Lista PDF</button>
    </div>
    <table>
      <thead><tr>
        <th>Matrícula</th><th>Nombre</th><th>Periodo</th><th>Acciones</th>
      </tr></thead>
      <tbody>`;

  alumnos.forEach(alumno => {
    const _nomSafe = alumno.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    html += `<tr>
      <td><strong>${alumno.matricula || 'N/A'}</strong></td>
      <td>${alumno.nombre}</td>
      <td>${alumno.periodo || periodoActual}</td>
      <td style="white-space:nowrap;">
        <button onclick="verHistorialCompleto('${alumno.uid}', '${_nomSafe}')">Ver Historial</button>
        <button onclick="toggleActivoAlumno('${alumno.uid}', '${_nomSafe}', false, 'grupo')"
          style="background:#dc3545;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;margin-left:4px;">
          Desactivar
        </button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  mostrarLista(html);
}

// ===== HISTORIAL ACTUAL POR ALUMNO =====
async function historialActualAlumnos() {
  const alumnos = alumnosData
    .filter(a => a.codigoGrupo === grupoSeleccionado.codigoGrupo && a.tipoAlumno !== 'especial')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (alumnos.length === 0) {
    mostrarLista(`<h2 class="titulo-seccion">Historial Actual — ${grupoSeleccionado.codigoGrupo}</h2>
      <div class="sin-datos">No hay alumnos en este grupo</div>`);
    return;
  }

  try {
    const asigSnap = await db.collection('profesorMaterias')
      .where('codigoGrupo', '==', grupoSeleccionado.codigoGrupo)
      .where('activa', '==', true)
      .get();

    const materias = [];
    asigSnap.forEach(doc => {
      const d = doc.data();
      materias.push({ materiaId: d.materiaId, nombre: d.materiaNombre, codigo: d.materiaCodigo || '' });
    });

    const alumnosConCalif = [];
    for (const alumno of alumnos) {
      const calSnap = await db.collection('calificaciones')
        .where('alumnoId', '==', alumno.uid)
        .where('periodo', '==', periodoActual)
        .get();
      const calMap = {};
      calSnap.forEach(doc => { calMap[doc.data().materiaId] = doc.data().parciales || {}; });
      alumnosConCalif.push({ ...alumno, calMap });
    }

    let html = `
      <h2 class="titulo-seccion">Historial ${periodoActual} — ${grupoSeleccionado.codigoGrupo}</h2>
      <div style="overflow-x:auto;">
      <table>
        <thead><tr>
          <th>Matrícula</th><th>Alumno</th>
          ${materias.map(m => `<th style="min-width:110px;">${m.nombre}<br><small style="color:#aaa;">${m.codigo}</small></th>`).join('')}
        </tr></thead>
        <tbody>`;

    alumnosConCalif.forEach(alumno => {
      html += `<tr>
        <td><strong>${alumno.matricula || 'N/A'}</strong></td>
        <td>${alumno.nombre}</td>`;

      materias.forEach(m => {
        const cal = alumno.calMap[m.materiaId] || {};
        const p1 = cal.parcial1 ?? '-';
        const p2 = cal.parcial2 ?? '-';
        const p3 = cal.parcial3 ?? '-';
        const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
        let prom = '-';
        if (tieneNP) {
          prom = 'NP';
        } else {
          const vals = [p1, p2, p3].filter(v => v !== '-' && v !== null && v !== undefined).map(Number).filter(n => !isNaN(n));
          if (vals.length > 0) prom = String(redondearCalificacion(vals.reduce((a, b) => a + b, 0) / vals.length));
        }
        const color = prom === '-' ? '#666' : esReprobado(parseFloat(prom), false) ? '#f44336' : '#4caf50';
        html += `<td style="text-align:center; font-size:0.85rem;">
          <div style="color:#555;">${p1} / ${p2} / ${p3}</div>
          <div style="font-weight:bold; color:${color};">${prom}</div>
        </td>`;
      });

      html += '</tr>';
    });

    html += '</tbody></table></div>';
    mostrarLista(html);
  } catch (error) {
    console.error('Error al cargar historial:', error);
    alert('Error al cargar historial actual');
  }
}

// ===== VER MATERIAS DEL GRUPO =====
async function verMateriasGrupo() {
  try {
    const asigSnap = await db.collection('profesorMaterias')
      .where('codigoGrupo', '==', grupoSeleccionado.codigoGrupo)
      .where('activa', '==', true)
      .get();

    if (asigSnap.empty) {
      mostrarLista(`<h2 class="titulo-seccion">Materias — ${grupoSeleccionado.codigoGrupo}</h2>
        <div class="sin-datos">No hay materias asignadas a este grupo</div>`);
      return;
    }

    let html = `
      <h2 class="titulo-seccion">Materias — ${grupoSeleccionado.codigoGrupo}</h2>
      <p style="margin-bottom:20px; color:#666;">Total: ${asigSnap.size} materias</p>
      <table>
        <thead><tr>
          <th>Materia</th><th>Profesor</th><th>Acciones</th>
        </tr></thead>
        <tbody>`;

    asigSnap.forEach(doc => {
      const d = doc.data();
      html += `<tr>
        <td>${d.materiaNombre}</td>
        <td>${d.profesorNombre || 'Sin asignar'}</td>
        <td><button onclick="verAlumnosEnMateria('${d.materiaId}', '${(d.materiaNombre || '').replace(/'/g, "\\'")}', '${(d.profesorNombre || '').replace(/'/g, "\\'")}')">Ver Alumnos</button></td>
      </tr>`;
    });

    html += '</tbody></table>';
    mostrarLista(html);
  } catch (error) {
    console.error('Error al cargar materias del grupo:', error);
    alert('Error al cargar materias');
  }
}

// ===== HISTORIAL ACTUAL POR MATERIA =====
async function historialActualMaterias() {
  try {
    const asigSnap = await db.collection('profesorMaterias')
      .where('codigoGrupo', '==', grupoSeleccionado.codigoGrupo)
      .where('activa', '==', true)
      .get();

    if (asigSnap.empty) {
      mostrarLista(`<h2 class="titulo-seccion">Historial por Materia — ${grupoSeleccionado.codigoGrupo}</h2>
        <div class="sin-datos">No hay materias asignadas a este grupo</div>`);
      return;
    }

    const materias = [];
    asigSnap.forEach(doc => {
      const d = doc.data();
      materias.push({ materiaId: d.materiaId, nombre: d.materiaNombre, codigo: d.materiaCodigo || '', profesor: d.profesorNombre || 'Sin asignar' });
    });

    const alumnos = alumnosData
      .filter(a => a.codigoGrupo === grupoSeleccionado.codigoGrupo && a.tipoAlumno !== 'especial')
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    let html = `<h2 class="titulo-seccion">Historial ${periodoActual} — ${grupoSeleccionado.codigoGrupo}</h2>`;

    for (const materia of materias) {
      const calSnap = await db.collection('calificaciones')
        .where('materiaId', '==', materia.materiaId)
        .where('periodo', '==', periodoActual)
        .get();

      const calMap = {};
      calSnap.forEach(doc => { calMap[doc.data().alumnoId] = doc.data().parciales || {}; });

      html += `
        <h3 style="margin:25px 0 10px; color:#6A2135; border-bottom:2px solid #6A2135; padding-bottom:8px;">
          ${materia.nombre} <small style="color:#666; font-weight:normal;">(${materia.codigo}) — ${materia.profesor}</small>
        </h3>
        <table>
          <thead><tr>
            <th>Matrícula</th><th>Alumno</th>
            <th>Parcial 1</th><th>Parcial 2</th><th>Parcial 3</th><th>Promedio</th>
          </tr></thead>
          <tbody>`;

      alumnos.forEach(alumno => {
        const cal = calMap[alumno.uid] || {};
        const p1 = cal.parcial1 ?? '-';
        const p2 = cal.parcial2 ?? '-';
        const p3 = cal.parcial3 ?? '-';
        const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
        let prom = '-';
        if (tieneNP) {
          prom = 'NP';
        } else {
          const vals = [p1, p2, p3].filter(v => v !== '-' && v !== null && v !== undefined).map(Number).filter(n => !isNaN(n));
          if (vals.length > 0) prom = String(redondearCalificacion(vals.reduce((a, b) => a + b, 0) / vals.length));
        }
        const color = prom === '-' ? '#333' : esReprobado(parseFloat(prom), false) ? '#f44336' : '#4caf50';
        html += `<tr>
          <td><strong>${alumno.matricula || 'N/A'}</strong></td>
          <td>${alumno.nombre}</td>
          <td style="text-align:center; font-weight:bold;">${p1}</td>
          <td style="text-align:center; font-weight:bold;">${p2}</td>
          <td style="text-align:center; font-weight:bold;">${p3}</td>
          <td style="text-align:center; font-weight:bold; font-size:1.2rem; color:${color};">${prom}</td>
        </tr>`;
      });

      html += '</tbody></table>';
    }

    mostrarLista(html);
  } catch (error) {
    console.error('Error al cargar historial por materia:', error);
    alert('Error al cargar historial');
  }
}

// ===== VER MATERIAS DE LA CARRERA (acceso directo, no por grupo) =====
async function verMateriasCarrera() {
  if (!carreraSeleccionada) return;

  await cargarMateriasSiNecesario();

  const materiasCarrera = materiasData.filter(m => m.carreraId === carreraSeleccionada.id);
  
  if (materiasCarrera.length === 0) {
    mostrarLista(`
      <h2 class="titulo-seccion">Materias de ${carreraSeleccionada.nombre}</h2>
      <div class="sin-datos">No hay materias registradas en esta carrera</div>
    `);
    return;
  }
  
  // Agrupar por periodo
  const materiasPorPeriodo = {};
  materiasCarrera.forEach(materia => {
    const periodo = materia.periodo || 'Sin periodo';
    if (!materiasPorPeriodo[periodo]) {
      materiasPorPeriodo[periodo] = [];
    }
    materiasPorPeriodo[periodo].push(materia);
  });
  
  // Ordenar periodos
  const periodos = Object.keys(materiasPorPeriodo).sort((a, b) => {
    if (a === 'Sin periodo') return 1;
    if (b === 'Sin periodo') return -1;
    return parseInt(a) - parseInt(b);
  });
  
  let html = `
    <h2 class="titulo-seccion">Materias de ${carreraSeleccionada.nombre}</h2>
    <p style="margin-bottom: 20px; color: #666;">Total: ${materiasCarrera.length} materias</p>
  `;
  
  // Generar HTML por periodo
  periodos.forEach(periodo => {
    const materias = materiasPorPeriodo[periodo];
    
    html += `
      <h3 style="margin: 30px 0 15px 0; color: #6A2135; border-bottom: 2px solid #6A2135; padding-bottom: 10px;">
        Periodo ${periodo} (${materias.length} materias)
      </h3>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Créditos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    materias.forEach(materia => {
      const creditos = materia.creditosSatca || materia.creditos || 0;
      
      html += `
        <tr>
          <td><strong>${materia.codigo || 'N/A'}</strong></td>
          <td>${materia.nombre}</td>
          <td style="text-align: center;">${creditos}</td>
          <td>
            <button onclick="verAlumnosEnMateria('${materia.id}', '${materia.nombre}')" class="btn-accion">
              Ver Alumnos
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
  });
  
  mostrarLista(html);
}

// ===== VER ALUMNOS EN UNA MATERIA ESPECÍFICA =====
async function verAlumnosEnMateria(materiaId, nombreMateria, profesorNombreParam = '') {
  console.log('Cargando alumnos de materia:', nombreMateria);

  await cargarAlumnosSiNecesario();

  try {
    // Obtener el codigoGrupo: desde contexto de grupo activo o desde profesorMaterias
    let codigoGrupoMateria = grupoSeleccionado ? grupoSeleccionado.codigoGrupo : null;
    if (!codigoGrupoMateria) {
      try {
        const asigSnap = await db.collection('profesorMaterias')
          .where('materiaId', '==', materiaId)
          .where('activa', '==', true)
          .limit(1)
          .get();
        if (!asigSnap.empty) codigoGrupoMateria = asigSnap.docs[0].data().codigoGrupo;
      } catch (_) {}
    }

    // Construir lista de alumnos: todos los del grupo (con o sin calificaciones)
    const alumnosEnMateria = [];

    if (codigoGrupoMateria) {
      const alumnosGrupo = alumnosData
        .filter(a => a.codigoGrupo === codigoGrupoMateria && a.tipoAlumno !== 'especial')
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      // Especiales inscritos en esta materia específica dentro de este grupo
      const espIds = (inscEspPorGrupo[codigoGrupoMateria] || [])
        .filter(i => i.materiaId === materiaId)
        .map(i => i.alumnoId);
      const alumnosEsp = alumnosData
        .filter(a => espIds.includes(a.uid))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      const todosList = [...alumnosGrupo, ...alumnosEsp];

      for (const alumno of todosList) {
        const docId = `${alumno.uid}_${materiaId}`;
        const calDoc = await db.collection('calificaciones').doc(docId).get({ source: 'server' })
          .catch(() => db.collection('calificaciones').doc(docId).get());
        const cal = calDoc.exists ? calDoc.data() : null;
        alumnosEnMateria.push({
          ...alumno,
          codigoGrupo:    alumno.codigoGrupo || codigoGrupoMateria,
          parcial1:       cal?.parciales?.parcial1 ?? '-',
          parcial2:       cal?.parciales?.parcial2 ?? '-',
          parcial3:       cal?.parciales?.parcial3 ?? '-',
          extraordinario: cal?.extraordinario ?? null,
          periodo:        cal?.periodo || periodoActual,
          profesorNombre: cal?.profesorNombre || profesorNombreParam
        });
      }
      alumnosEnMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else {
      // Sin contexto de grupo: fallback a query por calificaciones
      const calSnap = await db.collection('calificaciones')
        .where('materiaId', '==', materiaId)
        .get();
      for (const doc of calSnap.docs) {
        const cal = doc.data();
        const alumno = alumnosData.find(a => a.uid === cal.alumnoId);
        if (alumno) {
          alumnosEnMateria.push({
            ...alumno,
            parcial1:       cal.parciales?.parcial1 ?? '-',
            parcial2:       cal.parciales?.parcial2 ?? '-',
            parcial3:       cal.parciales?.parcial3 ?? '-',
            extraordinario: cal.extraordinario ?? null,
            periodo:        cal.periodo,
            profesorNombre: cal.profesorNombre || ''
          });
        }
      }
      alumnosEnMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    if (alumnosEnMateria.length === 0) {
      mostrarLista(`
        <h2 class="titulo-seccion">Alumnos en ${nombreMateria}</h2>
        <div class="sin-datos">No hay alumnos en este grupo</div>
      `);
      return;
    }

    // Guardar datos para el PDF en variable global (evita romper el atributo onclick con JSON)
    window._actaAlumnosData = alumnosEnMateria;
    window._actaMateriaId   = materiaId;
    window._actaMateriaNombre = nombreMateria;

    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Alumnos en ${nombreMateria}</h2>
      <p style="margin-bottom: 20px; color: #666;">Total: ${alumnosEnMateria.length} alumnos</p>

      <div style="margin-bottom: 20px;">
        <button onclick="descargarActaMateria(window._actaMateriaId, window._actaMateriaNombre, window._actaAlumnosData)"
                class="opcion-btn" style="background: #dc3545;">
          Descargar Acta de Calificaciones (PDF)
        </button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Matrícula</th>
            <th>Nombre</th>
            <th>Grupo/Código</th>
            <th>Parcial 1</th>
            <th>Parcial 2</th>
            <th>Parcial 3</th>
            <th>Promedio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    alumnosEnMateria.forEach(alumno => {
      // Calcular promedio
      const p1 = alumno.parcial1;
      const p2 = alumno.parcial2;
      const p3 = alumno.parcial3;
      
      let promedio = '-';
      const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
      
      if (tieneNP) {
        promedio = 'NP';
      } else {
        const cals = [p1, p2, p3]
          .filter(c => c !== '-' && c !== null && c !== undefined && c !== '')
          .map(c => parseFloat(c))
          .filter(c => !isNaN(c));

        if (cals.length > 0) {
          promedio = String(redondearCalificacion(cals.reduce((a, b) => a + b, 0) / cals.length));
        }
      }

      // Extraordinario tiene prioridad sobre el promedio calculado
      if (alumno.extraordinario !== null && alumno.extraordinario !== undefined) {
        promedio = String(redondearCalificacion(alumno.extraordinario));
      }

      // Color del promedio
      let colorPromedio = '#333';
      if (promedio === 'NP' || promedio === '-') {
        if (promedio === 'NP') colorPromedio = '#f44336';
      } else {
        colorPromedio = esReprobado(parseFloat(promedio), false) ? '#f44336' : '#4caf50';
      }
      
      html += `
        <tr>
          <td><strong>${alumno.matricula || 'N/A'}</strong></td>
          <td>${alumno.nombre}</td>
          <td>${alumno.codigoGrupo || alumno.grupoNombre || 'N/A'}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p1}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p2}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p3}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.3rem; color: ${colorPromedio};">
            ${promedio}
          </td>
          <td>
            <button onclick="verHistorialCompleto('${alumno.uid}', '${alumno.nombre.replace(/'/g, "\\'")}')">
              Ver Historial
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar alumnos de materia:', error);
    alert('Error al cargar alumnos de la materia');
  }
}


// ===== VER HISTORIAL COMPLETO DE UN ALUMNO =====
function verHistorialCompleto(alumnoId, nombreAlumno) {
  window.open(
    `historialAlumno.html?id=${encodeURIComponent(alumnoId)}&nombre=${encodeURIComponent(nombreAlumno)}`,
    '_blank'
  );
}

async function _verHistorialCompletoCancelado(alumnoId, nombreAlumno) {
  console.log('Cargando historial completo de:', nombreAlumno);
  await cargarMateriasSiNecesario();

  try {
    // Obtener todas las calificaciones del alumno
    const calificacionesSnap = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .get();
    
    if (calificacionesSnap.empty) {
      mostrarLista(`
        <h2 class="titulo-seccion">Historial de ${nombreAlumno}</h2>
        <div class="sin-datos">Este alumno no tiene calificaciones registradas</div>
      `);
      return;
    }
    
    // Procesar calificaciones
    const materiasMap = {};
    const materiasCache = {};
    
    for (const doc of calificacionesSnap.docs) {
      const cal = doc.data();
      const key = `${cal.materiaId}_${cal.periodo}`;
      
      let materiaNombre = cal.materiaNombre || 'Sin nombre';
      let materiaCodigo = cal.materiaCodigo || '';
      
      // Si no tiene nombre, buscarlo
      if (!cal.materiaNombre && cal.materiaId) {
        if (!materiasCache[cal.materiaId]) {
          const materiaData = materiasData.find(m => m.id === cal.materiaId);
          if (materiaData) {
            materiasCache[cal.materiaId] = materiaData;
          }
        }
        
        if (materiasCache[cal.materiaId]) {
          materiaNombre = materiasCache[cal.materiaId].nombre;
          materiaCodigo = materiasCache[cal.materiaId].codigo || '';
        }
      }
      
      materiasMap[key] = {
        materiaNombre: materiaNombre,
        materiaCodigo: materiaCodigo,
        periodo: cal.periodo || 'N/A',
        parcial1: cal.parciales?.parcial1 ?? '-',
        parcial2: cal.parciales?.parcial2 ?? '-',
        parcial3: cal.parciales?.parcial3 ?? '-'
      };
    }
    
    // Agrupar por periodo
    const periodosMaterias = {};
    
    Object.values(materiasMap).forEach(materia => {
      const periodo = materia.periodo;
      if (!periodosMaterias[periodo]) {
        periodosMaterias[periodo] = [];
      }
      periodosMaterias[periodo].push(materia);
    });
    
    // Ordenar periodos
    const periodos = Object.keys(periodosMaterias).sort().reverse();
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Historial Académico Completo</h2>
      
      <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #6A2135;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <strong style="color: #666;">Alumno:</strong><br>
            ${nombreAlumno}
          </div>
          <div>
            <strong style="color: #666;">Total Materias:</strong><br>
            <span style="font-size: 1.5rem; color: #4caf50; font-weight: bold;">${Object.keys(materiasMap).length}</span>
          </div>
          <div>
            <strong style="color: #666;">Periodos Cursados:</strong><br>
            <span style="font-size: 1.5rem; color: #6A2135; font-weight: bold;">${periodos.length}</span>
          </div>
        </div>
        
        <div style="margin-top: 20px;">
          <button onclick="descargarHistorialAlumnoPDF('${alumnoId}', '${nombreAlumno.replace(/'/g, "\\'")}');" 
                  class="opcion-btn" style="background: #dc3545; width: 100%;">
            📄 Descargar Historial Completo (PDF)
          </button>
        </div>
      </div>
    `;
    
    // Generar tabla por periodo
    periodos.forEach(periodo => {
      const materias = periodosMaterias[periodo];
      
      // Calcular promedio del periodo
      let sumaPromedios = 0;
      let countPromedios = 0;
      
      html += `
        <h3 style="margin: 30px 0 15px 0; color: #6A2135; border-bottom: 2px solid #6A2135; padding-bottom: 10px;">
          Periodo ${periodo}
        </h3>
        <table>
          <thead>
            <tr>
              <th>Materia</th>
              <th>Código</th>
              <th>Parcial 1</th>
              <th>Parcial 2</th>
              <th>Parcial 3</th>
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      materias.forEach(materia => {
        const p1 = materia.parcial1;
        const p2 = materia.parcial2;
        const p3 = materia.parcial3;
        
        let promedio = '-';
        const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
        
        if (tieneNP) {
          promedio = 'NP';
          sumaPromedios += 5.0;
          countPromedios++;
        } else {
          const cals = [p1, p2, p3]
            .filter(c => c !== '-' && c !== null && c !== undefined && c !== '')
            .map(c => parseFloat(c))
            .filter(c => !isNaN(c));
          
          if (cals.length > 0) {
            const prom = cals.reduce((a, b) => a + b, 0) / cals.length;
            promedio = prom.toFixed(1);
            sumaPromedios += prom;
            countPromedios++;
          }
        }
        
        let colorPromedio = '#333';
        if (promedio !== '-') {
          colorPromedio = esReprobado(parseFloat(promedio), false) ? '#f44336' : '#4caf50';
        }

        html += `
          <tr>
            <td><strong>${materia.materiaNombre}</strong></td>
            <td>${materia.materiaCodigo}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p1}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p2}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p3}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.3rem; color: ${colorPromedio};">
              ${promedio}
            </td>
          </tr>
        `;
      });
      
      // Promedio del periodo
      const promedioPeriodo = countPromedios > 0 
        ? (sumaPromedios / countPromedios).toFixed(1) 
        : '-';
      
      html += `
          </tbody>
          <tfoot>
            <tr style="background: #f8f9fa; font-weight: bold;">
              <td colspan="5" style="text-align: right; padding-right: 20px;">Promedio del Periodo:</td>
              <td style="text-align: center; font-size: 1.3rem; color: #6A2135;">
                ${promedioPeriodo}
              </td>
            </tr>
          </tfoot>
        </table>
      `;
    });
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar historial:', error);
    alert('Error al cargar historial del alumno');
  }
}

// ===== FUNCIONES DE NAVEGACIÓN =====
function mostrarLista(html) {
  const listaContainer = document.getElementById('listaContainer');
  if (listaContainer.classList.contains('active')) {
    listaHistorial.push(document.getElementById('listaContenido').innerHTML);
  } else {
    listaHistorial = [];
  }
  document.getElementById('listaContenido').innerHTML = html;
  document.getElementById('gruposContainer').classList.remove('active');
  listaContainer.classList.add('active');
}

function volverCarreras() {
  history.back();
}

function _irACarreras() {
  document.getElementById('gruposContainer').classList.remove('active');
  document.getElementById('listaContainer').classList.remove('active');
  document.getElementById('menuCarreras').removeAttribute('style');
  document.getElementById('gruposGrid').innerHTML = '';
  carreraSeleccionada = null;
  grupoSeleccionado = null;
  listaHistorial = [];
  periodoActual = '2026-1';
  document.getElementById('periodoActual').textContent = '-';
}

function volverGrupos() {
  if (listaHistorial.length > 0) {
    document.getElementById('listaContenido').innerHTML = listaHistorial.pop();
    return;
  }
  history.back();
}

// ===== VER ALUMNOS ESPECIALES =====
async function verAlumnosEspeciales() {
  if (!carreraSeleccionada) {
    alert('Selecciona una carrera primero');
    return;
  }
  
  console.log('Cargando alumnos especiales de:', carreraSeleccionada.nombre);
  
  try {
    // Cargar alumnos especiales de esta carrera
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('tipoAlumno', '==', 'especial')
      .where('carreraId', '==', carreraSeleccionada.id)
      .where('activo', '==', true)
      .get();
    
    if (alumnosSnap.empty) {
      mostrarLista(`
        <h2 class="titulo-seccion">Alumnos Especiales - ${carreraSeleccionada.nombre}</h2>
        <div class="sin-datos">
          <p>No hay alumnos especiales en esta carrera</p>
          <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
            Los alumnos especiales son aquellos que toman materias de diferentes grupos
          </p>
        </div>
      `);
      return;
    }
    
    // Obtener inscripciones de cada alumno
    const alumnosArray = [];
    
    for (const doc of alumnosSnap.docs) {
      const alumno = {
        id: doc.id,
        ...doc.data()
      };
      
      // Contar materias inscritas
      const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
        .where('alumnoId', '==', doc.id)
        .where('activa', '==', true)
        .get();
      
      alumno.numMaterias = inscripcionesSnap.size;
      
      alumnosArray.push(alumno);
    }
    
    // Ordenar alfabéticamente
    alumnosArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Alumnos Especiales - ${carreraSeleccionada.nombre}</h2>
      
      <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
        <strong>Total de Alumnos Especiales: ${alumnosArray.length}</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">
          Estos alumnos no pertenecen a un grupo fijo y toman materias individuales
        </p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Matrícula</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Periodo</th>
            <th>Materias</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    alumnosArray.forEach(alumno => {
      html += `
        <tr style="background: #fff8e1;">
          <td><strong>${alumno.matricula}</strong></td>
          <td>
            ${alumno.nombre}
            <span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; margin-left: 5px;">ESPECIAL</span>
          </td>
          <td style="font-size: 0.85rem; color: #666;">${alumno.email || 'N/A'}</td>
          <td>${alumno.periodo || periodoActual}</td>
          <td style="text-align: center; font-weight: bold; color: #4caf50;">
            ${alumno.numMaterias}
          </td>
          <td>
            <button onclick="verDetalleAlumnoEspecial('${alumno.id}', '${alumno.nombre.replace(/'/g, "\\'")}')">
              Ver Detalle
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar alumnos especiales:', error);
    alert('Error al cargar alumnos especiales');
  }
}

// ===== VER DETALLE DE ALUMNO ESPECIAL =====
async function verDetalleAlumnoEspecial(alumnoId, nombreAlumno) {
  console.log('Cargando detalle del alumno especial:', nombreAlumno);
  
  try {
    // Obtener datos del alumno
    const alumnoDoc = await db.collection('usuarios').doc(alumnoId).get();
    
    if (!alumnoDoc.exists) {
      alert('Alumno no encontrado');
      return;
    }
    
    const alumno = alumnoDoc.data();
    
    // Obtener inscripciones activas
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('activa', '==', true)
      .get();
    
    const inscripciones = [];
    
    // Para cada inscripción, obtener calificaciones
    for (const doc of inscripcionesSnap.docs) {
      const inscripcion = {
        id: doc.id,
        ...doc.data()
      };
      
      // Buscar calificaciones
      const docId = alumnoId + '_' + inscripcion.materiaId;
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      if (calDoc.exists) {
        const calData = calDoc.data();
        inscripcion.parcial1 = calData.parciales?.parcial1 ?? '-';
        inscripcion.parcial2 = calData.parciales?.parcial2 ?? '-';
        inscripcion.parcial3 = calData.parciales?.parcial3 ?? '-';
      } else {
        inscripcion.parcial1 = '-';
        inscripcion.parcial2 = '-';
        inscripcion.parcial3 = '-';
      }
      
      // Calcular promedio
      const cals = [inscripcion.parcial1, inscripcion.parcial2, inscripcion.parcial3]
        .filter(c => c !== '-' && c !== 'NP')
        .map(c => parseFloat(c))
        .filter(c => !isNaN(c));
      
      if (cals.length > 0) {
        inscripcion.promedio = String(redondearCalificacion(cals.reduce((a, b) => a + b, 0) / cals.length));
      } else if (inscripcion.parcial1 === 'NP' || inscripcion.parcial2 === 'NP' || inscripcion.parcial3 === 'NP') {
        inscripcion.promedio = 'NP';
      } else {
        inscripcion.promedio = '-';
      }
      
      inscripciones.push(inscripcion);
    }
    
    // Ordenar por materia
    inscripciones.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre));
    
    const _idSafe  = alumnoId;
    const _nomSafe = alumno.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Detalle Alumno Especial</h2>

      <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #ff9800;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 16px;">
          <div>
            <strong style="color: #666;">Nombre:</strong><br>
            ${alumno.nombre}
            <span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; margin-left: 5px;">ESPECIAL</span>
          </div>
          <div>
            <strong style="color: #666;">Matrícula:</strong><br>
            ${alumno.matricula}
          </div>
          <div>
            <strong style="color: #666;">Email:</strong><br>
            ${alumno.email || 'N/A'}
          </div>
          <div>
            <strong style="color: #666;">Periodo:</strong><br>
            ${alumno.periodo || periodoActual}
          </div>
          <div>
            <strong style="color: #666;">Materias Inscritas:</strong><br>
            <span style="font-size: 1.5rem; color: #4caf50; font-weight: bold;">${inscripciones.length}</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-accion" onclick="verHistorialCompleto('${_idSafe}', '${_nomSafe}')">
            Ver Historial
          </button>
          <button style="background:#388e3c;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;"
            onclick="verBoletaGlobalAlumno('${_idSafe}')">
            Boleta Global
          </button>
        </div>
      </div>
    `;
    
    if (inscripciones.length === 0) {
      html += `
        <div class="sin-datos">
          <p>Este alumno no tiene materias inscritas actualmente</p>
        </div>
      `;
    } else {
      html += `
        <h3 style="margin: 20px 0 15px 0; color: #6A2135;">Materias y Calificaciones</h3>
        <table>
          <thead>
            <tr>
              <th>Materia</th>
              <th>Grupo</th>
              <th>Profesor</th>
              <th style="text-align: center;">Parcial 1</th>
              <th style="text-align: center;">Parcial 2</th>
              <th style="text-align: center;">Parcial 3</th>
              <th style="text-align: center;">Promedio</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      inscripciones.forEach(insc => {
        const promedioNum = parseFloat(insc.promedio);
        let promedioColor = '#333';
        
        if (!isNaN(promedioNum)) {
          if (promedioNum >= 8) {
            promedioColor = '#4caf50';
          } else if (promedioNum >= 6) {
            promedioColor = '#ff9800';
          } else {
            promedioColor = '#f44336';
          }
        }
        
        html += `
          <tr>
            <td>
              <strong>${insc.materiaNombre}</strong>
              ${insc.materiaCodigo ? '<br><small style="color: #666;">' + insc.materiaCodigo + '</small>' : ''}
            </td>
            <td>${insc.grupoNombre}</td>
            <td>${insc.profesorNombre || 'N/A'}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${insc.parcial1}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${insc.parcial2}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${insc.parcial3}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.3rem; color: ${promedioColor};">
              ${insc.promedio}
            </td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
    }
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar detalle:', error);
    alert('Error al cargar detalle del alumno');
  }
}

// ===== PLACEHOLDER PARA FUNCIONES EXTERNAS =====
function descargarHistorialAlumnoPDF(alumnoId, nombreAlumno) {
  if (typeof window.descargarHistorialAlumnoPDF === 'function') {
    window.descargarHistorialAlumnoPDF(alumnoId, nombreAlumno);
  } else {
    alert('Función de PDF no disponible. Asegúrate de cargar HistorialAlumnoPDF.js');
  }
}

console.log('Control Escolar cargado - versión completa con alumnos especiales');

// ===== UTILIDAD: FLASH VERDE EN FILA =====
function flashFila(fila) {
  if (!fila) return;
  fila.classList.remove('fila-guardada');
  void fila.offsetWidth;
  fila.classList.add('fila-guardada');
  setTimeout(() => fila.classList.remove('fila-guardada'), 1500);
}

// ===== PANEL PROFESORES =====
async function abrirEditorProfesores() {
  _togglePanel('editorProfesoresPanel', async () => {
    if (profesoresData.length === 0) {
      document.getElementById('resultadoProfesoresEdicion').innerHTML =
        '<p style="color:#666; padding:10px;">Cargando profesores...</p>';
      try {
        const snap = await db.collection('usuarios')
          .where('rol', '==', 'profesor')
          .where('activo', '==', true)
          .get();
        profesoresData = [];
        snap.forEach(doc => profesoresData.push({ uid: doc.id, ...doc.data() }));
        profesoresData.sort((a, b) => a.nombre.localeCompare(b.nombre));
      } catch (e) {
        console.error('Error cargando profesores:', e);
      }
    }
    renderProfesoresEdicion(profesoresData);
  });
}

function filtrarProfesoresEdicion() {
  const texto = (document.getElementById('busquedaProfesor').value || '').toLowerCase();
  const filtrados = texto
    ? profesoresData.filter(p => p.nombre.toLowerCase().includes(texto))
    : profesoresData;
  renderProfesoresEdicion(filtrados);
}

function renderProfesoresEdicion(lista) {
  const resultado = document.getElementById('resultadoProfesoresEdicion');
  if (lista.length === 0) {
    resultado.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">Sin resultados</p>';
    return;
  }
  let html = `<p style="margin-bottom:10px; color:#666;">${lista.length} profesores</p>
  <table>
    <thead><tr>
      <th>Nombre Actual</th><th>Nuevo Nombre</th><th></th>
    </tr></thead>
    <tbody>`;
  lista.forEach(prof => {
    const nombreEsc = (prof.nombre || '').replace(/"/g, '&quot;');
    html += `<tr>
      <td id="nombreActualProf_${prof.uid}">${prof.nombre}</td>
      <td><input type="text" id="inputProf_${prof.uid}" value="${nombreEsc}"
           style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></td>
      <td><button onclick="guardarNombreProfesor('${prof.uid}')"
           class="btn-accion" style="white-space:nowrap;">Guardar</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  resultado.innerHTML = html;
}

async function guardarNombreProfesor(uid) {
  const input = document.getElementById('inputProf_' + uid);
  const nuevoNombre = input.value.trim();
  if (!nuevoNombre) { alert('El nombre no puede estar vacío'); return; }

  const btn = input.closest('tr').querySelector('button');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const [califs, profMaterias] = await Promise.all([
      db.collection('calificaciones').where('profesorId', '==', uid).get(),
      db.collection('profesorMaterias').where('profesorId', '==', uid).get()
    ]);

    const ops = [{ ref: db.collection('usuarios').doc(uid), data: { nombre: nuevoNombre } }];
    califs.forEach(doc    => ops.push({ ref: doc.ref, data: { profesorNombre: nuevoNombre } }));
    profMaterias.forEach(doc => ops.push({ ref: doc.ref, data: { profesorNombre: nuevoNombre } }));

    const CHUNK = 499;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = db.batch();
      ops.slice(i, i + CHUNK).forEach(op => batch.update(op.ref, op.data));
      await batch.commit();
    }

    const prof = profesoresData.find(p => p.uid === uid);
    if (prof) prof.nombre = nuevoNombre;
    const celda = document.getElementById('nombreActualProf_' + uid);
    if (celda) celda.textContent = nuevoNombre;

    flashFila(input.closest('tr'));
    console.log(`Profesor actualizado: usuarios + ${califs.size} calificaciones + ${profMaterias.size} profesorMaterias`);

  } catch (error) {
    console.error('Error al guardar profesor:', error);
    alert('Error al guardar: ' + error.message);
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}

// ===== PANEL MATERIAS =====
function abrirEditorMaterias() {
  _togglePanel('editorMateriasPanel', () => {
    const sel = document.getElementById('filtroCarreraMateria');
    sel.innerHTML = '<option value="">-- Selecciona Carrera --</option>';
    [...carrerasData]
      .filter(c => !CARRERAS_OCULTAS.includes(c.codigo))
      .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
      .forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.codigo} — ${c.nombre}</option>`;
      });
  });
}

function filtrarMateriasEdicion() {
  const carreraId = document.getElementById('filtroCarreraMateria').value;
  if (!carreraId) { alert('Selecciona una carrera'); return; }

  const filtradas = materiasData
    .filter(m => m.carreraId === carreraId)
    .sort((a, b) => {
      const pa = parseInt(a.periodo) || 0, pb = parseInt(b.periodo) || 0;
      return pa !== pb ? pa - pb : (a.nombre || '').localeCompare(b.nombre || '');
    });

  const resultado = document.getElementById('resultadoMateriasEdicion');
  if (filtradas.length === 0) {
    resultado.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">No hay materias para esta carrera</p>';
    return;
  }

  let html = `<p style="margin-bottom:10px; color:#666;">${filtradas.length} materias</p>
  <table>
    <thead><tr>
      <th>Código</th><th>Per.</th><th>Nombre Actual</th><th>Nuevo Nombre</th><th></th>
    </tr></thead>
    <tbody>`;
  filtradas.forEach(mat => {
    const nombreEsc = (mat.nombre || '').replace(/"/g, '&quot;');
    html += `<tr>
      <td>${mat.codigo || 'N/A'}</td>
      <td style="text-align:center;">${mat.periodo || '-'}</td>
      <td id="nombreActualMat_${mat.id}">${mat.nombre}</td>
      <td><input type="text" id="inputMat_${mat.id}" value="${nombreEsc}"
           style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></td>
      <td><button onclick="guardarNombreMateria('${mat.id}')"
           class="btn-accion" style="white-space:nowrap;">Guardar</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  resultado.innerHTML = html;
}

async function guardarNombreMateria(materiaId) {
  const input = document.getElementById('inputMat_' + materiaId);
  const nuevoNombre = input.value.trim();
  if (!nuevoNombre) { alert('El nombre no puede estar vacío'); return; }

  const btn = input.closest('tr').querySelector('button');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const [profMaterias, califs] = await Promise.all([
      db.collection('profesorMaterias').where('materiaId', '==', materiaId).get(),
      db.collection('calificaciones').where('materiaId', '==', materiaId).get()
    ]);

    const ops = [{ ref: db.collection('materias').doc(materiaId), data: { nombre: nuevoNombre } }];
    profMaterias.forEach(doc => ops.push({ ref: doc.ref, data: { materiaNombre: nuevoNombre } }));
    califs.forEach(doc      => ops.push({ ref: doc.ref, data: { materiaNombre: nuevoNombre } }));

    const CHUNK = 499;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = db.batch();
      ops.slice(i, i + CHUNK).forEach(op => batch.update(op.ref, op.data));
      await batch.commit();
    }

    const mat = materiasData.find(m => m.id === materiaId);
    if (mat) mat.nombre = nuevoNombre;
    const celda = document.getElementById('nombreActualMat_' + materiaId);
    if (celda) celda.textContent = nuevoNombre;

    flashFila(input.closest('tr'));
    console.log(`Materia actualizada: materias + ${profMaterias.size} profesorMaterias + ${califs.size} calificaciones`);

  } catch (error) {
    console.error('Error al guardar materia:', error);
    alert('Error al guardar: ' + error.message);
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}

const CARRERAS_OCULTAS = ['DE', 'PRUEBA'];
let profesoresData = [];

// ===== TOGGLE DE PANELES =====
function _togglePanel(panelId, onAbrir) {
  const ids = ['editorNombresPanel', 'editorProfesoresPanel', 'editorMateriasPanel'];
  const statsGrid  = document.getElementById('statsGrid');
  const mainContent = document.getElementById('mainContent');
  const panel = document.getElementById(panelId);
  const yaVisible = panel.style.display !== 'none';

  ids.forEach(id => { document.getElementById(id).style.display = 'none'; });

  if (yaVisible) {
    statsGrid.style.display  = '';
    mainContent.style.display = '';
  } else {
    panel.style.display      = 'block';
    statsGrid.style.display  = 'none';
    mainContent.style.display = 'none';
    if (onAbrir) onAbrir();
  }
}

// ===== PANEL ALUMNOS =====
function abrirEditorAlumnos() {
  _togglePanel('editorNombresPanel', poblarFiltrosEdicion);
}

function poblarFiltrosEdicion() {
  const inputBusq = document.getElementById('busquedaEdicionAlumno');
  if (inputBusq) inputBusq.value = '';
  document.getElementById('resultadoEdicionNombres').innerHTML = '';
  const sel = document.getElementById('filtroCarreraEdicion');
  sel.innerHTML = '<option value="">-- Todas --</option>';
  [...carrerasData]
    .filter(c => !CARRERAS_OCULTAS.includes(c.codigo))
    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
    .forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.codigo} — ${c.nombre}</option>`;
    });
}

async function filtrarAlumnosEdicion() {
  const busqueda  = (document.getElementById('busquedaEdicionAlumno')?.value || '').trim().toLowerCase();
  const carreraId = document.getElementById('filtroCarreraEdicion').value;
  const periodo   = document.getElementById('filtroPeriodoEdicion').value;
  const resultado = document.getElementById('resultadoEdicionNombres');

  if (!busqueda && !carreraId) return;

  if (!_alumnosBuscarCache) {
    resultado.innerHTML = '<p style="color:#999;padding:12px;">Cargando alumnos...</p>';
    try { await _cargarCacheBuscar(resultado); }
    catch (e) { resultado.innerHTML = '<p style="color:#c00;padding:12px;">Error al cargar alumnos.</p>'; return; }
  }

  let filtrados = _alumnosBuscarCache || [];

  if (busqueda) {
    filtrados = filtrados.filter(a =>
      (a.nombre    || '').toLowerCase().includes(busqueda) ||
      (a.matricula || '').toLowerCase().includes(busqueda)
    );
  }
  if (carreraId) filtrados = filtrados.filter(a => a.carreraId === carreraId);
  if (periodo === 'especial') {
    filtrados = filtrados.filter(a => !a.codigoGrupo);
  } else if (periodo) {
    filtrados = filtrados.filter(a => String(a.periodo) === String(periodo));
  }

  filtrados.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  if (filtrados.length === 0) {
    resultado.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">No se encontraron alumnos con esos filtros</p>';
    return;
  }

  const inp = () => `style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;"`;

  let html = `<p style="margin-bottom:10px; color:#666;">${filtrados.length} alumnos encontrados</p>
  <div style="overflow-x:auto;">
  <table style="min-width:900px;">
    <thead><tr>
      <th>Grupo</th>
      <th>Nombre</th>
      <th>Matrícula</th>
      <th>Email</th>
      <th>Tutor Nombre</th>
      <th>Tutor Teléfono</th>
      <th></th>
    </tr></thead>
    <tbody>`;

  filtrados.forEach(alumno => {
    const uid      = alumno.id || alumno.uid;
    const inactivo = alumno.activo === false;
    const esc      = v => (v || '').replace(/"/g, '&quot;');
    const badge    = inactivo
      ? '<span style="background:#dc3545;color:white;padding:1px 6px;border-radius:10px;font-size:0.7rem;font-weight:700;vertical-align:middle;margin-left:4px;">INACTIVO</span>'
      : '';
    const rowStyle = inactivo ? ' style="background:#fff5f5;"' : '';
    html += `<tr${rowStyle}>
      <td>${alumno.codigoGrupo || ''}</td>
      <td><div style="display:flex;align-items:center;gap:6px;"><input type="text" id="inputNombre_${uid}" value="${esc(alumno.nombre)}" ${inp()}>${badge}</div></td>
      <td><input type="text" id="inputMatricula_${uid}" value="${esc(alumno.matricula)}" ${inp()}></td>
      <td><input type="email" id="inputEmail_${uid}" value="${esc(alumno.email)}" ${inp()}></td>
      <td><input type="text" id="inputTutorNombre_${uid}" value="${esc(alumno.tutor?.nombre)}" ${inp()}></td>
      <td><input type="text" id="inputTutorTel_${uid}" value="${esc(alumno.tutor?.telefono)}" ${inp()}></td>
      <td><button onclick="guardarDatosAlumno('${uid}')"
           class="btn-accion" style="white-space:nowrap;">Guardar</button></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  resultado.innerHTML = html;
}

async function guardarDatosAlumno(uid) {
  const nuevoNombre    = document.getElementById('inputNombre_'      + uid).value.trim();
  const nuevaMatricula = document.getElementById('inputMatricula_'   + uid).value.trim();
  const nuevoEmail     = document.getElementById('inputEmail_'        + uid).value.trim();
  const tutorNombre    = document.getElementById('inputTutorNombre_' + uid).value.trim();
  const tutorTel       = document.getElementById('inputTutorTel_'    + uid).value.trim();

  if (!nuevoNombre) { alert('El nombre no puede estar vacío'); return; }

  const btn = document.getElementById('inputNombre_' + uid).closest('tr').querySelector('button');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const [califs, inscEsp, reportes] = await Promise.all([
      db.collection('calificaciones').where('alumnoId', '==', uid).get(),
      db.collection('inscripcionesEspeciales').where('alumnoId', '==', uid).get(),
      db.collection('reportesPrefecto').where('alumnoId', '==', uid).get()
    ]);

    const datosUsuario = {
      nombre:    nuevoNombre,
      matricula: nuevaMatricula,
      email:     nuevoEmail,
      tutor:     { nombre: tutorNombre, telefono: tutorTel }
    };

    const todasOps = [{ ref: db.collection('usuarios').doc(uid), data: datosUsuario }];

    califs.forEach(doc   => todasOps.push({ ref: doc.ref, data: { alumnoNombre: nuevoNombre } }));
    inscEsp.forEach(doc  => todasOps.push({ ref: doc.ref, data: { alumnoNombre: nuevoNombre } }));
    reportes.forEach(doc => todasOps.push({ ref: doc.ref, data: { alumnoNombre: nuevoNombre } }));

    const CHUNK = 499;
    for (let i = 0; i < todasOps.length; i += CHUNK) {
      const batch = db.batch();
      todasOps.slice(i, i + CHUNK).forEach(op => batch.update(op.ref, op.data));
      await batch.commit();
    }

    const alumno = alumnosData.find(a => a.uid === uid);
    if (alumno) {
      alumno.nombre    = nuevoNombre;
      alumno.matricula = nuevaMatricula;
      alumno.email     = nuevoEmail;
      alumno.tutor     = { nombre: tutorNombre, telefono: tutorTel };
    }
    const cached = _alumnosBuscarCache?.find(a => (a.id || a.uid) === uid);
    if (cached) {
      cached.nombre    = nuevoNombre;
      cached.matricula = nuevaMatricula;
      cached.email     = nuevoEmail;
      cached.tutor     = { nombre: tutorNombre, telefono: tutorTel };
    }

    flashFila(document.getElementById('inputNombre_' + uid).closest('tr'));

    console.log(`Alumno actualizado: usuarios + ${califs.size} calificaciones + ${inscEsp.size} inscripcionesEspeciales + ${reportes.size} reportesPrefecto`);

  } catch (error) {
    console.error('Error al guardar alumno:', error);
    alert('Error al guardar: ' + error.message);
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}

// ===== LISTA DE ALUMNOS CON OBSERVACIONES (PDF) =====
function generarListaObservacionesPDF() {
  const grupo = grupoSeleccionado.codigoGrupo;
  const normales = alumnosData.filter(a => a.codigoGrupo === grupo && a.tipoAlumno !== 'especial');
  const alumnoIdsEsp = new Set((inscEspPorGrupo[grupo] || []).map(i => i.alumnoId));
  const especiales = alumnosData.filter(a => alumnoIdsEsp.has(a.uid));
  const alumnos = [...normales, ...especiales].sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (alumnos.length === 0) { alert('No hay alumnos en este grupo'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const carrera = carreraSeleccionada ? carreraSeleccionada.nombre : '';

  // Logos
  if (typeof agregarLogosAlPDF === 'function') {
    agregarLogosAlPDF(doc, carreraSeleccionada?.tieneExamenFinal === true);
  }

  // Encabezado
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Lista de Alumnos', pageWidth / 2, 22, { align: 'center' });

  // Línea bajo el título
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(10, 26, pageWidth - 10, 26);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Grupo: ${grupo}`, pageWidth / 2, 32, { align: 'center' });
  if (carrera) doc.text(carrera, pageWidth / 2, 38, { align: 'center' });
  doc.text(`Periodo: ${periodoActual}     Fecha: ${fecha}`, pageWidth / 2, 44, { align: 'center' });

  // Tabla
  const filas = alumnos.map((alumno, i) => [
    i + 1,
    alumno.matricula || 'N/A',
    alumno.nombre,
    ''   // columna observaciones en blanco
  ]);

  doc.autoTable({
    startY: 50,
    head: [['#', 'Matrícula', 'Nombre', 'Observaciones']],
    body: filas,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [106, 33, 53], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12,  halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 70 },
      3: { cellWidth: 60 }
    }
  });

  doc.save(`Lista_${grupo}_${periodoActual}.pdf`);
}

// ═══ NAVEGACIÓN DE PANELES (controlEscolar) ═══

function mostrarPanelEscolar(panel, skipHistory = false) {
  // _togglePanel oculta statsGrid y mainContent al abrir sub-paneles de edición.
  // Al cambiar de tab hay que restaurarlos siempre, independientemente del destino.
  const statsGrid = document.getElementById('statsGrid');
  if (statsGrid) statsGrid.style.display = '';
  const mainContent = document.getElementById('mainContent');
  if (mainContent) mainContent.style.display = '';
  ['editorNombresPanel', 'editorProfesoresPanel', 'editorMateriasPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const paneles = ['alumnos', 'editar', 'aprobar', 'boletaGlobal', 'buscar', 'exAlumnos', 'config'];
  paneles.forEach(p => {
    const el = document.getElementById(`panel${p.charAt(0).toUpperCase() + p.slice(1)}`);
    const btn = document.getElementById(`btnPanel${p.charAt(0).toUpperCase() + p.slice(1)}`);
    if (el) el.classList.toggle('activo', p === panel);
    if (btn) btn.classList.toggle('activo', p === panel);
  });

  if (panel === 'alumnos') {
    const mc = document.getElementById('menuCarreras');
    if (mc) mc.removeAttribute('style');
    document.getElementById('gruposContainer')?.classList.remove('active');
    document.getElementById('listaContainer')?.classList.remove('active');
    carreraSeleccionada = null;
    grupoSeleccionado = null;
  }
  if (panel === 'aprobar') _poblarCarrerasAprobar();
  if (panel === 'buscar') {
    const dummy = document.getElementById('resultadosBuscarGlobal');
    if (dummy) _cargarCacheBuscar(dummy).catch(() => {});
    document.getElementById('inputBuscarGlobal')?.focus();
  }
  if (panel === 'exAlumnos') cargarExAlumnos();
  if (panel === 'boletaGlobal') {
    inicializarBoletaGlobal(null, false, true);
    buscarAlumnoBoletaGlobal();
  }
  if (!skipHistory) {
    history.pushState({ panel, nivel: 'panel' }, '', '#' + panel);
  }
}

function cerrarModal() {
  const m = document.getElementById('modalGenerico');
  if (m) m.style.display = 'none';
}

// ═══ PANEL APROBAR: cargar selector de carreras ═══

function _poblarCarrerasAprobar() {
  const sel = document.getElementById('filtroCarreraAprobar');
  if (!sel || sel.options.length > 1) return;
  [...carrerasData].sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    sel.appendChild(opt);
  });
}

// ═══ PANEL APROBAR: buscar y listar alumnos ═══

async function cargarAlumnosParaAprobar() {
  const carreraId = document.getElementById('filtroCarreraAprobar').value;
  const busqueda  = (document.getElementById('busquedaAprobar').value || '').trim().toLowerCase();
  const contenedor = document.getElementById('resultadoAprobar');

  if (!carreraId) {
    contenedor.innerHTML = '<p style="color:#c00;padding:12px;">Selecciona una carrera primero.</p>';
    return;
  }

  contenedor.innerHTML = '<p style="color:#999;padding:12px;">Buscando...</p>';

  try {
    let query = db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('carreraId', '==', carreraId)
      .where('activo', '==', true);

    const snap = await query.get();
    let alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (busqueda) {
      alumnos = alumnos.filter(a =>
        (a.nombre || '').toLowerCase().includes(busqueda) ||
        (a.matricula || '').toLowerCase().includes(busqueda)
      );
    }

    alumnos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    if (alumnos.length === 0) {
      contenedor.innerHTML = '<p style="color:#999;padding:12px;text-align:center;">No se encontraron alumnos.</p>';
      return;
    }

    let html = `
      <p style="color:#666;font-size:0.85rem;margin-bottom:12px;">${alumnos.length} alumno(s) encontrado(s)</p>
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#6A2135;color:white;">
            <th style="padding:10px 12px;text-align:left;">Nombre</th>
            <th style="padding:10px 12px;text-align:left;">Matrícula</th>
            <th style="padding:10px 12px;text-align:center;">Semestre</th>
            <th style="padding:10px 12px;text-align:left;">Periodo</th>
            <th style="padding:10px 12px;text-align:left;">Grupo</th>
            <th style="padding:10px 12px;text-align:center;">Acción</th>
          </tr>
        </thead>
        <tbody>
    `;

    alumnos.forEach(a => {
      html += `
        <tr style="border-bottom:1px solid #eee;" id="fila-aprobar-${a.id}">
          <td style="padding:10px 12px;">${a.nombre || '-'}</td>
          <td style="padding:10px 12px;">${a.matricula || '-'}</td>
          <td style="padding:10px 12px;text-align:center;">${a.semestreActual || '-'}</td>
          <td style="padding:10px 12px;">${a.periodo || '-'}</td>
          <td style="padding:10px 12px;">${a.codigoGrupo || '-'}</td>
          <td style="padding:10px 12px;text-align:center;">
            <button onclick="avanzarYActualizarFila('${a.id}')"
              style="padding:6px 14px;background:linear-gradient(135deg,#216A32,#4caf50);color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.85rem;">
              Avanzar Periodo
            </button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    contenedor.innerHTML = html;

  } catch (error) {
    console.error('Error al cargar alumnos para aprobar:', error);
    contenedor.innerHTML = `<p style="color:#c00;padding:12px;">Error: ${error.message}</p>`;
  }
}

// Avanza el alumno y actualiza la fila en la tabla sin recargar
async function avanzarYActualizarFila(alumnoId) {
  await avanzarAlumnoIndividual(alumnoId);
  // Refrescar la fila leyendo el nuevo estado
  try {
    const doc = await db.collection('usuarios').doc(alumnoId).get();
    if (!doc.exists) return;
    const a = doc.data();
    const fila = document.getElementById(`fila-aprobar-${alumnoId}`);
    if (!fila) return;
    fila.cells[2].textContent = a.semestreActual || '-';
    fila.cells[3].textContent = a.periodo || '-';
    fila.cells[4].textContent = a.codigoGrupo || '-';
    fila.style.background = '#e8f5e9';
    setTimeout(() => { fila.style.background = ''; }, 2000);
  } catch (_) { /* la tabla se actualizará si el usuario vuelve a buscar */ }
}

// ═══ HISTORIAL DEL NAVEGADOR (popstate) ═══

window.onpopstate = async function(e) {
  if (!e.state) return;
  const { panel, nivel, carreraId, grupo } = e.state;

  if (nivel === 'panel') {
    mostrarPanelEscolar(panel, true);
    if (panel === 'alumnos') _irACarreras();
  } else if (nivel === 'grupos' && carreraId) {
    mostrarPanelEscolar('alumnos', true);
    await seleccionarCarrera(carreraId, true);
  } else if (nivel === 'opciones' && carreraId && grupo) {
    mostrarPanelEscolar('alumnos', true);
    await seleccionarCarrera(carreraId, true);
    seleccionarGrupo(grupo, true);
  }
};

// ═══ PANEL CONFIGURACION: cambio de contrasena ═══

async function cambiarContrasenaEscolar() {
  const actual   = (document.getElementById('cfgPassActual').value  || '').trim();
  const nueva    = (document.getElementById('cfgPassNueva').value   || '').trim();
  const confirma = (document.getElementById('cfgPassConfirm').value || '').trim();
  const msgEl    = document.getElementById('cfgMsgEscolar');
  const btn      = document.getElementById('cfgBtnSubmit');

  msgEl.className = 'cfg-msg';
  msgEl.textContent = '';

  if (!actual || !nueva || !confirma) {
    msgEl.className = 'cfg-msg err';
    msgEl.textContent = 'Completa todos los campos.';
    return;
  }
  if (nueva.length < 6) {
    msgEl.className = 'cfg-msg err';
    msgEl.textContent = 'La nueva contrasena debe tener al menos 6 caracteres.';
    return;
  }
  if (nueva !== confirma) {
    msgEl.className = 'cfg-msg err';
    msgEl.textContent = 'Las contrasenas no coinciden.';
    return;
  }

  btn.textContent = 'Actualizando...';
  btn.disabled = true;
  try {
    const user = firebase.auth().currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, actual);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(nueva);
    msgEl.className = 'cfg-msg ok';
    msgEl.textContent = 'Contrasena actualizada correctamente.';
    document.getElementById('cfgPassActual').value  = '';
    document.getElementById('cfgPassNueva').value   = '';
    document.getElementById('cfgPassConfirm').value = '';
  } catch (e) {
    msgEl.className = 'cfg-msg err';
    msgEl.textContent = (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
      ? 'Contrasena actual incorrecta.'
      : 'Error: ' + e.message;
  } finally {
    btn.textContent = 'Actualizar Contrasena';
    btn.disabled = false;
  }
}

// ── Buscar alumno global (sin filtro de carrera ni activo) ──────────────────
let _carrerasMapBuscar = null;
let _alumnosBuscarCache = null;   // cargado una vez, filtrado en memoria

async function _cargarCacheBuscar(contenedor) {
  if (_alumnosBuscarCache) return true;
  contenedor.innerHTML = '<p style="color:#999;margin-top:0.5rem;">Cargando alumnos...</p>';
  const [carrerasSnap, alumnosSnap] = await Promise.all([
    _carrerasMapBuscar ? null : db.collection('carreras').get(),
    db.collection('usuarios').where('rol', '==', 'alumno').get()
  ]);
  if (carrerasSnap) {
    _carrerasMapBuscar = {};
    carrerasSnap.docs.forEach(d => { _carrerasMapBuscar[d.id] = d.data().nombre || d.id; });
  }
  _alumnosBuscarCache = alumnosSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  return true;
}

function _renderBuscarResultados(busqueda) {
  const contenedor = document.getElementById('resultadosBuscarGlobal');
  if (!contenedor || !_alumnosBuscarCache) return;

  if (!busqueda) {
    contenedor.innerHTML = '<p style="color:#999;margin-top:0.5rem;">Escribe un nombre o matrícula para buscar.</p>';
    return;
  }

  const alumnos = _alumnosBuscarCache.filter(a => {
    const n = (a.nombre || '').toLowerCase();
    const m = (a.matricula || '').toLowerCase();
    return n.includes(busqueda) || m.includes(busqueda);
  });

  if (alumnos.length === 0) {
    contenedor.innerHTML = '<p style="color:#999;margin-top:0.5rem;">No se encontraron alumnos.</p>';
    return;
  }

  const rows = alumnos.map(a => {
    const inactivo  = a.activo === false;
    const _nomSafe  = (a.nombre || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const badge = inactivo
      ? ' <span style="background:#dc3545;color:white;padding:1px 7px;border-radius:10px;font-size:0.72rem;font-weight:700;vertical-align:middle;margin-left:4px;">INACTIVO</span>'
      : '';
    const rowBg = inactivo ? 'background:#fff5f5;' : '';
    const carreraNombre = _carrerasMapBuscar[a.carreraId] || a.carreraId || '—';
    const btnColor = inactivo ? '#4caf50' : '#dc3545';
    const btnLabel = inactivo ? 'Activar' : 'Desactivar';
    return `<tr style="${rowBg}">
      <td>${a.nombre || '—'}${badge}</td>
      <td>${a.matricula || '—'}</td>
      <td>${carreraNombre}</td>
      <td style="white-space:nowrap;">
        <button class="btn-accion" onclick="verBoletaGlobalAlumno('${a.id}', false)">Ver Boleta</button>
        <button onclick="toggleActivoAlumno('${a.id}', '${_nomSafe}', ${inactivo}, 'buscar')"
          style="background:${btnColor};color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;margin-left:4px;">
          ${btnLabel}
        </button>
      </td>
    </tr>`;
  }).join('');

  contenedor.innerHTML = `
    <table class="tabla-alumnos">
      <thead><tr><th>Nombre</th><th>Matrícula</th><th>Carrera</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#999;font-size:0.85rem;margin-top:0.5rem;">${alumnos.length} resultado(s)</p>`;
}

// ── Ex Alumnos ───────────────────────────────────────────────────────────────
let _exAlumnosCache     = null;
let _carrerasMapExAlumnos = null;

async function cargarExAlumnos() {
  const contenedor = document.getElementById('resultadosExAlumnos');
  if (!contenedor) return;

  if (!_exAlumnosCache) {
    contenedor.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Cargando ex alumnos...</p>';
    try {
      const [carrerasSnap, alumnosSnap] = await Promise.all([
        _carrerasMapExAlumnos
          ? Promise.resolve(null)
          : db.collection('carreras').get(),
        db.collection('usuarios')
          .where('rol', '==', 'alumno')
          .where('activo', '==', false)
          .get()
      ]);
      if (carrerasSnap) {
        _carrerasMapExAlumnos = {};
        carrerasSnap.docs.forEach(d => { _carrerasMapExAlumnos[d.id] = d.data().nombre || d.id; });
      }
      _exAlumnosCache = alumnosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (e) {
      contenedor.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">Error al cargar: ${e.message}</p>`;
      return;
    }
  }
  filtrarExAlumnos();
}

function filtrarExAlumnos() {
  const busqueda = (document.getElementById('inputBuscarExAlumno')?.value || '').trim().toLowerCase();
  _renderExAlumnos(busqueda);
}

function _renderExAlumnos(busqueda) {
  const contenedor = document.getElementById('resultadosExAlumnos');
  if (!contenedor || !_exAlumnosCache) return;

  let alumnos = _exAlumnosCache;
  if (busqueda) {
    alumnos = alumnos.filter(a =>
      (a.nombre   || '').toLowerCase().includes(busqueda) ||
      (a.matricula|| '').toLowerCase().includes(busqueda)
    );
  }

  if (alumnos.length === 0) {
    contenedor.innerHTML = busqueda
      ? '<p style="color:#999;text-align:center;padding:20px;">No se encontraron ex alumnos con ese criterio.</p>'
      : '<p style="color:#999;text-align:center;padding:20px;">No hay ex alumnos registrados.</p>';
    return;
  }

  const rows = alumnos.map(a => {
    const _nomSafe     = (a.nombre || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const esGraduado   = a.graduado === true;
    const badge = esGraduado
      ? ' <span style="background:#4caf50;color:white;padding:1px 7px;border-radius:10px;font-size:0.72rem;font-weight:700;vertical-align:middle;margin-left:4px;">GRADUADO</span>'
      : ' <span style="background:#757575;color:white;padding:1px 7px;border-radius:10px;font-size:0.72rem;font-weight:700;vertical-align:middle;margin-left:4px;">BAJA</span>';
    const carreraNombre = (_carrerasMapExAlumnos || {})[a.carreraId] || a.carreraId || '—';
    return `<tr>
      <td>${a.nombre || '—'}${badge}</td>
      <td>${a.matricula || '—'}</td>
      <td>${carreraNombre}</td>
      <td style="white-space:nowrap;">
        <button class="btn-accion" onclick="verHistorialCompleto('${a.id}', '${_nomSafe}')">Ver Historial</button>
        <button onclick="toggleActivoAlumno('${a.id}', '${_nomSafe}', true, 'exAlumnos')"
          style="background:#4caf50;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;margin-left:4px;">
          Reactivar
        </button>
      </td>
    </tr>`;
  }).join('');

  contenedor.innerHTML = `
    <table class="tabla-alumnos">
      <thead><tr><th>Nombre</th><th>Matrícula</th><th>Carrera</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#999;font-size:0.85rem;margin-top:0.5rem;">${alumnos.length} resultado(s)</p>`;
}

// ── Activar / Desactivar alumno ──────────────────────────────────────────────
async function toggleActivoAlumno(uid, nombre, nuevoEstado, contexto) {
  const accion = nuevoEstado ? 'activar' : 'desactivar';
  if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} al alumno "${nombre}"?`)) return;
  try {
    await db.collection('usuarios').doc(uid).update({ activo: nuevoEstado });
    // Invalidar caché de búsqueda y ex-alumnos para que el siguiente acceso recargue
    _alumnosBuscarCache = null;
    _exAlumnosCache     = null;
    await cargarAlumnos();
    actualizarEstadisticas();
    if (contexto === 'buscar') {
      await buscarAlumnoGlobal();
    } else if (contexto === 'exAlumnos') {
      await cargarExAlumnos();
    } else {
      verAlumnosGrupo();
    }
  } catch (e) {
    console.error(e);
    alert('Error al actualizar estado del alumno.');
  }
}

async function buscarAlumnoGlobal() {
  const input = document.getElementById('inputBuscarGlobal');
  const busqueda = (input?.value || '').trim().toLowerCase();
  const contenedor = document.getElementById('resultadosBuscarGlobal');
  if (!contenedor) return;

  try {
    await _cargarCacheBuscar(contenedor);
    _renderBuscarResultados(busqueda);
  } catch (e) {
    contenedor.innerHTML = `<p style="color:#dc3545;margin-top:0.5rem;">Error al buscar: ${e.message}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTA HISTÓRICA — generar actas de periodos pasados
// Fuente de datos: historialCalificaciones (archivado por cambioPeriodo.js)
// ═══════════════════════════════════════════════════════════════════════════

async function verActaHistorica() {
  const grupo = grupoSeleccionado.codigoGrupo;
  mostrarLista(`<h2 class="titulo-seccion">Acta Histórica — ${grupo}</h2>
    <p style="color:#999;text-align:center;padding:30px;">Cargando periodos disponibles...</p>`);

  try {
    const snap = await db.collection('historialCalificaciones')
      .where('codigoGrupo', '==', grupo)
      .get();

    if (snap.empty) {
      mostrarLista(`<h2 class="titulo-seccion">Acta Histórica — ${grupo}</h2>
        <p style="color:#888;text-align:center;padding:30px;">
          No hay periodos archivados para el grupo <strong>${grupo}</strong>.
        </p>`);
      return;
    }

    const periodosSet = new Set();
    snap.forEach(doc => { const p = doc.data().periodo; if (p) periodosSet.add(p); });
    const periodos = [...periodosSet].sort().reverse();

    const botonesHtml = periodos.map(p =>
      `<button onclick="cargarMateriasHistoricas('${p}')"
               class="btn-accion" style="background:#dc3545;min-width:120px;font-size:1rem;">
         ${p}
       </button>`
    ).join('');

    mostrarLista(`
      <h2 class="titulo-seccion">Acta Histórica — ${grupo}</h2>
      <div class="herramienta-card" style="border-color:#dc3545;max-width:600px;">
        <h3 style="color:#dc3545;margin:0 0 14px;">Selecciona un periodo</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">${botonesHtml}</div>
      </div>`);

  } catch (error) {
    console.error('Error en verActaHistorica:', error);
    mostrarLista(`<h2 class="titulo-seccion">Acta Histórica — ${grupo}</h2>
      <p style="color:#c00;text-align:center;padding:20px;">Error: ${error.message}</p>`);
  }
}

async function cargarMateriasHistoricas(periodo) {
  const grupo = grupoSeleccionado.codigoGrupo;
  mostrarLista(`<h2 class="titulo-seccion">Acta Histórica — ${grupo} / ${periodo}</h2>
    <p style="color:#999;text-align:center;padding:30px;">Cargando materias...</p>`);

  const backBtn = `<button onclick="verActaHistorica()" class="btn-accion"
    style="background:#888;margin-bottom:18px;">← Cambiar Periodo</button>`;

  try {
    const snap = await db.collection('historialCalificaciones')
      .where('codigoGrupo', '==', grupo)
      .where('periodo', '==', periodo)
      .get();

    if (snap.empty) {
      mostrarLista(`<h2 class="titulo-seccion">Acta Histórica — ${grupo} / ${periodo}</h2>
        ${backBtn}
        <p style="color:#888;font-size:0.9rem;">No se encontraron calificaciones archivadas para este periodo.</p>`);
      return;
    }

    const materiasMap = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (d.materiaId && !materiasMap[d.materiaId])
        materiasMap[d.materiaId] = d.materiaNombre || d.materiaId;
    });

    const materias = Object.entries(materiasMap)
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    let html = `
      <h2 class="titulo-seccion">Acta Histórica — ${grupo} / ${periodo}</h2>
      ${backBtn}
      <p style="color:#555;font-size:0.85rem;margin-bottom:12px;">
        <strong>${materias.length}</strong> materia(s) archivadas en el periodo <strong>${periodo}</strong>:
      </p>
      <table>
        <thead><tr><th>Materia</th><th style="text-align:center;">Acción</th></tr></thead>
        <tbody>`;

    materias.forEach(m => {
      const nomEsc = (m.nombre || '').replace(/'/g, "\\'");
      html += `<tr>
        <td>${m.nombre}</td>
        <td style="text-align:center;">
          <button onclick="verAlumnosActaHistorica('${m.id}','${nomEsc}','${grupo}','${periodo}')"
            class="btn-accion" style="background:#dc3545;white-space:nowrap;">
            Ver Alumnos / PDF
          </button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    mostrarLista(html);

  } catch (error) {
    console.error('Error en cargarMateriasHistoricas:', error);
    mostrarLista(`<h2 class="titulo-seccion">Acta Histórica — ${grupo}</h2>
      ${backBtn}
      <p style="color:#c00;font-size:0.9rem;">Error: ${error.message}</p>`);
  }
}

async function verAlumnosActaHistorica(materiaId, materiaNombre, codigoGrupo, periodo) {
  try {
    const snap = await db.collection('historialCalificaciones')
      .where('materiaId', '==', materiaId)
      .where('codigoGrupo', '==', codigoGrupo)
      .where('periodo', '==', periodo)
      .get();

    if (snap.empty) {
      alert('No se encontraron alumnos archivados para esta materia en el periodo seleccionado.');
      return;
    }

    const alumnosEnMateria = snap.docs.map(doc => {
      const d = doc.data();
      const alumnoLocal = alumnosData.find(a => a.uid === d.alumnoId);
      return {
        uid:            d.alumnoId,
        nombre:         d.alumnoNombre || '—',
        matricula:      alumnoLocal?.matricula || null,
        codigoGrupo:    d.codigoGrupo,
        periodo:        d.periodo,
        parcial1:       d.parciales?.parcial1 ?? null,
        parcial2:       d.parciales?.parcial2 ?? null,
        parcial3:       d.parciales?.parcial3 ?? null,
        extraordinario: d.extraordinario ?? null
      };
    });

    const sinMatricula = alumnosEnMateria.filter(a => !a.matricula);
    if (sinMatricula.length > 0) {
      await Promise.all(sinMatricula.map(async alumno => {
        try {
          const userDoc = await db.collection('usuarios').doc(alumno.uid).get();
          if (userDoc.exists) alumno.matricula = userDoc.data().matricula || null;
        } catch (_) {}
      }));
    }

    alumnosEnMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));

    window._actaAlumnosData   = alumnosEnMateria;
    window._actaMateriaId     = materiaId;
    window._actaMateriaNombre = materiaNombre;

    const toNum = v => (v !== null && v !== undefined && v !== 'NP') ? parseFloat(v) : (v === 'NP' ? 'NP' : null);
    const backBtn = `<button onclick="cargarMateriasHistoricas('${periodo}')" class="btn-accion"
      style="background:#888;margin-bottom:18px;">← Volver a Materias</button>`;

    let html = `
      <h2 class="titulo-seccion">${materiaNombre}</h2>
      ${backBtn}
      <p style="color:#666;margin-bottom:6px;">
        Periodo: <strong>${periodo}</strong> &nbsp;|&nbsp; Grupo: <strong>${codigoGrupo}</strong>
      </p>
      <p style="color:#666;margin-bottom:18px;">Total: <strong>${alumnosEnMateria.length}</strong> alumnos</p>
      <div style="margin-bottom:18px;">
        <button onclick="descargarActaMateria(window._actaMateriaId, window._actaMateriaNombre, window._actaAlumnosData)"
                class="opcion-btn" style="background:#dc3545;">
          Descargar Acta de Calificaciones (PDF)
        </button>
      </div>
      <table>
        <thead><tr>
          <th>Matrícula</th><th>Nombre</th>
          <th style="text-align:center;">P1</th>
          <th style="text-align:center;">P2</th>
          <th style="text-align:center;">P3</th>
          <th style="text-align:center;">Cal</th>
        </tr></thead>
        <tbody>`;

    alumnosEnMateria.forEach(alumno => {
      const { parcial1: p1, parcial2: p2, parcial3: p3 } = alumno;
      const calNum = calcularCalificacion(toNum(p1), toNum(p2), toNum(p3), false);
      const calStr = calNum === 'NP' ? 'NP' : calNum !== null ? String(redondearCalificacion(calNum)) : '-';
      const color  = calStr === 'NP' || esReprobado(parseFloat(calStr), false) ? '#f44336'
        : calStr === '-' ? '#555' : '#4caf50';

      html += `<tr>
        <td><strong>${alumno.matricula || 'N/A'}</strong></td>
        <td>${alumno.nombre}</td>
        <td style="text-align:center;">${p1 !== null ? p1 : '-'}</td>
        <td style="text-align:center;">${p2 !== null ? p2 : '-'}</td>
        <td style="text-align:center;">${p3 !== null ? p3 : '-'}</td>
        <td style="text-align:center;font-weight:bold;font-size:1.1rem;color:${color};">${calStr}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    mostrarLista(html);

  } catch (error) {
    console.error('Error al cargar acta histórica:', error);
    alert('Error al cargar alumnos: ' + error.message);
  }
}