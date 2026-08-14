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
let modoGrupo = false;
let alumnosGrupo = [];
let profesoresPorGrupo = {};

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
  document.getElementById('menuPrefecto').style.display         = 'none';
  document.getElementById('seccionSolicitar').style.display     = 'none';
  document.getElementById('seccionInformes').style.display      = 'none';
  document.getElementById('seccionDetalle').style.display       = 'none';
  document.getElementById('seccionArchivo').style.display       = 'none';
  document.getElementById('seccionPendientes').style.display    = 'none';
  document.getElementById('seccionNuevoPeriodo').style.display  = 'none';
  document.getElementById('btnVolver').style.display            = 'inline-block';
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
  actualizarBtnGrupo();
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

  modoGrupo = false;
  alumnosGrupo = [];
  profesoresPorGrupo = {};
  document.getElementById('modalTitulo').textContent          = 'Confirmar Solicitud de Reporte';
  document.getElementById('modalFilaIndividual').style.display = 'block';
  document.getElementById('modalGrupoInfo').style.display      = 'none';

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
  modoGrupo = false;
  alumnosGrupo = [];
  profesoresPorGrupo = {};
}

async function confirmarSolicitud() {
  if (modoGrupo) {
    await confirmarSolicitudGrupo();
  } else {
    await confirmarSolicitudIndividual();
  }
}

async function confirmarSolicitudIndividual() {
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

async function confirmarSolicitudGrupo() {
  if (!alumnosGrupo.length) return;

  const btn = document.getElementById('btnConfirmarSolicitud');
  const msgEl = document.getElementById('modalMensaje');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const batch = db.batch();
    const ahora = new Date().toISOString();
    let creados = 0;

    alumnosGrupo.forEach(alumno => {
      const cg = alumno.codigoGrupo || '';
      const profes = profesoresPorGrupo[cg] || [];
      if (!profes.length) return;

      const profesoresMap = {};
      const profesoresPendientes = [];
      profes.forEach(p => {
        profesoresMap[p.id] = { nombre: p.nombre, respuesta: null, fecha: null };
        profesoresPendientes.push(p.id);
      });

      const ref = db.collection('reportesPrefecto').doc();
      batch.set(ref, {
        alumnoId:             alumno.id,
        alumnoNombre:         alumno.nombre || '',
        codigoGrupo:          cg,
        prefectoId:           prefectoActual.uid,
        prefectoNombre:       prefectoActual.nombre || '',
        fechaSolicitud:       ahora,
        profesoresPendientes: profesoresPendientes,
        profesores:           profesoresMap
      });
      creados++;
    });

    await batch.commit();

    msgEl.innerHTML = `
      <div class="msg-success" style="margin-bottom:10px;">
        Solicitud enviada para ${creados} alumno${creados !== 1 ? 's' : ''}.
      </div>
      <button onclick="avisarGrupoWhatsAppMasivo()" class="btn-primary"
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

// ============================================================================
// REPORTE DE GRUPO COMPLETO
// ============================================================================

function actualizarBtnGrupo() {
  const btn  = document.getElementById('btnReportarGrupo');
  const hint = document.getElementById('hintBtnGrupo');
  if (!btn) return;

  if (filtroEsp && filtroPer) {
    const count = alumnosCache.filter(a =>
      (a.carreraId || '').trim() === filtroEsp && Number(a.periodo) === filtroPer
    ).length;

    if (count > 0) {
      btn.disabled        = false;
      btn.style.opacity   = '1';
      btn.style.cursor    = 'pointer';
      btn.textContent     = `📋 Reportar grupo completo · ${count} alumno${count !== 1 ? 's' : ''}`;
      hint.textContent    = '';
    } else {
      btn.disabled        = true;
      btn.style.opacity   = '0.45';
      btn.style.cursor    = 'not-allowed';
      btn.textContent     = '📋 Reportar grupo completo';
      hint.textContent    = 'No hay alumnos en este filtro';
    }
  } else {
    btn.disabled      = true;
    btn.style.opacity = '0.45';
    btn.style.cursor  = 'not-allowed';
    btn.textContent   = '📋 Reportar grupo completo';
    if (!filtroEsp && !filtroPer) {
      hint.textContent = 'Selecciona especialidad y periodo';
    } else if (!filtroEsp) {
      hint.textContent = 'Selecciona especialidad';
    } else {
      hint.textContent = 'Selecciona periodo';
    }
  }
}

async function abrirModalGrupo() {
  alumnosGrupo = alumnosCache.filter(a =>
    (a.carreraId || '').trim() === filtroEsp && Number(a.periodo) === filtroPer
  );
  if (!alumnosGrupo.length) return;

  modoGrupo = true;
  alumnoSeleccionado = null;

  // Preparar modal en modo grupo
  document.getElementById('modalTitulo').textContent           = 'Confirmar Reporte de Grupo';
  document.getElementById('modalFilaIndividual').style.display = 'none';

  const codigosGrupo = [...new Set(alumnosGrupo.map(a => a.codigoGrupo).filter(Boolean))];
  const grupoLabel   = codigosGrupo.length ? codigosGrupo.join(', ') : 'Sin grupo';

  document.getElementById('modalGrupoInfo').style.display = 'block';
  document.getElementById('modalGrupoInfo').innerHTML = `
    <p style="margin:0 0 4px 0; color:#333;">
      <strong>${filtroEsp}</strong> · Periodo <strong>${filtroPer}</strong>
      &nbsp;·&nbsp; Grupo <strong>${grupoLabel}</strong>
    </p>
    <p style="color:#666; font-size:0.88rem; margin:0 0 8px 0;">
      ${alumnosGrupo.length} alumno${alumnosGrupo.length !== 1 ? 's' : ''} seleccionado${alumnosGrupo.length !== 1 ? 's' : ''}:
    </p>
    <div style="max-height:130px; overflow-y:auto; border:1px solid #e0f7fa;
                border-radius:6px; padding:8px; background:#f9fefe;">
      ${alumnosGrupo.map(a => `<div style="font-size:0.88rem; padding:2px 0; color:#333;">${a.nombre || 'Sin nombre'}</div>`).join('')}
    </div>
  `;

  // Resetear estado del modal
  document.getElementById('modalListaProfes').innerHTML         = '<em style="color:#666;">Buscando profesores...</em>';
  document.getElementById('modalSinProfes').style.display       = 'none';
  document.getElementById('modalMensaje').innerHTML             = '';
  const btnConfirmar = document.getElementById('btnConfirmarSolicitud');
  btnConfirmar.disabled    = false;
  btnConfirmar.textContent = 'Enviar Solicitud';
  btnConfirmar.style.display = 'block';
  document.getElementById('btnCerrarTrasEnvio').style.display  = 'none';
  document.getElementById('btnCancelarSolicitud').style.display = 'block';
  document.getElementById('modalConfirmar').style.display       = 'flex';

  // Consultar profesores por cada codigoGrupo único
  profesoresSeleccionados = [];
  profesoresPorGrupo      = {};

  try {
    const snaps = await Promise.all(
      codigosGrupo.map(cg =>
        db.collection('profesorMaterias').where('codigoGrupo', '==', cg).get()
      )
    );

    const globalMapa = {};
    codigosGrupo.forEach((cg, i) => {
      const mapa = {};
      snaps[i].forEach(doc => {
        const d = doc.data();
        if (d.profesorId) {
          mapa[d.profesorId]       = d.profesorNombre || 'Profesor';
          globalMapa[d.profesorId] = d.profesorNombre || 'Profesor';
        }
      });
      profesoresPorGrupo[cg] = Object.entries(mapa).map(([id, nombre]) => ({ id, nombre }));
    });

    profesoresSeleccionados = Object.entries(globalMapa).map(([id, nombre]) => ({ id, nombre }));

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

function avisarGrupoWhatsAppMasivo() {
  const codigosGrupo = [...new Set(alumnosGrupo.map(a => a.codigoGrupo).filter(Boolean))];
  const grupoLabel   = codigosGrupo.join(', ') || '';
  const count        = alumnosGrupo.length;
  const link         = 'https://ilbcontrol.mx/sice/control/profe/controlProfe.html';

  const mensaje =
    `*Reporte escolar grupal solicitado*\n\n` +
    `Especialidad: *${filtroEsp}* · Periodo: *${filtroPer}*\n` +
    `Grupo: *${grupoLabel}*\n` +
    `Alumnos reportados: *${count}*\n\n` +
    `Por favor registren su observación en el sistema:\n` +
    `${link}`;

  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
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
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const periodoArchivado = `${ahora.getFullYear()}-${mes <= 6 ? 1 : 2}`;
    await db.collection('reportesPrefecto').doc(reporteDetalleActual.id).update({
      archivado: true, periodoArchivado
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

    if (!reportes.length) {
      contenedor.innerHTML = '<div class="msg-info">No hay reportes archivados.</div>';
      return;
    }

    // Derivar clave de ciclo: usar periodoArchivado si existe, sino año de fechaSolicitud
    function cicloDeReporte(r) {
      if (r.periodoArchivado) return r.periodoArchivado;
      const fecha = new Date(r.fechaSolicitud);
      const mes = fecha.getMonth() + 1;
      return `${fecha.getFullYear()}-${mes <= 6 ? 1 : 2}`;
    }

    // Agrupar por ciclo
    const grupos = {};
    reportes.forEach(r => {
      const clave = cicloDeReporte(r);
      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push(r);
    });

    // Ordenar ciclos de más reciente a más antiguo
    const ciclos = Object.keys(grupos).sort((a, b) => {
      const [ay, an] = a.split('-').map(Number);
      const [by, bn] = b.split('-').map(Number);
      return by !== ay ? by - ay : bn - an;
    }).reverse();

    contenedor.innerHTML = ciclos.map((ciclo, idx) => {
      const lista = grupos[ciclo];
      lista.sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));

      const abierto = idx === 0; // el más reciente abierto por defecto
      const filas = lista.map(r => {
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

      return `
        <div style="margin-bottom:14px; border-radius:10px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid #e0f7fa;">
          <button onclick="toggleArchivoCiclo('ciclo_${ciclo}', this)"
                  style="width:100%; background:linear-gradient(135deg,#006064,#00838f);
                         color:white; border:none; padding:14px 18px; text-align:left;
                         cursor:pointer; font-size:0.97rem; font-weight:700;
                         display:flex; justify-content:space-between; align-items:center;">
            <span>Ciclo ${ciclo}</span>
            <span style="display:flex; gap:10px; align-items:center;">
              <span style="background:rgba(255,255,255,0.2); border-radius:20px; padding:2px 10px;
                           font-size:0.82rem; font-weight:600;">
                ${lista.length} reporte${lista.length !== 1 ? 's' : ''}
              </span>
              <span class="chevron-archivo" style="font-size:1.1rem; transition:transform 0.2s;
                                                   transform:rotate(${abierto ? '90deg' : '0deg'});">›</span>
            </span>
          </button>
          <div id="ciclo_${ciclo}" style="display:${abierto ? 'block' : 'none'}; padding:12px; background:#fafafa;">
            ${filas}
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    contenedor.innerHTML = `<div class="msg-error">Error: ${e.message}</div>`;
  }
}

function toggleArchivoCiclo(id, btn) {
  const panel = document.getElementById(id);
  const chevron = btn.querySelector('.chevron-archivo');
  const abierto = panel.style.display !== 'none';
  panel.style.display = abierto ? 'none' : 'block';
  if (chevron) chevron.style.transform = abierto ? 'rotate(0deg)' : 'rotate(90deg)';
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
    return `  ${prof.nombre} — ${n} alumno${n !== 1 ? 's' : ''} sin responder`;
  }).join('\n');

  const mensaje =
    `*Profesores con reportes pendientes*\n` +
    `_${hoy}_\n\n` +
    `${lineas}\n\n` +
    `Total: *${pendientesCache.length} profesor${pendientesCache.length !== 1 ? 'es' : ''}* · *${totalAlumnos} reporte${totalAlumnos !== 1 ? 's' : ''}* pendiente${totalAlumnos !== 1 ? 's' : ''}\n\n` +
    `https://ilbcontrol.mx/sice/control/profe/controlProfe.html`;

  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ============================================================================
// NUEVO PERIODO — ARCHIVAR TODOS LOS REPORTES
// ============================================================================

async function mostrarNuevoPeriodo() {
  ocultarTodasSecciones();
  document.getElementById('seccionNuevoPeriodo').style.display = 'block';
  const cont = document.getElementById('nuevoPeriodoContenido');
  cont.innerHTML = '<div class="msg-info">Contando reportes activos...</div>';

  try {
    const snap = await db.collection('reportesPrefecto').get();
    const activosDocs = snap.docs.filter(d => !d.data().archivado);
    const total = activosDocs.length;

    if (total === 0) {
      cont.innerHTML = `
        <div style="background:#e8f5e9; border-left:4px solid #43a047; padding:18px 20px;
                    border-radius:8px; color:#2e7d32; font-size:1rem; margin-bottom:20px;">
          No hay reportes activos. El periodo ya está limpio.
        </div>`;
      return;
    }

    let conPendientes = 0;
    let completos = 0;
    activosDocs.forEach(d => {
      const r = d.data();
      if ((r.profesoresPendientes || []).length > 0) conPendientes++;
      else completos++;
    });

    cont.innerHTML = `
      <div style="background:#fff3e0; border-left:4px solid #e65100; padding:18px 20px;
                  border-radius:8px; margin-bottom:20px;">
        <strong style="color:#bf360c; font-size:1rem;">Resumen de reportes activos</strong>
        <div style="margin-top:14px; display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
          <div style="background:white; padding:12px 8px; border-radius:8px; text-align:center;
                      border:2px solid #ffcc80;">
            <div style="font-size:1.8rem; font-weight:800; color:#e65100;">${total}</div>
            <div style="font-size:0.78rem; color:#666; margin-top:2px;">Total activos</div>
          </div>
          <div style="background:white; padding:12px 8px; border-radius:8px; text-align:center;
                      border:2px solid #a5d6a7;">
            <div style="font-size:1.8rem; font-weight:800; color:#2e7d32;">${completos}</div>
            <div style="font-size:0.78rem; color:#666; margin-top:2px;">Con respuestas</div>
          </div>
          <div style="background:white; padding:12px 8px; border-radius:8px; text-align:center;
                      border:2px solid #ef9a9a;">
            <div style="font-size:1.8rem; font-weight:800; color:#c62828;">${conPendientes}</div>
            <div style="font-size:0.78rem; color:#666; margin-top:2px;">Sin respuestas</div>
          </div>
        </div>
      </div>

      <div style="background:#fdecea; border-left:4px solid #c62828; padding:15px 18px;
                  border-radius:8px; margin-bottom:24px; font-size:0.92rem; color:#333;">
        <strong style="color:#b71c1c;">Advertencia:</strong> Al confirmar, <strong>todos los
        reportes activos</strong> pasarán al Archivo, tanto los completos como los que aún
        tienen profesores pendientes. Esta acción no se puede deshacer.<br><br>
        Los reportes archivados seguirán visibles en la sección <strong>Archivo</strong>
        para consulta futura.
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block; font-weight:600; color:#b71c1c; margin-bottom:8px; font-size:0.9rem; line-height:1.4;">
          Para continuar, escribe exactamente:<br>
          <span style="background:#fdecea; padding:3px 9px; border-radius:4px; letter-spacing:1px;
                       font-family:monospace; font-size:1rem; display:inline-block; margin-top:4px;">NUEVO PERIODO</span>
        </label>
        <input type="text" id="inputConfirmarArchivado" placeholder="Escribe aquí..."
               oninput="const ok = this.value === 'NUEVO PERIODO'; const b = document.getElementById('btnArchivarTodo'); b.disabled = !ok; b.style.opacity = ok ? '1' : '0.4'; b.style.cursor = ok ? 'pointer' : 'default';"
               style="padding:10px 14px; border:2px solid #e57373; border-radius:8px;
                      font-size:1rem; width:100%; max-width:280px; outline:none; box-sizing:border-box;"
               autocomplete="off" spellcheck="false">
      </div>

      <button id="btnArchivarTodo" onclick="archivarTodosReportes(this)" disabled
              style="padding:13px 20px; background:linear-gradient(135deg,#e65100,#bf360c);
                     color:white; border:none; border-radius:8px; font-weight:700;
                     cursor:pointer; font-size:0.95rem; opacity:0.4; transition:opacity 0.2s;
                     width:100%; max-width:360px; box-sizing:border-box;"
              onmouseenter="if(!this.disabled) this.style.opacity='0.85';"
              onmouseleave="if(!this.disabled) this.style.opacity='1';">
        Archivar todos los reportes (${total})
      </button>
      <div id="msgArchivarTodo" style="display:none; margin-top:16px;"></div>
    `;
  } catch (e) {
    cont.innerHTML = `<div style="color:red; padding:12px;">Error: ${e.message}</div>`;
  }
}

async function archivarTodosReportes(btn) {
  const input = document.getElementById('inputConfirmarArchivado');
  if (!input || input.value !== 'NUEVO PERIODO') return;

  btn.disabled = true;
  btn.style.opacity = '0.4';
  btn.textContent = 'Archivando...';
  const msg = document.getElementById('msgArchivarTodo');

  try {
    const snap = await db.collection('reportesPrefecto').get();
    const docs = snap.docs.filter(d => !d.data().archivado);

    if (docs.length === 0) {
      msg.style.cssText = 'display:block; background:#e8f5e9; color:#2e7d32; padding:12px 16px; border-radius:8px;';
      msg.textContent = 'No había reportes activos.';
      btn.disabled = false;
      btn.textContent = 'Archivar todos los reportes';
      return;
    }

    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const n = mes <= 6 ? 1 : 2;
    const periodoArchivado = `${ahora.getFullYear()}-${n}`;

    // Dividir en chunks de 490 por límite de Firestore batch (500 ops)
    const CHUNK = 490;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = db.batch();
      docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { archivado: true, periodoArchivado }));
      await batch.commit();
    }

    msg.style.cssText = 'display:block; background:#e8f5e9; color:#2e7d32; padding:12px 16px; border-radius:8px;';
    msg.textContent = `✓ ${docs.length} reportes archivados. El panel del prefecto, profesores y alumnos ya están limpios para el nuevo periodo.`;
    btn.style.display = 'none';
    actualizarBadgePendientes();

  } catch (e) {
    msg.style.cssText = 'display:block; background:#fdecea; color:#b71c1c; padding:12px 16px; border-radius:8px;';
    msg.textContent = 'Error al archivar: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Reintentar';
  }
}

console.log('Panel Prefecto cargado');
