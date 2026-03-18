// ============================================================================
// CONTROL PREFECTO
// ============================================================================

let prefectoActual  = null;
let alumnosCache    = [];
let alumnoSeleccionado = null;
let profesoresSeleccionados = [];
let filtroEsp = null;
let filtroPer = null;

// Filtro invisible — solo estas carreras son visibles para el prefecto
const CARRERAS_PERMITIDAS = ['TA', 'TAE', 'TC', 'TI', 'TIAC', 'TT', 'PRUEBA'];

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'https://ilbcontrol.mx/sice';
    return;
  }

  try {
    const doc = await db.collection('usuarios').doc(user.uid).get();

    if (!doc.exists) {
      alert('Usuario no encontrado');
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
      return;
    }

    const data = doc.data();

    if (data.rol !== 'prefecto') {
      alert('Acceso denegado. Solo prefectos.');
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
      return;
    }

    prefectoActual = { uid: user.uid, ...data };

    document.getElementById('userName').textContent    = prefectoActual.nombre;
    document.getElementById('userEmail').textContent   = user.email;
    document.getElementById('prefectoInfo').textContent = `Bienvenido(a), ${prefectoActual.nombre}`;

    mostrarMenu();

  } catch (error) {
    console.error('Error al cargar usuario:', error);
    alert('Error al cargar información del usuario');
  }
});

function cerrarSesion() {
  firebase.auth().signOut().then(() => {
    window.location.href = 'https://ilbcontrol.mx/sice';
  });
}

// ============================================================================
// NAVEGACIÓN
// ============================================================================

function mostrarMenu() {
  ocultarTodasSecciones();
  document.getElementById('menuPrefecto').style.display = 'grid';
  document.getElementById('btnVolver').style.display    = 'none';
}

function ocultarTodasSecciones() {
  document.getElementById('menuPrefecto').style.display    = 'none';
  document.getElementById('seccionSolicitar').style.display = 'none';
  document.getElementById('seccionInformes').style.display  = 'none';
  document.getElementById('seccionDetalle').style.display   = 'none';
  document.getElementById('btnVolver').style.display        = 'inline-block';
}

// ============================================================================
// SECCIÓN: SOLICITAR REPORTE
// ============================================================================

async function mostrarSolicitarReporte() {
  ocultarTodasSecciones();
  filtroEsp = null;
  filtroPer = null;
  document.getElementById('seccionSolicitar').style.display = 'block';
  document.getElementById('buscadorAlumno').value = '';
  await cargarAlumnos();
}

async function cargarAlumnos() {
  const contenedor = document.getElementById('listaAlumnos');
  contenedor.innerHTML = '<div class="msg-info">Cargando alumnos...</div>';

  try {
    const snap = await db.collection('usuarios').where('rol', '==', 'alumno').get();
    alumnosCache = [];
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (CARRERAS_PERMITIDAS.includes(data.carreraId)) alumnosCache.push(data);
    });
    alumnosCache.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    aplicarFiltros();
  } catch (e) {
    contenedor.innerHTML = `<div class="msg-error">Error al cargar alumnos: ${e.message}</div>`;
  }
}

function toggleFiltroEsp(esp) {
  filtroEsp = filtroEsp === esp ? null : esp;
  CARRERAS_PERMITIDAS.forEach(c => {
    const btn = document.getElementById(`btnEsp_${c}`);
    if (!btn) return;
    btn.style.background = filtroEsp === c ? '#006064' : 'white';
    btn.style.color      = filtroEsp === c ? 'white'   : '#006064';
  });
  aplicarFiltros();
}

function toggleFiltroPeriodo(per) {
  filtroPer = filtroPer === per ? null : per;
  for (let i = 1; i <= 6; i++) {
    const btn = document.getElementById(`btnPer_${i}`);
    if (!btn) continue;
    btn.style.background = filtroPer === i ? '#006064' : 'white';
    btn.style.color      = filtroPer === i ? 'white'   : '#006064';
  }
  aplicarFiltros();
}

function aplicarFiltros() {
  const texto = (document.getElementById('buscadorAlumno').value || '').toLowerCase().trim();

  const filtrado = alumnosCache.filter(a => {
    const coincideNombre = !texto     || (a.nombre || '').toLowerCase().includes(texto);
    const coincideEsp    = !filtroEsp || (a.carreraId || '').trim() === filtroEsp;
    const coincidePer    = !filtroPer || Number(a.periodo) === filtroPer;
    return coincideNombre && coincideEsp && coincidePer;
  });

  renderAlumnos(filtrado);
}

function renderAlumnos(lista) {
  const contenedor = document.getElementById('listaAlumnos');

  if (!lista.length) {
    contenedor.innerHTML = '<div class="msg-info">No se encontraron alumnos.</div>';
    return;
  }

  contenedor.innerHTML = lista.map(a => `
    <div class="alumno-item" onclick="abrirModalConfirmar('${a.id}')">
      <div>
        <div class="nombre">${a.nombre || 'Sin nombre'}</div>
        <div class="grupo">Grupo: ${a.codigoGrupo || 'Sin grupo'}</div>
      </div>
      <span style="color:#006064; font-size:1.2rem;">›</span>
    </div>
  `).join('');
}

// ============================================================================
// MODAL CONFIRMACIÓN
// ============================================================================

async function abrirModalConfirmar(alumnoId) {
  const alumno = alumnosCache.find(a => a.id === alumnoId);
  if (!alumno) return;

  alumnoSeleccionado = alumno;

  document.getElementById('modalAlumnoNombre').textContent = alumno.nombre || 'Sin nombre';
  document.getElementById('modalCodigoGrupo').textContent  = alumno.codigoGrupo || 'Sin grupo';
  document.getElementById('modalListaProfes').innerHTML    = '<em style="color:#666;">Buscando profesores...</em>';
  document.getElementById('modalSinProfes').style.display  = 'none';
  document.getElementById('modalMensaje').innerHTML        = '';
  document.getElementById('btnConfirmarSolicitud').disabled = false;
  document.getElementById('modalConfirmar').style.display  = 'flex';

  // Buscar profesores del grupo
  profesoresSeleccionados = [];
  try {
    if (!alumno.codigoGrupo) {
      document.getElementById('modalListaProfes').innerHTML = '';
      document.getElementById('modalSinProfes').style.display = 'block';
      return;
    }

    const snap = await db.collection('profesorMaterias')
      .where('codigoGrupo', '==', alumno.codigoGrupo)
      .get();

    // Deduplicar por profesorId
    const mapa = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (d.profesorId) mapa[d.profesorId] = d.profesorNombre || 'Profesor';
    });

    profesoresSeleccionados = Object.entries(mapa).map(([id, nombre]) => ({ id, nombre }));

    if (!profesoresSeleccionados.length) {
      document.getElementById('modalListaProfes').innerHTML = '';
      document.getElementById('modalSinProfes').style.display = 'block';
      return;
    }

    document.getElementById('modalListaProfes').innerHTML =
      profesoresSeleccionados.map(p => `<span class="profe-tag">${p.nombre}</span>`).join('');

  } catch (e) {
    document.getElementById('modalListaProfes').innerHTML =
      `<span style="color:#d32f2f;">Error: ${e.message}</span>`;
  }
}

function cerrarModalConfirmar() {
  document.getElementById('modalConfirmar').style.display = 'none';
  alumnoSeleccionado = null;
  profesoresSeleccionados = [];
}

async function confirmarSolicitud() {
  if (!alumnoSeleccionado || !profesoresSeleccionados.length) return;

  const btn = document.getElementById('btnConfirmarSolicitud');
  const msgEl = document.getElementById('modalMensaje');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const profesoresMap = {};
    const profesoresPendientes = [];

    profesoresSeleccionados.forEach(p => {
      profesoresMap[p.id] = { nombre: p.nombre, respuesta: null, fecha: null };
      profesoresPendientes.push(p.id);
    });

    await db.collection('reportesPrefecto').add({
      alumnoId:             alumnoSeleccionado.id,
      alumnoNombre:         alumnoSeleccionado.nombre || '',
      codigoGrupo:          alumnoSeleccionado.codigoGrupo || '',
      prefectoId:           prefectoActual.uid,
      prefectoNombre:       prefectoActual.nombre || '',
      fechaSolicitud:       new Date().toISOString(),
      profesoresPendientes: profesoresPendientes,
      profesores:           profesoresMap
    });

    msgEl.innerHTML = '<div class="msg-success">Solicitud enviada correctamente.</div>';
    btn.textContent = 'Enviado';

    setTimeout(() => {
      cerrarModalConfirmar();
      mostrarMenu();
    }, 1500);

  } catch (e) {
    msgEl.innerHTML = `<div class="msg-error">Error: ${e.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Enviar Solicitud';
  }
}

// ============================================================================
// SECCIÓN: VER INFORMES
// ============================================================================

async function mostrarInformes() {
  ocultarTodasSecciones();
  document.getElementById('seccionInformes').style.display = 'block';

  const contenedor = document.getElementById('listaInformes');
  contenedor.innerHTML = '<div class="msg-info">Cargando informes...</div>';

  try {
    const snap = await db.collection('reportesPrefecto')
      .where('prefectoId', '==', prefectoActual.uid)
      .get();

    if (snap.empty) {
      contenedor.innerHTML = '<div class="msg-info">No hay informes solicitados aún.</div>';
      return;
    }

    const reportes = [];
    snap.forEach(doc => reportes.push({ id: doc.id, ...doc.data() }));
    reportes.sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));

    contenedor.innerHTML = reportes.map(r => {
      const pendientes = (r.profesoresPendientes || []).length;
      const total      = Object.keys(r.profesores || {}).length;
      const completo   = pendientes === 0;
      const fecha      = new Date(r.fechaSolicitud).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      return `
        <div class="reporte-item" onclick="verDetalleReporte('${r.id}')">
          <div class="ri-nombre">${r.alumnoNombre}</div>
          <div class="ri-fecha">${fecha} · Grupo: ${r.codigoGrupo}</div>
          <div class="ri-estado ${completo ? 'badge-completo' : 'badge-pendiente'}">
            ${completo
              ? 'Completo'
              : `${pendientes} de ${total} profesor${pendientes !== 1 ? 'es' : ''} sin responder`}
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    contenedor.innerHTML = `<div class="msg-error">Error: ${e.message}</div>`;
  }
}

// ============================================================================
// SECCIÓN: DETALLE REPORTE
// ============================================================================

async function verDetalleReporte(reporteId) {
  ocultarTodasSecciones();
  document.getElementById('seccionDetalle').style.display = 'block';

  try {
    const doc = await db.collection('reportesPrefecto').doc(reporteId).get();
    if (!doc.exists) return;

    const r = doc.data();
    const fecha = new Date(r.fechaSolicitud).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    document.getElementById('detalleNombreAlumno').textContent = r.alumnoNombre;
    document.getElementById('detalleMetadata').innerHTML =
      `Grupo: <strong>${r.codigoGrupo}</strong> &nbsp;·&nbsp; Solicitado: <strong>${fecha}</strong>`;

    const contenedor = document.getElementById('listaProfesRespuestas');
    const profesores = r.profesores || {};

    if (!Object.keys(profesores).length) {
      contenedor.innerHTML = '<div class="msg-info">Sin profesores registrados.</div>';
      return;
    }

    // Primero los que no han respondido, luego los que sí
    const lista = Object.entries(profesores).sort(([, a], [, b]) => {
      if (!a.respuesta && b.respuesta) return -1;
      if (a.respuesta && !b.respuesta) return 1;
      return 0;
    });

    contenedor.innerHTML = lista.map(([, p]) => `
      <div class="profe-respuesta">
        <div class="pr-nombre">${p.nombre}</div>
        ${p.respuesta
          ? `<div class="pr-texto">${p.respuesta}</div>
             <div class="pr-fecha">${new Date(p.fecha).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })}</div>`
          : `<div class="pr-vacio">[vacío]</div>`
        }
      </div>
    `).join('');

  } catch (e) {
    document.getElementById('listaProfesRespuestas').innerHTML =
      `<div class="msg-error">Error: ${e.message}</div>`;
  }
}

console.log('Panel Prefecto cargado');
