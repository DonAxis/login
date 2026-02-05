// controlCaja.js
// Sistema de gestión de pagos - Activar/Desactivar alumnos

const auth = firebase.auth();
let alumnosData = [];
let alumnosFiltrados = [];
let filtroActual = 'todos';

// ===== PROTECCIÓN =====
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert('Debes iniciar sesión');
    window.location.href = 'login.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists || userDoc.data().rol !== 'controlCaja') {
      alert('Solo personal de caja puede acceder');
      window.location.href = 'login.html';
      return;
    }

    const userData = userDoc.data();
    document.getElementById('userName').textContent = userData.nombre;
    document.getElementById('userEmail').textContent = user.email;

    console.log('Control Caja autorizado');
    await cargarAlumnos();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = 'login.html';
  }
});

// ===== CARGAR ALUMNOS =====
async function cargarAlumnos() {
  try {
    console.log('Cargando alumnos...');
    
    // Cargar todos los usuarios con rol 'alumno'
    const snapshot = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .orderBy('nombre')
      .get();
    
    alumnosData = [];
    
    snapshot.forEach(doc => {
      const alumno = doc.data();
      alumnosData.push({
        uid: doc.id,
        ...alumno
      });
    });
    
    console.log(`${alumnosData.length} alumnos cargados`);
    
    alumnosFiltrados = [...alumnosData];
    actualizarEstadisticas();
    mostrarAlumnos();
    
  } catch (error) {
    console.error('Error al cargar alumnos:', error);
    document.getElementById('listaAlumnos').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar datos</p>';
  }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarEstadisticas() {
  const total = alumnosData.length;
  const activos = alumnosData.filter(a => a.activo).length;
  const inactivos = total - activos;
  
  document.getElementById('totalAlumnos').textContent = total;
  document.getElementById('alumnosActivos').textContent = activos;
  document.getElementById('alumnosInactivos').textContent = inactivos;
}

// ===== MOSTRAR ALUMNOS =====
function mostrarAlumnos() {
  const container = document.getElementById('listaAlumnos');
  
  if (alumnosFiltrados.length === 0) {
    container.innerHTML = `
      <div class="sin-resultados">
        <p>No se encontraron alumnos</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  alumnosFiltrados.forEach(alumno => {
    const estadoClass = alumno.activo ? 'activo' : 'inactivo';
    const estadoBadge = alumno.activo ? 'estado-activo' : 'estado-inactivo';
    const estadoTexto = alumno.activo ? '✓ Al corriente' : '✗ Debe pagos';
    
    // Obtener información adicional
    let infoCarrera = '';
    let infoGrupo = '';
    
    if (alumno.carreraNombre) {
      infoCarrera = `<p>${alumno.carreraNombre}</p>`;
    }
    
    if (alumno.grupoNombre) {
      infoGrupo = `<p>Grupo: ${alumno.grupoNombre}</p>`;
    }
    
    html += `
      <div class="alumno-card ${alumno.activo ? '' : 'inactivo'}">
        <div class="alumno-info">
          <h3>${alumno.nombre}</h3>
          <p>${alumno.email}</p>
          ${alumno.matricula ? `<p>Matrícula: ${alumno.matricula}</p>` : ''}
          ${infoCarrera}
          ${infoGrupo}
          <p style="margin-top: 8px;">
            <span class="estado-badge ${estadoBadge}">${estadoTexto}</span>
          </p>
        </div>
        <div class="alumno-acciones">
          ${alumno.activo ? 
            `<button onclick="desactivarAlumno('${alumno.uid}', '${alumno.nombre}')" class="btn-desactivar">
              Desactivar
            </button>` :
            `<button onclick="activarAlumno('${alumno.uid}', '${alumno.nombre}')" class="btn-activar">
              ✓ Activar
            </button>`
          }
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ===== ACTIVAR ALUMNO =====
async function activarAlumno(uid, nombre) {
  if (!confirm(`¿Activar a ${nombre}?\n\nEsto significa que ha pagado y puede acceder al sistema.`)) {
    return;
  }
  
  try {
    await db.collection('usuarios').doc(uid).update({
      activo: true,
      fechaActivacion: firebase.firestore.FieldValue.serverTimestamp(),
      activadoPor: auth.currentUser.uid
    });
    
    console.log(`✓ Alumno ${nombre} activado`);
    
    // Actualizar localmente
    const alumno = alumnosData.find(a => a.uid === uid);
    if (alumno) alumno.activo = true;
    
    aplicarFiltros();
    actualizarEstadisticas();
    mostrarAlumnos();
    
    // Mostrar notificación
    mostrarNotificacion(`✓ ${nombre} activado correctamente`, 'success');
    
  } catch (error) {
    console.error('Error al activar:', error);
    alert('Error al activar alumno');
  }
}

// ===== DESACTIVAR ALUMNO =====
async function desactivarAlumno(uid, nombre) {
  if (!confirm(`¿Desactivar a ${nombre}?\n\nEsto bloqueará su acceso al sistema hasta que pague.`)) {
    return;
  }
  
  try {
    await db.collection('usuarios').doc(uid).update({
      activo: false,
      fechaDesactivacion: firebase.firestore.FieldValue.serverTimestamp(),
      desactivadoPor: auth.currentUser.uid
    });
    
    console.log(`✗ Alumno ${nombre} desactivado`);
    
    // Actualizar localmente
    const alumno = alumnosData.find(a => a.uid === uid);
    if (alumno) alumno.activo = false;
    
    aplicarFiltros();
    actualizarEstadisticas();
    mostrarAlumnos();
    
    // Mostrar notificación
    mostrarNotificacion(`✗ ${nombre} desactivado`, 'warning');
    
  } catch (error) {
    console.error('Error al desactivar:', error);
    alert('Error al desactivar alumno');
  }
}

// ===== BUSCAR ALUMNOS =====
function buscarAlumnos() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  
  if (!searchTerm) {
    alumnosFiltrados = [...alumnosData];
  } else {
    alumnosFiltrados = alumnosData.filter(alumno => {
      const nombre = (alumno.nombre || '').toLowerCase();
      const email = (alumno.email || '').toLowerCase();
      const matricula = (alumno.matricula || '').toLowerCase();
      
      return nombre.includes(searchTerm) || 
             email.includes(searchTerm) || 
             matricula.includes(searchTerm);
    });
  }
  
  aplicarFiltros();
  mostrarAlumnos();
}

// ===== LIMPIAR BÚSQUEDA =====
function limpiarBusqueda() {
  document.getElementById('searchInput').value = '';
  filtroActual = 'todos';
  
  // Quitar clase active de todos los botones
  document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.filtro-btn').classList.add('active');
  
  alumnosFiltrados = [...alumnosData];
  mostrarAlumnos();
}

// ===== FILTRAR POR ESTADO =====
function filtrarPorEstado(estado) {
  filtroActual = estado;
  
  // Actualizar botones activos
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  aplicarFiltros();
  mostrarAlumnos();
}

// ===== APLICAR FILTROS =====
function aplicarFiltros() {
  // Primero aplicar búsqueda si hay texto
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  
  if (searchTerm) {
    alumnosFiltrados = alumnosData.filter(alumno => {
      const nombre = (alumno.nombre || '').toLowerCase();
      const email = (alumno.email || '').toLowerCase();
      const matricula = (alumno.matricula || '').toLowerCase();
      
      return nombre.includes(searchTerm) || 
             email.includes(searchTerm) || 
             matricula.includes(searchTerm);
    });
  } else {
    alumnosFiltrados = [...alumnosData];
  }
  
  // Luego aplicar filtro de estado
  if (filtroActual === 'activo') {
    alumnosFiltrados = alumnosFiltrados.filter(a => a.activo);
  } else if (filtroActual === 'inactivo') {
    alumnosFiltrados = alumnosFiltrados.filter(a => !a.activo);
  }
}

// ===== MOSTRAR NOTIFICACIÓN =====
function mostrarNotificacion(mensaje, tipo) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;
  
  if (tipo === 'success') {
    notif.style.background = '#2e7d32';
    notif.style.color = 'white';
  } else if (tipo === 'warning') {
    notif.style.background = '#f57c00';
    notif.style.color = 'white';
  }
  
  notif.textContent = mensaje;
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// ===== CERRAR SESIÓN =====
async function cerrarSesion() {
  if (confirm('¿Cerrar sesión?')) {
    try {
      await auth.signOut();
      sessionStorage.clear();
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('Error al cerrar sesión');
    }
  }
}

// Estilos de animación
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

console.log('Sistema Control Caja cargado');