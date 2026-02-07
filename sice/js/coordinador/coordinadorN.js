/*console.log('=== Iniciando Panel de Coordinador ===');
console.log('core.js debe estar cargado');
console.log('utils.js debe estar cargado');
console.log('modules.js debe estar cargado');
console.log('coordinador.js iniciando...');
*/
// Verificar que las dependencias estén cargadas
if (typeof auth === 'undefined') {
    console.error('ERROR: core.js no está cargado correctamente');
}

// ===== INICIALIZACIÓN AL CARGAR LA PÁGINA =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, verificando autenticación...');
});

console.log('Panel de Coordinador cargado exitosamente');

/*
coordinador/
├── core/
│   ├── auth.js           - Autenticación y sesión
│   ├── firebase-init.js  - Inicialización de Firebase
│   └── navigation.js     - Navegación entre secciones
│
├── modules/
│   ├── periodos.js       - Sistema de periodos
│   ├── carreras.js       - Gestión de carreras (multi-carrera)
│   ├── materias.js       - CRUD de materias
│   ├── grupos.js         - Gestión de grupos
│   ├── profesores.js     - CRUD de profesores
│   ├── alumnos.js        - CRUD de alumnos
│   ├── asignaciones.js   - Asignar profesores a materias
│   ├── calificaciones.js - Gestión de calificaciones
│   └── reportes.js       - Generación de PDFs/reportes
│
├── utils/
│   ├── ui.js            - Modales, alertas, helpers UI
│   ├── validators.js    - Validaciones
│   └── formatters.js    - Formateo de datos
│
└── coordinador-main.js  - Archivo principal que importa todos
*/