// controlEscolar_AlumnosEspeciales_ADDON.js
// AGREGAR en controlEscolar.html DESPUES de controlEscolar.js
// Permite a Control Escolar ver alumnos especiales de todas las carreras

console.log('=== ADDON ALUMNOS ESPECIALES PARA CONTROL ESCOLAR ===');

// AGREGAR al HTML: Boton para ver alumnos especiales de una carrera
// Este codigo se debe integrar en la funcion seleccionarCarrera

// OPCION 1: Modificar la funcion seleccionarCarrera original
// Guardamos la funcion original
const seleccionarCarreraOriginal = seleccionarCarrera;

seleccionarCarrera = async function(carreraId) {
  carreraSeleccionada = carrerasData.find(c => c.id === carreraId);
  
  if (!carreraSeleccionada) {
    alert('Carrera no encontrada');
    return;
  }
  
  console.log('Carrera seleccionada:', carreraSeleccionada.nombre);
  
  // Cargar grupos de esta carrera
  try {
    const snapshot = await db.collection('grupos')
      .where('carreraId', '==', carreraId)
      .where('activo', '==', true)
      .get();
    
    gruposData = [];
    snapshot.forEach(doc => {
      gruposData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    gruposData.sort((a, b) => (a.ordenamiento || 0) - (b.ordenamiento || 0));
    
    // Ocultar menu de carreras
    document.getElementById('menuCarreras').style.display = 'none';
    document.getElementById('gruposContainer').style.display = 'block';
    
    // NUEVO: Agregar boton de alumnos especiales
    let html = '<h2 class="titulo-seccion" style="margin-bottom: 20px;">' + carreraSeleccionada.nombre + '</h2>';
    
    // BOTON ESPECIAL: Ver alumnos especiales
    html += `
      <div style="background: #fff3cd; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #856404;">Alumnos Especiales</strong>
            <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #856404;">
              Alumnos que toman materias de diferentes grupos (sin grupo fijo)
            </p>
          </div>
          <button onclick="verAlumnosEspeciales()" 
                  style="padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap;">
            Ver Alumnos Especiales
          </button>
        </div>
      </div>
    `;
    
    html += '<h3 style="margin: 20px 0 15px 0; color: #6A2135;">Grupos Regulares:</h3>';
    
    if (gruposData.length === 0) {
      html += '<div class="sin-datos">No hay grupos en esta carrera</div>';
    } else {
      html += '<div class="grupos-grid">';
      gruposData.forEach(grupo => {
        html += `
          <div class="grupo-card" onclick="seleccionarGrupo('${grupo.id}')">
            <div class="grupo-nombre">${grupo.nombre}</div>
            <div class="grupo-info">
              ${grupo.periodo || periodoActual}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    document.getElementById('gruposGrid').innerHTML = html;
    document.getElementById('opcionesContainer').style.display = 'none';
    
  } catch (error) {
    console.error('Error al cargar grupos:', error);
    alert('Error al cargar grupos');
  }
};

// NUEVA FUNCION: Ver alumnos especiales de la carrera
async function verAlumnosEspeciales() {
  if (!carreraSeleccionada) {
    alert('Selecciona una carrera primero');
    return;
  }
  
  console.log('Cargando alumnos especiales de:', carreraSeleccionada.nombre);
  
  try {
    // Cargar TODOS los alumnos especiales de esta carrera
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
    
    // Ordenar alfabeticamente
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
            <th>Matricula</th>
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
            <button onclick="verDetalleAlumnoEspecial('${alumno.id}', '${alumno.nombre}')" 
                    class="btn-accion">
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

// NUEVA FUNCION: Ver detalle de un alumno especial
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
    
    // Para cada inscripcion, obtener calificaciones
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
            <strong style="color: #666;">Matricula:</strong><br>
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

console.log('=== ADDON ALUMNOS ESPECIALES CARGADO ===');