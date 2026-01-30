const auth = firebase.auth();

// Variables globales para sistema multi-carrera
let coordinadoresData = [];
let carrerasData = [];
let coordinadorActual = null;

const COLORES_DISPONIBLES = [
  { hex: "#43a047", nombre: "Verde" },
  { hex: "#00796b", nombre: "Verde feo" },
  { hex: "#1976d2", nombre: "Azul" },
  { hex: "#0097a7", nombre: "Azul Claro" },
  { hex: "#303f9f", nombre: "Azul fuerte" },
  { hex: "#d32f2f", nombre: "Rojo" },
  { hex: "#f57c00", nombre: "Naranja" },
  { hex: "#e64a19", nombre: "Naranja Oscuro" },
  { hex: "#7b1fa2", nombre: "Púrpura" },
  { hex: "#c2185b", nombre: "Rosa" },
  { hex: "#5d4037", nombre: "Café" },
  { hex: "#f9a825", nombre: "Amarillo" }
];

// NUEVO: Tipos de periodos disponibles
const TIPOS_PERIODO = [
  { 
    valor: 2, 
    nombre: "Semestral (2 periodos por año)", 
    descripcion: "Ejemplo: 2026-1, 2026-2",
    ejemplo: "2026-1 → 2026-2 → 2027-1"
  },
  { 
    valor: 3, 
    nombre: "Cuatrimestral (3 periodos por año)", 
    descripcion: "Ejemplo: 2026-1, 2026-2, 2026-3",
    ejemplo: "2026-1 → 2026-2 → 2026-3 → 2027-1"
  },
  { 
    valor: 4, 
    nombre: "Trimestral (4 periodos por año)", 
    descripcion: "Ejemplo: 2026-1, 2026-2, 2026-3, 2026-4",
    ejemplo: "2026-1 → 2026-2 → 2026-3 → 2026-4 → 2027-1"
  }
];

// Proteger la página - solo admin
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No hay usuario autenticado');
    window.location.href = 'login.html';
    return;
  }

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

  document.getElementById('userName').textContent = userData.nombre;
  document.getElementById('userEmail').textContent = user.email;
  
  console.log('Dashboard de admin cargado');
});

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

// CREAR COORDINADOR
async function mostrarModalCoordinador() {
  document.getElementById('modalCoordinador').style.display = 'flex';
  
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
  
  // Validaciones
  if (!nombre) {
    mostrarMensaje("El nombre es obligatorio", "error");
    return;
  }
  
  if (!email) {
    mostrarMensaje("El email es obligatorio", "error");
    return;
  }
  
  if (!carreraId) {
    mostrarMensaje("Debes seleccionar una carrera", "error");
    return;
  }
  
  if (password.length < 6) {
    mostrarMensaje("La contraseña debe tener al menos 6 caracteres", "error");
    return;
  }
  
  console.log('Valores capturados:', {nombre, email, password: '***', carreraId});
  
  try {
    mostrarMensaje("Creando coordinador...", "info");
    
    // SOLUCION: Crear una segunda instancia de Firebase Auth
    // Esto permite crear el usuario sin cerrar la sesión del admin
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = secondaryApp.auth();
    
    // Crear usuario en la instancia secundaria
    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Usuario creado en Authentication:", newUid);
    
    // Buscar color de la carrera
    let colorCarrera = '#43a047'; // Color por defecto
    try {
      const carreraDoc = await db.collection('carreras').doc(carreraId).get();
      if (carreraDoc.exists && carreraDoc.data().color) {
        colorCarrera = carreraDoc.data().color;
      }
    } catch (error) {
      console.warn('Error al obtener color de carrera, usando default:', error);
    }
    
    // Preparar datos del usuario (asegurar que ningún campo sea undefined)
    const userData = {
      nombre: nombre || "",
      email: email || "",
      rol: "coordinador",
      roles: ["coordinador", "profesor"],
      carreraId: carreraId || "",
      carreras: [{
        carreraId: carreraId || "",
        color: colorCarrera || '#43a047'
      }],
      carreraActual: carreraId || "",
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('Guardando usuario con datos:', userData);
    
    // Guardar en Firestore usando la instancia principal
    await db.collection("usuarios").doc(newUid).set(userData);
    
    console.log("Guardado exitosamente en Firestore");
    
    // Verificar que se guardó
    const verificar = await db.collection("usuarios").doc(newUid).get();
    
    if (!verificar.exists) {
      throw new Error("El documento no se guardó en Firestore");
    }
    
    console.log("Documento verificado:", verificar.data());
    
    // Cerrar sesión de la instancia secundaria
    await secondaryAuth.signOut();
    
    // Eliminar la app secundaria
    await secondaryApp.delete();
    
    mostrarMensaje(
      "Coordinador creado exitosamente\n\n" +
      "Nombre: " + nombre + "\n" +
      "Email: " + email + "\n" +
      "Password: " + password + "\n\n" +
      "El coordinador ya puede iniciar sesión",
      "success"
    );
    
    document.getElementById('formCoordinador').reset();
    
    setTimeout(() => {
      cerrarModalCoordinador();
    }, 3000);
    
  } catch (error) {
    console.error("Error completo:", error);
    
    let mensaje = "Error: ";
    
    if (error.code === "auth/email-already-in-use") {
      mensaje += "Este email ya está registrado";
    } else if (error.code === "auth/invalid-email") {
      mensaje += "Email inválido";
    } else if (error.code === "auth/weak-password") {
      mensaje += "La contraseña es muy débil";
    } else if (error.code === "permission-denied") {
      mensaje += "Error de permisos en Firestore";
    } else {
      mensaje += error.message;
    }
    
    mostrarMensaje(mensaje, "error");
  }
}

function mostrarMensaje(texto, tipo) {
  const mensajeDiv = document.getElementById("mensajeCoord");
  if (!mensajeDiv) return;
  
  mensajeDiv.style.display = "block";
  mensajeDiv.textContent = texto;
  mensajeDiv.style.whiteSpace = "pre-line";
  mensajeDiv.style.padding = "15px";
  mensajeDiv.style.borderRadius = "8px";
  mensajeDiv.style.fontWeight = "500";
  
  if (tipo === "error") {
    mensajeDiv.style.background = "#fee";
    mensajeDiv.style.color = "#c00";
    mensajeDiv.style.border = "2px solid #fcc";
  } else if (tipo === "success") {
    mensajeDiv.style.background = "#efe";
    mensajeDiv.style.color = "#060";
    mensajeDiv.style.border = "2px solid #cfc";
  } else {
    mensajeDiv.style.background = "#e3f2fd";
    mensajeDiv.style.color = "#0d47a1";
    mensajeDiv.style.border = "2px solid #90caf9";
  }
}

// CREAR CONTROL ESCOLAR
async function mostrarModalControlEscolar() {
  document.getElementById('modalControlEscolar').style.display = 'flex';
}

function cerrarModalControlEscolar() {
  document.getElementById('modalControlEscolar').style.display = 'none';
  document.getElementById('formControlEscolar').reset();
  const mensaje = document.getElementById('mensajeControl');
  if (mensaje) mensaje.style.display = 'none';
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
    mostrarMensajeControl("Creando usuario de control escolar...", "info");
    
    // Usar instancia secundaria
    const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryControl");
    const secondaryAuth = secondaryApp.auth();
    
    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Control escolar creado:", newUid);
    
    await db.collection("usuarios").doc(newUid).set({
      nombre: nombre,
      email: email,
      rol: "controlEscolar",
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("Guardado en Firestore");
    
    await secondaryAuth.signOut();
    await secondaryApp.delete();
    
    mostrarMensajeControl(
      "Control Escolar creado exitosamente\n\n" +
      "Nombre: " + nombre + "\n" +
      "Email: " + email + "\n" +
      "Password: " + password,
      "success"
    );
    
    document.getElementById('formControlEscolar').reset();
    
    setTimeout(() => {
      cerrarModalControlEscolar();
    }, 3000);
    
  } catch (error) {
    console.error("Error:", error);
    
    let mensaje = "Error: ";
    
    if (error.code === "auth/email-already-in-use") {
      mensaje += "Este email ya está registrado";
    } else if (error.code === "auth/invalid-email") {
      mensaje += "Email inválido";
    } else {
      mensaje += error.message;
    }
    
    mostrarMensajeControl(mensaje, "error");
  }
}

function mostrarMensajeControl(texto, tipo) {
  const mensajeDiv = document.getElementById("mensajeControl");
  if (!mensajeDiv) return;
  
  mensajeDiv.style.display = "block";
  mensajeDiv.textContent = texto;
  mensajeDiv.style.whiteSpace = "pre-line";
  mensajeDiv.style.padding = "15px";
  mensajeDiv.style.borderRadius = "8px";
  mensajeDiv.style.fontWeight = "500";
  
  if (tipo === "error") {
    mensajeDiv.style.background = "#fee";
    mensajeDiv.style.color = "#c00";
    mensajeDiv.style.border = "2px solid #fcc";
  } else if (tipo === "success") {
    mensajeDiv.style.background = "#efe";
    mensajeDiv.style.color = "#060";
    mensajeDiv.style.border = "2px solid #cfc";
  } else {
    mensajeDiv.style.background = "#e3f2fd";
    mensajeDiv.style.color = "#0d47a1";
    mensajeDiv.style.border = "2px solid #90caf9";
  }
}

// ========================================
// CREAR CARRERA - MODIFICADO CON TIPO DE PERIODO
// ========================================
async function mostrarModalCarrera() {
  // Limpiar formulario primero
  const form = document.getElementById('formCarrera');
  if (form) form.reset();
  
  // Ocultar mensaje
  const mensaje = document.getElementById('mensajeCarrera');
  if (mensaje) mensaje.style.display = 'none';
  
  // Agregar campo de tipo de periodo DESPUÉS del campo de descripción
  const descripcionDiv = document.querySelector('#descripcionCarrera').parentElement;
  
  // Verificar si ya existe el div de tipo de periodo
  let tipoPeriodoDiv = document.getElementById('divTipoPeriodo');
  
  if (!tipoPeriodoDiv) {
    // Crear div para tipo de periodo
    tipoPeriodoDiv = document.createElement('div');
    tipoPeriodoDiv.id = 'divTipoPeriodo';
    tipoPeriodoDiv.style.marginBottom = '20px';
    
    let html = `
      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
        Tipo de Periodo Académico: <span style="color: red;">*</span>
      </label>
      

    `;
    
    TIPOS_PERIODO.forEach(tipo => {
      html += `
        <div class="periodo-opcion" 
             onclick="seleccionarTipoPeriodo(${tipo.valor})" 
             id="tipoPeriodo_${tipo.valor}"
             style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 2px solid #e0e0e0; margin-bottom: 10px; cursor: pointer; transition: all 0.3s;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="radio" name="tipoPeriodo" value="${tipo.valor}" id="radio_${tipo.valor}" 
                   style="width: 18px; height: 18px; cursor: pointer; margin: 0;">
            <div style="flex: 1;">
              <strong style="display: block; color: #333; font-size: 0.95rem; margin-bottom: 3px;">${tipo.nombre}</strong>
              <div style="font-size: 0.8rem; color: #666;">${tipo.descripcion}</div>
              <div style="font-size: 0.75rem; color: #999; margin-top: 3px;">
                <strong>Flujo:</strong> ${tipo.ejemplo}
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    tipoPeriodoDiv.innerHTML = html;
    
    // Insertar después de descripción
    descripcionDiv.parentNode.insertBefore(tipoPeriodoDiv, descripcionDiv.nextSibling);
  }
  
  // Mostrar modal
  document.getElementById('modalCarrera').style.display = 'flex';
}

// NUEVA FUNCIÓN: Seleccionar tipo de periodo visualmente
function seleccionarTipoPeriodo(valor) {
  // Desmarcar todos
  document.querySelectorAll('[id^="tipoPeriodo_"]').forEach(el => {
    el.style.borderColor = '#e0e0e0';
    el.style.background = '#f8f9fa';
  });
  
  // Desmarcar todos los radios
  document.querySelectorAll('[name="tipoPeriodo"]').forEach(radio => {
    radio.checked = false;
  });
  
  // Marcar el seleccionado
  const elemento = document.getElementById(`tipoPeriodo_${valor}`);
  if (elemento) {
    elemento.style.borderColor = '#667eea';
    elemento.style.background = '#f0f4ff';
  }
  
  const radio = document.getElementById(`radio_${valor}`);
  if (radio) {
    radio.checked = true;
  }
}

function cerrarModalCarrera() {
  document.getElementById('modalCarrera').style.display = 'none';
  
  // Limpiar formulario
  const form = document.getElementById('formCarrera');
  if (form) form.reset();
  
  // Limpiar selección de tipo de periodo
  document.querySelectorAll('[id^="tipoPeriodo_"]').forEach(el => {
    el.style.borderColor = '#e0e0e0';
    el.style.background = '#f8f9fa';
  });
  
  const mensaje = document.getElementById('mensajeCarrera');
  if (mensaje) mensaje.style.display = 'none';
}

async function crearCarrera(event) {
  event.preventDefault();
  
  const codigo = document.getElementById("codigoCarrera").value.trim().toUpperCase();
  const nombre = document.getElementById("nombreCarrera").value.trim();
  const descripcion = document.getElementById("descripcionCarrera").value.trim();
  
  // NUEVO: Obtener tipo de periodo seleccionado
  const tipoPeriodoRadio = document.querySelector('[name="tipoPeriodo"]:checked');
  
  if (!tipoPeriodoRadio) {
    mostrarMensajeCarrera("Debes seleccionar un tipo de periodo académico", "error");
    return;
  }
  
  const periodosAnio = parseInt(tipoPeriodoRadio.value);
  
  try {
    mostrarMensajeCarrera("Creando carrera...", "info");
    
    // Verificar que el código no exista
    const existente = await db.collection('carreras')
      .where('codigo', '==', codigo)
      .get();
    
    if (!existente.empty) {
      mostrarMensajeCarrera("Ya existe una carrera con el código " + codigo, "error");
      return;
    }
    
    // Obtener el nombre del tipo de periodo
    const tipoInfo = TIPOS_PERIODO.find(t => t.valor === periodosAnio);
    const tipoNombre = tipoInfo ? tipoInfo.nombre : 'Semestral';
    
    // MODIFICADO: Agregar campo periodosAnio
    await db.collection('carreras').doc(codigo).set({
      codigo: codigo,
      nombre: nombre,
      descripcion: descripcion,
      activa: true,
      periodosAnio: periodosAnio, // NUEVO CAMPO
      tipoPeriodoNombre: tipoNombre, // NUEVO CAMPO (descripción legible)
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("Carrera creada:", codigo, "con", periodosAnio, "periodos por año");
    
    mostrarMensajeCarrera(
      "Carrera creada exitosamente\n\n" +
      "Código: " + codigo + "\n" +
      "Nombre: " + nombre + "\n" +
      "Tipo: " + tipoNombre,
      "success"
    );
    
    setTimeout(() => {
      cerrarModalCarrera();
    }, 2500);
    
  } catch (error) {
    console.error("Error:", error);
    mostrarMensajeCarrera("Error al crear carrera: " + error.message, "error");
  }
}

function mostrarMensajeCarrera(texto, tipo) {
  const mensajeDiv = document.getElementById("mensajeCarrera");
  if (!mensajeDiv) return;
  
  mensajeDiv.style.display = "block";
  mensajeDiv.textContent = texto;
  mensajeDiv.style.whiteSpace = "pre-line";
  mensajeDiv.style.padding = "15px";
  mensajeDiv.style.borderRadius = "8px";
  mensajeDiv.style.fontWeight = "500";
  
  if (tipo === "error") {
    mensajeDiv.style.background = "#fee";
    mensajeDiv.style.color = "#c00";
    mensajeDiv.style.border = "2px solid #fcc";
  } else if (tipo === "success") {
    mensajeDiv.style.background = "#efe";
    mensajeDiv.style.color = "#060";
    mensajeDiv.style.border = "2px solid #cfc";
  } else {
    mensajeDiv.style.background = "#e3f2fd";
    mensajeDiv.style.color = "#0d47a1";
    mensajeDiv.style.border = "2px solid #90caf9";
  }
}

// GESTIONAR COORDINADORES
async function gestionarCoordinadores() {
  try {
    // Cargar coordinadores
    const coordSnap = await db.collection('usuarios')
      .where('rol', '==', 'coordinador')
      .get();
    
    coordinadoresData = [];
    coordSnap.forEach(doc => {
      coordinadoresData.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    
    // Cargar carreras
    const carrerasSnap = await db.collection('carreras').get();
    carrerasData = [];
    carrerasSnap.forEach(doc => {
      carrerasData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log('Coordinadores:', coordinadoresData.length);
    console.log('Carreras:', carrerasData.length);
    
    mostrarListaCoordinadores();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar datos: ' + error.message);
  }
}

function mostrarListaCoordinadores() {
  if (coordinadoresData.length === 0) {
    alert('No hay coordinadores registrados. Crea uno primero.');
    return;
  }
  
  let html = '<div style="background: white; padding: 30px; border-radius: 15px; max-width: 900px; margin: 20px auto;">';
  html += '<h2 style="color: #667eea; margin-bottom: 25px;">Coordinadores Registrados</h2>';
  
  coordinadoresData.forEach(coord => {
    const carrerasAsignadas = coord.carreras || [];
    const numCarreras = carrerasAsignadas.length;
    
    html += '<div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin-bottom: 15px; border-left: 5px solid #667eea;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
    html += '<div>';
    html += '<h3 style="margin: 0 0 10px 0; color: #333;">' + coord.nombre + '</h3>';
    html += '<p style="margin: 0; color: #666;">' + coord.email + '</p>';
    html += '<p style="margin: 5px 0 0 0; color: #999; font-size: 0.9rem;">Carreras asignadas: ' + numCarreras + '</p>';
    html += '</div>';
    html += '<button onclick="asignarCarreras(\'' + coord.uid + '\')" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Asignar Carreras</button>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '<button onclick="cerrarListaCoordinadores()" style="padding: 12px 24px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 20px;">Cerrar</button>';
  html += '</div>';
  
  const overlay = document.createElement('div');
  overlay.id = 'overlayCoordinadores';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1500; overflow-y: auto;';
  overlay.innerHTML = html;
  
  document.body.appendChild(overlay);
}

function cerrarListaCoordinadores() {
  const overlay = document.getElementById('overlayCoordinadores');
  if (overlay) overlay.remove();
}

async function asignarCarreras(coordUid) {
  coordinadorActual = coordinadoresData.find(c => c.uid === coordUid);
  
  if (!coordinadorActual) {
    alert('Error: Coordinador no encontrado');
    return;
  }
  
  document.getElementById('nombreCoordActual').textContent = coordinadorActual.nombre;
  document.getElementById('emailCoordActual').textContent = coordinadorActual.email;
  
  const carrerasAsignadas = coordinadorActual.carreras || [];
  
  let html = '';
  
  if (carrerasData.length === 0) {
    html = '<div style="text-align: center; padding: 40px; color: #999;">No hay carreras disponibles. Crea carreras primero.</div>';
  } else {
    carrerasData.forEach(carrera => {
      const asignacion = carrerasAsignadas.find(c => c.carreraId === carrera.id);
      const estaAsignada = !!asignacion;
      const colorActual = asignacion ? asignacion.color : COLORES_DISPONIBLES[0].hex;

      html += '<div class="carrera-item" style="background: ' + (estaAsignada ? 'linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%)' : '#f9f9f9') + '; padding: 18px; border-radius: 10px; margin-bottom: 12px; border: 2px solid ' + (estaAsignada ? '#667eea' : '#ddd') + '; transition: all 0.3s;">';
      html += '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">';
      
      html += '<div style="display: flex; align-items: center; flex: 1; min-width: 200px;">';
      html += '<input type="checkbox" id="carrera_' + carrera.id + '" ' + (estaAsignada ? 'checked' : '') + ' onchange="toggleCarreraAsignacion(\'' + carrera.id + '\')" style="width: 22px; height: 22px; margin-right: 15px; cursor: pointer; accent-color: #667eea;">';
      html += '<label for="carrera_' + carrera.id + '" style="cursor: pointer; font-weight: 600; font-size: 1.1rem; color: #333;">' + carrera.nombre + '</label>';
      html += '</div>';
      
      html += '<div id="colorSelector_' + carrera.id + '" style="display: ' + (estaAsignada ? 'flex' : 'none') + '; align-items: center; gap: 12px; background: white; padding: 10px 15px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">';
      html += '<span style="font-size: 0.95rem; color: #666; font-weight: 600;">Color:</span>';
      html += '<select id="colorCarrera_' + carrera.id + '" onchange="actualizarVistaPrevia(\'' + carrera.id + '\')" style="padding: 8px 14px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; cursor: pointer; background: white; font-weight: 500; min-width: 160px;">';
      
      COLORES_DISPONIBLES.forEach(color => {
        html += '<option value="' + color.hex + '" ' + (color.hex === colorActual ? 'selected' : '') + '>' + color.nombre + '</option>';
      });
      
      html += '</select>';
      html += '<div id="preview_' + carrera.id + '" style="width: 45px; height: 45px; border-radius: 10px; background: ' + colorActual + '; border: 4px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.25); transition: all 0.3s; cursor: pointer;"></div>';
      html += '</div>';
      
      html += '</div>';
      html += '</div>';
    });
  }

  document.getElementById('listaCarrerasAsignar').innerHTML = html;
  document.getElementById('modalAsignarCarreras').style.display = 'flex';
}

function toggleCarreraAsignacion(carreraId) {
  const checkbox = document.getElementById('carrera_' + carreraId);
  const colorSelector = document.getElementById('colorSelector_' + carreraId);
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
  const select = document.getElementById('colorCarrera_' + carreraId);
  const preview = document.getElementById('preview_' + carreraId);
  
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
      const checkbox = document.getElementById('carrera_' + carrera.id);
      if (checkbox && checkbox.checked) {
        const colorSelect = document.getElementById('colorCarrera_' + carrera.id);
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
      'Asignaciones guardadas exitosamente\n\n' +
      'Coordinador: ' + coordinadorActual.nombre + '\n' +
      'Carreras asignadas (' + carrerasAsignadas.length + '): ' + nombresCarreras + '\n\n' +
      'El coordinador ahora puede gestionar estas carreras desde su panel.',
      'success'
    );

    setTimeout(() => {
      cerrarModalAsignarCarreras();
      gestionarCoordinadores();
    }, 2500);

  } catch (error) {
    console.error('Error al guardar:', error);
    mostrarMensajeAsignacion(
      'Error al guardar asignaciones\n\n' +
      'Detalle: ' + error.message + '\n\n' +
      'Por favor, intenta de nuevo o contacta al administrador del sistema.',
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
  div.style.borderLeft = '5px solid ' + color.border;
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

console.log('Sistema multi-carrera para coordinadores cargado con soporte para periodos configurables');