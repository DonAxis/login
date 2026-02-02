
async function cargarPeriodosParaMasivo() {
  try {
    const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
    
    if (!carreraDoc.exists) {
      alert('No se encontró información de la carrera');
      return;
    }
    
    const numeroPeriodos = carreraDoc.data().numeroPeriodos || 8;
    const select = document.getElementById('periodoMasivo');
    
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    for (let i = 1; i <= numeroPeriodos; i++) {
      select.innerHTML += `<option value="${i}">${i}°</option>`;
    }
    
    console.log(`${numeroPeriodos} periodos cargados para registro masivo`);
    
  } catch (error) {
    console.error('Error al cargar periodos:', error);
    alert('Error al cargar periodos disponibles');
  }
}

function actualizarPreviewGrupoMasivo() {
  const periodo = document.getElementById('periodoMasivo').value;
  const turno = document.getElementById('turnoMasivo').value;
  const orden = document.getElementById('ordenMasivo').value || '01';
  
  const previewDiv = document.getElementById('previewGrupoMasivo');
  
  if (!periodo || !turno) {
    previewDiv.innerHTML = '<em style="color: #999;">Selecciona periodo, turno y orden para ver el código</em>';
    return;
  }
  
  if (!carreraActualData || !carreraActualData.codigo) {
    previewDiv.innerHTML = '<em style="color: #f44336;">Error: Carrera no cargada</em>';
    return;
  }
  
  const ordenFormateado = orden.toString().padStart(2, '0');
  const codigoGrupo = `${carreraActualData.codigo}-${turno}${periodo}${ordenFormateado}`;
  
  const turnosNombres = {
    '1': 'Matutino',
    '2': 'Vespertino',
    '3': 'Nocturno',
    '4': 'Sabatino'
  };
  
  previewDiv.innerHTML = `
    <strong style="color: #667eea; font-size: 1.3rem;">${codigoGrupo}</strong>
    <div style="font-size: 0.9rem; color: #666; margin-top: 8px;">
      ${turnosNombres[turno]} - Periodo ${periodo} - Grupo ${ordenFormateado}
    </div>
  `;
}

function previsualizarDatos() {
  const nombres = document.getElementById('nombresMasivo').value.trim().split('\n').filter(n => n.trim());
  const matriculas = document.getElementById('matriculasMasivo').value.trim().split('\n').filter(m => m.trim());
  const emails = document.getElementById('emailsMasivo').value.trim().split('\n').filter(e => e.trim());
  
  if (nombres.length !== matriculas.length || nombres.length !== emails.length) {
    alert(`Error de formato:\n\nNombres: ${nombres.length} lineas\nMatriculas: ${matriculas.length} lineas\nEmails: ${emails.length} lineas\n\nDeben tener la misma cantidad de lineas.`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('Debes ingresar al menos un alumno');
    return;
  }
  
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
  
  document.getElementById('vistaPrevia').scrollIntoView({ behavior: 'smooth' });
}

async function procesarRegistroMasivo(event) {
  event.preventDefault();
  
  const periodo = document.getElementById('periodoMasivo').value;
  const turno = document.getElementById('turnoMasivo').value;
  const orden = document.getElementById('ordenMasivo').value.trim();
  const nombres = document.getElementById('nombresMasivo').value.trim().split('\n').filter(n => n.trim());
  const matriculas = document.getElementById('matriculasMasivo').value.trim().split('\n').filter(m => m.trim());
  const emails = document.getElementById('emailsMasivo').value.trim().split('\n').filter(e => e.trim());
  
  if (!periodo || !turno) {
    alert('Debes seleccionar periodo y turno');
    return;
  }
  
  if (!orden || orden.length !== 2) {
    alert('El orden debe ser de 2 digitos (Ej: 01, 02, 03)');
    return;
  }
  
  if (nombres.length !== matriculas.length || nombres.length !== emails.length) {
    alert(`Error de formato:\n\nLas tres columnas deben tener la misma cantidad de lineas.\n\nNombres: ${nombres.length}\nMatriculas: ${matriculas.length}\nEmails: ${emails.length}`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('Debes ingresar al menos un alumno');
    return;
  }
  
  // Construir código de grupo
  const ordenFormateado = orden.toString().padStart(2, '0');
  const codigoGrupo = `${carreraActualData.codigo}-${turno}${periodo}${ordenFormateado}`;
  
  const turnosNombres = {
    '1': 'Matutino',
    '2': 'Vespertino',
    '3': 'Nocturno',
    '4': 'Sabatino'
  };
  
  console.log('DEBUG - Datos para registro masivo:');
  console.log('  Periodo:', periodo);
  console.log('  Turno:', turno, '-', turnosNombres[turno]);
  console.log('  Orden:', ordenFormateado);
  console.log('  Codigo de grupo:', codigoGrupo);
  
  if (!confirm(`Registrar ${nombres.length} alumnos?\n\nGrupo: ${codigoGrupo}\nTurno: ${turnosNombres[turno]}\nPeriodo: ${periodo}\nOrden: ${ordenFormateado}`)) {
    return;
  }
  
  document.getElementById('barraProgreso').style.display = 'block';
  const barraFill = document.getElementById('barraProgresoFill');
  const textoProgreso = document.getElementById('textoProgreso');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  console.log('Iniciando registro masivo...');
  console.log('Grupo completo:', codigoGrupo);
  console.log('Total alumnos:', nombres.length);
  
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i].trim();
    const matricula = matriculas[i].trim();
    const email = emails[i].trim().toLowerCase();
    
    const porcentaje = Math.round(((i + 1) / nombres.length) * 100);
    barraFill.style.width = porcentaje + '%';
    barraFill.textContent = porcentaje + '%';
    textoProgreso.textContent = `Guardando ${i + 1}/${nombres.length}: ${nombre}`;
    
    try {
      const alumnoData = {
        nombre: nombre,
        matricula: matricula,
        email: email,
        rol: 'alumno',
        codigoGrupo: codigoGrupo,
        periodo: parseInt(periodo),
        turno: parseInt(turno),
        orden: ordenFormateado,
        carreraId: usuarioActual.carreraId,
        activo: true,
        periodoIngreso: periodoActualCarrera,
        generacion: periodoActualCarrera,
        graduado: false,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        registroMasivo: true,
        fechaRegistroMasivo: new Date().toISOString()
      };
      
      await db.collection('usuarios').add(alumnoData);
      
      exitosos++;
      console.log(`[${i + 1}/${nombres.length}] Alumno creado: ${nombre} - Grupo: ${codigoGrupo}`);
      
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
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  let mensaje = `RESUMEN DE REGISTRO MASIVO\n\n`;
  mensaje += `Exitosos: ${exitosos}\n`;
  mensaje += `Fallidos: ${fallidos}\n`;
  mensaje += `Total procesados: ${nombres.length}\n`;
  mensaje += `Grupo: ${codigoGrupo}\n`;
  mensaje += `Turno: ${turnosNombres[turno]}\n`;
  mensaje += `Periodo: ${periodo}\n`;
  mensaje += `Orden: ${ordenFormateado}\n`;
  mensaje += `Periodo academico: ${periodoActualCarrera}\n\n`;
  
  if (erroresDetallados.length > 0) {
    mensaje += `ERRORES DETALLADOS:\n\n`;
    erroresDetallados.forEach(err => {
      mensaje += `#${err.numero} - ${err.nombre} (${err.email})\n`;
      mensaje += `   Error: ${err.error}\n\n`;
    });
  }
  
  alert(mensaje);
  
  await cargarAlumnos();
  cerrarModalMasivo();
}

function cerrarModalMasivo() {
  document.getElementById('modalRegistroMasivo').style.display = 'none';
  document.getElementById('barraProgreso').style.display = 'none';
  
  document.getElementById('nombresMasivo').value = '';
  document.getElementById('matriculasMasivo').value = '';
  document.getElementById('emailsMasivo').value = '';
  document.getElementById('periodoMasivo').value = '';
  document.getElementById('turnoMasivo').value = '';
  document.getElementById('ordenMasivo').value = '01';
  document.getElementById('vistaPrevia').style.display = 'none';
}

async function mostrarFormRegistroMasivo() {
  await cargarPeriodosParaMasivo();
  
  document.getElementById('nombresMasivo').value = '';
  document.getElementById('matriculasMasivo').value = '';
  document.getElementById('emailsMasivo').value = '';
  document.getElementById('periodoMasivo').value = '';
  document.getElementById('turnoMasivo').value = '';
  document.getElementById('ordenMasivo').value = '01';
  document.getElementById('vistaPrevia').style.display = 'none';
  document.getElementById('barraProgreso').style.display = 'none';
  
  document.getElementById('modalRegistroMasivo').style.display = 'block';
}

window.addEventListener('click', function(event) {
  const modal = document.getElementById('modalRegistroMasivo');
  if (event.target === modal) {
    cerrarModalMasivo();
  }
});
