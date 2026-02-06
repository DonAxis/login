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