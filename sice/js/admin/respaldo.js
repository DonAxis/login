const COLECCIONES_RESPALDO = [
  'usuarios', 'alumnos', 'carreras', 'academias', 'grupos', 'materias',
  'profesorMaterias', 'calificaciones', 'config', 'configuracion',
  'historialCalificaciones', 'historialGrupos', 'alumnoMaterias', 'inscripcionesEspeciales'
];

// ===== MODAL =====

function mostrarModalRespaldo() {
  actualizarContadorRespaldo();
  document.getElementById('modalRespaldo').style.display = 'flex';
}

function cerrarModalRespaldo() {
  document.getElementById('modalRespaldo').style.display = 'none';
  document.getElementById('mensajeRespaldo').style.display = 'none';
}

// ===== CONTADOR DESDE FIRESTORE =====

async function actualizarContadorRespaldo() {
  const fechaEl = document.getElementById('respaldoUltimoFecha');
  const diasEl  = document.getElementById('respaldoDias');
  const btnEl   = document.getElementById('respaldoCounterBtn');

  try {
    const doc = await firebase.firestore().collection('config').doc('respaldo').get();

    if (!doc.exists || !doc.data().ultimoRespaldo) {
      if (fechaEl) fechaEl.textContent = 'Sin respaldo registrado';
      if (diasEl)  diasEl.textContent  = '∞';
      if (btnEl)   btnEl.textContent   = 'Sin respaldo registrado';
      return;
    }

    const ultimo = new Date(doc.data().ultimoRespaldo);
    const dias   = Math.floor((Date.now() - ultimo.getTime()) / (1000 * 60 * 60 * 24));
    const fecha  = ultimo.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

    if (fechaEl) fechaEl.textContent = `Último: ${fecha}`;

    if (diasEl) {
      diasEl.textContent = dias;
      diasEl.style.color = dias >= 7 ? '#d32f2f' : dias >= 3 ? '#f57c00' : '#1b5e20';
    }

    if (btnEl) {
      btnEl.textContent = dias === 0 ? 'Respaldo hoy' : `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
    }

  } catch (e) {
    console.warn('No se pudo leer fecha de respaldo:', e.message);
    if (btnEl) btnEl.textContent = 'Sin datos';
  }
}

// ===== EXPORTAR FIRESTORE =====

async function exportarFirestore() {
  const db = firebase.firestore();
  const resultado = { fecha: new Date().toISOString(), colecciones: {} };

  for (const nombre of COLECCIONES_RESPALDO) {
    try {
      const snap = await db.collection(nombre).get();
      const docs = {};
      snap.forEach(doc => { docs[doc.id] = doc.data(); });
      resultado.colecciones[nombre] = docs;
    } catch (e) {
      console.warn(`✗ ${nombre}: ${e.message}`);
    }
  }

  return resultado;
}

// ===== DESCARGA LOCAL =====

async function ejecutarDescarga() {
  const mensajeEl = document.getElementById('mensajeRespaldo');
  const btn       = document.getElementById('btnDescargarJSON');

  const mostrarMsg = (texto, tipo) => {
    const estilos = {
      success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
      error:   { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
      info:    { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
    };
    const s = estilos[tipo] || estilos.info;
    mensajeEl.textContent      = texto;
    mensajeEl.style.display    = 'block';
    mensajeEl.style.background = s.bg;
    mensajeEl.style.color      = s.color;
    mensajeEl.style.border     = `2px solid ${s.border}`;
    mensajeEl.style.borderRadius = '8px';
    mensajeEl.style.padding    = '15px';
  };

  try {
    btn.disabled = true;
    mostrarMsg('Exportando datos de Firestore...', 'info');

    const datos        = await exportarFirestore();
    const fecha        = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `respaldo_${fecha}.json`;
    const jsonStr      = JSON.stringify(datos, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);

    mostrarMsg(`Descargado: ${nombreArchivo}`, 'success');

  } catch (error) {
    console.error('Error al descargar:', error);
    mostrarMsg('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// Inicializar contador al cargar
document.addEventListener('DOMContentLoaded', actualizarContadorRespaldo);

console.log('Módulo de Respaldo cargado');
