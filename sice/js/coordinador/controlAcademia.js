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
            <th>U1</th>
            <th>U2</th>
            <th>U3</th>
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
        <p style="margin-top: 10px;">
          <button onclick="mostrarModalRegistrarProfesor()" class="btn-asignar">
            Registrar Primer Profesor
          </button>
        </p>
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
  document.getElementById('profNombre').value = '';
  document.getElementById('profEmail').value = '';
  document.getElementById('mensajeRegistroProfesor').style.display = 'none';
}

function cerrarModalRegistrarProfesor() {
  document.getElementById('modalRegistrarProfesor').style.display = 'none';
}

async function registrarProfesor() {
  const nombre = document.getElementById('profNombre').value.trim();
  const email = document.getElementById('profEmail').value.trim();
  const password = 'ilb123'; // Contraseña fija para nuevos usuarios
  const mensajeDiv = document.getElementById('mensajeRegistroProfesor');
  
  if (!nombre || !email) {
    mensajeDiv.textContent = 'Por favor completa todos los campos';
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
      // Usuario ya existe - SOLO enlazar, NO cambiar contraseña
      const docExistente = usuariosSnapshot.docs[0];
      profesorId = docExistente.id;
      const datosExistentes = docExistente.data();
      
      const academiasActuales = datosExistentes.academias || [];
      
      if (!academiasActuales.includes(academiaId)) {
        await db.collection('usuarios').doc(profesorId).update({
          academias: firebase.firestore.FieldValue.arrayUnion(academiaId)
        });
      }
      
      mensajeDiv.textContent = `Profesor enlazado exitosamente. El usuario ya existía (contraseña no modificada).`;
      mensajeDiv.style.background = '#e8f5e9';
      mensajeDiv.style.color = '#2e7d32';
      
    } else {
      // Crear NUEVO usuario con contraseña fija "ilb123"
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      profesorId = userCredential.user.uid;
      
      await db.collection('usuarios').doc(profesorId).set({
        nombre: nombre,
        email: email,
        rol: 'profesor',
        academias: [academiaId],
        activo: true,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await firebase.auth().signOut();
      
      mensajeDiv.textContent = 'Profesor registrado exitosamente con contraseña: ilb123';
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
    ocultarTodasSecciones();
    document.getElementById('seccionMateriasProfesor').style.display = 'block';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
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
    
    // Buscar calificaciones para esta asignación específica
    const calificacionesSnap = await db.collection('calificaciones')
      .where('asignacionId', '==', asignacionId)
      .get();
    
    if (calificacionesSnap.empty) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>No hay alumnos registrados en este grupo</p>
        </div>
      `;
      return;
    }
    
    const calificaciones = [];
    calificacionesSnap.forEach(doc => {
      calificaciones.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por nombre de alumno
    calificaciones.sort((a, b) => (a.nombreAlumno || '').localeCompare(b.nombreAlumno || ''));
    
    let html = `
      <div style="overflow-x: auto;">
        <table class="tabla-calificaciones">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Matrícula</th>
              <th>U1</th>
              <th>U2</th>
              <th>U3</th>
              <th>Prom</th>
              <th>ETS</th>
              <th>Final</th>
              <th>Faltas</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    calificaciones.forEach(cal => {
      const promParciales = cal.promedioParciales || '-';
      const finalCalc = cal.calificacionFinal || '-';
      const faltas = cal.faltas !== undefined ? cal.faltas : '-';
      
      html += `
        <tr>
          <td>${cal.nombreAlumno || 'Sin nombre'}</td>
          <td>${cal.matricula || '-'}</td>
          <td>${cal.u1 !== undefined && cal.u1 !== null ? cal.u1 : '-'}</td>
          <td>${cal.u2 !== undefined && cal.u2 !== null ? cal.u2 : '-'}</td>
          <td>${cal.u3 !== undefined && cal.u3 !== null ? cal.u3 : '-'}</td>
          <td><strong>${promParciales}</strong></td>
          <td>${cal.ets !== undefined && cal.ets !== null ? cal.ets : '-'}</td>
          <td><strong style="color: ${finalCalc >= 70 ? '#2e7d32' : '#c62828'};">${finalCalc}</strong></td>
          <td>${faltas}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error al cargar calificaciones:', error);
    document.getElementById('contenidoCalificaciones').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar calificaciones</p>';
  }
}

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