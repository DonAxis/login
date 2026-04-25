// vigia.js — Herramientas de mantenimiento para el admin

async function accionVigia() {
    const btn = document.querySelector('[onclick="accionVigia()"]');
    const pTag = btn ? btn.querySelector('p') : null;

    if (pTag) pTag.textContent = 'Analizando...';
    if (btn) btn.style.opacity = '0.7';

    try {
        // 1. Buscar todas las carreras de maestría
        const carrerasSnap = await db.collection('carreras').get();
        const maestriaIds = [];
        carrerasSnap.forEach(doc => {
            const d = doc.data();
            const esMaestria = (d.codigo || '').startsWith('M') ||
                               (d.nombre || '').toLowerCase().startsWith('maestr');
            if (esMaestria) maestriaIds.push(doc.id);
        });

        if (maestriaIds.length === 0) {
            alert('No se encontraron carreras de maestría.');
            return;
        }

        // 2. Buscar materias de esas carreras (in-query de hasta 10 ids)
        const materiasAMigrar = [];
        for (let i = 0; i < maestriaIds.length; i += 10) {
            const chunk = maestriaIds.slice(i, i + 10);
            const snap = await db.collection('materias').where('carreraId', 'in', chunk).get();
            snap.forEach(doc => {
                const d = doc.data();
                const satca = typeof d.creditosSatca === 'number' ? d.creditosSatca : null;
                const tepic = typeof d.creditosTepic === 'number' ? d.creditosTepic : null;
                const legado = typeof d.creditos === 'number' ? d.creditos : null;

                // Primer valor positivo encontrado (no usa || para no confundir 0 con ausente)
                const canonico = (satca > 0) ? satca : (tepic > 0) ? tepic : (legado > 0) ? legado : null;

                // Solo migrar si existe un valor y creditosSatca no lo tiene todavía
                if (canonico !== null && satca !== canonico) {
                    materiasAMigrar.push({
                        id: doc.id,
                        nombre: d.nombre || doc.id,
                        satca,
                        tepic,
                        legado,
                        canonico
                    });
                }
            });
        }

        if (materiasAMigrar.length === 0) {
            alert('Sin novedad: todas las materias de maestría ya tienen los créditos normalizados en creditosSatca.');
            return;
        }

        // 3. Mostrar resumen y pedir confirmación
        let preview = `Se establecerá creditosSatca en ${materiasAMigrar.length} materia(s) de maestría.\n`;
        preview += `Los campos existentes (creditosTepic, creditos) NO se eliminan.\n\n`;
        materiasAMigrar.forEach(m => {
            const origen = (m.satca > 0) ? 'creditosSatca' : (m.tepic > 0) ? 'creditosTepic' : 'creditos';
            preview += `• ${m.nombre}: ${origen}=${m.canonico}  →  creditosSatca=${m.canonico}\n`;
        });
        preview += `\n¿Proceder?`;

        if (!confirm(preview)) return;

        // 4. Ejecutar en batches de 499 — solo escribe creditosSatca, no borra nada
        const CHUNK = 499;
        const ops = materiasAMigrar.map(m => ({
            ref: db.collection('materias').doc(m.id),
            data: {
                creditosSatca: m.canonico
            }
        }));

        for (let i = 0; i < ops.length; i += CHUNK) {
            const batch = db.batch();
            ops.slice(i, i + CHUNK).forEach(op => batch.update(op.ref, op.data));
            await batch.commit();
        }

        alert(`Migración completada: ${materiasAMigrar.length} materia(s) actualizadas.`);

    } catch (e) {
        console.error('[vigia] accionVigia:', e);
        alert('Error: ' + e.message);
    } finally {
        if (pTag) pTag.textContent = 'Migrar créditos maestría';
        if (btn) btn.style.opacity = '1';
    }
}
