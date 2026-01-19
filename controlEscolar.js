// controlEscolar.js
// Panel de Control Escolar - Acceso Global a Calificaciones

const auth = firebase.auth();
let usuarioActual = null;
let carrerasData = [];
let gruposData = [];
let materiasData = [];
let alumnosData = [];
let calificacionesData = [];
let periodoActual = '';

// ===== PROTECCIÓN DE PÁGINA =====
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No hay sesión activa');
    alert('Debes iniciar sesión para acceder');
    window.location.href = 'login.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists) {
      console.log('Usuario no encontrado');
      await auth.signOut();
      window.location.href = 'login.html';
      return;
    }

    usuarioActual = userDoc.data();
    usuarioActual.uid = user.uid;

    // Verificar que sea Control Escolar
    if (usuarioActual.rol !== 'controlEscolar') {
      console.log('No tienes permisos para acceder');
      alert('Solo personal de Control Escolar puede acceder a esta página');
      window.location.href = 'login.html';
      return;
    }

    console.log('Usuario autorizado:', usuarioActual.nombre);
    
    // Mostrar info del usuario
    document.getElementById('infoUsuario').textContent = 
      `${usuarioActual.nombre} - Control Escolar`;
    
    // Inicializar sistema
    await inicializar();
    
  } catch (error) {
    console.error('Error al verificar usuario:', error);
    alert('Error al verificar permisos');
    window.location.href = 'login.html';
  }
});

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

// ===== INICIALIZACIÓN =====
async function inicializar() {
  console.log('Inicializando Control Escolar...');
  
  try {
    // Cargar periodo actual
    await cargarPeriodoActual();
    
    // Cargar datos base
    await Promise.all([
      cargarCarreras(),
      cargarAlumnos(),
      cargarMaterias()
    ]);
    
    // Llenar selectores
    llenarSelectorCarreras();
    llenarSelectorPeriodos();
    
    // Actualizar estadísticas
    actualizarEstadisticas();
    
    console.log('Sistema inicializado');
    
  } catch (error) {
    console.error('Error al inicializar:', error);
    alert('Error al cargar datos del sistema');
  }
}

// ===== CARGAR PERIODO ACTUAL =====
async function cargarPeriodoActual() {
  try {
    const configDoc = await db.collection('config').doc('periodoActual').get();
    
    if (configDoc.exists) {
      periodoActual = configDoc.data().periodo;
      document.getElementById('periodoActual').textContent = periodoActual;
      console.log('Periodo actual:', periodoActual);
    } else {
      periodoActual = '2026-1';
      document.getElementById('periodoActual').textContent = periodoActual;
    }
  } catch (error) {
    console.error('Error al cargar periodo:', error);
    periodoActual = '2026-1';
  }
}

// ===== CARGAR CARRERAS =====
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
    
    console.log(`${carrerasData.length} carreras cargadas`);
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

// ===== CARGAR ALUMNOS =====
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
    
    console.log(`${alumnosData.length} alumnos cargados`);
  } catch (error) {
    console.error('Error al cargar alumnos:', error);
  }
}

// ===== CARGAR MATERIAS =====
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
    
    console.log(`${materiasData.length} materias cargadas`);
  } catch (error) {
    console.error('Error al cargar materias:', error);
  }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarEstadisticas() {
  document.getElementById('totalCarreras').textContent = carrerasData.length;
  document.getElementById('totalAlumnos').textContent = alumnosData.length;
  document.getElementById('totalMaterias').textContent = materiasData.length;
}

// ===== LLENAR SELECTOR DE CARRERAS =====
function llenarSelectorCarreras() {
  const select = document.getElementById('filtroCarrera');
  select.innerHTML = '<option value="">Todas las carreras</option>';
  
  carrerasData.forEach(carrera => {
    select.innerHTML += `<option value="${carrera.id}">${carrera.nombre}</option>`;
  });
}

// ===== LLENAR SELECTOR DE PERIODOS =====
function llenarSelectorPeriodos() {
  const select = document.getElementById('filtroPeriodo');
  const periodos = ['2024-1', '2024-2', '2025-1', '2025-2', '2026-1', '2026-2', '2027-1', '2027-2', '2028-1', '2028-2'];
  
  select.innerHTML = `<option value="">${periodoActual} (actual)</option>`;
  
  periodos.forEach(periodo => {
    if (periodo !== periodoActual) {
      select.innerHTML += `<option value="${periodo}">${periodo}</option>`;
    }
  });
}

// ===== CARGAR GRUPOS POR CARRERA =====
async function cargarGruposPorCarrera() {
  const carreraId = document.getElementById('filtroCarrera').value;
  const selectGrupo = document.getElementById('filtroGrupo');
  const selectMateria = document.getElementById('filtroMateria');
  
  selectGrupo.innerHTML = '<option value="">Todos los grupos</option>';
  selectMateria.innerHTML = '<option value="">Todas las materias</option>';
  
  if (!carreraId) {
    gruposData = [];
    return;
  }
  
  try {
    const snapshot = await db.collection('grupos')
      .where('carreraId', '==', carreraId)
      .where('activo', '==', true)
      .orderBy('nombre')
      .get();
    
    gruposData = [];
    snapshot.forEach(doc => {
      gruposData.push({
        id: doc.id,
        ...doc.data()
      });
      selectGrupo.innerHTML += `<option value="${doc.id}">${doc.data().nombre}</option>`;
    });
    
    console.log(`${gruposData.length} grupos cargados`);
  } catch (error) {
    console.error('Error al cargar grupos:', error);
  }
}

// ===== CARGAR MATERIAS POR GRUPO =====
async function cargarMateriasPorGrupo() {
  const grupoId = document.getElementById('filtroGrupo').value;
  const selectMateria = document.getElementById('filtroMateria');
  
  selectMateria.innerHTML = '<option value="">Todas las materias</option>';
  
  if (!grupoId) return;
  
  const carreraId = document.getElementById('filtroCarrera').value;
  
  // Filtrar materias de esa carrera
  const materiasFiltradas = materiasData.filter(m => m.carreraId === carreraId);
  
  materiasFiltradas.forEach(materia => {
    selectMateria.innerHTML += `<option value="${materia.id}">${materia.nombre}</option>`;
  });
}

// ===== APLICAR FILTROS =====
async function aplicarFiltros() {
  const carreraId = document.getElementById('filtroCarrera').value;
  const grupoId = document.getElementById('filtroGrupo').value;
  const materiaId = document.getElementById('filtroMateria').value;
  const periodo = document.getElementById('filtroPeriodo').value || periodoActual;
  
  if (!carreraId && !grupoId && !materiaId) {
    alert('Debes seleccionar al menos un filtro (Carrera, Grupo o Materia)');
    return;
  }
  
  console.log('Aplicando filtros:', { carreraId, grupoId, materiaId, periodo });
  
  try {
    // Construir query base
    let query = db.collection('calificaciones').where('periodo', '==', periodo);
    
    // Agregar filtros
    if (materiaId) {
      query = query.where('materiaId', '==', materiaId);
    }
    
    if (grupoId) {
      query = query.where('grupoId', '==', grupoId);
    }
    
    const snapshot = await query.get();
    
    calificacionesData = [];
    snapshot.forEach(doc => {
      calificacionesData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`${calificacionesData.length} calificaciones encontradas`);
    
    // Filtrar por carrera si se especificó (ya que no podemos hacer query directo)
    if (carreraId && !grupoId) {
      const gruposCarrera = gruposData.map(g => g.id);
      calificacionesData = calificacionesData.filter(cal => 
        gruposCarrera.includes(cal.grupoId)
      );
    }
    
    mostrarCalificaciones();
    
  } catch (error) {
    console.error('Error al buscar calificaciones:', error);
    alert('Error al buscar calificaciones');
  }
}

// ===== MOSTRAR CALIFICACIONES =====
function mostrarCalificaciones() {
  const container = document.getElementById('tablaCalificaciones');
  const titulo = document.getElementById('tituloTabla');
  
  if (calificacionesData.length === 0) {
    container.innerHTML = `
      <div class="sin-datos">
        <p>No se encontraron calificaciones con los filtros seleccionados</p>
      </div>
    `;
    titulo.textContent = 'Sin resultados';
    return;
  }
  
  // Obtener info de filtros
  const carreraId = document.getElementById('filtroCarrera').value;
  const grupoId = document.getElementById('filtroGrupo').value;
  const materiaId = document.getElementById('filtroMateria').value;
  
  let tituloTexto = 'Calificaciones';
  
  if (carreraId) {
    const carrera = carrerasData.find(c => c.id === carreraId);
    if (carrera) tituloTexto += ` - ${carrera.nombre}`;
  }
  
  if (grupoId) {
    const grupo = gruposData.find(g => g.id === grupoId);
    if (grupo) tituloTexto += ` - Grupo ${grupo.nombre}`;
  }
  
  if (materiaId) {
    const materia = materiasData.find(m => m.id === materiaId);
    if (materia) tituloTexto += ` - ${materia.nombre}`;
  }
  
  titulo.textContent = tituloTexto;
  
  // Generar tabla
  let html = `
    <table>
      <thead>
        <tr>
          <th>Matrícula</th>
          <th>Alumno</th>
          <th>Materia</th>
          <th>Grupo</th>
          <th>Parcial 1</th>
          <th>Parcial 2</th>
          <th>Parcial 3</th>
          <th>Promedio</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  calificacionesData.forEach(cal => {
    // Buscar info del alumno
    const alumno = alumnosData.find(a => a.uid === cal.alumnoId);
    const matricula = alumno ? alumno.matricula : 'N/A';
    const nombreAlumno = alumno ? alumno.nombre : 'Alumno no encontrado';
    
    // Buscar info de materia
    const materia = materiasData.find(m => m.id === cal.materiaId);
    const nombreMateria = materia ? materia.nombre : cal.materiaNombre || 'N/A';
    
    // Buscar info de grupo
    const grupo = gruposData.find(g => g.id === cal.grupoId);
    const nombreGrupo = grupo ? grupo.nombre : 'N/A';
    
    const p1 = cal.parciales?.parcial1 ?? '-';
    const p2 = cal.parciales?.parcial2 ?? '-';
    const p3 = cal.parciales?.parcial3 ?? '-';
    
    // Calcular promedio
    const promedio = calcularPromedio(p1, p2, p3);
    
    // Determinar estado
    let estado = '';
    let badgeClass = '';
    
    if (promedio === '-') {
      estado = 'Sin calificar';
      badgeClass = 'badge';
    } else if (promedio === '5.0' || parseFloat(promedio) < 6) {
      estado = 'Reprobado';
      badgeClass = 'badge badge-reprobado';
    } else if (p1 === 'NP' || p2 === 'NP' || p3 === 'NP') {
      estado = 'Con NP';
      badgeClass = 'badge badge-np';
    } else {
      estado = 'Aprobado';
      badgeClass = 'badge badge-aprobado';
    }
    
    html += `
      <tr>
        <td><strong>${matricula}</strong></td>
        <td>${nombreAlumno}</td>
        <td>${nombreMateria}</td>
        <td>${nombreGrupo}</td>
        <td style="text-align: center;">${p1}</td>
        <td style="text-align: center;">${p2}</td>
        <td style="text-align: center;">${p3}</td>
        <td style="text-align: center;"><strong>${promedio}</strong></td>
        <td><span class="${badgeClass}">${estado}</span></td>
        <td>
          <button onclick="editarCalificacion('${cal.alumnoId}', '${cal.materiaId}', '${cal.grupoId}', '${cal.periodo}')" 
                  class="btn-editar" style="font-size: 0.85rem;">
            Editar
          </button>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
}

// ===== CALCULAR PROMEDIO =====
function calcularPromedio(p1, p2, p3) {
  // Si alguno es NP, promedio es 5.0
  if (p1 === 'NP' || p2 === 'NP' || p3 === 'NP') {
    return '5.0';
  }
  
  // Filtrar valores válidos
  const valores = [p1, p2, p3]
    .filter(v => v !== '-' && v !== null && v !== undefined && v !== '')
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));
  
  if (valores.length === 0) return '-';
  
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  return promedio.toFixed(1);
}

// ===== EDITAR CALIFICACIÓN =====
async function editarCalificacion(alumnoId, materiaId, grupoId, periodo) {
  try {
    // Buscar la calificación
    const calQuery = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .where('materiaId', '==', materiaId)
      .where('periodo', '==', periodo)
      .limit(1)
      .get();
    
    if (calQuery.empty) {
      alert('No se encontró la calificación');
      return;
    }
    
    const calDoc = calQuery.docs[0];
    const cal = calDoc.data();
    
    // Buscar info del alumno y materia
    const alumno = alumnosData.find(a => a.uid === alumnoId);
    const materia = materiasData.find(m => m.id === materiaId);
    
    // Llenar modal
    document.getElementById('modalAlumnoNombre').textContent = alumno ? alumno.nombre : 'N/A';
    document.getElementById('modalAlumnoMatricula').textContent = alumno ? alumno.matricula : 'N/A';
    document.getElementById('modalMateriaNombre').textContent = materia ? materia.nombre : cal.materiaNombre || 'N/A';
    document.getElementById('modalPeriodo').textContent = periodo;
    
    document.getElementById('editAlumnoId').value = alumnoId;
    document.getElementById('editMateriaId').value = materiaId;
    document.getElementById('editGrupoId').value = grupoId;
    document.getElementById('editPeriodo').value = periodo;
    
    document.getElementById('editParcial1').value = cal.parciales?.parcial1 || '';
    document.getElementById('editParcial2').value = cal.parciales?.parcial2 || '';
    document.getElementById('editParcial3').value = cal.parciales?.parcial3 || '';
    
    document.getElementById('modalCalificacion').style.display = 'block';
    
  } catch (error) {
    console.error('Error al cargar calificación:', error);
    alert('Error al cargar calificación');
  }
}

// ===== GUARDAR CALIFICACIÓN =====
async function guardarCalificacion(event) {
  event.preventDefault();
  
  const alumnoId = document.getElementById('editAlumnoId').value;
  const materiaId = document.getElementById('editMateriaId').value;
  const grupoId = document.getElementById('editGrupoId').value;
  const periodo = document.getElementById('editPeriodo').value;
  
  let p1 = document.getElementById('editParcial1').value.trim().toUpperCase();
  let p2 = document.getElementById('editParcial2').value.trim().toUpperCase();
  let p3 = document.getElementById('editParcial3').value.trim().toUpperCase();
  
  // Validar formato
  const validar = (val) => {
    if (val === '' || val === '-') return '-';
    if (val === 'NP') return 'NP';
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 10) {
      throw new Error('Calificación inválida. Debe ser 0-10 o NP');
    }
    return num;
  };
  
  try {
    p1 = validar(p1);
    p2 = validar(p2);
    p3 = validar(p3);
    
    // Buscar el documento
    const calQuery = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .where('materiaId', '==', materiaId)
      .where('periodo', '==', periodo)
      .limit(1)
      .get();
    
    if (calQuery.empty) {
      alert('No se encontró la calificación');
      return;
    }
    
    const calDoc = calQuery.docs[0];
    
    // Actualizar
    await calDoc.ref.update({
      'parciales.parcial1': p1,
      'parciales.parcial2': p2,
      'parciales.parcial3': p3,
      actualizadoPor: usuarioActual.uid,
      fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Calificación actualizada');
    alert('Calificación guardada correctamente');
    
    cerrarModalCal();
    
    // Recargar calificaciones
    await aplicarFiltros();
    
  } catch (error) {
    console.error('Error al guardar:', error);
    alert(error.message);
  }
}

// ===== CERRAR MODAL =====
function cerrarModalCal() {
  document.getElementById('modalCalificacion').style.display = 'none';
}

// ===== MOSTRAR TODAS LAS CARRERAS =====
async function mostrarTodasCarreras() {
  let mensaje = 'CARRERAS DEL SISTEMA\n\n';
  
  if (carrerasData.length === 0) {
    mensaje += 'No hay carreras registradas';
  } else {
    carrerasData.forEach((carrera, index) => {
      mensaje += `${index + 1}. ${carrera.nombre} (${carrera.codigo})\n`;
    });
  }
  
  alert(mensaje);
}

// ===== EXPORTAR REPORTE GENERAL =====
async function exportarReporteGeneral() {
  alert('Función en desarrollo\n\nSe generará un PDF con estadísticas generales del sistema.');
  // TODO: Implementar generación de PDF con jsPDF
}

// ===== BUSCAR ALUMNO =====
function buscarAlumno() {
  const matricula = prompt('Ingresa la matrícula del alumno:');
  
  if (!matricula) return;
  
  const alumno = alumnosData.find(a => 
    a.matricula && a.matricula.toLowerCase().includes(matricula.toLowerCase())
  );
  
  if (!alumno) {
    alert('No se encontró ningún alumno con esa matrícula');
    return;
  }
  
  const carrera = carrerasData.find(c => c.id === alumno.carreraId);
  
  let mensaje = `👤 ALUMNO ENCONTRADO\n\n`;
  mensaje += `Nombre: ${alumno.nombre}\n`;
  mensaje += `Matrícula: ${alumno.matricula}\n`;
  mensaje += `Carrera: ${carrera ? carrera.nombre : 'N/A'}\n`;
  mensaje += `Periodo: ${alumno.periodo || 'N/A'}\n`;
  mensaje += `Semestre: ${alumno.semestreActual || 'N/A'}\n`;
  mensaje += `Email: ${alumno.email}\n`;
  
  alert(mensaje);
}

// Cerrar modal al hacer clic fuera
window.onclick = function(event) {
  const modal = document.getElementById('modalCalificacion');
  if (event.target === modal) {
    cerrarModalCal();
  }
}

console.log('Sistema de Control Escolar cargado');