// ============================================================
//  editarNombresMasivo.js  —  módulo TEMPORAL
//  Edición masiva de nombres de alumnos (usuarios + calificaciones)
//  Para eliminar: git rm js/admin/editarNombresMasivo.js
//                 y quitar el <script> y el <button> del HTML
// ============================================================

// ---------- Abrir modal ----------
async function abrirEditorNombresMasivo() {
    // Usar los alumnos ya cargados en caché (_alumnosCache de coordinaModules)
    if (!window._alumnosCache || _alumnosCache.length === 0) {
        alert('Primero carga la sección de alumnos o no hay alumnos registrados.');
        return;
    }

    // Ordenar por nombre actual para que sea más fácil identificarlos
    const lista = [..._alumnosCache].sort((a, b) =>
        (a.data.nombre || '').localeCompare(b.data.nombre || '', 'es')
    );

    // Construir filas: una por alumno, campo editable con el nombre actual
    let filasHtml = lista.map((item, idx) => {
        const a = item.data;
        const grupo = a.codigoGrupo || a.grupoId || '—';
        const mat   = a.matricula   || '—';
        return `
        <tr>
          <td style="padding:6px 8px;color:#555;font-size:0.82rem;white-space:nowrap;">${mat}</td>
          <td style="padding:6px 8px;color:#555;font-size:0.82rem;white-space:nowrap;">${grupo}</td>
          <td style="padding:6px 4px;">
            <input
              type="text"
              data-id="${item.id}"
              data-original="${(a.nombre || '').replace(/"/g, '&quot;')}"
              value="${(a.nombre || '').replace(/"/g, '&quot;')}"
              style="width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:6px;font-size:0.9rem;box-sizing:border-box;"
              oninput="this.style.background=this.value.trim()!==this.dataset.original?'#fff9c4':''"
            />
          </td>
        </tr>`;
    }).join('');

    const modalHtml = `
    <div id="modalNombresMasivo"
         style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:14px;width:min(700px,95vw);max-height:88vh;
                  display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.25);">

        <!-- Cabecera -->
        <div style="padding:18px 22px 12px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h3 style="margin:0;font-size:1.1rem;">✏️ Edición masiva de nombres</h3>
            <p style="margin:4px 0 0;font-size:0.8rem;color:#888;">
              Modifica los nombres que necesites — solo se guardarán los que cambien.
              Los campos amarillos tienen cambios pendientes.
            </p>
          </div>
          <button onclick="cerrarEditorNombresMasivo()"
                  style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#888;line-height:1;">✕</button>
        </div>

        <!-- Tabla scrollable -->
        <div style="overflow-y:auto;flex:1;padding:0 22px;">
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <thead>
              <tr style="position:sticky;top:0;background:#f5f5f5;z-index:1;">
                <th style="padding:8px;text-align:left;font-size:0.8rem;color:#666;width:90px;">Matrícula</th>
                <th style="padding:8px;text-align:left;font-size:0.8rem;color:#666;width:100px;">Grupo</th>
                <th style="padding:8px;text-align:left;font-size:0.8rem;color:#666;">Nombre</th>
              </tr>
            </thead>
            <tbody id="tbodyNombresMasivo">
              ${filasHtml}
            </tbody>
          </table>
        </div>

        <!-- Pie -->
        <div style="padding:14px 22px;border-top:1px solid #eee;display:flex;gap:10px;justify-content:flex-end;align-items:center;">
          <span id="statusNombresMasivo" style="font-size:0.82rem;color:#666;margin-right:auto;"></span>
          <button onclick="cerrarEditorNombresMasivo()"
                  style="padding:8px 20px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer;font-size:0.9rem;">
            Cancelar
          </button>
          <button onclick="guardarNombresMasivo()"
                  style="padding:8px 22px;border:none;border-radius:8px;
                         background:linear-gradient(135deg,#43a047,#2e7d32);
                         color:#fff;cursor:pointer;font-size:0.9rem;font-weight:600;">
            💾 Guardar cambios
          </button>
        </div>

      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ---------- Cerrar modal ----------
function cerrarEditorNombresMasivo() {
    const m = document.getElementById('modalNombresMasivo');
    if (m) m.remove();
}

// ---------- Guardar ----------
async function guardarNombresMasivo() {
    const inputs = document.querySelectorAll('#tbodyNombresMasivo input[data-id]');
    const cambios = [];

    inputs.forEach(input => {
        const nuevoNombre = input.value.trim();
        const nombreOriginal = input.dataset.original.trim();
        if (nuevoNombre && nuevoNombre !== nombreOriginal) {
            cambios.push({ id: input.dataset.id, nombre: nuevoNombre });
        }
    });

    if (cambios.length === 0) {
        alert('No hay cambios que guardar.');
        return;
    }

    const confirmMsg =
        `Se actualizarán ${cambios.length} nombre(s).\n\n` +
        cambios.slice(0, 8).map(c => `• ${c.nombre}`).join('\n') +
        (cambios.length > 8 ? `\n… y ${cambios.length - 8} más` : '') +
        '\n\n¿Continuar?';

    if (!confirm(confirmMsg)) return;

    const statusEl = document.getElementById('statusNombresMasivo');
    statusEl.textContent = 'Guardando…';

    // Deshabilitar botón para evitar doble clic
    const btnGuardar = document.querySelector('#modalNombresMasivo button[onclick="guardarNombresMasivo()"]');
    if (btnGuardar) btnGuardar.disabled = true;

    let errores = 0;

    for (let i = 0; i < cambios.length; i++) {
        const { id, nombre } = cambios[i];
        statusEl.textContent = `Guardando ${i + 1} / ${cambios.length}…`;

        try {
            // 1. Actualizar en usuarios
            await db.collection('usuarios').doc(id).update({ nombre });

            // 2. Actualizar alumnoNombre en calificaciones (puede haber 0 o muchos)
            const calSnap = await db.collection('calificaciones')
                .where('alumnoId', '==', id)
                .get();

            if (!calSnap.empty) {
                const batch = db.batch();
                calSnap.forEach(calDoc => batch.update(calDoc.ref, { alumnoNombre: nombre }));
                await batch.commit();
            }

            // 3. Reflejar en caché local para que la lista se actualice sin recargar
            const cached = _alumnosCache.find(x => x.id === id);
            if (cached) cached.data.nombre = nombre;

        } catch (err) {
            console.error(`[editarNombresMasivo] Error en alumno ${id}:`, err);
            errores++;
        }
    }

    if (errores > 0) {
        statusEl.textContent = `⚠️ ${errores} error(es). El resto se guardó correctamente.`;
        if (btnGuardar) btnGuardar.disabled = false;
    } else {
        statusEl.textContent = `✅ ${cambios.length} nombre(s) actualizados`;
        // Actualizar lista en pantalla y cerrar modal tras breve pausa
        aplicarFiltrosAlumnos();
        setTimeout(cerrarEditorNombresMasivo, 900);
    }
}