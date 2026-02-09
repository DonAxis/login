// controlEscolar.js - Sistema completo para Control Escolar
const auth = firebase.auth();
let usuarioActual = null;
let carrerasData = [];
let materiasData = [];
let alumnosData = [];
let carreraSeleccionada = null;
let materiaSeleccionada = null;
let periodoActual = '2026-1';

// ===== PROTECCIÓN DE PÁGINA =====
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'https://ilbcontrol.mx/sice/';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists || userDoc.data().rol !== 'controlEscolar') {
      alert('Solo personal de Control Escolar puede acceder');
      window.location.href = 'https://ilbcontrol.mx/sice/';
      return;
    }

    usuarioActual = userDoc.data();
    usuarioActual.uid = user.uid;
    
    document.getElementById('nombreUsuario').textContent = usuarioActual.nombre;
    
    await inicializar();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al verificar permisos');
    window.location.href = 'https://ilbcontrol.mx/sice/';
  }
});

async function cerrarSesion() {
  if (confirm('¿Cerrar sesión?')) {
    try {
      await auth.signOut();
      window.location.href = 'https://ilbcontrol.mx/sice/';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cerrar sesión');
    }
  }
}

// ===== INICIALIZACIÓN =====
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
      .where('activo', '==', true)
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

// ===== MOSTRAR CARRERAS =====
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
        <p>Código: ${carrera.codigo}</p>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ===== SELECCIONAR CARRERA =====
async function seleccionarCarrera(carreraId) {
  carreraSeleccionada = carrerasData.find(c => c.id === carreraId);
  
  if (!carreraSeleccionada) return;
  
  console.log('Carrera seleccionada:', carreraSeleccionada.nombre);
  
  // Ocultar menu de carreras
  document.getElementById('menuCarreras').style.display = 'none';
  
  // Mostrar opciones de la carrera
  mostrarOpcionesCarrera();
}

function mostrarOpcionesCarrera() {
  const container = document.getElementById('gruposGrid');
  
  let html = `
    <h2 class="titulo-seccion" style="margin-bottom: 20px; grid-column: 1/-1;">
      ${carreraSeleccionada.nombre}
    </h2>
    
    <div style="grid-column: 1/-1; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      
      <!-- Ver todas las materias de la carrera -->
      <div class="opcion-card" onclick="verMateriasCarrera()">
       
        <h3>Ver Materias</h3>
        <p>Ver todas las materias de esta carrera</p>
      </div>
      
      <!-- Ver todos los alumnos de la carrera -->
      <div class="opcion-card" onclick="verAlumnosCarrera()">
       
        <h3>Ver Alumnos</h3>
        <p>Ver todos los alumnos inscritos en esta carrera</p>
      </div>
      
      <!-- Ver alumnos especiales si existen -->
      <div class="opcion-card" onclick="verAlumnosEspeciales()" style="background: #fff3cd; border-left: 4px solid #ff9800;">
        <div class="opcion-icono">⭐</div>
        <h3>Alumnos Especiales</h3>
        <p>Alumnos sin grupo fijo (toman materias individuales)</p>
      </div>
      
    </div>
  `;
  
  document.getElementById('gruposGrid').innerHTML = html;
  document.getElementById('gruposContainer').style.display = 'block';
  document.getElementById('opcionesContainer').style.display = 'none';
}

// ===== VER MATERIAS DE LA CARRERA =====
async function verMateriasCarrera() {
  if (!carreraSeleccionada) return;
  
  console.log('Cargando materias de la carrera:', carreraSeleccionada.nombre);
  
  // Filtrar materias de esta carrera
  const materiasCarrera = materiasData.filter(m => m.carreraId === carreraSeleccionada.id);
  
  if (materiasCarrera.length === 0) {
    mostrarLista(`
      <h2 class="titulo-seccion">Materias de ${carreraSeleccionada.nombre}</h2>
      <div class="sin-datos">No hay materias registradas en esta carrera</div>
    `);
    return;
  }
  
  // Agrupar por periodo
  const materiasPorPeriodo = {};
  materiasCarrera.forEach(materia => {
    const periodo = materia.periodo || 'Sin periodo';
    if (!materiasPorPeriodo[periodo]) {
      materiasPorPeriodo[periodo] = [];
    }
    materiasPorPeriodo[periodo].push(materia);
  });
  
  // Ordenar periodos
  const periodos = Object.keys(materiasPorPeriodo).sort((a, b) => {
    if (a === 'Sin periodo') return 1;
    if (b === 'Sin periodo') return -1;
    return parseInt(a) - parseInt(b);
  });
  
  let html = `
    <h2 class="titulo-seccion">Materias de ${carreraSeleccionada.nombre}</h2>
    <p style="margin-bottom: 20px; color: #666;">Total: ${materiasCarrera.length} materias</p>
  `;
  
  // Generar HTML por periodo
  periodos.forEach(periodo => {
    const materias = materiasPorPeriodo[periodo];
    
    html += `
      <h3 style="margin: 30px 0 15px 0; color: #6A2135; border-bottom: 2px solid #6A2135; padding-bottom: 10px;">
        Periodo ${periodo} (${materias.length} materias)
      </h3>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Créditos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    materias.forEach(materia => {
      const creditos = materia.creditosSatca || materia.creditos || 0;
      
      html += `
        <tr>
          <td><strong>${materia.codigo || 'N/A'}</strong></td>
          <td>${materia.nombre}</td>
          <td style="text-align: center;">${creditos}</td>
          <td>
            <button onclick="verAlumnosEnMateria('${materia.id}', '${materia.nombre}')" class="btn-accion">
              Ver Alumnos
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
  });
  
  mostrarLista(html);
}

// ===== VER ALUMNOS EN UNA MATERIA ESPECÍFICA =====
async function verAlumnosEnMateria(materiaId, nombreMateria) {
  console.log('Cargando alumnos de materia:', nombreMateria);
  
  try {
    // Buscar calificaciones de esta materia
    const calificacionesSnap = await db.collection('calificaciones')
      .where('materiaId', '==', materiaId)
      .get();
    
    if (calificacionesSnap.empty) {
      mostrarLista(`
        <h2 class="titulo-seccion">Alumnos en ${nombreMateria}</h2>
        <div class="sin-datos">No hay alumnos inscritos en esta materia</div>
      `);
      return;
    }
    
    // Obtener datos de alumnos
    const alumnosEnMateria = [];
    
    for (const doc of calificacionesSnap.docs) {
      const cal = doc.data();
      const alumno = alumnosData.find(a => a.uid === cal.alumnoId);
      
      if (alumno) {
        alumnosEnMateria.push({
          ...alumno,
          parcial1: cal.parciales?.parcial1 ?? '-',
          parcial2: cal.parciales?.parcial2 ?? '-',
          parcial3: cal.parciales?.parcial3 ?? '-',
          periodo: cal.periodo
        });
      }
    }
    
    // Ordenar por nombre
    alumnosEnMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Alumnos en ${nombreMateria}</h2>
      <p style="margin-bottom: 20px; color: #666;">Total: ${alumnosEnMateria.length} alumnos</p>
      
      <div style="margin-bottom: 20px;">
        <button onclick="descargarActaMateria('${materiaId}', '${nombreMateria.replace(/'/g, "\\'")}', ${JSON.stringify(alumnosEnMateria).replace(/'/g, "\\'")})" 
                class="opcion-btn" style="background: #dc3545;">
          Descargar Acta de Calificaciones (PDF)
        </button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Matrícula</th>
            <th>Nombre</th>
            <th>Grupo/Código</th>
            <th>Parcial 1</th>
            <th>Parcial 2</th>
            <th>Parcial 3</th>
            <th>Promedio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    alumnosEnMateria.forEach(alumno => {
      // Calcular promedio
      const p1 = alumno.parcial1;
      const p2 = alumno.parcial2;
      const p3 = alumno.parcial3;
      
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
          promedio = (cals.reduce((a, b) => a + b, 0) / cals.length).toFixed(1);
        }
      }
      
      // Color del promedio
      let colorPromedio = '#333';
      if (promedio !== '-') {
        const prom = parseFloat(promedio);
        if (prom >= 8) colorPromedio = '#4caf50';
        else if (prom >= 6) colorPromedio = '#ff9800';
        else colorPromedio = '#f44336';
      }
      
      html += `
        <tr>
          <td><strong>${alumno.matricula || 'N/A'}</strong></td>
          <td>${alumno.nombre}</td>
          <td>${alumno.codigoGrupo || alumno.grupoNombre || 'N/A'}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p1}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p2}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p3}</td>
          <td style="text-align: center; font-weight: bold; font-size: 1.3rem; color: ${colorPromedio};">
            ${promedio}
          </td>
          <td>
            <button onclick="verHistorialCompleto('${alumno.uid}', '${alumno.nombre.replace(/'/g, "\\'")}')">
              Ver Historial
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar alumnos de materia:', error);
    alert('Error al cargar alumnos de la materia');
  }
}

// ===== VER ALUMNOS DE LA CARRERA =====
async function verAlumnosCarrera() {
  if (!carreraSeleccionada) return;
  
  console.log('Cargando alumnos de la carrera:', carreraSeleccionada.nombre);
  
  // Filtrar alumnos de esta carrera (excluyendo especiales)
  const alumnosCarrera = alumnosData.filter(a => 
    a.carreraId === carreraSeleccionada.id && 
    a.tipoAlumno !== 'especial'
  );
  
  if (alumnosCarrera.length === 0) {
    mostrarLista(`
      <h2 class="titulo-seccion">Alumnos de ${carreraSeleccionada.nombre}</h2>
      <div class="sin-datos">No hay alumnos inscritos en esta carrera</div>
    `);
    return;
  }
  
  // Ordenar por código de grupo y nombre
  alumnosCarrera.sort((a, b) => {
    const grupoA = a.codigoGrupo || '';
    const grupoB = b.codigoGrupo || '';
    if (grupoA !== grupoB) return grupoA.localeCompare(grupoB);
    return a.nombre.localeCompare(b.nombre);
  });
  
  let html = `
    <h2 class="titulo-seccion">Alumnos de ${carreraSeleccionada.nombre}</h2>
    <p style="margin-bottom: 20px; color: #666;">Total: ${alumnosCarrera.length} alumnos</p>
    
    <table>
      <thead>
        <tr>
          <th>Matrícula</th>
          <th>Nombre</th>
          <th>Grupo/Código</th>
          <th>Periodo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  alumnosCarrera.forEach(alumno => {
    html += `
      <tr>
        <td><strong>${alumno.matricula || 'N/A'}</strong></td>
        <td>${alumno.nombre}</td>
        <td>${alumno.codigoGrupo || alumno.grupoNombre || 'N/A'}</td>
        <td>${alumno.periodo || periodoActual}</td>
        <td>
          <button onclick="verHistorialCompleto('${alumno.uid}', '${alumno.nombre.replace(/'/g, "\\'")}')">
            Ver Historial
          </button>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  mostrarLista(html);
}

// ===== VER HISTORIAL COMPLETO DE UN ALUMNO =====
async function verHistorialCompleto(alumnoId, nombreAlumno) {
  console.log('Cargando historial completo de:', nombreAlumno);
  
  try {
    // Obtener todas las calificaciones del alumno
    const calificacionesSnap = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .get();
    
    if (calificacionesSnap.empty) {
      mostrarLista(`
        <h2 class="titulo-seccion">Historial de ${nombreAlumno}</h2>
        <div class="sin-datos">Este alumno no tiene calificaciones registradas</div>
      `);
      return;
    }
    
    // Procesar calificaciones
    const materiasMap = {};
    const materiasCache = {};
    
    for (const doc of calificacionesSnap.docs) {
      const cal = doc.data();
      const key = `${cal.materiaId}_${cal.periodo}`;
      
      let materiaNombre = cal.materiaNombre || 'Sin nombre';
      let materiaCodigo = cal.materiaCodigo || '';
      
      // Si no tiene nombre, buscarlo
      if (!cal.materiaNombre && cal.materiaId) {
        if (!materiasCache[cal.materiaId]) {
          const materiaData = materiasData.find(m => m.id === cal.materiaId);
          if (materiaData) {
            materiasCache[cal.materiaId] = materiaData;
          }
        }
        
        if (materiasCache[cal.materiaId]) {
          materiaNombre = materiasCache[cal.materiaId].nombre;
          materiaCodigo = materiasCache[cal.materiaId].codigo || '';
        }
      }
      
      materiasMap[key] = {
        materiaNombre: materiaNombre,
        materiaCodigo: materiaCodigo,
        periodo: cal.periodo || 'N/A',
        parcial1: cal.parciales?.parcial1 ?? '-',
        parcial2: cal.parciales?.parcial2 ?? '-',
        parcial3: cal.parciales?.parcial3 ?? '-'
      };
    }
    
    // Agrupar por periodo
    const periodosMaterias = {};
    
    Object.values(materiasMap).forEach(materia => {
      const periodo = materia.periodo;
      if (!periodosMaterias[periodo]) {
        periodosMaterias[periodo] = [];
      }
      periodosMaterias[periodo].push(materia);
    });
    
    // Ordenar periodos
    const periodos = Object.keys(periodosMaterias).sort().reverse();
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Historial Académico Completo</h2>
      
      <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #6A2135;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <strong style="color: #666;">Alumno:</strong><br>
            ${nombreAlumno}
          </div>
          <div>
            <strong style="color: #666;">Total Materias:</strong><br>
            <span style="font-size: 1.5rem; color: #4caf50; font-weight: bold;">${Object.keys(materiasMap).length}</span>
          </div>
          <div>
            <strong style="color: #666;">Periodos Cursados:</strong><br>
            <span style="font-size: 1.5rem; color: #6A2135; font-weight: bold;">${periodos.length}</span>
          </div>
        </div>
        
        <div style="margin-top: 20px;">
          <button onclick="descargarHistorialAlumnoPDF('${alumnoId}', '${nombreAlumno.replace(/'/g, "\\'")}');" 
                  class="opcion-btn" style="background: #dc3545; width: 100%;">
            📄 Descargar Historial Completo (PDF)
          </button>
        </div>
      </div>
    `;
    
    // Generar tabla por periodo
    periodos.forEach(periodo => {
      const materias = periodosMaterias[periodo];
      
      // Calcular promedio del periodo
      let sumaPromedios = 0;
      let countPromedios = 0;
      
      html += `
        <h3 style="margin: 30px 0 15px 0; color: #6A2135; border-bottom: 2px solid #6A2135; padding-bottom: 10px;">
          Periodo ${periodo}
        </h3>
        <table>
          <thead>
            <tr>
              <th>Materia</th>
              <th>Código</th>
              <th>Parcial 1</th>
              <th>Parcial 2</th>
              <th>Parcial 3</th>
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      materias.forEach(materia => {
        const p1 = materia.parcial1;
        const p2 = materia.parcial2;
        const p3 = materia.parcial3;
        
        let promedio = '-';
        const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
        
        if (tieneNP) {
          promedio = '5.0';
          sumaPromedios += 5.0;
          countPromedios++;
        } else {
          const cals = [p1, p2, p3]
            .filter(c => c !== '-' && c !== null && c !== undefined && c !== '')
            .map(c => parseFloat(c))
            .filter(c => !isNaN(c));
          
          if (cals.length > 0) {
            const prom = cals.reduce((a, b) => a + b, 0) / cals.length;
            promedio = prom.toFixed(1);
            sumaPromedios += prom;
            countPromedios++;
          }
        }
        
        let colorPromedio = '#333';
        if (promedio !== '-') {
          const prom = parseFloat(promedio);
          if (prom >= 8) colorPromedio = '#4caf50';
          else if (prom >= 6) colorPromedio = '#ff9800';
          else colorPromedio = '#f44336';
        }
        
        html += `
          <tr>
            <td><strong>${materia.materiaNombre}</strong></td>
            <td>${materia.materiaCodigo}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p1}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p2}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${p3}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.3rem; color: ${colorPromedio};">
              ${promedio}
            </td>
          </tr>
        `;
      });
      
      // Promedio del periodo
      const promedioPeriodo = countPromedios > 0 
        ? (sumaPromedios / countPromedios).toFixed(1) 
        : '-';
      
      html += `
          </tbody>
          <tfoot>
            <tr style="background: #f8f9fa; font-weight: bold;">
              <td colspan="5" style="text-align: right; padding-right: 20px;">Promedio del Periodo:</td>
              <td style="text-align: center; font-size: 1.3rem; color: #6A2135;">
                ${promedioPeriodo}
              </td>
            </tr>
          </tfoot>
        </table>
      `;
    });
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar historial:', error);
    alert('Error al cargar historial del alumno');
  }
}

// ===== FUNCIONES DE NAVEGACIÓN =====
function mostrarLista(html) {
  document.getElementById('listaContenido').innerHTML = html;
  document.getElementById('gruposContainer').style.display = 'none';
  document.getElementById('listaContainer').classList.add('active');
}

function volverCarreras() {
  document.getElementById('gruposContainer').classList.remove('active');
  document.getElementById('gruposContainer').style.display = 'none';
  document.getElementById('menuCarreras').style.display = 'grid';
  document.getElementById('opcionesContainer').classList.remove('active');
  document.getElementById('listaContainer').classList.remove('active');
  carreraSeleccionada = null;
}

function volverGrupos() {
  document.getElementById('listaContainer').classList.remove('active');
  document.getElementById('gruposContainer').style.display = 'block';
}

// ===== VER ALUMNOS ESPECIALES =====
async function verAlumnosEspeciales() {
  if (!carreraSeleccionada) {
    alert('Selecciona una carrera primero');
    return;
  }
  
  console.log('Cargando alumnos especiales de:', carreraSeleccionada.nombre);
  
  try {
    // Cargar alumnos especiales de esta carrera
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('tipoAlumno', '==', 'especial')
      .where('carreraId', '==', carreraSeleccionada.id)
      .where('activo', '==', true)
      .get();
    
    if (alumnosSnap.empty) {
      mostrarLista(`
        <h2 class="titulo-seccion">Alumnos Especiales - ${carreraSeleccionada.nombre}</h2>
        <div class="sin-datos">
          <p>No hay alumnos especiales en esta carrera</p>
          <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
            Los alumnos especiales son aquellos que toman materias de diferentes grupos
          </p>
        </div>
      `);
      return;
    }
    
    // Obtener inscripciones de cada alumno
    const alumnosArray = [];
    
    for (const doc of alumnosSnap.docs) {
      const alumno = {
        id: doc.id,
        ...doc.data()
      };
      
      // Contar materias inscritas
      const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
        .where('alumnoId', '==', doc.id)
        .where('activa', '==', true)
        .get();
      
      alumno.numMaterias = inscripcionesSnap.size;
      
      alumnosArray.push(alumno);
    }
    
    // Ordenar alfabéticamente
    alumnosArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Alumnos Especiales - ${carreraSeleccionada.nombre}</h2>
      
      <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
        <strong>Total de Alumnos Especiales: ${alumnosArray.length}</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">
          Estos alumnos no pertenecen a un grupo fijo y toman materias individuales
        </p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Matrícula</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Periodo</th>
            <th>Materias</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    alumnosArray.forEach(alumno => {
      html += `
        <tr style="background: #fff8e1;">
          <td><strong>${alumno.matricula}</strong></td>
          <td>
            ${alumno.nombre}
            <span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; margin-left: 5px;">ESPECIAL</span>
          </td>
          <td style="font-size: 0.85rem; color: #666;">${alumno.email || 'N/A'}</td>
          <td>${alumno.periodo || periodoActual}</td>
          <td style="text-align: center; font-weight: bold; color: #4caf50;">
            ${alumno.numMaterias}
          </td>
          <td>
            <button onclick="verDetalleAlumnoEspecial('${alumno.id}', '${alumno.nombre.replace(/'/g, "\\'")}')">
              Ver Detalle
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar alumnos especiales:', error);
    alert('Error al cargar alumnos especiales');
  }
}

// ===== VER DETALLE DE ALUMNO ESPECIAL =====
async function verDetalleAlumnoEspecial(alumnoId, nombreAlumno) {
  console.log('Cargando detalle del alumno especial:', nombreAlumno);
  
  try {
    // Obtener datos del alumno
    const alumnoDoc = await db.collection('usuarios').doc(alumnoId).get();
    
    if (!alumnoDoc.exists) {
      alert('Alumno no encontrado');
      return;
    }
    
    const alumno = alumnoDoc.data();
    
    // Obtener inscripciones activas
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('activa', '==', true)
      .get();
    
    const inscripciones = [];
    
    // Para cada inscripción, obtener calificaciones
    for (const doc of inscripcionesSnap.docs) {
      const inscripcion = {
        id: doc.id,
        ...doc.data()
      };
      
      // Buscar calificaciones
      const docId = alumnoId + '_' + inscripcion.materiaId;
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      if (calDoc.exists) {
        const calData = calDoc.data();
        inscripcion.parcial1 = calData.parciales?.parcial1 ?? '-';
        inscripcion.parcial2 = calData.parciales?.parcial2 ?? '-';
        inscripcion.parcial3 = calData.parciales?.parcial3 ?? '-';
      } else {
        inscripcion.parcial1 = '-';
        inscripcion.parcial2 = '-';
        inscripcion.parcial3 = '-';
      }
      
      // Calcular promedio
      const cals = [inscripcion.parcial1, inscripcion.parcial2, inscripcion.parcial3]
        .filter(c => c !== '-' && c !== 'NP')
        .map(c => parseFloat(c))
        .filter(c => !isNaN(c));
      
      if (cals.length > 0) {
        inscripcion.promedio = (cals.reduce((a, b) => a + b, 0) / cals.length).toFixed(1);
      } else if (inscripcion.parcial1 === 'NP' || inscripcion.parcial2 === 'NP' || inscripcion.parcial3 === 'NP') {
        inscripcion.promedio = '5.0';
      } else {
        inscripcion.promedio = '-';
      }
      
      inscripciones.push(inscripcion);
    }
    
    // Ordenar por materia
    inscripciones.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre));
    
    // Generar HTML
    let html = `
      <h2 class="titulo-seccion">Detalle Alumno Especial</h2>
      
      <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #ff9800;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <strong style="color: #666;">Nombre:</strong><br>
            ${alumno.nombre}
            <span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; margin-left: 5px;">ESPECIAL</span>
          </div>
          <div>
            <strong style="color: #666;">Matrícula:</strong><br>
            ${alumno.matricula}
          </div>
          <div>
            <strong style="color: #666;">Email:</strong><br>
            ${alumno.email || 'N/A'}
          </div>
          <div>
            <strong style="color: #666;">Periodo:</strong><br>
            ${alumno.periodo || periodoActual}
          </div>
          <div>
            <strong style="color: #666;">Materias Inscritas:</strong><br>
            <span style="font-size: 1.5rem; color: #4caf50; font-weight: bold;">${inscripciones.length}</span>
          </div>
        </div>
      </div>
    `;
    
    if (inscripciones.length === 0) {
      html += `
        <div class="sin-datos">
          <p>Este alumno no tiene materias inscritas actualmente</p>
        </div>
      `;
    } else {
      html += `
        <h3 style="margin: 20px 0 15px 0; color: #6A2135;">Materias y Calificaciones</h3>
        <table>
          <thead>
            <tr>
              <th>Materia</th>
              <th>Grupo</th>
              <th>Profesor</th>
              <th style="text-align: center;">Parcial 1</th>
              <th style="text-align: center;">Parcial 2</th>
              <th style="text-align: center;">Parcial 3</th>
              <th style="text-align: center;">Promedio</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      inscripciones.forEach(insc => {
        const promedioNum = parseFloat(insc.promedio);
        let promedioColor = '#333';
        
        if (!isNaN(promedioNum)) {
          if (promedioNum >= 8) {
            promedioColor = '#4caf50';
          } else if (promedioNum >= 6) {
            promedioColor = '#ff9800';
          } else {
            promedioColor = '#f44336';
          }
        }
        
        html += `
          <tr>
            <td>
              <strong>${insc.materiaNombre}</strong>
              ${insc.materiaCodigo ? '<br><small style="color: #666;">' + insc.materiaCodigo + '</small>' : ''}
            </td>
            <td>${insc.grupoNombre}</td>
            <td>${insc.profesorNombre || 'N/A'}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${insc.parcial1}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${insc.parcial2}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${insc.parcial3}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.3rem; color: ${promedioColor};">
              ${insc.promedio}
            </td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
    }
    
    mostrarLista(html);
    
  } catch (error) {
    console.error('Error al cargar detalle:', error);
    alert('Error al cargar detalle del alumno');
  }
}

// ===== PLACEHOLDER PARA FUNCIONES EXTERNAS =====
function descargarHistorialAlumnoPDF(alumnoId, nombreAlumno) {
  if (typeof window.descargarHistorialAlumnoPDF === 'function') {
    window.descargarHistorialAlumnoPDF(alumnoId, nombreAlumno);
  } else {
    alert('Función de PDF no disponible. Asegúrate de cargar HistorialAlumnoPDF.js');
  }
}

console.log('Control Escolar cargado - versión completa con alumnos especiales');