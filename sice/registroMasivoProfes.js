// REGISTRO MASIVO DE PROFESORES

console.log('=== CARGANDO REGISTRO MASIVO DE PROFESORES - ACTUALIZADO ===');

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
    html += `<td style="padding: 8px; border: 1px solid #ddd;"><strong>${nombre}</strong></td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${email}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">`;
    if (esValido) {
      html += '<span style="color: #4caf50; font-weight: 600;">OK</span>';
    } else {
      html += '<span style="color: #f44336; font-weight: 600;">INVALIDO</span>';
    }
    html += '</td>';
    html += '</tr>';
  });
  
  html += '</tbody>';
  html += '</table>';
  
  html += `<div style="margin-top: 15px; padding: 12px; background: ${emailsInvalidos > 0 ? '#fff3cd' : '#d4edda'}; border-radius: 8px;">`;
  html += `<strong>Total: ${nombres.length} profesores</strong><br>`;
  html += `Emails validos: <span style="color: #4caf50; font-weight: 600;">${emailsValidos}</span><br>`;
  html += `Emails invalidos: <span style="color: #f44336; font-weight: 600;">${emailsInvalidos}</span>`;
  if (emailsInvalidos > 0) {
    html += '<br><br><strong style="color: #856404;">Corrige los emails invalidos antes de continuar</strong>';
  }
  html += '</div>';
  
  document.getElementById('contenidoVistaPreviaProfesores').innerHTML = html;
  document.getElementById('vistaPreviaProfesores').style.display = 'block';
}

async function guardarProfesoresMasivos(event) {
  event.preventDefault();
  
  const nombresText = document.getElementById('nombresProfesoresMasivo').value.trim();
  const emailsText = document.getElementById('emailsProfesoresMasivo').value.trim();
  
  if (!nombresText || !emailsText) {
    alert('Completa todos los campos requeridos');
    return;
  }
  
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const emails = emailsText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
  
  if (nombres.length !== emails.length) {
    alert('Las cantidades de nombres y emails no coinciden');
    return;
  }
  
  const emailsInvalidos = emails.filter(e => !validarEmail(e));
  if (emailsInvalidos.length > 0) {
    alert(`Hay ${emailsInvalidos.length} emails invalidos. Corrigelos antes de continuar.`);
    return;
  }
  
  const passwordTemporal = 'ilb123';
  
  const confirmar = confirm(
    `Vas a registrar ${nombres.length} profesores\n\n` +
    `Contraseña temporal: ${passwordTemporal}\n\n` +
    `Este proceso puede tardar varios minutos.\n\n` +
    `Continuar?`
  );
  
  if (!confirmar) return;
  
  document.getElementById('barraProgresoProfesores').style.display = 'block';
  document.getElementById('formProfesoresMasivos').style.display = 'none';
  
  const barra = document.getElementById('barraProgresoProfesoresFill');
  const texto = document.getElementById('textoProgresoProfesores');
  
  let exitosos = 0;
  let fallidos = 0;
  const erroresDetallados = [];
  
  console.log('Iniciando registro masivo de profesores...');
  console.log(`Total profesores: ${nombres.length}`);
  
  // PROCESAR CADA PROFESOR - USANDO INSTANCIA SECUNDARIA COMO EN guardarProfesor()
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i];
    const email = emails[i];
    
    const porcentaje = Math.round(((i + 1) / nombres.length) * 100);
    barra.style.width = porcentaje + '%';
    barra.textContent = porcentaje + '%';
    texto.textContent = `Creando ${i + 1}/${nombres.length}: ${nombre}`;
    
    try {
      // USAR INSTANCIA SECUNDARIA CON NOMBRE UNICO (igual que guardarProfesor)
      const secondaryApp = firebase.initializeApp(firebaseConfig, 'SecondaryProfesor_' + Date.now() + '_' + i);
      const secondaryAuth = secondaryApp.auth();
      
      try {
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
        
        // Cerrar sesion de la instancia secundaria
        await secondaryAuth.signOut();
        
        // Eliminar la app secundaria
        await secondaryApp.delete();
        
        exitosos++;
        
      } catch (authError) {
        // Si falla, también intentar cerrar/eliminar la instancia secundaria
        try {
          await secondaryAuth.signOut();
          await secondaryApp.delete();
        } catch (e) {
          console.warn('Error al limpiar instancia secundaria:', e);
        }
        
        // Manejar email duplicado
        if (authError.code === 'auth/email-already-in-use') {
          // Intentar agregar a carrera si ya existe como profesor
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
            } else {
              erroresDetallados.push({
                numero: i + 1,
                nombre: nombre,
                email: email,
                error: 'Profesor ya existe en esta carrera',
                codigo: 'ya-existe'
              });
              fallidos++;
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
          }
        } else {
          throw authError;
        }
      }
      
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
    }
    
    // Pausa breve entre profesores
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('Proceso completado.');
  
  barra.style.background = 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)';
  texto.innerHTML = `
    <strong style="color: #4caf50;">Proceso completado</strong><br>
    Profesores creados: ${exitosos}<br>
    ${fallidos > 0 ? `Errores: ${fallidos}` : ''}
  `;
  
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
      
      if (err.codigo === 'auth/email-already-in-use') {
        mensaje += `   El email ya esta registrado en Firebase\n\n`;
      } else if (err.codigo === 'ya-existe') {
        mensaje += `   ${err.error}\n\n`;
      } else {
        mensaje += `   Error: ${err.error}\n\n`;
      }
    });
  }
  
  setTimeout(() => {
    alert(mensaje);
    cerrarModalProfesoresMasivos();
    
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

document.addEventListener('click', function(event) {
  const modal = document.getElementById('modalProfesoresMasivos');
  if (modal && event.target === modal) {
    cerrarModalProfesoresMasivos();
  }
});