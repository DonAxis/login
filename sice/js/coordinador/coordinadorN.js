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
async function auditarMateriasTiac(btn) {
  const CARRERAS_DESTINO = ['TA', 'TC', 'TI', 'TT'];
  const NOMBRES_CARRERAS = {
    TA: 'Técnico en Administración',
    TC: 'Técnico en Contaduría',
    TI: 'Técnico en Informática',
    TT: 'Técnico en Admon. Emp. Turísticas'
  };

  function normalizar(s) {
    return (s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
  }

  const resultado = document.getElementById('tiacAuditResultado');
  resultado.innerHTML = '<p style="color:#888;">Consultando Firebase...</p>';
  if (btn) btn.disabled = true;

  try {
    const [tiacSnap, ...destinoSnaps] = await Promise.all([
      db.collection('materias').where('carreraId', '==', 'TIAC').get(),
      ...CARRERAS_DESTINO.map(c => db.collection('materias').where('carreraId', '==', c).get())
    ]);

    const tiacMaterias = tiacSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre, 'es'));

    const destinoMaterias = {};
    CARRERAS_DESTINO.forEach((c, i) => {
      destinoMaterias[c] = destinoSnaps[i].docs.map(d => ({ id: d.id, ...d.data() }));
    });

    let cntExactas = 0, cntNorm = 0, cntSinMatch = 0;

    const filas = tiacMaterias.map(tm => {
      const nmTiac = normalizar(tm.nombre);
      const cols = CARRERAS_DESTINO.map(c => {
        const exacto = destinoMaterias[c].find(m => m.nombre === tm.nombre);
        if (exacto) return { status: 'exacto' };
        const norm = destinoMaterias[c].find(m => normalizar(m.nombre) === nmTiac);
        if (norm) return { status: 'norm', nombre: norm.nombre };
        return { status: 'none' };
      });

      const tieneSinMatch = cols.some(c => c.status === 'none');
      const tieneNorm     = cols.some(c => c.status === 'norm');
      if (tieneSinMatch) cntSinMatch++;
      else if (tieneNorm) cntNorm++;
      else cntExactas++;

      return { tm, cols };
    });

    // Render
    const headCols = CARRERAS_DESTINO.map(c =>
      `<th style="padding:9px 10px;background:#4a148c;color:white;border:1px solid #666;font-size:0.82rem;min-width:90px;">${c}<br><small style="font-weight:400;">${NOMBRES_CARRERAS[c]}</small></th>`
    ).join('');

    const renderSeccion = (rows, titulo, color) => {
      if (!rows.length) return '';
      const trs = rows.map(({ tm, cols }) => {
        const celdas = cols.map(col => {
          if (col.status === 'exacto') return `<td style="background:#e8f5e9;color:#2e7d32;text-align:center;padding:7px;">✅</td>`;
          if (col.status === 'norm')   return `<td style="background:#fff8e1;color:#e65100;text-align:center;padding:7px;font-size:0.78rem;" title="En destino: «${col.nombre}»">⚠️<br>${col.nombre}</td>`;
          return `<td style="background:#ffebee;color:#c62828;text-align:center;padding:7px;font-weight:700;">❌</td>`;
        }).join('');
        return `<tr>
          <td style="padding:8px 10px;border:1px solid #ddd;font-weight:600;font-size:0.88rem;">${tm.nombre}</td>
          <td style="padding:8px 10px;border:1px solid #ddd;color:#999;font-size:0.8rem;">${tm.codigo || '—'}</td>
          ${celdas}
        </tr>`;
      }).join('');
      return `<h4 style="color:${color};margin:20px 0 8px;">${titulo}</h4>
        <table style="border-collapse:collapse;width:100%;background:white;margin-bottom:4px;">
          <thead><tr>
            <th style="padding:9px 10px;background:#37474f;color:white;border:1px solid #555;text-align:left;">Materia TIAC</th>
            <th style="padding:9px 10px;background:#37474f;color:white;border:1px solid #555;text-align:left;">Código</th>
            ${headCols}
          </tr></thead>
          <tbody>${trs}</tbody>
        </table>`;
    };

    const chips = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="padding:7px 16px;border-radius:20px;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:0.88rem;">✅ Exactas en las 4 carreras: ${cntExactas}</span>
        <span style="padding:7px 16px;border-radius:20px;background:#fff8e1;color:#e65100;font-weight:700;font-size:0.88rem;">⚠️ Diferencia acento/mayús: ${cntNorm}</span>
        <span style="padding:7px 16px;border-radius:20px;background:#ffebee;color:#c62828;font-weight:700;font-size:0.88rem;">❌ Sin match en alguna carrera: ${cntSinMatch}</span>
      </div>`;

    const sinMatchRows  = filas.filter(({ cols }) => cols.some(c => c.status === 'none'));
    const normRows      = filas.filter(({ cols }) => cols.every(c => c.status !== 'none') && cols.some(c => c.status === 'norm'));
    const okMsg = cntExactas === tiacMaterias.length
      ? `<p style="color:#2e7d32;font-weight:700;margin-top:16px;">🎉 Todas las materias (${tiacMaterias.length}) coinciden exactamente en las 4 carreras.</p>`
      : '';

    resultado.innerHTML = `
      <p style="color:#555;margin-bottom:12px;">Total materias TIAC: <strong>${tiacMaterias.length}</strong></p>
      ${chips}
      ${renderSeccion(sinMatchRows, '❌ Sin match en alguna carrera destino', '#c62828')}
      ${renderSeccion(normRows, '⚠️ Coincidencia por normalización (acentos o mayúsculas distintos)', '#e65100')}
      ${okMsg}`;

  } catch (e) {
    resultado.innerHTML = `<p style="color:#c62828;">Error: ${e.message}</p>`;
  } finally {
    if (btn) btn.disabled = false;
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