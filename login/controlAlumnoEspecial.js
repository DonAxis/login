// controlAlumnoEspecial.js
// SISTEMA COMPLETO DE ALUMNOS ESPECIALES
// Un solo archivo que incluye TODO:
// - Crear alumnos especiales
// - Inscribir por materia (grupo automatico)
// - Ver calificaciones (coordinador y profesor)
// - Consulta de alumno especial
// - Regularizar alumno (convertir a normal)

console.log('=== SISTEMA DE ALUMNOS ESPECIALES INICIANDO ===');

// =====================================================
// PARTE 1: CREAR ALUMNO ESPECIAL
// =====================================================

async function mostrarFormCrearAlumnoEspecial() {
  document.getElementById('tituloModal').textContent = 'Crear Alumno Especial';
  
  const html = `
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <strong>Que es un Alumno Especial?</strong>
      <p style="margin: 10px 0 0 0; font-size: 0.9rem;">
        Alumnos que regresan, vienen de otra escuela, o necesitan tomar materias 
        de diferentes grupos. NO se inscribiran en Registro de Alumnos.
      </p>
    </div>
    
    <form onsubmit="guardarAlumnoEspecial(event)">
      <div class="form-grupo">
        <label>Nombre Completo: *</label>
        <input type="text" id="nombreAlumnoEsp" required 
               placeholder="Ej: Juan Perez Garcia">
      </div>
      
      <div class="form-grupo">
        <label>Matricula: *</label>
        <input type="text" id="matriculaAlumnoEsp" required 
               placeholder="Ej: 2020AB001">
        <small style="color: #666;">Formato: AÑO + 2 letras + 3 numeros</small>
      </div>
      
      <div class="form-grupo">
        <label>Correo Electronico: *</label>
        <input type="email" id="emailAlumnoEsp" required 
               placeholder="juan.perez@alumno.com">
      </div>
      
      <div class="form-grupo">
        <label>Periodo de Ingreso: *</label>
        <input type="text" id="periodoAlumnoEsp" required 
               value="${periodoActualCarrera}"
               placeholder="Ej: 2026-1">
        <small style="color: #666;">Periodo en el que ingresa (actual: ${periodoActualCarrera})</small>
      </div>
      
      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3; margin-top: 15px;">
        <strong>Despues de crear al alumno:</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">
          Podras inscribirlo materia por materia (el grupo se detecta automaticamente).
        </p>
      </div>
      
      <div class="form-botones" style="margin-top: 20px;">
        <button type="submit" class="btn-guardar">Crear Alumno Especial</button>
        <button type="button" onclick="cerrarModal()" class="btn-cancelar">Cancelar</button>
      </div>
    </form>
  `;
  
  document.getElementById('contenidoModal').innerHTML = html;
  document.getElementById('modalGenerico').style.display = 'block';
}

async function guardarAlumnoEspecial(event) {
  event.preventDefault();
  
  const nombre = document.getElementById('nombreAlumnoEsp').value.trim();
  const matricula = document.getElementById('matriculaAlumnoEsp').value.trim().toUpperCase();
  const email = document.getElementById('emailAlumnoEsp').value.trim().toLowerCase();
  const periodo = document.getElementById('periodoAlumnoEsp').value.trim();
  
  try {
    const matriculaExiste = await db.collection('usuarios')
      .where('matricula', '==', matricula)
      .get();
    
    if (!matriculaExiste.empty) {
      alert('Esta matricula ya esta registrada.\n\nVerifica los datos.');
      return;
    }
    
    const emailExiste = await db.collection('usuarios')
      .where('email', '==', email)
      .get();
    
    if (!emailExiste.empty) {
      alert('Este correo ya esta registrado.\n\nVerifica los datos.');
      return;
    }
    
    const alumnoData = {
      nombre: nombre,
      matricula: matricula,
      email: email,
      rol: 'alumno',
      tipoAlumno: 'especial',
      grupoId: null,
      carreraId: usuarioActual.carreraId,
      activo: true,
      periodo: periodo,
      generacion: periodo,
      semestreActual: null,
      graduado: false,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
      creadoPor: usuarioActual.uid,
      creadorNombre: usuarioActual.nombre
    };
    
    const docRef = await db.collection('usuarios').add(alumnoData);
    
    console.log('Alumno especial creado:', docRef.id);
    
    alert('Alumno Especial Creado Exitosamente!\n\n' +
          'Nombre: ' + nombre + '\n' +
          'Matricula: ' + matricula + '\n' +
          'Email: ' + email + '\n\n' +
          'Ahora puedes inscribirlo en materias.');
    
    cerrarModal();
    await cargarInscripciones();
    
  } catch (error) {
    console.error('Error al crear alumno especial:', error);
    alert('Error al crear alumno: ' + error.message);
  }
}

// =====================================================
// PARTE 2: INSCRIBIR EN MATERIA (GRUPO AUTOMATICO)
// =====================================================
async function mostrarFormInscribirAlumno() {
  document.getElementById('tituloModal').textContent = 'Inscribir Alumno a Materia';
  
  const alumnosSnap = await db.collection('usuarios')
    .where('rol', '==', 'alumno')
    .where('tipoAlumno', '==', 'especial')
    .where('carreraId', '==', usuarioActual.carreraId)
    .where('activo', '==', true)
    .get();
  
  let alumnosHtml = '<option value="">Seleccionar alumno especial...</option>';
  
  const alumnosArray = [];
  alumnosSnap.forEach(doc => {
    alumnosArray.push({ id: doc.id, ...doc.data() });
  });
  
  alumnosArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
  
  alumnosArray.forEach(alumno => {
    alumnosHtml += `<option value="${alumno.id}" data-nombre="${alumno.nombre}" data-matricula="${alumno.matricula}">
      ${alumno.nombre} - ${alumno.matricula}
    </option>`;
  });
  
  if (alumnosArray.length === 0) {
    alert('No hay alumnos especiales creados.\n\nPrimero crea un alumno especial.');
    return;
  }
  
  const asignacionesSnap = await db.collection('profesorMaterias')
    .where('carreraId', '==', usuarioActual.carreraId)
    .where('activa', '==', true)
    .get();
  
  let materiasHtml = '<option value="">Seleccionar materia...</option>';
  
  const asignacionesArray = [];
  asignacionesSnap.forEach(doc => {
    asignacionesArray.push({ 
      id: doc.id,
      ...doc.data() 
    });
  });
  
  asignacionesArray.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre));
  
  asignacionesArray.forEach(asig => {
    // ✓ CORREGIDO: usar codigoGrupo en lugar de grupoNombre
    const grupoTexto = asig.codigoGrupo || 'Sin grupo';
    materiasHtml += `<option value="${asig.id}">
      ${asig.materiaNombre} (${grupoTexto}) - Prof. ${asig.profesorNombre}
    </option>`;
  });
  
  if (asignacionesArray.length === 0) {
    alert('No hay materias armadas.\n\nPrimero arma grupos usando "Asignar" o "Asignar2".');
    return;
  }
  
  const html = `
    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
      <strong>Inscripcion por Materia</strong>
      <p style="margin: 10px 0 0 0; font-size: 0.9rem;">
        Selecciona la materia y el grupo se detectara automaticamente.
      </p>
    </div>
    
    <form onsubmit="guardarInscripcionAlumno(event)">
      <div class="form-grupo">
        <label>Alumno Especial: *</label>
        <select id="alumnoInscribir" required onchange="mostrarInfoAlumnoEspecial(this)">
          ${alumnosHtml}
        </select>
        <div id="infoAlumnoEspecial" style="display: none; background: #f5f5f5; padding: 10px; border-radius: 5px; margin-top: 8px; font-size: 0.9rem;">
        </div>
      </div>
      
      <div class="form-grupo">
        <label>Materia (Grupo - Profesor): *</label>
        <select id="asignacionInscribir" required onchange="mostrarInfoAsignacion()">
          ${materiasHtml}
        </select>
        <small style="color: #666;">El grupo y profesor ya estan asignados a la materia</small>
      </div>
      
      <div id="infoAsignacion" style="display: none; background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #2196f3;">
      </div>
      
      <div class="form-grupo">
        <label>Periodo: *</label>
        <input type="text" id="periodoInscribir" required 
               value="${periodoActualCarrera}"
               placeholder="Ej: 2026-1" readonly>
      </div>
      
      <div class="form-botones" style="margin-top: 20px;">
        <button type="submit" class="btn-guardar">Inscribir en Materia</button>
        <button type="button" onclick="cerrarModal()" class="btn-cancelar">Cancelar</button>
      </div>
    </form>
  `;
  
  document.getElementById('contenidoModal').innerHTML = html;
  document.getElementById('modalGenerico').style.display = 'block';
}

async function mostrarInfoAlumnoEspecial(select) {
  const alumnoId = select.value;
  const infoDiv = document.getElementById('infoAlumnoEspecial');
  
  if (!alumnoId) {
    infoDiv.style.display = 'none';
    return;
  }
  
  try {
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('activa', '==', true)
      .get();
    
    const alumnoNombre = select.options[select.selectedIndex].dataset.nombre;
    const alumnoMatricula = select.options[select.selectedIndex].dataset.matricula;
    
    infoDiv.innerHTML = 
      '<strong>' + alumnoNombre + '</strong> - ' + alumnoMatricula + '<br>' +
      '<span style="color: #4caf50;">' + inscripcionesSnap.size + ' materia(s) inscrita(s) actualmente</span>';
    infoDiv.style.display = 'block';
    
  } catch (error) {
    console.error('Error al cargar info:', error);
  }
}

async function mostrarInfoAsignacion() {
  const asignacionId = document.getElementById('asignacionInscribir').value;
  const infoDiv = document.getElementById('infoAsignacion');
  
  if (!asignacionId) {
    infoDiv.style.display = 'none';
    return;
  }
  
  try {
    const asigDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
    
    if (asigDoc.exists) {
      const asig = asigDoc.data();
      
      // Obtener nombre del turno
      const turnosNombres = {
        1: 'Matutino',
        2: 'Vespertino',
        3: 'Nocturno',
        4: 'Sabatino'
      };
      const turnoTexto = asig.turnoNombre || turnosNombres[asig.turno] || 'Sin turno';
      
      // ✓ CORREGIDO: usar codigoGrupo en lugar de grupoNombre y materiaCodigo
      infoDiv.innerHTML = `
        <strong>Detalles de la asignacion:</strong><br>
        <div style="margin-top: 10px; display: grid; gap: 5px;">
          <div><strong>Materia:</strong> ${asig.materiaNombre || 'Sin nombre'}</div>
          <div><strong>Grupo:</strong> ${asig.codigoGrupo || 'Sin grupo'}</div>
          <div><strong>Turno:</strong> ${turnoTexto}</div>
          <div><strong>Profesor:</strong> ${asig.profesorNombre || 'Sin profesor'}</div>
          <div><strong>Periodo:</strong> ${asig.periodo || 'N/A'}</div>
        </div>
      `;
      infoDiv.style.display = 'block';
    }
    
  } catch (error) {
    console.error('Error:', error);
    infoDiv.style.display = 'none';
  }
}

async function guardarInscripcionAlumno(event) {
  event.preventDefault();
  
  const alumnoSelect = document.getElementById('alumnoInscribir');
  const asignacionId = document.getElementById('asignacionInscribir').value;
  const periodo = document.getElementById('periodoInscribir').value.trim();
  
  const alumnoId = alumnoSelect.value;
  const alumnoNombre = alumnoSelect.options[alumnoSelect.selectedIndex].dataset.nombre;
  const alumnoMatricula = alumnoSelect.options[alumnoSelect.selectedIndex].dataset.matricula;
  
  try {
    const asigDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
    
    if (!asigDoc.exists) {
      alert('Error: Asignacion no encontrada');
      return;
    }
    
    const asignacion = asigDoc.data();
    
    console.log('Asignación cargada:', asignacion);
    
    // Verificar que tenga los campos necesarios
    if (!asignacion.materiaId) {
      alert('Error: Esta asignación no tiene un ID de materia válido.\nContacta al coordinador para que la vuelva a crear.');
      return;
    }
    
    if (!asignacion.codigoGrupo) {
      alert('Error: Esta asignación no tiene un código de grupo válido.\nContacta al coordinador para que la vuelva a crear.');
      return;
    }
    
    const existe = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('materiaId', '==', asignacion.materiaId)
      .where('periodo', '==', periodo)
      .where('activa', '==', true)
      .get();
    
    if (!existe.empty) {
      alert('Este alumno ya esta inscrito en esta materia en este periodo.\n\nVerifica los datos.');
      return;
    }
    
    // ✓ CORREGIDO: usar campos que SÍ existen
    const inscripcionData = {
      alumnoId: alumnoId,
      alumnoNombre: alumnoNombre,
      alumnoMatricula: alumnoMatricula,
      
      materiaId: asignacion.materiaId,
      materiaNombre: asignacion.materiaNombre,
      
      codigoGrupo: asignacion.codigoGrupo,  // ✓ Cambiado de grupoId
      
      profesorId: asignacion.profesorId,
      profesorNombre: asignacion.profesorNombre,
      
      profesorMateriaId: asignacionId,
      
      carreraId: usuarioActual.carreraId,
      periodo: periodo,
      
      activa: true,
      tipoInscripcion: 'especial',
      
      fechaInscripcion: firebase.firestore.FieldValue.serverTimestamp(),
      inscritoPor: usuarioActual.uid,
      inscriptorNombre: usuarioActual.nombre
    };
    
    console.log('Guardando inscripción:', inscripcionData);
    
    await db.collection('inscripcionesEspeciales').add(inscripcionData);
    
    console.log('Inscripcion especial creada exitosamente');
    
    // ✓ CORREGIDO: usar codigoGrupo en el mensaje
    alert('Inscripcion Exitosa!\n\n' +
          'Alumno: ' + alumnoNombre + '\n' +
          'Materia: ' + asignacion.materiaNombre + '\n' +
          'Grupo: ' + asignacion.codigoGrupo + '\n' +
          'Profesor: ' + asignacion.profesorNombre);
    
    cerrarModal();
    await cargarInscripciones();
    
  } catch (error) {
    console.error('Error al inscribir:', error);
    alert('Error al inscribir: ' + error.message);
  }
}

// =====================================================
// PARTE 3: LISTAR INSCRIPCIONES
// =====================================================

async function cargarInscripciones() {
  try {
    const container = document.getElementById('listaInscripciones');
    
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('tipoAlumno', '==', 'especial')
      .where('carreraId', '==', usuarioActual.carreraId)
      .where('activo', '==', true)
      .get();
    
    if (alumnosSnap.empty) {
      container.innerHTML = `
        <div class="sin-datos">
          <p>No hay alumnos especiales creados</p>
          <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
            Crea un alumno especial para comenzar
          </p>
        </div>
      `;
      return;
    }
    
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('carreraId', '==', usuarioActual.carreraId)
      .where('periodo', '==', periodoActualCarrera)
      .where('activa', '==', true)
      .get();
    
    const inscripcionesPorAlumno = {};
    inscripcionesSnap.forEach(doc => {
      const insc = doc.data();
      if (!inscripcionesPorAlumno[insc.alumnoId]) {
        inscripcionesPorAlumno[insc.alumnoId] = [];
      }
      inscripcionesPorAlumno[insc.alumnoId].push({
        id: doc.id,
        ...insc
      });
    });
    
    let html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
    
    const alumnosArray = [];
    alumnosSnap.forEach(doc => {
      alumnosArray.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    alumnosArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    alumnosArray.forEach(alumno => {
      const inscripciones = inscripcionesPorAlumno[alumno.id] || [];
      
      html += `
        <div style="background: white; border: 2px solid #43a047; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 1.2rem; font-weight: bold;">
                ${alumno.nombre}
                <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; margin-left: 10px;">ESPECIAL</span>
              </div>
              <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 5px;">
                Matricula: ${alumno.matricula} | ${inscripciones.length} materia(s) inscrita(s)
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              ${inscripciones.length > 0 ? `
                <button onclick="verTodasMateriasAlumnoEspecial('${alumno.id}', '${alumno.nombre}')" 
                        style="background: white; color: #43a047; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                  Ver Todas
                </button>
              ` : ''}
              <button onclick="inscribirOtraMateriaAlumno('${alumno.id}')" 
                      style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                + Agregar Materia
              </button>
            </div>
          </div>
          
          <div style="padding: 20px;">
      `;
      
      if (inscripciones.length === 0) {
        html += `
          <div style="text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <p style="color: #666; margin: 0;">Este alumno aun no tiene materias inscritas</p>
            <p style="color: #999; font-size: 0.9rem; margin: 10px 0 0 0;">Haz clic en "+ Agregar Materia" para inscribirlo</p>
          </div>
        `;
      } else {
        html += '<div style="display: grid; gap: 12px;">';
        
        inscripciones.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre));
        
        inscripciones.forEach(insc => {
          html += `
            <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div style="font-weight: bold; color: #333;">
                  ${insc.materiaNombre}
                  ${insc.materiaCodigo ? '<span style="color: #666; font-size: 0.9rem;">(' + insc.materiaCodigo + ')</span>' : ''}
                </div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 4px;">
                  Grupo: ${insc.grupoNombre} | 
                  Profesor: ${insc.profesorNombre || 'Sin asignar'}
                </div>
              </div>
              <button onclick="darDeBajaInscripcionEspecial('${insc.id}', '${insc.materiaNombre}')" 
                      style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                Dar de Baja
              </button>
            </div>
          `;
        });
        
        html += '</div>';
      }
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
    
    console.log(alumnosSnap.size + ' alumnos especiales cargados');
    
  } catch (error) {
    console.error('Error al cargar inscripciones:', error);
    document.getElementById('listaInscripciones').innerHTML = 
      '<div class="sin-datos" style="color: red;">Error al cargar inscripciones especiales</div>';
  }
}

async function darDeBajaInscripcionEspecial(inscripcionId, materiaNombre) {
  if (!confirm('Dar de baja la inscripcion de:\n\n' + materiaNombre + '?\n\nEsta accion no se puede deshacer.')) {
    return;
  }
  
  try {
    await db.collection('inscripcionesEspeciales').doc(inscripcionId).update({
      activa: false,
      fechaBaja: firebase.firestore.FieldValue.serverTimestamp(),
      dadoDeBajaPor: usuarioActual.uid
    });
    
    alert('Inscripcion dada de baja correctamente');
    await cargarInscripciones();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al dar de baja: ' + error.message);
  }
}

async function inscribirOtraMateriaAlumno(alumnoId) {
  await mostrarFormInscribirAlumno();
  
  setTimeout(() => {
    const select = document.getElementById('alumnoInscribir');
    if (select) {
      select.value = alumnoId;
      mostrarInfoAlumnoEspecial(select);
    }
  }, 100);
}

async function verTodasMateriasAlumnoEspecial(alumnoId, alumnoNombre) {
  try {
    const snapshot = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('activa', '==', true)
      .get();
    
    if (snapshot.empty) {
      alert('Este alumno no tiene materias inscritas actualmente.');
      return;
    }
    
    const inscripciones = [];
    snapshot.forEach(doc => {
      inscripciones.push({ id: doc.id, ...doc.data() });
    });
    
    inscripciones.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre));
    
    let html = `
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #43a047;">
          ${alumnoNombre}
          <span style="background: #43a047; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; margin-left: 10px;">ESPECIAL</span>
        </h3>
        <p style="margin: 0; color: #666;">
          Matricula: ${inscripciones[0].alumnoMatricula} | 
          ${inscripciones.length} materia(s) inscrita(s)
        </p>
      </div>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #43a047; color: white;">
              <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Materia</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Grupo</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Profesor</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Periodo</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Accion</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    inscripciones.forEach(insc => {
      html += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 12px; border: 1px solid #ddd;">
            <strong>${insc.materiaNombre}</strong>
            ${insc.materiaCodigo ? '<br><small style="color: #666;">' + insc.materiaCodigo + '</small>' : ''}
          </td>
          <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
            ${insc.grupoNombre}
          </td>
          <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
            ${insc.profesorNombre || 'Sin asignar'}
          </td>
          <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
            ${insc.periodo}
          </td>
          <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
            <button onclick="darDeBajaInscripcionEspecial('${insc.id}', '${insc.materiaNombre}'); cerrarModal();" 
                    style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.85rem;">
              Dar de Baja
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
        <strong>Regularizar Alumno</strong>
        <p style="margin: 10px 0; font-size: 0.9rem;">
          Si este alumno ya se integro a un grupo fijo, puedes convertirlo de "especial" a "normal".
        </p>
        <button onclick="cerrarModal(); setTimeout(() => mostrarFormRegularizarAlumno('${alumnoId}', '${alumnoNombre}', '${inscripciones[0].alumnoMatricula}'), 300);" 
                style="padding: 10px 20px; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Regularizar Alumno
        </button>
      </div>
      
      <div style="margin-top: 20px; text-align: center;">
        <button onclick="cerrarModal()" 
                style="padding: 10px 24px; background: #e0e0e0; color: #333; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Cerrar
        </button>
      </div>
    `;
    
    document.getElementById('tituloModal').textContent = 'Materias Inscritas';
    document.getElementById('contenidoModal').innerHTML = html;
    document.getElementById('modalGenerico').style.display = 'block';
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar materias: ' + error.message);
  }
}

// =====================================================
// PARTE 4: REGULARIZAR ALUMNO (CONVERTIR A NORMAL)
// =====================================================

async function mostrarFormRegularizarAlumno(alumnoId, alumnoNombre, alumnoMatricula) {
  document.getElementById('tituloModal').textContent = 'Regularizar Alumno Especial';
  
  const gruposSnap = await db.collection('grupos')
    .where('carreraId', '==', usuarioActual.carreraId)
    .where('activo', '==', true)
    .get();
  
  let gruposHtml = '<option value="">Seleccionar grupo...</option>';
  
  const gruposArray = [];
  gruposSnap.forEach(doc => {
    gruposArray.push({ id: doc.id, ...doc.data() });
  });
  
  gruposArray.sort((a, b) => (a.ordenamiento || 0) - (b.ordenamiento || 0));
  
  gruposArray.forEach(grupo => {
    gruposHtml += `<option value="${grupo.id}" data-nombre="${grupo.nombre}">
      ${grupo.nombre}
    </option>`;
  });
  
  const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
    .where('alumnoId', '==', alumnoId)
    .where('activa', '==', true)
    .get();
  
  const numMaterias = inscripcionesSnap.size;
  
  const html = `
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <strong>Atencion: Conversion de Alumno Especial a Normal</strong>
      <p style="margin: 10px 0 0 0; font-size: 0.9rem;">
        Esta accion convertira al alumno especial en un alumno normal del grupo seleccionado.
      </p>
    </div>
    
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <strong>Alumno:</strong> ${alumnoNombre}<br>
      <strong>Matricula:</strong> ${alumnoMatricula}<br>
      <strong>Materias inscritas:</strong> ${numMaterias}
    </div>
    
    <form onsubmit="ejecutarRegularizacion('${alumnoId}', '${alumnoNombre}', event)">
      <div class="form-grupo">
        <label>Asignar a Grupo: *</label>
        <select id="grupoRegularizar" required>
          ${gruposHtml}
        </select>
        <small style="color: #666;">El grupo fijo al que pertenecera</small>
      </div>
      
      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
        <strong>Que sucedera:</strong>
        <ul style="margin: 10px 0 0 20px; font-size: 0.9rem;">
          <li>El alumno dejara de ser "especial"</li>
          <li>Se asignara al grupo seleccionado</li>
          <li>Se daran de baja ${numMaterias} inscripciones especiales</li>
          <li>Las calificaciones se CONSERVARAN</li>
          <li>Se movera con su grupo en cambios de periodo</li>
        </ul>
      </div>
      
      <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f44336;">
        <strong>Advertencia:</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #c62828;">
          Esta accion NO se puede deshacer.
        </p>
      </div>
      
      <div class="form-botones" style="margin-top: 20px;">
        <button type="submit" style="background: #4caf50; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Confirmar Regularizacion
        </button>
        <button type="button" onclick="cerrarModal()" class="btn-cancelar">
          Cancelar
        </button>
      </div>
    </form>
  `;
  
  document.getElementById('contenidoModal').innerHTML = html;
  document.getElementById('modalGenerico').style.display = 'block';
}

async function ejecutarRegularizacion(alumnoId, alumnoNombre, event) {
  event.preventDefault();
  
  const grupoSelect = document.getElementById('grupoRegularizar');
  const grupoId = grupoSelect.value;
  const grupoNombre = grupoSelect.options[grupoSelect.selectedIndex].dataset.nombre;
  
  if (!confirm(
    'CONFIRMAR REGULARIZACION\n\n' +
    'Alumno: ' + alumnoNombre + '\n' +
    'Nuevo Grupo: ' + grupoNombre + '\n\n' +
    'Esta accion NO se puede deshacer.\n\n' +
    'Continuar?'
  )) {
    return;
  }
  
  try {
    await db.collection('usuarios').doc(alumnoId).update({
      tipoAlumno: null,
      grupoId: grupoId,
      grupoNombre: grupoNombre,
      fechaRegularizacion: firebase.firestore.FieldValue.serverTimestamp(),
      regularizadoPor: usuarioActual.uid,
      antesTipoAlumno: 'especial'
    });
    
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('activa', '==', true)
      .get();
    
    let inscripcionesBajadas = 0;
    const batch = db.batch();
    
    inscripcionesSnap.forEach(doc => {
      batch.update(doc.ref, {
        activa: false,
        motivoBaja: 'Alumno regularizado',
        fechaBaja: firebase.firestore.FieldValue.serverTimestamp()
      });
      inscripcionesBajadas++;
    });
    
    await batch.commit();
    
    alert(
      'REGULARIZACION EXITOSA!\n\n' +
      'Alumno: ' + alumnoNombre + '\n' +
      'Grupo: ' + grupoNombre + '\n' +
      'Inscripciones archivadas: ' + inscripcionesBajadas + '\n\n' +
      'El alumno ahora se movera con su grupo.'
    );
    
    cerrarModal();
    await cargarInscripciones();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  }
}

// =====================================================
// PARTE 5: CALIFICACIONES COORDINADOR
// =====================================================

if (typeof cargarCalificacionesMateria !== 'undefined') {
  const cargarCalificacionesMateriaOriginal = cargarCalificacionesMateria;
  
  cargarCalificacionesMateria = async function() {
    try {
      const selectMat = document.getElementById('selectMateriaCalif');
      const asignacionId = selectMat.value;
      
      if (!asignacionId) {
        document.getElementById('contenedorCalificaciones').style.display = 'none';
        return;
      }
      
      const asigDoc = await db.collection('profesorMaterias').doc(asignacionId).get();
      if (!asigDoc.exists) {
        alert('Asignacion no encontrada');
        return;
      }
      
      asignacionCalifActual = { id: asignacionId, ...asigDoc.data() };
      
      console.log('Asignación cargada:', asignacionCalifActual);
      
      // Obtener nombre del turno
      const turnosNombres = {
        1: 'Matutino',
        2: 'Vespertino',
        3: 'Nocturno',
        4: 'Sabatino'
      };
      const turnoTexto = asignacionCalifActual.turnoNombre || turnosNombres[asignacionCalifActual.turno] || 'Sin turno';
      
      // ✓ CORREGIDO: Mostrar info con codigoGrupo
      document.getElementById('tituloMateriaCalif').textContent = asignacionCalifActual.materiaNombre;
      document.getElementById('infoMateriaCalif').textContent = 
        'Grupo: ' + (asignacionCalifActual.codigoGrupo || 'Sin grupo') + 
        ' | Turno: ' + turnoTexto +
        ' | Profesor: ' + asignacionCalifActual.profesorNombre + 
        ' | Periodo: ' + asignacionCalifActual.periodo;
      
      alumnosCalifMateria = [];
      
      console.log('Buscando alumnos del grupo:', asignacionCalifActual.codigoGrupo);
      
      // ✓ CORREGIDO: ALUMNOS NORMALES por codigoGrupo
      const alumnosNormales = await db.collection('usuarios')
        .where('rol', '==', 'alumno')
        .where('codigoGrupo', '==', asignacionCalifActual.codigoGrupo)
        .where('activo', '==', true)
        .get();
      
      console.log('Alumnos normales encontrados:', alumnosNormales.size);
      
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
      
      console.log('Buscando inscripciones especiales...');
      console.log('  materiaId:', asignacionCalifActual.materiaId);
      console.log('  codigoGrupo:', asignacionCalifActual.codigoGrupo);
      
      // ✓ CORREGIDO: ALUMNOS ESPECIALES por codigoGrupo
      const alumnosEspeciales = await db.collection('inscripcionesEspeciales')
        .where('materiaId', '==', asignacionCalifActual.materiaId)
        .where('codigoGrupo', '==', asignacionCalifActual.codigoGrupo)
        .where('activa', '==', true)
        .get();
      
      console.log('Inscripciones especiales encontradas:', alumnosEspeciales.size);
      
      for (const doc of alumnosEspeciales.docs) {
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
              parcial3: null
            }
          };
          
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
      
      alumnosCalifMateria.sort((a, b) => a.nombre.localeCompare(b.nombre));
      
      console.log('Total alumnos cargados:', alumnosCalifMateria.length);
      
      generarTablaCalificaciones();
      
      document.getElementById('contenedorCalificaciones').style.display = 'block';
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar calificaciones: ' + error.message);
    }
  };
}

// =====================================================
// PARTE 6: CALIFICACIONES PROFESOR
// =====================================================

if (typeof cargarAlumnosYCalificaciones !== 'undefined') {
  const cargarAlumnosYCalificacionesOriginal = cargarAlumnosYCalificaciones;
  
  cargarAlumnosYCalificaciones = async function() {
    try {
      const container = document.getElementById('tablaCalificaciones');
      container.innerHTML = '<p style="text-align: center; color: #999;">Cargando...</p>';
      
      console.log('=== Cargando alumnos (normal + especiales) ===');
      console.log('Asignación actual:', asignacionActual);
      
      // Verificar que tengamos los campos necesarios
      if (!asignacionActual.materiaId) {
        console.error('ERROR: falta materiaId');
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #dc3545;">
            <p><strong>Error de configuración</strong></p>
            <p>Esta asignación no tiene un ID de materia válido.</p>
          </div>
        `;
        return;
      }
      
      if (!asignacionActual.codigoGrupo) {
        console.error('ERROR: falta codigoGrupo');
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #dc3545;">
            <p><strong>Error de configuración</strong></p>
            <p>Esta asignación no tiene un código de grupo válido.</p>
          </div>
        `;
        return;
      }
      
      let todosLosAlumnos = [];
      
      // ========== ALUMNOS NORMALES (por codigoGrupo) ==========
      console.log('Buscando alumnos normales con codigoGrupo:', asignacionActual.codigoGrupo);
      
      const alumnosNormales = await db.collection('usuarios')
        .where('rol', '==', 'alumno')
        .where('codigoGrupo', '==', asignacionActual.codigoGrupo)  // ✓ CORREGIDO
        .where('activo', '==', true)
        .get();
      
      console.log('Alumnos normales encontrados:', alumnosNormales.size);
      
      for (const doc of alumnosNormales.docs) {
        const alumno = {
          id: doc.id,
          nombre: doc.data().nombre,
          matricula: doc.data().matricula,
          tipoInscripcion: 'normal',
          calificaciones: {
            'Parcial 1': '',
            'Parcial 2': '',
            'Parcial 3': ''
          }
        };
        
        const docId = doc.id + '_' + asignacionActual.materiaId;
        const calDoc = await db.collection('calificaciones').doc(docId).get();
        
        if (calDoc.exists) {
          const data = calDoc.data();
          alumno.calificaciones['Parcial 1'] = data.parciales?.parcial1 ?? '-';
          alumno.calificaciones['Parcial 2'] = data.parciales?.parcial2 ?? '-';
          alumno.calificaciones['Parcial 3'] = data.parciales?.parcial3 ?? '-';
        }
        
        todosLosAlumnos.push(alumno);
      }
      
      // ========== ALUMNOS ESPECIALES (por codigoGrupo) ==========
      console.log('Buscando inscripciones especiales...');
      console.log('  materiaId:', asignacionActual.materiaId);
      console.log('  codigoGrupo:', asignacionActual.codigoGrupo);
      
      const alumnosEspeciales = await db.collection('inscripcionesEspeciales')
        .where('materiaId', '==', asignacionActual.materiaId)
        .where('codigoGrupo', '==', asignacionActual.codigoGrupo)  // ✓ CORREGIDO
        .where('activa', '==', true)
        .get();
      
      console.log('Inscripciones especiales encontradas:', alumnosEspeciales.size);
      
      for (const doc of alumnosEspeciales.docs) {
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
              'Parcial 1': '',
              'Parcial 2': '',
              'Parcial 3': ''
            }
          };
          
          const docId = inscripcion.alumnoId + '_' + asignacionActual.materiaId;
          const calDoc = await db.collection('calificaciones').doc(docId).get();
          
          if (calDoc.exists) {
            const data = calDoc.data();
            alumno.calificaciones['Parcial 1'] = data.parciales?.parcial1 ?? '-';
            alumno.calificaciones['Parcial 2'] = data.parciales?.parcial2 ?? '-';
            alumno.calificaciones['Parcial 3'] = data.parciales?.parcial3 ?? '-';
          }
          
          todosLosAlumnos.push(alumno);
        }
      }
      
      todosLosAlumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      
      console.log('Total alumnos cargados:', todosLosAlumnos.length);
      
      if (todosLosAlumnos.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #999;">
            <p>No hay alumnos en este grupo.</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">
              Grupo: ${asignacionActual.codigoGrupo}<br>
              Materia: ${asignacionActual.materiaNombre}
            </p>
          </div>
        `;
        return;
      }
      
      alumnosMateria = todosLosAlumnos;
      
      const totalNormales = todosLosAlumnos.filter(a => a.tipoInscripcion === 'normal').length;
      const totalEspeciales = todosLosAlumnos.filter(a => a.tipoInscripcion === 'especial').length;
      
      let html = `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <strong>Total: ${todosLosAlumnos.length}</strong> |
          Normales: ${totalNormales} |
          Especiales: ${totalEspeciales}
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background: white; min-width: 700px;">
            <thead>
              <tr style="background: #6A2135; color: white;">
                <th style="padding: 15px; text-align: left; border: 1px solid #ddd;">Alumno</th>
                <th style="padding: 15px; text-align: center; border: 1px solid #ddd; width: 120px;">Matricula</th>
                <th style="padding: 15px; text-align: center; border: 1px solid #ddd; width: 120px;">Parcial 1</th>
                <th style="padding: 15px; text-align: center; border: 1px solid #ddd; width: 120px;">Parcial 2</th>
                <th style="padding: 15px; text-align: center; border: 1px solid #ddd; width: 120px;">Parcial 3</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      todosLosAlumnos.forEach((alumno, index) => {
        const tipoBadge = alumno.tipoInscripcion === 'especial' 
          ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">ESPECIAL</span>'
          : '';
        
        const rowStyle = alumno.tipoInscripcion === 'especial' ? 'background: #fff8e1;' : '';
        
        html += `
          <tr style="border-bottom: 1px solid #eee; ${rowStyle}">
            <td style="padding: 12px; border: 1px solid #ddd;">
              <strong>${alumno.nombre}</strong>
              ${tipoBadge}
            </td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #666;">
              ${alumno.matricula}
            </td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
              <select id="cal_${index}_p1" 
                      ${alumno.calificaciones["Parcial 1"] !== "" && alumno.calificaciones["Parcial 1"] !== "-" ? "disabled" : ""} 
                      style="width: 80px; padding: 8px; border: 2px solid #ddd; border-radius: 5px; text-align: center; font-weight: bold;">
                <option value="">-</option>
                <option value="10" ${alumno.calificaciones['Parcial 1'] == '10' ? 'selected' : ''}>10</option>
                <option value="9" ${alumno.calificaciones['Parcial 1'] == '9' ? 'selected' : ''}>9</option>
                <option value="8" ${alumno.calificaciones['Parcial 1'] == '8' ? 'selected' : ''}>8</option>
                <option value="7" ${alumno.calificaciones['Parcial 1'] == '7' ? 'selected' : ''}>7</option>
                <option value="6" ${alumno.calificaciones['Parcial 1'] == '6' ? 'selected' : ''}>6</option>
                <option value="5" ${alumno.calificaciones['Parcial 1'] == '5' ? 'selected' : ''}>5</option>
                <option value="4" ${alumno.calificaciones['Parcial 1'] == '4' ? 'selected' : ''}>4</option>
                <option value="3" ${alumno.calificaciones['Parcial 1'] == '3' ? 'selected' : ''}>3</option>
                <option value="2" ${alumno.calificaciones['Parcial 1'] == '2' ? 'selected' : ''}>2</option>
                <option value="1" ${alumno.calificaciones['Parcial 1'] == '1' ? 'selected' : ''}>1</option>
                <option value="0" ${alumno.calificaciones['Parcial 1'] == '0' ? 'selected' : ''}>0</option>
                <option value="NP" ${alumno.calificaciones['Parcial 1'] == 'NP' ? 'selected' : ''}>NP</option>
              </select>
            </td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
              <select id="cal_${index}_p2" 
                      ${alumno.calificaciones["Parcial 2"] !== "" && alumno.calificaciones["Parcial 2"] !== "-" ? "disabled" : ""} 
                      style="width: 80px; padding: 8px; border: 2px solid #ddd; border-radius: 5px; text-align: center; font-weight: bold;">
                <option value="">-</option>
                <option value="10" ${alumno.calificaciones['Parcial 2'] == '10' ? 'selected' : ''}>10</option>
                <option value="9" ${alumno.calificaciones['Parcial 2'] == '9' ? 'selected' : ''}>9</option>
                <option value="8" ${alumno.calificaciones['Parcial 2'] == '8' ? 'selected' : ''}>8</option>
                <option value="7" ${alumno.calificaciones['Parcial 2'] == '7' ? 'selected' : ''}>7</option>
                <option value="6" ${alumno.calificaciones['Parcial 2'] == '6' ? 'selected' : ''}>6</option>
                <option value="5" ${alumno.calificaciones['Parcial 2'] == '5' ? 'selected' : ''}>5</option>
                <option value="4" ${alumno.calificaciones['Parcial 2'] == '4' ? 'selected' : ''}>4</option>
                <option value="3" ${alumno.calificaciones['Parcial 2'] == '3' ? 'selected' : ''}>3</option>
                <option value="2" ${alumno.calificaciones['Parcial 2'] == '2' ? 'selected' : ''}>2</option>
                <option value="1" ${alumno.calificaciones['Parcial 2'] == '1' ? 'selected' : ''}>1</option>
                <option value="0" ${alumno.calificaciones['Parcial 2'] == '0' ? 'selected' : ''}>0</option>
                <option value="NP" ${alumno.calificaciones['Parcial 2'] == 'NP' ? 'selected' : ''}>NP</option>
              </select>
            </td>
            <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">
              <select id="cal_${index}_p3" 
                      ${alumno.calificaciones["Parcial 3"] !== "" && alumno.calificaciones["Parcial 3"] !== "-" ? "disabled" : ""} 
                      style="width: 80px; padding: 8px; border: 2px solid #ddd; border-radius: 5px; text-align: center; font-weight: bold;">
                <option value="">-</option>
                <option value="10" ${alumno.calificaciones['Parcial 3'] == '10' ? 'selected' : ''}>10</option>
                <option value="9" ${alumno.calificaciones['Parcial 3'] == '9' ? 'selected' : ''}>9</option>
                <option value="8" ${alumno.calificaciones['Parcial 3'] == '8' ? 'selected' : ''}>8</option>
                <option value="7" ${alumno.calificaciones['Parcial 3'] == '7' ? 'selected' : ''}>7</option>
                <option value="6" ${alumno.calificaciones['Parcial 3'] == '6' ? 'selected' : ''}>6</option>
                <option value="5" ${alumno.calificaciones['Parcial 3'] == '5' ? 'selected' : ''}>5</option>
                <option value="4" ${alumno.calificaciones['Parcial 3'] == '4' ? 'selected' : ''}>4</option>
                <option value="3" ${alumno.calificaciones['Parcial 3'] == '3' ? 'selected' : ''}>3</option>
                <option value="2" ${alumno.calificaciones['Parcial 3'] == '2' ? 'selected' : ''}>2</option>
                <option value="1" ${alumno.calificaciones['Parcial 3'] == '1' ? 'selected' : ''}>1</option>
                <option value="0" ${alumno.calificaciones['Parcial 3'] == '0' ? 'selected' : ''}>0</option>
                <option value="NP" ${alumno.calificaciones['Parcial 3'] == 'NP' ? 'selected' : ''}>NP</option>
              </select>
            </td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
        <div style="margin-top: 20px; text-align: right;">
          <button onclick="guardarCalificacionesProfe()" 
                  style="padding: 12px 30px; background: linear-gradient(135deg, #6A2135 0%, #6A3221 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Guardar Calificaciones
          </button>
        </div>
      `;
      
      container.innerHTML = html;
      
      console.log('Tabla de calificaciones generada correctamente');
      
    } catch (error) {
      console.error('Error al cargar alumnos y calificaciones:', error);
      alert('Error al cargar calificaciones: ' + error.message);
    }
  };
}

// =====================================================
// PARTE 7: CONSULTA DE ALUMNO ESPECIAL
// =====================================================

if (typeof cargarMateriasYCalificaciones !== 'undefined') {
  const cargarMateriasYCalificacionesOriginal = cargarMateriasYCalificaciones;
  
  cargarMateriasYCalificaciones = async function() {
    const container = document.getElementById('listaMaterias');
    
    const esAlumnoEspecial = alumnoActual.tipoAlumno === 'especial';
    
    if (esAlumnoEspecial) {
      console.log('Alumno ESPECIAL detectado');
      
      try {
        const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
          .where('alumnoId', '==', alumnoActual.id)
          .where('activa', '==', true)
          .get();
        
        if (inscripcionesSnap.empty) {
          container.innerHTML = `
            <div class="sin-datos">
              <p>Aun no tienes materias inscritas</p>
            </div>
          `;
          return;
        }
        
        const materias = [];
        
        for (const doc of inscripcionesSnap.docs) {
          const inscripcion = doc.data();
          
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
            grupo: inscripcion.grupoNombre,
            parcial1: parcial1,
            parcial2: parcial2,
            parcial3: parcial3
          });
        }
        
        materias.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        let html = `
          <div style="background: white; padding: 20px; border-radius: 10px;">
            <h3 style="color: #6A2135; margin: 0 0 20px 0; text-align: center;">Boleta de Calificaciones</h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; min-width: 700px; border-collapse: collapse;">
              <thead>
                <tr style="background: #6A2135; color: white;">
                  <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Materia</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 100px;">Grupo</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px;">Parcial 1</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px;">Parcial 2</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px;">Parcial 3</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; width: 90px;">Promedio</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        materias.forEach(materia => {
          const tieneNP = materia.parcial1 === 'NP' || materia.parcial2 === 'NP' || materia.parcial3 === 'NP';
          
          let promedio = '-';
          
          if (tieneNP) {
            promedio = '5.0';
          } else {
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
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #666; font-weight: bold;">
                ${materia.grupo}
              </td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.2rem; font-weight: bold;">
                ${materia.parcial1}
              </td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.2rem; font-weight: bold;">
                ${materia.parcial2}
              </td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd; font-size: 1.2rem; font-weight: bold;">
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
          </div>
        `;
        
        container.innerHTML = html;
        
      } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div class="sin-datos" style="color: red;">Error al cargar informacion</div>';
      }
    } else {
      // Alumno normal - usar funcion original
      return cargarMateriasYCalificacionesOriginal.call(this);
    }
  };
}

console.log('=== SISTEMA DE ALUMNOS ESPECIALES CARGADO ===');