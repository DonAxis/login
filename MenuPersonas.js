// MenuPersonas.js - SISTEMA CORREGIDO
// Registro de alumnos con codigo de grupo automatico

const auth = firebase.auth();
let alumnosData = [];
let usuarioActual = null;
let carreraActual = null;

// Proteccion de pagina
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No hay sesion activa');
    alert('Debes iniciar sesion para acceder');
    window.location.href = 'login.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists) {
      console.log('Usuario no encontrado en Firestore');
      await auth.signOut();
      window.location.href = 'login.html';
      return;
    }

    usuarioActual = userDoc.data();
    usuarioActual.uid = user.uid;

    // Verificar que tenga permiso (profesor o admin)
    if (usuarioActual.rol !== 'profesor' && usuarioActual.rol !== 'admin') {
      console.log('No tienes permisos para acceder');
      alert('No tienes permisos para acceder a esta pagina');
      window.location.href = 'login.html';
      return;
    }

    console.log('Usuario autorizado:', usuarioActual.nombre, '- Rol:', usuarioActual.rol);
    
    // Cargar datos de la carrera
    await cargarDatosCarrera();
    
    mostrarInfoUsuario();
    inicializar();
    
  } catch (error) {
    console.error('Error al verificar usuario:', error);
    alert('Error al verificar permisos');
    window.location.href = 'login.html';
  }
});

// Cargar datos de la carrera
async function cargarDatosCarrera() {
  try {
    if (!usuarioActual.carreraId) {
      console.error('Usuario sin carrera asignada');
      return;
    }
    
    const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
    
    if (carreraDoc.exists) {
      carreraActual = {
        id: carreraDoc.id,
        ...carreraDoc.data()
      };
      console.log('Carrera cargada:', carreraActual.nombre);
    }
  } catch (error) {
    console.error('Error al cargar carrera:', error);
  }
}

function mostrarInfoUsuario() {
  const h1 = document.querySelector('h1');
  if (h1 && usuarioActual) {
    h1.innerHTML = `
      Registro de Alumnos
      <span style="float: right; font-size: 0.6em; color: #666;">
        ${usuarioActual.nombre} (${usuarioActual.rol})
        <button onclick="cerrarSesion()" class="botAzu" style="margin-left: 10px;">Salir</button>
      </span>
    `;
  }
}

async function cerrarSesion() {
  if (confirm('Cerrar sesion?')) {
    try {
      await auth.signOut();
      sessionStorage.clear();
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error al cerrar sesion:', error);
      alert('Error al cerrar sesion');
    }
  }
}

async function inicializar() {
  console.log('Cargando datos desde Firebase...');
  await cargarDatosFirebase();
}

async function cargarDatosFirebase() {
  try {
    const snapshot = await db.collection('alumnos')
      .where('carreraId', '==', usuarioActual.carreraId)
      .orderBy('matricula')
      .get();
    
    alumnosData = [];
    snapshot.forEach(doc => {
      alumnosData.push({
        docId: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`${alumnosData.length} alumnos cargados desde Firebase`);
    mostrarTabla(alumnosData);
  } catch (error) {
    console.error('Error al cargar datos:', error);
    document.getElementById("tabla-alumnos").innerHTML = 
      '<p style="color: red;">Error al cargar datos de Firebase.</p>';
  }
}

function mostrarTabla(alumnos) {
  if (alumnos.length === 0) {
    document.getElementById("tabla-alumnos").innerHTML = 
      '<p style="color: #999; padding: 20px;">No hay alumnos registrados. Agrega el primero!</p>';
    return;
  }

  let tabla = `
    <table>
      <thead>
        <tr>
          <th>Matricula</th>
          <th>Nombre</th>
          <th>Email</th>
          <th>Grupo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  alumnos.forEach((alumno, index) => {
    tabla += `
      <tr>
        <td><strong>${alumno.matricula || "-"}</strong></td>
        <td>${alumno.nombre || "-"}</td>
        <td>${alumno.email || "-"}</td>
        <td><strong>${alumno.codigoGrupo || "-"}</strong></td>
        <td>
          <button onclick="editarAlumno(${index})" class="btn-editar">Editar</button>
          <button onclick="eliminarAlumno(${index})" class="btn-eliminar">Eliminar</button>
        </td>
      </tr>
    `;
  });

  tabla += `</tbody></table>`;
  
  document.getElementById("tabla-alumnos").innerHTML = tabla;
}

function mostrarFormularioAgregar() {
  if (!carreraActual) {
    alert('Error: No se han cargado los datos de la carrera');
    return;
  }
  
  document.getElementById('tituloModal').textContent = 'Agregar Nuevo Alumno';
  document.getElementById('indiceAlumno').value = '';
  document.getElementById('docId').value = '';
  document.getElementById('formAlumno').reset();
  
  // Cargar opciones de periodo
  cargarOpcionesPeriodo();
  
  // Mostrar preview del codigo de grupo
  actualizarPreviewGrupo();
  
  document.getElementById('modalFormulario').style.display = 'block';
}

function cargarOpcionesPeriodo() {
  const selectPeriodo = document.getElementById('periodo');
  selectPeriodo.innerHTML = '<option value="">Seleccionar periodo...</option>';
  
  if (carreraActual && carreraActual.numeroPeriodos) {
    for (let i = 1; i <= carreraActual.numeroPeriodos; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `${i}°`;
      selectPeriodo.appendChild(option);
    }
  }
}

function editarAlumno(index) {
  const alumno = alumnosData[index];
  
  document.getElementById('tituloModal').textContent = 'Editar Alumno';
  document.getElementById('indiceAlumno').value = index;
  document.getElementById('docId').value = alumno.docId;
  
  document.getElementById('matricula').value = alumno.matricula || '';
  document.getElementById('nombre').value = alumno.nombre || '';
  document.getElementById('email').value = alumno.email || '';
  document.getElementById('periodo').value = alumno.periodo || '';
  document.getElementById('turno').value = alumno.turno || '1';
  document.getElementById('orden').value = alumno.orden || '01';
  
  cargarOpcionesPeriodo();
  actualizarPreviewGrupo();
  
  document.getElementById('modalFormulario').style.display = 'block';
}

function actualizarPreviewGrupo() {
  const periodo = document.getElementById('periodo').value;
  const turno = document.getElementById('turno').value;
  const orden = document.getElementById('orden').value || '01';
  
  const previewDiv = document.getElementById('previewGrupo');
  
  if (!periodo || !turno) {
    previewDiv.innerHTML = '<em style="color: #999;">Selecciona periodo y turno para ver el codigo</em>';
    return;
  }
  
  if (!carreraActual) {
    previewDiv.innerHTML = '<em style="color: #f44336;">Error: Carrera no cargada</em>';
    return;
  }
  
  const codigoGrupo = generarCodigoGrupo(periodo, turno, orden);
  
  const turnosNombres = {
    '1': 'Matutino',
    '2': 'Vespertino',
    '3': 'Nocturno',
    '4': 'Sabatino'
  };
  
  previewDiv.innerHTML = `
    <strong style="color: #667eea; font-size: 1.2rem;">${codigoGrupo}</strong>
    <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
      ${turnosNombres[turno]} - Periodo ${periodo} - Grupo ${orden}
    </div>
  `;
}

function generarCodigoGrupo(periodo, turno, orden) {
  if (!carreraActual || !carreraActual.codigo) {
    return 'ERROR';
  }
  
  // Formato: CARRERA-TPXX
  // T = Turno (1-4)
  // P = Periodo (1-9)
  // XX = Orden (01-99)
  
  const ordenFormateado = orden.toString().padStart(2, '0');
  return `${carreraActual.codigo}-${turno}${periodo}${ordenFormateado}`;
}

async function guardarAlumno(event) {
  event.preventDefault();
  
  const docId = document.getElementById('docId').value;
  const periodo = document.getElementById('periodo').value;
  const turno = document.getElementById('turno').value;
  const orden = document.getElementById('orden').value || '01';
  
  if (!periodo || !turno) {
    alert('Debes seleccionar periodo y turno');
    return;
  }
  
  const codigoGrupo = generarCodigoGrupo(periodo, turno, orden);
  
  const alumnoData = {
    matricula: document.getElementById('matricula').value.trim(),
    nombre: document.getElementById('nombre').value.trim(),
    email: document.getElementById('email').value.trim(),
    periodo: parseInt(periodo),
    turno: turno,
    orden: orden,
    codigoGrupo: codigoGrupo,
    carreraId: usuarioActual.carreraId,
    fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
    actualizadoPor: usuarioActual.uid
  };
  
  try {
    if (docId === '') {
      await db.collection('alumnos').add(alumnoData);
      console.log('Alumno agregado a Firebase');
      mostrarMensaje('Alumno agregado correctamente', 'exito');
    } else {
      await db.collection('alumnos').doc(docId).update(alumnoData);
      console.log('Alumno actualizado en Firebase');
      mostrarMensaje('Alumno actualizado correctamente', 'exito');
    }
    
    await cargarDatosFirebase();
    cerrarModal();
  } catch (error) {
    console.error('Error al guardar:', error);
    mostrarMensaje('Error al guardar: ' + error.message, 'error');
  }
}

async function eliminarAlumno(index) {
  const alumno = alumnosData[index];
  
  if (confirm(`Estas seguro de eliminar a ${alumno.nombre}?`)) {
    try {
      await db.collection('alumnos').doc(alumno.docId).delete();
      console.log('Alumno eliminado de Firebase');
      mostrarMensaje('Alumno eliminado correctamente', 'exito');
      
      await cargarDatosFirebase();
    } catch (error) {
      console.error('Error al eliminar:', error);
      mostrarMensaje('Error al eliminar: ' + error.message, 'error');
    }
  }
}

function cerrarModal() {
  document.getElementById('modalFormulario').style.display = 'none';
}

async function resetearDatos() {
  if (confirm('Esto eliminara TODOS los alumnos de Firebase. Continuar?')) {
    try {
      const snapshot = await db.collection('alumnos')
        .where('carreraId', '==', usuarioActual.carreraId)
        .get();
      const batch = db.batch();
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log('Todos los datos eliminados');
      mostrarMensaje('Datos reseteados correctamente', 'exito');
      
      await cargarDatosFirebase();
    } catch (error) {
      console.error('Error al resetear:', error);
      mostrarMensaje('Error al resetear: ' + error.message, 'error');
    }
  }
}

function mostrarMensaje(texto, tipo) {
  const contenedor = document.getElementById('contenido');
  const mensaje = document.createElement('div');
  mensaje.className = tipo === 'exito' ? 'mensaje-exito' : 'mensaje-error';
  mensaje.textContent = texto;
  
  contenedor.insertBefore(mensaje, contenedor.firstChild);
  
  setTimeout(() => {
    mensaje.remove();
  }, 3000);
}

window.onclick = function(event) {
  const modal = document.getElementById('modalFormulario');
  if (event.target === modal) {
    cerrarModal();
  }
}

console.log('MenuPersonas con codigo de grupo automatico cargado');