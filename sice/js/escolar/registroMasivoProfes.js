// REGISTRO MASIVO DE PROFESORES


console.log('=== REGISTRO DE PROFESORES===');

async function mostrarModalProfesoresMasivos() {
  const html = `
    <div id="modalProfesoresMasivos" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; overflow-y: auto;">
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea;">
          <h2 style="margin: 0; color: #667eea; font-size: 1.8rem;">Registro de Profesores</h2>
          <button onclick="cerrarModalProfesoresMasivos()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <form id="formProfesoresMasivos" onsubmit="guardarProfesoresMasivos(event)">

          <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #1565c0; font-size: 1rem;">Instrucciones:</h3>
          <p style="margin: 0; color: #1565c0; line-height: 1.8; font-size: 0.9rem;">
            Pega los datos, un renglón por profesor:<br>
            Nombre completo: <strong>Apellido paterno, apellido materno y nombres </strong> | Correo electrónico <strong>institucional</strong><br>
           
          </p>

          <h3 style="margin: 15px 0 10px 0; color: #1565c0; font-size: 1rem;">Ejemplo de datos:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; background: white;">
            <thead style="background: #f5f5f5;">
              <tr>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Nombre Completo</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Email</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">Juan Perez Garcia</td>
                <td style="padding: 8px; border: 1px solid #ddd;">juan.perez@ilb.edu.com</td>
              </tr>
              <tr style="background: #f9f9f9;">
                <td style="padding: 8px; border: 1px solid #ddd;">Maria Lopez Hernandez</td>
                <td style="padding: 8px; border: 1px solid #ddd;">maria.lopez@ilb.edu.com</td>
              </tr>
            </tbody>
          </table>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px; margin-top: 15px;">
            <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 1rem;">Importante:</h3>
            <p style="margin: 0; color: #856404; line-height: 1.6; font-size: 0.9rem;">
              La contraseña generada será <strong>ilb123</strong>.<br>
              Por seguridad, los profesores deberán cambiarla al iniciar sesión por primera vez. 
            </p>
          </div>


          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Nombres Completos *
              </label>
              <textarea id="nombresProfesoresMasivo" required rows="12" 
                        placeholder="Juan Perez Garcia&#10;Maria Lopez Hernandez&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Un nombre por linea</small>
            </div>

            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Correos Electronicos *
              </label>
              <textarea id="emailsProfesoresMasivo" required rows="12" 
                        placeholder="juan.perez@ilb.edu.mx&#10;maria.lopez@ilb.edu.mx&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Un email por linea</small>
            </div>

          </div>

          <div id="vistaPreviaProfesores" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; max-height: 400px; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #333; display: inline;">Vista Previa:</h3> 
            <span style="color: #666;">Revisa que este correcto</span>
            <div id="contenidoVistaPreviaProfesores"></div>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" onclick="previsualizarProfesores()" 
                    style="padding: 12px 24px; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Vista Previa
            </button>
            <button type="submit" 
                    style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Crear Todos
            </button>
            <button type="button" onclick="cerrarModalProfesoresMasivos()" 
                    style="padding: 12px 24px; background: #e0e0e0; color: #333; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Cancelar
            </button>
          </div>

        </form>

        <!-- BARRA DE PROGRESO MEJORADA -->
        <div id="barraProgresoProfesores" style="display: none; margin-top: 20px;">
          
          <!-- Barra principal -->
          <div style="background: #e0e0e0; border-radius: 10px; height: 40px; overflow: hidden; position: relative; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
            <div id="barraProgresoProfesoresFill" 
                 style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1rem; box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);">
              0%
            </div>
          </div>
          
          <!-- Texto de estado principal -->
          <div id="textoProgresoProfesores" style="text-align: center; margin-top: 15px; color: #333; font-size: 1rem; font-weight: 600;">
            Preparando registro...
          </div>
          
          <!-- Estadísticas en tiempo real -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            
            <div style="text-align: center;">
              <div style="font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">
                Procesados
              </div>
              <div id="contadorProcesados" style="font-size: 1.8rem; font-weight: 700; color: #667eea;">
                0
              </div>
            </div>
            
            <div style="text-align: center;">
              <div style="font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">
                Exitosos
              </div>
              <div id="contadorExitosos" style="font-size: 1.8rem; font-weight: 700; color: #4caf50;">
                0
              </div>
            </div>
            
            <div style="text-align: center;">
              <div style="font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">
                Fallidos
              </div>
              <div id="contadorFallidos" style="font-size: 1.8rem; font-weight: 700; color: #f44336;">
                0
              </div>
            </div>
            
          </div>
          
          <!-- Estado actual detallado -->
          <div id="estadoActual" style="margin-top: 15px; padding: 12px; background: white; border-left: 4px solid #667eea; border-radius: 4px; font-size: 0.9rem; color: #666; min-height: 40px;">
            Iniciando proceso...
          </div>
          
        </div>

      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('modalProfesoresMasivos');
  if (existingModal) {
    existingModal.remove();
  }
  document.body.insertAdjacentHTML('beforeend', html);
}

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function previsualizarProfesores() {
  const nombresText = document.getElementById('nombresProfesoresMasivo').value.trim();
  const emailsText = document.getElementById('emailsProfesoresMasivo').value.trim();
  
  if (!nombresText || !emailsText) {
    alert('Debes completar ambas columnas (Nombres y Emails)');
    return;
  }
  
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const emails = emailsText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
  
  if (nombres.length !== emails.length) {
    alert(`Error de formato:\n\nNombres: ${nombres.length} lineas\nEmails: ${emails.length} lineas\n\nDeben tener la misma cantidad de lineas.`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('No hay datos para previsualizar');
    return;
  }
  
  let html = `
    <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
      <strong style="color: #0c5460;">Contraseña temporal para todos:</strong>
      <div style="margin-top: 8px; font-family: monospace; font-size: 1.1rem; color: #0c5460; font-weight: 700;">
        ilb123
      </div>
    </div>
  `;
  
  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">';
  html += '<thead style="background: #667eea; color: white;">';
  html += '<tr>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">#</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Nombre Completo</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Email</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Validacion</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';
  
  let emailsValidos = 0;
  let emailsInvalidos = 0;
  
  nombres.forEach((nombre, i) => {
    const bgColor = i % 2 === 0 ? '#fff' : '#f9f9f9';
    const email = emails[i];
    const esValido = validarEmail(email);
    
    if (esValido) emailsValidos++;
    else emailsInvalidos++;
    
    html += `<tr style="background: ${bgColor};">`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i + 1}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd;">${nombre}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${email}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">`;
    html += esValido 
      ? '<span style="color: #4caf50; font-weight: 600;">Válido</span>'
      : '<span style="color: #f44336; font-weight: 600;">Inválido</span>';
    html += `</td>`;
    html += '</tr>';
  });
  
  html += '</tbody>';
  html += '</table>';
  
  html += `
    <div style="margin-top: 15px; padding: 15px; background: ${emailsInvalidos > 0 ? '#ffebee' : '#e8f5e9'}; border-radius: 8px;">
      <strong>Resumen:</strong><br>
      Total: ${nombres.length} profesores<br>
      Emails válidos: <span style="color: #4caf50; font-weight: 600;">${emailsValidos}</span><br>
      ${emailsInvalidos > 0 ? `<span style="color: #f44336;">Emails inválidos: ${emailsInvalidos} (corrige antes de continuar)</span>` : ''}
    </div>
  `;
  
  document.getElementById('contenidoVistaPreviaProfesores').innerHTML = html;
  document.getElementById('vistaPreviaProfesores').style.display = 'block';
}

// Función auxiliar para actualizar contadores visuales
function actualizarContadores(procesados, exitosos, fallidos) {
  document.getElementById('contadorProcesados').textContent = procesados;
  document.getElementById('contadorExitosos').textContent = exitosos;
  document.getElementById('contadorFallidos').textContent = fallidos;
}

// Función auxiliar para actualizar estado actual
function actualizarEstado(mensaje, tipo = 'info') {
  const estadoDiv = document.getElementById('estadoActual');
  const colores = {
    'info': '#667eea',
    'success': '#4caf50',
    'warning': '#ff9800',
    'error': '#f44336'
  };
  
  estadoDiv.style.borderLeftColor = colores[tipo] || colores.info;
  estadoDiv.innerHTML = mensaje;
}

async function guardarProfesoresMasivos(event) {
  event.preventDefault();
  
  const nombresText = document.getElementById('nombresProfesoresMasivo').value.trim();
  const emailsText = document.getElementById('emailsProfesoresMasivo').value.trim();
  
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const emails = emailsText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
  
  if (nombres.length !== emails.length) {
    alert('La cantidad de nombres y emails no coincide');
    return;
  }
  
  // Validar emails
  for (let i = 0; i < emails.length; i++) {
    if (!validarEmail(emails[i])) {
      alert(`Email inválido en línea ${i + 1}: ${emails[i]}`);
      return;
    }
  }
  
  const tiempoEstimado = Math.ceil(nombres.length * 2.5 / 60);
  const confirmar = confirm(
    `Crear ${nombres.length} profesores?\n\n` +
    `Contraseña temporal: ilb123\n` +
    `Tiempo estimado: ${tiempoEstimado} minuto${tiempoEstimado !== 1 ? 's' : ''}\n\n` +
    `Continuar?`
  );
  
  if (!confirmar) return;
  
  const passwordTemporal = 'ilb123';
  
  document.getElementById('formProfesoresMasivos').style.display = 'none';
  document.getElementById('barraProgresoProfesores').style.display = 'block';
  
  const barra = document.getElementById('barraProgresoProfesoresFill');
  const texto = document.getElementById('textoProgresoProfesores');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  console.log('=== INICIANDO REGISTRO MASIVO DE PROFESORES ===');
  console.log(`Total profesores: ${nombres.length}`);
  console.log(`Tiempo estimado: ${tiempoEstimado} minutos`);
  
  // PROCESAR CADA PROFESOR CON REINTENTOS
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i];
    const email = emails[i];
    
    const porcentaje = Math.round(((i + 1) / nombres.length) * 100);
    barra.style.width = porcentaje + '%';
    barra.textContent = porcentaje + '%';
    texto.textContent = `Procesando: ${i + 1} de ${nombres.length}`;
    
    actualizarContadores(i + 1, exitosos, fallidos);
    actualizarEstado(`Creando profesor: <strong>${nombre}</strong>`, 'info');
    
    // IMPLEMENTAR REINTENTOS
    let intentos = 0;
    const maxIntentos = 3;
    let exitoCreacion = false;
    let secondaryApp = null;
    let secondaryAuth = null;
    
    while (intentos < maxIntentos && !exitoCreacion) {
      try {
        intentos++;
        
        if (intentos > 1) {
          console.log(`[${i + 1}] Reintentando ${email} (intento ${intentos}/${maxIntentos})...`);
          actualizarEstado(
            `Reintentando profesor: <strong>${nombre}</strong><br>` +
            `<small>Intento ${intentos} de ${maxIntentos}</small>`,
            'warning'
          );
        }
        
        // USAR INSTANCIA SECUNDARIA CON NOMBRE ÚNICO
        secondaryApp = firebase.initializeApp(
          firebaseConfig, 
          'SecondaryProfesor_' + Date.now() + '_' + i + '_' + intentos
        );
        secondaryAuth = secondaryApp.auth();
        
        // Crear en Authentication con instancia secundaria
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, passwordTemporal);
        const newUid = userCredential.user.uid;
        
        console.log(`[${i + 1}] Profesor creado en Authentication: ${email} (${newUid})`);
        
        // Guardar en Firestore
        const profesorData = {
          nombre: nombre,
          email: email,
          rol: 'profesor',
          roles: ['profesor'],
          carreras: [usuarioActual.carreraId],
          carreraId: usuarioActual.carreraId,
          activo: true,
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
          registroMasivo: true,
          passwordTemporal: true,
          fechaRegistroMasivo: new Date().toISOString()
        };
        
        await db.collection('usuarios').doc(newUid).set(profesorData);
        console.log(`[${i + 1}] Profesor guardado en Firestore: ${email}`);
        
        // Cerrar sesión de la instancia secundaria
        await secondaryAuth.signOut();
        
        // Eliminar la app secundaria
        await secondaryApp.delete();
        
        exitosos++;
        exitoCreacion = true;
        
        actualizarEstado(
          `Profesor creado exitosamente: <strong>${nombre}</strong>`,
          'success'
        );
        
      } catch (authError) {
        // Limpiar instancia secundaria en caso de error
        try {
          if (secondaryAuth) await secondaryAuth.signOut();
          if (secondaryApp) await secondaryApp.delete();
        } catch (cleanupError) {
          console.warn(`[${i + 1}] Error al limpiar instancia secundaria:`, cleanupError);
        }
        
        // Si es error de red y aún quedan intentos, esperar y reintentar
        if (authError.code === 'auth/network-request-failed' && intentos < maxIntentos) {
          const esperaMilisegundos = 3000 * intentos;
          console.log(`[${i + 1}] Error de red, esperando ${esperaMilisegundos/1000}s antes de reintentar...`);
          
          actualizarEstado(
            `Error de red detectado. Esperando ${esperaMilisegundos/1000} segundos...<br>` +
            `<small>Reintentando automáticamente...</small>`,
            'warning'
          );
          
          await new Promise(resolve => setTimeout(resolve, esperaMilisegundos));
          continue;
        }
        
        // Si es email duplicado, intentar agregar a carrera
        if (authError.code === 'auth/email-already-in-use') {
          try {
            const existeSnap = await db.collection('usuarios')
              .where('email', '==', email)
              .where('rol', '==', 'profesor')
              .limit(1)
              .get();
            
            if (!existeSnap.empty) {
              const profesorDoc = existeSnap.docs[0];
              const profesorData = profesorDoc.data();
              const carrerasActuales = profesorData.carreras || [];
              
              if (!carrerasActuales.includes(usuarioActual.carreraId)) {
                await db.collection('usuarios').doc(profesorDoc.id).update({
                  carreras: [...carrerasActuales, usuarioActual.carreraId]
                });
                console.log(`[${i + 1}] Profesor existente agregado a carrera: ${email}`);
                exitosos++;
                exitoCreacion = true;
                
                actualizarEstado(
                  `Profesor existente agregado a la carrera: <strong>${nombre}</strong>`,
                  'success'
                );
              } else {
                erroresDetallados.push({
                  numero: i + 1,
                  nombre: nombre,
                  email: email,
                  error: 'Profesor ya existe en esta carrera',
                  codigo: 'ya-existe'
                });
                fallidos++;
                exitoCreacion = true;
                
                actualizarEstado(
                  `Profesor ya existe en esta carrera: <strong>${nombre}</strong>`,
                  'error'
                );
              }
            } else {
              erroresDetallados.push({
                numero: i + 1,
                nombre: nombre,
                email: email,
                error: 'Email ya registrado (no como profesor)',
                codigo: authError.code
              });
              fallidos++;
              exitoCreacion = true;
              
              actualizarEstado(
                `Email ya registrado (no como profesor): <strong>${email}</strong>`,
                'error'
              );
            }
          } catch (firestoreError) {
            console.error(`[${i + 1}] Error al verificar profesor existente:`, firestoreError);
            erroresDetallados.push({
              numero: i + 1,
              nombre: nombre,
              email: email,
              error: firestoreError.message,
              codigo: firestoreError.code
            });
            fallidos++;
            exitoCreacion = true;
            
            actualizarEstado(
              `Error al procesar: <strong>${nombre}</strong><br>` +
              `<small>${firestoreError.message}</small>`,
              'error'
            );
          }
        } 
        // Si agotamos los intentos o es otro tipo de error
        else if (intentos >= maxIntentos || authError.code !== 'auth/network-request-failed') {
          fallidos++;
          erroresDetallados.push({
            numero: i + 1,
            nombre: nombre,
            email: email,
            error: authError.message,
            codigo: authError.code,
            intentos: intentos
          });
          console.error(`[${i + 1}] ERROR al crear ${email}:`, authError);
          exitoCreacion = true;
          
          actualizarEstado(
            `Error al crear profesor: <strong>${nombre}</strong><br>` +
            `<small>${authError.message}</small>`,
            'error'
          );
        }
      }
    }
    
    // PAUSA ENTRE PROFESORES PARA EVITAR RATE LIMITING
    const pausa = intentos > 1 ? 3000 : 2000;
    await new Promise(resolve => setTimeout(resolve, pausa));
  }
  
  console.log('=== PROCESO COMPLETADO ===');
  console.log(`Exitosos: ${exitosos} | Fallidos: ${fallidos}`);
  
  // ACTUALIZAR VISTA FINAL
  barra.style.background = fallidos === 0 
    ? 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)'
    : 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)';
  
  barra.style.boxShadow = fallidos === 0
    ? '0 0 10px rgba(76, 175, 80, 0.5)'
    : '0 0 10px rgba(255, 152, 0, 0.5)';
  
  texto.innerHTML = `<strong>Proceso completado</strong>`;
  
  actualizarContadores(nombres.length, exitosos, fallidos);
  
  if (fallidos === 0) {
    actualizarEstado(
      `<strong>Todos los profesores fueron registrados exitosamente</strong>`,
      'success'
    );
  } else {
    actualizarEstado(
      `<strong>Proceso completado con algunos errores</strong><br>` +
      `<small>Revisa el resumen para ver los detalles</small>`,
      'warning'
    );
  }
  
  // CREAR MENSAJE DE RESUMEN
  let mensaje = `====================================\n`;
  mensaje += `REGISTRO MASIVO DE PROFESORES\n`;
  mensaje += `====================================\n\n`;
  mensaje += `Exitosos: ${exitosos}\n`;
  mensaje += `Fallidos: ${fallidos}\n`;
  mensaje += `Total procesados: ${nombres.length}\n\n`;
  mensaje += `Contraseña temporal: ${passwordTemporal}\n`;
  mensaje += `IMPORTANTE: Los profesores deben cambiar su contraseña en el primer login.\n`;
  
  if (erroresDetallados.length > 0) {
    mensaje += `\n${'='.repeat(50)}\n`;
    mensaje += `ERRORES DETALLADOS:\n`;
    mensaje += `${'='.repeat(50)}\n\n`;
    
    erroresDetallados.forEach(err => {
      mensaje += `#${err.numero} - ${err.nombre}\n`;
      mensaje += `   Email: ${err.email}\n`;
      
      if (err.codigo === 'auth/email-already-in-use') {
        mensaje += `   El email ya está registrado en Firebase\n`;
      } else if (err.codigo === 'ya-existe') {
        mensaje += `   ${err.error}\n`;
      } else if (err.codigo === 'auth/network-request-failed') {
        mensaje += `   Error de red después de ${err.intentos || 3} intentos\n`;
        mensaje += `   Consejo: Verifica tu conexión a internet\n`;
      } else {
        mensaje += `   ${err.error}\n`;
      }
      mensaje += `\n`;
    });
  }
  
  setTimeout(() => {
    alert(mensaje);
    cerrarModalProfesoresMasivos();
    
    // Recargar lista de profesores si la función existe
    if (typeof cargarProfesores === 'function') {
      cargarProfesores();
    }
  }, 2000);
}

function cerrarModalProfesoresMasivos() {
  const modal = document.getElementById('modalProfesoresMasivos');
  if (modal) {
    modal.remove();
  }
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(event) {
  const modal = document.getElementById('modalProfesoresMasivos');
  if (modal && event.target === modal) {
    cerrarModalProfesoresMasivos();
  }
});

console.log('Registro masivo de profesores cargado (versión mejorada con barra de progreso detallada)');