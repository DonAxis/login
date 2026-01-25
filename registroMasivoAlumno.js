// registroMasivoAlumno.js
// Sistema de Registro Masivo de Alumnos desde Excel - SOLO FIRESTORE

// ===== MOSTRAR FORMULARIO DE REGISTRO MASIVO =====
async function mostrarFormRegistroMasivo() {
  // Cargar grupos activos
  await cargarGruposParaMasivo();
  
  // Limpiar formulario
  document.getElementById('nombresMasivo').value = '';
  document.getElementById('matriculasMasivo').value = '';
  document.getElementById('emailsMasivo').value = '';
  document.getElementById('grupoMasivo').value = '';
  document.getElementById('vistaPrevia').style.display = 'none';
  document.getElementById('barraProgreso').style.display = 'none';
  
  // Mostrar modal
  document.getElementById('modalRegistroMasivo').style.display = 'block';
}

// ===== CARGAR GRUPOS PARA EL SELECTOR =====
async function cargarGruposParaMasivo() {
  try {
    const snapshot = await db.collection('grupos')
      .where('carreraId', '==', usuarioActual.carreraId)
      .where('activo', '==', true)
      .get();
    
    const select = document.getElementById('grupoMasivo');
    select.innerHTML = '<option value="">Seleccionar grupo...</option>';
    
    // Convertir a array y ordenar manualmente
    const grupos = [];
    snapshot.forEach(doc => {
      grupos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por nombre
    grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Agregar opciones al select
    grupos.forEach(grupo => {
      select.innerHTML += `<option value="${grupo.id}">${grupo.nombre}</option>`;
    });
    
    console.log(`${grupos.length} grupos cargados para registro masivo`);
    
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
  
  // Construir vista previa
  let html = `
    <div class="mensaje-exito-masivo">
      Se encontraron ${nombres.length} alumnos validos
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
  
  const grupoId = document.getElementById('grupoMasivo').value;
  const nombres = document.getElementById('nombresMasivo').value.trim().split('\n').filter(n => n.trim());
  const matriculas = document.getElementById('matriculasMasivo').value.trim().split('\n').filter(m => m.trim());
  const emails = document.getElementById('emailsMasivo').value.trim().split('\n').filter(e => e.trim());
  
  // Validaciones
  if (!grupoId) {
    alert('Debes seleccionar un grupo');
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
  
  // Confirmar
  if (!confirm(`Registrar ${nombres.length} alumnos en Firestore?\n\nTodos seran asignados al grupo seleccionado.`)) {
    return;
  }
  
  // Mostrar barra de progreso
  document.getElementById('barraProgreso').style.display = 'block';
  const barraFill = document.getElementById('barraProgresoFill');
  const textoProgreso = document.getElementById('textoProgreso');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  // Obtener datos del grupo para extraer semestre
  let grupoNombre = '';
  let semestreActual = 1;
  
  try {
    const grupoDoc = await db.collection('grupos').doc(grupoId).get();
    if (grupoDoc.exists) {
      grupoNombre = grupoDoc.data().nombre;
      // Extraer semestre del nombre del grupo (formato: TSGG-SIGLA, donde S es el semestre)
      if (grupoNombre && grupoNombre.length >= 4) {
        const semestreChar = grupoNombre.charAt(1);
        semestreActual = parseInt(semestreChar) || 1;
      }
    }
  } catch (error) {
    console.error('Error al obtener grupo:', error);
  }
  
  console.log('Iniciando registro masivo...');
  console.log('Grupo:', grupoNombre);
  console.log('Semestre extraido:', semestreActual);
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
      // Crear documento en Firestore - IGUAL que el registro individual
      const alumnoData = {
        nombre: nombre,
        matricula: matricula,
        email: email,
        rol: 'alumno',
        grupoId: grupoId,
        carreraId: usuarioActual.carreraId,
        activo: true,
        periodo: periodoActualCarrera,
        semestreActual: semestreActual,
        generacion: periodoActualCarrera,
        graduado: false,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        registroMasivo: true,
        fechaRegistroMasivo: new Date().toISOString()
      };
      
      // Guardar en Firestore con ID autogenerado
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
  mensaje += `Grupo: ${grupoNombre}\n`;
  mensaje += `Semestre asignado: ${semestreActual}\n`;
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
  await cargarAlumnos();
  
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
  document.getElementById('grupoMasivo').value = '';
  document.getElementById('vistaPrevia').style.display = 'none';
}

// ===== CERRAR MODAL AL HACER CLIC FUERA =====
window.addEventListener('click', function(event) {
  const modal = document.getElementById('modalRegistroMasivo');
  if (event.target === modal) {
    cerrarModalMasivo();
  }
});

console.log('Sistema de Registro Masivo cargado - Solo Firestore');