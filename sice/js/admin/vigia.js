// vigia.js - Auditoría temporal de profesores
// SOLO LECTURA - no modifica la base de datos
//este es el archivo que genera un reporte de profesores, materias y alumnos

let vigiaData = null;

function accionVigia() {
  document.getElementById('modalVigia').style.display = 'block';
  ejecutarVigia();
}

function cerrarVigia() {
  document.getElementById('modalVigia').style.display = 'none';
}

async function ejecutarVigia() {
  const contProfes = document.getElementById('vigiaResultProfesores');
  const contPM = document.getElementById('vigiaResultPM');
  const contCruce = document.getElementById('vigiaResultCruce');

  contProfes.innerHTML = cargando();
  contPM.innerHTML = cargando();
  contCruce.innerHTML = cargando();

  try {
    // ===== 1. PROFESORES EN USUARIOS =====
    var snapUsuarios = await db.collection('usuarios').orderBy('nombre').get();
    var profesores = [];

    snapUsuarios.forEach(function(doc) {
      var data = doc.data();
      if (data.rol === 'profesor') {
        profesores.push({
          uid: doc.id,
          nombre: (data.nombre || '').trim(),
          email: (data.email || '').trim(),
          activo: data.activo,
          carreras: data.carreras || [],
          carreraId: data.carreraId || ''
        });
      }
    });

    // Buscar nombres duplicados
    var nombreCount = {};
    profesores.forEach(function(p) {
      var key = p.nombre.toLowerCase();
      if (!nombreCount[key]) nombreCount[key] = [];
      nombreCount[key].push(p);
    });

    var duplicados = [];
    Object.keys(nombreCount).forEach(function(key) {
      if (nombreCount[key].length > 1) {
        duplicados.push({ nombre: nombreCount[key][0].nombre, registros: nombreCount[key] });
      }
    });

    var htmlProfes = '<div style="margin-bottom:8px;">' +
      '<span style="background:#1565c0;color:white;padding:4px 12px;border-radius:8px;font-size:1rem;font-weight:700;">' + profesores.length + '</span>' +
      ' <span style="font-size:0.85rem;color:#555;">profesores con rol "profesor" en usuarios</span>' +
    '</div>';

    if (duplicados.length > 0) {
      htmlProfes += '<div style="background:#fff3e0;border-left:4px solid #ff9800;padding:10px 12px;border-radius:8px;margin-bottom:8px;">' +
        '<strong style="color:#e65100;">' + duplicados.length + ' nombre(s) duplicado(s) encontrado(s):</strong>' +
      '</div>';

      duplicados.forEach(function(dup) {
        htmlProfes += '<div style="margin-bottom:10px;padding:8px 10px;background:#fff8f0;border-radius:8px;border-left:3px solid #ff9800;">' +
          '<div style="font-weight:700;color:#e65100;font-size:0.85rem;margin-bottom:6px;">"' + dup.nombre + '" × ' + dup.registros.length + '</div>';

        dup.registros.forEach(function(r) {
          var estado = r.activo ? '<span style="color:#4caf50;">● Activo</span>' : '<span style="color:#f44336;">● Inactivo</span>';
          var carrerasStr = '';
          if (r.carreras && r.carreras.length > 0) {
            carrerasStr = r.carreras.map(function(c) { return typeof c === 'string' ? c : (c.carreraId || '?'); }).join(', ');
          } else if (r.carreraId) {
            carrerasStr = r.carreraId;
          } else {
            carrerasStr = 'sin carrera';
          }

          htmlProfes += '<div style="font-size:0.8rem;color:#555;padding:4px 0;border-bottom:1px dotted #ddd;">' +
            '<span style="color:#333;font-weight:600;">UID:</span> <span style="font-family:monospace;font-size:0.75rem;">' + r.uid + '</span> ' +
            estado + ' | ' +
            '<span style="color:#1565c0;">' + carrerasStr + '</span> | ' +
            '<span style="color:#888;">' + r.email + '</span>' +
          '</div>';
        });

        htmlProfes += '</div>';
      });
    } else {
      htmlProfes += '<div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:10px 12px;border-radius:8px;">' +
        '<strong style="color:#2e7d32;">Sin nombres duplicados</strong>' +
      '</div>';
    }

    // Lista completa plegable
    var listaHTML = '<div style="max-height:300px;overflow-y:auto;">';
    profesores.forEach(function(p, i) {
      var carrerasStr = '';
      if (p.carreras && p.carreras.length > 0) {
        carrerasStr = p.carreras.map(function(c) { return typeof c === 'string' ? c : (c.carreraId || '?'); }).join(', ');
      } else if (p.carreraId) {
        carrerasStr = p.carreraId;
      }
      var estado = p.activo ? '●' : '○';
      listaHTML += '<div style="font-size:0.75rem;padding:3px 0;border-bottom:1px solid #f0f0f0;color:#555;">' +
        '<span style="color:' + (p.activo ? '#4caf50' : '#f44336') + ';">' + estado + '</span> ' +
        (i + 1) + '. <strong>' + p.nombre + '</strong> ' +
        '<span style="color:#1565c0;">[' + carrerasStr + ']</span> ' +
        '<span style="font-family:monospace;font-size:0.7rem;color:#999;">' + p.uid.substring(0, 12) + '…</span>' +
      '</div>';
    });
    listaHTML += '</div>';

    htmlProfes += '<details style="margin-top:8px;border:1px solid #e0e0e0;border-radius:8px;padding:8px 12px;">' +
      '<summary style="cursor:pointer;font-size:0.8rem;color:#666;font-weight:600;">Lista completa de profesores (' + profesores.length + ')</summary>' +
      listaHTML +
    '</details>';

    contProfes.innerHTML = htmlProfes;

    // ===== 2. PROFESORMATERIAS =====
    var snapPM = await db.collection('profesorMaterias').get();
    var pmRegistros = [];
    var pmPorId = {};    // profesorId → count
    var pmPorNombre = {}; // profesorNombre → count

    snapPM.forEach(function(doc) {
      var data = doc.data();
      pmRegistros.push({
        docId: doc.id,
        profesorId: data.profesorId || '',
        profesorNombre: (data.profesorNombre || '').trim(),
        materiaId: data.materiaId || '',
        materiaNombre: (data.materiaNombre || '').trim()
      });

      var pid = data.profesorId || 'sin_id';
      pmPorId[pid] = (pmPorId[pid] || 0) + 1;

      var pnombre = (data.profesorNombre || 'sin_nombre').trim().toLowerCase();
      pmPorNombre[pnombre] = (pmPorNombre[pnombre] || 0) + 1;
    });

    var totalPM = pmRegistros.length;
    var uniqueIds = Object.keys(pmPorId).length;
    var uniqueNombres = Object.keys(pmPorNombre).length;
    var hayDiscrepancia = uniqueIds !== uniqueNombres;

    var htmlPM = '<div style="margin-bottom:8px;">' +
      '<span style="background:#00796b;color:white;padding:4px 12px;border-radius:8px;font-size:1rem;font-weight:700;">' + totalPM + '</span>' +
      ' <span style="font-size:0.85rem;color:#555;">registros en profesorMaterias</span>' +
    '</div>';

    htmlPM += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">';
    htmlPM += '<div style="padding:8px 14px;background:#e0f2f1;border-radius:8px;border-left:3px solid #00796b;">' +
      '<div style="font-size:0.75rem;color:#666;">Profesores únicos por <strong>profesorId</strong></div>' +
      '<div style="font-size:1.2rem;font-weight:700;color:#00796b;">' + uniqueIds + '</div>' +
    '</div>';
    htmlPM += '<div style="padding:8px 14px;background:' + (hayDiscrepancia ? '#fff3e0' : '#e0f2f1') + ';border-radius:8px;border-left:3px solid ' + (hayDiscrepancia ? '#ff9800' : '#00796b') + ';">' +
      '<div style="font-size:0.75rem;color:#666;">Profesores únicos por <strong>profesorNombre</strong></div>' +
      '<div style="font-size:1.2rem;font-weight:700;color:' + (hayDiscrepancia ? '#e65100' : '#00796b') + ';">' + uniqueNombres + '</div>' +
    '</div>';
    htmlPM += '</div>';

    if (hayDiscrepancia) {
      htmlPM += '<div style="background:#fff3e0;border-left:4px solid #ff9800;padding:10px 12px;border-radius:8px;margin-bottom:8px;">' +
        '<strong style="color:#e65100;">Discrepancia: IDs (' + uniqueIds + ') ≠ Nombres (' + uniqueNombres + ')</strong>' +
        '<div style="font-size:0.8rem;color:#795548;margin-top:4px;">Esto indica que un mismo profesor puede tener distintos IDs, o distintos profesores comparten nombre.</div>' +
      '</div>';

      // Encontrar nombres que apuntan a múltiples IDs
      var nombreAIds = {};
      pmRegistros.forEach(function(r) {
        var key = r.profesorNombre.toLowerCase();
        if (!nombreAIds[key]) nombreAIds[key] = { nombre: r.profesorNombre, ids: {} };
        nombreAIds[key].ids[r.profesorId] = true;
      });

      var nombresConMultiId = [];
      Object.keys(nombreAIds).forEach(function(key) {
        var idsArr = Object.keys(nombreAIds[key].ids);
        if (idsArr.length > 1) {
          nombresConMultiId.push({ nombre: nombreAIds[key].nombre, ids: idsArr });
        }
      });

      if (nombresConMultiId.length > 0) {
        htmlPM += '<div style="background:#fff8f0;padding:8px 10px;border-radius:8px;border-left:3px solid #ff9800;margin-bottom:8px;">' +
          '<strong style="color:#e65100;font-size:0.85rem;">Nombres con múltiples profesorId:</strong>';
        nombresConMultiId.forEach(function(item) {
          htmlPM += '<div style="font-size:0.8rem;padding:4px 0;border-bottom:1px dotted #ddd;">' +
            '<strong>"' + item.nombre + '"</strong> → ' +
            item.ids.map(function(id) {
              return '<span style="font-family:monospace;font-size:0.7rem;background:#f5f5f5;padding:2px 6px;border-radius:4px;">' + id.substring(0, 16) + '…</span>';
            }).join(' , ') +
          '</div>';
        });
        htmlPM += '</div>';
      }

      // IDs que apuntan a múltiples nombres
      var idANombres = {};
      pmRegistros.forEach(function(r) {
        if (!idANombres[r.profesorId]) idANombres[r.profesorId] = {};
        idANombres[r.profesorId][r.profesorNombre.toLowerCase()] = r.profesorNombre;
      });

      var idsConMultiNombre = [];
      Object.keys(idANombres).forEach(function(pid) {
        var nombresArr = Object.values(idANombres[pid]);
        if (nombresArr.length > 1) {
          idsConMultiNombre.push({ id: pid, nombres: nombresArr });
        }
      });

      if (idsConMultiNombre.length > 0) {
        htmlPM += '<div style="background:#fff8f0;padding:8px 10px;border-radius:8px;border-left:3px solid #ff9800;margin-bottom:8px;">' +
          '<strong style="color:#e65100;font-size:0.85rem;">IDs con múltiples nombres:</strong>';
        idsConMultiNombre.forEach(function(item) {
          htmlPM += '<div style="font-size:0.8rem;padding:4px 0;border-bottom:1px dotted #ddd;">' +
            '<span style="font-family:monospace;font-size:0.7rem;">' + item.id.substring(0, 16) + '…</span> → ' +
            item.nombres.map(function(n) { return '"' + n + '"'; }).join(' , ') +
          '</div>';
        });
        htmlPM += '</div>';
      }

    } else {
      htmlPM += '<div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:10px 12px;border-radius:8px;">' +
        '<strong style="color:#2e7d32;">Sin discrepancia entre IDs y Nombres</strong>' +
      '</div>';
    }

    contPM.innerHTML = htmlPM;

    // ===== 3. CRUCE: usuarios vs profesorMaterias =====
    var uidsProfesores = {};
    profesores.forEach(function(p) { uidsProfesores[p.uid] = p; });

    var uidsPM = {};
    pmRegistros.forEach(function(r) { uidsPM[r.profesorId] = true; });

    // Profesores en usuarios que NO aparecen en profesorMaterias
    var enUsuariosNoEnPM = profesores.filter(function(p) { return !uidsPM[p.uid]; });

    // profesorIds en PM que NO están en usuarios como profesor
    var enPMNoEnUsuarios = [];
    var idsVistos = {};
    pmRegistros.forEach(function(r) {
      if (!uidsProfesores[r.profesorId] && !idsVistos[r.profesorId]) {
        idsVistos[r.profesorId] = true;
        enPMNoEnUsuarios.push({ id: r.profesorId, nombre: r.profesorNombre });
      }
    });

    var htmlCruce = '';

    if (enUsuariosNoEnPM.length > 0) {
      htmlCruce += '<div style="background:#fff3e0;border-left:4px solid #ff9800;padding:10px 12px;border-radius:8px;margin-bottom:8px;">' +
        '<strong style="color:#e65100;">' + enUsuariosNoEnPM.length + ' profesor(es) en usuarios SIN registro en profesorMaterias:</strong>';
      enUsuariosNoEnPM.forEach(function(p) {
        htmlCruce += '<div style="font-size:0.8rem;padding:3px 0;border-bottom:1px dotted #ddd;">' +
          '<strong>' + p.nombre + '</strong> ' +
          '<span style="font-family:monospace;font-size:0.7rem;color:#999;">' + p.uid.substring(0, 16) + '…</span> ' +
          (p.activo ? '<span style="color:#4caf50;">activo</span>' : '<span style="color:#f44336;">inactivo</span>') +
        '</div>';
      });
      htmlCruce += '</div>';
    } else {
      htmlCruce += '<div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:10px 12px;border-radius:8px;margin-bottom:8px;">' +
        '<strong style="color:#2e7d32;">Todos los profesores de usuarios tienen registros en profesorMaterias</strong>' +
      '</div>';
    }

    if (enPMNoEnUsuarios.length > 0) {
      htmlCruce += '<div style="background:#fff3e0;border-left:4px solid #ff9800;padding:10px 12px;border-radius:8px;margin-bottom:8px;">' +
        '<strong style="color:#e65100;">' + enPMNoEnUsuarios.length + ' profesorId(s) en profesorMaterias que NO son profesor en usuarios:</strong>' +
        '<div style="font-size:0.75rem;color:#795548;margin:4px 0;">Pueden ser coordinadores con rol profesor, o registros huérfanos.</div>';
      enPMNoEnUsuarios.forEach(function(item) {
        htmlCruce += '<div style="font-size:0.8rem;padding:3px 0;border-bottom:1px dotted #ddd;">' +
          '<strong>"' + item.nombre + '"</strong> ' +
          '<span style="font-family:monospace;font-size:0.7rem;color:#999;">' + item.id.substring(0, 16) + '…</span>' +
        '</div>';
      });
      htmlCruce += '</div>';
    } else {
      htmlCruce += '<div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:10px 12px;border-radius:8px;">' +
        '<strong style="color:#2e7d32;">Todos los profesorId de profesorMaterias existen en usuarios</strong>' +
      '</div>';
    }

    contCruce.innerHTML = htmlCruce;

    // Guardar para referencia
    vigiaData = {
      profesores: profesores,
      duplicados: duplicados,
      pmRegistros: pmRegistros,
      uniqueIds: uniqueIds,
      uniqueNombres: uniqueNombres,
      enUsuariosNoEnPM: enUsuariosNoEnPM,
      enPMNoEnUsuarios: enPMNoEnUsuarios
    };

  } catch (e) {
    console.error('Error vigía:', e);
    contProfes.innerHTML = errorHTML(e);
    contPM.innerHTML = errorHTML(e);
    contCruce.innerHTML = errorHTML(e);
  }
}

function cargando() { return '<div style="text-align:center;padding:12px;color:#999;font-size:0.85rem;">Auditando...</div>'; }
function errorHTML(e) { return '<div style="color:#d32f2f;padding:12px;font-size:0.85rem;">Error: ' + e.message + '</div>'; }

console.log('vigia.js cargado - auditoría de profesores');