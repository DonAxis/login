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

// ===== MOSTRAR MODAL ASIGNAR MATERIA =====
async function mostrarModalAsignarMateria() {
  document.getElementById('modalAsignarMateria').style.display = 'block';
  
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
    
    const snapshot = await db.collection('materias').get();
    
    materiasDisponibles = [];
    const materiasEnAcademiaIds = new Set(materiasAcademia.map(m => m.id));
    
    for (const doc of snapshot.docs) {
      if (!materiasEnAcademiaIds.has(doc.id)) {
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
            <strong>${materia.nombre}</strong>
            <br>
            <small style="color: #666;">Carrera: ${materia.carreraNombre} | Periodo: ${materia.periodo || '-'}</small>
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
  document.querySelectorAll('.materia-item').forEach(item => {
    item.classList.remove('seleccionada');
  });
  
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
    
    let academiaId, academiaNombre;
    
    if (usuarioActual.academias && usuarioActual.academias.length > 1) {
      let opciones = 'Selecciona la academia:\n\n';
      usuarioActual.academias.forEach((a, idx) => {
        opciones += `${idx + 1}. ${a.academiaNombre} (${a.academiaId})\n`;
      });
      
      const seleccion = prompt(opciones + '\nIngresa el número:');
      const idx = parseInt(seleccion) - 1;
      
      if (idx < 0 || idx >= usuarioActual.academias.length) {
        alert('Selección inválida');
        return;
      }
      
      academiaId = usuarioActual.academias[idx].academiaId;
      academiaNombre = usuarioActual.academias[idx].academiaNombre;
    } else if (usuarioActual.academias && usuarioActual.academias.length === 1) {
      academiaId = usuarioActual.academias[0].academiaId;
      academiaNombre = usuarioActual.academias[0].academiaNombre;
    } else {
      academiaId = usuarioActual.academiaId;
      academiaNombre = usuarioActual.academiaNombre;
    }
    
    if (!confirm(`¿Asignar "${materia.nombre}" a ${academiaNombre}?`)) {
      return;
    }
    
    await db.collection('materias').doc(materiaSeleccionada).update({
      enAcademia: true,
      academiaId: academiaId,
      academiaNombre: academiaNombre,
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
  const modalAsignar = document.getElementById('modalAsignarMateria');
  
  if (event.target === modalAsignar) {
    cerrarModalAsignarMateria();
  }
}

console.log('Vista Academia');