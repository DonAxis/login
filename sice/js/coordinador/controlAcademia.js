// vistaAcademia.js
// Vista de Academia para Coordinadores

const auth = firebase.auth();
let usuarioActual = null;
let materiasAcademia = [];
let materiasDisponibles = [];
let carrerasData = [];
let materiaSeleccionada = null;
let materiasOriginales = [];
let todasLasMaterias = [];
let profesoresAcademia = [];
let profesorSeleccionado = null;
let profesorActualId = null; // Para poder volver a las materias del profesor
let profesorActualNombre = null;

// ===== NAVEGACIÓN ENTRE SECCIONES =====
function ocultarTodasSecciones() {
  document.getElementById('menuAcademia').style.display = 'none';
  const seccionMateriasAcademia = document.getElementById('seccionMateriasAcademia');
  if (seccionMateriasAcademia) seccionMateriasAcademia.style.display = 'none';
  document.getElementById('seccionVerCarreras').style.display = 'none';
  document.getElementById('seccionCalificaciones').style.display = 'none';
  document.getElementById('seccionProfesores').style.display = 'none';
  document.getElementById('seccionMateriasProfesor').style.display = 'none';
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

// ===== MOSTRAR SECCIÓN PROFESORES =====
function mostrarProfesores() {
  ocultarTodasSecciones();
  document.getElementById('seccionProfesores').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  cargarProfesoresAcademia();
}

// ===== PROTECCIÓN =====
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert('Debes iniciar sesión');
    window.location.href = '../../index.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists || userDoc.data().rol !== 'coordinador') {
      alert('Solo coordinadores pueden acceder');
      window.location.href = '../../index.html';
      return;
    }

    usuarioActual = {
      uid: user.uid,
      ...userDoc.data()
    };

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
      const nombresAcademias = usuarioActual.academias.map(a => a.academiaNombre).join(', ');
      document.getElementById('academiaNombre').textContent = nombresAcademias;
    } else if (tieneAcademiaUnica) {
      document.getElementById('academiaNombre').textContent = usuarioActual.academiaNombre;
    }

    console.log('Coordinador con academia autorizado:', usuarioActual.nombre);
    
    await cargarDatos();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = '../../index.html';
  }
});

// ===== CARGAR DATOS =====
async function cargarDatos() {
  try {
    await cargarCarreras();
    await cargarMateriasAcademia();
    await cargarProfesoresAcademia();
    actualizarEstadisticas();
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }
}

// ===== CARGAR CARRERAS =====
async function cargarCarreras() {
  try {
    const snapshot = await db.collection('carreras').get();
    carrerasData = [];
    
    snapshot.forEach(doc => {
      carrerasData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`${carrerasData.length} carreras cargadas`);
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

// ===== CARGAR MATERIAS DE LA ACADEMIA =====
async function cargarMateriasAcademia() {
  try {
    console.log('Cargando materias de la academia...');
    
    let academiaIds = [];
    
    if (usuarioActual.academias && usuarioActual.academias.length > 0) {
      academiaIds = usuarioActual.academias.map(a => a.academiaId);
    } else if (usuarioActual.academiaId) {
      academiaIds = [usuarioActual.academiaId];
    }
    
    console.log('Buscando materias para academias:', academiaIds);
    
    if (academiaIds.length === 0) {
      materiasAcademia = [];
      todasLasMaterias = [];
      return;
    }
    
    const snapshot = await db.collection('materias')
      .where('academiaId', 'in', academiaIds)
      .get();
    
    materiasAcademia = [];
    todasLasMaterias = [];
    
    for (const doc of snapshot.docs) {
      const materia = doc.data();
      
      let carreraNombre = 'Sin carrera';
      let carreraColor = '#e0e0e0';
      
      if (materia.carreraId) {
        const carrera = carrerasData.find(c => c.id === materia.carreraId);
        if (carrera) {
          carreraNombre = carrera.nombre;
          carreraColor = carrera.color || '#43a047';
        }
      }
      
      const materiaBase = {
        id: doc.id,
        ...materia,
        carreraNombre,
        carreraColor
      };
      
      materiasAcademia.push(materiaBase);
      
      if (materia.grupos && materia.grupos.length > 0) {
        materia.grupos.forEach(grupo => {
          todasLasMaterias.push({
            ...materiaBase,
            grupoActual: grupo,
            turno: grupo.turno,
            nombreTurno: grupo.nombreTurno,
            codigoGrupo: grupo.codigo,
            codigoCompleto: grupo.codigoCompleto
          });
        });
      } else {
        todasLasMaterias.push(materiaBase);
      }
    }
    
    console.log(`${materiasAcademia.length} materias cargadas`);
    console.log(`${todasLasMaterias.length} grupos totales`);
    
  } catch (error) {
    console.error('Error al cargar materias:', error);
  }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarEstadisticas() {
  document.getElementById('totalMaterias').textContent = materiasAcademia.length;
  
  const carrerasUnicas = new Set(materiasAcademia.map(m => m.carreraId));
  document.getElementById('totalCarreras').textContent = carrerasUnicas.size;
  
  document.getElementById('totalProfesores').textContent = profesoresAcademia.length;
}

// ===== MOSTRAR MATERIAS AGRUPADAS POR CARRERA =====
function mostrarMateriasPorCarrera() {
  const container = document.getElementById('contenidoCarreras');
  
  if (todasLasMaterias.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay materias asignadas a tu academia</p>
      </div>
    `;
    return;
  }
  
  const materiasPorCarrera = {};
  
  todasLasMaterias.forEach(materia => {
    const carreraId = materia.carreraId || 'sin-carrera';
    if (!materiasPorCarrera[carreraId]) {
      materiasPorCarrera[carreraId] = {
        materias: [],
        nombre: materia.carreraNombre || 'Sin Carrera',
        color: materia.carreraColor || '#e0e0e0',
        siglas: carreraId
      };
    }
    materiasPorCarrera[carreraId].materias.push(materia);
  });
  
  let html = '';
  
  const carrerasOrdenadas = Object.values(materiasPorCarrera).sort((a, b) => 
    a.nombre.localeCompare(b.nombre)
  );
  
  carrerasOrdenadas.forEach((carrera, index) => {
    html += `
      <div class="carrera-section" data-carrera="${carrera.siglas}">
        <div class="carrera-header" onclick="toggleCarrera('carrera-${index}')">
          <h3>${carrera.nombre} (${carrera.siglas})</h3>
          <span class="carrera-toggle" id="toggle-carrera-${index}">−</span>
        </div>
        
        <div class="carrera-materias" id="carrera-${index}">
    `;
    
    carrera.materias.forEach(materia => {
      let grupoInfo = '';
      if (materia.grupoActual) {
        grupoInfo = `
          <p class="materia-info"><strong>Turno:</strong> ${materia.nombreTurno || 'Turno ' + materia.turno}</p>
          <p class="materia-info"><strong>Código:</strong> ${materia.codigoCompleto || materia.codigoGrupo}</p>
        `;
      }
      
      html += `
        <div class="materia-card" data-nombre="${materia.nombre.toLowerCase()}">
          <div class="materia-header">
            <h3>${materia.nombre}</h3>
            <span class="carrera-badge" style="background: ${carrera.color}22; color: ${carrera.color};">
              ${carrera.siglas}
            </span>
          </div>
          <p class="materia-info"><strong>Periodo:</strong> ${materia.periodo || '-'}</p>
          ${grupoInfo}
          ${materia.profesorNombre ? 
            `<p class="materia-info"><strong>Profesor:</strong> ${materia.profesorNombre}</p>` : 
            '<p class="materia-info" style="color: #999;">Sin profesor asignado</p>'}
          
          <div class="materia-acciones">
            <button onclick="verCalificacionesMateriaCarrera('${materia.id}', '${materia.nombre}', '${materia.codigoCompleto || ''}')" class="btn-ver">
              Ver Calificaciones
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
  const toggleIcon = document.getElementById('toggle-' + carreraId);
  
  if (materias.classList.contains('collapsed')) {
    materias.classList.remove('collapsed');
    toggleIcon.textContent = '−';
  } else {
    materias.classList.add('collapsed');
    toggleIcon.textContent = '+';
  }
}

function filtrarMateriasPorNombre() {
  const buscador = document.getElementById('buscadorMateria').value.toLowerCase().trim();
  const todasLasMaterias = document.querySelectorAll('#contenidoCarreras .materia-card');
  const todasLasCarreras = document.querySelectorAll('.carrera-section');
  
  if (!buscador) {
    todasLasMaterias.forEach(materia => materia.style.display = 'block');
    todasLasCarreras.forEach(carrera => carrera.style.display = 'block');
    return;
  }
  
  todasLasMaterias.forEach(materia => {
    const nombreMateria = materia.getAttribute('data-nombre');
    if (nombreMateria && nombreMateria.includes(buscador)) {
      materia.style.display = 'block';
    } else {
      materia.style.display = 'none';
    }
  });
  
  todasLasCarreras.forEach(carrera => {
    const materiasEnCarrera = carrera.querySelectorAll('.materia-card');
    let hayVisibles = false;
    
    materiasEnCarrera.forEach(materia => {
      if (materia.style.display !== 'none') {
        hayVisibles = true;
      }
    });
    
    if (hayVisibles) {
      carrera.style.display = 'block';
    } else {
      carrera.style.display = 'none';
    }
  });
}

async function verCalificacionesMateriaCarrera(materiaId, materiaNombre, codigoGrupo) {
  ocultarTodasSecciones();
  document.getElementById('seccionCalificaciones').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  
  let tituloMateria = materiaNombre;
  if (codigoGrupo) {
    tituloMateria += ` (${codigoGrupo})`;
  }
  document.getElementById('infoMateriaCalif').textContent = tituloMateria;
  
  try {
    document.getElementById('contenidoCalificaciones').innerHTML = 
      '<p style="text-align: center; color: #999;">Cargando calificaciones...</p>';
    
    const snapshot = await db.collection('calificaciones')
      .where('materiaId', '==', materiaId)
      .get();
    
    if (snapshot.empty) {
      document.getElementById('contenidoCalificaciones').innerHTML = `
        <div class="sin-datos">
          <p>No hay calificaciones registradas para esta materia</p>
        </div>
      `;
      return;
    }
    
    const calificaciones = [];
    
    for (const doc of snapshot.docs) {
      const cal = doc.data();
      calificaciones.push({
        id: doc.id,
        ...cal
      });
    }
    
    calificaciones.sort((a, b) => (a.nombreAlumno || '').localeCompare(b.nombreAlumno || ''));
    
    let html = `
      <table class="tabla-calificaciones">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Matrícula</th>
            <th>Parcial 1</th>
            <th>Parcial 2</th>
            <th>Parcial 3</th>
            <th>Prom</th>
            <th>ETS</th>
            <th>Final</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    calificaciones.forEach(cal => {
      const promParciales = cal.promedioParciales || '-';
      const finalCalc = cal.calificacionFinal || '-';
      
      html += `
        <tr>
          <td>${cal.nombreAlumno || 'Sin nombre'}</td>
          <td>${cal.matricula || '-'}</td>
          <td>${cal.u1 !== undefined && cal.u1 !== null ? cal.u1 : '-'}</td>
          <td>${cal.u2 !== undefined && cal.u2 !== null ? cal.u2 : '-'}</td>
          <td>${cal.u3 !== undefined && cal.u3 !== null ? cal.u3 : '-'}</td>
          <td><strong>${promParciales}</strong></td>
          <td>${cal.ets !== undefined && cal.ets !== null ? cal.ets : '-'}</td>
          <td><strong>${finalCalc}</strong></td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    document.getElementById('contenidoCalificaciones').innerHTML = html;
    
  } catch (error) {
    console.error('Error al cargar calificaciones:', error);
    document.getElementById('contenidoCalificaciones').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar calificaciones</p>';
  }
}

// ===== CARGAR PROFESORES DE LA ACADEMIA =====
async function cargarProfesoresAcademia() {
  try {
    const container = document.getElementById('listaProfesores');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando profesores...</p>';
    
    let academiaIds = [];
    if (usuarioActual.academias && usuarioActual.academias.length > 0) {
      academiaIds = usuarioActual.academias.map(a => a.academiaId);
    } else if (usuarioActual.academiaId) {
      academiaIds = [usuarioActual.academiaId];
    }
    
    if (academiaIds.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999;">No hay academia asignada</p>';
      return;
    }
    
    const snapshot = await db.collection('usuarios')
      .where('rol', '==', 'profesor')
      .get();
    
    profesoresAcademia = [];
    
    for (const doc of snapshot.docs) {
      const profesor = doc.data();
      
      if (profesor.academias && Array.isArray(profesor.academias)) {
        const tieneAcademia = profesor.academias.some(a => academiaIds.includes(a));
        
        if (tieneAcademia) {
          const materiasSnapshot = await db.collection('profesorMaterias')
            .where('profesorId', '==', doc.id)
            .where('activa', '==', true)
            .get();
          
          profesoresAcademia.push({
            id: doc.id,
            ...profesor,
            totalMaterias: materiasSnapshot.size
          });
        }
      }
    }
    
    mostrarListaProfesores();
    actualizarEstadisticas();
    
  } catch (error) {
    console.error('Error al cargar profesores:', error);
    const container = document.getElementById('listaProfesores');
    if (container) {
      container.innerHTML = '<p style="color: red; text-align: center;">Error al cargar profesores</p>';
    }
  }
}

function mostrarListaProfesores() {
  const container = document.getElementById('listaProfesores');
  if (!container) return;
  
  if (profesoresAcademia.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay profesores registrados en esta academia</p>
      </div>
    `;
    return;
  }
  
  let html = '<div style="display: grid; gap: 15px;">';
  
  profesoresAcademia.forEach(profesor => {
    const academiasTexto = profesor.academias && profesor.academias.length > 0 
      ? profesor.academias.join(', ') 
      : 'Sin academias';
    
    html += `
      <div class="materia-card">
        <div class="materia-header">
          <h3>${profesor.nombre}</h3>
          <span class="carrera-badge" style="background: #5e35b122; color: #5e35b1;">
            Profesor
          </span>
        </div>
        <p class="materia-info"><strong>Email:</strong> ${profesor.email}</p>
        <p class="materia-info"><strong>Academias:</strong> ${academiasTexto}</p>
        <p class="materia-info"><strong>Materias asignadas:</strong> ${profesor.totalMaterias || 0}</p>
        
        <div class="materia-acciones">
          <button onclick="verMateriasProfesor('${profesor.id}', '${profesor.nombre}')" class="btn-ver">
            Ver Materias
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function mostrarModalRegistrarProfesor() {
  document.getElementById('modalRegistrarProfesor').style.display = 'block';
  document.getElementById('profEmail').value = '';
  document.getElementById('mensajeRegistroProfesor').style.display = 'none';
}

function cerrarModalRegistrarProfesor() {
  document.getElementById('modalRegistrarProfesor').style.display = 'none';
}

async function registrarProfesor() {
  const email = document.getElementById('profEmail').value.trim();
  const password = 'ilb123'; // Contraseña fija para nuevos usuarios
  const mensajeDiv = document.getElementById('mensajeRegistroProfesor');
  
  if (!email) {
    mensajeDiv.textContent = 'Por favor ingresa el correo electrónico';
    mensajeDiv.style.display = 'block';
    mensajeDiv.style.background = '#fee';
    mensajeDiv.style.color = '#c33';
    return;
  }
  
  try {
    mensajeDiv.textContent = 'Registrando profesor...';
    mensajeDiv.style.display = 'block';
    mensajeDiv.style.background = '#e3f2fd';
    mensajeDiv.style.color = '#1976d2';
    
    let academiaId;
    if (usuarioActual.academias && usuarioActual.academias.length > 0) {
      academiaId = usuarioActual.academias[0].academiaId;
    } else if (usuarioActual.academiaId) {
      academiaId = usuarioActual.academiaId;
    }
    
    const usuariosSnapshot = await db.collection('usuarios')
      .where('email', '==', email)
      .get();
    
    let profesorId;
    
    if (!usuariosSnapshot.empty) {
      // Usuario ya existe - SOLO enlazar, NO cambiar datos
      const docExistente = usuariosSnapshot.docs[0];
      profesorId = docExistente.id;
      const datosExistentes = docExistente.data();
      
      const academiasActuales = datosExistentes.academias || [];
      
      if (!academiasActuales.includes(academiaId)) {
        await db.collection('usuarios').doc(profesorId).update({
          academias: firebase.firestore.FieldValue.arrayUnion(academiaId)
        });
      }
      
      mensajeDiv.textContent = `Profesor enlazado exitosamente. Usuario existente (datos no modificados).`;
      mensajeDiv.style.background = '#e8f5e9';
      mensajeDiv.style.color = '#2e7d32';
      
    } else {
      // Crear NUEVO usuario con nombre temporal
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      profesorId = userCredential.user.uid;
      
      await db.collection('usuarios').doc(profesorId).set({
        nombre: 'profesor sin clases',
        email: email,
        rol: 'profesor',
        academias: [academiaId],
        activo: true,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await firebase.auth().signOut();
      
      mensajeDiv.textContent = 'Profesor creado con nombre temporal. Se actualizará al asignar materias.';
      mensajeDiv.style.background = '#e8f5e9';
      mensajeDiv.style.color = '#2e7d32';
    }
    
    setTimeout(() => {
      cerrarModalRegistrarProfesor();
      cargarProfesoresAcademia();
    }, 2000);
    
  } catch (error) {
    console.error('Error al registrar profesor:', error);
    mensajeDiv.textContent = 'Error: ' + error.message;
    mensajeDiv.style.display = 'block';
    mensajeDiv.style.background = '#fee';
    mensajeDiv.style.color = '#c33';
  }
}

async function verMateriasProfesor(profesorId, profesorNombre) {
  try {
    // Guardar el profesor actual para poder volver
    profesorActualId = profesorId;
    profesorActualNombre = profesorNombre;
    
    ocultarTodasSecciones();
    document.getElementById('seccionMateriasProfesor').style.display = 'block';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
    // Ocultar botón "Ver Otra Materia" cuando estamos en la lista de materias
    const btnVerOtra = document.getElementById('btnVerOtraMateria');
    if (btnVerOtra) btnVerOtra.style.display = 'none';
    
    document.getElementById('tituloMateriasProfesor').textContent = `Materias de ${profesorNombre}`;
    
    const profesor = profesoresAcademia.find(p => p.id === profesorId);
    if (profesor) {
      const academiasTexto = profesor.academias && profesor.academias.length > 0 
        ? profesor.academias.join(', ') 
        : 'Sin academias';
      document.getElementById('infoProfesorSeleccionado').textContent = 
        `Email: ${profesor.email} | Academias: ${academiasTexto}`;
    }
    
    const container = document.getElementById('listaMateriasProfesor');
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando materias...</p>';
    
    // Buscar asignaciones activas en profesorMaterias
    const snapshot = await db.collection('profesorMaterias')
      .where('profesorId', '==', profesorId)
      .where('activa', '==', true)
      .get();
    
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>Este profesor no tiene materias asignadas</p>
        </div>
      `;
      return;
    }
    
    const asignaciones = [];
    snapshot.forEach(doc => {
      asignaciones.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por periodo y turno
    asignaciones.sort((a, b) => {
      const periodoA = a.periodo || 1;
      const periodoB = b.periodo || 1;
      if (periodoA !== periodoB) return periodoB - periodoA;
      
      const turnoA = a.turno || 1;
      const turnoB = b.turno || 1;
      return turnoA - turnoB;
    });
    
    // Agrupar por periodo
    const materiasPorPeriodo = {};
    asignaciones.forEach(asignacion => {
      const periodo = asignacion.periodo || 1;
      if (!materiasPorPeriodo[periodo]) {
        materiasPorPeriodo[periodo] = [];
      }
      materiasPorPeriodo[periodo].push(asignacion);
    });
    
    // Generar HTML
    let html = '';
    const periodos = Object.keys(materiasPorPeriodo).sort((a, b) => b - a);
    
    periodos.forEach(periodo => {
      const materias = materiasPorPeriodo[periodo];
      
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #5e35b1; margin-bottom: 15px;">Periodo ${periodo}</h3>
          <div style="display: grid; gap: 15px;">
      `;
      
      materias.forEach(asignacion => {
        const turnosNombres = {1: 'Matutino', 2: 'Vespertino', 3: 'Nocturno', 4: 'Sabatino'};
        const turnoNombre = asignacion.turnoNombre || turnosNombres[asignacion.turno] || 'Sin turno';
        
        html += `
          <div class="materia-card" style="cursor: pointer;" onclick="verCalificacionesProfesor('${asignacion.id}', '${asignacion.materiaNombre}', '${asignacion.codigoGrupo || ''}')">
            <div class="materia-header">
              <h3>${asignacion.materiaNombre}</h3>
              <span class="carrera-badge" style="background: #5e35b122; color: #5e35b1;">
                ${turnoNombre}
              </span>
            </div>
            <p class="materia-info"><strong>Código Grupo:</strong> ${asignacion.codigoGrupo || 'N/A'}</p>
            <p class="materia-info"><strong>Periodo:</strong> ${asignacion.periodo}</p>
            <div class="materia-acciones">
              <button onclick="event.stopPropagation(); verCalificacionesProfesor('${asignacion.id}', '${asignacion.materiaNombre}', '${asignacion.codigoGrupo || ''}')" class="btn-ver">
                Ver Calificaciones
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
    
  } catch (error) {
    console.error('Error al cargar materias del profesor:', error);
    document.getElementById('listaMateriasProfesor').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar materias</p>';
  }
}

// ===== VER CALIFICACIONES DE UN GRUPO ESPECÍFICO DEL PROFESOR =====
async function verCalificacionesProfesor(asignacionId, materiaNombre, codigoGrupo) {
  try {
    ocultarTodasSecciones();
    document.getElementById('seccionCalificaciones').style.display = 'block';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
    // Mostrar botón "Ver Otra Materia" cuando estamos viendo calificaciones
    const btnVerOtra = document.getElementById('btnVerOtraMateria');
    if (btnVerOtra) btnVerOtra.style.display = 'inline-block';
    
    let tituloMateria = materiaNombre;
    if (codigoGrupo) {
      tituloMateria += ` - Grupo ${codigoGrupo}`;
    }
    document.getElementById('infoMateriaCalif').textContent = tituloMateria;
    
    const container = document.getElementById('contenidoCalificaciones');
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando calificaciones...</p>';
    
    // Obtener datos de la asignación
    const asignacionDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
    if (!asignacionDoc.exists) {
      container.innerHTML = '<p style="color: red; text-align: center;">Asignación no encontrada</p>';
      return;
    }
    
    const asignacion = asignacionDoc.data();
    console.log('Asignación:', asignacion);
    console.log('Buscando alumnos del grupo:', asignacion.codigoGrupo);
    
    // Buscar alumnos del grupo (igual que en controlProfesor.js)
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('codigoGrupo', '==', asignacion.codigoGrupo)
      .where('activo', '==', true)
      .get();
    
    console.log('Alumnos encontrados:', alumnosSnap.size);
    
    // Buscar inscripciones especiales
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('asignacionId', '==', asignacionId)
      .get();
    
    console.log('Inscripciones especiales:', inscripcionesSnap.size);
    
    const alumnosMap = new Map();
    
    // Procesar alumnos normales
    alumnosSnap.forEach(doc => {
      const alumno = doc.data();
      alumnosMap.set(doc.id, {
        id: doc.id,
        nombre: alumno.nombre || 'Sin nombre',
        matricula: alumno.matricula || '-',
        email: alumno.email || '-',
        esEspecial: false
      });
    });
    
    // Procesar inscripciones especiales
    for (const inscDoc of inscripcionesSnap.docs) {
      const insc = inscDoc.data();
      if (insc.alumnoId && !alumnosMap.has(insc.alumnoId)) {
        const alumnoDoc = await db.collection('usuarios').doc(insc.alumnoId).get();
        if (alumnoDoc.exists) {
          const alumno = alumnoDoc.data();
          alumnosMap.set(insc.alumnoId, {
            id: insc.alumnoId,
            nombre: alumno.nombre || 'Sin nombre',
            matricula: alumno.matricula || '-',
            email: alumno.email || '-',
            esEspecial: true
          });
        }
      }
    }
    
    if (alumnosMap.size === 0) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>No hay alumnos registrados en este grupo</p>
          <p style="margin-top: 10px; color: #666; font-size: 0.9rem;">
            Grupo: ${asignacion.codigoGrupo}
          </p>
        </div>
      `;
      return;
    }
    
    // Buscar calificaciones para estos alumnos usando profesorId y codigoGrupo
    // ya que vemos que no siempre existe asignacionId en calificaciones
    const calificacionesSnap = await db.collection('calificaciones')
      .where('profesorId', '==', asignacion.profesorId)
      .where('codigoGrupo', '==', asignacion.codigoGrupo)
      .get();
    
    console.log('Calificaciones encontradas:', calificacionesSnap.size);
    
    const calificacionesMap = new Map();
    calificacionesSnap.forEach(doc => {
      const cal = doc.data();
      
      // Extraer calificaciones de los maps
      const parciales = cal.parciales || {};
      const faltas = cal.faltas || {};
      
      const u1 = parciales.parcial1 !== undefined && parciales.parcial1 !== null ? parciales.parcial1 : null;
      const u2 = parciales.parcial2 !== undefined && parciales.parcial2 !== null ? parciales.parcial2 : null;
      const u3 = parciales.parcial3 !== undefined && parciales.parcial3 !== null ? parciales.parcial3 : null;
      
      // Calcular promedio de parciales si hay datos
      let promedioParciales = null;
      const parcialesValidos = [u1, u2, u3].filter(p => p !== null && p !== undefined);
      if (parcialesValidos.length > 0) {
        const suma = parcialesValidos.reduce((sum, p) => sum + p, 0);
        promedioParciales = Math.round(suma / parcialesValidos.length);
      }
      
      // Contar faltas
      const falta1 = faltas.falta1 || 0;
      const falta2 = faltas.falta2 || 0;
      const falta3 = faltas.falta3 || 0;
      const totalFaltas = falta1 + falta2 + falta3;
      
      calificacionesMap.set(cal.alumnoId, {
        id: doc.id,
        u1: u1,
        u2: u2,
        u3: u3,
        promedioParciales: promedioParciales,
        ets: cal.ets !== undefined && cal.ets !== null ? cal.ets : null,
        calificacionFinal: cal.calificacionFinal !== undefined && cal.calificacionFinal !== null ? cal.calificacionFinal : null,
        faltas: totalFaltas
      });
    });
    
    // Combinar alumnos con calificaciones
    const alumnos = Array.from(alumnosMap.values()).map(alumno => {
      const calif = calificacionesMap.get(alumno.id) || {};
      return {
        ...alumno,
        u1: calif.u1,
        u2: calif.u2,
        u3: calif.u3,
        promedioParciales: calif.promedioParciales,
        ets: calif.ets,
        calificacionFinal: calif.calificacionFinal,
        faltas: calif.faltas || 0
      };
    });
    
    // Ordenar por nombre
    alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    let html = `
      <div style="overflow-x: auto;">
        <table class="tabla-calificaciones">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Matrícula</th>
              <th>Parcial 1</th>
              <th>Parcial 2</th>
              <th>Parcial 3</th>
              <th>Prom</th>
              <th>ETS</th>
              <th>Final</th>
              <th>Faltas</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    alumnos.forEach(alumno => {
      const promParciales = alumno.promedioParciales !== undefined && alumno.promedioParciales !== null ? alumno.promedioParciales : '-';
      const finalCalc = alumno.calificacionFinal !== undefined && alumno.calificacionFinal !== null ? alumno.calificacionFinal : '-';
      const colorFinal = finalCalc !== '-' && finalCalc >= 70 ? '#2e7d32' : '#c62828';
      
      html += `
        <tr>
          <td>${alumno.nombre}${alumno.esEspecial ? ' <span style="color: #ff6f00; font-size: 0.8em;">★</span>' : ''}</td>
          <td>${alumno.matricula}</td>
          <td>${alumno.u1 !== undefined && alumno.u1 !== null ? alumno.u1 : '-'}</td>
          <td>${alumno.u2 !== undefined && alumno.u2 !== null ? alumno.u2 : '-'}</td>
          <td>${alumno.u3 !== undefined && alumno.u3 !== null ? alumno.u3 : '-'}</td>
          <td><strong>${promParciales}</strong></td>
          <td>${alumno.ets !== undefined && alumno.ets !== null ? alumno.ets : '-'}</td>
          <td><strong style="color: ${colorFinal};">${finalCalc}</strong></td>
          <td>${alumno.faltas}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
      <p style="margin-top: 10px; color: #666; font-size: 0.85rem;">
        Total de alumnos: ${alumnos.length} | 
        Grupo: ${asignacion.codigoGrupo}
        ${inscripcionesSnap.size > 0 ? ' | ★ = Inscripción especial' : ''}
      </p>
    `;
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error al cargar calificaciones:', error);
    document.getElementById('contenidoCalificaciones').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar calificaciones: ' + error.message + '</p>';
  }
}

// ===== VOLVER A MATERIAS DEL PROFESOR =====
function volverAMateriasProfesor() {
  if (profesorActualId && profesorActualNombre) {
    verMateriasProfesor(profesorActualId, profesorActualNombre);
  } else {
    // Si no hay profesor guardado, volver al menú de profesores
    mostrarProfesores();
  }
}

// ===== VOLVER A COORDINADOR =====
function volverCoordinador() {
  window.location.href = './controlCoordinador.html';
}

window.onclick = function(event) {
  const modalRegistrar = document.getElementById('modalRegistrarProfesor');
  
  if (event.target === modalRegistrar) {
    cerrarModalRegistrarProfesor();
  }
}

console.log('Vista Academia cargada');