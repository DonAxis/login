// controlEscolar.js - Rediseñado
const auth = firebase.auth();
let usuarioActual = null;
let carrerasData = [];
let gruposData = [];
let materiasData = [];
let alumnosData = [];
let carreraSeleccionada = null;
let grupoSeleccionado = null;
let periodoActual = '2026-1';

// Proteccion de pagina
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    //alert('Debes iniciar sesion para acceder');
    window.location.href = 'login.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists || userDoc.data().rol !== 'controlEscolar') {
      alert('Solo personal de Control Escolar puede acceder');
      window.location.href = 'login.html';
      return;
    }

    usuarioActual = userDoc.data();
    usuarioActual.uid = user.uid;
    
    document.getElementById('nombreUsuario').textContent = usuarioActual.nombre;
    
    await inicializar();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = 'login.html';
  }
});

async function cerrarSesion() {
  if (confirm('Cerrar sesion?')) {
    try {
      await auth.signOut();
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cerrar sesion');
    }
  }
}

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
      .where('activa', '==', true)
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

function mostrarCarreras() {
  const container = document.getElementById('menuCarreras');
  
  if (carrerasData.length === 0) {
    container.innerHTML = '<div class="sin-datos">No hay carreras registradas</div>';
    return;
  }
  
  let html = '';
  carrerasData.forEach(carrera => {
    html += `
      <div class="carrera-card" onclick="seleccionarCarrera('${carrera.id}')">
        <h3>${carrera.nombre}</h3>
        <p>Codigo: ${carrera.codigo}</p>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

async function seleccionarCarrera(carreraId) {
  carreraSeleccionada = carrerasData.find(c => c.id === carreraId);
  
  if (!carreraSeleccionada) return;
  
  console.log('Carrera seleccionada:', carreraSeleccionada.nombre);
  
  // Cargar grupos de esta carrera
  try {
    const snapshot = await db.collection('grupos')
      .where('carreraId', '==', carreraId)
      .where('activo', '==', true)
      .get();
    
    gruposData = [];
    snapshot.forEach(doc => {
      gruposData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por nombre en JavaScript
    gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    mostrarGrupos();
    
  } catch (error) {
    console.error('Error al cargar grupos:', error);
    alert('Error al cargar grupos');
  }
}

function mostrarGrupos() {
  const container = document.getElementById('gruposGrid');
  const gruposContainer = document.getElementById('gruposContainer');
  
  gruposContainer.classList.add('active');
  document.getElementById('menuCarreras').style.display = 'none';
  
  if (gruposData.length === 0) {
    container.innerHTML = '<div class="sin-datos">No hay grupos en esta carrera</div>';
    return;
  }
  
  let html = '';
  gruposData.forEach(grupo => {
    html += `
      <div class="grupo-card" onclick="seleccionarGrupo('${grupo.id}')">
        ${grupo.nombre}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function seleccionarGrupo(grupoId) {
  grupoSeleccionado = gruposData.find(g => g.id === grupoId);
  
  if (!grupoSeleccionado) return;
  
  console.log('Grupo seleccionado:', grupoSeleccionado.nombre);
  
  // Remover seleccion anterior
  document.querySelectorAll('.grupo-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Marcar como seleccionado
  event.target.classList.add('selected');
  
  // Mostrar opciones
  document.getElementById('opcionesContainer').classList.add('active');
}

async function verAlumnos() {
  if (!grupoSeleccionado) return;
  
  console.log('Cargando alumnos del grupo:', grupoSeleccionado.nombre);
  
  const alumnosGrupo = alumnosData.filter(a => a.grupoId === grupoSeleccionado.id);
  
  if (alumnosGrupo.length === 0) {
    mostrarLista('<div class="sin-datos">No hay alumnos en este grupo</div>');
    return;
  }
  
  let html = '<h2 class="titulo-seccion">Alumnos del Grupo ' + grupoSeleccionado.nombre + '</h2>';
  html += '<table><thead><tr>';
  html += '<th>Matricula</th>';
  html += '<th>Nombre</th>';
  html += '<th>Semestre</th>';
  html += '<th>Acciones</th>';
  html += '</tr></thead><tbody>';
  
  alumnosGrupo.forEach(alumno => {
    html += '<tr>';
    html += '<td><strong>' + (alumno.matricula || 'N/A') + '</strong></td>';
    html += '<td>' + alumno.nombre + '</td>';
    html += '<td>' + (alumno.semestreActual || 'N/A') + '</td>';
    html += '<td>';
    html += '<button onclick="verCalificacionesAlumno(\'' + alumno.uid + '\', \'' + alumno.nombre + '\')" class="btn-accion">Ver Calificaciones</button>';
    html += '</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  
  mostrarLista(html);
}

async function verMaterias() {
  if (!grupoSeleccionado) return;
  
  console.log('Cargando materias del grupo:', grupoSeleccionado.nombre);
  
  // Buscar asignaciones de materias para este grupo
  try {
    const snapshot = await db.collection('profesorMaterias')
      .where('grupoId', '==', grupoSeleccionado.id)
      .where('periodo', '==', periodoActual)
      .where('activa', '==', true)
      .get();
    
    if (snapshot.empty) {
      mostrarLista('<div class="sin-datos">No hay materias asignadas a este grupo</div>');
      return;
    }
    
    let html = '<h2 class="titulo-seccion">Materias del Grupo ' + grupoSeleccionado.nombre + '</h2>';
    html += '<table><thead><tr>';
    html += '<th>Codigo</th>';
    html += '<th>Materia</th>';
    html += '<th>Profesor</th>';
    html += '<th>Acciones</th>';
    html += '</tr></thead><tbody>';
    
    snapshot.forEach(doc => {
      const asignacion = doc.data();
      html += '<tr>';
      html += '<td><strong>' + (asignacion.materiaCodigo || 'N/A') + '</strong></td>';
      html += '<td>' + asignacion.materiaNombre + '</td>';
      html += '<td>' + asignacion.profesorNombre + '</td>';
      html += '<td>';
      html += '<button onclick="verCalificacionesMateria(\'' + asignacion.materiaId + '\', \'' + asignacion.materiaNombre + '\')" class="btn-accion">Ver Calificaciones</button>';
      html += '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar materias:', error);
    alert('Error al cargar materias');
  }
}

async function verCalificacionesAlumno(alumnoId, nombreAlumno) {
  console.log('Cargando calificaciones del alumno:', nombreAlumno);
  
  try {
    const snapshot = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .where('grupoId', '==', grupoSeleccionado.id)
      .where('periodo', '==', periodoActual)
      .get();
    
    if (snapshot.empty) {
      alert('Este alumno no tiene calificaciones registradas en este grupo');
      return;
    }
    
    let html = '<h2 class="titulo-seccion">Calificaciones de ' + nombreAlumno + '</h2>';
    html += '<p style="margin-bottom: 20px;">Grupo: ' + grupoSeleccionado.nombre + ' - Periodo: ' + periodoActual + '</p>';
    html += '<table><thead><tr>';
    html += '<th>Materia</th>';
    html += '<th>Parcial 1</th>';
    html += '<th>Parcial 2</th>';
    html += '<th>Parcial 3</th>';
    html += '<th>Promedio</th>';
    html += '<th>Estado</th>';
    html += '</tr></thead><tbody>';
    
    snapshot.forEach(doc => {
      const cal = doc.data();
      const p1 = cal.parciales?.parcial1 || '-';
      const p2 = cal.parciales?.parcial2 || '-';
      const p3 = cal.parciales?.parcial3 || '-';
      const promedio = calcularPromedio(p1, p2, p3);
      const estado = obtenerEstado(promedio, p1, p2, p3);
      
      html += '<tr>';
      html += '<td>' + (cal.materiaNombre || 'N/A') + '</td>';
      html += '<td>' + p1 + '</td>';
      html += '<td>' + p2 + '</td>';
      html += '<td>' + p3 + '</td>';
      html += '<td><strong>' + promedio + '</strong></td>';
      html += '<td>' + estado + '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '<div style="margin-top: 20px;">';
    html += '<button onclick="imprimirHistorialAlumno(\'' + alumnoId + '\', \'' + nombreAlumno + '\')" class="opcion-btn">Imprimir Historial Completo</button>';
    html += '</div>';
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar calificaciones');
  }
}

async function verCalificacionesMateria(materiaId, nombreMateria) {
  console.log('Cargando calificaciones de la materia:', nombreMateria);
  
  try {
    const snapshot = await db.collection('calificaciones')
      .where('materiaId', '==', materiaId)
      .where('grupoId', '==', grupoSeleccionado.id)
      .where('periodo', '==', periodoActual)
      .get();
    
    if (snapshot.empty) {
      alert('No hay calificaciones registradas para esta materia');
      return;
    }
    
    let html = '<h2 class="titulo-seccion">Calificaciones de ' + nombreMateria + '</h2>';
    html += '<p style="margin-bottom: 20px;">Grupo: ' + grupoSeleccionado.nombre + ' - Periodo: ' + periodoActual + '</p>';
    html += '<table><thead><tr>';
    html += '<th>Matricula</th>';
    html += '<th>Alumno</th>';
    html += '<th>Parcial 1</th>';
    html += '<th>Parcial 2</th>';
    html += '<th>Parcial 3</th>';
    html += '<th>Promedio</th>';
    html += '<th>Estado</th>';
    html += '</tr></thead><tbody>';
    
    snapshot.forEach(doc => {
      const cal = doc.data();
      const alumno = alumnosData.find(a => a.uid === cal.alumnoId);
      const p1 = cal.parciales?.parcial1 || '-';
      const p2 = cal.parciales?.parcial2 || '-';
      const p3 = cal.parciales?.parcial3 || '-';
      const promedio = calcularPromedio(p1, p2, p3);
      const estado = obtenerEstado(promedio, p1, p2, p3);
      
      html += '<tr>';
      html += '<td><strong>' + (alumno ? alumno.matricula : 'N/A') + '</strong></td>';
      html += '<td>' + (alumno ? alumno.nombre : 'N/A') + '</td>';
      html += '<td>' + p1 + '</td>';
      html += '<td>' + p2 + '</td>';
      html += '<td>' + p3 + '</td>';
      html += '<td><strong>' + promedio + '</strong></td>';
      html += '<td>' + estado + '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '<div style="margin-top: 20px;">';
    html += '<button onclick="imprimirActaMateria(\'' + materiaId + '\', \'' + nombreMateria + '\')" class="opcion-btn">Imprimir Acta de Calificaciones</button>';
    html += '</div>';
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar calificaciones');
  }
}

function calcularPromedio(p1, p2, p3) {
  if (p1 === 'NP' || p2 === 'NP' || p3 === 'NP') {
    return '5.0';
  }
  
  const valores = [p1, p2, p3]
    .filter(v => v !== '-' && v !== null && v !== undefined && v !== '')
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));
  
  if (valores.length === 0) return '-';
  
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  return promedio.toFixed(1);
}

function obtenerEstado(promedio, p1, p2, p3) {
  if (promedio === '-') {
    return '<span class="badge badge-pendiente">Pendiente</span>';
  }
  
  if (p1 === 'NP' || p2 === 'NP' || p3 === 'NP') {
    return '<span class="badge badge-reprobado">Reprobado (NP)</span>';
  }
  
  const prom = parseFloat(promedio);
  if (prom >= 6) {
    return '<span class="badge badge-aprobado">Aprobado</span>';
  } else {
    return '<span class="badge badge-reprobado">Reprobado</span>';
  }
}

function mostrarLista(html) {
  document.getElementById('listaContenido').innerHTML = html;
  document.getElementById('gruposContainer').style.display = 'none';
  document.getElementById('listaContainer').classList.add('active');
}

function volverCarreras() {
  document.getElementById('gruposContainer').classList.remove('active');
  document.getElementById('menuCarreras').style.display = 'grid';
  document.getElementById('opcionesContainer').classList.remove('active');
  carreraSeleccionada = null;
  grupoSeleccionado = null;
}

function volverGrupos() {
  document.getElementById('listaContainer').classList.remove('active');
  document.getElementById('gruposContainer').style.display = 'block';
}

function imprimirHistorialAlumno(alumnoId, nombreAlumno) {
  if (typeof descargarHistorialAlumnoPDF === 'function') {
    descargarHistorialAlumnoPDF(alumnoId, nombreAlumno);
  } else {
    alert('Funcion de PDF no disponible');
  }
}

function imprimirActaMateria(materiaId, nombreMateria) {
  alert('Funcion de imprimir acta en desarrollo');
}

console.log('Control Escolar cargado');