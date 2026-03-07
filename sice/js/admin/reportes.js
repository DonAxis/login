// reportes.js
// Primer reporte: Conteo de Materias por Carrera y Usuarios por Rol

// ===== ABRIR / CERRAR MODAL =====
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
  const contUsuarios = document.getElementById('reporteUsuariosContenido');

  contMaterias.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Cargando materias...</div>';
  contUsuarios.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Cargando usuarios...</div>';

  // --- MATERIAS POR CARRERA ---
  try {
    const snapMaterias = await db.collection('materias').get();
    const porCarrera = {};
    let totalMaterias = 0;

    snapMaterias.forEach(doc => {
      totalMaterias++;
      const cId = doc.data().carreraId || 'Sin carrera';
      porCarrera[cId] = (porCarrera[cId] || 0) + 1;
    });

    // Ordenar alfabéticamente
    const carrerasOrdenadas = Object.keys(porCarrera).sort();

    let html = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px 20px;border-radius:10px;font-size:1.8rem;font-weight:700;">${totalMaterias}</div>
        <div style="font-size:1rem;color:#555;">Materias en total</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">
    `;

    carrerasOrdenadas.forEach(cId => {
      const cantidad = porCarrera[cId];
      const porcentaje = ((cantidad / totalMaterias) * 100).toFixed(1);
      html += `
        <div style="background:#f8f9fa;padding:14px;border-radius:10px;border-left:4px solid #667eea;transition:all 0.3s;"
             onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
             onmouseout="this.style.boxShadow='none'">
          <div style="font-weight:700;color:#333;font-size:1.1rem;">${cId}</div>
          <div style="font-size:1.4rem;font-weight:700;color:#667eea;">${cantidad}</div>
          <div style="font-size:0.8rem;color:#999;">${porcentaje}%</div>
        </div>
      `;
    });

    html += '</div>';
    contMaterias.innerHTML = html;

  } catch (error) {
    console.error('Error al cargar materias:', error);
    contMaterias.innerHTML = `<div style="color:#d32f2f;padding:20px;">Error al cargar materias: ${error.message}</div>`;
  }

  // --- USUARIOS POR ROL ---
  try {
    const snapUsuarios = await db.collection('usuarios').get();
    const porRol = {};
    let totalUsuarios = 0;

    snapUsuarios.forEach(doc => {
      totalUsuarios++;
      const rol = doc.data().rol || 'sin rol';
      porRol[rol] = (porRol[rol] || 0) + 1;
    });

    const coloresRol = {
      'admin':               { bg: '#ffebee', color: '#c62828', icon: '🔑' },
      'coordinador':         { bg: '#e8f5e9', color: '#2e7d32', icon: '📋' },
      'profesor':            { bg: '#e3f2fd', color: '#1565c0', icon: '👨‍🏫' },
      'alumno':              { bg: '#f3e5f5', color: '#7b1fa2', icon: '🎓' },
      'controlEscolar':      { bg: '#fff3e0', color: '#ef6c00', icon: '📄' },
      'controlCaja':         { bg: '#e8f5e9', color: '#2e7d32', icon: '💰' },
      'coordinadorAcademia': { bg: '#ede7f6', color: '#5e35b1', icon: '📚' }
    };

    const nombresRol = {
      'admin': 'Administradores',
      'coordinador': 'Coordinadores',
      'profesor': 'Profesores',
      'alumno': 'Alumnos',
      'controlEscolar': 'Control Escolar',
      'controlCaja': 'Control Caja',
      'coordinadorAcademia': 'Coord. Academia'
    };

    // Ordenar: primero los roles conocidos, luego los demás
    const ordenRoles = ['admin', 'coordinador', 'profesor', 'alumno', 'controlEscolar', 'controlCaja', 'coordinadorAcademia'];
    const rolesPresentes = Object.keys(porRol).sort((a, b) => {
      const iA = ordenRoles.indexOf(a);
      const iB = ordenRoles.indexOf(b);
      if (iA === -1 && iB === -1) return a.localeCompare(b);
      if (iA === -1) return 1;
      if (iB === -1) return -1;
      return iA - iB;
    });

    let html = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px 20px;border-radius:10px;font-size:1.8rem;font-weight:700;">${totalUsuarios}</div>
        <div style="font-size:1rem;color:#555;">Usuarios en total</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
    `;

    rolesPresentes.forEach(rol => {
      const cantidad = porRol[rol];
      const porcentaje = ((cantidad / totalUsuarios) * 100).toFixed(1);
      const estilo = coloresRol[rol] || { bg: '#f5f5f5', color: '#333', icon: '👤' };
      const nombre = nombresRol[rol] || rol;

      html += `
        <div style="background:${estilo.bg};padding:16px;border-radius:12px;border-left:4px solid ${estilo.color};transition:all 0.3s;"
             onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'"
             onmouseout="this.style.boxShadow='none'">
          <div style="font-size:1.3rem;margin-bottom:4px;">${estilo.icon}</div>
          <div style="font-weight:700;color:${estilo.color};font-size:0.95rem;">${nombre}</div>
          <div style="font-size:1.6rem;font-weight:700;color:#333;margin:4px 0;">${cantidad}</div>
          <div style="font-size:0.8rem;color:#999;">${porcentaje}%</div>
        </div>
      `;
    });

    html += '</div>';
    contUsuarios.innerHTML = html;

  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    contUsuarios.innerHTML = `<div style="color:#d32f2f;padding:20px;">Error al cargar usuarios: ${error.message}</div>`;
  }
}

console.log('reportes.js cargado');