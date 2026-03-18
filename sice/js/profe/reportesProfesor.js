// ============================================================================
// REPORTES PREFECTO - LADO PROFESOR
// ============================================================================

let reportesPendientesCache = [];
let profesorUIDReportes     = null;

// Llamado desde controlProfesor.js después de autenticación
async function inicializarReportesProfesor(uid) {
  profesorUIDReportes = uid;
  await actualizarBadgeReportes();
}

// ===== BADGE EN TARJETA =====

async function actualizarBadgeReportes() {
  if (!profesorUIDReportes) return;

  try {
    const snap = await firebase.firestore()
      .collection('reportesPrefecto')
      .where('profesoresPendientes', 'array-contains', profesorUIDReportes)
      .get();

    const count = snap.size;
    const card  = document.getElementById('cardReportes');
    const badge = document.getElementById('badgeReportes');
    const desc  = document.getElementById('descReportes');

    if (badge) {
      badge.textContent    = count > 0 ? count : '';
      badge.style.display  = count > 0 ? 'inline-block' : 'none';
    }

    if (card && desc) {
      if (count > 0) {
        card.style.background = 'linear-gradient(135deg, #b71c1c 0%, #c62828 100%)';
        card.style.color      = 'white';
        card.querySelector('h3').style.color = 'white';
        desc.textContent  = `${count} reporte${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''}`;
        desc.style.color  = 'rgba(255,255,255,0.88)';
      } else {
        card.style.background = '';
        card.style.color      = '';
        card.querySelector('h3').style.color = '';
        desc.textContent = 'Sin reportes pendientes';
        desc.style.color = '';
      }
    }

  } catch (e) {
    console.warn('Error al cargar badge reportes:', e.message);
  }
}

// ===== NAVEGACIÓN =====

async function verReportesProfesor() {
  document.getElementById('menuMaterias').style.display    = 'none';
  document.getElementById('seccionReportes').style.display = 'block';
  document.getElementById('btnVolverMenu').style.display   = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await cargarReportesProfesor();
}

// ===== CARGAR LISTA =====

async function cargarReportesProfesor() {
  const contenedor = document.getElementById('listaReportesProfesor');
  contenedor.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">Cargando...</p>';

  if (!profesorUIDReportes) {
    profesorUIDReportes = firebase.auth().currentUser?.uid;
  }

  try {
    const snap = await firebase.firestore()
      .collection('reportesPrefecto')
      .where('profesoresPendientes', 'array-contains', profesorUIDReportes)
      .get();

    reportesPendientesCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (reportesPendientesCache.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:60px;color:#999;">
          <p style="font-size:1.2rem;margin:0;">Sin reportes pendientes</p>
        </div>`;
      return;
    }

    let html = '';
    reportesPendientesCache.forEach(reporte => {
      const fecha = reporte.fechaSolicitud?.toDate
        ? reporte.fechaSolicitud.toDate().toLocaleDateString('es-MX')
        : (reporte.fechaSolicitud?.slice(0, 10) || '-');

      html += `
        <div style="background:white;padding:25px;border-radius:12px;margin-bottom:20px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.1);border-left:4px solid #b71c1c;">
          <h3 style="margin:0 0 6px 0;color:#333;">${reporte.alumnoNombre || 'Alumno'}</h3>
          <p style="margin:0 0 15px 0;color:#666;font-size:0.9rem;">
            Grupo: <strong>${reporte.codigoGrupo || '-'}</strong>
            &nbsp;|&nbsp; Solicitado: ${fecha}
          </p>
          <textarea id="respuesta_${reporte.id}"
            placeholder="Escribe tu observación sobre el alumno..."
            rows="4"
            style="width:100%;padding:12px;border:2px solid #ddd;border-radius:8px;
                   font-size:0.95rem;resize:vertical;box-sizing:border-box;">
          </textarea>
          <div style="margin-top:12px;text-align:right;">
            <button onclick="enviarRespuestaReporte('${reporte.id}')"
              style="padding:10px 24px;background:linear-gradient(135deg,#b71c1c 0%,#c62828 100%);
                     color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.95rem;">
              Enviar respuesta
            </button>
          </div>
          <div id="msg_${reporte.id}" style="display:none;margin-top:10px;padding:10px;border-radius:8px;"></div>
        </div>`;
    });

    contenedor.innerHTML = html;

  } catch (e) {
    contenedor.innerHTML = `<p style="color:#d32f2f;text-align:center;">Error: ${e.message}</p>`;
  }
}

// ===== ENVIAR RESPUESTA =====

async function enviarRespuestaReporte(reporteId) {
  const textarea = document.getElementById(`respuesta_${reporteId}`);
  const msgEl    = document.getElementById(`msg_${reporteId}`);
  const texto    = textarea?.value.trim();

  const mostrarMsg = (txt, tipo) => {
    const estilos = {
      success: { bg: '#d4edda', color: '#155724' },
      error:   { bg: '#f8d7da', color: '#721c24' },
      info:    { bg: '#d1ecf1', color: '#0c5460' }
    };
    const s = estilos[tipo] || estilos.info;
    msgEl.textContent      = txt;
    msgEl.style.display    = 'block';
    msgEl.style.background = s.bg;
    msgEl.style.color      = s.color;
  };

  if (!texto) {
    mostrarMsg('Escribe una observación antes de enviar', 'error');
    return;
  }

  try {
    mostrarMsg('Guardando...', 'info');

    await firebase.firestore().collection('reportesPrefecto').doc(reporteId).update({
      [`profesores.${profesorUIDReportes}.respuesta`]: texto,
      [`profesores.${profesorUIDReportes}.fecha`]:     new Date().toISOString(),
      profesoresPendientes: firebase.firestore.FieldValue.arrayRemove(profesorUIDReportes)
    });

    mostrarMsg('Respuesta enviada', 'success');
    if (textarea) textarea.disabled = true;

    setTimeout(async () => {
      await cargarReportesProfesor();
      await actualizarBadgeReportes();
    }, 1500);

  } catch (e) {
    mostrarMsg('Error: ' + e.message, 'error');
  }
}

console.log('Módulo Reportes Profesor cargado');
