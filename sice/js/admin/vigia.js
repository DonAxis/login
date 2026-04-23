// vigia.js — Diagnóstico de reportes prefecto

async function accionVigia() {
  mostrarModalVigia('<p style="color:#666;text-align:center;padding:20px;">Analizando reportes...</p>');

  try {
    const db = firebase.firestore();

    // 1. Todos los reportes activos (no archivados)
    const reportesSnap = await db.collection('reportesPrefecto').get();
    const reportes = [];
    reportesSnap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      if (!d.archivado) reportes.push(d);
    });

    if (!reportes.length) {
      mostrarModalVigia('<p style="color:#2e7d32;text-align:center;padding:20px;">Sin reportes activos.</p>');
      return;
    }

    // 2. Por cada reporte, comparar profesores actuales vs notificados
    const inconsistencias = [];

    for (const reporte of reportes) {
      const profSnap = await db.collection('profesorMaterias')
        .where('codigoGrupo', '==', reporte.codigoGrupo)
        .where('activa', '==', true)
        .get();

      // Deduplicar por profesorId
      const actuales = {};
      profSnap.forEach(doc => {
        const d = doc.data();
        if (d.profesorId) actuales[d.profesorId] = d.profesorNombre || 'Sin nombre';
      });

      const enReporte = reporte.profesores || {};

      // Profesores activos en el grupo que NO están en el reporte
      const faltantes = Object.entries(actuales)
        .filter(([uid]) => !enReporte[uid])
        .map(([, nombre]) => nombre);

      if (faltantes.length) {
        inconsistencias.push({ reporte, faltantes });
      }
    }

    // 3. Mostrar resultado
    if (!inconsistencias.length) {
      mostrarModalVigia(`
        <p style="color:#2e7d32;font-weight:600;text-align:center;padding:20px;">
          ✓ Sin inconsistencias. Todos los profesores activos están en sus reportes.
        </p>`);
      return;
    }

    let html = `
      <p style="color:#b71c1c;font-weight:600;margin:0 0 15px 0;">
        ${inconsistencias.length} reporte(s) con profesores sin acceso:
      </p>`;

    for (const { reporte, faltantes } of inconsistencias) {
      const fecha = new Date(reporte.fechaSolicitud).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric'
      });
      html += `
        <div style="border-left:3px solid #b71c1c;padding:10px 15px;margin-bottom:12px;
                    background:#fff5f5;border-radius:4px;">
          <strong>${reporte.alumnoNombre}</strong>
          &nbsp;·&nbsp; Grupo: <strong>${reporte.codigoGrupo}</strong>
          &nbsp;·&nbsp; ${fecha}<br>
          <span style="color:#b71c1c;font-size:0.9rem;">
            Sin acceso: ${faltantes.join(', ')}
          </span>
        </div>`;
    }

    mostrarModalVigia(html);

  } catch (e) {
    mostrarModalVigia(`<p style="color:#b71c1c;">Error: ${e.message}</p>`);
  }
}

function mostrarModalVigia(contenidoHtml) {
  const existente = document.getElementById('modalVigia');
  if (existente) existente.remove();

  const modal = document.createElement('div');
  modal.id = 'modalVigia';
  modal.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'background:rgba(0,0,0,0.6)', 'z-index:9999',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';');

  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:15px;max-width:620px;width:90%;
                max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;
                  padding-bottom:12px;border-bottom:2px solid #1b5e20;">
        <h3 style="margin:0;color:#1b5e20;">Diagnóstico Vigía — Reportes</h3>
        <button onclick="document.getElementById('modalVigia').remove()"
          style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#666;line-height:1;">✕</button>
      </div>
      <div>${contenidoHtml}</div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
