// vigia.js — funciones de mantenimiento único (idempotentes, seguras de repetir)

function accionVigia() {
  alert('Sin novedad al frente');
}

// Crea/sobreescribe historialAcademico/{alumnoId} para TODOS los alumnos.
// Lee: usuarios (alumnos), carreras, config (periodo por carrera), materias.
// Un documento por alumno — 541 docs esperados.
async function crearHistorialAcademicoInicial() {
  const confirmado = confirm(
    'CREAR HISTORIAL ACADÉMICO INICIAL\n\n' +
    'Lee alumnos, carreras, config y materias para crear\n' +
    'un documento base en historialAcademico por cada alumno.\n\n' +
    'Seguro ejecutar varias veces (sobreescribe).\n\n¿Continuar?'
  );
  if (!confirmado) return;

  _asegurarModalGenerico();

  const setModal = html => {
    document.getElementById('contenidoModal').innerHTML = html;
    document.getElementById('modalGenerico').style.display = 'flex';
  };

  const setProgreso = (pct, texto) => {
    const bar = document.getElementById('vigiaBar');
    const txt = document.getElementById('vigiaTxt');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = texto;
  };

  setModal(`
    <div style="background:white;padding:40px;border-radius:15px;text-align:center;max-width:520px;margin:20px auto;">
      <div style="font-size:18px;font-weight:600;margin-bottom:16px;">Creando Historial Académico...</div>
      <div style="color:#666;margin-bottom:20px;font-size:0.9rem;">
        Leyendo alumnos, carreras, configuraciones y materias.<br>
        Esto puede tardar unos segundos.
      </div>
      <div style="background:#e0e0e0;height:10px;border-radius:5px;overflow:hidden;margin-bottom:10px;">
        <div id="vigiaBar" style="background:linear-gradient(90deg,#1b5e20,#4caf50);height:100%;width:0%;transition:width 0.3s;"></div>
      </div>
      <div id="vigiaTxt" style="color:#555;font-size:0.9rem;">Iniciando...</div>
    </div>
  `);

  try {
    // ── 1. Leer todos los alumnos ──────────────────────────────────────────
    setProgreso(5, 'Leyendo alumnos...');
    const alumnosSnap = await db.collection('usuarios')
      .where('rol', '==', 'alumno')
      .get();
    const totalAlumnos = alumnosSnap.size;

    // ── 2. Leer todas las carreras ─────────────────────────────────────────
    setProgreso(15, 'Leyendo carreras...');
    const carrerasSnap = await db.collection('carreras').get();
    const carrerasMap = {};
    carrerasSnap.docs.forEach(doc => {
      carrerasMap[doc.id] = doc.data().nombre || '';
    });

    // ── 3. Leer config (periodo actual) de cada carrera única ──────────────
    setProgreso(25, 'Leyendo periodos por carrera...');
    const carreraIds = [...new Set(
      alumnosSnap.docs.map(d => d.data().carreraId).filter(Boolean)
    )];
    const configMap = {};
    await Promise.all(carreraIds.map(async carreraId => {
      const doc = await db.collection('config').doc(`periodo_${carreraId}`).get();
      configMap[carreraId] = doc.exists ? (doc.data().periodo || '') : '';
    }));

    // ── 4. Leer todas las materias y agrupar por carreraId ─────────────────
    setProgreso(40, 'Leyendo materias...');
    const materiasSnap = await db.collection('materias').get();
    const materiasPorCarrera = {};
    materiasSnap.docs.forEach(doc => {
      const m = doc.data();
      if (!m.carreraId) return;
      if (!materiasPorCarrera[m.carreraId]) materiasPorCarrera[m.carreraId] = [];
      materiasPorCarrera[m.carreraId].push({
        materiaId: doc.id,
        nombre: m.nombre || '',
        codigo: m.codigo || '',
        periodo: configMap[m.carreraId] || ''   // periodo activo de esa carrera
      });
    });

    // ── 5. Escribir historialAcademico en lotes de 499 ────────────────────
    setProgreso(55, `Escribiendo ${totalAlumnos} documentos...`);

    let batch = db.batch();
    let batchCount = 0;
    let escritos = 0;

    for (const alumnoDoc of alumnosSnap.docs) {
      const a = alumnoDoc.data();
      const carreraId = a.carreraId || '';

      batch.set(db.collection('historialAcademico').doc(alumnoDoc.id), {
        alumnoId: alumnoDoc.id,
        alumnoNombre: a.nombre || '',
        matricula: a.matricula || '',
        email: a.email || '',
        carreraId: carreraId,
        carreraNombre: carrerasMap[carreraId] || '',
        periodoActual: configMap[carreraId] || '',
        materias: materiasPorCarrera[carreraId] || [],
        periodos: [],
        fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
      });

      batchCount++;
      escritos++;

      if (batchCount === 499) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        const pct = 55 + (escritos / totalAlumnos) * 40;
        setProgreso(Math.round(pct), `Escribiendo... ${escritos}/${totalAlumnos}`);
      }
    }

    if (batchCount > 0) await batch.commit();

    setProgreso(100, 'Completado');

    setTimeout(() => {
      setModal(`
        <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
          <h3 style="color:#2e7d32;text-align:center;margin:0 0 20px 0;">Historial Académico Creado</h3>
          <div style="background:#e8f5e9;border-radius:8px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
              <span>Alumnos procesados:</span><strong style="color:#4caf50;">${totalAlumnos}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;margin-bottom:8px;">
              <span>Carreras:</span><strong>${carreraIds.length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:4px;">
              <span>Materias indexadas:</span><strong>${materiasSnap.size}</strong>
            </div>
          </div>
          <p style="color:#666;font-size:0.85rem;margin-bottom:20px;">
            Cada documento incluye nombre, matrícula, email, carrera, periodo actual
            y la lista completa de materias de su carrera.
          </p>
          <button onclick="cerrarModal()" style="width:100%;padding:12px;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
            Cerrar
          </button>
        </div>
      `);
    }, 600);

  } catch (error) {
    console.error('Error en crearHistorialAcademicoInicial:', error);
    setModal(`
      <div style="background:white;padding:30px;border-radius:15px;max-width:500px;margin:20px auto;">
        <h3 style="color:#d32f2f;text-align:center;margin:0 0 20px 0;">Error</h3>
        <div style="background:#ffebee;border-left:4px solid #f44336;padding:15px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;color:#c62828;">${error.message}</p>
        </div>
        <button onclick="cerrarModal()" style="width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
          Cerrar
        </button>
      </div>
    `);
  }
}
