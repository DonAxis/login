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