// coordinadorAcademia.js
// Sistema para Coordinador de Academia - Gestión de profesores y consulta de calificaciones

const auth = firebase.auth();
let usuarioActual = null;
let materiasAcademia = [];
let profesoresAcademia = [];

// ===== PROTECCIÓN =====
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert('Debes iniciar sesión');
    window.location.href = 'login.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists || userDoc.data().rol !== 'coordinadorAcademia') {
      alert('Solo coordinadores de academia pueden acceder');
      window.location.href = 'login.html';
      return;
    }

    usuarioActual = {
      uid: user.uid,
      ...userDoc.data()
    };

    document.getElementById('userName').textContent = usuarioActual.nombre;
    document.getElementById('userEmail').textContent = user.email;

    if (usuarioActual.academiaNombre) {
      document.getElementById('academiaNombre').textContent = usuarioActual.academiaNombre;
    }

    console.log('Coordinador Academia autorizado:', usuarioActual.nombre);
    
    await cargarDatos();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = 'login.html';
  }
});

// ===== CARGAR DATOS =====
async function cargarDatos() {
  try {
    // Cargar materias asociadas a esta academia
    await cargarMaterias();
    
    // Cargar profesores
    await cargarProfesores();
    
    actualizarEstadisticas();
    
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }
}

// ===== CARGAR MATERIAS =====
async function cargarMaterias() {
  try {
    console.log('Cargando materias de la academia...');
    
    // Las materias que tienen el campo 'academiaId' igual al UID del coordinador
    const snapshot = await db.collection('materias')
      .where('academiaId', '==', usuarioActual.uid)
      .get();
    
    materiasAcademia = [];
    
    for (const doc of snapshot.docs) {
      const materia = doc.data();
      
      // Obtener nombre de la carrera
      let carreraNombre = 'Sin carrera';
      if (materia.carreraId) {
        try {
          const carreraDoc = await db.collection('carreras').doc(materia.carreraId).get();
          if (carreraDoc.exists) {
            carreraNombre = carreraDoc.data().nombre;
          }
        } catch (error) {
          console.error('Error al cargar carrera:', error);
        }
      }
      
      materiasAcademia.push({
        id: doc.id,
        ...materia,
        carreraNombre
      });
    }
    
    console.log(`${materiasAcademia.length} materias cargadas`);
    
  } catch (error) {
    console.error('Error al cargar materias:', error);
  }
}

// ===== CARGAR PROFESORES =====
async function cargarProfesores() {
  try {
    console.log('Cargando profesores de la academia...');
    
    // Profesores que tienen 'academiaId' igual al coordinador
    const snapshot = await db.collection('usuarios')
      .where('rol', '==', 'profesor')
      .where('academiaId', '==', usuarioActual.uid)
      .get();
    
    profesoresAcademia = [];
    
    snapshot.forEach(doc => {
      profesoresAcademia.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`${profesoresAcademia.length} profesores cargados`);
    
  } catch (error) {
    console.error('Error al cargar profesores:', error);
  }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarEstadisticas() {
  document.getElementById('totalMaterias').textContent = materiasAcademia.length;
  document.getElementById('totalProfesores').textContent = profesoresAcademia.length;
}

// ===== MOSTRAR MATERIAS =====
function mostrarMaterias() {
  document.getElementById('contenidoMaterias').style.display = 'block';
  
  const container = document.getElementById('listaMaterias');
  
  if (materiasAcademia.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay materias registradas en tu academia</p>
        <p style="margin-top: 10px;">
          <button onclick="window.location.href='gestionMaterias.html'" class="btn-ver">
            ➕ Registrar Materia
          </button>
        </p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  materiasAcademia.forEach(materia => {
    html += `
      <div class="materia-card">
        <div class="materia-header">
          <h3>${materia.nombre}</h3>
          <span class="carrera-badge">${materia.carreraNombre}</span>
        </div>
        <p class="materia-info">Código: ${materia.codigo || 'Sin código'}</p>
        <p class="materia-info">Periodo: ${materia.periodo || '-'}</p>
        ${materia.profesorNombre ? `<p class="materia-info">Profesor: ${materia.profesorNombre}</p>` : ''}
        
        <div class="materia-acciones">
          <button onclick="verCalificacionesMateria('${materia.id}', '${materia.nombre}')" class="btn-ver">
            Ver Calificaciones
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ===== VER CALIFICACIONES DE MATERIA (SOLO LECTURA) =====
async function verCalificacionesMateria(materiaId, materiaNombre) {
  try {
    console.log('Cargando calificaciones de:', materiaNombre);
    
    document.getElementById('infoMateriaModal').textContent = materiaNombre;
    document.getElementById('modalCalificaciones').style.display = 'block';
    document.getElementById('contenidoCalificaciones').innerHTML = 
      '<p style="text-align: center; color: #999;">Cargando calificaciones...</p>';
    
    // Obtener calificaciones de esta materia
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
    
    // Construir tabla de calificaciones
    let html = `
      <table class="tabla-calificaciones">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Matrícula</th>
            <th>Parcial 1</th>
            <th>Parcial 2</th>
            <th>Parcial 3</th>
            <th>Promedio</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    const calificaciones = [];
    
    for (const doc of snapshot.docs) {
      const cal = doc.data();
      
      // Obtener nombre del alumno
      let alumnoNombre = 'Desconocido';
      let matricula = '-';
      
      if (cal.alumnoId) {
        try {
          const alumnoDoc = await db.collection('usuarios').doc(cal.alumnoId).get();
          if (alumnoDoc.exists) {
            alumnoNombre = alumnoDoc.data().nombre;
            matricula = alumnoDoc.data().matricula || '-';
          }
        } catch (error) {
          console.error('Error al cargar alumno:', error);
        }
      }
      
      const p1 = cal.parciales?.parcial1 ?? '-';
      const p2 = cal.parciales?.parcial2 ?? '-';
      const p3 = cal.parciales?.parcial3 ?? '-';
      
      // Calcular promedio
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
          const prom = cals.reduce((a, b) => a + b, 0) / cals.length;
          promedio = prom.toFixed(1);
        }
      }
      
      calificaciones.push({
        alumnoNombre,
        matricula,
        p1,
        p2,
        p3,
        promedio
      });
    }
    
    // Ordenar por nombre de alumno
    calificaciones.sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre));
    
    calificaciones.forEach(cal => {
      html += `
        <tr>
          <td><strong>${cal.alumnoNombre}</strong></td>
          <td>${cal.matricula}</td>
          <td>${cal.p1}</td>
          <td>${cal.p2}</td>
          <td>${cal.p3}</td>
          <td><strong>${cal.promedio}</strong></td>
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

// ===== CERRAR MODAL CALIFICACIONES =====
function cerrarModalCalificaciones() {
  document.getElementById('modalCalificaciones').style.display = 'none';
}

// ===== GESTIONAR PROFESORES =====
function mostrarGestionProfesores() {
  alert('Funcionalidad en desarrollo\n\nAquí podrás:\n- Crear nuevos profesores\n- Asignar materias\n- Ver carga académica');
}

// ===== MOSTRAR REPORTES =====
function mostrarReportes() {
  alert('Funcionalidad en desarrollo\n\nAquí podrás:\n- Ver estadísticas de desempeño\n- Exportar reportes\n- Analizar tendencias');
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

// Click fuera del modal para cerrar
window.onclick = function(event) {
  const modal = document.getElementById('modalCalificaciones');
  if (event.target === modal) {
    cerrarModalCalificaciones();
  }
}

console.log('Sistema Coordinador Academia cargado');