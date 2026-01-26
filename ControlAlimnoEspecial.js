// controlAlumnoEspecial_ADDON.js
// AGREGAR al final de controlAlumno.html ANTES del </body>
// Modifica la carga de materias para soportar alumnos especiales

// REEMPLAZAR la funcion cargarMateriasYCalificaciones
async function cargarMateriasYCalificaciones() {
  const container = document.getElementById('listaMaterias');
  
  // VERIFICAR SI ES ALUMNO ESPECIAL
  const esAlumnoEspecial = alumnoActual.tipoAlumno === 'especial';
  
  if (esAlumnoEspecial) {
    console.log('Alumno ESPECIAL detectado - cargando inscripciones especiales');
    await cargarMateriasAlumnoEspecial(container);
  } else {
    console.log('Alumno NORMAL - cargando materias del grupo');
    await cargarMateriasAlumnoNormal(container);
  }
}

// Cargar materias para alumno NORMAL (del grupo)
async function cargarMateriasAlumnoNormal(container) {
  if (!alumnoActual.grupoId) {
    container.innerHTML = '<div class="sin-datos">No estas asignado a ningun grupo.</div>';
    return;
  }
  
  try {
    // Buscar materias asignadas al grupo
    const materiasSnap = await db.collection('profesorMaterias')
      .where('grupoId', '==', alumnoActual.grupoId)
      .where('activa', '==', true)
      .get();
    
    if (materiasSnap.empty) {
      container.innerHTML = '<div class="sin-datos">Tu grupo aun no tiene materias asignadas.</div>';
      return;
    }
    
    // Construir estructura de datos para boleta
    const materias = [];
    
    for (const doc of materiasSnap.docs) {
      const materia = doc.data();
      
      // Buscar calificaciones de esta materia
      const docId = alumnoActual.id + '_' + materia.materiaId;
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      let parcial1 = '-';
      let parcial2 = '-';
      let parcial3 = '-';
      
      if (calDoc.exists) {
        const data = calDoc.data();
        parcial1 = data.parciales?.parcial1 ?? '-';
        parcial2 = data.parciales?.parcial2 ?? '-';
        parcial3 = data.parciales?.parcial3 ?? '-';
      }
      
      materias.push({
        nombre: materia.materiaNombre,
        codigo: materia.materiaCodigo,
        profesor: materia.profesorNombre,
        parcial1: parcial1,
        parcial2: parcial2,
        parcial3: parcial3
      });
    }
    
    generarTablaBoletaHTML(container, materias);
    
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = '<div class="sin-datos" style="color: red;">Error al cargar informacion</div>';
  }
}

// Cargar materias para alumno ESPECIAL (de inscripciones especiales)
async function cargarMateriasAlumnoEspecial(container) {
  try {
    // Buscar inscripciones especiales del alumno
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoActual.id)
      .where('activa', '==', true)
      .get();
    
    if (inscripcionesSnap.empty) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>Aun no tienes materias inscritas</p>
          <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
            Contacta a tu coordinador para inscribirte en materias
          </p>
        </div>
      `;
      return;
    }
    
    // Construir estructura de datos para boleta
    const materias = [];
    
    for (const doc of inscripcionesSnap.docs) {
      const inscripcion = doc.data();
      
      // Buscar calificaciones de esta materia
      const docId = alumnoActual.id + '_' + inscripcion.materiaId;
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      let parcial1 = '-';
      let parcial2 = '-';
      let parcial3 = '-';
      
      if (calDoc.exists) {
        const data = calDoc.data();
        parcial1 = data.parciales?.parcial1 ?? '-';
        parcial2 = data.parciales?.parcial2 ?? '-';
        parcial3 = data.parciales?.parcial3 ?? '-';
      }
      
      materias.push({
        nombre: inscripcion.materiaNombre,
        codigo: inscripcion.materiaCodigo || '',
        profesor: inscripcion.profesorNombre || 'Sin asignar',
        grupo: inscripcion.grupoNombre,  // EXTRA: mostrar grupo
        parcial1: parcial1,
        parcial2: parcial2,
        parcial3: parcial3
      });
    }
    
    // Ordenar alfabeticamente
    materias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    generarTablaBoletaHTML(container, materias, true); // true = mostrar columna grupo
    
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = '<div class="sin-datos" style="color: red;">Error al cargar informacion</div>';
  }
}

// Generar tabla HTML de boleta
function generarTablaBoletaHTML(container, materias, mostrarGrupo = false) {
  let html = `
    <div style="background: white; padding: 20px; border-radius: 10px;">
      <h3 style="color: #6A2135; margin: 0 0 20px 0; text-align: center;">Boleta de Calificaciones</h3>
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table style="width: 100%; min-width: ${mostrarGrupo ? '700px' : '600px'}; border-collapse: collapse;">
        <thead>
          <tr style="background: #6A2135; color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Materia</th>
            ${mostrarGrupo ? '<th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Grupo</th>' : ''}
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px; min-width: 90px;">Parcial 1</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px; min-width: 90px;">Parcial 2</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px; min-width: 90px;">Parcial 3</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px; min-width: 90px;">Promedio</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  materias.forEach(materia => {
    // REGLA DE NEGOCIO: Si hay NP en cualquier parcial, promedio = 5.0
    const tieneNP = materia.parcial1 === 'NP' || materia.parcial2 === 'NP' || materia.parcial3 === 'NP';
    
    let promedio = '-';
    
    if (tieneNP) {
      promedio = '5.0';
    } else {
      // Calcular promedio normal si no hay NP
      const cals = [materia.parcial1, materia.parcial2, materia.parcial3]
        .filter(c => c !== '-' && c !== null && c !== undefined)
        .map(c => parseFloat(c))
        .filter(c => !isNaN(c));
      
      if (cals.length > 0) {
        promedio = (cals.reduce((a, b) => a + b, 0) / cals.length).toFixed(1);
      }
    }
    
    html += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; border: 1px solid #ddd;">
          <strong>${materia.nombre}</strong>
          <br><small style="color: #666;">Profesor: ${materia.profesor}</small>
        </td>
        ${mostrarGrupo ? `<td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #666; font-weight: bold;">${materia.grupo}</td>` : ''}
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.2rem; font-weight: bold; color: ${materia.parcial1 === 'NP' ? '#a60d24' : (materia.parcial1 !== '-' ? '#000000' : '#000000')};">
          ${materia.parcial1}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.2rem; font-weight: bold; color: ${materia.parcial2 === 'NP' ? '#a60d24' : (materia.parcial2 !== '-' ? '#000000' : '#000000')};">
          ${materia.parcial2}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.2rem; font-weight: bold; color: ${materia.parcial3 === 'NP' ? '#a60d24' : (materia.parcial3 !== '-' ? '#000000' : '#000000')};">
          ${materia.parcial3}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.3rem; font-weight: bold; background: #f0f7ff; color: #6A2135;">
          ${promedio}
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
        </table>
      </div>
      <p style="text-align: center; color: #999; font-size: 0.85rem; margin-top: 10px;">
        Desliza para ver todo el contenido si estas en un dispositivo movil.
      </p>
    </div>
  `;
  
  container.innerHTML = html;
}

// MODIFICAR la funcion mostrarInformacionAlumno para incluir tipo de alumno
// Busca la funcion existente y agrega esto despues de cargar grupo:

// Agregar esta funcion auxiliar al final
async function mostrarTipoAlumnoEnInfo() {
  const grupoDisplay = document.getElementById('infoGrupo');
  
  if (alumnoActual.tipoAlumno === 'especial') {
    if (grupoDisplay) {
      grupoDisplay.innerHTML = '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">ALUMNO ESPECIAL</span>';
    }
  }
}

// Llamar esta funcion al final de mostrarInformacionAlumno
// Agregar antes de cargarMateriasYCalificaciones():
// await mostrarTipoAlumnoEnInfo();

console.log('Sistema de consulta para alumnos especiales cargado');