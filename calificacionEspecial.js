// calificaciones especiales que deberia verce junto con calificaciones normales
async function cargarCalificacionesMateria() {
  try {
    const selectMat = document.getElementById('selectMateriaCalif');
    const asignacionId = selectMat.value;
    
    if (!asignacionId) {
      document.getElementById('contenedorCalificaciones').style.display = 'none';
      return;
    }
    
    // Cargar asignacion
    const asigDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
    if (!asigDoc.exists) {
      alert('Asignacion no encontrada');
      return;
    }
    
    asignacionCalifActual = { id: asignacionId, ...asigDoc.data() };
    
    // Mostrar info
    document.getElementById('tituloMateriaCalif').textContent = asignacionCalifActual.materiaNombre;
    document.getElementById('infoMateriaCalif').textContent = 
      'Grupo: ' + asignacionCalifActual.grupoNombre + 
      ' | Profesor: ' + asignacionCalifActual.profesorNombre + 
      ' | Periodo: ' + asignacionCalifActual.periodo;
    
    // ===============================================
    // NUEVA LOGICA: Combinar alumnos normales + especiales
    // ===============================================
    
    alumnosCalifMateria = [];
    
    // 1. Cargar alumnos NORMALES del grupo
    console.log('Cargando alumnos normales del grupo:', asignacionCalifActual.grupoId);
    const alumnosNormales = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('grupoId', '==', asignacionCalifActual.grupoId)
      .where('activo', '==', true)
      .get();
    
    for (const doc of alumnosNormales.docs) {
      const alumno = {
        id: doc.id,
        nombre: doc.data().nombre,
        matricula: doc.data().matricula,
        tipoInscripcion: 'normal',
        calificaciones: {
          parcial1: null,
          parcial2: null,
          parcial3: null
        }
      };
      
      // Cargar calificaciones
      const docId = doc.id + '_' + asignacionCalifActual.materiaId;
      const calDoc = await db.collection('calificaciones').doc(docId).get();
      
      if (calDoc.exists) {
        const data = calDoc.data();
        alumno.calificaciones.parcial1 = data.parciales?.parcial1 ?? null;
        alumno.calificaciones.parcial2 = data.parciales?.parcial2 ?? null;
        alumno.calificaciones.parcial3 = data.parciales?.parcial3 ?? null;
      }
      
      alumnosCalifMateria.push(alumno);
    }
    
    console.log('Alumnos normales cargados:', alumnosNormales.size);
    
    // 2. Cargar alumnos ESPECIALES inscritos en esta materia y grupo
    console.log('Buscando alumnos especiales en materia:', asignacionCalifActual.materiaId, 'grupo:', asignacionCalifActual.grupoId);
    const alumnosEspeciales = await db.collection('inscripcionesEspeciales')
      .where('materiaId', '==', asignacionCalifActual.materiaId)
      .where('grupoId', '==', asignacionCalifActual.grupoId)
      .where('activa', '==', true)
      .get();
    
    console.log('Alumnos especiales encontrados:', alumnosEspeciales.size);
    
    for (const doc of alumnosEspeciales.docs) {
      const inscripcion = doc.data();
      
      // Obtener datos completos del alumno
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
            parcial3: null
          }
        };
        
        // Cargar calificaciones
        const docId = inscripcion.alumnoId + '_' + asignacionCalifActual.materiaId;
        const calDoc = await db.collection('calificaciones').doc(docId).get();
        
        if (calDoc.exists) {
          const data = calDoc.data();
          alumno.calificaciones.parcial1 = data.parciales?.parcial1 ?? null;
          alumno.calificaciones.parcial2 = data.parciales?.parcial2 ?? null;
          alumno.calificaciones.parcial3 = data.parciales?.parcial3 ?? null;
        }
        
        alumnosCalifMateria.push(alumno);
      }
    }
    
    // 3. ORDENAR ALFABETICAMENTE (A-Z)
    alumnosCalifMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    console.log('Total alumnos (normales + especiales):', alumnosCalifMateria.length);
    
    // 4. Generar tabla
    generarTablaCalificaciones();
    
    document.getElementById('contenedorCalificaciones').style.display = 'block';
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar calificaciones');
  }
}

// REEMPLAZAR generarTablaCalificaciones
function generarTablaCalificaciones() {
  const container = document.getElementById('tablaCalificacionesCoord');
  
  // Calcular estadisticas
  const totalNormales = alumnosCalifMateria.filter(a => a.tipoInscripcion === 'normal').length;
  const totalEspeciales = alumnosCalifMateria.filter(a => a.tipoInscripcion === 'especial').length;
  
  let html = `
    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #4caf50;">
      <strong>Total de Alumnos: ${alumnosCalifMateria.length}</strong>
      <div style="margin-top: 8px; font-size: 0.9rem;">
        <span style="background: white; padding: 4px 10px; border-radius: 4px; margin-right: 10px;">
          Normales: ${totalNormales}
        </span>
        <span style="background: #fff3cd; padding: 4px 10px; border-radius: 4px;">
          Especiales: ${totalEspeciales}
        </span>
      </div>
    </div>
    
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd; width: 40px;">#</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd; min-width: 200px;">Alumno</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 120px;">Matricula</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Parcial 1</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Parcial 2</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Parcial 3</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Promedio</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  alumnosCalifMateria.forEach((alumno, index) => {
    const promedio = calcularPromedioAlumno(alumno);
    
    // Badge de tipo
    const tipoBadge = alumno.tipoInscripcion === 'especial' 
      ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px; font-weight: 600;">E</span>'
      : '';
    
    // Estilo de fila
    const rowStyle = alumno.tipoInscripcion === 'especial' ? 'background: #fff8e1;' : '';
    
    html += `
      <tr style="border-bottom: 1px solid #eee; ${rowStyle}">
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold;">
          ${index + 1}
        </td>
        <td style="padding: 12px; border: 1px solid #ddd;">
          <strong>${alumno.nombre}</strong>
          ${tipoBadge}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #666;">
          ${alumno.matricula}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
          ${generarDropdownCalif(index, 'parcial1', alumno.calificaciones.parcial1)}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
          ${generarDropdownCalif(index, 'parcial2', alumno.calificaciones.parcial2)}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
          ${generarDropdownCalif(index, 'parcial3', alumno.calificaciones.parcial3)}
        </td>
        <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 1.2rem; color: #667eea;">
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
      Desliza horizontalmente para ver todas las columnas en movil
    </p>
  `;
  
  container.innerHTML = html;
}

// REEMPLAZAR guardarTodasCalificacionesCoord
async function guardarTodasCalificacionesCoord() {
  if (!confirm('Guardar las calificaciones de todos los alumnos (normales y especiales)?')) {
    return;
  }
  
  try {
    let guardadas = 0;
    
    for (let i = 0; i < alumnosCalifMateria.length; i++) {
      const alumno = alumnosCalifMateria[i];
      
      // Leer valores de dropdowns
      const p1 = document.getElementById('calif_' + i + '_parcial1').value;
      const p2 = document.getElementById('calif_' + i + '_parcial2').value;
      const p3 = document.getElementById('calif_' + i + '_parcial3').value;
      
      // Convertir a numero o null
      const parcial1 = p1 === '' ? null : (p1 === 'NP' ? 'NP' : parseInt(p1));
      const parcial2 = p2 === '' ? null : (p2 === 'NP' ? 'NP' : parseInt(p2));
      const parcial3 = p3 === '' ? null : (p3 === 'NP' ? 'NP' : parseInt(p3));
      
      // Guardar en nueva estructura
      const docId = alumno.id + '_' + asignacionCalifActual.materiaId;
      
      await db.collection('calificaciones').doc(docId).set({
        alumnoId: alumno.id,
        materiaId: asignacionCalifActual.materiaId,
        materiaNombre: asignacionCalifActual.materiaNombre,
        materiaCodigo: asignacionCalifActual.materiaCodigo || '',
        grupoId: asignacionCalifActual.grupoId,
        grupoNombre: asignacionCalifActual.grupoNombre,
        profesorId: asignacionCalifActual.profesorId,
        profesorNombre: asignacionCalifActual.profesorNombre,
        carreraId: asignacionCalifActual.carreraId,
        periodo: asignacionCalifActual.periodo,
        tipoAlumno: alumno.tipoInscripcion,
        parciales: {
          parcial1: parcial1,
          parcial2: parcial2,
          parcial3: parcial3
        },
        fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
        actualizadoPor: usuarioActual.uid
      }, { merge: true });
      
      guardadas++;
    }
    
    alert('Calificaciones guardadas: ' + guardadas + '\n\nTotal alumnos: ' + alumnosCalifMateria.length);
    
    // Recargar
    await cargarCalificacionesMateria();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al guardar calificaciones');
  }
}

console.log('Sistema de Calificaciones con Alumnos Especiales cargado');