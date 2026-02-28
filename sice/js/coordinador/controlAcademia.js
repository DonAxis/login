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

// ===== NAVEGACIÓN ENTRE SECCIONES =====
function ocultarTodasSecciones() {
  document.getElementById('menuAcademia').style.display = 'none';
  document.getElementById('seccionMateriasAcademia').style.display = 'none';
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

function mostrarMateriasAcademia() {
  ocultarTodasSecciones();
  document.getElementById('seccionMateriasAcademia').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  mostrarMaterias();
}

function mostrarVerCarreras() {
  ocultarTodasSecciones();
  document.getElementById('seccionVerCarreras').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  mostrarMateriasPorCarrera();
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
      mostrarMaterias();
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
    mostrarMaterias();
    
  } catch (error) {
    console.error('Error al cargar materias:', error);
    document.getElementById('listaMaterias').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar materias</p>';
  }
}

// ===== MOSTRAR MATERIAS =====
function mostrarMaterias() {
  const container = document.getElementById('listaMaterias');
  
  if (materiasAcademia.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay materias asignadas a tu academia</p>
        <p style="margin-top: 10px;">
          <button onclick="mostrarModalAsignarMateria()" class="btn-asignar">
            Asignar Primera Materia
          </button>
        </p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  materiasAcademia.forEach(materia => {
    let gruposInfo = '';
    if (materia.grupos && materia.grupos.length > 0) {
      const gruposTexto = materia.grupos.map(g => 
        `${g.nombreTurno || 'Turno ' + g.turno} (${g.codigoCompleto || g.codigo})`
      ).join(', ');
      gruposInfo = `<p class="materia-info"><strong>Grupos:</strong> ${gruposTexto}</p>`;
    }
    
    html += `
      <div class="materia-card">
        <div class="materia-header">
          <h3>${materia.nombre}</h3>
          <span class="carrera-badge" style="background: ${materia.carreraColor}22; color: ${materia.carreraColor};">
            ${materia.carreraNombre}
          </span>
        </div>
        <p class="materia-info"><strong>Periodo:</strong> ${materia.periodo || '-'}</p>
        ${gruposInfo}
        ${materia.profesorNombre ? `<p class="materia-info"><strong>Profesor:</strong> ${materia.profesorNombre}</p>` : '<p class="materia-info" style="color: #999;">Sin profesor asignado</p>'}
        
        <div class="materia-acciones">
          <button onclick="desasignarMateria('${materia.id}', '${materia.nombre}')" 
                  style="padding: 8px 16px; background: #d32f2f; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Quitar de Academia
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarEstadisticas() {
  document.getElementById('totalMaterias').textContent = materiasAcademia.length;
  
  const carrerasUnicas = new Set(materiasAcademia.map(m => m.carreraId));
  document.getElementById('totalCarreras').textContent = carrerasUnicas.size;
  
  document.getElementById('totalAlumnos').textContent = '-';
}

// ===== MOSTRAR MATERIAS AGRUPADAS POR CARRERA CON FILTROS =====
function mostrarMateriasPorCarrera() {
  aplicarFiltrosCarreras();
}

function aplicarFiltrosCarreras() {
  const container = document.getElementById('contenidoCarreras');
  const filtroPeriodo = document.getElementById('filtroPeriodo')?.value || '';
  const filtroTurno = document.getElementById('filtroTurno')?.value || '';
  const buscador = document.getElementById('buscadorMateria')?.value.toLowerCase().trim() || '';
  
  if (todasLasMaterias.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay materias asignadas a tu academia</p>
      </div>
    `;
    return;
  }
  
  let materiasFiltradas = todasLasMaterias.filter(materia => {
    if (filtroPeriodo && materia.periodo != filtroPeriodo) {
      return false;
    }
    
    if (filtroTurno && materia.turno != filtroTurno) {
      return false;
    }
    
    if (buscador && !materia.nombre.toLowerCase().includes(buscador)) {
      return false;
    }
    
    return true;
  });
  
  if (materiasFiltradas.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No se encontraron materias con los filtros seleccionados</p>
      </div>
    `;
    return;
  }
  
  const materiasPorCarrera = {};
  
  materiasFiltradas.forEach(materia => {
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
    return;
  }
  
  if (password.length < 6) {
    mensajeDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
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
    
    // Obtener academiaId actual
    let academiaId;
    if (usuarioActual.academias && usuarioActual.academias.length > 0) {
      academiaId = usuarioActual.academias[0].academiaId;
    } else if (usuarioActual.academiaId) {
      academiaId = usuarioActual.academiaId;
    }
    
    // Verificar si el correo ya existe en la colección usuarios
    const usuariosSnapshot = await db.collection('usuarios')
      .where('email', '==', email)
      .get();
    
    let profesorId;
    
    if (!usuariosSnapshot.empty) {
      // El usuario ya existe - enlazarlo
      const docExistente = usuariosSnapshot.docs[0];
      profesorId = docExistente.id;
      const datosExistentes = docExistente.data();
      
      // Actualizar el documento existente agregando la academia si no la tiene
      const carrerasActuales = datosExistentes.carreras || [];
      
      if (!carrerasActuales.includes(academiaId)) {
        await db.collection('usuarios').doc(profesorId).update({
          carreras: firebase.firestore.FieldValue.arrayUnion(academiaId)
        });
      }
      
      mensajeDiv.textContent = `Profesor enlazado exitosamente. El usuario ya existía.`;
      mensajeDiv.style.background = '#e8f5e9';
      mensajeDiv.style.color = '#2e7d32';
      
    } else {
      // Crear nuevo usuario en Firebase Auth
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      profesorId = userCredential.user.uid;
      
      // Crear documento en Firestore
      await db.collection('usuarios').doc(profesorId).set({
        nombre: nombre,
        email: email,
        rol: 'profesor',
        carreras: [academiaId],
        activo: true,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Cerrar sesión del profesor recién creado y volver a iniciar con el coordinador
      await firebase.auth().signOut();
      
      mensajeDiv.textContent = 'Profesor registrado exitosamente';
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

// ===== VER MATERIAS DE UN PROFESOR =====
async function verMateriasProfesor(profesorId, profesorNombre) {
  try {
    ocultarTodasSecciones();
    document.getElementById('seccionMateriasProfesor').style.display = 'block';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
    document.getElementById('tituloMateriasProfesor').textContent = `Materias de ${profesorNombre}`;
    
    const profesor = profesoresAcademia.find(p => p.id === profesorId);
    if (profesor) {
      const carrerasTexto = profesor.carreras && profesor.carreras.length > 0 
        ? profesor.carreras.join(', ') 
        : 'Sin carreras';
      document.getElementById('infoProfesorSeleccionado').textContent = 
        `Email: ${profesor.email} | Carreras: ${carrerasTexto}`;
    }
    
    const container = document.getElementById('listaMateriasProfesor');
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando materias...</p>';
    
    // Buscar en profesorMaterias
    const snapshot = await db.collection('profesorMaterias')
      .where('profesorId', '==', profesorId)
      .get();
    
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>Este profesor no tiene materias asignadas</p>
        </div>
      `;
      return;
    }
    
    const materias = [];
    for (const doc of snapshot.docs) {
      const asignacion = doc.data();
      
      // Obtener datos completos de la materia
      if (asignacion.materiaId) {
        const materiaDoc = await db.collection('materias').doc(asignacion.materiaId).get();
        if (materiaDoc.exists) {
          const materiaData = materiaDoc.data();
          
          // Obtener nombre de carrera
          let carreraNombre = 'Sin carrera';
          let carreraColor = '#e0e0e0';
          
          if (materiaData.carreraId) {
            const carrera = carrerasData.find(c => c.id === materiaData.carreraId);
            if (carrera) {
              carreraNombre = carrera.nombre;
              carreraColor = carrera.color || '#43a047';
            }
          }
          
          materias.push({
            id: materiaDoc.id,
            ...materiaData,
            asignacionId: doc.id,
            carreraNombre,
            carreraColor
          });
        }
      }
    }
    
    if (materias.length === 0) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>No se pudieron cargar los detalles de las materias</p>
        </div>
      `;
      return;
    }
    
    let html = '<div style="display: grid; gap: 15px;">';
    
    materias.forEach(materia => {
      let gruposInfo = '';
      if (materia.grupos && materia.grupos.length > 0) {
        const gruposTexto = materia.grupos.map(g => 
          `${g.nombreTurno || 'Turno ' + g.turno} (${g.codigoCompleto || g.codigo})`
        ).join(', ');
        gruposInfo = `<p class="materia-info"><strong>Grupos:</strong> ${gruposTexto}</p>`;
      }
      
      html += `
        <div class="materia-card">
          <div class="materia-header">
            <h3>${materia.nombre}</h3>
            <span class="carrera-badge" style="background: ${materia.carreraColor}22; color: ${materia.carreraColor};">
              ${materia.carreraNombre}
            </span>
          </div>
          <p class="materia-info"><strong>Periodo:</strong> ${materia.periodo || '-'}</p>
          ${gruposInfo}
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error al cargar materias del profesor:', error);
    document.getElementById('listaMateriasProfesor').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar materias</p>';
  }
}