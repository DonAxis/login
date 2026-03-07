// reportes.js
// Reporte: Conteo de Materias por Carrera y Usuarios por Rol
// Con generación de PDF

// ===== DATOS GLOBALES =====
let reporteMaterias = null;
let reporteUsuarios = null;

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

  contMaterias.innerHTML = '<div style="text-align:center;padding:15px;color:#999;font-size:0.9rem;">Cargando materias...</div>';
  contUsuarios.innerHTML = '<div style="text-align:center;padding:15px;color:#999;font-size:0.9rem;">Cargando usuarios...</div>';

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

    const carrerasOrdenadas = Object.keys(porCarrera).sort();
    reporteMaterias = { total: totalMaterias, porCarrera, carrerasOrdenadas };

    let html = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:8px 14px;border-radius:8px;font-size:1.4rem;font-weight:700;">${totalMaterias}</div>
        <div style="font-size:0.9rem;color:#555;">Materias en total</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;">
    `;

    carrerasOrdenadas.forEach(cId => {
      const cantidad = porCarrera[cId];
      const porcentaje = ((cantidad / totalMaterias) * 100).toFixed(1);
      html += `
        <div style="background:#f8f9fa;padding:10px;border-radius:8px;border-left:3px solid #667eea;">
          <div style="font-weight:700;color:#333;font-size:0.85rem;">${cId}</div>
          <div style="font-size:1.1rem;font-weight:700;color:#667eea;">${cantidad}</div>
          <div style="font-size:0.75rem;color:#999;">${porcentaje}%</div>
        </div>
      `;
    });

    html += '</div>';
    contMaterias.innerHTML = html;

  } catch (error) {
    console.error('Error al cargar materias:', error);
    contMaterias.innerHTML = `<div style="color:#d32f2f;padding:15px;font-size:0.9rem;">Error: ${error.message}</div>`;
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

    reporteUsuarios = { total: totalUsuarios, porRol };

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
      'admin': 'Admins',
      'coordinador': 'Coordinadores',
      'profesor': 'Profesores',
      'alumno': 'Alumnos',
      'controlEscolar': 'Ctrl. Escolar',
      'controlCaja': 'Ctrl. Caja',
      'coordinadorAcademia': 'Coord. Academia'
    };

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
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:8px 14px;border-radius:8px;font-size:1.4rem;font-weight:700;">${totalUsuarios}</div>
        <div style="font-size:0.9rem;color:#555;">Usuarios en total</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">
    `;

    rolesPresentes.forEach(rol => {
      const cantidad = porRol[rol];
      const porcentaje = ((cantidad / totalUsuarios) * 100).toFixed(1);
      const estilo = coloresRol[rol] || { bg: '#f5f5f5', color: '#333', icon: '👤' };
      const nombre = nombresRol[rol] || rol;

      html += `
        <div style="background:${estilo.bg};padding:10px;border-radius:8px;border-left:3px solid ${estilo.color};">
          <div style="font-size:1rem;margin-bottom:2px;">${estilo.icon}</div>
          <div style="font-weight:700;color:${estilo.color};font-size:0.8rem;">${nombre}</div>
          <div style="font-size:1.2rem;font-weight:700;color:#333;">${cantidad}</div>
          <div style="font-size:0.75rem;color:#999;">${porcentaje}%</div>
        </div>
      `;
    });

    html += '</div>';
    contUsuarios.innerHTML = html;

  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    contUsuarios.innerHTML = `<div style="color:#d32f2f;padding:15px;font-size:0.9rem;">Error: ${error.message}</div>`;
  }
}

// ===== DESCARGAR PDF =====
async function descargarReportePDF() {
  if (!reporteMaterias || !reporteUsuarios) {
    alert('Primero carga los datos del reporte.');
    return;
  }

  if (typeof window.jspdf === 'undefined') {
    alert('Error: jsPDF no está cargado. Recarga la página.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const fecha = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // --- LOGOS ---
  if (typeof logosEscuela !== 'undefined') {
    try {
      if (logosEscuela.logoIzquierdo) {
        const cfg = logosEscuela.config.izq;
        doc.addImage(logosEscuela.logoIzquierdo, 'PNG', cfg.x, cfg.y, cfg.ancho, cfg.alto);
      }
    } catch (e) { console.log('Error logo izq:', e); }
    try {
      if (logosEscuela.logoDerecho) {
        const cfg = logosEscuela.config.der;
        doc.addImage(logosEscuela.logoDerecho, 'PNG', cfg.x, cfg.y, cfg.ancho, cfg.alto);
      }
    } catch (e) { console.log('Error logo der:', e); }
  }

  // --- ENCABEZADO ---
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('REPORTE DEL SISTEMA', pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Fecha: ' + fecha, pageWidth / 2, 32, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(20, 38, pageWidth - 20, 38);

  let y = 48;

  // --- SECCIÓN MATERIAS ---
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(102, 126, 234);
  doc.text('Materias por Carrera', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Total de Materias: ' + reporteMaterias.total, 20, y);
  y += 10;

  const tablaMaterias = reporteMaterias.carrerasOrdenadas.map((cId, i) => {
    const cant = reporteMaterias.porCarrera[cId];
    const pct = ((cant / reporteMaterias.total) * 100).toFixed(1);
    return [(i + 1).toString(), cId, cant.toString(), pct + '%'];
  });

  doc.autoTable({
    startY: y,
    head: [['#', 'Carrera ID', 'Materias', '%']],
    body: tablaMaterias,
    theme: 'grid',
    headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 20 }
    }
  });

  y = doc.lastAutoTable.finalY + 15;

  // --- SECCIÓN USUARIOS ---
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(118, 75, 162);
  doc.text('Usuarios por Rol', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Total de Usuarios: ' + reporteUsuarios.total, 20, y);
  y += 10;

  const nombresRolPDF = {
    'admin': 'Administradores', 'coordinador': 'Coordinadores', 'profesor': 'Profesores',
    'alumno': 'Alumnos', 'controlEscolar': 'Control Escolar', 'controlCaja': 'Control Caja',
    'coordinadorAcademia': 'Coord. Academia'
  };

  const ordenRoles = ['admin', 'coordinador', 'profesor', 'alumno', 'controlEscolar', 'controlCaja', 'coordinadorAcademia'];
  const rolesOrdenados = Object.keys(reporteUsuarios.porRol).sort((a, b) => {
    const iA = ordenRoles.indexOf(a);
    const iB = ordenRoles.indexOf(b);
    if (iA === -1 && iB === -1) return a.localeCompare(b);
    if (iA === -1) return 1;
    if (iB === -1) return -1;
    return iA - iB;
  });

  const tablaUsuarios = rolesOrdenados.map((rol, i) => {
    const cant = reporteUsuarios.porRol[rol];
    const pct = ((cant / reporteUsuarios.total) * 100).toFixed(1);
    return [(i + 1).toString(), nombresRolPDF[rol] || rol, cant.toString(), pct + '%'];
  });

  doc.autoTable({
    startY: y,
    head: [['#', 'Rol', 'Usuarios', '%']],
    body: tablaUsuarios,
    theme: 'grid',
    headStyles: { fillColor: [118, 75, 162], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 20 }
    }
  });

  // --- NO VALIDEZ ---
  const yFinal = pageHeight - 25;
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(200, 0, 0);
  doc.text('ESTE DOCUMENTO NO TIENE VALIDEZ OFICIAL', pageWidth / 2, yFinal, { align: 'center' });

  // --- PIE ---
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(128);
  doc.text('Generado el ' + fecha, pageWidth / 2, pageHeight - 10, { align: 'center' });

  const nombreArchivo = 'Reporte_Sistema_' + fecha.replace(/\s+/g, '_') + '.pdf';
  doc.save(nombreArchivo);
}

console.log('reportes.js cargado - con PDF');