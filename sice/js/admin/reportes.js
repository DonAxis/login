// reportes.js
// Reporte: Materias, Alumnos por carrera/periodo, Profesores por carrera
// Con generación de PDF

let reporteMaterias = null;
let reporteUsuarios = null;

// ===== ABRIR / CERRAR =====
function mostrarReportes() {
  document.getElementById('modalReportes').style.display = 'block';
  cargarReporte();
}
function cerrarReportes() {
  document.getElementById('modalReportes').style.display = 'none';
}

// ===== CARGAR REPORTE =====
async function cargarReporte() {
  const contMaterias = document.getElementById('reporteMateriasContenido');
  const contAlumnos = document.getElementById('reporteAlumnosContenido');
  const contProfesores = document.getElementById('reporteProfesoresContenido');
  const contResumen = document.getElementById('reporteResumenContenido');

  contMaterias.innerHTML = loading();
  contAlumnos.innerHTML = loading();
  contProfesores.innerHTML = loading();
  contResumen.innerHTML = loading();

  // Cargar carreras para nombres
  let carrerasMap = {};
  try {
    const snapCarreras = await db.collection('carreras').get();
    snapCarreras.forEach(doc => {
      carrerasMap[doc.id] = doc.data().nombre || doc.id;
    });
  } catch (e) { console.error('Error carreras:', e); }

  // ===== MATERIAS =====
  try {
    const snap = await db.collection('materias').get();
    const porCarrera = {};
    let total = 0;
    snap.forEach(doc => {
      total++;
      const cId = doc.data().carreraId || 'Sin carrera';
      porCarrera[cId] = (porCarrera[cId] || 0) + 1;
    });
    const carrerasOrdenadas = Object.keys(porCarrera).sort();
    reporteMaterias = { total, porCarrera, carrerasOrdenadas };

    // Lista horizontal compacta
    let items = carrerasOrdenadas.map(cId => {
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0f0f8;padding:4px 10px;border-radius:16px;font-size:0.8rem;white-space:nowrap;">
        <strong style="color:#667eea;">${cId}</strong><span style="color:#555;">${porCarrera[cId]}</span>
      </span>`;
    }).join(' ');

    contMaterias.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">${total}</span>
        <span style="font-size:0.85rem;color:#555;">materias en total</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${items}</div>
    `;
  } catch (e) {
    contMaterias.innerHTML = err(e);
  }

  // ===== USUARIOS =====
  try {
    const snap = await db.collection('usuarios').get();
    const porRol = {};
    const alumnosPorCarreraPeriodo = {}; // { carreraId: { periodo: count } }
    const profesoresPorCarrera = {};     // { carreraId: count }
    let totalUsuarios = 0;
    let totalAlumnos = 0;
    let totalProfesores = 0;

    snap.forEach(doc => {
      totalUsuarios++;
      const data = doc.data();
      const rol = data.rol || 'sin rol';
      porRol[rol] = (porRol[rol] || 0) + 1;

      // Alumnos: agrupar por carreraId → periodo
      if (rol === 'alumno') {
        totalAlumnos++;
        const cId = data.carreraId || 'Sin carrera';
        const periodo = data.periodo || 'Sin periodo';
        if (!alumnosPorCarreraPeriodo[cId]) alumnosPorCarreraPeriodo[cId] = {};
        alumnosPorCarreraPeriodo[cId][periodo] = (alumnosPorCarreraPeriodo[cId][periodo] || 0) + 1;
      }

      // Profesores: agrupar por cada carreraId en el arreglo carreras
      if (rol === 'profesor' || (rol === 'coordinador' && data.roles && data.roles.includes('profesor'))) {
        totalProfesores++;
        if (data.carreras && Array.isArray(data.carreras)) {
          data.carreras.forEach(c => {
            const cId = c.carreraId || 'Sin carrera';
            profesoresPorCarrera[cId] = (profesoresPorCarrera[cId] || 0) + 1;
          });
        } else if (data.carreraId) {
          profesoresPorCarrera[data.carreraId] = (profesoresPorCarrera[data.carreraId] || 0) + 1;
        } else {
          profesoresPorCarrera['Sin carrera'] = (profesoresPorCarrera['Sin carrera'] || 0) + 1;
        }
      }
    });

    reporteUsuarios = { total: totalUsuarios, porRol, alumnosPorCarreraPeriodo, profesoresPorCarrera, totalAlumnos, totalProfesores };

    // ===== RESUMEN ROLES =====
    const rolesConfig = {
      'admin':               { label: 'Admins', color: '#c62828' },
      'coordinador':         { label: 'Coords', color: '#2e7d32' },
      'profesor':            { label: 'Profes', color: '#1565c0' },
      'alumno':              { label: 'Alumnos', color: '#7b1fa2' },
      'controlEscolar':      { label: 'Ctrl.Esc', color: '#ef6c00' },
      'controlCaja':         { label: 'Ctrl.Caja', color: '#2e7d32' },
      'coordinadorAcademia': { label: 'Coord.Acad', color: '#5e35b1' }
    };
    const ordenRoles = ['admin', 'coordinador', 'profesor', 'alumno', 'controlEscolar', 'controlCaja', 'coordinadorAcademia'];
    const rolesSorted = Object.keys(porRol).sort((a, b) => {
      const iA = ordenRoles.indexOf(a); const iB = ordenRoles.indexOf(b);
      if (iA === -1 && iB === -1) return a.localeCompare(b);
      if (iA === -1) return 1; if (iB === -1) return -1;
      return iA - iB;
    });

    let resumenItems = rolesSorted.map(rol => {
      const cfg = rolesConfig[rol] || { label: rol, color: '#333' };
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;padding:4px 10px;border-radius:16px;font-size:0.8rem;white-space:nowrap;">
        <strong style="color:${cfg.color};">${cfg.label}</strong><span style="color:#555;">${porRol[rol]}</span>
      </span>`;
    }).join(' ');

    contResumen.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">${totalUsuarios}</span>
        <span style="font-size:0.85rem;color:#555;">usuarios en total</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${resumenItems}</div>
    `;

    // ===== ALUMNOS POR CARRERA / PERIODO =====
    const carrerasAlumno = Object.keys(alumnosPorCarreraPeriodo).sort();
    let htmlAlumnos = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="background:linear-gradient(135deg,#7b1fa2,#9c27b0);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">${totalAlumnos}</span>
        <span style="font-size:0.85rem;color:#555;">alumnos en total</span>
      </div>
    `;

    carrerasAlumno.forEach(cId => {
      const periodos = alumnosPorCarreraPeriodo[cId];
      const periodosOrdenados = Object.keys(periodos).sort((a, b) => {
        const na = parseInt(a) || 0; const nb = parseInt(b) || 0;
        return na - nb;
      });
      const totalCarrera = Object.values(periodos).reduce((s, v) => s + v, 0);
      const nombreCarrera = carrerasMap[cId] || cId;

      let periodoChips = periodosOrdenados.map(p => {
        return `<span style="display:inline-flex;align-items:center;gap:3px;background:#f3e5f5;padding:3px 8px;border-radius:12px;font-size:0.75rem;">
          <strong style="color:#7b1fa2;">P${p}</strong><span style="color:#555;">${periodos[p]}</span>
        </span>`;
      }).join(' ');

      htmlAlumnos += `
        <div style="margin-bottom:8px;padding:8px 10px;background:#fafafa;border-radius:8px;border-left:3px solid #7b1fa2;">
          <div style="font-weight:700;color:#333;font-size:0.85rem;margin-bottom:4px;">
            ${nombreCarrera} <span style="color:#7b1fa2;font-size:0.8rem;">(${cId})</span>
            <span style="float:right;color:#7b1fa2;font-weight:700;">${totalCarrera}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${periodoChips}</div>
        </div>
      `;
    });

    contAlumnos.innerHTML = htmlAlumnos;

    // ===== PROFESORES POR CARRERA =====
    const carrerasProf = Object.keys(profesoresPorCarrera).sort();
    let htmlProfes = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="background:linear-gradient(135deg,#1565c0,#1976d2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">${totalProfesores}</span>
        <span style="font-size:0.85rem;color:#555;">profesores en total</span>
        <span style="font-size:0.75rem;color:#999;">(puede repetir por multi-carrera)</span>
      </div>
    `;

    carrerasProf.forEach(cId => {
      const cant = profesoresPorCarrera[cId];
      const nombreCarrera = carrerasMap[cId] || cId;
      htmlProfes += `
        <div style="display:inline-flex;align-items:center;gap:6px;background:#e3f2fd;padding:6px 12px;border-radius:8px;border-left:3px solid #1565c0;margin:0 6px 6px 0;font-size:0.85rem;">
          <strong style="color:#1565c0;">${cId}</strong>
          <span style="color:#555;">${cant}</span>
        </div>
      `;
    });

    contProfesores.innerHTML = htmlProfes;

  } catch (e) {
    contAlumnos.innerHTML = err(e);
    contProfesores.innerHTML = err(e);
    contResumen.innerHTML = err(e);
  }
}

function loading() { return '<div style="text-align:center;padding:12px;color:#999;font-size:0.85rem;">Cargando...</div>'; }
function err(e) { return `<div style="color:#d32f2f;padding:12px;font-size:0.85rem;">Error: ${e.message}</div>`; }

// ===== PDF (sin cambios por ahora, se ajustará después) =====
async function descargarReportePDF() {
  alert('PDF pendiente de ajuste. Por ahora revisa los datos en pantalla.');
}

console.log('reportes.js cargado v3');