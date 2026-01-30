// registroMasivoProfesores.js
// Sistema de Registro Masivo de Profesores - CON AUTENTICACIÓN FIREBASE

console.log('=== CARGANDO REGISTRO MASIVO DE PROFESORES V1.0 ===');

// Función para mostrar el modal de captura masiva de profesores
async function mostrarModalProfesoresMasivos() {
  const html = `
    <div id="modalProfesoresMasivos" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; overflow-y: auto;">
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea;">
          <h2 style="margin: 0; color: #667eea; font-size: 1.8rem;">Carga Masiva de Profesores</h2>
          <button onclick="cerrarModalProfesoresMasivos()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <form id="formProfesoresMasivos" onsubmit="guardarProfesoresMasivos(event)">

          <!-- INSTRUCCIONES -->
          <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1565c0; font-size: 1rem;">Instrucciones:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #1565c0; line-height: 1.8; font-size: 0.9rem;">
              <li>Pega los datos en 2 columnas separadas (una línea por profesor)</li>
              <li>Los profesores se crearán en <strong>Firebase Authentication</strong> y <strong>Firestore</strong></li>
              <li>Formato: <strong>Nombre Completo | Email</strong></li>
              <li>Se generará una contraseña temporal automática: <code>Profe2025!</code></li>
              <li>Los profesores deberán cambiar su contraseña en el primer login</li>
            </ul>

            <!-- EJEMPLO -->
            <h3 style="margin: 15px 0 10px 0; color: #1565c0; font-size: 1rem;">Ejemplo de datos:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; background: white;">
              <thead style="background: #f5f5f5;">
                <tr>
                  <th style="padding: 8px; border: 1px solid #000; text-align: left;">Nombre Completo</th>
                  <th style="padding: 8px; border: 1px solid #000; text-align: left;">Email</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Juan Pérez García</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">juan.perez@escuela.edu.mx</td>
                </tr>
                <tr style="background: #f9f9f9;">
                  <td style="padding: 8px; border: 1px solid #ddd;">María López Hernández</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">maria.lopez@escuela.edu.mx</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Carlos Ramírez Sánchez</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">carlos.ramirez@escuela.edu.mx</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- ADVERTENCIA IMPORTANTE -->
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 1rem;">Importante:</h3>
            <p style="margin: 0; color: #856404; line-height: 1.6; font-size: 0.9rem;">
              Este proceso crea usuarios en Firebase Authentication. Si un email ya existe, 
              ese registro será omitido y se mostrará en el reporte de errores.
              <br><br>
              <strong>Contraseña temporal:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px;">Profe2025!</code>
              <br>
              Los profesores deben cambiarla en su primer acceso.
            </p>
          </div>

          <!-- CAMPOS PARA PEGAR DATOS -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            
            <!-- NOMBRES COMPLETOS -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Nombres Completos *
              </label>
              <textarea id="nombresProfesoresMasivo" required rows="12" 
                        placeholder="Juan Pérez García&#10;María López Hernández&#10;Carlos Ramírez Sánchez&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Un nombre por línea</small>
            </div>

            <!-- EMAILS -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Correos Electrónicos *
              </label>
              <textarea id="emailsProfesoresMasivo" required rows="12" 
                        placeholder="juan.perez@escuela.edu.mx&#10;maria.lopez@escuela.edu.mx&#10;carlos.ramirez@escuela.edu.mx&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Un email por línea</small>
            </div>

          </div>

          <!-- AREA DE VISTA PREVIA -->
          <div id="vistaPreviaProfesores" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; max-height: 400px; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #333; display: inline;">Vista Previa:</h3> 
            <span style="color: #666;">Revisa que esté correcto</span>
            <div id="contenidoVistaPreviaProfesores"></div>
          </div>

          <!-- BOTONES DE ACCION -->
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

        <!-- BARRA DE PROGRESO -->
        <div id="barraProgresoProfesores" style="display: none; margin-top: 20px;">
          <div style="background: #e0e0e0; border-radius: 10px; height: 30px; overflow: hidden; position: relative;">
            <div id="barraProgresoProfesoresFill" 
                 style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.9rem;">
              0%
            </div>
          </div>
          <p id="textoProgresoProfesores" style="text-align: center; margin-top: 10px; color: #666; font-size: 0.9rem;">
            Iniciando proceso...
          </p>
        </div>

      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  const existingModal = document.getElementById('modalProfesoresMasivos');
  if (existingModal) {
    existingModal.remove();
  }
  document.body.insertAdjacentHTML('beforeend', html);
}

// Función para validar email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Función para previsualizar los profesores antes de guardar
function previsualizarProfesores() {
  const nombresText = document.getElementById('nombresProfesoresMasivo').value.trim();
  const emailsText = document.getElementById('emailsProfesoresMasivo').value.trim();
  
  // Validar que no estén vacíos
  if (!nombresText || !emailsText) {
    alert('Debes completar ambas columnas (Nombres y Emails)');
    return;
  }
  
  // Dividir en líneas
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const emails = emailsText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
  
  // Validar que tengan la misma cantidad
  if (nombres.length !== emails.length) {
    alert(`Error de formato:\n\nNombres: ${nombres.length} líneas\nEmails: ${emails.length} líneas\n\nDeben tener la misma cantidad de líneas.`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('No hay datos para previsualizar');
    return;
  }
  
  // Construir vista previa
  let html = `
    <div class="mensaje-exito-masivo" style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 8px; margin: 15px 0; font-weight: 600;">
      Se encontraron ${nombres.length} profesores para crear
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">
      <thead style="background: #667eea; color: white;">
        <tr>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">#</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Nombre Completo</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Email</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Validación</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  let errores = 0;
  
  for (let i = 0; i < nombres.length; i++) {
    const bgColor = i % 2 === 0 ? '#fff' : '#f9f9f9';
    const nombre = nombres[i];
    const email = emails[i];
    
    // Validaciones
    let erroresRow = [];
    if (nombre.length < 3) erroresRow.push('Nombre muy corto');
    if (!validarEmail(email)) erroresRow.push('Email inválido');
    
    const esValido = erroresRow.length === 0;
    const rowColor = esValido ? '' : 'background: #ffebee;';
    const estado = esValido ? 'Válido' : `${erroresRow.join(', ')}`;
    
    if (!esValido) errores++;
    
    html += `
      <tr style="${rowColor || `background: ${bgColor};`}">
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>${nombre}</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${email}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 0.85rem;">${estado}</td>
      </tr>
    `;
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  if (errores > 0) {
    html = `<div class="mensaje-error-masivo" style="background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 12px; border-radius: 8px; margin: 15px 0; font-weight: 600;">Se encontraron ${errores} registros con errores</div>` + html;
  }
  
  html += `
    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 0.85rem; color: #856404;">
      <strong>Contraseña temporal:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px;">Profe2025!</code><br>
      Los profesores deberán cambiarla en su primer acceso.
    </div>
    <p style="margin-top: 15px; color: #667eea; font-weight: 600;">
      Total de profesores a crear: ${nombres.length}
    </p>
  `;
  
  document.getElementById('contenidoVistaPreviaProfesores').innerHTML = html;
  document.getElementById('vistaPreviaProfesores').style.display = 'block';
  
  // Scroll a la vista previa
  document.getElementById('vistaPreviaProfesores').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Función para guardar los profesores masivamente
async function guardarProfesoresMasivos(event) {
  event.preventDefault();
  
  const nombresText = document.getElementById('nombresProfesoresMasivo').value.trim();
  const emailsText = document.getElementById('emailsProfesoresMasivo').value.trim();
  
  // Validaciones
  if (!nombresText || !emailsText) {
    alert('Debes completar ambas columnas');
    return;
  }
  
  // Dividir en líneas
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const emails = emailsText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
  
  // Validar coincidencia
  if (nombres.length !== emails.length) {
    alert(`Error: Las dos columnas deben tener la misma cantidad de líneas.\n\nNombres: ${nombres.length}\nEmails: ${emails.length}`);
    return;
  }
  
  if (nombres.length === 0) {
    alert('No hay profesores para registrar');
    return;
  }
  
  // Validar todos los emails
  const emailsInvalidos = emails.filter(e => !validarEmail(e));
  if (emailsInvalidos.length > 0) {
    alert(`Emails inválidos encontrados:\n\n${emailsInvalidos.join('\n')}`);
    return;
  }
  
  // Confirmar
  const passwordTemporal = 'Profe2025!';
  if (!confirm(`¿Crear ${nombres.length} profesores en Firebase?\n\nEsta acción:\n• Crea usuarios en Firebase Authentication\n• Registra datos en Firestore\n• Asigna contraseña temporal: ${passwordTemporal}\n\n¿Continuar?`)) {
    return;
  }
  
  // Mostrar barra de progreso
  document.getElementById('barraProgresoProfesores').style.display = 'block';
  document.getElementById('formProfesoresMasivos').style.display = 'none';
  
  const barra = document.getElementById('barraProgresoProfesoresFill');
  const texto = document.getElementById('textoProgresoProfesores');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  // Guardar usuario administrador actual
  const adminUser = firebase.auth().currentUser;
  const adminEmail = adminUser ? adminUser.email : null;
  
  console.log('Iniciando registro masivo de profesores...');
  console.log(`Total profesores: ${nombres.length}`);
  console.log(`Admin actual: ${adminEmail}`);
  
  // Procesar cada profesor
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i];
    const email = emails[i];
    
    // Actualizar progreso
    const porcentaje = Math.round(((i + 1) / nombres.length) * 100);
    barra.style.width = porcentaje + '%';
    barra.textContent = porcentaje + '%';
    texto.textContent = `Creando ${i + 1}/${nombres.length}: ${nombre}`;
    
    try {
      // PASO 1: Crear usuario en Firebase Authentication
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, passwordTemporal);
      const newUid = userCredential.user.uid;
      
      console.log(`[${i + 1}] Auth creado: ${email} (${newUid})`);
      
      // PASO 2: Crear documento en Firestore
      const profesorData = {
        nombre: nombre,
        email: email,
        rol: 'profesor',
        roles: ['profesor'], // Array de roles
        carreraId: usuarioActual.carreraId,
        activo: true,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        registroMasivo: true,
        passwordTemporal: true, // Indicar que debe cambiar password
        fechaRegistroMasivo: new Date().toISOString()
      };
      
      await db.collection('usuarios').doc(newUid).set(profesorData);
      console.log(`[${i + 1}] Firestore guardado: ${email}`);
      
      // PASO 3: Cerrar sesión del profesor recién creado
      await firebase.auth().signOut();
      
      exitosos++;
      
    } catch (error) {
      fallidos++;
      erroresDetallados.push({
        numero: i + 1,
        nombre: nombre,
        email: email,
        error: error.message,
        codigo: error.code
      });
      console.error(`[${i + 1}] ERROR al crear ${email}:`, error);
      
      // Si falló, también hacer signOut por si quedó sesión abierta
      try {
        await firebase.auth().signOut();
      } catch (e) {
        // Ignorar error de signOut
      }
    }
    
    // Pausa breve para no saturar Firebase
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // PASO 4: Restaurar sesión del administrador
  console.log('Restaurando sesión del administrador...');
  
  barra.style.background = 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)';
  texto.innerHTML = `
    <strong style="color: #ff9800;">Restaurando sesión de administrador...</strong><br>
    Por favor espera...
  `;
  
  let sesionRestaurada = false;
  
  if (adminEmail) {
    // Solicitar contraseña del admin
    const passwordAdmin = prompt(`Para restaurar tu sesión, ingresa tu contraseña de administrador:\n\nEmail: ${adminEmail}`);
    
    if (passwordAdmin) {
      try {
        await firebase.auth().signInWithEmailAndPassword(adminEmail, passwordAdmin);
        console.log('Sesión de admin restaurada');
        sesionRestaurada = true;
      } catch (error) {
        console.error('Error al restaurar sesión:', error);
        alert('No se pudo restaurar tu sesión automáticamente.\nDeberás iniciar sesión nuevamente.');
      }
    }
  }
  
  // Mostrar resumen final
  if (sesionRestaurada) {
    barra.style.background = 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)';
    texto.innerHTML = `
      <strong style="color: #4caf50;">Proceso completado</strong><br>
      Profesores creados: ${exitosos}<br>
      ${fallidos > 0 ? `Errores: ${fallidos}<br>` : ''}
      Sesión restaurada correctamente
    `;
  } else {
    barra.style.background = 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)';
    texto.innerHTML = `
      <strong style="color: #ff9800;">Proceso completado con advertencia</strong><br>
      Profesores creados: ${exitosos}<br>
      ${fallidos > 0 ? `Errores: ${fallidos}<br>` : ''}
      Deberás iniciar sesión nuevamente
    `;
  }
  
  let mensaje = `RESUMEN DE REGISTRO MASIVO DE PROFESORES\n\n`;
  mensaje += `Exitosos: ${exitosos}\n`;
  mensaje += `Fallidos: ${fallidos}\n`;
  mensaje += `Total procesados: ${nombres.length}\n`;
  mensaje += `Contraseña temporal: ${passwordTemporal}\n`;
  mensaje += `\nLos profesores deben cambiar su contraseña en el primer login.\n`;
  
  if (erroresDetallados.length > 0) {
    mensaje += `\nERRORES DETALLADOS:\n\n`;
    erroresDetallados.forEach(err => {
      mensaje += `#${err.numero} - ${err.nombre} (${err.email})\n`;
      
      // Explicar error común
      if (err.codigo === 'auth/email-already-in-use') {
        mensaje += `   El email ya está registrado en Firebase\n\n`;
      } else {
        mensaje += `   Error: ${err.error}\n\n`;
      }
    });
  }
  
  // Esperar y cerrar
  setTimeout(() => {
    alert(mensaje);
    
    if (!sesionRestaurada) {
      // Redirigir a login si no se pudo restaurar sesión
      alert('Redirigiendo a login...');
      window.location.href = 'login.html';
    } else {
      // Cerrar modal y recargar si hay función disponible
      cerrarModalProfesoresMasivos();
      
      // Recargar lista de profesores/usuarios si existe la función
      if (typeof cargarProfesores === 'function') {
        cargarProfesores();
      } else if (typeof cargarUsuarios === 'function') {
        cargarUsuarios();
      }
    }
  }, 3000);
}

// Función para cerrar el modal
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

console.log('REGISTRO MASIVO DE PROFESORES V1.0 CARGADO');
console.log('IMPORTANTE: Este sistema crea usuarios en Firebase Authentication');