//inscripciones especiales de alumnos sin grupos
// inscripcionEspecial.js
// Sistema completo de inscripciones especiales - VERSION CORREGIDA
// Muestra alumnos especiales aunque no tengan materias inscritas

// PASO 1: Crear alumno especial (NUEVO)
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
          Podras inscribirlo materia por materia en diferentes grupos.
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
    // Verificar si la matricula ya existe
    const matriculaExiste = await db.collection('usuarios')
      .where('matricula', '==', matricula)
      .get();
    
    if (!matriculaExiste.empty) {
      alert('Esta matricula ya esta registrada.\n\nVerifica los datos.');
      return;
    }
    
    // Verificar si el email ya existe
    const emailExiste = await db.collection('usuarios')
      .where('email', '==', email)
      .get();
    
    if (!emailExiste.empty) {
      alert('Este correo ya esta registrado.\n\nVerifica los datos.');
      return;
    }
    
    // Crear alumno especial en usuarios
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
          'Ahora puedes inscribirlo en materias especificas.');
    
    cerrarModal();
    await cargarInscripciones();
    
  } catch (error) {
    console.error('Error al crear alumno especial:', error);
    alert('Error al crear alumno: ' + error.message);
  }
}

// PASO 2: Inscribir materia por materia
async function mostrarFormInscribirAlumno() {
  document.getElementById('tituloModal').textContent = 'Inscribir Alumno a Materia';
  
  // Cargar SOLO alumnos especiales
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
  
  // Cargar materias de la carrera
  const materiasSnap = await db.collection('materias')
    .where('carreraId', '==', usuarioActual.carreraId)
    .get();
  
  let materiasHtml = '<option value="">Seleccionar materia...</option>';
  
  const materiasArray = [];
  materiasSnap.forEach(doc => {
    materiasArray.push({ id: doc.id, ...doc.data() });
  });
  
  materiasArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
  
  materiasArray.forEach(materia => {
    materiasHtml += `<option value="${materia.id}" data-nombre="${materia.nombre}" data-codigo="${materia.codigo || ''}">
      ${materia.nombre} ${materia.codigo ? '(' + materia.codigo + ')' : ''}
    </option>`;
  });
  
  // Cargar grupos activos de la carrera
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
  
  const html = `
    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
      <strong>Inscripcion por Materia</strong>
      <p style="margin: 10px 0 0 0; font-size: 0.9rem;">
        Cada alumno especial puede tomar materias de diferentes grupos.
        Esta inscripcion es para UNA materia en UN grupo especifico.
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
        <label>Materia: *</label>
        <select id="materiaInscribir" required>
          ${materiasHtml}
        </select>
      </div>
      
      <div class="form-grupo">
        <label>Grupo (donde tomara ESTA materia): *</label>
        <select id="grupoInscribir" required onchange="cargarProfesorDelGrupo()">
          ${gruposHtml}
        </select>
        <small style="color: #666;">El grupo especifico para esta materia</small>
      </div>
      
      <div id="infoProfesorGrupo" style="display: none; background: #e3f2fd; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.9rem;">
      </div>
      
      <div class="form-grupo">
        <label>Periodo: *</label>
        <input type="text" id="periodoInscribir" required 
               value="${periodoActualCarrera}"
               placeholder="Ej: 2026-1">
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

async function cargarProfesorDelGrupo() {
  const grupoId = document.getElementById('grupoInscribir').value;
  const materiaId = document.getElementById('materiaInscribir').value;
  const infoDiv = document.getElementById('infoProfesorGrupo');
  
  if (!grupoId || !materiaId) {
    infoDiv.style.display = 'none';
    return;
  }
  
  try {
    const asignacionSnap = await db.collection('profesorMaterias')
      .where('grupoId', '==', grupoId)
      .where('materiaId', '==', materiaId)
      .where('activa', '==', true)
      .limit(1)
      .get();
    
    if (!asignacionSnap.empty) {
      const asignacion = asignacionSnap.docs[0].data();
      infoDiv.innerHTML = '<strong>Profesor:</strong> ' + (asignacion.profesorNombre || 'No especificado');
      infoDiv.style.display = 'block';
    } else {
      infoDiv.innerHTML = '<strong style="color: #ff9800;">No hay profesor asignado a esta materia en este grupo</strong>';
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
  const materiaSelect = document.getElementById('materiaInscribir');
  const grupoSelect = document.getElementById('grupoInscribir');
  
  const alumnoId = alumnoSelect.value;
  const alumnoNombre = alumnoSelect.options[alumnoSelect.selectedIndex].dataset.nombre;
  const alumnoMatricula = alumnoSelect.options[alumnoSelect.selectedIndex].dataset.matricula;
  
  const materiaId = materiaSelect.value;
  const materiaNombre = materiaSelect.options[materiaSelect.selectedIndex].dataset.nombre;
  const materiaCodigo = materiaSelect.options[materiaSelect.selectedIndex].dataset.codigo;
  
  const grupoId = grupoSelect.value;
  const grupoNombre = grupoSelect.options[grupoSelect.selectedIndex].dataset.nombre;
  
  const periodo = document.getElementById('periodoInscribir').value.trim();
  
  try {
    // Verificar si ya esta inscrito en esta materia y grupo
    const existe = await db.collection('inscripcionesEspeciales')
      .where('alumnoId', '==', alumnoId)
      .where('materiaId', '==', materiaId)
      .where('grupoId', '==', grupoId)
      .where('periodo', '==', periodo)
      .where('activa', '==', true)
      .get();
    
    if (!existe.empty) {
      alert('Este alumno ya esta inscrito en esta materia y grupo.\n\nVerifica los datos.');
      return;
    }
    
    // Buscar datos del profesor si existe asignacion
    let profesorId = null;
    let profesorNombre = null;
    
    const asignacionSnap = await db.collection('profesorMaterias')
      .where('grupoId', '==', grupoId)
      .where('materiaId', '==', materiaId)
      .where('activa', '==', true)
      .limit(1)
      .get();
    
    if (!asignacionSnap.empty) {
      const asignacion = asignacionSnap.docs[0].data();
      profesorId = asignacion.profesorId;
      profesorNombre = asignacion.profesorNombre;
    }
    
    // Crear inscripcion especial
    const inscripcionData = {
      alumnoId: alumnoId,
      alumnoNombre: alumnoNombre,
      alumnoMatricula: alumnoMatricula,
      
      materiaId: materiaId,
      materiaNombre: materiaNombre,
      materiaCodigo: materiaCodigo,
      
      grupoId: grupoId,
      grupoNombre: grupoNombre,
      
      profesorId: profesorId,
      profesorNombre: profesorNombre,
      
      carreraId: usuarioActual.carreraId,
      periodo: periodo,
      
      activa: true,
      tipoInscripcion: 'especial',
      
      fechaInscripcion: firebase.firestore.FieldValue.serverTimestamp(),
      inscritoPor: usuarioActual.uid,
      inscriptorNombre: usuarioActual.nombre
    };
    
    await db.collection('inscripcionesEspeciales').add(inscripcionData);
    
    console.log('Inscripcion especial creada');
    
    alert('Inscripcion Exitosa!\n\n' +
          'Alumno: ' + alumnoNombre + '\n' +
          'Materia: ' + materiaNombre + '\n' +
          'Grupo: ' + grupoNombre + '\n' +
          'Profesor: ' + (profesorNombre || 'Sin asignar'));
    
    cerrarModal();
    await cargarInscripciones();
    
  } catch (error) {
    console.error('Error al inscribir:', error);
    alert('Error al inscribir: ' + error.message);
  }
}

// PASO 3: CARGAR INSCRIPCIONES - VERSION CORREGIDA
// Muestra TODOS los alumnos especiales, tengan o no materias inscritas
async function cargarInscripciones() {
  try {
    const container = document.getElementById('listaInscripciones');
    
    // 1. Cargar TODOS los alumnos especiales de la carrera
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
    
    // 2. Cargar inscripciones del periodo actual
    const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
      .where('carreraId', '==', usuarioActual.carreraId)
      .where('periodo', '==', periodoActualCarrera)
      .where('activa', '==', true)
      .get();
    
    // 3. Agrupar inscripciones por alumno
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
    
    // 4. Generar HTML para TODOS los alumnos
    let html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
    
    const alumnosArray = [];
    alumnosSnap.forEach(doc => {
      alumnosArray.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar alfabeticamente
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
        
        // Ordenar materias alfabeticamente
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

// Dar de baja inscripcion especial
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

// Inscribir otra materia a alumno existente
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

// Ver todas las materias de un alumno especial
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

console.log('Sistema de Inscripciones Especiales cargado - VERSION CORREGIDA');