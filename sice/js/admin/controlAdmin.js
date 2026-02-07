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
  { hex: "#7b1fa2", nombre: "Purpura" },
  { hex: "#c2185b", nombre: "Rosa" },
  { hex: "#5d4037", nombre: "Cafe" },
  { hex: "#f9a825", nombre: "Amarillo" }
];

// TIPOS DE PERIODO ACADEMICO
const TIPOS_PERIODO = [
  { 
    valor: 'semestral',
    periodosAnio: 2,
    nombre: "Semestral (2 periodos por año)", 
    descripcion: "Ejemplo: 2026-1, 2026-2",
    ejemplo: "2026-1 → 2026-2 → 2027-1"
  },
  { 
    valor: 'cuatrimestral',
    periodosAnio: 3,
    nombre: "Cuatrimestral (3 periodos por año)", 
    descripcion: "Ejemplo: 2026-1, 2026-2, 2026-3",
    ejemplo: "2026-1 → 2026-2 → 2026-3 → 2027-1"
  },
  { 
    valor: 'trimestral',
    periodosAnio: 4,
    nombre: "Trimestral (4 periodos por año)", 
    descripcion: "Ejemplo: 2026-1, 2026-2, 2026-3, 2026-4",
    ejemplo: "2026-1 → 2026-2 → 2026-3 → 2026-4 → 2027-1"
  }
];

// Proteger la pagina - solo admin
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No hay usuario autenticado');
    window.location.href = 'https://ilbcontrol.mx/sice/';
    return;
  }

  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  
  if (!userDoc.exists) {
    console.log('Usuario no encontrado en Firestore');
    await auth.signOut();
    window.location.href = 'https://ilbcontrol.mx/sice/';
    return;
  }

  const userData = userDoc.data();

  if (userData.rol !== 'admin') {
    console.log('No tienes permisos de administrador');
    alert('No tienes permisos para acceder a esta pagina');
    window.location.href = 'https://ilbcontrol.mx/sice/';
    return;
  }

  document.getElementById('userName').textContent = userData.nombre;
  document.getElementById('userEmail').textContent = user.email;
  
  console.log('Dashboard de admin cargado');
});

async function cerrarSesion() {
  if (confirm('Estas seguro de cerrar sesion?')) {
    try {
      await auth.signOut();
      sessionStorage.clear();
      window.location.href = 'https://ilbcontrol.mx/sice/';
    } catch (error) {
      console.error('Error al cerrar sesion:', error);
      alert('Error al cerrar sesion');
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
  
  // Academia opcional
  const tieneAcademia = document.getElementById("tieneAcademia").checked;
  const academiaNombre = tieneAcademia ? document.getElementById("academiaNombre").value.trim() : null;
  const academiaId = tieneAcademia ? document.getElementById("academiaId").value.trim().toUpperCase() : null;
  
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
    mostrarMensaje("La contrasena debe tener al menos 6 caracteres", "error");
    return;
  }
  
  // Validar academia si está activada
  if (tieneAcademia) {
    if (!academiaNombre) {
      mostrarMensaje("Debes proporcionar el nombre de la academia", "error");
      return;
    }
    if (!academiaId) {
      mostrarMensaje("Debes proporcionar el ID de la academia", "error");
      return;
    }
    
    // Validar que el ID de academia sea único
    try {
      const academiaExiste = await db.collection('usuarios')
        .where('academiaId', '==', academiaId)
        .get();
      
      if (!academiaExiste.empty) {
        mostrarMensaje("El ID de academia '" + academiaId + "' ya está en uso. Usa otro código.", "error");
        return;
      }
    } catch (error) {
      console.error('Error al verificar academia:', error);
    }
  }
  
  console.log('Valores capturados:', {nombre, email, password: '***', carreraId, tieneAcademia, academiaNombre, academiaId});
  
  try {
    mostrarMensaje("Creando coordinador...", "info");
    
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = secondaryApp.auth();
    
    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Usuario creado en Authentication:", newUid);
    
    let colorCarrera = '#43a047';
    try {
      const carreraDoc = await db.collection('carreras').doc(carreraId).get();
      if (carreraDoc.exists && carreraDoc.data().color) {
        colorCarrera = carreraDoc.data().color;
      }
    } catch (error) {
      console.warn('Error al obtener color de carrera, usando default:', error);
    }
    
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
    
    // Agregar campos de academia si aplica
    if (tieneAcademia) {
      userData.tieneAcademia = true;
      userData.academiaNombre = academiaNombre;
      userData.academiaId = academiaId;
    }
    
    console.log('Guardando usuario con datos:', userData);
    
    await db.collection("usuarios").doc(newUid).set(userData);
    
    console.log("Guardado exitosamente en Firestore");
    
    const verificar = await db.collection("usuarios").doc(newUid).get();
    
    if (!verificar.exists) {
      throw new Error("El documento no se guardo en Firestore");
    }
    
    console.log("Documento verificado:", verificar.data());
    
    await secondaryAuth.signOut();
    await secondaryApp.delete();
    
    let mensaje = "Coordinador creado exitosamente\n\n" +
      "Nombre: " + nombre + "\n" +
      "Email: " + email + "\n" +
      "Password: " + password + "\n" +
      "Carrera: " + carreraId + "\n";
    
    if (tieneAcademia) {
      mensaje += "\nAcademia: " + academiaNombre + "\n" +
        "ID Academia: " + academiaId + "\n" +
        "Este coordinador puede ver materias transversales en modo academia.";
    }
    
    mensaje += "\n\nEl coordinador ya puede iniciar sesion";
    
    mostrarMensaje(mensaje, "success");
    
    document.getElementById('formCoordinador').reset();
    document.getElementById('camposAcademia').style.display = 'none';
    
    setTimeout(() => {
      cerrarModalCoordinador();
    }, 4000);
    
  } catch (error) {
    console.error("Error completo:", error);
    
    let mensaje = "Error: ";
    
    if (error.code === "auth/email-already-in-use") {
      mensaje += "Este email ya esta registrado";
    } else if (error.code === "auth/invalid-email") {
      mensaje += "Email invalido";
    } else if (error.code === "auth/weak-password") {
      mensaje += "Contrasena muy debil";
    } else {
      mensaje += error.message;
    }
    
    mostrarMensaje(mensaje, "error");
  }
}

// Toggle campos de academia
function toggleCamposAcademia() {
  const checkbox = document.getElementById('tieneAcademia');
  const campos = document.getElementById('camposAcademia');
  
  if (checkbox.checked) {
    campos.style.display = 'block';
    document.getElementById('academiaNombre').required = true;
    document.getElementById('academiaId').required = true;
  } else {
    campos.style.display = 'none';
    document.getElementById('academiaNombre').required = false;
    document.getElementById('academiaId').required = false;
    document.getElementById('academiaNombre').value = '';
    document.getElementById('academiaId').value = '';
  }
}

function mostrarMensaje(texto, tipo) {
  const mensaje = document.getElementById('mensajeCoord');
  if (!mensaje) return;
  
  mensaje.textContent = texto;
  mensaje.style.display = 'block';
  
  if (tipo === 'success') {
    mensaje.style.background = '#d4edda';
    mensaje.style.color = '#155724';
    mensaje.style.border = '2px solid #c3e6cb';
  } else if (tipo === 'error') {
    mensaje.style.background = '#f8d7da';
    mensaje.style.color = '#721c24';
    mensaje.style.border = '2px solid #f5c6cb';
  } else {
    mensaje.style.background = '#d1ecf1';
    mensaje.style.color = '#0c5460';
    mensaje.style.border = '2px solid #bee5eb';
  }
}

// CREAR CONTROL ESCOLAR
function mostrarModalControlEscolar() {
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
  
  if (!nombre || !email) {
    mostrarMensajeControl("Todos los campos son obligatorios", "error");
    return;
  }
  
  if (password.length < 6) {
    mostrarMensajeControl("La contrasena debe tener al menos 6 caracteres", "error");
    return;
  }
  
  try {
    mostrarMensajeControl("Creando personal de control escolar...", "info");
    
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = secondaryApp.auth();
    
    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    
    await db.collection("usuarios").doc(newUid).set({
      nombre: nombre,
      email: email,
      rol: "controlEscolar",
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await secondaryAuth.signOut();
    await secondaryApp.delete();
    
    mostrarMensajeControl(
      "Control Escolar creado exitosamente\n\n" +
      "Nombre: " + nombre + "\n" +
      "Email: " + email + "\n" +
      "Password: " + password + "\n\n" +
      "Ya puede iniciar sesion",
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
      mensaje += "Este email ya esta registrado";
    } else if (error.code === "auth/invalid-email") {
      mensaje += "Email invalido";
    } else {
      mensaje += error.message;
    }
    
    mostrarMensajeControl(mensaje, "error");
  }
}

function mostrarMensajeControl(texto, tipo) {
  const mensaje = document.getElementById('mensajeControl');
  if (!mensaje) return;
  
  mensaje.textContent = texto;
  mensaje.style.display = 'block';
  
  if (tipo === 'success') {
    mensaje.style.background = '#d4edda';
    mensaje.style.color = '#155724';
    mensaje.style.border = '2px solid #c3e6cb';
  } else if (tipo === 'error') {
    mensaje.style.background = '#f8d7da';
    mensaje.style.color = '#721c24';
    mensaje.style.border = '2px solid #f5c6cb';
  } else {
    mensaje.style.background = '#d1ecf1';
    mensaje.style.color = '#0c5460';
    mensaje.style.border = '2px solid #bee5eb';
  }
}

// CREAR CARRERA CON MODAL SELECTOR DE PERIODOS
function mostrarModalCarrera() {
  // Limpiar el modal
  document.getElementById('formCarrera').reset();
  
  // Crear HTML del selector de tipo de periodo
  const selectorHTML = `
    <div style="margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
      <label style="display: block; margin-bottom: 15px; font-weight: 700; color: #333; font-size: 1.1rem;">
        Tipo de Periodo Académico:
      </label>
      ${TIPOS_PERIODO.map(tipo => `
        <label style="display: block; margin-bottom: 15px; cursor: pointer; padding: 15px; background: white; border: 2px solid #ddd; border-radius: 8px; transition: all 0.3s;" 
               onmouseover="this.style.borderColor='#667eea'; this.style.background='#f0f7ff';" 
               onmouseout="if(!this.querySelector('input').checked) { this.style.borderColor='#ddd'; this.style.background='white'; }">
          <input type="radio" name="tipoPeriodo" value="${tipo.valor}" 
                 style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer; accent-color: #667eea;"
                 onchange="document.querySelectorAll('label').forEach(l => { if(l.querySelector('input[name=tipoPeriodo]')) { l.style.borderColor='#ddd'; l.style.background='white'; }}); this.parentElement.style.borderColor='#667eea'; this.parentElement.style.background='#f0f7ff';">
          <strong style="font-size: 1rem;">${tipo.nombre}</strong>
          <div style="margin-top: 5px; color: #666; font-size: 0.9rem;">
            ${tipo.descripcion}
          </div>
          <div style="margin-top: 3px; color: #999; font-size: 0.85rem; font-style: italic;">
            ${tipo.ejemplo}
          </div>
        </label>
      `).join('')}
    </div>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Número de Semestres/Periodos de la Carrera:</label>
      <input type="number" id="numeroPeriodos" required placeholder="Ej: 6, 8, 10" min="1" max="20"
             style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem;">
      <small style="color: #666;">Número total de semestres/periodos que dura la carrera</small>
    </div>
  `;
  
  // Insertar después del campo descripción
  const descripcionDiv = document.getElementById('descripcionCarrera').parentElement;
  if (!document.getElementById('selectorTipoPeriodo')) {
    descripcionDiv.insertAdjacentHTML('afterend', selectorHTML);
  }
  
  document.getElementById('modalCarrera').style.display = 'flex';
}

function cerrarModalCarrera() {
  document.getElementById('modalCarrera').style.display = 'none';
  document.getElementById('formCarrera').reset();
  const mensaje = document.getElementById('mensajeCarrera');
  if (mensaje) mensaje.style.display = 'none';
  
  // Remover el selector de tipo de periodo
  const selector = document.getElementById('selectorTipoPeriodo');
  if (selector) selector.remove();
}

async function crearCarrera(event) {
  event.preventDefault();
  
  const codigo = document.getElementById("codigoCarrera").value.trim().toUpperCase();
  const nombre = document.getElementById("nombreCarrera").value.trim();
  const descripcion = document.getElementById("descripcionCarrera").value.trim();
  const numeroPeriodos = parseInt(document.getElementById("numeroPeriodos").value);
  
  // Obtener el tipo de periodo seleccionado
  const tipoSeleccionado = document.querySelector('input[name="tipoPeriodo"]:checked');
  
  if (!tipoSeleccionado) {
    mostrarMensajeCarrera("Debes seleccionar un tipo de periodo académico", "error");
    return;
  }
  
  if (!codigo || !nombre) {
    mostrarMensajeCarrera("El código y nombre son obligatorios", "error");
    return;
  }
  
  if (!numeroPeriodos || numeroPeriodos < 1 || numeroPeriodos > 20) {
    mostrarMensajeCarrera("El número de periodos debe estar entre 1 y 20", "error");
    return;
  }
  
  const tipoPeriodo = TIPOS_PERIODO.find(t => t.valor === tipoSeleccionado.value);
  
  try {
    mostrarMensajeCarrera("Creando carrera y generando matriz de grupos...", "info");
    
    // Verificar si ya existe el código
    const existeSnap = await db.collection('carreras').where('codigo', '==', codigo).get();
    if (!existeSnap.empty) {
      mostrarMensajeCarrera("Ya existe una carrera con ese código", "error");
      return;
    }
    
    // Crear documento de carrera con ID = codigo
    const carreraData = {
      codigo: codigo,
      nombre: nombre,
      descripcion: descripcion || "",
      numeroPeriodos: numeroPeriodos,
      tipoPeriodo: tipoPeriodo.valor,
      periodosAnio: tipoPeriodo.periodosAnio,
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('carreras').doc(codigo).set(carreraData);
    console.log('Carrera creada con ID:', codigo);
    
    // **CAMBIO PRINCIPAL: Generar matriz bidimensional de grupos**
    await generarMatrizGrupos(codigo, numeroPeriodos);
    
    mostrarMensajeCarrera(
      `Carrera creada exitosamente\n\n` +
      `Código: ${codigo}\n` +
      `Nombre: ${nombre}\n` +
      `Tipo: ${tipoPeriodo.nombre}\n` +
      `Periodos: ${numeroPeriodos}\n\n` +
      `Matriz de grupos generada: ${numeroPeriodos} × 4 turnos`,
      "success"
    );
    
    document.getElementById('formCarrera').reset();
    
    setTimeout(() => {
      cerrarModalCarrera();
    }, 3000);
    
  } catch (error) {
    console.error("Error:", error);
    mostrarMensajeCarrera("Error al crear carrera: " + error.message, "error");
  }
}

function mostrarMensajeCarrera(texto, tipo) {
  const mensaje = document.getElementById('mensajeCarrera');
  if (!mensaje) return;
  
  mensaje.textContent = texto;
  mensaje.style.display = 'block';
  
  if (tipo === 'success') {
    mensaje.style.background = '#d4edda';
    mensaje.style.color = '#155724';
    mensaje.style.border = '2px solid #c3e6cb';
  } else if (tipo === 'error') {
    mensaje.style.background = '#f8d7da';
    mensaje.style.color = '#721c24';
    mensaje.style.border = '2px solid #f5c6cb';
  } else {
    mensaje.style.background = '#d1ecf1';
    mensaje.style.color = '#0c5460';
    mensaje.style.border = '2px solid #bee5eb';
  }
}

// FUNCIONES PARA GESTIONAR COORDINADORES
async function gestionarCoordinadores() {
  try {
    const coordsSnap = await db.collection('usuarios').where('rol', '==', 'coordinador').get();
    coordinadoresData = coordsSnap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    const carrerasSnap = await db.collection('carreras').get();
    carrerasData = carrerasSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
      alert('Debes seleccionar al menos una carrera');
      return;
    }

    const carreraActual = carrerasAsignadas[0].carreraId;

    await db.collection('usuarios').doc(coordinadorActual.uid).update({
      carreras: carrerasAsignadas,
      carreraActual: carreraActual,
      carreraId: carreraActual,
      fechaActualizacionCarreras: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('Carreras asignadas correctamente');
    cerrarModalAsignarCarreras();
    gestionarCoordinadores();

  } catch (error) {
    console.error('Error:', error);
    alert('Error al guardar: ' + error.message);
  }
}

function cerrarModalAsignarCarreras() {
  document.getElementById('modalAsignarCarreras').style.display = 'none';
  coordinadorActual = null;
}


//grupos
// FUNCION CORREGIDA CON ESTRUCTURA CORRECTA DE CODIGOS
async function generarMatrizGrupos(carreraId, numeroPeriodos) {
  try {
    console.log(`Generando matriz de grupos para ${carreraId}...`);
    console.log(`Dimensiones: 4 turnos x ${numeroPeriodos} periodos`);
    
    const grupos = {};
    
    const nombresTurnos = {
      1: "Matutino",
      2: "Vespertino", 
      3: "Nocturno",
      4: "Sabatino"
    };
    
    // Para cada turno: 1=Matutino, 2=Vespertino, 3=Nocturno, 4=Sabatino
    for (let turno = 1; turno <= 4; turno++) {
      // Para cada periodo/semestre
      for (let periodo = 1; periodo <= numeroPeriodos; periodo++) {
        // Generar codigo del grupo: turno + periodo + "00"
        // Ejemplo: turno 1, periodo 5 = "1500"
        // Ejemplo: turno 3, periodo 8 = "3800"
        const codigo = `${turno}${periodo}00`;
        const codigoCompleto = `${carreraId}-${codigo}`;
        
        grupos[codigo] = {
          codigo: codigo,
          codigoCompleto: codigoCompleto,
          carreraId: carreraId,
          turno: turno,
          nombreTurno: nombresTurnos[turno],
          periodo: periodo,
          esBase: true,
          activo: false,
          alumnos: [],
          materias: [],
          profesores: [],
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        };
      }
    }
    
    // Guardar en Firestore
    await db.collection('grupos').doc(carreraId).set({
      carreraId: carreraId,
      numeroPeriodos: numeroPeriodos,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
      fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
      grupos: grupos
    });
    
    console.log(`Matriz creada exitosamente`);
    console.log(`Estructura guardada en: grupos/${carreraId}`);
    console.log(`Total de grupos base: ${4 * numeroPeriodos}`);
    
    return { success: true, totalGrupos: 4 * numeroPeriodos };
    
  } catch (error) {
    console.error('Error al generar matriz:', error);
    throw error;
  }
}

// FUNCION PARA VER LA MATRIZ DE UNA CARRERA
async function verMatrizCarrera(carreraId) {
  try {
    const gruposDoc = await db.collection('grupos').doc(carreraId).get();
    
    if (!gruposDoc.exists) {
      console.log('No existe matriz para esta carrera');
      return null;
    }
    
    const data = gruposDoc.data();
    console.log('Matriz de', carreraId);
    console.log('Periodos:', data.numeroPeriodos);
    console.log('Grupos:', Object.keys(data.grupos).length);
    
    const nombresTurnos = ["Matutino", "Vespertino", "Nocturno", "Sabatino"];
    
    // Mostrar grupos por turno
    for (let turno = 1; turno <= 4; turno++) {
      const gruposTurno = Object.values(data.grupos)
        .filter(g => g.turno === turno)
        .map(g => g.codigo)
        .sort();
      console.log(`${nombresTurnos[turno - 1]}:`, gruposTurno.join(', '));
    }
    
    return data;
    
  } catch (error) {
    console.error('Error al ver matriz:', error);
    return null;
  }
}

// FUNCION PARA OBTENER UN GRUPO ESPECIFICO
async function obtenerGrupo(carreraId, codigo) {
  try {
    const gruposDoc = await db.collection('grupos').doc(carreraId).get();
    
    if (!gruposDoc.exists) {
      console.log('No existe matriz para esta carrera');
      return null;
    }
    
    const data = gruposDoc.data();
    const grupo = data.grupos[codigo];
    
    if (!grupo) {
      console.log(`No existe el grupo ${codigo}`);
      return null;
    }
    
    return grupo;
    
  } catch (error) {
    console.error('Error al obtener grupo:', error);
    return null;
  }
}

// FUNCION PARA ACTUALIZAR UN GRUPO
async function actualizarGrupo(carreraId, codigo, cambios) {
  try {
    const gruposRef = db.collection('grupos').doc(carreraId);
    const gruposDoc = await gruposRef.get();
    
    if (!gruposDoc.exists) {
      throw new Error('No existe matriz para esta carrera');
    }
    
    const data = gruposDoc.data();
    
    if (!data.grupos[codigo]) {
      throw new Error(`No existe el grupo ${codigo}`);
    }
    
    // Actualizar el grupo especifico usando notacion de punto
    const updates = {};
    Object.keys(cambios).forEach(key => {
      updates[`grupos.${codigo}.${key}`] = cambios[key];
    });
    
    updates['fechaActualizacion'] = firebase.firestore.FieldValue.serverTimestamp();
    
    await gruposRef.update(updates);
    
    console.log(`Grupo ${codigo} actualizado`);
    return true;
    
  } catch (error) {
    console.error('Error al actualizar grupo:', error);
    throw error;
  }
}

// FUNCION PARA OBTENER GRUPOS POR PERIODO
async function obtenerGruposPorPeriodo(carreraId, periodo) {
  try {
    const gruposDoc = await db.collection('grupos').doc(carreraId).get();
    
    if (!gruposDoc.exists) {
      return [];
    }
    
    const data = gruposDoc.data();
    const gruposPeriodo = Object.values(data.grupos)
      .filter(g => g.periodo === periodo)
      .sort((a, b) => a.turno - b.turno);
    
    return gruposPeriodo;
    
  } catch (error) {
    console.error('Error al obtener grupos por periodo:', error);
    return [];
  }
}

// FUNCION PARA OBTENER GRUPOS POR TURNO
async function obtenerGruposPorTurno(carreraId, turno) {
  try {
    const gruposDoc = await db.collection('grupos').doc(carreraId).get();
    
    if (!gruposDoc.exists) {
      return [];
    }
    
    const data = gruposDoc.data();
    const gruposTurno = Object.values(data.grupos)
      .filter(g => g.turno === turno)
      .sort((a, b) => a.periodo - b.periodo);
    
    return gruposTurno;
    
  } catch (error) {
    console.error('Error al obtener grupos por turno:', error);
    return [];
  }
}

// FUNCION PARA OBTENER TODOS LOS GRUPOS DE UNA CARRERA
async function obtenerTodosLosGrupos(carreraId) {
  try {
    const gruposDoc = await db.collection('grupos').doc(carreraId).get();
    
    if (!gruposDoc.exists) {
      return [];
    }
    
    const data = gruposDoc.data();
    return Object.values(data.grupos);
    
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    return [];
  }
}
// ===== CREAR CONTROL DE CAJA =====
function mostrarModalControlCaja() {
  document.getElementById('modalControlCaja').style.display = 'flex';
}

function cerrarModalControlCaja() {
  document.getElementById('modalControlCaja').style.display = 'none';
  document.getElementById('formControlCaja').reset();
  const mensaje = document.getElementById('mensajeCaja');
  if (mensaje) mensaje.style.display = 'none';
}

async function crearControlCaja(event) {
  event.preventDefault();
  
  const nombre = document.getElementById("nombreCaja").value.trim();
  const email = document.getElementById("emailCaja").value.trim().toLowerCase();
  const password = document.getElementById("passCaja").value;
  
  // Validaciones
  if (!nombre) {
    mostrarMensajeCaja("El nombre es obligatorio", "error");
    return;
  }
  
  if (!email) {
    mostrarMensajeCaja("El email es obligatorio", "error");
    return;
  }
  
  if (password.length < 6) {
    mostrarMensajeCaja("La contraseña debe tener al menos 6 caracteres", "error");
    return;
  }
  
  console.log('Creando Control de Caja:', {nombre, email, password: '***'});
  
  try {
    mostrarMensajeCaja("Creando usuario de Control de Caja...", "info");
    
    // Crear secundaria app de Firebase para no cerrar sesión del admin
    const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryCaja");
    const secondaryAuth = secondaryApp.auth();
    
    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const newUid = userCredential.user.uid;
    console.log("Usuario creado en Authentication:", newUid);
    
    const userData = {
      nombre: nombre,
      email: email,
      rol: "controlCaja",
      roles: ["controlCaja"],
      activo: true,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('Guardando usuario con datos:', userData);
    
    await db.collection("usuarios").doc(newUid).set(userData);
    
    console.log("Guardado exitosamente en Firestore");
    
    // Verificar que se guardó
    const verificar = await db.collection("usuarios").doc(newUid).get();
    
    if (!verificar.exists) {
      throw new Error("El documento no se guardó en Firestore");
    }
    
    console.log("Documento verificado:", verificar.data());
    
    // Cerrar sesión secundaria y eliminar app
    await secondaryAuth.signOut();
    await secondaryApp.delete();
    
    mostrarMensajeCaja(
      "Control de Caja creado exitosamente\n\n" +
      "Nombre: " + nombre + "\n" +
      "Email: " + email + "\n" +
      "Password: " + password + "\n\n" +
      "El usuario puede activar/desactivar alumnos (gestión de pagos).\n" +
      "Ya puede iniciar sesión.",
      "success"
    );
    
    document.getElementById('formControlCaja').reset();
    
    setTimeout(() => {
      cerrarModalControlCaja();
    }, 4000);
    
  } catch (error) {
    console.error("Error completo:", error);
    
    let mensaje = "Error: ";
    
    if (error.code === "auth/email-already-in-use") {
      mensaje += "Este email ya está registrado";
    } else if (error.code === "auth/invalid-email") {
      mensaje += "Email inválido";
    } else if (error.code === "auth/weak-password") {
      mensaje += "Contraseña muy débil";
    } else {
      mensaje += error.message;
    }
    
    mostrarMensajeCaja(mensaje, "error");
  }
}

function mostrarMensajeCaja(texto, tipo) {
  const mensaje = document.getElementById('mensajeCaja');
  if (!mensaje) return;
  
  mensaje.textContent = texto;
  mensaje.style.display = 'block';
  mensaje.style.whiteSpace = 'pre-line';
  
  if (tipo === 'success') {
    mensaje.style.background = '#d4edda';
    mensaje.style.color = '#155724';
    mensaje.style.border = '2px solid #c3e6cb';
  } else if (tipo === 'error') {
    mensaje.style.background = '#f8d7da';
    mensaje.style.color = '#721c24';
    mensaje.style.border = '2px solid #f5c6cb';
  } else {
    mensaje.style.background = '#d1ecf1';
    mensaje.style.color = '#0c5460';
    mensaje.style.border = '2px solid #bee5eb';
  }
}


console.log('Sistema de Control Admin V4 cargado - Con Academia como característica de coordinadores');