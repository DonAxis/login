// vistaAcademia.js
// Vista de Academia para Coordinadores - Solo Lectura

const auth = firebase.auth();
let usuarioActual = null;
let materiasAcademia = [];
let materiasDisponibles = [];
let carrerasData = [];
let materiaSeleccionada = null;

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

    // Verificar que tenga academia
    if (!usuarioActual.tieneAcademia) {
      alert('Tu usuario no tiene una academia asignada.\nContacta al administrador.');
      window.location.href = './controlCoordinador.html';
      return;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;
    document.getElementById('userRol').textContent = `Coordinador de ${usuarioActual.carreraId}`;
    
    if (usuarioActual.academiaNombre) {
      document.getElementById('academiaNombre').textContent = usuarioActual.academiaNombre;
    }

    console.log('Coordinador con academia autorizado:', usuarioActual.nombre);
    console.log('Academia:', usuarioActual.academiaNombre);
    
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
    console.log('Buscando academiaId:', usuarioActual.academiaId);
    
    const snapshot = await db.collection('materias')
      .where('academiaId', '==', usuarioActual.academiaId)
      .get();
    
    materiasAcademia = [];
    
    for (const doc of snapshot.docs) {
      const materia = doc.data();
      
      // Obtener nombre de la carrera
      let carreraNombre = 'Sin carrera';
      let carreraColor = '#e0e0e0';
      
      if (materia.carreraId) {
        const carrera = carrerasData.find(c => c.id === materia.carreraId);
        if (carrera) {
          carreraNombre = carrera.nombre;
          carreraColor = carrera.color || '#43a047';
        }
      }
      
      materiasAcademia.push({
        id: doc.id,
        ...materia,
        carreraNombre,
        carreraColor
      });
    }
    
    console.log(`${materiasAcademia.length} materias cargadas en la academia`);
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
            ➕ Asignar Primera Materia
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
          <span class="carrera-badge" style="background: ${materia.carreraColor}22; color: ${materia.carreraColor};">
            ${materia.carreraNombre}
          </span>
        </div>
        <p class="materia-info">Código: ${materia.codigo || 'Sin código'}</p>
        <p class="materia-info">Periodo: ${materia.periodo || '-'}</p>
        <p class="materia-info">Grupo: ${materia.grupoId || '-'}</p>
        ${materia.profesorNombre ? `<p class="materia-info">Profesor: ${materia.profesorNombre}</p>` : '<p class="materia-info" style="color: #999;">Sin profesor asignado</p>'}
        
        <div class="materia-acciones">
          <button onclick="verCalificacionesMateria('${materia.id}', '${materia.nombre}')" class="btn-ver">
            Ver Calificaciones
          </button>
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
  
  // Contar carreras únicas
  const carrerasUnicas = new Set(materiasAcademia.map(m => m.carreraId));
  document.getElementById('totalCarreras').textContent = carrerasUnicas.size;
  
  // Contar alumnos (esto se puede mejorar con una consulta real)
  document.getElementById('totalAlumnos').textContent = '-';
}

// ===== VER CALIFICACIONES =====
async function verCalificacionesMateria(materiaId, materiaNombre) {
  try {
    console.log('Cargando calificaciones de:', materiaNombre);
    
    document.getElementById('infoMateriaModal').textContent = materiaNombre;
    document.getElementById('modalCalificaciones').style.display = 'block';
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

// ===== MOSTRAR MODAL ASIGNAR MATERIA =====
async function mostrarModalAsignarMateria() {
  document.getElementById('modalAsignarMateria').style.display = 'block';
  
  // Cargar select de carreras
  const select = document.getElementById('filtroCarrera');
  select.innerHTML = '<option value="">Todas las carreras</option>';
  carrerasData.forEach(carrera => {
    select.innerHTML += `<option value="${carrera.id}">${carrera.nombre}</option>`;
  });
  
  await cargarMateriasDisponibles();
}

// ===== CARGAR MATERIAS DISPONIBLES =====
async function cargarMateriasDisponibles() {
  try {
    document.getElementById('listaMateriasDisponibles').innerHTML = 
      '<p style="text-align: center; color: #999;">Cargando...</p>';
    
    // Obtener TODAS las materias que NO están ya en esta academia
    const snapshot = await db.collection('materias').get();
    
    materiasDisponibles = [];
    const materiasEnAcademiaIds = new Set(materiasAcademia.map(m => m.id));
    
    for (const doc of snapshot.docs) {
      if (!materiasEnAcademiaIds.has(doc.id)) {
        const materia = doc.data();
        
        // Obtener nombre de carrera
        let carreraNombre = 'Sin carrera';
        let carreraColor = '#e0e0e0';
        
        if (materia.carreraId) {
          const carrera = carrerasData.find(c => c.id === materia.carreraId);
          if (carrera) {
            carreraNombre = carrera.nombre;
            carreraColor = carrera.color || '#43a047';
          }
        }
        
        materiasDisponibles.push({
          id: doc.id,
          ...materia,
          carreraNombre,
          carreraColor
        });
      }
    }
    
    console.log(`${materiasDisponibles.length} materias disponibles`);
    filtrarMateriasDisponibles();
    
  } catch (error) {
    console.error('Error al cargar materias disponibles:', error);
    document.getElementById('listaMateriasDisponibles').innerHTML = 
      '<p style="color: red; text-align: center;">Error al cargar materias</p>';
  }
}

// ===== FILTRAR MATERIAS DISPONIBLES =====
function filtrarMateriasDisponibles() {
  const filtroCarrera = document.getElementById('filtroCarrera').value;
  const container = document.getElementById('listaMateriasDisponibles');
  
  let materiasFiltradas = materiasDisponibles;
  
  if (filtroCarrera) {
    materiasFiltradas = materiasDisponibles.filter(m => m.carreraId === filtroCarrera);
  }
  
  if (materiasFiltradas.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No hay materias disponibles${filtroCarrera ? ' en esta carrera' : ''}</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  materiasFiltradas.forEach(materia => {
    html += `
      <div class="materia-item" onclick="seleccionarMateria('${materia.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${materia.nombre}</strong> (${materia.codigo || 'Sin código'})
            <br>
            <small style="color: #666;">Carrera: ${materia.carreraNombre} | Grupo: ${materia.grupoId || '-'}</small>
          </div>
          <span style="padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; background: ${materia.carreraColor}22; color: ${materia.carreraColor};">
            ${materia.carreraNombre}
          </span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ===== SELECCIONAR MATERIA =====
function seleccionarMateria(materiaId) {
  // Remover selección anterior
  document.querySelectorAll('.materia-item').forEach(item => {
    item.classList.remove('seleccionada');
  });
  
  // Seleccionar nueva
  event.currentTarget.classList.add('seleccionada');
  materiaSeleccionada = materiaId;
}

// ===== ASIGNAR MATERIA SELECCIONADA =====
async function asignarMateriaSeleccionada() {
  if (!materiaSeleccionada) {
    alert('Debes seleccionar una materia primero');
    return;
  }
  
  try {
    const materia = materiasDisponibles.find(m => m.id === materiaSeleccionada);
    
    if (!confirm(`¿Asignar "${materia.nombre}" a tu academia?\n\nEsto te permitirá verla en modo solo lectura.`)) {
      return;
    }
    
    // Actualizar la materia con los datos de academia
    await db.collection('materias').doc(materiaSeleccionada).update({
      enAcademia: true,
      academiaId: usuarioActual.academiaId,
      academiaNombre: usuarioActual.academiaNombre,
      fechaAsignacionAcademia: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert('Materia asignada exitosamente a tu academia');
    
    cerrarModalAsignarMateria();
    await cargarMateriasAcademia();
    actualizarEstadisticas();
    
  } catch (error) {
    console.error('Error al asignar materia:', error);
    alert('Error al asignar materia: ' + error.message);
  }
}

// ===== DESASIGNAR MATERIA =====
async function desasignarMateria(materiaId, materiaNombre) {
  if (!confirm(`¿Quitar "${materiaNombre}" de tu academia?\n\nLa materia seguirá existiendo en su carrera original.`)) {
    return;
  }
  
  try {
    await db.collection('materias').doc(materiaId).update({
      enAcademia: firebase.firestore.FieldValue.delete(),
      academiaId: firebase.firestore.FieldValue.delete(),
      academiaNombre: firebase.firestore.FieldValue.delete(),
      fechaAsignacionAcademia: firebase.firestore.FieldValue.delete()
    });
    
    alert('Materia removida de tu academia');
    
    await cargarMateriasAcademia();
    actualizarEstadisticas();
    
  } catch (error) {
    console.error('Error al desasignar materia:', error);
    alert('Error al quitar materia: ' + error.message);
  }
}

// ===== CERRAR MODAL ASIGNAR =====
function cerrarModalAsignarMateria() {
  document.getElementById('modalAsignarMateria').style.display = 'none';
  materiaSeleccionada = null;
}

// ===== VOLVER A COORDINADOR =====
function volverCoordinador() {
  window.location.href = './controlCoordinador.html';
}

// Click fuera del modal para cerrar
window.onclick = function(event) {
  const modalCal = document.getElementById('modalCalificaciones');
  const modalAsignar = document.getElementById('modalAsignarMateria');
  
  if (event.target === modalCal) {
    cerrarModalCalificaciones();
  }
  if (event.target === modalAsignar) {
    cerrarModalAsignarMateria();
  }
}

console.log('Vista Academia - Solo Lectura cargada');