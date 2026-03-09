// reportes.js v5
// Reporte: Materias, Alumnos por carrera/periodo, Profesores por carrera
// Separa carreras de prueba (DE, PRUEBA) del resto

let reporteMaterias = null;
let reporteUsuarios = null;

const CARRERAS_PRUEBA = ['DE', 'PRUEBA'];

function esPrueba(carreraId) {
  return CARRERAS_PRUEBA.includes(carreraId);
}

// ===== ABRIR / CERRAR =====
function mostrarReportes() {
  document.getElementById('modalReportes').style.display = 'block';
  cargarReporte();
}
function cerrarReportes() {
  document.getElementById('modalReportes').style.display = 'none';
}

// ===== HELPERS =====
function loading() { return '<div style="text-align:center;padding:12px;color:#999;font-size:0.85rem;">Cargando...</div>'; }
function err(e) { return '<div style="color:#d32f2f;padding:12px;font-size:0.85rem;">Error: ' + e.message + '</div>'; }

function bloqueTestPlegable(titulo, contenidoHTML) {
  const id = 'test_' + Math.random().toString(36).substr(2, 6);
  return '<details style="margin-top:10px;border:1px dashed #ccc;border-radius:8px;padding:8px 12px;background:#fafafa;">' +
    '<summary style="cursor:pointer;font-size:0.8rem;color:#999;font-weight:600;">' + titulo + '</summary>' +
    '<div style="margin-top:8px;">' + contenidoHTML + '</div>' +
  '</details>';
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
  var carrerasMap = {};
  try {
    var snapCarreras = await db.collection('carreras').get();
    snapCarreras.forEach(function(doc) {
      carrerasMap[doc.id] = doc.data().nombre || doc.id;
    });
  } catch (e) { console.error('Error carreras:', e); }

  // ===== MATERIAS =====
  try {
    var snap = await db.collection('materias').get();
    var porCarrera = {};
    var total = 0;
    snap.forEach(function(doc) {
      total++;
      var cId = doc.data().carreraId || 'Sin carrera';
      porCarrera[cId] = (porCarrera[cId] || 0) + 1;
    });
    var carrerasOrdenadas = Object.keys(porCarrera).sort();
    reporteMaterias = { total: total, porCarrera: porCarrera, carrerasOrdenadas: carrerasOrdenadas };

    var reales = carrerasOrdenadas.filter(function(c) { return !esPrueba(c); });
    var pruebas = carrerasOrdenadas.filter(function(c) { return esPrueba(c); });
    var totalReal = reales.reduce(function(s, c) { return s + porCarrera[c]; }, 0);

    function chipMateria(cId) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:#f0f0f8;padding:4px 10px;border-radius:16px;font-size:0.8rem;white-space:nowrap;">' +
        '<strong style="color:#667eea;">' + cId + '</strong><span style="color:#555;">' + porCarrera[cId] + '</span>' +
      '</span>';
    }

    var itemsReales = reales.map(chipMateria).join(' ');
    var itemsPrueba = pruebas.map(chipMateria).join(' ');

    var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<span style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalReal + '</span>' +
      '<span style="font-size:0.85rem;color:#555;">materias</span>' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + itemsReales + '</div>';

    if (pruebas.length > 0) {
      html += bloqueTestPlegable('🧪 Carreras de prueba (' + (total - totalReal) + ' materias)', '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + itemsPrueba + '</div>');
    }

    contMaterias.innerHTML = html;
  } catch (e) {
    contMaterias.innerHTML = err(e);
  }

  // ===== USUARIOS =====
  try {
    var snapU = await db.collection('usuarios').get();
    var porRol = {};
    var alumnosPorCarreraPeriodo = {};
    var profesoresPorCarrera = {};
    var totalUsuarios = 0;
    var totalAlumnos = 0;
    var totalProfesores = 0;

    snapU.forEach(function(doc) {
      totalUsuarios++;
      var data = doc.data();
      var rol = data.rol || 'sin rol';
      porRol[rol] = (porRol[rol] || 0) + 1;

      // Alumnos
      if (rol === 'alumno') {
        totalAlumnos++;
        var cId = data.carreraId || 'Sin carrera';
        var periodo = data.periodo || 'Sin periodo';
        if (!alumnosPorCarreraPeriodo[cId]) alumnosPorCarreraPeriodo[cId] = {};
        alumnosPorCarreraPeriodo[cId][periodo] = (alumnosPorCarreraPeriodo[cId][periodo] || 0) + 1;
      }

      // Profesores
      if (rol === 'profesor' || (rol === 'coordinador' && data.roles && data.roles.includes('profesor'))) {
        totalProfesores++;
        var carrerasExtraidas = [];

        if (data.carreras && Array.isArray(data.carreras) && data.carreras.length > 0) {
          data.carreras.forEach(function(c) {
            if (typeof c === 'string') {
              carrerasExtraidas.push(c);
            } else if (c && c.carreraId) {
              carrerasExtraidas.push(c.carreraId);
            }
          });
        }

        if (carrerasExtraidas.length === 0 && data.carreraId) {
          carrerasExtraidas.push(data.carreraId);
        }

        carrerasExtraidas.forEach(function(cId) {
          profesoresPorCarrera[cId] = (profesoresPorCarrera[cId] || 0) + 1;
        });
      }
    });

    reporteUsuarios = {
      total: totalUsuarios, porRol: porRol,
      alumnosPorCarreraPeriodo: alumnosPorCarreraPeriodo,
      profesoresPorCarrera: profesoresPorCarrera,
      totalAlumnos: totalAlumnos, totalProfesores: totalProfesores
    };

    // ===== RESUMEN ROLES =====
    var rolesConfig = {
      'admin':               { label: 'Admins', color: '#c62828' },
      'coordinador':         { label: 'Coords', color: '#2e7d32' },
      'profesor':            { label: 'Profes', color: '#1565c0' },
      'alumno':              { label: 'Alumnos', color: '#7b1fa2' },
      'controlEscolar':      { label: 'Ctrl.Esc', color: '#ef6c00' },
      'controlCaja':         { label: 'Ctrl.Caja', color: '#388e3c' },
      'coordinadorAcademia': { label: 'Coord.Acad', color: '#5e35b1' }
    };
    var ordenRoles = ['admin', 'coordinador', 'profesor', 'alumno', 'controlEscolar', 'controlCaja', 'coordinadorAcademia'];
    var rolesSorted = Object.keys(porRol).sort(function(a, b) {
      var iA = ordenRoles.indexOf(a); var iB = ordenRoles.indexOf(b);
      if (iA === -1 && iB === -1) return a.localeCompare(b);
      if (iA === -1) return 1; if (iB === -1) return -1;
      return iA - iB;
    });

    var resumenItems = rolesSorted.map(function(rol) {
      var cfg = rolesConfig[rol] || { label: rol, color: '#333' };
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;padding:4px 10px;border-radius:16px;font-size:0.8rem;white-space:nowrap;">' +
        '<strong style="color:' + cfg.color + ';">' + cfg.label + '</strong><span style="color:#555;">' + porRol[rol] + '</span>' +
      '</span>';
    }).join(' ');

    contResumen.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<span style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalUsuarios + '</span>' +
      '<span style="font-size:0.85rem;color:#555;">usuarios en total</span>' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + resumenItems + '</div>';

    // ===== ALUMNOS POR CARRERA / PERIODO =====
    var carrerasAlumno = Object.keys(alumnosPorCarreraPeriodo).sort();
    var carrerasAlumnoReales = carrerasAlumno.filter(function(c) { return !esPrueba(c); });
    var carrerasAlumnoPrueba = carrerasAlumno.filter(function(c) { return esPrueba(c); });

    var totalAlumnosReales = 0;
    carrerasAlumnoReales.forEach(function(cId) {
      totalAlumnosReales += Object.values(alumnosPorCarreraPeriodo[cId]).reduce(function(s, v) { return s + v; }, 0);
    });

    function renderAlumnoCarrera(cId) {
      var periodos = alumnosPorCarreraPeriodo[cId];
      var periodosOrdenados = Object.keys(periodos).sort(function(a, b) {
        return (parseInt(a) || 0) - (parseInt(b) || 0);
      });
      var totalCarrera = Object.values(periodos).reduce(function(s, v) { return s + v; }, 0);
      var nombreCarrera = carrerasMap[cId] || cId;

      var periodoChips = periodosOrdenados.map(function(p) {
        return '<span style="display:inline-flex;align-items:center;gap:3px;background:#f3e5f5;padding:3px 8px;border-radius:12px;font-size:0.75rem;">' +
          '<strong style="color:#7b1fa2;">P' + p + '</strong><span style="color:#555;">' + periodos[p] + '</span>' +
        '</span>';
      }).join(' ');

      return '<div style="margin-bottom:8px;padding:8px 10px;background:#fafafa;border-radius:8px;border-left:3px solid #7b1fa2;">' +
        '<div style="font-weight:700;color:#333;font-size:0.85rem;margin-bottom:4px;">' +
          nombreCarrera + ' <span style="color:#7b1fa2;font-size:0.8rem;">(' + cId + ')</span>' +
          '<span style="float:right;color:#7b1fa2;font-weight:700;">' + totalCarrera + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + periodoChips + '</div>' +
      '</div>';
    }

    var htmlAlumnos = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
      '<span style="background:linear-gradient(135deg,#7b1fa2,#9c27b0);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalAlumnosReales + '</span>' +
      '<span style="font-size:0.85rem;color:#555;">alumnos</span>' +
    '</div>';

    carrerasAlumnoReales.forEach(function(cId) { htmlAlumnos += renderAlumnoCarrera(cId); });

    if (carrerasAlumnoPrueba.length > 0) {
      var totalPrueba = 0;
      var pruebaHTML = '';
      carrerasAlumnoPrueba.forEach(function(cId) {
        totalPrueba += Object.values(alumnosPorCarreraPeriodo[cId]).reduce(function(s, v) { return s + v; }, 0);
        pruebaHTML += renderAlumnoCarrera(cId);
      });
      htmlAlumnos += bloqueTestPlegable('🧪 Carreras de prueba (' + totalPrueba + ' alumnos)', pruebaHTML);
    }

    contAlumnos.innerHTML = htmlAlumnos;

    // ===== PROFESORES POR CARRERA =====
    var carrerasProf = Object.keys(profesoresPorCarrera).sort();
    var carrerasProfReales = carrerasProf.filter(function(c) { return !esPrueba(c); });
    var carrerasProfPrueba = carrerasProf.filter(function(c) { return esPrueba(c); });

    function chipProfe(cId) {
      return '<div style="display:inline-flex;align-items:center;gap:6px;background:#e3f2fd;padding:6px 12px;border-radius:8px;border-left:3px solid #1565c0;margin:0 6px 6px 0;font-size:0.85rem;">' +
        '<strong style="color:#1565c0;">' + cId + '</strong>' +
        '<span style="color:#555;">' + profesoresPorCarrera[cId] + '</span>' +
      '</div>';
    }

    var htmlProfes = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
      '<span style="background:linear-gradient(135deg,#1565c0,#1976d2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalProfesores + '</span>' +
      '<span style="font-size:0.85rem;color:#555;">profesores en total</span>' +
      '<span style="font-size:0.75rem;color:#999;">(puede repetir por multi-carrera)</span>' +
    '</div><div>';

    carrerasProfReales.forEach(function(cId) { htmlProfes += chipProfe(cId); });
    htmlProfes += '</div>';

    if (carrerasProfPrueba.length > 0) {
      var pruebaProfeHTML = '<div>';
      carrerasProfPrueba.forEach(function(cId) { pruebaProfeHTML += chipProfe(cId); });
      pruebaProfeHTML += '</div>';
      htmlProfes += bloqueTestPlegable('🧪 Carreras de prueba', pruebaProfeHTML);
    }

    contProfesores.innerHTML = htmlProfes;

  } catch (e) {
    contAlumnos.innerHTML = err(e);
    contProfesores.innerHTML = err(e);
    contResumen.innerHTML = err(e);
  }
}

// ===== PDF (pendiente) =====
async function descargarReportePDF() {
  alert('PDF pendiente de ajuste. Por ahora revisa los datos en pantalla.');
}

console.log('reportes.js cargado v5');