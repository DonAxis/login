// ============================================================================
// CONTROL PREFECTO
// ============================================================================

let prefectoActual  = null;
let alumnosCache    = [];
let alumnoSeleccionado = null;
let profesoresSeleccionados = [];
let filtroEsp = null;
let filtroPer = null;
let reporteDetalleActual = null; // Para PDF
let pendientesCache = [];

// Filtro invisible — solo estas carreras son visibles para el prefecto
const CARRERAS_PERMITIDAS = ['TA', 'TAE', 'TC', 'TI', 'TIAC', 'TT', 'DE', 'PRUEBA'];

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'https://ilbcontrol.mx/sice';
    return;
  }

  try {
    const data = await obtenerUsuarioConCache(user.uid);

    if (!data) {
      alert('Usuario no encontrado');
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
      return;
    }

    if (data.rol !== 'prefecto') {
      alert('Acceso denegado. Solo prefectos.');
      await firebase.auth().signOut();
      window.location.href = 'https://ilbcontrol.mx/sice';
      return;
    }

    prefectoActual = data;

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
  actualizarBadgePendientes();
}

async function actualizarBadgePendientes() {
  try {
    const snap = await db.collection('reportesPrefecto').get();
    const profsPendientes = new Set();
    snap.docs.forEach(d => {
      const r = d.data();
      if (!r.archivado) (r.profesoresPendientes || []).forEach(uid => profsPendientes.add(uid));
    });
    const badge = document.getElementById('badgePendientes');
    if (!badge) return;
    if (profsPendientes.size > 0) {
      badge.textContent   = profsPendientes.size;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  } catch (_) { /* silencioso */ }
}

function ocultarTodasSecciones() {
  document.getElementById('menuPrefecto').style.display      = 'none';
  document.getElementById('seccionSolicitar').style.display  = 'none';
  document.getElementById('seccionInformes').style.display   = 'none';
  document.getElementById('seccionDetalle').style.display    = 'none';
  document.getElementById('seccionArchivo').style.display    = 'none';
  document.getElementById('seccionPendientes').style.display = 'none';
  document.getElementById('btnVolver').style.display         = 'inline-block';
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
  document.getElementById('modalMensaje').innerHTML           = '';
  const btnConfirmar = document.getElementById('btnConfirmarSolicitud');
  btnConfirmar.disabled    = false;
  btnConfirmar.textContent = 'Enviar Solicitud';
  btnConfirmar.style.display = 'block';
  document.getElementById('btnCerrarTrasEnvio').style.display  = 'none';
  document.getElementById('btnCancelarSolicitud').style.display = 'block';
  document.getElementById('modalConfirmar').style.display      = 'flex';

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

    msgEl.innerHTML = `
      <div class="msg-success" style="margin-bottom:10px;">Solicitud enviada correctamente.</div>
      <button onclick="avisarGrupoWhatsApp()" class="btn-primary"
              style="background:linear-gradient(135deg,#25d366 0%,#128c7e 100%); margin-top:0;">
        📲 Avisar al grupo de WhatsApp
      </button>
    `;
    btn.style.display = 'none';

    document.getElementById('btnCerrarTrasEnvio').style.display = 'block';

  } catch (e) {
    msgEl.innerHTML = `<div class="msg-error">Error: ${e.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Enviar Solicitud';
  }
}

function avisarGrupoWhatsApp() {
  if (!alumnoSeleccionado) return;

  const nombre = alumnoSeleccionado.nombre || 'Alumno';
  const grupo  = alumnoSeleccionado.codigoGrupo || '';
  const link   = 'https://ilbcontrol.mx/sice/control/profe/controlProfe.html';

  const mensaje =
    `*Reporte escolar solicitado*\n\n` +
    `Alumno: *${nombre}*\n` +
    `Grupo: *${grupo}*\n\n` +
    `Por favor registren su observación en el sistema:\n` +
    `${link}`;

  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
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
      // .where('prefectoId', '==', prefectoActual.uid) // Descomenta para filtrar por prefecto
      .get();

    if (snap.empty) {
      contenedor.innerHTML = '<div class="msg-info">No hay informes solicitados aún.</div>';
      return;
    }

    const reportes = [];
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      if (!d.archivado) reportes.push(d);
    });
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
    reporteDetalleActual = { id: doc.id, ...r };
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

// ============================================================================
// SECCIÓN: PDF REPORTE DE FALLA
// ============================================================================

function generarPDFReporte() {
  if (!reporteDetalleActual) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const r      = reporteDetalleActual;
  const fecha  = new Date(r.fechaSolicitud).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const hoy    = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const margen = 20;
  const ancho  = 210 - margen * 2;
  let y = 20;

  // ----- ENCABEZADO -----
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Instituto ILB', margen, y);
  doc.text(hoy, 210 - margen, y, { align: 'right' });
  y += 8;

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.setFont(undefined, 'bold');
  doc.text('Reporte escolar', 105, y, { align: 'center' });
  y += 3;

  doc.setDrawColor(0, 96, 100);
  doc.setLineWidth(0.8);
  doc.line(margen, y, 210 - margen, y);
  y += 8;

  // ----- DATOS DEL ALUMNO -----
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.setFont(undefined, 'bold');
  doc.text('Alumno:', margen, y);
  doc.setFont(undefined, 'normal');
  doc.text(r.alumnoNombre || '-', margen + 22, y);
  y += 7;

  doc.setFont(undefined, 'bold');
  doc.text('Grupo:', margen, y);
  doc.setFont(undefined, 'normal');
  doc.text(r.codigoGrupo || '-', margen + 22, y);

  doc.setFont(undefined, 'bold');
  doc.text('Fecha de solicitud:', 120, y);
  doc.setFont(undefined, 'normal');
  doc.text(fecha, 120 + 40, y);
  y += 12;

  // ----- TABLA DE REPORTES -----
  const profesores = r.profesores || {};
  const filas = Object.entries(profesores)
    .filter(([, p]) => p.respuesta)
    .map(([, p]) => [
      p.nombre || '-',
      p.respuesta,
      p.fecha ? new Date(p.fecha).toLocaleDateString('es-MX') : '-'
    ]);

  doc.autoTable({
    startY: y,
    head: [['Profesor', 'Observación', 'Fecha']],
    body: filas,
    margin: { left: margen, right: margen },
    headStyles: {
      fillColor: [0, 96, 100],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: { fontSize: 9, textColor: 30 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: ancho - 45 - 25 },
      2: { cellWidth: 25 }
    },
    alternateRowStyles: { fillColor: [240, 248, 248] },
    didParseCell: (data) => {
      if (data.column.index === 1 && data.cell.raw === '[vacío]') {
        data.cell.styles.textColor = [180, 180, 180];
        data.cell.styles.fontStyle = 'italic';
      }
    }
  });

  y = doc.lastAutoTable.finalY + 20;

  // ----- FIRMA -----
  if (y > 240) { doc.addPage(); y = 30; }

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text('Firma del Padre / Tutor:', margen, y);
  y += 12;
  doc.setDrawColor(100);
  doc.setLineWidth(0.4);
  doc.line(margen, y, margen + 80, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text('Nombre y Firma', margen, y);

  // ----- GUARDAR -----
  const nombreArchivo = `reporte_${(r.alumnoNombre || 'alumno').replace(/\s+/g, '_')}_${r.fechaSolicitud?.slice(0, 10)}.pdf`;
  doc.save(nombreArchivo);
}

// ============================================================================
// ARCHIVAR REPORTE
// ============================================================================

async function archivarReporte() {
  if (!reporteDetalleActual) return;

  const msgEl = document.getElementById('msgWhatsapp'); // reutiliza el área de mensajes
  try {
    await db.collection('reportesPrefecto').doc(reporteDetalleActual.id).update({
      archivado: true
    });
    mostrarMenu();
  } catch (e) {
    if (msgEl) {
      msgEl.textContent = 'Error al archivar: ' + e.message;
      msgEl.style.display    = 'block';
      msgEl.style.background = '#fdecea';
      msgEl.style.color      = '#b71c1c';
      msgEl.style.border     = '1px solid #ef9a9a';
      setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
    }
  }
}

// ============================================================================
// SECCIÓN: ARCHIVO
// ============================================================================

async function mostrarArchivo() {
  ocultarTodasSecciones();
  document.getElementById('seccionArchivo').style.display = 'block';

  const contenedor = document.getElementById('listaArchivo');
  contenedor.innerHTML = '<div class="msg-info">Cargando archivo...</div>';

  try {
    const snap = await db.collection('reportesPrefecto').get();

    const reportes = [];
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      if (d.archivado) reportes.push(d);
    });
    reportes.sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));

    if (!reportes.length) {
      contenedor.innerHTML = '<div class="msg-info">No hay reportes archivados.</div>';
      return;
    }

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
            ${completo ? 'Completo' : `${pendientes} de ${total} profesor${pendientes !== 1 ? 'es' : ''} sin responder`}
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    contenedor.innerHTML = `<div class="msg-error">Error: ${e.message}</div>`;
  }
}

// ============================================================================
// WHATSAPP (pendiente — requiere campo tutor.telefono en alumno)
// ============================================================================

function mostrarMsgWhatsapp(texto, tipo = 'warn') {
  const el = document.getElementById('msgWhatsapp');
  if (!el) return;
  el.textContent = texto;
  el.style.display = 'block';
  if (tipo === 'error') {
    el.style.background = '#fdecea';
    el.style.color      = '#b71c1c';
    el.style.border     = '1px solid #ef9a9a';
  } else {
    el.style.background = '#fff3e0';
    el.style.color      = '#e65100';
    el.style.border     = '1px solid #ffcc80';
  }
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function enviarWhatsApp() {
  if (!reporteDetalleActual) return;

  const r = reporteDetalleActual;

  try {
    const alumnoDoc = await db.collection('usuarios').doc(r.alumnoId).get();
    if (!alumnoDoc.exists) {
      mostrarMsgWhatsapp('No se encontró el alumno en la base de datos.', 'error');
      return;
    }

    const telefono = alumnoDoc.data()?.tutor?.telefono;
    if (!telefono) {
      mostrarMsgWhatsapp('Este alumno no tiene número de contacto registrado.');
      return;
    }

    const fecha = new Date(r.fechaSolicitud).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    const mensaje = `Buen dia. Reporte realizado del alumno *${r.alumnoNombre}* | *${r.codigoGrupo}* | *${fecha}*`;
    const url = `https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');

  } catch (e) {
    mostrarMsgWhatsapp('Error al obtener datos del tutor: ' + e.message, 'error');
  }
}

// ============================================================================
// SECCIÓN: PENDIENTES POR PROFESOR
// ============================================================================

async function mostrarPendientes() {
  ocultarTodasSecciones();
  document.getElementById('seccionPendientes').style.display = 'block';

  const cont = document.getElementById('listaPendientes');
  cont.innerHTML = '<div class="msg-info">Cargando...</div>';

  try {
    const snap = await db.collection('reportesPrefecto').get();
    const activos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => !r.archivado && (r.profesoresPendientes || []).length > 0);

    if (!activos.length) {
      pendientesCache = [];
      document.getElementById('btnCompartirPendientes').style.display = 'none';
      cont.innerHTML = `
        <div style="text-align:center; padding:48px 20px; color:#2e7d32;">
          <div style="font-size:2.5rem; margin-bottom:10px;">✓</div>
          <div style="font-weight:700; font-size:1.1rem;">Sin pendientes</div>
          <div style="color:#666; font-size:0.88rem; margin-top:6px;">
            Todos los profesores han respondido los reportes activos.
          </div>
        </div>
      `;
      return;
    }

    // Agrupar por profesor
    const porProfesor = {};
    activos.forEach(r => {
      (r.profesoresPendientes || []).forEach(uid => {
        if (!porProfesor[uid]) {
          porProfesor[uid] = {
            nombre: r.profesores?.[uid]?.nombre || 'Profesor sin nombre',
            alumnos: []
          };
        }
        porProfesor[uid].alumnos.push({
          nombre:      r.alumnoNombre,
          codigoGrupo: r.codigoGrupo,
          reporteId:   r.id,
          fecha:       r.fechaSolicitud
        });
      });
    });

    const sorted = Object.values(porProfesor)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    pendientesCache = sorted;
    document.getElementById('btnCompartirPendientes').style.display = 'inline-flex';

    cont.innerHTML = sorted.map(prof => {
      const count = prof.alumnos.length;
      const filas = prof.alumnos.map(a => {
        const fecha = new Date(a.fecha).toLocaleDateString('es-MX', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        return `
          <div onclick="verDetalleReporte('${a.reporteId}')"
               style="display:flex; justify-content:space-between; align-items:center;
                      padding:11px 14px; background:#fff; border-radius:8px;
                      border:2px solid #eee; cursor:pointer; transition:all 0.2s; margin-top:8px;"
               onmouseover="this.style.borderColor='#006064'; this.style.background='#e0f7fa';"
               onmouseout="this.style.borderColor='#eee'; this.style.background='#fff';">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; color:#333; font-size:0.95rem;
                          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${a.nombre}
              </div>
              <div style="font-size:0.8rem; color:#666; margin-top:2px;">
                Grupo: ${a.codigoGrupo}
              </div>
            </div>
            <div style="font-size:0.78rem; color:#888; white-space:nowrap; margin-left:10px;">
              ${fecha}
            </div>
            <span style="color:#006064; font-size:1.1rem; margin-left:10px;">›</span>
          </div>
        `;
      }).join('');

      return `
        <div style="background:white; border-radius:10px; padding:16px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.09); margin-bottom:14px;
                    border-left:4px solid #f57c00;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <span style="font-weight:700; font-size:1rem; color:#333;">${prof.nombre}</span>
            <span style="background:#fff3e0; color:#f57c00; border-radius:20px; padding:3px 10px;
                         font-size:0.78rem; font-weight:700; white-space:nowrap;">
              ${count} alumno${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''}
            </span>
          </div>
          ${filas}
        </div>
      `;
    }).join('');

  } catch (e) {
    cont.innerHTML = `<div class="msg-error">Error: ${e.message}</div>`;
  }
}

function compartirPendientesWhatsApp() {
  if (!pendientesCache.length) return;

  const hoy = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const totalAlumnos = pendientesCache.reduce((s, p) => s + p.alumnos.length, 0);

  const lineas = pendientesCache.map(prof => {
    const n = prof.alumnos.length;
    return `❌ ${prof.nombre} — ${n} alumno${n !== 1 ? 's' : ''} sin responder`;
  }).join('\n');

  const mensaje =
    `*Profesores con reportes pendientes*\n` +
    `_${hoy}_\n\n` +
    `${lineas}\n\n` +
    `Total: *${pendientesCache.length} profesor${pendientesCache.length !== 1 ? 'es' : ''}* · *${totalAlumnos} reporte${totalAlumnos !== 1 ? 's' : ''}* pendiente${totalAlumnos !== 1 ? 's' : ''}\n\n` +
    `https://ilbcontrol.mx/sice/control/profe/controlProfe.html`;

  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
}

console.log('Panel Prefecto cargado');
