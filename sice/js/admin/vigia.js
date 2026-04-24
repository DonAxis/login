// vigia.js — Diagnóstico y reparación de reportes prefecto

let _inconsistenciasVigia = []; // guarda los datos para reparar

async function accionVigia() {
  _inconsistenciasVigia = [];
  mostrarModalVigia('<p style="color:#666;text-align:center;padding:20px;">Analizando reportes...</p>');

  try {
    const db = firebase.firestore();

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

    for (const reporte of reportes) {
      const profSnap = await db.collection('profesorMaterias')
        .where('codigoGrupo', '==', reporte.codigoGrupo)
        .where('activa', '==', true)
        .get();

      const actuales = {};
      profSnap.forEach(doc => {
        const d = doc.data();
        if (d.profesorId) actuales[d.profesorId] = d.profesorNombre || 'Sin nombre';
      });

      const enReporte = reporte.profesores || {};

      const faltantes = Object.entries(actuales)
        .filter(([uid]) => !enReporte[uid])
        .map(([uid, nombre]) => ({ uid, nombre }));

      if (faltantes.length) {
        _inconsistenciasVigia.push({ reporte, faltantes });
      }
    }

    if (!_inconsistenciasVigia.length) {
      mostrarModalVigia(`
        <p style="color:#2e7d32;font-weight:600;text-align:center;padding:20px;">
          ✓ Sin inconsistencias. Todos los profesores activos están en sus reportes.
        </p>`);
      return;
    }

    renderResultadosVigia();

  } catch (e) {
    mostrarModalVigia(`<p style="color:#b71c1c;">Error: ${e.message}</p>`);
  }
}

function renderResultadosVigia() {
  const total = _inconsistenciasVigia.length;
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
      <p style="color:#b71c1c;font-weight:600;margin:0;">
        ${total} reporte(s) con profesores sin acceso:
      </p>
      <button onclick="repararTodo()"
        style="padding:8px 16px;background:linear-gradient(135deg,#1b5e20,#2e7d32);
               color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;">
        Reparar todo
      </button>
    </div>`;

  _inconsistenciasVigia.forEach(({ reporte, faltantes }, i) => {
    const fecha = new Date(reporte.fechaSolicitud).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    html += `
      <div id="vigiaItem_${i}" style="border-left:3px solid #b71c1c;padding:10px 15px;margin-bottom:12px;
                  background:#fff5f5;border-radius:4px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div>
            <strong>${reporte.alumnoNombre}</strong>
            &nbsp;·&nbsp; Grupo: <strong>${reporte.codigoGrupo}</strong>
            &nbsp;·&nbsp; ${fecha}<br>
            <span style="color:#b71c1c;font-size:0.9rem;">
              Sin acceso: ${faltantes.map(p => p.nombre).join(', ')}
            </span>
          </div>
          <button onclick="repararReporte(${i})"
            style="flex-shrink:0;padding:6px 14px;background:linear-gradient(135deg,#1b5e20,#2e7d32);
                   color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.82rem;">
            Reparar
          </button>
        </div>
        <div id="vigiaMsg_${i}" style="display:none;margin-top:8px;font-size:0.85rem;"></div>
      </div>`;
  });

  mostrarModalVigia(html);
}

async function repararReporte(i) {
  const item = _inconsistenciasVigia[i];
  if (!item) return;

  const msgEl = document.getElementById(`vigiaMsg_${i}`);
  const btn   = document.querySelector(`#vigiaItem_${i} button`);
  if (btn) { btn.disabled = true; btn.textContent = 'Reparando...'; }

  try {
    const db     = firebase.firestore();
    const update = {};

    item.faltantes.forEach(({ uid, nombre }) => {
      update[`profesores.${uid}`] = { nombre, respuesta: null, fecha: null };
    });

    await db.collection('reportesPrefecto').doc(item.reporte.id).update({
      ...update,
      profesoresPendientes: firebase.firestore.FieldValue.arrayUnion(
        ...item.faltantes.map(p => p.uid)
      )
    });

    if (msgEl) {
      msgEl.textContent  = `✓ Reparado — ${item.faltantes.length} profesor(es) agregados.`;
      msgEl.style.display = 'block';
      msgEl.style.color   = '#2e7d32';
    }
    if (btn) { btn.textContent = 'Reparado'; btn.style.background = '#2e7d32'; }

  } catch (e) {
    if (msgEl) {
      msgEl.textContent  = 'Error: ' + e.message;
      msgEl.style.display = 'block';
      msgEl.style.color   = '#b71c1c';
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Reparar'; }
  }
}

async function repararTodo() {
  const btn = document.querySelector('[onclick="repararTodo()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Reparando...'; }

  for (let i = 0; i < _inconsistenciasVigia.length; i++) {
    await repararReporte(i);
  }

  if (btn) { btn.textContent = 'Completado'; btn.style.background = '#2e7d32'; }
}

function mostrarModalVigia(contenidoHtml) {
  const existente = document.getElementById('modalVigia');
  if (existente) {
    document.getElementById('contenidoVigia').innerHTML = contenidoHtml;
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'modalVigia';
  modal.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'background:rgba(0,0,0,0.6)', 'z-index:9999',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';');

  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:15px;max-width:640px;width:90%;
                max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;
                  padding-bottom:12px;border-bottom:2px solid #1b5e20;">
        <h3 style="margin:0;color:#1b5e20;">Diagnóstico Vigía — Reportes</h3>
        <button onclick="document.getElementById('modalVigia').remove()"
          style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#666;line-height:1;">✕</button>
      </div>
      <div id="contenidoVigia">${contenidoHtml}</div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
