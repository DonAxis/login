// ============================================================================
// CONTROL PROFESOR - JAVASCRIPT LIMPIO Y ORGANIZADO
// Archivo: controlProfesor.js
// ============================================================================

// Variables globales
let usuarioActual = null;
let asignacionActual = null;
let alumnosMateria = [];
let carrerasData = [];

// ============================================================================
// SECCIÓN 1: INICIALIZACIÓN Y AUTENTICACIÓN
// ============================================================================

// Verificar autenticación
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'https://ilbcontrol.mx/sice';
    return;
  }
  
  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    
    if (!userDoc.exists) {
      alert('Usuario no encontrado');
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
      return;
    }
    
    const userData = userDoc.data();
    
    if (userData.rol !== 'profesor' && userData.rol !== 'coordinador') {
      alert('Acceso denegado. Solo profesores y coordinadores.');
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
      return;
    }
    
    usuarioActual = {
      uid: user.uid,
      ...userData
    };
    
    console.log('Usuario autenticado:', usuarioActual.nombre);
    
    // Actualizar UI
    document.getElementById('userName').textContent = usuarioActual.nombre;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('profesorInfo').textContent = `Bienvenido, ${usuarioActual.nombre}`;
    
    // Cargar carreras
    await cargarInfoCarreras();
    
    // Mostrar botón de volver si es coordinador
    if (usuarioActual.rol === 'coordinador') {
      document.getElementById('btnVolverCoord').style.display = 'inline-block';
    }
    
    // Mostrar menú principal al iniciar
    document.getElementById('menuMaterias').style.display = 'grid';
    
  } catch (error) {
    console.error('Error al cargar usuario:', error);
    alert('Error al cargar información del usuario');
  }
});

async function cargarInfoCarreras() {
  try {
    const carrerasSnap = await db.collection('carreras').get();
    carrerasData = [];
    
    carrerasSnap.forEach(doc => {
      carrerasData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log('Carreras cargadas:', carrerasData.length);
  } catch (error) {
    console.error('Error al cargar carreras:', error);
  }
}

// ============================================================================
// SECCIÓN 2: GESTIÓN DE MATERIAS
// ============================================================================

async function mostrarMisMaterias() {
  try {
    console.log('=== Cargando materias del profesor ===');
    console.log('Profesor ID:', usuarioActual.uid);
    
    // Mostrar sección de materias, ocultar otras
    document.getElementById('menuMaterias').style.display = 'none';
    document.getElementById('seccionMaterias').style.display = 'block';
    document.getElementById('seccionCalificaciones').style.display = 'none';
    document.getElementById('seccionConfiguracion').style.display = 'none';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
    const container = document.getElementById('listaMaterias');
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando materias...</p>';
    
    //  SCROLL A LA SECCIÓN DE MATERIAS (temprano)
    setTimeout(() => {
      const seccionMaterias = document.getElementById('seccionMaterias');
      if (seccionMaterias) {
        seccionMaterias.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
    
    // Buscar asignaciones activas del profesor (SIN orderBy para evitar índice)
    const asignacionesSnap = await db.collection('profesorMaterias')
      .where('profesorId', '==', usuarioActual.uid)
      .where('activa', '==', true)
      .get();
    
    console.log('Asignaciones encontradas:', asignacionesSnap.size);
    
    if (asignacionesSnap.empty) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <p>No tienes materias asignadas actualmente</p>
        </div>
      `;
      return;
    }
    
    // Convertir a array y ordenar manualmente
    const asignaciones = [];
    asignacionesSnap.forEach(doc => {
      asignaciones.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('Materias obtenidas:', asignaciones.length);
    
    // Ordenar por periodo y turno en JavaScript
    asignaciones.sort((a, b) => {
      const periodoA = a.periodo || 1;
      const periodoB = b.periodo || 1;
      if (periodoA !== periodoB) return periodoB - periodoA; // Más reciente primero
      
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
    
    console.log('Periodos encontrados:', periodos);
    
    periodos.forEach(periodo => {
      const materias = materiasPorPeriodo[periodo];
      
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #6A2135; margin-bottom: 15px;">Periodo ${periodo}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
      `;
      
      materias.forEach(asignacion => {
        const turnosNombres = {1: 'Matutino', 2: 'Vespertino', 3: 'Nocturno', 4: 'Sabatino'};
        const turnoNombre = asignacion.turnoNombre || turnosNombres[asignacion.turno] || 'Sin turno';
        
        html += `
          <div class="card-profesor" onclick="verCalificacionesMateria('${asignacion.id}')">
            <h3>${asignacion.materiaNombre}</h3>
            <p style="margin: 5px 0; color: #666;">
              <strong>Código Grupo:</strong> ${asignacion.codigoGrupo || 'N/A'}<br>
              <strong>Turno:</strong> ${turnoNombre}<br>
              <strong>Periodo:</strong> ${asignacion.periodo}
            </p>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    console.log('HTML generado, mostrando materias');
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error al cargar materias:', error);
    const container = document.getElementById('listaMaterias');
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc3545;">
        <p><strong>Error al cargar materias</strong></p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

async function verCalificacionesMateria(asignacionId) {
  try {
    console.log('=== Abriendo materia ===');
    console.log('Asignación ID:', asignacionId);
    
    // Ocultar menú, mostrar sección de calificaciones
    document.getElementById('menuMaterias').style.display = 'none';
    document.getElementById('seccionCalificaciones').style.display = 'block';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
    // Cargar datos de la asignación
    const asigDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
    
    if (!asigDoc.exists) {
      alert('Asignación no encontrada');
      volverMenuProfe();
      return;
    }
    
    asignacionActual = {
      id: asignacionId,
      ...asigDoc.data()
    };
    
    console.log('Asignación cargada:', asignacionActual);
    
    // Mostrar información de la materia
    const turnosNombres = {1: 'Matutino', 2: 'Vespertino', 3: 'Nocturno', 4: 'Sabatino'};
    const turnoNombre = asignacionActual.turnoNombre || turnosNombres[asignacionActual.turno] || 'Sin turno';
    
    document.getElementById('contenedorMateriaCalif').innerHTML = `
      <h2 style="color: #6A2135; margin: 0 0 10px 0;">${asignacionActual.materiaNombre}</h2>
      <p style="color: #666; margin: 0;">
        <strong>Grupo:</strong> ${asignacionActual.codigoGrupo} | 
        <strong>Turno:</strong> ${turnoNombre} | 
        <strong>Periodo:</strong> ${asignacionActual.periodo}
      </p>
    `;
    
    // Cargar alumnos y calificaciones
    await cargarAlumnosYCalificaciones();
    
    // ✓ SCROLL AUTOMÁTICO SUAVE
    setTimeout(() => {
      const seccion = document.getElementById('seccionCalificaciones');
      if (seccion) {
        seccion.scrollIntoView({ 
          behavior: 'smooth',    // Scroll suave
          block: 'start'         // Alinear al inicio
        });
      }
    }, 300); // Esperar 300ms para que cargue el contenido
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar la materia: ' + error.message);
  }
}

// ============================================================================
// SECCIÓN 3: CARGA DE ALUMNOS Y CALIFICACIONES
// ============================================================================

async function cargarAlumnosYCalificaciones() {
  try {
    const container = document.getElementById('tablaCalificaciones');
    container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Cargando alumnos...</p>';
    
    console.log('=== Cargando alumnos y calificaciones ===');
    console.log('Buscando alumnos del grupo:', asignacionActual.codigoGrupo);
    
    // Buscar alumnos del grupo
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('codigoGrupo', '==', asignacionActual.codigoGrupo)
      .where('activo', '==', true)
      .get();
    
    console.log('Alumnos normales encontrados:', alumnosSnap.size);
    
    // Buscar inscripciones especiales
    const especialesSnap = await db.collection('inscripcionesEspeciales')
      .where('materiaId', '==', asignacionActual.materiaId)
      .where('codigoGrupo', '==', asignacionActual.codigoGrupo)
      .where('activa', '==', true)
      .get();
    
    console.log('Inscripciones especiales encontradas:', especialesSnap.size);
    
    alumnosMateria = [];
    
    // Cargar alumnos normales
    for (const doc of alumnosSnap.docs) {
      const alumno = {
        id: doc.id,
        ...doc.data(),
        tipoInscripcion: 'normal',
        calificaciones: {
          parcial1: null,
          parcial2: null,
          parcial3: null,
          falta1: null,
          falta2: null,
          falta3: null
        }
      };
      
      // Buscar calificaciones
      const docId = `${doc.id}_${asignacionActual.materiaId}`;
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      if (calDoc.exists) {
        const data = calDoc.data();
        alumno.calificaciones.parcial1 = data.parciales?.parcial1 ?? null;
        alumno.calificaciones.parcial2 = data.parciales?.parcial2 ?? null;
        alumno.calificaciones.parcial3 = data.parciales?.parcial3 ?? null;
        alumno.calificaciones.falta1 = data.faltas?.falta1 ?? null;
        alumno.calificaciones.falta2 = data.faltas?.falta2 ?? null;
        alumno.calificaciones.falta3 = data.faltas?.falta3 ?? null;
      }
      
      alumnosMateria.push(alumno);
    }
    
    // Cargar alumnos especiales
    for (const doc of especialesSnap.docs) {
      const inscripcion = doc.data();
      
      const alumnoDoc = await db.collection('usuarios').doc(inscripcion.alumnoId).get();
      
      if (alumnoDoc.exists) {
        const alumnoData = alumnoDoc.data();
        
        const alumno = {
          id: inscripcion.alumnoId,
          nombre: alumnoData.nombre,
          matricula: alumnoData.matricula || inscripcion.alumnoMatricula,
          tipoInscripcion: 'especial',
          calificaciones: {
            parcial1: null,
            parcial2: null,
            parcial3: null,
            falta1: null,
            falta2: null,
            falta3: null
          }
        };
        
        // Buscar calificaciones
        const docId = `${inscripcion.alumnoId}_${asignacionActual.materiaId}`;
        const calDoc = await db.collection('calificaciones').doc(docId).get();
        
        if (calDoc.exists) {
          const data = calDoc.data();
          alumno.calificaciones.parcial1 = data.parciales?.parcial1 ?? null;
          alumno.calificaciones.parcial2 = data.parciales?.parcial2 ?? null;
          alumno.calificaciones.parcial3 = data.parciales?.parcial3 ?? null;
          alumno.calificaciones.falta1 = data.faltas?.falta1 ?? null;
          alumno.calificaciones.falta2 = data.faltas?.falta2 ?? null;
          alumno.calificaciones.falta3 = data.faltas?.falta3 ?? null;
        }
        
        alumnosMateria.push(alumno);
      }
    }
    
    // Ordenar alfabéticamente
    alumnosMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    console.log('Total alumnos cargados:', alumnosMateria.length);
    
    if (alumnosMateria.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <p>No hay alumnos en este grupo</p>
          <p style="font-size: 0.9rem; margin-top: 10px;">Grupo: ${asignacionActual.codigoGrupo}</p>
        </div>
      `;
      return;
    }
    
    // Generar tabla
    generarTablaCalificaciones();
    
  } catch (error) {
    console.error('Error al cargar alumnos:', error);
    const container = document.getElementById('tablaCalificaciones');
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc3545;">
        <p><strong>Error al cargar alumnos</strong></p>
        <p style="font-size: 0.9rem;">${error.message}</p>
      </div>
    `;
  }
}

// ============================================================================
// SECCIÓN 4: GENERAR TABLA DE CALIFICACIONES
// ============================================================================

function generarTablaCalificaciones() {
  const container = document.getElementById('tablaCalificaciones');
  
  let html = `
  
    <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <table style="width: 100%; min-width: 1000px; border-collapse: collapse; background: white;">
        <thead style="background: linear-gradient(135deg, #6A2135 0%, #6A3221 100%); color: white;">
          <tr>
            <th rowspan="2" style="padding: 12px; text-align: left; border: 1px solid rgba(255,255,255,0.2); min-width: 150px;">Alumno</th>
            <th rowspan="2" style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Matrícula</th>
            <th style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Parcial 1</th>
            <th style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Faltas</th>
            <th style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Parcial 2</th>
            <th style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Faltas</th>
            <th style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Parcial 3</th>
            <th style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Faltas</th>
            <th rowspan="2" style="padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2); width: 100px;">Promedio</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  alumnosMateria.forEach((alumno, index) => {
    const cal = alumno.calificaciones;
    
    // Calcular promedio
    let promedio = null;
    let promedioTexto = '-';
    const tieneNP = cal.parcial1 === 'NP' || cal.parcial2 === 'NP' || cal.parcial3 === 'NP';
    
    if (tieneNP) {
      promedio = 5.0;
      promedioTexto = '5.0';
    } else {
      const cals = [cal.parcial1, cal.parcial2, cal.parcial3]
        .filter(c => c !== null && c !== undefined && c !== '' && c !== '-')
        .map(c => parseFloat(c))
        .filter(c => !isNaN(c));
      
      if (cals.length > 0) {
        promedio = cals.reduce((a, b) => a + b, 0) / cals.length;
        promedioTexto = promedio.toFixed(1);
      }
    }
    
    // Color del promedio
    let colorPromedio = '#666';
    if (promedio !== null) {
      if (promedio < 6) colorPromedio = '#dc3545';
      else if (promedio >= 8) colorPromedio = '#4caf50';
      else colorPromedio = '#ff9800';
    }
    
    // Badge para alumnos especiales
    const badgeEspecial = alumno.tipoInscripcion === 'especial' 
      ? '<span style="display: inline-block; padding: 2px 6px; background: #fff3e0; color: #e65100; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 5px;">ESPECIAL</span>' 
      : '';
    
    html += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600;">
          ${alumno.nombre || 'Sin nombre'}${badgeEspecial}
        </td>
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${alumno.matricula || 'N/A'}</td>
        
        <!-- PARCIAL 1 + FALTA 1 -->
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
          ${generarCeldaCalificacion(cal.parcial1, index, 'p1')}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #fff8e1;">
          ${generarCeldaFalta(cal.falta1, index, 'f1')}
        </td>
        
        <!-- PARCIAL 2 + FALTA 2 -->
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
          ${generarCeldaCalificacion(cal.parcial2, index, 'p2')}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #fff8e1;">
          ${generarCeldaFalta(cal.falta2, index, 'f2')}
        </td>
        
        <!-- PARCIAL 3 + FALTA 3 -->
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
          ${generarCeldaCalificacion(cal.parcial3, index, 'p3')}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #fff8e1;">
          ${generarCeldaFalta(cal.falta3, index, 'f3')}
        </td>
        
        <!-- PROMEDIO -->
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 1.1rem; background: #f0f7ff; color: ${colorPromedio};">
          ${promedioTexto}
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
    
    <div style="text-align: center; color: #999; font-size: 0.85rem; margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
      ← Desliza horizontalmente para ver todas las columnas →
    </div>
    
    <button onclick="guardarCalificacionesProfe()" 
            style="background: linear-gradient(135deg, #6A2135 0%, #6A3221 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem; width: 100%; max-width: 300px; margin: 20px auto; display: block; transition: all 0.3s;">
      Guardar Calificaciones
    </button>
  `;
  
  container.innerHTML = html;
  
  console.log('Tabla generada correctamente');
}

function generarCeldaCalificacion(valor, index, parcial) {
  if (valor !== null && valor !== undefined && valor !== '') {
    const color = valor === 'NP' ? '#dc3545' : '#4caf50';
    return `<span style="font-weight: bold; color: ${color};">${valor}</span>`;
  } else {
    return `
      <select id="cal_${index}_${parcial}" 
              style="width: 80px; padding: 8px 4px; border: 2px solid #ddd; border-radius: 6px; text-align: center; font-weight: bold; font-size: 0.95rem;">
        <option value="">-</option>
        <option value="10">10</option>
        <option value="9">9</option>
        <option value="8">8</option>
        <option value="7">7</option>
        <option value="6">6</option>
        <option value="5">5</option>
        <option value="4">4</option>
        <option value="3">3</option>
        <option value="2">2</option>
        <option value="1">1</option>
        <option value="0">0</option>
        <option value="NP">NP</option>
      </select>
    `;
  }
}

function generarCeldaFalta(valor, index, falta) {
  if (valor !== null && valor !== undefined && valor !== '') {
    const color = valor > 0 ? '#dc3545' : '#4caf50';
    return `<span style="font-weight: bold; color: ${color};">${valor}</span>`;
  } else {
    // Generar select con opciones 0-20
    let opciones = '';
    for (let i = 0; i <= 20; i++) {
      opciones += `<option value="${i}">${i}</option>`;
    }
    
    return `
      <select id="fal_${index}_${falta}" 
              style="width: 70px; padding: 8px 4px; border: 2px solid #ff9800; border-radius: 6px; text-align: center; font-weight: bold; font-size: 0.9rem;">
        ${opciones}
      </select>
    `;
  }
}

// ============================================================================
// SECCIÓN 5: GUARDAR CALIFICACIONES
// ============================================================================

async function guardarCalificacionesProfe() {
  if (!confirm('¿Guardar las calificaciones y faltas?\n\nIMPORTANTE: No podrás modificarlas después.')) {
    return;
  }
  
  console.log('=== Guardando calificaciones ===');
  console.log('Asignación actual:', asignacionActual);
  console.log('Total alumnos:', alumnosMateria.length);
  
  try {
    let guardadas = 0;
    let errores = 0;
    const erroresDetalle = [];
    
    for (let i = 0; i < alumnosMateria.length; i++) {
      const alumno = alumnosMateria[i];
      
      console.log(`\nProcesando alumno ${i + 1}/${alumnosMateria.length}: ${alumno.nombre}`);
      
      // Leer valores de los inputs
      const inputP1 = document.getElementById(`cal_${i}_p1`);
      const inputP2 = document.getElementById(`cal_${i}_p2`);
      const inputP3 = document.getElementById(`cal_${i}_p3`);
      
      const inputF1 = document.getElementById(`fal_${i}_f1`);
      const inputF2 = document.getElementById(`fal_${i}_f2`);
      const inputF3 = document.getElementById(`fal_${i}_f3`);
      
      const p1 = inputP1 ? inputP1.value : '';
      const p2 = inputP2 ? inputP2.value : '';
      const p3 = inputP3 ? inputP3.value : '';
      
      const f1 = inputF1 ? inputF1.value : '0';
      const f2 = inputF2 ? inputF2.value : '0';
      const f3 = inputF3 ? inputF3.value : '0';
      
      console.log('  Valores leídos:');
      console.log('    P1:', p1, '  F1:', f1);
      console.log('    P2:', p2, '  F2:', f2);
      console.log('    P3:', p3, '  F3:', f3);
      
      // Convertir a formato correcto
      const parcial1 = p1 === '' ? null : (p1 === 'NP' ? 'NP' : parseFloat(p1));
      const parcial2 = p2 === '' ? null : (p2 === 'NP' ? 'NP' : parseFloat(p2));
      const parcial3 = p3 === '' ? null : (p3 === 'NP' ? 'NP' : parseFloat(p3));
      
      const falta1 = parseInt(f1) || 0;
      const falta2 = parseInt(f2) || 0;
      const falta3 = parseInt(f3) || 0;
      
      console.log('  Valores convertidos:');
      console.log('    Parciales:', parcial1, parcial2, parcial3);
      console.log('    Faltas:', falta1, falta2, falta3);
      
      // Verificar si hay datos nuevos
      const hayNuevasParciales = 
        (alumno.calificaciones.parcial1 === null && parcial1 !== null) ||
        (alumno.calificaciones.parcial2 === null && parcial2 !== null) ||
        (alumno.calificaciones.parcial3 === null && parcial3 !== null);
      
      const hayNuevasFaltas =
        (alumno.calificaciones.falta1 === null && falta1 !== null) ||
        (alumno.calificaciones.falta2 === null && falta2 !== null) ||
        (alumno.calificaciones.falta3 === null && falta3 !== null);
      
      if (!hayNuevasParciales && !hayNuevasFaltas) {
        console.log('  -> Sin cambios, omitiendo');
        continue;
      }
      
      const docId = `${alumno.id}_${asignacionActual.materiaId}`;
      console.log('  -> Documento:', docId);
      
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      let datosActuales = {
        parciales: { parcial1: null, parcial2: null, parcial3: null },
        faltas: { falta1: null, falta2: null, falta3: null }
      };
      
      if (calDoc.exists) {
        const data = calDoc.data();
        datosActuales.parciales = data.parciales || datosActuales.parciales;
        datosActuales.faltas = data.faltas || datosActuales.faltas;
        console.log('  -> Datos actuales:', datosActuales);
      }
      
      // Actualizar solo campos vacíos
      const nuevosParciales = {
        parcial1: datosActuales.parciales.parcial1 ?? parcial1,
        parcial2: datosActuales.parciales.parcial2 ?? parcial2,
        parcial3: datosActuales.parciales.parcial3 ?? parcial3
      };
      
      const nuevasFaltas = {
        falta1: datosActuales.faltas.falta1 ?? falta1,
        falta2: datosActuales.faltas.falta2 ?? falta2,
        falta3: datosActuales.faltas.falta3 ?? falta3
      };
      
      console.log('  -> Nuevos datos a guardar:');
      console.log('     Parciales:', nuevosParciales);
      console.log('     Faltas:', nuevasFaltas);
      
      // Calcular promedio
      let promedio = null;
      const tieneNP = nuevosParciales.parcial1 === 'NP' || 
                      nuevosParciales.parcial2 === 'NP' || 
                      nuevosParciales.parcial3 === 'NP';
      
      if (tieneNP) {
        promedio = 5.0;
      } else {
        const cals = [nuevosParciales.parcial1, nuevosParciales.parcial2, nuevosParciales.parcial3]
          .filter(c => c !== null && c !== undefined)
          .map(c => parseFloat(c))
          .filter(c => !isNaN(c));
        
        if (cals.length > 0) {
          promedio = cals.reduce((a, b) => a + b, 0) / cals.length;
        }
      }
      
      console.log('  -> Promedio calculado:', promedio);
      
      // Guardar
      try {
        await db.collection('calificaciones').doc(docId).set({
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          materiaId: asignacionActual.materiaId,
          materiaNombre: asignacionActual.materiaNombre,
          codigoGrupo: asignacionActual.codigoGrupo,
          profesorId: usuarioActual.uid,
          profesorNombre: usuarioActual.nombre,
          periodo: asignacionActual.periodo,
          carreraId: asignacionActual.carreraId,
          parciales: nuevosParciales,
          faltas: nuevasFaltas,
          promedio: promedio,
          actualizadoPor: usuarioActual.uid,
          fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        guardadas++;
        console.log('  ✓ Guardado correctamente');
        
      } catch (error) {
        errores++;
        erroresDetalle.push(`${alumno.nombre}: ${error.message}`);
        console.error('  ✗ Error al guardar:', error);
      }
    }
    
    console.log('\n=== RESUMEN ===');
    console.log('Guardadas:', guardadas);
    console.log('Errores:', errores);
    
    if (errores > 0) {
      alert(
        `CALIFICACIONES GUARDADAS CON ERRORES\n\n` +
        `Guardadas: ${guardadas}\n` +
        `Errores: ${errores}\n\n` +
        `Errores:\n${erroresDetalle.join('\n')}`
      );
    } else if (guardadas > 0) {
      alert(
        `¡CALIFICACIONES GUARDADAS!\n\n` +
        `${guardadas} alumno(s) actualizado(s)\n\n` +
        `Las calificaciones y faltas han sido guardadas.`
      );
      
      // Recargar datos
      await cargarAlumnosYCalificaciones();
    } else {
      alert('No hay calificaciones nuevas para guardar.');
    }
    
  } catch (error) {
    console.error('Error general:', error);
    alert('Error al guardar calificaciones: ' + error.message);
  }
}

// ============================================================================
// SECCIÓN 6: EXTRAORDINARIOS Y ETS
// ============================================================================

async function verExtraordinarios() {
  try {
    console.log('=== Abriendo extraordinarios ===');
    
    // Ocultar menú, mostrar sección de calificaciones
    document.getElementById('menuMaterias').style.display = 'none';
    document.getElementById('seccionCalificaciones').style.display = 'block';
    document.getElementById('btnVolverMenu').style.display = 'inline-block';
    
    const container = document.getElementById('contenedorMateriaCalif');
    container.innerHTML = '<h2 style="color: #dc3545;">Extraordinarios y ETS</h2>';
    
    const tablaContainer = document.getElementById('tablaCalificaciones');
    tablaContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Cargando materias...</p>';
    
    // SCROLL AUTOMÁTICO SUAVE (temprano, antes de cargar datos)
    setTimeout(() => {
      const seccion = document.getElementById('seccionCalificaciones');
      if (seccion) {
        seccion.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
    
    // Buscar todas las materias del profesor
    const asignacionesSnap = await db.collection('profesorMaterias')
      .where('profesorId', '==', usuarioActual.uid)
      .where('activa', '==', true)
      .get();
    
    console.log('Materias encontradas:', asignacionesSnap.size);
    
    if (asignacionesSnap.empty) {
      tablaContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <p>No tienes materias asignadas</p>
        </div>
      `;
      return;
    }
    
    let html = `
      <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
        <strong>Extraordinarios y ETS</strong>
        <p style="margin: 10px 0 0 0;">Solo se muestran los alumnos con promedio menor a 6.</p>
      </div>
    `;
    
    let hayReprobados = false;
    
    // Procesar cada materia
    for (const asigDoc of asignacionesSnap.docs) {
      const asignacion = { id: asigDoc.id, ...asigDoc.data() };
      
      console.log('\nProcesando materia:', asignacion.materiaNombre);
      
      // Buscar alumnos del grupo
      const alumnosSnap = await db.collection('usuarios')
        .where('rol', '==', 'alumno')
        .where('codigoGrupo', '==', asignacion.codigoGrupo)
        .where('activo', '==', true)
        .get();
      
      // Buscar inscripciones especiales
      const especialesSnap = await db.collection('inscripcionesEspeciales')
        .where('materiaId', '==', asignacion.materiaId)
        .where('codigoGrupo', '==', asignacion.codigoGrupo)
        .where('activa', '==', true)
        .get();
      
      console.log('  Alumnos encontrados:', alumnosSnap.size + especialesSnap.size);
      
      // Filtrar solo alumnos reprobados
      const alumnosReprobados = [];
      
      // Procesar alumnos normales
      for (const alumnoDoc of alumnosSnap.docs) {
        const alumno = { id: alumnoDoc.id, ...alumnoDoc.data() };
        
        const docId = `${alumno.id}_${asignacion.materiaId}`;
        const calDoc = await db.collection('calificaciones').doc(docId).get();
        
        if (calDoc.exists) {
          const data = calDoc.data();
          const parciales = data.parciales || {};
          
          let promedio = calcularPromedio(parciales);
          
          if (promedio !== null && promedio < 6) {
            alumnosReprobados.push({
              ...alumno,
              promedio,
              extraordinario: data.extraordinario,
              ets: data.ets,
              materiaId: asignacion.materiaId
            });
          }
        }
      }
      
      // Procesar alumnos especiales
      for (const inscripcionDoc of especialesSnap.docs) {
        const inscripcion = inscripcionDoc.data();
        
        const alumnoDoc = await db.collection('usuarios').doc(inscripcion.alumnoId).get();
        
        if (alumnoDoc.exists) {
          const alumno = alumnoDoc.data();
          
          const docId = `${inscripcion.alumnoId}_${asignacion.materiaId}`;
          const calDoc = await db.collection('calificaciones').doc(docId).get();
          
          if (calDoc.exists) {
            const data = calDoc.data();
            const parciales = data.parciales || {};
            
            let promedio = calcularPromedio(parciales);
            
            if (promedio !== null && promedio < 6) {
              alumnosReprobados.push({
                id: inscripcion.alumnoId,
                nombre: alumno.nombre,
                matricula: alumno.matricula || inscripcion.alumnoMatricula,
                promedio,
                extraordinario: data.extraordinario,
                ets: data.ets,
                materiaId: asignacion.materiaId,
                tipoInscripcion: 'especial'
              });
            }
          }
        }
      }
      
      console.log('  Alumnos reprobados:', alumnosReprobados.length);
      
      // Solo mostrar la materia si tiene alumnos reprobados
      if (alumnosReprobados.length > 0) {
        hayReprobados = true;
        
        html += generarSeccionExtraordinarios(asignacion, alumnosReprobados);
      }
    }
    
    if (!hayReprobados) {
      html += `
        <div style="text-align: center; padding: 40px; color: #4caf50;">
          <p style="font-size: 1.2rem; font-weight: 600;">No hay alumnos reprobados</p>
          <p style="color: #666; margin-top: 10px;">Todos los alumnos han aprobado sus materias</p>
        </div>
      `;
    } else {
      html += `
        <button onclick="guardarExtraordinarios()" 
                style="background: linear-gradient(135deg, #dc3545 0%, #c62828 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem; width: 100%; max-width: 300px; margin: 20px auto; display: block;">
          Guardar Extraordinarios
        </button>
      `;
    }
    
    tablaContainer.innerHTML = html;
    
    console.log('Extraordinarios cargados correctamente');
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar extraordinarios: ' + error.message);
  }
}

function calcularPromedio(parciales) {
  const tieneNP = parciales.parcial1 === 'NP' || parciales.parcial2 === 'NP' || parciales.parcial3 === 'NP';
  
  if (tieneNP) {
    return 5.0;
  }
  
  const cals = [parciales.parcial1, parciales.parcial2, parciales.parcial3]
    .filter(c => c !== null && c !== undefined)
    .map(c => parseFloat(c))
    .filter(c => !isNaN(c));
  
  if (cals.length > 0) {
    return cals.reduce((a, b) => a + b, 0) / cals.length;
  }
  
  return null;
}

function generarSeccionExtraordinarios(asignacion, alumnos) {
  let html = `
    <div style="margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c62828 100%); color: white; padding: 15px;">
        <div style="font-weight: 700; font-size: 18px;">${asignacion.materiaNombre}</div>
        <div style="font-size: 14px; opacity: 0.9;">
          Grupo: ${asignacion.codigoGrupo} | ${alumnos.length} alumno(s) reprobado(s)
        </div>
      </div>
      
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table style="width: 100%; min-width: 600px; border-collapse: collapse;">
          <thead style="background: #f5f5f5;">
            <tr>
              <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Alumno</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Matrícula</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 80px;">Promedio</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px; background: #fff3e0;">Extraordinario</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px; background: #ffebee;">ETS</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  alumnos.forEach((alumno) => {
    const globalIndex = `${asignacion.id}_${alumno.id}`;
    
    const badgeEspecial = alumno.tipoInscripcion === 'especial' 
      ? '<span style="display: inline-block; padding: 2px 6px; background: #fff3e0; color: #e65100; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-left: 5px;">ESP</span>' 
      : '';
    
    html += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600;">
          ${alumno.nombre}${badgeEspecial}
        </td>
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${alumno.matricula || 'N/A'}</td>
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #dc3545; font-weight: bold;">${alumno.promedio.toFixed(1)}</td>
        
        <!-- EXTRAORDINARIO -->
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #fff8e1;">
          ${alumno.extraordinario !== null && alumno.extraordinario !== undefined
            ? `<span style="font-weight: bold; color: #4caf50;">${alumno.extraordinario}</span>`
            : `<select id="ext_${globalIndex}" style="width: 70px; padding: 6px; border: 2px solid #ff9800; border-radius: 6px; text-align: center; font-weight: bold;">
                <option value="">-</option>
                ${generarOpcionesCalificacion()}
              </select>`
          }
        </td>
        
        <!-- ETS -->
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #fce4ec;">
          ${alumno.ets !== null && alumno.ets !== undefined
            ? `<span style="font-weight: bold; color: #4caf50;">${alumno.ets}</span>`
            : `<select id="ets_${globalIndex}" style="width: 70px; padding: 6px; border: 2px solid #dc3545; border-radius: 6px; text-align: center; font-weight: bold;">
                <option value="">-</option>
                ${generarOpcionesCalificacion()}
              </select>`
          }
        </td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return html;
}

function generarOpcionesCalificacion() {
  return `
    <option value="10">10</option>
    <option value="9">9</option>
    <option value="8">8</option>
    <option value="7">7</option>
    <option value="6">6</option>
    <option value="5">5</option>
    <option value="4">4</option>
    <option value="3">3</option>
    <option value="2">2</option>
    <option value="1">1</option>
    <option value="0">0</option>
  `;
}

async function guardarExtraordinarios() {
  if (!confirm('¿Guardar las calificaciones de Extraordinario y ETS?\n\nEstas calificaciones pueden ser modificadas por el coordinador.')) {
    return;
  }
  
  try {
    let guardadas = 0;
    const elementos = document.querySelectorAll('[id^="ext_"], [id^="ets_"]');
    
    console.log('Elementos de extraordinarios encontrados:', elementos.length);
    
    for (const elem of elementos) {
      const valor = elem.value;
      if (valor === '' || valor === null) continue;
      
      const id = elem.id;
      const [tipo, asignacionId, alumnoId] = id.split('_');
      
      const docId = `${alumnoId}_${asignacionId}`;
      
      console.log(`Guardando ${tipo} para documento: ${docId}, valor: ${valor}`);
      
      const updateData = {
        actualizadoPor: usuarioActual.uid,
        fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (tipo === 'ext') {
        updateData.extraordinario = parseFloat(valor);
      } else if (tipo === 'ets') {
        updateData.ets = parseFloat(valor);
      }
      
      await db.collection('calificaciones').doc(docId).update(updateData);
      guardadas++;
    }
    
    if (guardadas > 0) {
      alert(`¡Extraordinarios guardados!\n\n${guardadas} calificación(es) actualizada(s).`);
      verExtraordinarios(); // Recargar
    } else {
      alert('No hay calificaciones nuevas para guardar.');
    }
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al guardar extraordinarios: ' + error.message);
  }
}

// ============================================================================
// SECCIÓN 7: NAVEGACIÓN
// ============================================================================

function volverMenuProfe() {
  // Ocultar todas las secciones
  document.getElementById('seccionCalificaciones').style.display = 'none';
  document.getElementById('seccionMaterias').style.display = 'none';
  document.getElementById('seccionConfiguracion').style.display = 'none';
  
  // Mostrar menú principal
  document.getElementById('menuMaterias').style.display = 'grid';
  document.getElementById('btnVolverMenu').style.display = 'none';
  
  // Limpiar variables
  asignacionActual = null;
  alumnosMateria = [];
  
  // SCROLL AL TOP DE LA PÁGINA
  window.scrollTo({ 
    top: 0, 
    behavior: 'smooth' 
  });
  
  console.log('Regresando al menú principal');
}

function volverCoordinador() {
  window.location.href = 'https://ilbcontrol.mx/sice/controlCoordinador.html';
}

function verConfiguracion() {
  // Ocultar otras secciones
  document.getElementById('menuMaterias').style.display = 'none';
  document.getElementById('seccionMaterias').style.display = 'none';
  document.getElementById('seccionCalificaciones').style.display = 'none';
  
  // Mostrar configuración
  document.getElementById('seccionConfiguracion').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display = 'inline-block';
  
  console.log('Mostrando configuración');
}

// ============================================================================
// SECCIÓN 8: CONFIGURACIÓN
// ============================================================================

async function cambiarPassword(event) {
  event.preventDefault();
  
  const passwordActual = document.getElementById('passwordActual').value;
  const passwordNueva = document.getElementById('passwordNueva').value;
  const passwordConfirm = document.getElementById('passwordConfirm').value;
  
  if (passwordNueva !== passwordConfirm) {
    alert('Las contraseñas no coinciden');
    return;
  }
  
  if (passwordNueva.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    const user = firebase.auth().currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(
      user.email,
      passwordActual
    );
    
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(passwordNueva);
    
    alert('Contraseña actualizada correctamente');
    document.getElementById('formPassword').reset();
    
  } catch (error) {
    console.error('Error:', error);
    if (error.code === 'auth/wrong-password') {
      alert('La contraseña actual es incorrecta');
    } else {
      alert('Error al cambiar contraseña: ' + error.message);
    }
  }
}

async function cerrarSesion() {
  if (confirm('¿Cerrar sesión?')) {
    try {
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cerrar sesión');
    }
  }
}

// ============================================================================
// SECCIÓN 9: UTILIDADES
// ============================================================================

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.innerHTML = '🚫'; // Emoji de "ocultar"
  } else {
    input.type = 'password';
    button.innerHTML = '👁️‍🗨️'; // Emoji de "ver"
  }
}

console.log('Control Profesor cargado correctamente');