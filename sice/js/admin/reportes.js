// reportes.js v6
// Separa activos/inactivos, nuevo ingreso (P1) vs regulares, graduados vs baja
// Roles completos incluyendo administracion y prefecto

let reporteMaterias = null;
let reporteUsuarios = null;

const CARRERAS_PRUEBA = ['DE', 'PRUEBA'];

function esPrueba(carreraId) {
  return CARRERAS_PRUEBA.includes(carreraId);
}

function mostrarReportes() {
  document.getElementById('modalReportes').style.display = 'block';
  cargarReporte();
}
function cerrarReportes() {
  document.getElementById('modalReportes').style.display = 'none';
}

function loading() { return '<div style="text-align:center;padding:12px;color:#999;font-size:0.85rem;">Cargando...</div>'; }
function err(e) { return '<div style="color:#d32f2f;padding:12px;font-size:0.85rem;">Error: ' + e.message + '</div>'; }

function bloqueTestPlegable(titulo, contenidoHTML) {
  return '<details style="margin-top:10px;border:1px dashed #ccc;border-radius:8px;padding:8px 12px;background:#fafafa;">' +
    '<summary style="cursor:pointer;font-size:0.8rem;color:#999;font-weight:600;">' + titulo + '</summary>' +
    '<div style="margin-top:8px;">' + contenidoHTML + '</div>' +
  '</details>';
}

async function cargarReporte() {
  var contResumen   = document.getElementById('reporteResumenContenido');
  var contMaterias  = document.getElementById('reporteMateriasContenido');
  var contAlumnos   = document.getElementById('reporteAlumnosContenido');
  var contExAlumnos = document.getElementById('reporteExAlumnosContenido');
  var contProfesores= document.getElementById('reporteProfesoresContenido');

  contResumen.innerHTML   = loading();
  contMaterias.innerHTML  = loading();
  contAlumnos.innerHTML   = loading();
  if (contExAlumnos) contExAlumnos.innerHTML = loading();
  contProfesores.innerHTML= loading();

  // Nombres de carrera
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

    var reales  = carrerasOrdenadas.filter(function(c) { return !esPrueba(c); });
    var pruebas = carrerasOrdenadas.filter(function(c) { return  esPrueba(c); });
    var totalReal = reales.reduce(function(s, c) { return s + porCarrera[c]; }, 0);

    function chipMateria(cId) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:#f0f0f8;padding:4px 10px;border-radius:16px;font-size:0.8rem;white-space:nowrap;">' +
        '<strong style="color:#667eea;">' + cId + '</strong><span style="color:#555;">' + porCarrera[cId] + '</span></span>';
    }

    var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<span style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalReal + '</span>' +
      '<span style="font-size:0.85rem;color:#555;">materias</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + reales.map(chipMateria).join(' ') + '</div>';

    if (pruebas.length > 0) {
      html += bloqueTestPlegable('🧪 Carreras de prueba (' + (total - totalReal) + ' materias)',
        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + pruebas.map(chipMateria).join(' ') + '</div>');
    }
    contMaterias.innerHTML = html;
  } catch (e) {
    contMaterias.innerHTML = err(e);
  }

  // ===== USUARIOS =====
  try {
    var snapU = await db.collection('usuarios').get();
    var porRol = {};

    // Activos: { carreraId: { periodo: count } }
    var alumnosActivos = {};
    // Inactivos
    var exGraduados = {}; // carreraId -> count
    var exBaja      = {}; // carreraId -> count

    var profesoresPorCarrera = {};
    var totalUsuarios  = 0;
    var totalActivos   = 0;
    var totalNI        = 0; // nuevo ingreso (periodo === 1)
    var totalReg       = 0; // regulares (periodo > 1)
    var totalGraduados = 0;
    var totalBaja      = 0;
    var totalProfesores= 0;

    snapU.forEach(function(doc) {
      totalUsuarios++;
      var data = doc.data();
      var rol = data.rol || 'sin rol';
      porRol[rol] = (porRol[rol] || 0) + 1;

      if (rol === 'alumno') {
        var cId    = data.carreraId || 'Sin carrera';
        var per    = data.periodo   || 1;
        var activo = data.activo !== false;
        var grad   = data.graduado === true;

        if (activo) {
          totalActivos++;
          if (!alumnosActivos[cId]) alumnosActivos[cId] = {};
          alumnosActivos[cId][per] = (alumnosActivos[cId][per] || 0) + 1;

          if (per <= 1) { totalNI++;  }
          else          { totalReg++; }
        } else {
          if (grad) { totalGraduados++; exGraduados[cId] = (exGraduados[cId] || 0) + 1; }
          else      { totalBaja++;      exBaja[cId]      = (exBaja[cId]      || 0) + 1; }
        }
      }

      if (rol === 'profesor' || (rol === 'coordinador' && data.roles && data.roles.includes('profesor'))) {
        totalProfesores++;
        var carrerasExtraidas = [];
        if (data.carreras && Array.isArray(data.carreras) && data.carreras.length > 0) {
          data.carreras.forEach(function(c) {
            if (typeof c === 'string') carrerasExtraidas.push(c);
            else if (c && c.carreraId) carrerasExtraidas.push(c.carreraId);
          });
        }
        if (carrerasExtraidas.length === 0 && data.carreraId) carrerasExtraidas.push(data.carreraId);
        carrerasExtraidas.forEach(function(cId) {
          profesoresPorCarrera[cId] = (profesoresPorCarrera[cId] || 0) + 1;
        });
      }
    });

    reporteUsuarios = {
      total: totalUsuarios, porRol: porRol,
      alumnosActivos: alumnosActivos,
      profesoresPorCarrera: profesoresPorCarrera,
      totalAlumnos: totalActivos, totalProfesores: totalProfesores
    };

    // ===== RESUMEN ROLES =====
    var rolesConfig = {
      'admin':               { label: 'Admins',       color: '#c62828' },
      'coordinador':         { label: 'Coords',        color: '#2e7d32' },
      'coordinadorAcademia': { label: 'Coord.Acad',   color: '#5e35b1' },
      'profesor':            { label: 'Profes',        color: '#1565c0' },
      'alumno':              { label: 'Alumnos',       color: '#7b1fa2' },
      'controlEscolar':      { label: 'Ctrl.Esc',      color: '#ef6c00' },
      'controlCaja':         { label: 'Ctrl.Caja',     color: '#388e3c' },
      'administracion':      { label: 'Administración',color: '#1a237e' },
      'prefecto':            { label: 'Prefectos',     color: '#006064' }
    };
    var ordenRoles = ['admin','coordinador','coordinadorAcademia','profesor','alumno','controlEscolar','controlCaja','administracion','prefecto'];
    var rolesSorted = Object.keys(porRol).sort(function(a, b) {
      var iA = ordenRoles.indexOf(a), iB = ordenRoles.indexOf(b);
      if (iA === -1 && iB === -1) return a.localeCompare(b);
      if (iA === -1) return 1; if (iB === -1) return -1;
      return iA - iB;
    });

    var resumenItems = rolesSorted.map(function(rol) {
      var cfg = rolesConfig[rol] || { label: rol, color: '#333' };
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;padding:4px 10px;border-radius:16px;font-size:0.8rem;white-space:nowrap;">' +
        '<strong style="color:' + cfg.color + ';">' + cfg.label + '</strong>' +
        '<span style="color:#555;">' + porRol[rol] + '</span></span>';
    }).join(' ');

    contResumen.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalUsuarios + '</span>' +
        '<span style="font-size:0.85rem;color:#555;">usuarios en total</span>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + resumenItems + '</div>';

    // ===== ALUMNOS ACTIVOS =====
    var carrerasAct = Object.keys(alumnosActivos).sort();
    var carrerasActReales = carrerasAct.filter(function(c) { return !esPrueba(c); });
    var carrerasActPrueba = carrerasAct.filter(function(c) { return  esPrueba(c); });

    var totalActivosReales = 0, totalNIReales = 0, totalRegReales = 0;
    carrerasActReales.forEach(function(cId) {
      Object.keys(alumnosActivos[cId]).forEach(function(p) {
        var n = alumnosActivos[cId][p];
        totalActivosReales += n;
        if (parseInt(p) <= 1) totalNIReales += n;
        else                  totalRegReales += n;
      });
    });

    function renderCarreraActiva(cId) {
      var periodos = alumnosActivos[cId];
      var total    = Object.values(periodos).reduce(function(s, v) { return s + v; }, 0);
      var niCar    = 0;
      var chips    = Object.keys(periodos).sort(function(a, b) { return (parseInt(a)||0)-(parseInt(b)||0); })
        .map(function(p) {
          var esNI = parseInt(p) <= 1;
          if (esNI) niCar += periodos[p];
          return '<span style="display:inline-flex;align-items:center;gap:3px;' +
            (esNI ? 'background:#e8f5e9;' : 'background:#f3e5f5;') +
            'padding:3px 8px;border-radius:12px;font-size:0.75rem;">' +
            '<strong style="color:' + (esNI ? '#2e7d32' : '#7b1fa2') + ';">P' + p + '</strong>' +
            '<span style="color:#555;">' + periodos[p] + '</span></span>';
        }).join(' ');

      var badgeNI = niCar > 0
        ? '<span style="font-size:0.72rem;background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:10px;margin-left:4px;">NI: ' + niCar + '</span>'
        : '';

      return '<div style="margin-bottom:8px;padding:8px 10px;background:#fafafa;border-radius:8px;border-left:3px solid #7b1fa2;">' +
        '<div style="font-weight:700;color:#333;font-size:0.85rem;margin-bottom:4px;">' +
          (carrerasMap[cId] || cId) + ' <span style="color:#7b1fa2;font-size:0.8rem;">(' + cId + ')</span>' + badgeNI +
          '<span style="float:right;color:#7b1fa2;font-weight:700;">' + total + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + chips + '</div></div>';
    }

    var htmlActivos =
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
        '<span style="background:linear-gradient(135deg,#7b1fa2,#9c27b0);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + totalActivosReales + '</span>' +
        '<span style="font-size:0.85rem;color:#555;">alumnos activos</span>' +
        '<span style="background:#e8f5e9;color:#2e7d32;padding:3px 10px;border-radius:8px;font-size:0.82rem;font-weight:600;">Nuevo ingreso (P1): ' + totalNIReales + '</span>' +
        '<span style="background:#f3e5f5;color:#7b1fa2;padding:3px 10px;border-radius:8px;font-size:0.82rem;font-weight:600;">Regulares: ' + totalRegReales + '</span>' +
      '</div>';

    carrerasActReales.forEach(function(cId) { htmlActivos += renderCarreraActiva(cId); });

    if (carrerasActPrueba.length > 0) {
      var tPrueba = 0, pruebaHTML = '';
      carrerasActPrueba.forEach(function(cId) {
        tPrueba += Object.values(alumnosActivos[cId]).reduce(function(s, v) { return s + v; }, 0);
        pruebaHTML += renderCarreraActiva(cId);
      });
      htmlActivos += bloqueTestPlegable('🧪 Carreras de prueba (' + tPrueba + ' alumnos)', pruebaHTML);
    }
    contAlumnos.innerHTML = htmlActivos;

    // ===== EX-ALUMNOS (inactivos) =====
    if (contExAlumnos) {
      var todasCarrerasEx = {};
      Object.keys(exGraduados).forEach(function(c) { todasCarrerasEx[c] = true; });
      Object.keys(exBaja).forEach(function(c)      { todasCarrerasEx[c] = true; });
      var carrerasExReales = Object.keys(todasCarrerasEx).filter(function(c) { return !esPrueba(c); }).sort();
      var carrerasExPrueba = Object.keys(todasCarrerasEx).filter(function(c) { return  esPrueba(c); }).sort();

      var tGradReales = carrerasExReales.reduce(function(s,c) { return s + (exGraduados[c]||0); }, 0);
      var tBajaReales = carrerasExReales.reduce(function(s,c) { return s + (exBaja[c]     ||0); }, 0);
      var tExReales   = tGradReales + tBajaReales;

      if (tExReales === 0 && carrerasExPrueba.length === 0) {
        contExAlumnos.innerHTML = '<div style="text-align:center;padding:12px;color:#999;font-size:0.85rem;">Sin ex-alumnos registrados</div>';
      } else {
        function renderCarreraEx(cId) {
          var grad  = exGraduados[cId] || 0;
          var baja  = exBaja[cId]      || 0;
          var total = grad + baja;
          return '<div style="margin-bottom:6px;padding:7px 10px;background:#fafafa;border-radius:8px;border-left:3px solid #9e9e9e;">' +
            '<div style="font-weight:700;color:#333;font-size:0.85rem;margin-bottom:3px;">' +
              (carrerasMap[cId] || cId) + ' <span style="color:#999;font-size:0.8rem;">(' + cId + ')</span>' +
              '<span style="float:right;color:#757575;font-weight:700;">' + total + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              (grad > 0 ? '<span style="font-size:0.75rem;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:10px;">Graduados: ' + grad + '</span>' : '') +
              (baja > 0 ? '<span style="font-size:0.75rem;background:#fce4ec;color:#c62828;padding:2px 8px;border-radius:10px;">Baja: '       + baja + '</span>' : '') +
            '</div></div>';
        }

        var htmlEx =
          '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
            '<span style="background:linear-gradient(135deg,#616161,#9e9e9e);color:white;padding:4px 12px;border-radius:8px;font-size:1.1rem;font-weight:700;">' + tExReales + '</span>' +
            '<span style="font-size:0.85rem;color:#555;">ex-alumnos</span>' +
            (tGradReales > 0 ? '<span style="background:#e3f2fd;color:#1565c0;padding:3px 10px;border-radius:8px;font-size:0.82rem;font-weight:600;">Graduados: ' + tGradReales + '</span>' : '') +
            (tBajaReales > 0 ? '<span style="background:#fce4ec;color:#c62828;padding:3px 10px;border-radius:8px;font-size:0.82rem;font-weight:600;">Baja: '       + tBajaReales + '</span>' : '') +
          '</div>';

        carrerasExReales.forEach(function(cId) { htmlEx += renderCarreraEx(cId); });

        if (carrerasExPrueba.length > 0) {
          var pruebaExHTML = '';
          carrerasExPrueba.forEach(function(cId) { pruebaExHTML += renderCarreraEx(cId); });
          htmlEx += bloqueTestPlegable('🧪 Carreras de prueba', pruebaExHTML);
        }
        contExAlumnos.innerHTML = htmlEx;
      }
    }

    // ===== PROFESORES POR CARRERA =====
    var carrerasProf = Object.keys(profesoresPorCarrera).sort();
    var carrerasProfReales = carrerasProf.filter(function(c) { return !esPrueba(c); });
    var carrerasProfPrueba = carrerasProf.filter(function(c) { return  esPrueba(c); });

    function chipProfe(cId) {
      return '<div style="display:inline-flex;align-items:center;gap:6px;background:#e3f2fd;padding:6px 12px;border-radius:8px;border-left:3px solid #1565c0;margin:0 6px 6px 0;font-size:0.85rem;">' +
        '<strong style="color:#1565c0;">' + cId + '</strong>' +
        '<span style="color:#555;">' + profesoresPorCarrera[cId] + '</span></div>';
    }

    var htmlProfes =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
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
    contAlumnos.innerHTML   = err(e);
    if (contExAlumnos) contExAlumnos.innerHTML = err(e);
    contProfesores.innerHTML= err(e);
    contResumen.innerHTML   = err(e);
  }
}

async function descargarReportePDF() {
  alert('PDF pendiente de ajuste. Por ahora revisa los datos en pantalla.');
}

console.log('reportes.js cargado v6');
