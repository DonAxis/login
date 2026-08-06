/*console.log('=== Iniciando Panel de Coordinador ===');
console.log('core.js debe estar cargado');
console.log('utils.js debe estar cargado');
console.log('modules.js debe estar cargado');
console.log('coordinador.js iniciando...');
*/
// Verificar que las dependencias estén cargadas
if (typeof auth === 'undefined') {
    console.error('ERROR: core.js no está cargado correctamente');
}

// ===== INICIALIZACIÓN AL CARGAR LA PÁGINA =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, verificando autenticación...');
});

// ===== SISTEMA DE BOTÓN DE ACADEMIA (SIN setInterval) =====
// Usar un MutationObserver o definir una función global que coordinaCore.js debe llamar

// Opción 1: Función global para que coordinaCore.js la llame
window.inicializarBotonAcademia = function() {
    if (typeof window.mostrarBotonAcademiaSegunUsuario === 'function') {
        window.mostrarBotonAcademiaSegunUsuario();
    }
};

// Opción 2: Observador de cambios en window.usuarioActual (sin polling)
Object.defineProperty(window, '_usuarioActual', {
    set: function(valor) {
        this._usuarioActualValue = valor;
        // Cuando se asigne usuarioActual, mostrar botón automáticamente
        if (valor && typeof window.mostrarBotonAcademiaSegunUsuario === 'function') {
            window.mostrarBotonAcademiaSegunUsuario();
        }
    },
    get: function() {
        return this._usuarioActualValue;
    },
    configurable: true
});

// Si coordinaCore.js ya asignó usuarioActual antes de que este código se ejecutara
if (typeof usuarioActual !== 'undefined' && usuarioActual) {
    window.inicializarBotonAcademia();
}

console.log('Panel de Coordinador cargado exitosamente');

// ===== AUDITORÍA MATERIAS TIAC =====

const _TIAC_CARRERAS_DESTINO = ['TA', 'TC', 'TI', 'TT'];
const _TIAC_NOMBRES_CARRERAS = {
  TA: 'Técnico en Administración',
  TC: 'Técnico en Contaduría',
  TI: 'Técnico en Informática',
  TT: 'Técnico en Admon. Emp. Turísticas'
};
let _tiacProblemRows = [];

function _tiacNormalizar(s) {
  return (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

async function auditarMateriasTiac(btn) {
  const resultado = document.getElementById('tiacAuditResultado');
  resultado.innerHTML = '<p style="color:#888;">Consultando Firebase...</p>';
  if (btn) btn.disabled = true;

  try {
    const [tiacSnap, ...destinoSnaps] = await Promise.all([
      db.collection('materias').where('carreraId', '==', 'TIAC').get(),
      ..._TIAC_CARRERAS_DESTINO.map(c => db.collection('materias').where('carreraId', '==', c).get())
    ]);

    const tiacMaterias = tiacSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre, 'es'));

    const destinoMaterias = {};
    _TIAC_CARRERAS_DESTINO.forEach((c, i) => {
      destinoMaterias[c] = destinoSnaps[i].docs.map(d => ({ id: d.id, ...d.data() }));
    });

    let cntOk = 0, cntSinMatch = 0;

    // norm y exacto son ambos ✅ — solo 'none' es problema real
    const filas = tiacMaterias.map(tm => {
      const nmTiac = _tiacNormalizar(tm.nombre);
      const cols = _TIAC_CARRERAS_DESTINO.map(c => {
        const exacto = destinoMaterias[c].find(m => m.nombre === tm.nombre);
        if (exacto) return { status: 'ok' };
        const norm = destinoMaterias[c].find(m => _tiacNormalizar(m.nombre) === nmTiac);
        if (norm) return { status: 'ok' };
        return { status: 'none' };
      });

      const tieneSinMatch = cols.some(c => c.status === 'none');
      if (tieneSinMatch) cntSinMatch++;
      else cntOk++;

      return {
        tm,
        cols,
        faltantes: _TIAC_CARRERAS_DESTINO.filter((c, i) => cols[i].status === 'none')
      };
    });

    _tiacProblemRows = filas.filter(f => f.faltantes.length > 0);

    const headCols = _TIAC_CARRERAS_DESTINO.map(c =>
      `<th style="padding:9px 10px;background:#4a148c;color:white;border:1px solid #666;font-size:0.82rem;min-width:90px;">${c}<br><small style="font-weight:400;">${_TIAC_NOMBRES_CARRERAS[c]}</small></th>`
    ).join('');

    let tablaHtml = '';
    if (_tiacProblemRows.length > 0) {
      const trs = _tiacProblemRows.map(({ tm, cols, faltantes }, idx) => {
        const celdas = cols.map(col =>
          col.status === 'ok'
            ? `<td style="background:#e8f5e9;color:#2e7d32;text-align:center;padding:7px;">✅</td>`
            : `<td style="background:#ffebee;color:#c62828;text-align:center;padding:7px;font-weight:700;">❌</td>`
        ).join('');
        return `<tr>
          <td style="padding:8px 10px;border:1px solid #ddd;font-weight:600;font-size:0.88rem;">${tm.nombre}</td>
          <td style="padding:8px 10px;border:1px solid #ddd;color:#999;font-size:0.8rem;">${tm.codigo || '—'}</td>
          ${celdas}
          <td style="padding:8px 10px;border:1px solid #ddd;text-align:center;">
            <button id="btnAgregar_${idx}" onclick="agregarMateriaFaltante(${idx}, this)"
              style="padding:5px 12px;background:#7b1fa2;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;white-space:nowrap;">
              Agregar en ${faltantes.join(', ')}
            </button>
          </td>
        </tr>`;
      }).join('');

      tablaHtml = `
        <h4 style="color:#c62828;margin:20px 0 8px;">❌ Materias sin coincidencia en alguna carrera</h4>
        <table style="border-collapse:collapse;width:100%;background:white;">
          <thead><tr>
            <th style="padding:9px 10px;background:#37474f;color:white;border:1px solid #555;text-align:left;">Materia TIAC</th>
            <th style="padding:9px 10px;background:#37474f;color:white;border:1px solid #555;text-align:left;">Código</th>
            ${headCols}
            <th style="padding:9px 10px;background:#37474f;color:white;border:1px solid #555;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${trs}</tbody>
        </table>`;
    }

    const chips = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="padding:7px 16px;border-radius:20px;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:0.88rem;">✅ Presentes en las 4 carreras: ${cntOk}</span>
        <span style="padding:7px 16px;border-radius:20px;background:#ffebee;color:#c62828;font-weight:700;font-size:0.88rem;">❌ Faltante en alguna carrera: ${cntSinMatch}</span>
      </div>`;

    const okMsg = cntSinMatch === 0
      ? `<p style="color:#2e7d32;font-weight:700;margin-top:16px;">🎉 Todas las materias (${tiacMaterias.length}) están presentes en las 4 carreras.</p>`
      : '';

    resultado.innerHTML = `
      <p style="color:#555;margin-bottom:12px;">Total materias TIAC: <strong>${tiacMaterias.length}</strong></p>
      ${chips}${tablaHtml}${okMsg}`;

  } catch (e) {
    resultado.innerHTML = `<p style="color:#c62828;">Error: ${e.message}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===== ALUMNOS TIAC — TRANSFERENCIA =====

const _TIAC_TURNOS = { 1: 'Matutino', 2: 'Vespertino', 3: 'Nocturno', 4: 'Sabatino' };
let _tiacAlumnosCache = {};

async function cargarAlumnosTiac(btn) {
  const lista = document.getElementById('tiacAlumnosLista');
  lista.innerHTML = '<p style="color:#888; padding:10px 0;">Cargando...</p>';
  if (btn) btn.disabled = true;

  try {
    const snap = await db.collection('usuarios')
      .where('carreraId', '==', 'TIAC')
      .where('activo', '==', true)
      .get();

    const alumnos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => Number(a.periodo) >= 2)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre, 'es'));

    _tiacAlumnosCache = {};
    alumnos.forEach(a => { _tiacAlumnosCache[a.id] = a; });

    if (!alumnos.length) {
      lista.innerHTML = '<p style="color:#888; text-align:center; padding:30px;">No hay alumnos de TIAC en semestre ≥ 2.</p>';
      return;
    }

    const rows = alumnos.map(a => `
      <div id="rowTiac_${a.id}" style="background:white; border:1px solid #e0e0e0; border-radius:8px; margin-bottom:8px; overflow:hidden;">
        <div style="display:flex; align-items:center; padding:12px 16px; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <div style="font-weight:700; color:#222; font-size:0.95rem;">${a.nombre || '—'}</div>
            <div style="font-size:0.82rem; color:#888; margin-top:3px;">
              Matrícula: <strong>${a.matricula || '—'}</strong> &nbsp;|&nbsp;
              Semestre: <strong>${a.periodo || '?'}</strong> &nbsp;|&nbsp;
              Grupo: ${a.codigoGrupo || '—'}
            </div>
          </div>
          <button onclick="mostrarFormTransferTiac('${a.id}', this)"
            style="padding:7px 18px; background:#7b1fa2; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.88rem; white-space:nowrap;">
            Transferir →
          </button>
        </div>
        <div id="formTiac_${a.id}" style="display:none;"></div>
      </div>
    `).join('');

    lista.innerHTML = `<p style="color:#666; margin-bottom:12px; font-size:0.88rem;">${alumnos.length} alumno(s) en semestre ≥ 2</p>${rows}`;

  } catch (e) {
    lista.innerHTML = `<p style="color:#c62828;">Error: ${e.message}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

let _tiacGrupoSeleccionado = {}; // uid → { grupoId, codigoGrupo, turno }

function mostrarFormTransferTiac(uid, btnEl) {
  const formDiv = document.getElementById(`formTiac_${uid}`);
  if (!formDiv) return;

  if (formDiv.style.display !== 'none') {
    formDiv.style.display = 'none';
    btnEl.textContent = 'Transferir →';
    btnEl.style.background = '#7b1fa2';
    return;
  }

  btnEl.textContent = 'Cancelar ✕';
  btnEl.style.background = '#757575';

  formDiv.innerHTML = `
    <div style="padding:16px 20px; background:#f3e5f5; border-top:1px solid #ce93d8;">
      <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:12px; align-items:end;">
        <div>
          <label style="display:block; font-weight:600; font-size:0.83rem; color:#4a148c; margin-bottom:5px;">Carrera destino</label>
          <select id="selCarreraTiac_${uid}" onchange="cargarInfoDestinoTiac('${uid}', this.value)"
            style="width:100%; padding:9px; border:2px solid #ce93d8; border-radius:6px; font-size:0.9rem; background:white;">
            <option value="">Seleccionar carrera...</option>
            <option value="TA">Técnico en Administración</option>
            <option value="TC">Técnico en Contaduría</option>
            <option value="TI">Técnico en Informática</option>
            <option value="TT">Técnico en Admon. Emp. Turísticas</option>
          </select>
        </div>
        <div id="infoDestinoTiac_${uid}" style="background:white; border:2px solid #ce93d8; border-radius:6px; padding:9px 12px; font-size:0.85rem; color:#888; min-height:42px; display:flex; flex-direction:column; justify-content:center;">
          Elige la carrera para ver grupo y periodo
        </div>
        <button onclick="ejecutarTransferenciaTiac('${uid}', this)"
          style="padding:10px 20px; background:linear-gradient(135deg,#1b5e20,#2e7d32); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.9rem; white-space:nowrap;">
          Confirmar
        </button>
      </div>
    </div>`;

  formDiv.style.display = 'block';
}

async function cargarInfoDestinoTiac(uid, carreraId) {
  const infoDiv = document.getElementById(`infoDestinoTiac_${uid}`);
  if (!infoDiv) return;

  delete _tiacGrupoSeleccionado[uid];

  if (!carreraId) {
    infoDiv.innerHTML = 'Elige la carrera para ver grupo y periodo';
    infoDiv.style.color = '#888';
    return;
  }

  infoDiv.innerHTML = '<em style="color:#aaa;">Cargando...</em>';

  try {
    const configDoc = await db.collection('config').doc(`periodo_${carreraId}`).get();
    const periodoActual = configDoc.exists ? configDoc.data().periodo : '—';
    const codigoGrupo = `${carreraId}-1301`;

    _tiacGrupoSeleccionado[uid] = { codigoGrupo, turno: '' };

    infoDiv.innerHTML = `
      <div style="color:#222; font-weight:600; margin-bottom:3px;">Grupo asignado: <span style="color:#4a148c;">${codigoGrupo}</span></div>
      <div style="color:#555; font-size:0.82rem;">Periodo actual de la carrera: <strong style="color:#6a1b9a;">${periodoActual}</strong></div>`;

  } catch (e) {
    infoDiv.innerHTML = `<span style="color:#c62828;">Error: ${e.message}</span>`;
  }
}

async function ejecutarTransferenciaTiac(uid, btnEl) {
  const alumno = _tiacAlumnosCache[uid];
  if (!alumno) return;

  const selCarrera = document.getElementById(`selCarreraTiac_${uid}`);
  const carreraDestinoId    = selCarrera?.value;
  const carreraNombreDestino = selCarrera?.selectedOptions[0]?.text || carreraDestinoId;
  const grupoData           = _tiacGrupoSeleccionado[uid];

  if (!carreraDestinoId || !grupoData) {
    alert('Selecciona la carrera destino.');
    return;
  }

  const codigoGrupoNuevo = grupoData.codigoGrupo;
  const turnoNuevo       = grupoData.turno;

  const periodoNuevo = Math.max(3, Number(alumno.periodo) || 3);

  if (!confirm(
    `¿Transferir a ${alumno.nombre}?\n\n` +
    `De: TIAC — Técnico Tronco Común\n` +
    `A:  ${carreraNombreDestino}\n` +
    `Grupo: ${codigoGrupoNuevo}   Semestre: ${periodoNuevo}\n\n` +
    `Se actualizarán: datos del alumno, calificaciones e historial académico.\n` +
    `Esta acción no se puede deshacer.`
  )) return;

  btnEl.disabled = true;
  btnEl.textContent = 'Transfiriendo...';

  try {
    const [histSnap, matDestinoSnap, carreraDestinoDoc, calSnap] = await Promise.all([
      db.collection('historialAcademico').doc(uid).get(),
      db.collection('materias').where('carreraId', '==', carreraDestinoId).get(),
      db.collection('carreras').doc(carreraDestinoId).get(),
      db.collection('calificaciones').where('alumnoId', '==', uid).get()
    ]);

    const ahora            = firebase.firestore.FieldValue.serverTimestamp();
    const carreraDestinoNombre = carreraDestinoDoc.exists ? carreraDestinoDoc.data().nombre : carreraDestinoId;

    // --- Batch 1: usuarios + calificaciones (pueden ser muchas) ---
    let batch = db.batch();
    let bc = 0;

    batch.update(db.collection('usuarios').doc(uid), {
      carreraId:          carreraDestinoId,
      periodo:            periodoNuevo,
      codigoGrupo:        codigoGrupoNuevo,
      turno:              turnoNuevo,
      fechaActualizacion: ahora
    });
    bc++;

    for (const doc of calSnap.docs) {
      batch.update(doc.ref, { carreraId: carreraDestinoId });
      if (++bc >= 490) { await batch.commit(); batch = db.batch(); bc = 0; }
    }
    if (bc > 0) await batch.commit();

    // --- Batch 2: historialAcademico ---
    const materiaIdsActuales = new Set();
    const materiasActuales   = [];

    if (histSnap.exists) {
      (histSnap.data().materias || []).forEach(m => {
        materiaIdsActuales.add(m.materiaId);
        materiasActuales.push(m);
      });
    }

    // Agregar materias de la carrera destino semestre >= 3 que no estén ya en el historial
    const materiasNuevas = [];
    matDestinoSnap.docs.forEach(doc => {
      const m = doc.data();
      if (m.activo === false) return;
      if (materiaIdsActuales.has(doc.id)) return;
      const per = Number(m.periodo) || 0;
      if (per < 3) return;
      materiasNuevas.push({
        materiaId:        doc.id,
        materiaNombre:    m.nombre || '',
        periodo:          per,
        calificacion:     null,
        acr:              null,
        periodoAcademico: null,
        valida:           true
      });
    });

    const materiasMerged = [...materiasActuales, ...materiasNuevas];
    const histRef = db.collection('historialAcademico').doc(uid);

    if (histSnap.exists) {
      await histRef.update({
        carreraId:          carreraDestinoId,
        carreraNombre:      carreraDestinoNombre,
        materias:           materiasMerged,
        fechaActualizacion: ahora
      });
    } else {
      // Sin historial previo: crear con todas las materias de la carrera destino
      const todasMaterias = matDestinoSnap.docs
        .filter(d => d.data().activo !== false)
        .map(d => ({
          materiaId:        d.id,
          materiaNombre:    d.data().nombre || '',
          periodo:          Number(d.data().periodo) || 0,
          calificacion:     null,
          acr:              null,
          periodoAcademico: null,
          valida:           true
        }));
      await histRef.set({
        alumnoId:           uid,
        alumnoNombre:       alumno.nombre    || '',
        matricula:          alumno.matricula || '',
        email:              alumno.email     || '',
        carreraId:          carreraDestinoId,
        carreraNombre:      carreraDestinoNombre,
        periodoActual:      '',
        materias:           todasMaterias,
        periodos:           [],
        fechaActualizacion: ahora
      });
    }

    // Marcar fila como completada
    const row = document.getElementById(`rowTiac_${uid}`);
    if (row) {
      row.innerHTML = `
        <div style="padding:14px 18px; background:#e8f5e9; border-left:4px solid #2e7d32; border-radius:8px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.2rem;">✅</span>
          <div>
            <strong style="color:#1b5e20;">${alumno.nombre}</strong>
            <span style="color:#555;"> transferido a </span>
            <strong>${carreraNombreDestino}</strong>
            <span style="color:#888; font-size:0.82rem;"> — ${codigoGrupoNuevo}, semestre ${periodoNuevo}</span>
          </div>
        </div>`;
    }

  } catch (e) {
    btnEl.disabled = false;
    btnEl.textContent = 'Confirmar';
    alert('Error en la transferencia: ' + e.message);
    console.error('[TransferTiac]', e);
  }
}

async function agregarMateriaFaltante(idx, btn) {
  const fila = _tiacProblemRows[idx];
  if (!fila) return;
  const { tm, faltantes } = fila;

  const nombres = faltantes.map(c => _TIAC_NOMBRES_CARRERAS[c]).join('\n• ');
  if (!confirm(`¿Agregar "${tm.nombre}" en:\n• ${nombres}\n\nSe copiará con el mismo nombre, código y créditos de TIAC.`)) return;

  btn.disabled = true;
  btn.textContent = 'Agregando...';

  try {
    const batch = db.batch();
    faltantes.forEach(carreraId => {
      batch.set(db.collection('materias').doc(), {
        nombre:        tm.nombre,
        codigo:        tm.codigo  || '',
        creditosSatca: tm.creditosSatca || 0,
        creditosTepic: tm.creditosTepic || 0,
        activo:        true,
        carreraId
      });
    });
    await batch.commit();

    btn.textContent = `✅ Agregada en ${faltantes.join(', ')}`;
    btn.style.background = '#2e7d32';
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Error — reintentar';
    alert('Error al agregar: ' + e.message);
  }
}

/*
coordinador/
├── core/
│   ├── auth.js           - Autenticación y sesión
│   ├── firebase-init.js  - Inicialización de Firebase
│   └── navigation.js     - Navegación entre secciones
│
├── modules/
│   ├── periodos.js       - Sistema de periodos
│   ├── carreras.js       - Gestión de carreras (multi-carrera)
│   ├── materias.js       - CRUD de materias
│   ├── grupos.js         - Gestión de grupos
│   ├── profesores.js     - CRUD de profesores
│   ├── alumnos.js        - CRUD de alumnos
│   ├── asignaciones.js   - Asignar profesores a materias
│   ├── calificaciones.js - Gestión de calificaciones
│   └── reportes.js       - Generación de PDFs/reportes
│
├── utils/
│   ├── ui.js            - Modales, alertas, helpers UI
│   ├── validators.js    - Validaciones
│   └── formatters.js    - Formateo de datos
│
└── coordinador-main.js  - Archivo principal que importa todos
*/