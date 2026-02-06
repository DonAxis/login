// =====================================================
// UTILS.JS - Utilidades y Helpers
// =====================================================
// Contiene:
// - Gestión de modales (abrir/cerrar)
// - Validaciones de formularios
// - Formateo de datos (fechas, números, etc.)
// - Funciones auxiliares de UI
// - Helpers para carga de datos en selectores
// - Funciones de progreso y confirmación
// =====================================================


// ===== MODAL =====
function cerrarModal() {
    document.getElementById('modalGenerico').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modalGenerico');
    if (event.target === modal) {
        cerrarModal();
    }
}

// ==================================================
// FUNCIONES AUXILIARES PARA GESTION DE PERIODOS
// ==================================================

function mostrarModalProgreso() {
  const modal = document.createElement('div');
  modal.id = 'modalProgreso';
  modal.style.cssText = 'display: block; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8);';
  
  modal.innerHTML = `
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 40px; border-radius: 12px; min-width: 400px; text-align: center;">
      <h3 style="margin: 0 0 20px 0; color: #1976d2;">Cambiando Periodo</h3>
      <div id="mensajeProgreso" style="margin-bottom: 20px; color: #666; font-size: 0.95rem;">
        Iniciando...
      </div>
      <div style="background: #e0e0e0; height: 30px; border-radius: 15px; overflow: hidden;">
        <div id="barraProgreso" style="width: 0%; height: 100%; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); transition: width 0.3s;"></div>
      </div>
      <p style="margin: 15px 0 0 0; color: #999; font-size: 0.85rem;">Por favor espera, no cierres esta ventana</p>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function actualizarProgreso(mensaje, porcentaje) {
  const mensajeEl = document.getElementById('mensajeProgreso');
  const barraEl = document.getElementById('barraProgreso');
  
  if (mensajeEl) mensajeEl.textContent = mensaje;
  if (barraEl) barraEl.style.width = porcentaje + '%';
  
  console.log(`Progreso: ${porcentaje}% - ${mensaje}`);
}

function cerrarModalProgreso() {
  const modal = document.getElementById('modalProgreso');
  if (modal) {
    modal.remove();
  }
}

function cerrarModalHistorialPeriodos() {
  const modal = document.getElementById('modalHistorialPeriodos');
  if (modal) {
    modal.remove();
  }
}

// ===== CARGAR GRUPOS EN SELECT =====
async function cargarGruposEnSelect(selectId) {
    try {
        if (!usuarioActual || !usuarioActual.carreraId) {
            console.error('No hay carrera seleccionada');
            return;
        }

        // Obtener grupos activos de la carrera
        const gruposSnap = await db.collection('grupos')
            .where('carreraId', '==', usuarioActual.carreraId)
            .where('activo', '==', true)
            .get();

        const grupos = [];
        gruposSnap.forEach(doc => {
            grupos.push({
                id: doc.id,
                data: doc.data()
            });
        });

        // Ordenar por nombre
        grupos.sort((a, b) => a.data.nombre.localeCompare(b.data.nombre));

        const select = document.getElementById(selectId);
        if (!select) {
            console.error('Select no encontrado:', selectId);
            return;
        }

        if (grupos.length === 0) {
            select.innerHTML = '<option value="">No hay grupos disponibles</option>';
            return;
        }

        select.innerHTML = '<option value="">Seleccionar grupo...</option>';

        grupos.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.data.nombre;
            option.dataset.nombre = item.data.nombre;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar grupos:', error);
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Error al cargar grupos</option>';
        }
    }
}

console.log('✓ utils.js cargado');
