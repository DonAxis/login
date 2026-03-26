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
    await Promise.all([
      cargarCarreras(),
      cargarAlumnos(),
      cargarMaterias()
    ]);

    actualizarEstadisticas();
    mostrarCarreras();

  } catch (error) {
    console.error('Error al inicializar:', error);
  }
}

async function cargarPeriodoActual() {
  try {
    const configDoc = await db.collection('config').doc('periodoActual').get();
    
    if (configDoc.exists) {
      periodoActual = configDoc.data().periodo;
    }
    
    document.getElementById('periodoActual').textContent = periodoActual;
  } catch (error) {
    console.error('Error al cargar periodo:', error);
  }
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
async function seleccionarCarrera(carreraId) {
  carreraSeleccionada = carrerasData.find(c => c.id === carreraId);
  if (!carreraSeleccionada) return;

  document.getElementById('menuCarreras').style.display = 'none';
  grupoSeleccionado = null;
  mostrarGruposCarrera();
}

function mostrarGruposCarrera() {
  document.getElementById('gruposContainer').classList.add('active');

  // Derivar grupos únicos del campo codigoGrupo de alumnosData
  const alumnosCarrera = alumnosData.filter(a =>
    a.carreraId === carreraSeleccionada.id && a.tipoAlumno !== 'especial' && a.codigoGrupo
  );

  const gruposUnicos = [...new Set(alumnosCarrera.map(a => a.codigoGrupo))].sort();

  let html = `<div style="grid-column:1/-1; margin-bottom:10px;">
    <h2 class="titulo-seccion">${carreraSeleccionada.nombre}</h2>
    <p style="color:#666;">Selecciona un grupo</p>
  </div>`;

  if (gruposUnicos.length === 0) {
    html += '<div style="grid-column:1/-1;" class="sin-datos">No hay grupos con alumnos en esta carrera</div>';
  } else {
    gruposUnicos.forEach(codigo => {
      const total = alumnosCarrera.filter(a => a.codigoGrupo === codigo).length;
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
        <p>Alumnos sin grupo fijo</p>
      </div>`;
  }

  document.getElementById('gruposGrid').innerHTML = html;
}

// ===== SELECCIONAR GRUPO → muestra opciones =====
function seleccionarGrupo(codigoGrupo) {
  grupoSeleccionado = { codigoGrupo };

  const totalAlumnos = alumnosData.filter(a => a.codigoGrupo === codigoGrupo && a.tipoAlumno !== 'especial').length;

  const html = `
    <div style="grid-column:1/-1; margin-bottom:10px;">
      <button onclick="mostrarGruposCarrera()" class="btn-volver" style="margin-bottom:10px;">← Grupos</button>
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

    </div>`;

  document.getElementById('gruposGrid').innerHTML = html;
}

// ===== VER ALUMNOS DEL GRUPO =====
function verAlumnosGrupo() {
  const alumnos = alumnosData
    .filter(a => a.codigoGrupo === grupoSeleccionado.codigoGrupo && a.tipoAlumno !== 'especial')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (alumnos.length === 0) {
    mostrarLista(`<h2 class="titulo-seccion">Alumnos — ${grupoSeleccionado.codigoGrupo}</h2>
      <div class="sin-datos">No hay alumnos en este grupo</div>`);
    return;
  }

  let html = `
    <h2 class="titulo-seccion">Alumnos — ${grupoSeleccionado.codigoGrupo}</h2>
    <p style="margin-bottom:20px; color:#666;">Total: ${alumnos.length} alumnos</p>
    <table>
      <thead><tr>
        <th>Matrícula</th><th>Nombre</th><th>Periodo</th><th>Acciones</th>
      </tr></thead>
      <tbody>`;

  alumnos.forEach(alumno => {
    html += `<tr>
      <td><strong>${alumno.matricula || 'N/A'}</strong></td>
      <td>${alumno.nombre}</td>
      <td>${alumno.periodo || periodoActual}</td>
      <td><button onclick="verHistorialCompleto('${alumno.uid}', '${alumno.nombre.replace(/'/g, "\\'")}')">Ver Historial</button></td>
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
          prom = '5.0';
        } else {
          const vals = [p1, p2, p3].filter(v => v !== '-' && v !== null && v !== undefined).map(Number).filter(n => !isNaN(n));
          if (vals.length > 0) prom = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
        }
        const color = prom === '-' ? '#666' : parseFloat(prom) >= 8 ? '#4caf50' : parseFloat(prom) >= 6 ? '#ff9800' : '#f44336';
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
        <td><button onclick="verAlumnosEnMateria('${d.materiaId}', '${(d.materiaNombre || '').replace(/'/g, "\\'")}')">Ver Alumnos</button></td>
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
          prom = '5.0';
        } else {
          const vals = [p1, p2, p3].filter(v => v !== '-' && v !== null && v !== undefined).map(Number).filter(n => !isNaN(n));
          if (vals.length > 0) prom = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
        }
        const color = prom === '-' ? '#333' : parseFloat(prom) >= 8 ? '#4caf50' : parseFloat(prom) >= 6 ? '#ff9800' : '#f44336';
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
async function verAlumnosEnMateria(materiaId, nombreMateria) {
  console.log('Cargando alumnos de materia:', nombreMateria);

  await cargarAlumnosSiNecesario();

  try {
    // Buscar calificaciones de esta materia
    const calificacionesSnap = await db.collection('calificaciones')
      .where('materiaId', '==', materiaId)
      .get();
    
    if (calificacionesSnap.empty) {
      mostrarLista(`
        <h2 class="titulo-seccion">Alumnos en ${nombreMateria}</h2>
        <div class="sin-datos">El profesor aún no ha subido calificaciones</div>
      `);
      return;
    }
    
    // Obtener datos de alumnos
    const alumnosEnMateria = [];
    
    for (const doc of calificacionesSnap.docs) {
      const cal = doc.data();
      const alumno = alumnosData.find(a => a.uid === cal.alumnoId);
      
      if (alumno) {
        alumnosEnMateria.push({
          ...alumno,
          parcial1: cal.parciales?.parcial1 ?? '-',
          parcial2: cal.parciales?.parcial2 ?? '-',
          parcial3: cal.parciales?.parcial3 ?? '-',
          periodo: cal.periodo
        });
      }
    }
    
    // Ordenar por nombre
    alumnosEnMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
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
        promedio = '5.0';
      } else {
        const cals = [p1, p2, p3]
          .filter(c => c !== '-' && c !== null && c !== undefined && c !== '')
          .map(c => parseFloat(c))
          .filter(c => !isNaN(c));
        
        if (cals.length > 0) {
          promedio = (cals.reduce((a, b) => a + b, 0) / cals.length).toFixed(1);
        }
      }
      
      // Color del promedio
      let colorPromedio = '#333';
      if (promedio !== '-') {
        const prom = parseFloat(promedio);
        if (prom >= 8) colorPromedio = '#4caf50';
        else if (prom >= 6) colorPromedio = '#ff9800';
        else colorPromedio = '#f44336';
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
  sessionStorage.setItem('historialAlumnoId', alumnoId);
  sessionStorage.setItem('historialAlumnoNombre', nombreAlumno);
  window.open('historialAlumno.html', '_blank');
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
          promedio = '5.0';
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
          const prom = parseFloat(promedio);
          if (prom >= 8) colorPromedio = '#4caf50';
          else if (prom >= 6) colorPromedio = '#ff9800';
          else colorPromedio = '#f44336';
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
  document.getElementById('gruposContainer').classList.remove('active');
  document.getElementById('listaContainer').classList.remove('active');
  document.getElementById('menuCarreras').removeAttribute('style');
  document.getElementById('gruposGrid').innerHTML = '';
  carreraSeleccionada = null;
  grupoSeleccionado = null;
  listaHistorial = [];
}

function volverGrupos() {
  if (listaHistorial.length > 0) {
    document.getElementById('listaContenido').innerHTML = listaHistorial.pop();
    return;
  }
  document.getElementById('listaContainer').classList.remove('active');
  document.getElementById('gruposContainer').classList.add('active');
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
            <th>Email</th>
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
        inscripcion.promedio = (cals.reduce((a, b) => a + b, 0) / cals.length).toFixed(1);
      } else if (inscripcion.parcial1 === 'NP' || inscripcion.parcial2 === 'NP' || inscripcion.parcial3 === 'NP') {
        inscripcion.promedio = '5.0';
      } else {
        inscripcion.promedio = '-';
      }
      
      inscripciones.push(inscripcion);
    }
    
    // Ordenar por materia
    inscripciones.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre));
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Detalle Alumno Especial</h2>
      
      <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #ff9800;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
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

const CARRERAS_OCULTAS = ['DE', 'PRUEBA'];

// ===== EDITAR NOMBRES DE ALUMNOS =====
function abrirEditorNombres() {
  const panel    = document.getElementById('editorNombresPanel');
  const statsGrid = document.getElementById('statsGrid');
  const content  = document.getElementById('mainContent');
  const visible  = panel.style.display !== 'none';

  panel.style.display    = visible ? 'none' : 'block';
  statsGrid.style.display = visible ? ''     : 'none';
  content.style.display  = visible ? ''     : 'none';

  if (!visible) poblarFiltrosEdicion();
}

function poblarFiltrosEdicion() {
  const sel = document.getElementById('filtroCarreraEdicion');
  sel.innerHTML = '<option value="">-- Selecciona Carrera --</option>';
  [...carrerasData]
    .filter(c => !CARRERAS_OCULTAS.includes(c.codigo))
    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
    .forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.codigo} — ${c.nombre}</option>`;
    });
}

function filtrarAlumnosEdicion() {
  const carreraId = document.getElementById('filtroCarreraEdicion').value;
  const periodo   = document.getElementById('filtroPeriodoEdicion').value;

  if (!carreraId) { alert('Selecciona una carrera'); return; }

  let filtrados = alumnosData.filter(a => a.carreraId === carreraId);

  if (periodo === 'especial') {
    filtrados = filtrados.filter(a => a.grupoId === null || a.grupoId === undefined || a.grupoId === '');
  } else if (periodo) {
    filtrados = filtrados.filter(a => String(a.periodo) === String(periodo));
  }

  filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const resultado = document.getElementById('resultadoEdicionNombres');

  if (filtrados.length === 0) {
    resultado.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">No se encontraron alumnos con esos filtros</p>';
    return;
  }

  let html = `<p style="margin-bottom:10px; color:#666;">${filtrados.length} alumnos encontrados</p>
  <table>
    <thead><tr>
      <th>Matrícula</th><th>Grupo</th><th>Nombre Actual</th><th>Nuevo Nombre</th><th></th>
    </tr></thead>
    <tbody>`;

  filtrados.forEach(alumno => {
    const nombreEsc = (alumno.nombre || '').replace(/"/g, '&quot;');
    html += `<tr>
      <td><strong>${alumno.matricula || 'N/A'}</strong></td>
      <td>${alumno.codigoGrupo || ''}</td>
      <td id="nombreActual_${alumno.uid}">${alumno.nombre}</td>
      <td><input type="text" id="inputNombre_${alumno.uid}" value="${nombreEsc}"
           style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></td>
      <td><button onclick="guardarNombreAlumno('${alumno.uid}')"
           class="btn-accion" style="white-space:nowrap;">Guardar</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  resultado.innerHTML = html;
}

async function guardarNombreAlumno(uid) {
  const input = document.getElementById('inputNombre_' + uid);
  const nuevoNombre = input.value.trim();

  if (!nuevoNombre) { alert('El nombre no puede estar vacío'); return; }

  const btn = input.closest('tr').querySelector('button');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    // Buscar todos los documentos que referencian al alumno
    const [califs, inscEsp, reportes] = await Promise.all([
      db.collection('calificaciones').where('alumnoId', '==', uid).get(),
      db.collection('inscripcionesEspeciales').where('alumnoId', '==', uid).get(),
      db.collection('reportesPrefecto').where('alumnoId', '==', uid).get()
    ]);

    // Firestore batch tiene límite de 500 ops; usamos múltiples batches si hace falta
    const todasOps = [];

    // usuarios
    todasOps.push({ ref: db.collection('usuarios').doc(uid), data: { nombre: nuevoNombre } });

    califs.forEach(doc => {
      todasOps.push({ ref: doc.ref, data: { alumnoNombre: nuevoNombre } });
    });
    inscEsp.forEach(doc => {
      todasOps.push({ ref: doc.ref, data: { alumnoNombre: nuevoNombre } });
    });
    reportes.forEach(doc => {
      todasOps.push({ ref: doc.ref, data: { alumnoNombre: nuevoNombre } });
    });

    // Ejecutar en batches de 499
    const CHUNK = 499;
    for (let i = 0; i < todasOps.length; i += CHUNK) {
      const batch = db.batch();
      todasOps.slice(i, i + CHUNK).forEach(op => batch.update(op.ref, op.data));
      await batch.commit();
    }

    // Actualizar memoria local
    const alumno = alumnosData.find(a => a.uid === uid);
    if (alumno) alumno.nombre = nuevoNombre;

    const celdaActual = document.getElementById('nombreActual_' + uid);
    if (celdaActual) celdaActual.textContent = nuevoNombre;

    input.style.background = '#e8f5e9';
    setTimeout(() => { input.style.background = ''; }, 2000);

    const total = califs.size + inscEsp.size + reportes.size;
    console.log(`Nombre actualizado en usuarios + ${califs.size} calificaciones + ${inscEsp.size} inscripcionesEspeciales + ${reportes.size} reportesPrefecto`);

  } catch (error) {
    console.error('Error al guardar nombre:', error);
    alert('Error al guardar el nombre: ' + error.message);
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}