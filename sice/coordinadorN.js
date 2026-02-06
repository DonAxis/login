// =====================================================
// COORDINADOR.JS - Archivo Principal
// =====================================================
// Este es el archivo principal que coordina todos los módulos
// Requiere que se carguen primero en este orden:
// 1. core.js    - Sistema central, auth, periodos, navegación
// 2. utils.js   - Utilidades y helpers
// 3. modules.js - Módulos de gestión (carreras, materias, etc.)
// 4. coordinador.js (este archivo) - Inicialización y coordinación
// =====================================================

console.log('=== Iniciando Panel de Coordinador ===');
console.log('core.js debe estar cargado');
console.log('utils.js debe estar cargado');
console.log('modules.js debe estar cargado');
console.log('coordinador.js iniciando...');

// Verificar que las dependencias estén cargadas
if (typeof auth === 'undefined') {
    console.error('ERROR: core.js no está cargado correctamente');
}

// ===== INICIALIZACIÓN AL CARGAR LA PÁGINA =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, verificando autenticación...');
});

console.log('Panel de Coordinador cargado exitosamente');
