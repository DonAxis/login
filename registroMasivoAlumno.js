// registroMasivoAlumno.js
// Sistema de Registro Masivo de Alumnos - MODIFICADO PARA GRUPOS BASE
// Version 2.0 - Con selector de turno

console.log('=== Registro Masivo de Alumnos v2.0 - Grupos Base ===');

// ===== MOSTRAR FORMULARIO DE REGISTRO MASIVO =====
async function mostrarFormRegistroMasivo() {
  // Cargar grupos activos
  await cargarGruposParaMasivo();
  
  // Limpiar formulario
  document.getElementById('nombresMasivo').value = '';
  document.getElementById('matriculasMasivo').value = '';
  document.getElementById('emailsMasivo').value = '';
  document.getElementById('grupoBaseMasivo').value = '';
  document.getElementById('turnoMasivo').value = '';
  document.getElementById('vistaPrevia').style.display = 'none';
  document.getElementById('barraProgreso').style.display = 'none';
  
  // Mostrar modal
  document.getElementById('modalRegistroMasivo').style.display = 'block';
}

// ===== CARGAR GRUPOS BASE PARA EL SELECTOR =====
async function cargarGruposParaMasivo() {
  try {
    const snapshot = await db.collection('grupos')
      .where('carreraId', '==', usuarioActual.carreraId)
      .where('activo', '==', true)
      .get();
    
    const select = document.getElementById('grupoBaseMasivo');
    select.innerHTML = '<option value="">Seleccionar grupo base...</option>';
    
    // Convertir a array y ordenar
    const grupos = [];
    snapshot.forEach(doc => {
      grupos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por semestre y sección
    grupos.sort((a, b) => {
      if (a.semestre !== b.semestre) return a.semestre - b.semestre;
      return (a.seccion || 1) - (b.seccion || 1);
    });
    
    // Agregar opciones al select
    grupos.forEach(grupo => {
      const semestreNombres = ['', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 
                               'Sexto', 'Séptimo', 'Octavo', 'Noveno'];
      const semestreNombre = semestreNombres[grupo.semestre] || `Semestre ${grupo.semestre}`;
      const nombreDisplay = `${semestreNombre} - Sección ${grupo.seccion || 1}`;
      
      select.innerHTML += `<option value="${grupo.id}">${nombreDisplay}</option>`;
    });
    
    console.log(`${grupos.length} grupos base cargados para registro masivo`);
    
  } catch (error) {
    console.error('Error al cargar grupos:', error);
    alert('Error al cargar grupos disponibles');
  }
}

// ===== PREVISUALIZAR DATOS ANTES DE GUARDAR =====
function previsualizarDatos() {
  const nombres = document.getElementById('nombresMasivo').value.trim().split('\n').filter(n => n.trim());
  const matriculas = document.getElementById('matriculasMasivo').value.trim().split('\n').filter(m => m.trim());
  const emails = document.getElementById('emailsMasivo').value.trim().split('\n').filter(e => e.trim());
  const grupoBaseId = document.getElementById('grupoBaseMasivo').value;
  const turno = document.getElementById('turnoMasivo').value;
  
  // Validar grupo y turno
  if (!grupoBaseId) {
    alert('Debes seleccionar un grupo base');
    return;
  }
  
  if (!turno) {
    alert('Debes seleccionar un turno');
    return;
  }
  
  // Validar que todos tengan la misma cantidad
  if (nombres.length !== matriculas.length || nombres.length !== emails.length) {
    alert(`Error de formato:\n\n` +
          `Nombres: ${nombres.length} lineas\n` +
          `Matriculas: ${matriculas.length} lineas\n` +
          `Emails: ${emails.length} lineas\n\n` +
          `Deben tener la misma cantidad de lineas.`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('Debes ingresar al menos un alumno');
    return;
  }
  
  // Obtener nombre del grupo y turno
  const grupoSelect = document.getElementById('grupoBaseMasivo');
  const grupoNombre = grupoSelect.options[grupoSelect.selectedIndex].text;
  
  // Construir vista previa
  let html = `
    <div class="mensaje-exito-masivo">
      Se encontraron ${nombres.length} alumnos validos
    </div>
    
    <div style="background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #4caf50;">
      <strong>Grupo Base:</strong> ${grupoNombre}<br>
      <strong>Turno:</strong> ${GrupoHelpers.generarBadgeTurno(turno)}
    </div>
    
    <table class="tabla-preview">
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre Completo</th>
          <th>Matricula</th>
          <th>Email</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  let errores = 0;
  
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i].trim();
    const matricula = matriculas[i].trim();
    const email = emails[i].trim();
    
    // Validaciones simples
    let esValido = true;
    let erroresRow = [];
    
    if (nombre.length < 3) {
      esValido = false;
      erroresRow.push('Nombre muy corto');
    }
    
    if (!matricula || matricula.length < 3) {
      esValido = false;
      erroresRow.push('Matricula invalida');
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      esValido = false;
      erroresRow.push('Email invalido');
    }
    
    const rowClass = esValido ? '' : 'error-row';
    const estado = esValido ? 'Valido' : `Error: ${erroresRow.join(', ')}`;
    
    if (!esValido) errores++;
    
    html += `
      <tr class="${rowClass}">
        <td><strong>${i + 1}</strong></td>
        <td>${nombre}</td>
        <td>${matricula}</td>
        <td>${email}</td>
        <td>${estado}</td>
      </tr>
    `;
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  if (errores > 0) {
    html = `<div class="mensaje-error-masivo">Se encontraron ${errores} registros con errores</div>` + html;
  }
  
  document.getElementById('contenidoVistaPrevia').innerHTML = html;
  document.getElementById('vistaPrevia').style.display = 'block';
  
  // Scroll a la vista previa
  document.getElementById('vistaPrevia').scrollIntoView({ behavior: 'smooth' });
}

// ===== PROCESAR Y GUARDAR REGISTRO MASIVO =====
async function procesarRegistroMasivo(event) {
  event.preventDefault();
  
  const grupoBaseId = document.getElementById('grupoBaseMasivo').value;
  const turno = document.getElementById('turnoMasivo').value;
  const nombres = document.getElementById('nombresMasivo').value.trim().split('\n').filter(n => n.trim());
  const matriculas = document.getElementById('matriculasMasivo').value.trim().split('\n').filter(m => m.trim());
  const emails = document.getElementById('emailsMasivo').value.trim().split('\n').filter(e => e.trim());
  
  // Validaciones
  if (!grupoBaseId) {
    alert('Debes seleccionar un grupo base');
    return;
  }
  
  if (!turno) {
    alert('Debes seleccionar un turno');
    return;
  }
  
  if (nombres.length !== matriculas.length || nombres.length !== emails.length) {
    alert(`Error de formato:\n\n` +
          `Las tres columnas deben tener la misma cantidad de lineas.\n\n` +
          `Nombres: ${nombres.length}\n` +
          `Matriculas: ${matriculas.length}\n` +
          `Emails: ${emails.length}`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('Debes ingresar al menos un alumno');
    return;
  }
  
  // Obtener datos del grupo base
  let grupoData = null;
  try {
    const grupoDoc = await db.collection('grupos').doc(grupoBaseId).get();
    if (grupoDoc.exists) {
      grupoData = grupoDoc.data();
    } else {
      alert('Grupo base no encontrado');
      return;
    }
  } catch (error) {
    console.error('Error al obtener grupo:', error);
    alert('Error al cargar datos del grupo');
    return;
  }
  
  const semestreActual = grupoData.semestre || 1;
  const seccionActual = grupoData.seccion || 1;
  
  // Confirmar
  if (!confirm(`Registrar ${nombres.length} alumnos en Firestore?\n\n` +
               `Grupo: Semestre ${semestreActual} - Sección ${seccionActual}\n` +
               `Turno: ${turno}\n\n` +
               `Los alumnos se guardarán con grupoBase + turno.`)) {
    return;
  }
  
  // Mostrar barra de progreso
  document.getElementById('barraProgreso').style.display = 'block';
  const barraFill = document.getElementById('barraProgresoFill');
  const textoProgreso = document.getElementById('textoProgreso');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  console.log('Iniciando registro masivo...');
  console.log('Grupo Base:', grupoBaseId);
  console.log('Turno:', turno);
  console.log('Semestre:', semestreActual);
  console.log('Sección:', seccionActual);
  console.log('Total alumnos:', nombres.length);
  
  // Procesar cada alumno
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i].trim();
    const matricula = matriculas[i].trim();
    const email = emails[i].trim().toLowerCase();
    
    // Actualizar progreso
    const porcentaje = Math.round(((i + 1) / nombres.length) * 100);
    barraFill.style.width = porcentaje + '%';
    barraFill.textContent = porcentaje + '%';
    textoProgreso.textContent = `Guardando ${i + 1}/${nombres.length}: ${nombre}`;
    
    try {
      // Crear documento en Firestore con NUEVO SISTEMA
      const alumnoData = {
        nombre: nombre,
        matricula: matricula,
        email: email,
        rol: 'alumno',
        grupoBase: grupoBaseId,        // NUEVO
        turno: turno,                   // NUEVO
        semestre: semestreActual,       // NUEVO (denormalizado)
        seccion: seccionActual,         // NUEVO (denormalizado)
        carreraId: usuarioActual.carreraId,
        activo: true,
        periodo: periodoActualCarrera,
        generacion: periodoActualCarrera,
        graduado: false,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        registroMasivo: true,
        fechaRegistroMasivo: new Date().toISOString()
      };
      
      // Guardar en Firestore
      await db.collection('usuarios').add(alumnoData);
      
      exitosos++;
      console.log(`[${i + 1}/${nombres.length}] Alumno creado: ${nombre}`);
      
    } catch (error) {
      fallidos++;
      erroresDetallados.push({
        numero: i + 1,
        nombre: nombre,
        matricula: matricula,
        email: email,
        error: error.message
      });
      console.error(`[${i + 1}/${nombres.length}] ERROR:`, error);
    }
    
    // Pausa breve para no saturar Firestore
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Mostrar resumen final
  let mensaje = `RESUMEN DE REGISTRO MASIVO\n\n`;
  mensaje += `Exitosos: ${exitosos}\n`;
  mensaje += `Fallidos: ${fallidos}\n`;
  mensaje += `Total procesados: ${nombres.length}\n`;
  mensaje += `Grupo Base: Semestre ${semestreActual} - Sección ${seccionActual}\n`;
  mensaje += `Turno: ${turno}\n`;
  mensaje += `Periodo: ${periodoActualCarrera}\n\n`;
  
  if (erroresDetallados.length > 0) {
    mensaje += `ERRORES DETALLADOS:\n\n`;
    erroresDetallados.forEach(err => {
      mensaje += `#${err.numero} - ${err.nombre} (${err.email})\n`;
      mensaje += `   Error: ${err.error}\n\n`;
    });
  }
  
  alert(mensaje);
  
  // Recargar lista de alumnos
  if (typeof cargarAlumnos === 'function') {
    await cargarAlumnos();
  }
  
  // Cerrar modal
  cerrarModalMasivo();
}

// ===== CERRAR MODAL =====
function cerrarModalMasivo() {
  document.getElementById('modalRegistroMasivo').style.display = 'none';
  document.getElementById('barraProgreso').style.display = 'none';
  
  // Limpiar campos
  document.getElementById('nombresMasivo').value = '';
  document.getElementById('matriculasMasivo').value = '';
  document.getElementById('emailsMasivo').value = '';
  document.getElementById('grupoBaseMasivo').value = '';
  document.getElementById('turnoMasivo').value = '';
  document.getElementById('vistaPrevia').style.display = 'none';
}

// ===== CERRAR MODAL AL HACER CLIC FUERA =====
window.addEventListener('click', function(event) {
  const modal = document.getElementById('modalRegistroMasivo');
  if (event.target === modal) {
    cerrarModalMasivo();
  }
});

console.log('Sistema de Registro Masivo v2.0 cargado - Grupos Base con Turnos');