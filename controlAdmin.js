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
    mostrarMensaje("Creando coordinador...", "info");
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Usuario creado en Authentication. UID:", newUid);
    
    // Esperar un momento para que Firebase propague permisos
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log("Guardando en Firestore...");
    
    // NUEVO SISTEMA: Crear con array carreras y color por defecto
    await db.collection("usuarios").doc(newUid).set({
      nombre: nombre,
      email: email,
      rol: "coordinador",
      carreraId: carreraId,  // Mantener para compatibilidad
      carreras: [{  // NUEVO: Array de carreras
        carreraId: carreraId,
        color: "#43a047"  // Color verde por defecto
      }],
      carreraActual: carreraId,  // NUEVO: Carrera actualmente seleccionada
      esProfesor: true,
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("Guardado exitosamente en Firestore");
    
    // Verificar que se guardó
    const verificar = await db.collection("usuarios").doc(newUid).get();
    if (!verificar.exists) {
      throw new Error("El documento no se guardó en Firestore");
    }
    console.log("Documento verificado en Firestore");
    
    await auth.signOut();
    alert("Coordinador creado exitosamente\n\nNombre: " + nombre + "\nEmail: " + email + "\nPassword: " + password + "\n\nAhora inicia sesión de nuevo.");
    window.location.href = "login.html";
    
  } catch (error) {
    console.error("Error:", error);
    let mensaje = "Error: ";
    if (error.code === "auth/email-already-in-use") mensaje += "Email ya registrado";
    else if (error.code === "auth/invalid-email") mensaje += "Email inválido";
    else if (error.code === "permission-denied") mensaje += "Error de permisos. Actualiza reglas de Firestore";
    else mensaje += error.message;
    mostrarMensaje(mensaje, "error");
    setTimeout(async () => {
      await auth.signOut();
      window.location.href = "login.html";
    }, 3000);
  }
}

function mostrarMensaje(texto, tipo) {
  const div = document.getElementById('mensajeCoord');
  if (!div) return;
  div.textContent = texto;
  div.style.display = 'block';
  div.style.background = tipo === 'error' ? '#ffebee' : tipo === 'success' ? '#e8f5e9' : '#e3f2fd';
  div.style.color = tipo === 'error' ? '#c62828' : tipo === 'success' ? '#2e7d32' : '#1565c0';
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
    
    alert(`Carrera creada exitosamente\n\nCódigo: ${codigo}\nNombre: ${nombre}`);
    cerrarModalCarrera();
    
  } catch (error) {
    console.error('Error:', error);
    mostrarMensajeCarrera('Error al crear carrera', 'error');
  }
}

function mostrarMensajeCarrera(texto, tipo) {
  const div = document.getElementById('mensajeCarrera');
  div.textContent = texto;
  div.style.display = 'block';
  div.style.background = tipo === 'error' ? '#ffebee' : tipo === 'success' ? '#e8f5e9' : '#e3f2fd';
  div.style.color = tipo === 'error' ? '#c62828' : tipo === 'success' ? '#2e7d32' : '#1565c0';
}

// ===== CONTROL DE PERIODOS =====
async function mostrarControlPeriodos() {
  try {
    // Generar lista de periodos
    const periodos = [];
    for (let year = 2024; year <= 2030; year++) {
      periodos.push(`${year}-1`);
      periodos.push(`${year}-2`);
    }

    // Obtener periodo actual
    const periodoDoc = await db.collection('config').doc('periodoActual').get();
    const periodoActual = periodoDoc.exists ? periodoDoc.data().periodo : '2026-1';

    const periodosHtml = periodos.map(p => 
      `<option value="${p}" ${p === periodoActual ? 'selected' : ''}>${p}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'modalControlPeriodos';
    modal.style.cssText = 'display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; overflow-y: auto;';
    
    modal.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 20px; max-width: 600px; width: 90%; margin: 40px auto; box-shadow: 0 25px 80px rgba(0,0,0,0.4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
          <h2 style="margin: 0; color: #ff9800;">Control de Periodos (ADMIN)</h2>
          <button onclick="cerrarModalControlPeriodos()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999;">&times;</button>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Periodo Actual del Sistema</h3>
          <div style="font-size: 2rem; font-weight: bold; color: #216A32; margin: 10px 0;">${periodoActual}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600;">Selecciona nuevo periodo:</label>
          <select id="selectPeriodoAdmin" style="width: 100%; padding: 12px; border: 2px solid #ff9800; border-radius: 8px; font-size: 1.1rem;">
            ${periodosHtml}
          </select>
        </div>

        <div style="background: #ffebee; padding: 15px; border-radius: 8px; border-left: 4px solid #f44336; margin-bottom: 20px;">
          <strong>IMPORTANTE:</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Este cambio NO avanza alumnos automáticamente</li>
            <li>Los alumnos mantienen su periodo actual</li>
            <li>Solo cambia el periodo global del sistema</li>
            <li>Útil para pruebas y resetear el sistema</li>
          </ul>
        </div>

        <div style="display: flex; gap: 10px;">
          <button onclick="cambiarPeriodoAdmin()" 
            style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Cambiar Periodo (Sin Avanzar Alumnos)
          </button>
          <button onclick="cerrarModalControlPeriodos()" 
            style="flex: 1; padding: 12px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Cancelar
          </button>
        </div>

        <div id="mensajeControlPeriodo" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
      </div>
    `;

    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar control de periodos');
  }
}

async function cambiarPeriodoAdmin() {
  const nuevoPeriodo = document.getElementById('selectPeriodoAdmin').value;
  
  if (!nuevoPeriodo) {
    alert('Selecciona un periodo');
    return;
  }

  const password = prompt('Por seguridad, ingresa tu contraseña de administrador:');
  if (!password) {
    alert('Cambio cancelado');
    return;
  }

  try {
    // Verificar contraseña
    const user = firebase.auth().currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(credential);

    const confirmacion = confirm(
      `CONFIRMAR CAMBIO DE PERIODO (ADMIN)\n\n` +
      `Nuevo periodo: ${nuevoPeriodo}\n\n` +
      `IMPORTANTE:\n` +
      `- Solo cambia el periodo global\n` +
      `- NO avanza alumnos automáticamente\n` +
      `- Los alumnos mantienen su periodo actual\n` +
      `- Las asignaciones NO se desactivan\n\n` +
      `Esto es útil para:\n` +
      `- Resetear el sistema a 2026-1\n` +
      `- Hacer pruebas de desarrollo\n` +
      `- Volver a un periodo anterior\n\n` +
      `¿Continuar?`
    );

    if (!confirmacion) return;

    // Actualizar solo el periodo global
    await db.collection('config').doc('periodoActual').set({
      periodo: nuevoPeriodo,
      periodoAnterior: null,
      fechaCambio: firebase.firestore.FieldValue.serverTimestamp(),
      cambiadoPorAdmin: true,
      adminUid: user.uid
    }, { merge: true });

    alert(
      `Periodo cambiado exitosamente\n\n` +
      `Nuevo periodo: ${nuevoPeriodo}\n\n` +
      `IMPORTANTE:\n` +
      `- El sistema ahora usa el periodo ${nuevoPeriodo}\n` +
      `- Los alumnos NO se movieron\n` +
      `- Las asignaciones NO se desactivaron\n\n` +
      `La página se recargará.`
    );

    location.reload();

  } catch (error) {
    console.error('Error:', error);
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      alert('Contraseña incorrecta');
    } else {
      alert('Error: ' + error.message);
    }
  }
}

function cerrarModalControlPeriodos() {
  const modal = document.getElementById('modalControlPeriodos');
  if (modal) modal.remove();
}

// ===== CREAR CONTROL ESCOLAR =====
function mostrarModalControlEscolar() {
  document.getElementById('modalControlEscolar').style.display = 'flex';
}

function cerrarModalControlEscolar() {
  document.getElementById('modalControlEscolar').style.display = 'none';
  document.getElementById('formControlEscolar').reset();
  const mensajeDiv = document.getElementById('mensajeControl');
  if (mensajeDiv) mensajeDiv.style.display = 'none';
}

async function crearControlEscolar(event) {
  event.preventDefault();
  
  const nombre = document.getElementById("nombreControl").value.trim();
  const email = document.getElementById("emailControl").value.trim().toLowerCase();
  const password = document.getElementById("passControl").value;
  
  if (password.length < 6) {
    mostrarMensajeControl("La contraseña debe tener al menos 6 caracteres", "error");
    return;
  }
  
  try {
    mostrarMensajeControl("Creando Control Escolar...", "info");
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Usuario creado en Authentication. UID:", newUid);
    
    // Esperar un momento para que Firebase propague permisos
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log("Guardando en Firestore...");
    await db.collection("usuarios").doc(newUid).set({
      nombre: nombre,
      email: email,
      rol: "controlEscolar",
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("Guardado exitosamente en Firestore");
    
    // Verificar que se guardó
    const verificar = await db.collection("usuarios").doc(newUid).get();
    if (!verificar.exists) {
      throw new Error("El documento no se guardó en Firestore");
    }
    console.log("Documento verificado en Firestore");
    
    await auth.signOut();
    alert("Control Escolar creado exitosamente\n\nNombre: " + nombre + "\nEmail: " + email + "\nPassword: " + password + "\n\nAhora inicia sesión de nuevo.");
    window.location.href = "login.html";
    
  } catch (error) {
    console.error("Error:", error);
    let mensaje = "Error: ";
    if (error.code === "auth/email-already-in-use") mensaje += "Email ya registrado";
    else if (error.code === "auth/invalid-email") mensaje += "Email inválido";
    else if (error.code === "permission-denied") mensaje += "Error de permisos. Actualiza reglas de Firestore";
    else mensaje += error.message;
    mostrarMensajeControl(mensaje, "error");
    setTimeout(async () => {
      await auth.signOut();
      window.location.href = "login.html";
    }, 3000);
  }
}

function mostrarMensajeControl(texto, tipo) {
  const div = document.getElementById('mensajeControl');
  if (!div) return;
  div.textContent = texto;
  div.style.display = 'block';
  div.style.background = tipo === 'error' ? '#ffebee' : tipo === 'success' ? '#e8f5e9' : '#e3f2fd';
  div.style.color = tipo === 'error' ? '#c62828' : tipo === 'success' ? '#2e7d32' : '#1565c0';
}

// ============================================
// SISTEMA MULTI-CARRERA PARA COORDINADORES
// ============================================

async function gestionarCoordinadores() {
  try {
    console.log('Cargando gestión de coordinadores...');
    
    // Cargar coordinadores
    const coordSnap = await db.collection('usuarios')
      .where('rol', '==', 'coordinador')
      .orderBy('nombre')
      .get();
    
    coordinadoresData = [];
    coordSnap.forEach(doc => {
      coordinadoresData.push({
        uid: doc.id,
        ...doc.data()
      });
    });

    console.log(`${coordinadoresData.length} coordinadores cargados`);

    // Cargar carreras
    const carrerasSnap = await db.collection('carreras')
      .where('activa', '==', true)
      .get();
    
    carrerasData = [];
    carrerasSnap.forEach(doc => {
      carrerasData.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`${carrerasData.length} carreras cargadas`);

    mostrarListaCoordinadores();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar coordinadores: ' + error.message);
  }
}

function mostrarListaCoordinadores() {
  let html = `
    <div style="background: white; padding: 30px; border-radius: 15px; max-width: 1200px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea;">
        <h2 style="margin: 0; color: #667eea; font-size: 2rem;">Gestión de Coordinadores</h2>
        <button onclick="volverMenuAdmin()" 
          style="padding: 10px 20px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
          Volver al Menu
        </button>
      </div>

      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin-bottom: 25px; color: white;">
        <h3 style="margin: 0 0 10px 0; font-size: 1.3rem;">Instrucciones</h3>
        <ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">
          <li>Haz clic en "Asignar Carreras" para configurar qué carreras gestiona cada coordinador</li>
          <li>Asigna un <strong>color único</strong> a cada carrera para distinguirlas visualmente</li>
          <li>Los coordinadores verán el header de su panel en el color de la carrera activa</li>
          <li>Si un coordinador tiene múltiples carreras, podrá cambiar entre ellas desde su panel</li>
        </ul>
      </div>
  `;

  if (coordinadoresData.length === 0) {
    html += `
      <div style="text-align: center; padding: 80px 20px; background: #f9f9f9; border-radius: 10px;">
        <h3 style="color: #999; margin: 0 0 10px 0;">No hay coordinadores registrados</h3>
        <p style="color: #666;">Crea coordinadores desde el panel principal</p>
        <button onclick="volverMenuAdmin()" 
          style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Volver al Menu
        </button>
      </div>
    `;
  } else {
    html += '<div style="display: grid; gap: 15px;">';
    
    coordinadoresData.forEach(coord => {
      let carrerasHTML = '';
      let sistemaHTML = '';
      
      if (coord.carreras && Array.isArray(coord.carreras) && coord.carreras.length > 0) {
        // Sistema nuevo
        carrerasHTML = coord.carreras.map(c => {
          const carrera = carrerasData.find(ca => ca.id === c.carreraId);
          const nombreCarrera = carrera ? carrera.nombre : 'Carrera Eliminada';
          return `
            <div style="display: inline-flex; align-items: center; background: ${c.color}; color: white; padding: 6px 14px; border-radius: 20px; margin: 3px; font-size: 0.9rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              <span style="width: 10px; height: 10px; background: white; border-radius: 50%; margin-right: 8px;"></span>
              ${nombreCarrera}
            </div>
          `;
        }).join('');
        
        sistemaHTML = `
          <span style="background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
            Sistema Nuevo
          </span>
        `;
      } else if (coord.carreraId) {
        // Sistema antiguo
        const carrera = carrerasData.find(c => c.id === coord.carreraId);
        const nombreCarrera = carrera ? carrera.nombre : 'Carrera Eliminada';
        carrerasHTML = `
          <div style="display: inline-block; background: #e0e0e0; color: #555; padding: 6px 14px; border-radius: 20px; font-size: 0.9rem; font-weight: 500;">
            ${nombreCarrera}
          </div>
        `;
        
        sistemaHTML = `
          <span style="background: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
            Sistema Antiguo
          </span>
        `;
      } else {
        carrerasHTML = '<span style="color: #f44336; font-weight: 600;">Sin carreras asignadas</span>';
      }

      html += `
        <div style="background: white; border: 2px solid #e0e0e0; padding: 22px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <h3 style="margin: 0; color: #333; font-size: 1.3rem;">${coord.nombre}</h3>
              ${sistemaHTML}
            </div>
            
            <p style="margin: 0 0 12px 0; color: #666; font-size: 0.95rem;">
              ${coord.email}
            </p>
            
            <div style="margin-top: 12px;">
              <strong style="color: #555; font-size: 0.95rem; display: block; margin-bottom: 6px;">
                Carreras asignadas:
              </strong>
              <div style="margin-top: 6px;">
                ${carrerasHTML}
              </div>
            </div>
          </div>
          
          <div>
            <button onclick="abrirModalAsignarCarreras('${coord.uid}')" 
              style="padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1.05rem; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: all 0.3s;">
              Asignar Carreras
            </button>
          </div>
        </div>
      `;
    });

    html += '</div>';
  }

  html += '</div>';

  // Crear contenedor
  let container = document.getElementById('contenedorCoordinadores');
  if (!container) {
    container = document.createElement('div');
    container.id = 'contenedorCoordinadores';
    container.style.padding = '20px';
    document.body.appendChild(container);
  }

  container.innerHTML = html;
  
  // Ocultar menú principal
  const elementosOcultar = document.querySelectorAll('.header, .menu-opciones');
  elementosOcultar.forEach(el => {
    el.style.display = 'none';
  });
}

function volverMenuAdmin() {
  const container = document.getElementById('contenedorCoordinadores');
  if (container) container.remove();
  
  const elementosMostrar = document.querySelectorAll('.header, .menu-opciones');
  elementosMostrar.forEach(el => {
    el.style.display = '';
  });
}

async function abrirModalAsignarCarreras(coordinadorUid) {
  coordinadorActual = coordinadoresData.find(c => c.uid === coordinadorUid);
  
  if (!coordinadorActual) {
    alert('Coordinador no encontrado');
    return;
  }

  console.log('Abriendo modal para:', coordinadorActual.nombre);

  document.getElementById('nombreCoordActual').textContent = coordinadorActual.nombre;
  document.getElementById('emailCoordActual').textContent = coordinadorActual.email;

  const carrerasAsignadas = coordinadorActual.carreras || [];
  
  let html = '';
  
  if (carrerasData.length === 0) {
    html = `
      <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 8px; border: 2px dashed #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 600;">
          No hay carreras disponibles en el sistema
        </p>
        <p style="margin: 10px 0 0 0; color: #856404;">
          Crea carreras primero desde el panel principal
        </p>
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
      carreraId: carreraActual,  // Compatibilidad
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