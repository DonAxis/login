// Vigía — herramienta de mantenimiento puntual de un unico uso
// TAREA: Limpiar materia duplicada accidental
//   ID a eliminar : 5KlHAJpdKWrJM9jUh09m
//   Nombre        : ACTUALIZACION DE LA INFORMACION FINANCIERA
//   Correcta      : ACTUALIZACIÓN DE LA INFORMACION FINANCIERA (RE-EXPRESIÓN FINANCIERA)
// Colecciones afectadas: materias, profesorMaterias, calificaciones,
//   alumnoMaterias, inscripcionesEspeciales, historialAcademico (array materias[]),
//   historialCalificaciones, registroCambios

const _VIGIA_MATERIA_ID = '5KlHAJpdKWrJM9jUh09m';

async function accionVigia() {
    const ok = confirm(
        'VIGÍA — LIMPIEZA DE MATERIA DUPLICADA\n\n' +
        'ID a borrar: ' + _VIGIA_MATERIA_ID + '\n' +
        'Nombre: ACTUALIZACION DE LA INFORMACION FINANCIERA\n\n' +
        '¿Confirmas la limpieza completa en todas las colecciones?\n' +
        '(Esta acción es destructiva e irreversible)'
    );
    if (!ok) { alert('Cancelado.'); return; }

    const db = firebase.firestore();
    const MID = _VIGIA_MATERIA_ID;
    const log = [];
    let totalEliminados = 0;
    let totalActualizados = 0;

    // --- helpers de batch con auto-commit al llegar a 490 ops ---
    let batch = db.batch();
    let batchOps = 0;

    async function flushBatch() {
        if (batchOps > 0) {
            await batch.commit();
            batch = db.batch();
            batchOps = 0;
        }
    }

    function batchDelete(ref) {
        batch.delete(ref);
        batchOps++;
        totalEliminados++;
    }

    function batchUpdate(ref, data) {
        batch.update(ref, data);
        batchOps++;
        totalActualizados++;
    }

    async function checkFlush() {
        if (batchOps >= 490) await flushBatch();
    }

    try {
        // 1. materias — borrar si aún existe
        const materiaRef = db.collection('materias').doc(MID);
        const materiaSnap = await materiaRef.get();
        if (materiaSnap.exists) {
            batchDelete(materiaRef);
            log.push('✅ materias: doc eliminado');
        } else {
            log.push('ℹ️  materias: doc ya no existe');
        }
        await checkFlush();

        // 2. profesorMaterias — causa principal de que el coordinador siga viéndola
        const pmSnap = await db.collection('profesorMaterias')
            .where('materiaId', '==', MID).get();
        pmSnap.forEach(d => { batchDelete(d.ref); checkFlush(); });
        log.push(`✅ profesorMaterias: ${pmSnap.size} doc(s) eliminado(s)`);
        await flushBatch();

        // 3. calificaciones — el usuario ya las borró, pero verificamos
        const calSnap = await db.collection('calificaciones')
            .where('materiaId', '==', MID).get();
        calSnap.forEach(d => { batchDelete(d.ref); checkFlush(); });
        log.push(`✅ calificaciones: ${calSnap.size} doc(s) eliminado(s)`);
        await flushBatch();

        // 4. alumnoMaterias
        const amSnap = await db.collection('alumnoMaterias')
            .where('materiaId', '==', MID).get();
        amSnap.forEach(d => { batchDelete(d.ref); checkFlush(); });
        log.push(`✅ alumnoMaterias: ${amSnap.size} doc(s) eliminado(s)`);
        await flushBatch();

        // 5. inscripcionesEspeciales
        const ieSnap = await db.collection('inscripcionesEspeciales')
            .where('materiaId', '==', MID).get();
        ieSnap.forEach(d => { batchDelete(d.ref); checkFlush(); });
        log.push(`✅ inscripcionesEspeciales: ${ieSnap.size} doc(s) eliminado(s)`);
        await flushBatch();

        // 6. historialCalificaciones
        const hcSnap = await db.collection('historialCalificaciones')
            .where('materiaId', '==', MID).get();
        hcSnap.forEach(d => { batchDelete(d.ref); checkFlush(); });
        log.push(`✅ historialCalificaciones: ${hcSnap.size} doc(s) eliminado(s)`);
        await flushBatch();

        // 7. registroCambios
        const rcSnap = await db.collection('registroCambios')
            .where('materiaId', '==', MID).get();
        rcSnap.forEach(d => { batchDelete(d.ref); checkFlush(); });
        log.push(`✅ registroCambios: ${rcSnap.size} doc(s) eliminado(s)`);
        await flushBatch();

        // 8. historialAcademico — escaneo completo (no se puede filtrar por campo dentro de array)
        //    Elimina la entrada de materias[] y también de periodos[].materias[] si existe
        const haAll = await db.collection('historialAcademico').get();
        let haModificados = 0;
        for (const haDoc of haAll.docs) {
            const data = haDoc.data();
            let cambio = false;
            const updates = {};

            // materias[] (array plano — boleta del alumno)
            const materias = data.materias || [];
            const materiasLimpias = materias.filter(m => m.materiaId !== MID);
            if (materiasLimpias.length !== materias.length) {
                updates.materias = materiasLimpias;
                cambio = true;
            }

            // periodos[].materias[] (historial acumulativo por periodo)
            const periodos = data.periodos || [];
            let periodosModificados = false;
            const periodosLimpios = periodos.map(p => {
                const pm = (p.materias || []).filter(m => m.materiaId !== MID);
                if (pm.length !== (p.materias || []).length) {
                    periodosModificados = true;
                    return { ...p, materias: pm };
                }
                return p;
            });
            if (periodosModificados) {
                updates.periodos = periodosLimpios;
                cambio = true;
            }

            if (cambio) {
                batchUpdate(haDoc.ref, updates);
                haModificados++;
                await checkFlush();
            }
        }
        await flushBatch();
        log.push(`✅ historialAcademico: ${haAll.size} docs escaneados, ${haModificados} actualizados`);

        // --- resumen ---
        const resumen = [
            '═══════════════════════════════════',
            '  VIGÍA — LIMPIEZA COMPLETA ✅',
            '═══════════════════════════════════',
            ...log,
            '───────────────────────────────────',
            `  Documentos eliminados : ${totalEliminados}`,
            `  Documentos actualizados: ${totalActualizados}`,
            '═══════════════════════════════════'
        ].join('\n');

        console.log(resumen);
        alert(resumen);

    } catch (err) {
        const msg = 'ERROR en vigía:\n' + err.message + '\n\nLog parcial:\n' + log.join('\n');
        console.error(msg, err);
        alert(msg);
    }
}
