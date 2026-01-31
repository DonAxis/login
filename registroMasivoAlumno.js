// registroMasivoAlumno.js
// Sistema de Registro Masivo de Alumnos para copiar y pegar desde Excel 

async function cargarGruposParaMasivo() {
  try {
    // Cargar matriz de grupos de la carrera
    const gruposDoc = await db.collection('grupos').doc(usuarioActual.carreraId).get();
    
    if (!gruposDoc.exists || !gruposDoc.data().grupos) {
      alert('No hay matriz de grupos para esta carrera');
      return;
    }
    
    const gruposData = gruposDoc.data();
    const select = document.getElementById('grupoMasivo');
    select.innerHTML = '<option value="">Seleccionar grupo...</option>';
    
    // Convertir objeto de grupos a array y ordenar
    const gruposArray = Object.entries(gruposData.grupos).map(([codigo, grupo]) => ({
      codigo: codigo,
      codigoCompleto: grupo.codigoCompleto,
      periodo: grupo.periodo,
      turno: grupo.turno,
      nombreTurno: grupo.nombreTurno
    }));
    
    // Ordenar por periodo y turno
    gruposArray.sort((a, b) => {
      if (a.periodo !== b.periodo) return a.periodo - b.periodo;
      return a.turno - b.turno;
    });
    
    // Agregar opciones al select
    gruposArray.forEach(grupo => {
      const label = `${grupo.codigoCompleto} - ${grupo.nombreTurno} (Periodo ${grupo.periodo})`;
      select.innerHTML += `<option value="${grupo.codigo}">${label}</option>`;
    });
    
    console.log(`${gruposArray.length} grupos cargados para registro masivo`);
    
  } catch (error) {
    console.error('Error al cargar grupos:', error);
    alert('Error al cargar grupos disponibles');
  }
}

async function procesarRegistroMasivo(event) {
  event.preventDefault();
  
  const codigoGrupo = document.getElementById('grupoMasivo').value;
  const nombres = document.getElementById('nombresMasivo').value.trim().split('\n').filter(n => n.trim());
  const matriculas = document.getElementById('matriculasMasivo').value.trim().split('\n').filter(m => m.trim());
  const emails = document.getElementById('emailsMasivo').value.trim().split('\n').filter(e => e.trim());
  
  if (!codigoGrupo) {
    alert('Debes seleccionar un grupo');
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
  
  // Obtener info del grupo desde la matriz
  let grupoInfo = null;
  try {
    const gruposDoc = await db.collection('grupos').doc(usuarioActual.carreraId).get();
    if (gruposDoc.exists && gruposDoc.data().grupos) {
      grupoInfo = gruposDoc.data().grupos[codigoGrupo];
    }
  } catch (error) {
    console.error('Error al obtener grupo:', error);
  }
  
  if (!grupoInfo) {
    alert('Error: No se encontro informacion del grupo seleccionado');
    return;
  }
  
  const codigoCompleto = grupoInfo.codigoCompleto;
  const periodo = grupoInfo.periodo;
  const turno = grupoInfo.turno;
  
  if (!confirm(`Registrar ${nombres.length} alumnos?\n\nGrupo: ${codigoCompleto}\nTurno: ${grupoInfo.nombreTurno}\nPeriodo: ${periodo}`)) {
    return;
  }
  
  document.getElementById('barraProgreso').style.display = 'block';
  const barraFill = document.getElementById('barraProgresoFill');
  const textoProgreso = document.getElementById('textoProgreso');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  console.log('Iniciando registro masivo...');
  console.log('Grupo:', codigoCompleto);
  console.log('Periodo:', periodo);
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
        codigoGrupo: codigoCompleto,
        periodo: periodo,
        turno: turno,
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
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  let mensaje = `RESUMEN DE REGISTRO MASIVO\n\n`;
  mensaje += `Exitosos: ${exitosos}\n`;
  mensaje += `Fallidos: ${fallidos}\n`;
  mensaje += `Total procesados: ${nombres.length}\n`;
  mensaje += `Grupo: ${codigoCompleto}\n`;
  mensaje += `Periodo: ${periodo}\n`;
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
  document.getElementById('grupoMasivo').value = '';
  document.getElementById('vistaPrevia').style.display = 'none';
}

async function mostrarFormRegistroMasivo() {
  await cargarGruposParaMasivo();
  
  document.getElementById('nombresMasivo').value = '';
  document.getElementById('matriculasMasivo').value = '';
  document.getElementById('emailsMasivo').value = '';
  document.getElementById('grupoMasivo').value = '';
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