// boletaGlobal.js — Vista del expediente completo por alumno
// Usado por controlEscolar (Panel 4) y coordinador (seccionBoletaGlobal)
// IDs esperados en el HTML: boletagCarrera, boletagBusqueda, boletagResultados

let _boletaCarrerasCache = null;

async function inicializarBoletaGlobal() {
  const select = document.getElementById('boletagCarrera');
  if (!select) return;
  if (select.dataset.ok === '1') return; // ya poblado

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
  const carreraId = (document.getElementById('boletagCarrera')?.value || '');
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
            <th style="padding:10px 12px;text-align:center;">Semestre</th>
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
          <td style="padding:10px 12px;text-align:center;">${a.semestreActual || '-'}</td>
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

async function verBoletaGlobalAlumno(alumnoId) {
  if (typeof _asegurarModalGenerico === 'function') _asegurarModalGenerico();

  const modal = document.getElementById('modalGenerico');
  const contenido = document.getElementById('contenidoModal');
  if (!modal || !contenido) return;

  contenido.innerHTML = `
    <div style="background:white;padding:40px;text-align:center;border-radius:15px;max-width:500px;margin:20px auto;">
      <p style="color:#555;">Cargando expediente...</p>
    </div>
  `;
  modal.style.display = 'flex';

  try {
    const [historialDoc, usuarioDoc] = await Promise.all([
      db.collection('historialAcademico').doc(alumnoId).get(),
      db.collection('usuarios').doc(alumnoId).get()
    ]);

    const alumno = usuarioDoc.exists ? usuarioDoc.data() : {};
    const historial = historialDoc.exists ? historialDoc.data() : null;

    if (!historial) {
      contenido.innerHTML = `
        <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
          <p style="color:#999;text-align:center;padding:20px 0;">No hay historial académico para este alumno.<br>Ejecuta "Crear Historial Académico" desde el panel Admin.</p>
          <button onclick="cerrarModal()" style="width:100%;padding:10px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;margin-top:8px;">Cerrar</button>
        </div>
      `;
      return;
    }

    const materias = historial.materias || [];
    const conCalificacion = materias.filter(m => m.calificacion > 0);
    const aprobadas = conCalificacion.filter(m => m.calificacion >= 6).length;
    const reprobadas = conCalificacion.filter(m => m.calificacion < 6).length;
    const sinCaptura = materias.length - conCalificacion.length;

    const nombre = historial.alumnoNombre || alumno.nombre || '-';
    const matricula = historial.matricula || alumno.matricula || '-';
    const carreraNombre = historial.carreraNombre || historial.carreraId || '-';
    const periodo = historial.periodoActual || alumno.periodo || '-';
    const semestre = alumno.semestreActual || '-';

    let html = `
      <div style="background:white;padding:30px;border-radius:15px;max-width:780px;margin:20px auto;max-height:88vh;overflow-y:auto;">

        <!-- Encabezado -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
          <div>
            <h3 style="margin:0 0 6px;color:#6A2135;font-size:1.2rem;">${nombre}</h3>
            <p style="margin:0;color:#555;font-size:0.9rem;">
              Matrícula: <strong>${matricula}</strong> &nbsp;|&nbsp; Carrera: <strong>${carreraNombre}</strong>
            </p>
            <p style="margin:4px 0 0;color:#555;font-size:0.9rem;">
              Periodo: <strong>${periodo}</strong> &nbsp;|&nbsp; Semestre: <strong>${semestre}</strong>
              ${alumno.pasante ? '&nbsp;|&nbsp; <span style="color:#e65100;font-weight:700;">PASANTE</span>' : ''}
            </p>
          </div>
          <button onclick="cerrarModal()"
            style="padding:8px 18px;background:#eee;border:none;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap;">
            ✕ Cerrar
          </button>
        </div>

        <!-- Resumen chips -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
          <span style="background:#e8f5e9;color:#2e7d32;padding:6px 14px;border-radius:20px;font-size:0.85rem;font-weight:600;">${aprobadas} aprobadas</span>
          <span style="background:#ffebee;color:#c62828;padding:6px 14px;border-radius:20px;font-size:0.85rem;font-weight:600;">${reprobadas} reprobadas</span>
          <span style="background:#fff3e0;color:#e65100;padding:6px 14px;border-radius:20px;font-size:0.85rem;font-weight:600;">${sinCaptura} sin captura</span>
          <span style="background:#f3f4f6;color:#555;padding:6px 14px;border-radius:20px;font-size:0.85rem;font-weight:600;">${materias.length} total</span>
        </div>
    `;

    if (materias.length) {
      html += `
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
          <thead>
            <tr style="background:#6A2135;color:white;">
              <th style="padding:10px 12px;text-align:center;width:40px;">#</th>
              <th style="padding:10px 12px;text-align:left;">Materia</th>
              <th style="padding:10px 12px;text-align:center;width:110px;">Calificación</th>
              <th style="padding:10px 12px;text-align:center;width:120px;">Estado</th>
            </tr>
          </thead>
          <tbody>
      `;

      materias.forEach((m, i) => {
        const cal = m.calificacion ?? 0;
        const sinCap = cal === 0;
        const aprobada = !sinCap && cal >= 6;
        const bg = sinCap ? '' : (aprobada ? '#f0fdf4' : '#fff5f5');
        const chipBg = sinCap ? '#f5f5f5' : (aprobada ? '#e8f5e9' : '#ffebee');
        const chipColor = sinCap ? '#888' : (aprobada ? '#2e7d32' : '#c62828');
        const chipTxt = sinCap ? 'Sin captura' : (aprobada ? 'Aprobada' : 'Reprobada');

        html += `
          <tr style="border-bottom:1px solid #eee;background:${bg};">
            <td style="padding:10px 12px;text-align:center;color:#bbb;">${i + 1}</td>
            <td style="padding:10px 12px;">${m.materiaNombre || '-'}</td>
            <td style="padding:10px 12px;text-align:center;font-weight:700;font-size:1rem;color:${chipColor};">
              ${sinCap ? '—' : cal}
            </td>
            <td style="padding:10px 12px;text-align:center;">
              <span style="background:${chipBg};color:${chipColor};padding:4px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">
                ${chipTxt}
              </span>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
    } else {
      html += `
        <p style="color:#999;text-align:center;padding:30px 0;">
          Este alumno no tiene materias en su historial.<br>
          Ejecuta "Crear Historial Académico" desde Admin para poblar los datos.
        </p>
      `;
    }

    html += `
        <button onclick="cerrarModal()"
          style="width:100%;padding:12px;background:linear-gradient(135deg,#6A2135,#9c2f50);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;margin-top:20px;">
          Cerrar
        </button>
      </div>
    `;

    contenido.innerHTML = html;

  } catch (error) {
    console.error('Error en verBoletaGlobalAlumno:', error);
    contenido.innerHTML = `
      <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
        <h3 style="color:#d32f2f;text-align:center;margin:0 0 16px;">Error</h3>
        <div style="background:#ffebee;border-left:4px solid #f44336;padding:15px;border-radius:4px;margin-bottom:16px;">
          <p style="margin:0;color:#c62828;">${error.message}</p>
        </div>
        <button onclick="cerrarModal()" style="width:100%;padding:10px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Cerrar</button>
      </div>
    `;
  }
}
