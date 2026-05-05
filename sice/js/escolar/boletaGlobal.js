// boletaGlobal.js — Expediente completo de materias por alumno
// Usado por: controlEscolar (Panel 4), coordinador (seccionBoletaGlobal), historialAlumno.html
// IDs HTML esperados: boletagCarrera, boletagBusqueda, boletagResultados

let _boletaCarrerasCache = null;

// carreraFija: si se pasa (desde coordinador), oculta el select y lo fija a esa carrera
async function inicializarBoletaGlobal(carreraFija = null) {
  const select = document.getElementById('boletagCarrera');
  if (!select) return;

  if (carreraFija) {
    const wrapper = select.parentElement;
    if (wrapper) wrapper.style.display = 'none';
    select.dataset.fija = carreraFija;
    return;
  }

  if (select.dataset.ok === '1') return;

  try {
    if (!_boletaCarrerasCache) {
      const snap = await db.collection('carreras').get();
      _boletaCarrerasCache = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.activo !== false)
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    }
    select.innerHTML = '<option value="">-- Todas las carreras --</option>';
    _boletaCarrerasCache.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre || c.id;
      select.appendChild(opt);
    });
    select.dataset.ok = '1';
  } catch (e) {
    console.error('Error cargando carreras en Boleta Global:', e);
  }
}

async function buscarAlumnoBoletaGlobal() {
  const selCarrera = document.getElementById('boletagCarrera');
  const carreraId = selCarrera?.dataset.fija || selCarrera?.value || '';
  const busqueda = (document.getElementById('boletagBusqueda')?.value || '').trim().toLowerCase();
  const contenedor = document.getElementById('boletagResultados');
  if (!contenedor) return;

  contenedor.innerHTML = '<p style="color:#666;padding:16px;text-align:center;">Buscando...</p>';

  try {
    let query = db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .where('activo', '==', true);
    if (carreraId) query = query.where('carreraId', '==', carreraId);

    const snap = await query.get();
    let alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (busqueda) {
      alumnos = alumnos.filter(a =>
        (a.nombre || '').toLowerCase().includes(busqueda) ||
        (a.matricula || '').toLowerCase().includes(busqueda)
      );
    }

    alumnos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    if (!alumnos.length) {
      contenedor.innerHTML = '<p style="color:#999;padding:20px;text-align:center;">Sin resultados.</p>';
      return;
    }

    const carrerasRef = _boletaCarrerasCache
      ? Object.fromEntries(_boletaCarrerasCache.map(c => [c.id, c.nombre]))
      : {};

    let html = `
      <p style="color:#666;font-size:0.85rem;margin-bottom:10px;">${alumnos.length} alumno(s) encontrado(s)</p>
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#6A2135;color:white;">
            <th style="padding:10px 12px;text-align:left;">Nombre</th>
            <th style="padding:10px 12px;text-align:left;">Matrícula</th>
            <th style="padding:10px 12px;text-align:left;">Carrera</th>
            <th style="padding:10px 12px;text-align:center;">Periodo Actual</th>
            <th style="padding:10px 12px;text-align:center;">Acción</th>
          </tr>
        </thead>
        <tbody>
    `;

    alumnos.forEach(a => {
      html += `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 12px;">${a.nombre || '-'}</td>
          <td style="padding:10px 12px;">${a.matricula || '-'}</td>
          <td style="padding:10px 12px;">${carrerasRef[a.carreraId] || a.carreraId || '-'}</td>
          <td style="padding:10px 12px;text-align:center;">${a.periodo || '-'}</td>
          <td style="padding:10px 12px;text-align:center;">
            <button onclick="verBoletaGlobalAlumno('${a.id}')"
              style="padding:6px 16px;background:linear-gradient(135deg,#6A2135,#9c2f50);color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.85rem;">
              Ver Boleta
            </button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    contenedor.innerHTML = html;

  } catch (error) {
    console.error('Error en buscarAlumnoBoletaGlobal:', error);
    contenedor.innerHTML = `<p style="color:#c00;padding:12px;">Error: ${error.message}</p>`;
  }
}

// ── Cache sessionStorage de materias por carreraId ───────────────────────────
const _CACHE_KEY_MATERIAS = 'boleta_materias_v2_';

async function _obtenerMateriasCarrera(carreraId) {
  const key = _CACHE_KEY_MATERIAS + carreraId;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const [materiasSnap, carreraDoc] = await Promise.all([
    db.collection('materias').where('carreraId', '==', carreraId).get(),
    db.collection('carreras').doc(carreraId).get()
  ]);

  const carreraNombre = carreraDoc.exists ? (carreraDoc.data().nombre || carreraId) : carreraId;

  const porPeriodo = {};
  materiasSnap.docs.forEach(doc => {
    const m = doc.data();
    if (m.activo === false) return;
    const per = Number(m.periodo) || 0;
    if (!porPeriodo[per]) porPeriodo[per] = [];
    porPeriodo[per].push({ id: doc.id, nombre: m.nombre || '', codigo: m.codigo || '' });
  });

  Object.values(porPeriodo).forEach(arr =>
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre))
  );

  const resultado = { carreraNombre, porPeriodo };
  try { sessionStorage.setItem(key, JSON.stringify(resultado)); } catch (_) {}
  return resultado;
}

// Opciones de calificación: 10→0 descendente + NP, igual que panel de calificaciones
function _optsCalificacion(rawCal) {
  const vals = [['', '-'], ['10','10'],['9','9'],['8','8'],['7','7'],['6','6'],
                ['5','5'],['4','4'],['3','3'],['2','2'],['1','1'],['0','0'],['NP','NP']];
  return vals.map(([v, lbl]) => {
    const sel = (rawCal === null && v === '') || (rawCal !== null && String(rawCal) === v) ? ' selected' : '';
    return `<option value="${v}"${sel}>${lbl}</option>`;
  }).join('');
}

// Abre nueva ventana con todas las materias de la carrera + calificaciones del alumno
async function verBoletaGlobalAlumno(alumnoId) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Activa las ventanas emergentes para ver la boleta.');
    return;
  }
  w.document.write('<html><head><title>Boleta</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;color:#666;">Cargando boleta...</body></html>');

  try {
    const usuarioDoc = await db.collection('usuarios').doc(alumnoId).get();
    if (!usuarioDoc.exists) { _escribirError(w, 'Alumno no encontrado.'); return; }
    const alumno = usuarioDoc.data();
    const carreraId = alumno.carreraId;
    if (!carreraId) { _escribirError(w, 'El alumno no tiene carrera asignada.'); return; }

    const alumnoPerActual = Number(alumno.periodo) || 0;

    const [{ carreraNombre, porPeriodo }, calSnap] = await Promise.all([
      _obtenerMateriasCarrera(carreraId),
      db.collection('calificaciones').where('alumnoId', '==', alumnoId).get()
    ]);

    const calMap = {};
    calSnap.docs.forEach(doc => {
      const c = doc.data();
      if (c.materiaId) calMap[c.materiaId] = c;
    });

    const periodoKeys = Object.keys(porPeriodo).map(Number).sort((a, b) => a - b);
    const hayPeriodosPasados = alumnoPerActual > 0 && periodoKeys.some(pk => pk < alumnoPerActual);

    // Contadores resumen
    let total = 0, aprobadas = 0, reprobadas = 0, sinCaptura = 0, cursando = 0;
    for (const [perKey, mats] of Object.entries(porPeriodo)) {
      const pn = Number(perKey);
      const esActPer = alumnoPerActual > 0 && pn === alumnoPerActual;
      for (const m of mats) {
        const rawCal = calMap[m.id]?.promedio ?? null;
        total++;
        if (esActPer) cursando++;
        else if (rawCal === null) sinCaptura++;
        else if (rawCal === 'NP' || Number(rawCal) < 6) reprobadas++;
        else aprobadas++;
      }
    }

    const pasanteStr = alumno.pasante
      ? '<span style="display:inline-block;background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;margin-left:8px;vertical-align:middle;">PASANTE</span>'
      : '';

    // ── Botones de acción (estilo calificaciones panel) ──────────────────────
    const btnGuardar = hayPeriodosPasados ? `
      <button id="btnGuardar" onclick="guardarTodosCambios()"
        style="padding:12px 24px;background:linear-gradient(135deg,#216A32 0%,#21596A 100%);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1rem;">
        Guardar Cambios
      </button>` : '';

    const btnPDF = `
      <button onclick="descargarPDF()"
        style="padding:12px 24px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1rem;">
        Descargar PDF
      </button>`;

    let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boleta Global — ${alumno.nombre || ''}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Tahoma,sans-serif; background:#f5f5f5; padding:20px; }
    .container { max-width:960px; margin:0 auto; }
    .encabezado { background:linear-gradient(135deg,#6A2135,#8B2E45); color:white; padding:18px 22px; border-radius:12px; margin-bottom:16px; display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:10px; }
    .encabezado h1 { font-size:1.25rem; margin-bottom:4px; }
    .encabezado p { font-size:0.87rem; opacity:0.9; margin-top:3px; }
    .btn-cerrar { background:rgba(255,255,255,0.2); color:white; border:2px solid rgba(255,255,255,0.6); padding:7px 16px; border-radius:8px; cursor:pointer; font-size:0.85rem; white-space:nowrap; }
    .btn-cerrar:hover { background:rgba(255,255,255,0.35); }
    .barra-acciones { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px; background:white; padding:14px 18px; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,0.08); }
    .chips { display:flex; gap:8px; flex-wrap:wrap; }
    .chip { padding:5px 14px; border-radius:20px; font-size:0.82rem; font-weight:600; }
    .btns-accion { display:flex; gap:10px; flex-wrap:wrap; }
    .sec-titulo { margin:20px 0 7px; color:#667eea; border-bottom:2px solid #667eea; padding-bottom:5px; font-size:0.95rem; font-weight:700; display:flex; align-items:center; gap:8px; }
    table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,0.08); margin-bottom:4px; }
    th { color:white; padding:12px 11px; text-align:left; font-size:0.84rem; border:1px solid rgba(255,255,255,0.2); }
    td { padding:10px 11px; border:1px solid #ddd; font-size:0.85rem; }
    .estado { padding:3px 9px; border-radius:10px; font-size:0.76rem; font-weight:600; white-space:nowrap; }
    select { font-family:inherit; }
    @media print { .btn-cerrar,.btns-accion { display:none; } body { background:white; padding:0; } }
    @media (max-width:600px) { body { padding:10px; } th,td { padding:6px 8px; font-size:0.8rem; } }
  </style>
</head>
<body>
<div class="container">

  <div class="encabezado">
    <div>
      <h1>${alumno.nombre || '-'}${pasanteStr}</h1>
      <p>Matrícula: <strong>${alumno.matricula || '-'}</strong> &nbsp;|&nbsp; Carrera: <strong>${carreraNombre}</strong></p>
      <p>Periodo Actual: <strong>${alumno.periodo || '-'}</strong></p>
    </div>
    <button class="btn-cerrar" onclick="window.close()">✕ Cerrar</button>
  </div>

  <div class="barra-acciones">
    <div class="chips">
      <span class="chip" style="background:#e8f5e9;color:#2e7d32;">${aprobadas} aprobadas</span>
      <span class="chip" style="background:#ffebee;color:#c62828;">${reprobadas} reprobadas</span>
      <span class="chip" style="background:#e3f2fd;color:#1565c0;">${cursando} cursando</span>
      <span class="chip" style="background:#fff3e0;color:#e65100;">${sinCaptura} sin captura</span>
      <span class="chip" style="background:#f3f4f6;color:#555;">${total} total</span>
    </div>
    <div class="btns-accion">
      ${btnGuardar}
      ${btnPDF}
    </div>
  </div>

`;

    if (periodoKeys.length === 0) {
      html += '<p style="color:#999;text-align:center;padding:40px;">Esta carrera no tiene materias registradas.</p>';
    }

    periodoKeys.forEach(perNum => {
      const mats = porPeriodo[perNum];
      const esActualPer = alumnoPerActual > 0 && perNum === alumnoPerActual;
      const esPasadoPer = alumnoPerActual > 0 && perNum < alumnoPerActual;

      const perLabel = esActualPer
        ? `Semestre ${perNum} <span style="background:#e3f2fd;color:#1565c0;padding:1px 9px;border-radius:10px;font-size:0.72rem;font-weight:700;">ACTUAL</span>`
        : `Semestre ${perNum}`;

      html += `<div class="sec-titulo">${perLabel}</div>
<table>
  <thead><tr style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
    <th style="width:34px;text-align:center;">#</th>
    <th>Materia</th>
    <th style="text-align:center;width:110px;">Calificación</th>
    <th style="text-align:center;width:120px;">Estado</th>
  </tr></thead>
  <tbody>`;

      mats.forEach((m, i) => {
        const rawCal = calMap[m.id]?.promedio ?? null;

        if (esActualPer) {
          // ── Semestre actual: "Cursando", solo lectura ──────────────────────
          const calStr = rawCal === null ? '-' : String(rawCal);
          html += `<tr>
    <td style="text-align:center;color:#bbb;">${i + 1}</td>
    <td>${m.nombre}</td>
    <td style="text-align:center;font-weight:bold;font-size:1.1rem;color:#667eea;">${calStr}</td>
    <td style="text-align:center;"><span class="estado" style="background:#e3f2fd;color:#1565c0;">Cursando</span></td>
  </tr>`;

        } else if (esPasadoPer) {
          // ── Semestre pasado: select editable (estilo calificaciones panel) ─
          const sinCap   = rawCal === null;
          const esNP     = rawCal === 'NP';
          const calNum   = (!sinCap && !esNP) ? Number(rawCal) : null;
          const aprobada = calNum !== null && calNum >= 6;
          const rowBg    = sinCap ? '' : (esNP ? '#fff8f0' : (aprobada ? '#f0fdf4' : '#fff5f5'));
          const chipBg   = sinCap ? '#f5f5f5' : (esNP ? '#fff3e0' : (aprobada ? '#e8f5e9' : '#ffebee'));
          const chipColor= sinCap ? '#888'     : (esNP ? '#e65100' : (aprobada ? '#2e7d32' : '#c62828'));
          const chipTxt  = sinCap ? 'Sin captura' : (esNP ? 'NP' : (aprobada ? 'Aprobada' : 'Reprobada'));
          const optsHtml = _optsCalificacion(rawCal);
          html += `<tr style="background:${rowBg};">
    <td style="text-align:center;color:#bbb;">${i + 1}</td>
    <td>${m.nombre}</td>
    <td style="text-align:center;">
      <select id="cal_${m.id}"
        style="width:80px;padding:8px;border:2px solid #ddd;border-radius:5px;text-align:center;font-size:1.1rem;font-weight:bold;cursor:pointer;">
        ${optsHtml}
      </select>
    </td>
    <td style="text-align:center;">
      <span id="chip_${m.id}" class="estado" style="background:${chipBg};color:${chipColor};">${chipTxt}</span>
    </td>
  </tr>`;

        } else {
          // ── Semestre futuro o sin periodo definido: solo lectura normal ────
          const sinCap   = rawCal === null;
          const esNP     = rawCal === 'NP';
          const calNum   = (!sinCap && !esNP) ? Number(rawCal) : null;
          const aprobada = calNum !== null && calNum >= 6;
          const rowBg    = sinCap ? '' : (esNP ? '#fff8f0' : (aprobada ? '#f0fdf4' : '#fff5f5'));
          const chipBg   = sinCap ? '#f5f5f5' : (esNP ? '#fff3e0' : (aprobada ? '#e8f5e9' : '#ffebee'));
          const chipColor= sinCap ? '#888'     : (esNP ? '#e65100' : (aprobada ? '#2e7d32' : '#c62828'));
          const chipTxt  = sinCap ? 'Sin captura' : (esNP ? 'NP' : (aprobada ? 'Aprobada' : 'Reprobada'));
          const calStr   = sinCap ? '-' : String(rawCal);
          html += `<tr style="background:${rowBg};">
    <td style="text-align:center;color:#bbb;">${i + 1}</td>
    <td>${m.nombre}</td>
    <td style="text-align:center;font-weight:bold;font-size:1.1rem;color:#667eea;">${calStr}</td>
    <td style="text-align:center;"><span class="estado" style="background:${chipBg};color:${chipColor};">${chipTxt}</span></td>
  </tr>`;
        }
      });

      html += '</tbody></table>';
    });

    html += `</div>
<script>
const _AID = '${alumnoId}';

function _actualizarChip(chip, val) {
  if (!val) {
    chip.style.background='#f5f5f5'; chip.style.color='#888'; chip.textContent='Sin captura';
  } else if (val === 'NP') {
    chip.style.background='#fff3e0'; chip.style.color='#e65100'; chip.textContent='NP';
  } else {
    const n = parseInt(val, 10);
    if (n >= 6) { chip.style.background='#e8f5e9'; chip.style.color='#2e7d32'; chip.textContent='Aprobada'; }
    else        { chip.style.background='#ffebee'; chip.style.color='#c62828'; chip.textContent='Reprobada'; }
  }
}

function guardarTodosCambios() {
  const btn = document.getElementById('btnGuardar');
  if (!btn) return;
  const cambios = [];
  document.querySelectorAll('select[id^="cal_"]').forEach(function(sel) {
    cambios.push({ mid: sel.id.slice(4), val: sel.value });
  });
  if (!cambios.length) return;
  if (!window.opener || window.opener.closed) {
    alert('La ventana principal se cerró. Cierra esta boleta y ábrela de nuevo.');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  window.opener.guardarBatchCalBoleta(_AID, cambios, function(ok, err) {
    btn.disabled = false;
    if (ok) {
      btn.textContent = '✓ Guardado';
      cambios.forEach(function(c) {
        var chip = document.getElementById('chip_' + c.mid);
        if (chip) _actualizarChip(chip, c.val);
      });
      setTimeout(function(){ btn.textContent = 'Guardar Cambios'; }, 2000);
    } else {
      btn.textContent = 'Guardar Cambios';
      alert('Error al guardar: ' + err);
    }
  });
}

function descargarPDF() {
  // pendiente
}
<\/script>
</body></html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();

  } catch (error) {
    console.error('Error en verBoletaGlobalAlumno:', error);
    _escribirError(w, error.message);
  }
}

function _escribirError(w, msg) {
  try {
    w.document.open();
    w.document.write(`<html><body style="font-family:sans-serif;padding:40px;"><h2 style="color:red;margin-bottom:12px;">Error</h2><p>${msg}</p><br><button onclick="window.close()">Cerrar</button></body></html>`);
    w.document.close();
  } catch (_) {}
}

// Guarda todas las calificaciones editadas en batch desde la ventana hija
window.guardarBatchCalBoleta = async function(alumnoId, cambios, callback) {
  try {
    const batch = db.batch();
    for (const { mid, val } of cambios) {
      let promedio;
      if (!val) {
        promedio = null;
      } else if (val.toUpperCase() === 'NP') {
        promedio = 'NP';
      } else {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 0 || num > 10) throw new Error('Calificación inválida: ' + val);
        promedio = num;
      }
      batch.set(
        db.collection('calificaciones').doc(`${alumnoId}_${mid}`),
        { promedio, fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
    callback(true, null);
  } catch (e) {
    callback(false, e.message);
  }
};
