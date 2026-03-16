// ===== CONFIGURACIÓN - EDITAR ANTES DE USAR =====
const RESPALDO_CONFIG = {
  githubToken: '',      // Tu PAT de GitHub (scope: repo)
  githubOwner: '',      // Tu usuario de GitHub
  githubRepo: 'RespaldoJSON'
};

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

// ===== CONTADOR =====

function actualizarContadorRespaldo() {
  const ultimo = localStorage.getItem('ultimoRespaldo');
  const fechaEl = document.getElementById('respaldoUltimoFecha');
  const diasEl  = document.getElementById('respaldoDias');
  const btnEl   = document.getElementById('respaldoCounterBtn');

  if (!ultimo) {
    if (fechaEl) fechaEl.textContent = 'Sin respaldo registrado';
    if (diasEl)  diasEl.textContent  = '∞';
    if (btnEl)   btnEl.textContent   = 'Sin respaldo registrado';
    return;
  }

  const dias  = Math.floor((Date.now() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24));
  const fecha = new Date(ultimo).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  if (fechaEl) fechaEl.textContent = `Último: ${fecha}`;

  if (diasEl) {
    diasEl.textContent  = dias;
    diasEl.style.color  = dias >= 7 ? '#d32f2f' : dias >= 3 ? '#f57c00' : '#1b5e20';
  }

  if (btnEl) {
    btnEl.textContent = dias === 0 ? 'Respaldo hoy' : `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
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
      console.log(`✓ ${nombre} (${snap.size} docs)`);
    } catch (e) {
      console.warn(`✗ ${nombre}: ${e.message}`);
    }
  }

  return resultado;
}

// ===== GITHUB API =====

function toBase64Unicode(str) {
  const bytes  = new TextEncoder().encode(str);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  return btoa(binary);
}

async function subirAGitHub(jsonStr, nombreArchivo) {
  const { githubToken, githubOwner, githubRepo } = RESPALDO_CONFIG;

  if (!githubToken || !githubOwner) {
    throw new Error('Configura githubToken y githubOwner en respaldo.js → RESPALDO_CONFIG');
  }

  const url     = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${nombreArchivo}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  // Obtener SHA si el archivo ya existe (necesario para actualizar)
  let sha;
  try {
    const check = await fetch(url, { headers });
    if (check.ok) sha = (await check.json()).sha;
  } catch (_) {}

  const body = {
    message: `Respaldo manual ${new Date().toISOString().slice(0, 10)}`,
    content: toBase64Unicode(jsonStr)
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub error ${res.status}`);
  }
}

// ===== DESCARGA LOCAL =====

function descargarJSON(jsonStr, nombreArchivo) {
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== ACCIÓN PRINCIPAL =====

async function ejecutarRespaldo(subirGitHub) {
  const btnGH     = document.getElementById('btnRespaldoGitHub');
  const mensajeEl = document.getElementById('mensajeRespaldo');

  const mostrarMsg = (texto, tipo) => {
    mensajeEl.textContent    = texto;
    mensajeEl.style.display  = 'block';
    const estilos = {
      success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
      error:   { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
      info:    { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
    };
    const s = estilos[tipo] || estilos.info;
    mensajeEl.style.background = s.bg;
    mensajeEl.style.color      = s.color;
    mensajeEl.style.border     = `2px solid ${s.border}`;
    mensajeEl.style.borderRadius = '8px';
    mensajeEl.style.padding    = '15px';
  };

  try {
    if (btnGH) btnGH.disabled = true;
    mostrarMsg('Exportando datos de Firestore...', 'info');

    const datos        = await exportarFirestore();
    const fecha        = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `respaldo_${fecha}.json`;
    const jsonStr      = JSON.stringify(datos, null, 2);

    if (subirGitHub) {
      mostrarMsg('Subiendo a GitHub...', 'info');
      await subirAGitHub(jsonStr, nombreArchivo);
      mostrarMsg(`Guardado en GitHub: ${nombreArchivo}`, 'success');
    } else {
      mostrarMsg('Exportación lista.', 'success');
    }

    localStorage.setItem('ultimoRespaldo', new Date().toISOString());
    actualizarContadorRespaldo();

    if (confirm('¿Deseas descargar el archivo JSON también?')) {
      descargarJSON(jsonStr, nombreArchivo);
    }

  } catch (error) {
    console.error('Error en respaldo:', error);
    mostrarMsg('Error: ' + error.message, 'error');
  } finally {
    if (btnGH) btnGH.disabled = false;
  }
}

// Inicializar contador al cargar
document.addEventListener('DOMContentLoaded', actualizarContadorRespaldo);

console.log('Módulo de Respaldo cargado');
