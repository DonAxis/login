// ===================================================================
// GRUPO HELPERS - Sistema de Grupos Base con Turnos
// ===================================================================
// Este archivo contiene todas las funciones helper para trabajar
// con el nuevo sistema de grupos base (sin duplicación por turno)
// ===================================================================

console.log('=== CARGANDO GRUPO HELPERS ===');

// ===== CONSTANTES =====
const TURNOS = {
  MATUTINO: 'Matutino',
  VESPERTINO: 'Vespertino',
  NOCTURNO: 'Nocturno'
};

const TURNOS_ARRAY = ['Matutino', 'Vespertino', 'Nocturno'];

const TURNO_MILLAR = {
  'Matutino': 1000,
  'Vespertino': 2000,
  'Nocturno': 3000
};

const MILLAR_TURNO = {
  1: 'Matutino',
  2: 'Vespertino',
  3: 'Nocturno'
};

// ===== FUNCIONES DE CONVERSIÓN =====

/**
 * Calcula el nombre display del grupo (formato: TSGG)
 * T = Turno (1=Mat, 2=Vesp, 3=Noct)
 * S = Semestre (1-9)
 * GG = Sección (01-99)
 * 
 * @param {number} semestre - Semestre (1-9)
 * @param {number} seccion - Número de sección (1-99)
 * @param {string} turno - 'Matutino', 'Vespertino', 'Nocturno'
 * @returns {string} - Ejemplo: "1101", "2503", "3901"
 */
function calcularGrupoDisplay(semestre, seccion, turno) {
  const base = TURNO_MILLAR[turno];
  
  if (!base) {
    console.error('Turno inválido:', turno);
    return '0000';
  }
  
  if (semestre < 1 || semestre > 9) {
    console.error('Semestre fuera de rango:', semestre);
    return '0000';
  }
  
  if (seccion < 1 || seccion > 99) {
    console.error('Sección fuera de rango:', seccion);
    return '0000';
  }
  
  const resultado = base + (semestre * 100) + seccion;
  return resultado.toString();
}

/**
 * Extrae el semestre de un grupo display
 * @param {string|number} grupoDisplay - Ejemplo: "1101" o 1101
 * @returns {number} - Semestre (1-9)
 */
function extraerSemestre(grupoDisplay) {
  const numero = parseInt(grupoDisplay);
  if (isNaN(numero)) return 0;
  
  return Math.floor((numero % 1000) / 100);
}

/**
 * Extrae la sección de un grupo display
 * @param {string|number} grupoDisplay - Ejemplo: "1104" o 1104
 * @returns {number} - Sección (1-99)
 */
function extraerSeccion(grupoDisplay) {
  const numero = parseInt(grupoDisplay);
  if (isNaN(numero)) return 0;
  
  return numero % 100;
}

/**
 * Extrae el turno de un grupo display
 * @param {string|number} grupoDisplay - Ejemplo: "2101" o 2101
 * @returns {string} - 'Matutino', 'Vespertino', 'Nocturno'
 */
function extraerTurno(grupoDisplay) {
  const numero = parseInt(grupoDisplay);
  if (isNaN(numero)) return 'Matutino';
  
  const millar = Math.floor(numero / 1000);
  return MILLAR_TURNO[millar] || 'Matutino';
}

/**
 * Obtiene todos los grupos display para un grupo base
 * @param {number} semestre - Semestre
 * @param {number} seccion - Sección
 * @returns {Object} - {matutino: "1101", vespertino: "2101", nocturno: "3101"}
 */
function obtenerTodosLosGruposDisplay(semestre, seccion) {
  return {
    matutino: calcularGrupoDisplay(semestre, seccion, 'Matutino'),
    vespertino: calcularGrupoDisplay(semestre, seccion, 'Vespertino'),
    nocturno: calcularGrupoDisplay(semestre, seccion, 'Nocturno')
  };
}

/**
 * Genera el ID de un grupo base
 * @param {string} carreraId - ID de la carrera
 * @param {number} semestre - Semestre
 * @param {number} seccion - Sección
 * @returns {string} - Ejemplo: "ING-SIS_sem1_sec1"
 */
function generarGrupoBaseId(carreraId, semestre, seccion) {
  return `${carreraId}_sem${semestre}_sec${seccion}`;
}

/**
 * Parsea un grupo display para obtener sus componentes
 * @param {string|number} grupoDisplay - Ejemplo: "1104"
 * @returns {Object} - {semestre: 1, seccion: 4, turno: 'Matutino'}
 */
function parsearGrupoDisplay(grupoDisplay) {
  return {
    semestre: extraerSemestre(grupoDisplay),
    seccion: extraerSeccion(grupoDisplay),
    turno: extraerTurno(grupoDisplay)
  };
}

/**
 * Valida si un grupo display es válido
 * @param {string|number} grupoDisplay - Grupo a validar
 * @returns {boolean}
 */
function esGrupoDisplayValido(grupoDisplay) {
  const numero = parseInt(grupoDisplay);
  
  if (isNaN(numero)) return false;
  if (numero < 1000 || numero > 3999) return false;
  
  const millar = Math.floor(numero / 1000);
  if (![1, 2, 3].includes(millar)) return false;
  
  const semestre = extraerSemestre(grupoDisplay);
  if (semestre < 1 || semestre > 9) return false;
  
  const seccion = extraerSeccion(grupoDisplay);
  if (seccion < 1 || seccion > 99) return false;
  
  return true;
}

/**
 * Convierte un grupo display antiguo a formato de grupo base
 * @param {string} grupoDisplay - Ejemplo: "1104"
 * @param {string} carreraId - ID de la carrera
 * @returns {Object} - {id, semestre, seccion, turno}
 */
function convertirGrupoDisplayABase(grupoDisplay, carreraId) {
  const componentes = parsearGrupoDisplay(grupoDisplay);
  
  return {
    id: generarGrupoBaseId(carreraId, componentes.semestre, componentes.seccion),
    semestre: componentes.semestre,
    seccion: componentes.seccion,
    turno: componentes.turno
  };
}

/**
 * Obtiene el grupo display de un alumno
 * @param {Object} alumno - Objeto alumno con grupoBase y turno
 * @param {Object} grupoBaseData - Datos del grupo base (opcional)
 * @returns {string} - Grupo display
 */
function obtenerGrupoDisplayAlumno(alumno, grupoBaseData = null) {
  if (!alumno.turno) {
    console.error('Alumno sin turno:', alumno);
    return '0000';
  }
  
  // Si ya tiene semestre en el alumno
  if (alumno.semestre && alumno.seccion) {
    return calcularGrupoDisplay(alumno.semestre, alumno.seccion, alumno.turno);
  }
  
  // Si tenemos datos del grupo base
  if (grupoBaseData) {
    return calcularGrupoDisplay(grupoBaseData.semestre, grupoBaseData.seccion, alumno.turno);
  }
  
  console.error('No se puede calcular grupo display sin semestre/seccion');
  return '0000';
}

/**
 * Filtra alumnos por turno
 * @param {Array} alumnos - Array de alumnos
 * @param {string} turno - Turno a filtrar
 * @returns {Array} - Alumnos filtrados
 */
function filtrarAlumnosPorTurno(alumnos, turno) {
  return alumnos.filter(a => a.turno === turno);
}

/**
 * Agrupa alumnos por turno
 * @param {Array} alumnos - Array de alumnos
 * @returns {Object} - {Matutino: [...], Vespertino: [...], Nocturno: [...]}
 */
function agruparAlumnosPorTurno(alumnos) {
  const grupos = {
    'Matutino': [],
    'Vespertino': [],
    'Nocturno': []
  };
  
  alumnos.forEach(alumno => {
    const turno = alumno.turno || 'Matutino';
    if (grupos[turno]) {
      grupos[turno].push(alumno);
    }
  });
  
  return grupos;
}

/**
 * Obtiene el nombre corto del turno
 * @param {string} turno - Turno completo
 * @returns {string} - Abreviatura
 */
function obtenerTurnoAbreviado(turno) {
  const abreviaturas = {
    'Matutino': 'Mat',
    'Vespertino': 'Vesp',
    'Nocturno': 'Noct'
  };
  
  return abreviaturas[turno] || turno;
}

/**
 * Genera un HTML de badge para el turno
 * @param {string} turno - Turno
 * @returns {string} - HTML del badge
 */
function generarBadgeTurno(turno) {
  const colores = {
    'Matutino': '#2196F3',
    'Vespertino': '#FF9800',
    'Nocturno': '#9C27B0'
  };
  
  const color = colores[turno] || '#666';
  const abrev = obtenerTurnoAbreviado(turno);
  
  return `<span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${abrev}</span>`;
}

/**
 * Calcula el siguiente grupo base para cambio de periodo
 * @param {number} semestreActual - Semestre actual
 * @param {number} seccionActual - Sección actual
 * @returns {Object} - {semestre, seccion}
 */
function calcularSiguienteGrupoBase(semestreActual, seccionActual) {
  return {
    semestre: semestreActual + 1,
    seccion: seccionActual
  };
}

// ===== EXPORTAR FUNCIONES (para usar en otros archivos) =====
if (typeof window !== 'undefined') {
  window.GrupoHelpers = {
    // Constantes
    TURNOS,
    TURNOS_ARRAY,
    TURNO_MILLAR,
    MILLAR_TURNO,
    
    // Funciones de conversión
    calcularGrupoDisplay,
    extraerSemestre,
    extraerSeccion,
    extraerTurno,
    parsearGrupoDisplay,
    obtenerTodosLosGruposDisplay,
    generarGrupoBaseId,
    convertirGrupoDisplayABase,
    
    // Funciones de validación
    esGrupoDisplayValido,
    
    // Funciones de alumno
    obtenerGrupoDisplayAlumno,
    filtrarAlumnosPorTurno,
    agruparAlumnosPorTurno,
    
    // Funciones de UI
    obtenerTurnoAbreviado,
    generarBadgeTurno,
    
    // Funciones de lógica
    calcularSiguienteGrupoBase
  };
}

console.log('=== GRUPO HELPERS CARGADOS ===');
console.log('Funciones disponibles en window.GrupoHelpers');