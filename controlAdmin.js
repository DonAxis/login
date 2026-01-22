const auth = firebase.auth();

// Variables globales para sistema multi-carrera
let coordinadoresData = [];
let carrerasData = [];
let coordinadorActual = null;

const COLORES_DISPONIBLES = [
  { hex: "#43a047", nombre: "Verde Esmeralda" },
  { hex: "#1976d2", nombre: "Azul Océano" },
  { hex: "#d32f2f", nombre: "Rojo Carmesí" },
  { hex: "#f57c00", nombre: "Naranja Vibrante" },
  { hex: "#7b1fa2", nombre: "Púrpura Imperial" },
  { hex: "#0097a7", nombre: "Cian Profundo" },
  { hex: "#c2185b", nombre: "Rosa Magenta" },
  { hex: "#5d4037", nombre: "Café Chocolate" },
  { hex: "#00796b", nombre: "Verde Jade" },
  { hex: "#303f9f", nombre: "Índigo Profundo" },
  { hex: "#f9a825", nombre: "Amarillo Dorado" },
  { hex: "#e64a19", nombre: "Naranja Ardiente" }
];

// Proteger la página - solo admin
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No hay usuario autenticado');
    window.location.href = 'login.html';
    return;
  }

  // Verificar rol
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  
  if (!userDoc.exists) {
    console.log('Usuario no encontrado en Firestore');
    await auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  const userData = userDoc.data();

  if (userData.rol !== 'admin') {
    console.log('No tienes permisos de administrador');
    alert('No tienes permisos para acceder a esta página');
    window.location.href = 'login.html';
    return;
  }

  // Mostrar datos del usuario
  document.getElementById('userName').textContent = userData.nombre;
  document.getElementById('userEmail').textContent = user.email;
  
  console.log('Dashboard de admin cargado');
});

// Función para cerrar sesión
async function cerrarSesion() {
  if (confirm('¿Estás seguro de cerrar sesión?')) {
    try {
      await auth.signOut();
      sessionStorage.clear();
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('Error al cerrar sesión');
    }
  }
}

// ===== CREAR COORDINADOR =====
async function mostrarModalCoordinador() {
  document.getElementById('modalCoordinador').style.display = 'flex';
  
  // Cargar carreras
  try {
    const carrerasSnap = await db.collection('carreras').get();
    const select = document.getElementById('carreraCoord');
    select.innerHTML = '<option value="">Seleccionar carrera...</option>';
    
    carrerasSnap.forEach(doc => {
      const carrera = doc.data();
      select.innerHTML += `<option value="${doc.id}">${carrera.nombre} (${carrera.codigo})</option>`;
    });
  } catch (error) {
    console.error('Error al cargar carreras:', error);
    alert('Error al cargar carreras');
  }
}

function cerrarModalCoordinador() {
  document.getElementById('modalCoordinador').style.display = 'none';
  document.getElementById('formCoordinador').reset();
  const mensaje = document.getElementById('mensajeCoord');
  if (mensaje) mensaje.style.display = 'none';
}

async function crearCoordinador(event) {
  event.preventDefault();
  
  const nombre = document.getElementById("nombreCoord").value.trim();
  const email = document.getElementById("emailCoord").value.trim().toLowerCase();
  const password = document.getElementById("passCoord").value;
  const carreraId = document.getElementById("carreraCoord").value;
  
  if (password.length < 6) {
    mostrarMensaje("La contraseña debe tener al menos 6 caracteres", "error");
    return;
  }
  
  try {
    mostrarMensaje("Creando coordinador en Firebase Authentication...", "info");
    
    // 1. Crear el nuevo usuario en Authentication
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Usuario creado en Authentication. UID:", newUid);
    
    mostrarMensaje("Usuario creado en Authentication. Guardando en Firestore...", "info");
    
    // 2. ESPERAR 1 SEGUNDO para que Firebase propague permisos
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("Guardando en Firestore...");
    
    // 3. Crear documento en Firestore CON MÚLTIPLES INTENTOS
    let intentos = 0;
    let guardadoExitoso = false;
    
    while (intentos < 3 && !guardadoExitoso) {
      try {
        await db.collection("usuarios").doc(newUid).set({
          nombre: nombre,
          email: email,
          rol: "coordinador",
          carreraId: carreraId,
          carreras: [{
            carreraId: carreraId,
            color: "#43a047"
          }],
          carreraActual: carreraId,
          esProfesor: true,
          activo: true,
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        guardadoExitoso = true;
        console.log("Guardado exitosamente en Firestore");
        
      } catch (errorFirestore) {
        intentos++;
        console.log(`Intento ${intentos} de guardar falló:`, errorFirestore);
        
        if (intentos < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw errorFirestore;
        }
      }
    }
    
    mostrarMensaje("Guardado en Firestore. Verificando...", "info");
    
    // 4. ESPERAR OTRO SEGUNDO antes de verificar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Verificar que se guardó (con reintentos)
    let verificado = false;
    intentos = 0;
    
    while (intentos < 3 && !verificado) {
      const verificar = await db.collection("usuarios").doc(newUid).get();
      
      if (verificar.exists) {
        verificado = true;
        console.log("Documento verificado en Firestore");
        console.log("Datos guardados:", verificar.data());
      } else {
        intentos++;
        console.log(`Intento ${intentos} de verificar - documento no existe aún`);
        
        if (intentos < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!verificado) {
      throw new Error("El documento no se pudo verificar en Firestore después de 3 intentos");
    }
    
    mostrarMensaje(
      `¡Coordinador creado exitosamente!\n\n` +
      `Nombre: ${nombre}\n` +
      `Email: ${email}\n` +
      `Password: ${password}\n\n` +
      `El documento se ha guardado en Firestore.\n` +
      `Ahora puedes cerrar sesión y el coordinador podrá iniciar sesión.`,
      "success"
    );
    
    // 6. ESPERAR 2 SEGUNDOS antes de cerrar sesión
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 7. Cerrar sesión del coordinador recién creado
    console.log("Cerrando sesión del coordinador...");
    await auth.signOut();
    
    // 8. Mostrar alert y redirigir
    alert(
      "Coordinador creado exitosamente\n\n" +
      `Nombre: ${nombre}\n` +
      `Email: ${email}\n` +
      `Password: ${password}\n\n` +
      "IMPORTANTE: Debes iniciar sesión nuevamente como administrador."
    );
    
    window.location.href = "login.html";
    
  } catch (error) {
    console.error("Error completo:", error);
    
    let mensaje = "Error: ";
    if (error.code === "auth/email-already-in-use") {
      mensaje += "Este email ya está registrado en el sistema";
    } else if (error.code === "auth/invalid-email") {
      mensaje += "Email inválido";
    } else if (error.code === "permission-denied") {
      mensaje += "Error de permisos en Firestore.\n\n" +
                "Verifica que las reglas de Firestore permitan escribir en la colección 'usuarios'.\n\n" +
                "Regla sugerida:\n" +
                "allow write: if request.auth != null;";
    } else {
      mensaje += error.message;
    }
    
    mostrarMensaje(mensaje, "error");
    
    // Esperar 3 segundos antes de cerrar sesión en caso de error
    setTimeout(async () => {
      try {
        await auth.signOut();
        window.location.href = "login.html";
      } catch (e) {
        console.error("Error al cerrar sesión:", e);
        window.location.href = "login.html";
      }
    }, 3000);
  }
}

function mostrarMensaje(texto, tipo) {
  const div = document.getElementById('mensajeCoord');
  if (!div) return;
  div.textContent = texto;
  div.style.display = 'block';
  div.style.whiteSpace = 'pre-line';
  div.style.padding = '15px';
  div.style.borderRadius = '8px';
  div.style.background = tipo === 'error' ? '#ffebee' : tipo === 'success' ? '#e8f5e9' : '#e3f2fd';
  div.style.color = tipo === 'error' ? '#c62828' : tipo === 'success' ? '#2e7d32' : '#1565c0';
  div.style.border = tipo === 'error' ? '2px solid #ef5350' : tipo === 'success' ? '2px solid #66bb6a' : '2px solid #42a5f5';
}

// ===== CREAR CARRERA =====
function mostrarModalCarrera() {
  document.getElementById('modalCarrera').style.display = 'flex';
}

function cerrarModalCarrera() {
  document.getElementById('modalCarrera').style.display = 'none';
  document.getElementById('formCarrera').reset();
  document.getElementById('mensajeCarrera').style.display = 'none';
}

async function crearCarrera(event) {
  event.preventDefault();
  
  const codigo = document.getElementById('codigoCarrera').value.trim().toUpperCase();
  const nombre = document.getElementById('nombreCarrera').value.trim();
  const descripcion = document.getElementById('descripcionCarrera').value.trim();
  
  // Validar código (solo letras y números)
  if (!/^[A-Z0-9]+$/.test(codigo)) {
    mostrarMensajeCarrera('El código solo puede contener letras y números', 'error');
    return;
  }
  
  try {
    mostrarMensajeCarrera('Creando carrera...', 'info');
    
    // Verificar si el código ya existe
    const existeDoc = await db.collection('carreras').doc(codigo).get();
    if (existeDoc.exists) {
      mostrarMensajeCarrera('Este código de carrera ya existe', 'error');
      return;
    }
    
    // Crear carrera
    await db.collection('carreras').doc(codigo).set({
      codigo: codigo,
      nombre: nombre,
      descripcion: descripcion || '',
      activa: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    mostrarMensajeCarrera('Carrera creada exitosamente', 'success');
    
    setTimeout(() => {
      cerrarModalCarrera();
    }, 2000);
    
  } catch (error) {
    console.error('Error al crear carrera:', error);
    mostrarMensajeCarrera('Error al crear la carrera: ' + error.message, 'error');
  }
}

function mostrarMensajeCarrera(texto, tipo) {
  const div = document.getElementById('mensajeCarrera');
  if (!div) return;
  div.textContent = texto;
  div.style.display = 'block';
  div.style.background = tipo === 'error' ? '#ffebee' : tipo === 'success' ? '#e8f5e9' : '#e3f2fd';
  div.style.color = tipo === 'error' ? '#c62828' : tipo === 'success' ? '#2e7d32' : '#1565c0';
}

// ===== CREAR CONTROL ESCOLAR =====
function mostrarModalControlEscolar() {
  document.getElementById('modalControlEscolar').style.display = 'flex';
}

function cerrarModalControlEscolar() {
  document.getElementById('modalControlEscolar').style.display = 'none';
  document.getElementById('formControlEscolar').reset();
  document.getElementById('mensajeControl').style.display = 'none';
}

async function crearControlEscolar(event) {
  event.preventDefault();
  
  const nombre = document.getElementById('nombreControl').value.trim();
  const email = document.getElementById('emailControl').value.trim().toLowerCase();
  const password = document.getElementById('passControl').value;
  
  if (password.length < 6) {
    mostrarMensajeControl('La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }
  
  try {
    mostrarMensajeControl('Creando usuario de control escolar...', 'info');
    
    // Crear usuario en Authentication
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log('Usuario creado en Authentication. UID:', newUid);
    
    // Esperar 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Guardar en Firestore con reintentos
    let guardadoExitoso = false;
    let intentos = 0;
    
    while (intentos < 3 && !guardadoExitoso) {
      try {
        await db.collection('usuarios').doc(newUid).set({
          nombre: nombre,
          email: email,
          rol: 'controlEscolar',
          activo: true,
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        guardadoExitoso = true;
        console.log('Guardado exitosamente en Firestore');
      } catch (errorFirestore) {
        intentos++;
        console.log(`Intento ${intentos} falló:`, errorFirestore);
        if (intentos < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw errorFirestore;
        }
      }
    }
    
    // Esperar 1 segundo más
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar
    const verificar = await db.collection('usuarios').doc(newUid).get();
    if (!verificar.exists) {
      throw new Error('El documento no se pudo verificar en Firestore');
    }
    
    mostrarMensajeControl(
      `Control Escolar creado exitosamente!\n\n` +
      `Nombre: ${nombre}\n` +
      `Email: ${email}\n` +
      `Password: ${password}`,
      'success'
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await auth.signOut();
    
    alert(
      "Control Escolar creado exitosamente\n\n" +
      `Nombre: ${nombre}\n` +
      `Email: ${email}\n` +
      `Password: ${password}\n\n` +
      "Debes iniciar sesión nuevamente como administrador."
    );
    
    window.location.href = 'login.html';
    
  } catch (error) {
    console.error('Error:', error);
    let mensaje = 'Error: ';
    if (error.code === 'auth/email-already-in-use') {
      mensaje += 'Email ya registrado';
    } else if (error.code === 'auth/invalid-email') {
      mensaje += 'Email inválido';
    } else if (error.code === 'permission-denied') {
      mensaje += 'Error de permisos. Verifica las reglas de Firestore';
    } else {
      mensaje += error.message;
    }
    mostrarMensajeControl(mensaje, 'error');
    
    setTimeout(async () => {
      try {
        await auth.signOut();
      } catch (e) {
        console.error('Error al cerrar sesión:', e);
      }
      window.location.href = 'login.html';
    }, 3000);
  }
}

function mostrarMensajeControl(texto, tipo) {
  const div = document.getElementById('mensajeControl');
  if (!div) return;
  div.textContent = texto;
  div.style.display = 'block';
  div.style.whiteSpace = 'pre-line';
  div.style.background = tipo === 'error' ? '#ffebee' : tipo === 'success' ? '#e8f5e9' : '#e3f2fd';
  div.style.color = tipo === 'error' ? '#c62828' : tipo === 'success' ? '#2e7d32' : '#1565c0';
}

// ===== GESTIONAR COORDINADORES =====
async function gestionarCoordinadores() {
  try {
    console.log('Cargando coordinadores y carreras...');
    
    const [coordinadoresSnap, carrerasSnap] = await Promise.all([
      db.collection('usuarios').where('rol', '==', 'coordinador').get(),
      db.collection('carreras').get()
    ]);
    
    coordinadoresData = coordinadoresSnap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    carrerasData = carrerasSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Cargados ${coordinadoresData.length} coordinadores y ${carrerasData.length} carreras`);
    
    if (coordinadoresData.length === 0) {
      alert('No hay coordinadores registrados.\n\nPrimero crea un coordinador usando el botón "Crear Coordinador".');
      return;
    }
    
    if (carrerasData.length === 0) {
      alert('No hay carreras registradas.\n\nPrimero crea una carrera usando el botón "Crear Carrera".');
      return;
    }
    
    mostrarListaCoordinadores();
    
  } catch (error) {
    console.error('Error al cargar datos:', error);
    alert('Error al cargar coordinadores y carreras.\n\nDetalle: ' + error.message);
  }
}

function mostrarListaCoordinadores() {
  let html = `
    <div style="background: white; padding: 40px; border-radius: 20px; max-width: 1000px; margin: 40px auto; box-shadow: 0 25px 80px rgba(0,0,0,0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #667eea;">
        <h2 style="margin: 0; color: #667eea; font-size: 2rem;">Gestionar Coordinadores</h2>
        <button onclick="cerrarGestionCoordinadores()" 
          style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; padding: 0; width: 40px; height: 40px; border-radius: 50%; transition: all 0.3s;"
          onmouseover="this.style.background='#f5f5f5'; this.style.color='#333';"
          onmouseout="this.style.background='none'; this.style.color='#999';">
          &times;
        </button>
      </div>
      
      <div style="background: #e3f2fd; padding: 18px; border-radius: 10px; margin-bottom: 25px; border-left: 5px solid #1976d2;">
        <strong style="color: #0d47a1;">Instrucciones:</strong>
        <p style="margin: 8px 0 0 0; color: #1565c0; line-height: 1.6;">
          Selecciona un coordinador para asignar o modificar las carreras que puede gestionar y sus colores distintivos.
        </p>
      </div>
      
      <div style="display: grid; gap: 15px;">
  `;
  
  coordinadoresData.forEach(coord => {
    const carrerasAsignadas = coord.carreras || [];
    const numCarreras = carrerasAsignadas.length;
    
    let carrerasTexto = '';
    if (numCarreras === 0) {
      carrerasTexto = '<span style="color: #f44336; font-weight: 600;">Sin carreras asignadas</span>';
    } else {
      const nombresCarreras = carrerasAsignadas.map(ca => {
        const carrera = carrerasData.find(c => c.id === ca.carreraId);
        return carrera ? carrera.nombre : 'Desconocida';
      }).join(', ');
      carrerasTexto = `<span style="color: #2e7d32; font-weight: 600;">${numCarreras} carrera(s):</span> ${nombresCarreras}`;
    }
    
    html += `
      <div class="coord-item" 
           onclick="abrirAsignacionCarreras('${coord.uid}')"
           style="background: linear-gradient(135deg, #f9f9f9 0%, #ffffff 100%); padding: 20px; border-radius: 12px; border: 2px solid #ddd; cursor: pointer; transition: all 0.3s;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-size: 1.2rem; font-weight: 700; color: #333; margin-bottom: 6px;">
              ${coord.nombre}
            </div>
            <div style="font-size: 0.95rem; color: #666; margin-bottom: 8px;">
              ${coord.email}
            </div>
            <div style="font-size: 0.9rem; color: #666;">
              ${carrerasTexto}
            </div>
          </div>
          <div style="background: #667eea; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.95rem;">
            Configurar →
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
      
      <div style="margin-top: 25px; text-align: center;">
        <button onclick="cerrarGestionCoordinadores()" 
          style="padding: 14px 40px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 10px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: all 0.3s;"
          onmouseover="this.style.background='#e0e0e0';"
          onmouseout="this.style.background='#f5f5f5';">
          Cerrar
        </button>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('modalGestionCoordinadores');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'modalGestionCoordinadores';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1500; overflow-y: auto; backdrop-filter: blur(3px);';
  modal.innerHTML = html;
  
  document.body.appendChild(modal);
}

function cerrarGestionCoordinadores() {
  const modal = document.getElementById('modalGestionCoordinadores');
  if (modal) {
    modal.remove();
  }
}

async function abrirAsignacionCarreras(coordinadorUid) {
  const coordinador = coordinadoresData.find(c => c.uid === coordinadorUid);
  if (!coordinador) {
    alert('Error: Coordinador no encontrado');
    return;
  }
  
  coordinadorActual = coordinador;
  
  document.getElementById('nombreCoordActual').textContent = coordinador.nombre;
  document.getElementById('emailCoordActual').textContent = coordinador.email;
  
  const carrerasAsignadas = coordinador.carreras || [];
  
  let html = '';
  
  if (carrerasData.length === 0) {
    html = `
      <div style="text-align: center; padding: 40px; color: #999;">
        <p style="font-size: 1.1rem; margin-bottom: 15px;">No hay carreras disponibles</p>
        <p>Primero crea carreras usando el botón "Crear Carrera"</p>
      </div>
    `;
  } else {
    carrerasData.forEach(carrera => {
      const asignacion = carrerasAsignadas.find(c => c.carreraId === carrera.id);
      const estaAsignada = !!asignacion;
      const colorActual = asignacion ? asignacion.color : COLORES_DISPONIBLES[0].hex;

      html += `
        <div class="carrera-item" style="background: ${estaAsignada ? 'linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%)' : '#f9f9f9'}; padding: 18px; border-radius: 10px; margin-bottom: 12px; border: 2px solid ${estaAsignada ? '#667eea' : '#ddd'}; transition: all 0.3s;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
            
            <div style="display: flex; align-items: center; flex: 1; min-width: 200px;">
              <input type="checkbox" 
                     id="carrera_${carrera.id}" 
                     ${estaAsignada ? 'checked' : ''}
                     onchange="toggleCarreraAsignacion('${carrera.id}')"
                     style="width: 22px; height: 22px; margin-right: 15px; cursor: pointer; accent-color: #667eea;">
              <label for="carrera_${carrera.id}" style="cursor: pointer; font-weight: 600; font-size: 1.1rem; color: #333;">
                ${carrera.nombre}
              </label>
            </div>
            
            <div id="colorSelector_${carrera.id}" 
                 style="display: ${estaAsignada ? 'flex' : 'none'}; align-items: center; gap: 12px; background: white; padding: 10px 15px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <span style="font-size: 0.95rem; color: #666; font-weight: 600;">Color:</span>
              <select id="colorCarrera_${carrera.id}" 
                      onchange="actualizarVistaPrevia('${carrera.id}')"
                      style="padding: 8px 14px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; cursor: pointer; background: white; font-weight: 500; min-width: 160px;">
                ${COLORES_DISPONIBLES.map(color => `
                  <option value="${color.hex}" ${color.hex === colorActual ? 'selected' : ''}>
                    ${color.nombre}
                  </option>
                `).join('')}
              </select>
              <div id="preview_${carrera.id}" 
                   title="Vista previa del color"
                   style="width: 45px; height: 45px; border-radius: 10px; background: ${colorActual}; border: 4px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.25); transition: all 0.3s; cursor: pointer;"></div>
            </div>
          </div>
        </div>
      `;
    });
  }

  document.getElementById('listaCarrerasAsignar').innerHTML = html;
  document.getElementById('modalAsignarCarreras').style.display = 'flex';
}

function toggleCarreraAsignacion(carreraId) {
  const checkbox = document.getElementById(`carrera_${carreraId}`);
  const colorSelector = document.getElementById(`colorSelector_${carreraId}`);
  const carreraItem = checkbox.closest('.carrera-item');
  
  if (checkbox.checked) {
    colorSelector.style.display = 'flex';
    carreraItem.style.background = 'linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%)';
    carreraItem.style.borderColor = '#667eea';
    actualizarVistaPrevia(carreraId);
  } else {
    colorSelector.style.display = 'none';
    carreraItem.style.background = '#f9f9f9';
    carreraItem.style.borderColor = '#ddd';
  }
}

function actualizarVistaPrevia(carreraId) {
  const select = document.getElementById(`colorCarrera_${carreraId}`);
  const preview = document.getElementById(`preview_${carreraId}`);
  
  if (select && preview) {
    preview.style.background = select.value;
    preview.style.transform = 'scale(1.1)';
    setTimeout(() => {
      preview.style.transform = 'scale(1)';
    }, 200);
  }
}

async function guardarAsignacionCarreras() {
  if (!coordinadorActual) {
    alert('Error: No hay coordinador seleccionado');
    return;
  }

  try {
    const carrerasAsignadas = [];
    
    carrerasData.forEach(carrera => {
      const checkbox = document.getElementById(`carrera_${carrera.id}`);
      if (checkbox && checkbox.checked) {
        const colorSelect = document.getElementById(`colorCarrera_${carrera.id}`);
        carrerasAsignadas.push({
          carreraId: carrera.id,
          color: colorSelect.value
        });
      }
    });

    if (carrerasAsignadas.length === 0) {
      const confirmar = confirm(
        'ADVERTENCIA\n\n' +
        'No has seleccionado ninguna carrera.\n\n' +
        'El coordinador NO podrá acceder a su panel sin carreras asignadas.\n\n' +
        '¿Deseas continuar de todos modos?'
      );
      
      if (!confirmar) return;
    }

    // Detectar colores duplicados
    const coloresUsados = carrerasAsignadas.map(c => c.color);
    const coloresDuplicados = coloresUsados.filter((color, index) => 
      coloresUsados.indexOf(color) !== index
    );
    
    if (coloresDuplicados.length > 0) {
      const confirmar = confirm(
        'COLORES DUPLICADOS\n\n' +
        'Has asignado el mismo color a múltiples carreras.\n' +
        'Esto puede causar confusión para el coordinador.\n\n' +
        '¿Deseas continuar de todos modos?'
      );
      
      if (!confirmar) return;
    }

    const carreraActual = carrerasAsignadas.length > 0 ? carrerasAsignadas[0].carreraId : null;

    mostrarMensajeAsignacion('Guardando asignaciones...', 'info');

    await db.collection('usuarios').doc(coordinadorActual.uid).update({
      carreras: carrerasAsignadas,
      carreraActual: carreraActual,
      carreraId: carreraActual,
      fechaActualizacionCarreras: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('Asignaciones guardadas:', {
      coordinador: coordinadorActual.nombre,
      carreras: carrerasAsignadas.length,
      carreraActual: carreraActual
    });

    const nombresCarreras = carrerasAsignadas.map(c => {
      const carrera = carrerasData.find(ca => ca.id === c.carreraId);
      return carrera ? carrera.nombre : 'Desconocida';
    }).join(', ');

    mostrarMensajeAsignacion(
      `Asignaciones guardadas exitosamente!\n\n` +
      `Coordinador: ${coordinadorActual.nombre}\n` +
      `Carreras asignadas (${carrerasAsignadas.length}): ${nombresCarreras}\n\n` +
      `El coordinador ahora puede gestionar estas carreras desde su panel.`,
      'success'
    );

    setTimeout(() => {
      cerrarModalAsignarCarreras();
      gestionarCoordinadores();
    }, 2500);

  } catch (error) {
    console.error('Error al guardar:', error);
    mostrarMensajeAsignacion(
      `Error al guardar asignaciones\n\n` +
      `Detalle: ${error.message}\n\n` +
      `Por favor, intenta de nuevo o contacta al administrador del sistema.`,
      'error'
    );
  }
}

function mostrarMensajeAsignacion(texto, tipo) {
  const div = document.getElementById('mensajeAsignacion');
  if (!div) return;
  
  div.textContent = texto;
  div.style.display = 'block';
  div.style.whiteSpace = 'pre-line';
  div.style.padding = '18px';
  div.style.borderRadius = '10px';
  div.style.fontSize = '0.95rem';
  div.style.lineHeight = '1.6';
  div.style.fontWeight = '500';
  
  const colores = {
    info: { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
    success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#f44336', text: '#c62828' }
  };
  
  const color = colores[tipo] || colores.info;
  div.style.background = color.bg;
  div.style.color = color.text;
  div.style.borderLeft = `5px solid ${color.border}`;
  div.style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)';
}

function cerrarModalAsignarCarreras() {
  document.getElementById('modalAsignarCarreras').style.display = 'none';
  
  const mensajeDiv = document.getElementById('mensajeAsignacion');
  if (mensajeDiv) mensajeDiv.style.display = 'none';
  
  coordinadorActual = null;
}

window.addEventListener('click', (event) => {
  const modal = document.getElementById('modalAsignarCarreras');
  if (event.target === modal) {
    cerrarModalAsignarCarreras();
  }
});

console.log('Sistema multi-carrera para coordinadores cargado');