// ===== ACTAS DE CALIFICACIONES PDF =====
// Depende de globals en coordinaModules.js:
//   asignacionCalifActual, alumnosCalifMateria,
//   tieneExamenFinalCoord, esMaestriaCoord,
//   calcularPromedioAlumno

function actualizarBotonesActaPDF() {
    const btnExtra = document.getElementById('btnActaExtraordinario');
    const btnETS   = document.getElementById('btnActaETS');
    if (!btnExtra || !btnETS) return;
    const visible = !esMaestriaCoord;
    btnExtra.style.display = visible ? '' : 'none';
    btnETS.style.display   = visible ? '' : 'none';
}

// ── helpers internos ──────────────────────────────────────────────────────────

function _acta_encabezado(doc, titulo) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const fecha = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    if (typeof agregarLogosAlPDF === 'function') {
        agregarLogosAlPDF(doc, tieneExamenFinalCoord);
    }

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(titulo, 105, 25, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(30, 38, 180, 38);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    let y = 45;
    doc.text(`Fecha: ${fecha}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`Materia: ${asignacionCalifActual.materiaNombre}`, 20, y); y += 5;
    doc.text(`Grupo: ${asignacionCalifActual.codigoGrupo}`,     20, y); y += 5;
    doc.text(`Profesor: ${asignacionCalifActual.profesorNombre}`, 20, y); y += 5;
    doc.text(`Periodo: ${asignacionCalifActual.periodo}`,        20, y);
    return y + 10;
}

function _acta_pie(doc, total, startY) {
    let finalY = startY + 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total de alumnos: ${total}`, 20, finalY);

    const firmasY = finalY + 30;
    doc.setLineWidth(0.3);
    doc.line(30,  firmasY, 90,  firmasY);
    doc.line(120, firmasY, 180, firmasY);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Profesor',    60,  firmasY + 5, { align: 'center' });
    doc.text('Coordinador', 150, firmasY + 5, { align: 'center' });
}

function _acta_colorCalif(data, colIndex) {
    if (data.column.index === colIndex && data.section === 'body') {
        const v = parseFloat(data.cell.text[0]);
        if (!isNaN(v)) {
            data.cell.styles.textColor = v < 6 ? [244, 67, 54] : [76, 175, 80];
        }
    }
}

function _acta_jsPDF() {
    if (typeof window.jspdf === 'undefined') {
        alert('Error: jsPDF no está cargado. Recarga la página.');
        return null;
    }
    const { jsPDF } = window.jspdf;
    return new jsPDF({ format: 'letter' });
}

// ── Acta General ─────────────────────────────────────────────────────────────

function descargarActaPDF() {
    if (!asignacionCalifActual || alumnosCalifMateria.length === 0) {
        alert('Primero selecciona una materia y carga los alumnos.');
        return;
    }
    try {
        const doc = _acta_jsPDF();
        if (!doc) return;

        const fmtP = v => (v === null || v === undefined) ? '-' : v === 'NP' ? 'NP' : String(v);
        const toNum = v => (v !== null && v !== undefined && v !== 'NP') ? parseFloat(v) : (v === 'NP' ? 'NP' : null);

        const tableData = [];
        let calColIndex;

        alumnosCalifMateria.forEach((alumno, index) => {
            const promedio = calcularPromedioAlumno(alumno);
            const p1 = alumno.calificaciones.parcial1;
            const p2 = alumno.calificaciones.parcial2;
            const p3 = alumno.calificaciones.parcial3;

            if (esMaestriaCoord) {
                tableData.push([(index + 1).toString(), alumno.matricula, alumno.nombre, fmtP(p1), promedio]);
            } else if (tieneExamenFinalCoord) {
                const p3Num = toNum(p3);
                const necesitaExtra = promedio === 'NP' || (p3Num !== null && p3Num !== 'NP' && p3Num < 6);
                const extraVal = alumno.calificaciones.extraordinario !== null && alumno.calificaciones.extraordinario !== undefined
                    ? String(alumno.calificaciones.extraordinario)
                    : (necesitaExtra ? '' : '-');
                tableData.push([(index + 1).toString(), alumno.matricula, alumno.nombre, fmtP(p1), fmtP(p2), fmtP(p3), promedio, extraVal]);
            } else {
                tableData.push([(index + 1).toString(), alumno.matricula, alumno.nombre, fmtP(p1), fmtP(p2), fmtP(p3), promedio]);
            }
        });

        let headActa, colStylesActa;

        if (esMaestriaCoord) {
            headActa = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'Calificación']];
            colStylesActa = {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 33 },
                2: { halign: 'left',   cellWidth: 97 },
                3: { halign: 'center', cellWidth: 15 },
                4: { halign: 'center', cellWidth: 25, fontStyle: 'bold' }
            };
            calColIndex = 4;
        } else if (tieneExamenFinalCoord) {
            headActa = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'E.F', 'Calificación', 'Extraordinario']];
            colStylesActa = {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 33 },
                2: { halign: 'left',   cellWidth: 52 },
                3: { halign: 'center', cellWidth: 13 },
                4: { halign: 'center', cellWidth: 13 },
                5: { halign: 'center', cellWidth: 13 },
                6: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
                7: { halign: 'center', cellWidth: 26 }
            };
            calColIndex = 6;
        } else {
            headActa = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'D3', 'Calificación']];
            colStylesActa = {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 33 },
                2: { halign: 'left',   cellWidth: 70 },
                3: { halign: 'center', cellWidth: 14 },
                4: { halign: 'center', cellWidth: 14 },
                5: { halign: 'center', cellWidth: 14 },
                6: { halign: 'center', cellWidth: 25, fontStyle: 'bold' }
            };
            calColIndex = 6;
        }

        const startY = _acta_encabezado(doc, 'ACTA DE CALIFICACIONES');

        doc.autoTable({
            startY,
            margin: { bottom: 40 },
            head: headActa,
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [108, 29, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: colStylesActa,
            didParseCell: data => _acta_colorCalif(data, calColIndex)
        });

        _acta_pie(doc, alumnosCalifMateria.length, doc.lastAutoTable.finalY);

        doc.save(`Acta_${asignacionCalifActual.codigoGrupo}_${asignacionCalifActual.materiaNombre}.pdf`);

    } catch (error) {
        console.error('Error al generar Acta General:', error);
        alert('Error al generar PDF. Verifica que jsPDF esté cargado correctamente.');
    }
}

// ── Acta Extraordinario ───────────────────────────────────────────────────────

function descargarActaExtraordinarioPDF() {
    if (!asignacionCalifActual || alumnosCalifMateria.length === 0) {
        alert('Primero selecciona una materia y carga los alumnos.');
        return;
    }

    const alumnosFiltrados = alumnosCalifMateria.filter(a =>
        a.calificaciones.extraordinario !== null &&
        a.calificaciones.extraordinario !== undefined
    );

    if (alumnosFiltrados.length === 0) {
        alert('No hay alumnos con calificación de extraordinario en esta materia.');
        return;
    }

    try {
        const doc = _acta_jsPDF();
        if (!doc) return;

        const startY = _acta_encabezado(doc, 'ACTA DE EXTRAORDINARIO');

        const tableData = alumnosFiltrados.map((alumno, index) => [
            (index + 1).toString(),
            alumno.matricula,
            alumno.nombre,
            String(alumno.calificaciones.extraordinario)
        ]);

        doc.autoTable({
            startY,
            margin: { bottom: 40 },
            head: [['No.', 'Matrícula', 'Nombre del Alumno', 'Extraordinario']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [108, 29, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10  },
                1: { halign: 'center', cellWidth: 33  },
                2: { halign: 'left',   cellWidth: 108 },
                3: { halign: 'center', cellWidth: 29, fontStyle: 'bold' }
            },
            didParseCell: data => _acta_colorCalif(data, 3)
        });

        _acta_pie(doc, alumnosFiltrados.length, doc.lastAutoTable.finalY);

        doc.save(`Acta_Extraordinario_${asignacionCalifActual.codigoGrupo}_${asignacionCalifActual.materiaNombre}.pdf`);

    } catch (error) {
        console.error('Error al generar Acta Extraordinario:', error);
        alert('Error al generar PDF. Verifica que jsPDF esté cargado correctamente.');
    }
}

// ── Acta ETS ─────────────────────────────────────────────────────────────────

// ── Actas Históricas ─────────────────────────────────────────────────────────

function mostrarVistaCalif(vista) {
    const esActual = vista === 'actual';
    document.getElementById('vistaCalifActual').style.display    = esActual ? '' : 'none';
    document.getElementById('vistaCalifHistorica').style.display = esActual ? 'none' : '';

    const tabActual    = document.getElementById('tabCalifActual');
    const tabHistorica = document.getElementById('tabCalifHistorica');
    tabActual.style.background    = esActual ? '#43a047' : 'white';
    tabActual.style.color         = esActual ? 'white'   : '#43a047';
    tabHistorica.style.background = esActual ? 'white'   : '#43a047';
    tabHistorica.style.color      = esActual ? '#43a047' : 'white';

    if (!esActual) _cargarSelectMateriaHistorica();
}

async function _cargarSelectMateriaHistorica() {
    const sel = document.getElementById('selectMateriaHistorica');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando...</option>';
    try {
        const carreraId = (typeof carreraActivaId !== 'undefined' && carreraActivaId)
            ? carreraActivaId
            : (typeof usuarioActual !== 'undefined' && usuarioActual && usuarioActual.carreraId);
        if (!carreraId) { sel.innerHTML = '<option value="">Sin carrera activa</option>'; return; }

        const snap = await db.collection('materias')
            .where('carreraId', '==', carreraId)
            .where('activo', '==', true)
            .get();

        sel.innerHTML = '<option value="">Seleccionar materia...</option>';
        snap.docs
            .map(d => ({ id: d.id, nombre: d.data().nombre || '' }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .forEach(m => {
                const o = document.createElement('option');
                o.value = m.id; o.text = m.nombre;
                sel.appendChild(o);
            });
    } catch (e) {
        sel.innerHTML = '<option value="">Error al cargar</option>';
        console.error('[ActasHist] Error cargando materias:', e);
    }
}

async function generarActaHistorica(tipo, btn) {
    const materiaId = document.getElementById('selectMateriaHistorica').value;
    const ciclo     = document.getElementById('inputCicloHistorico').value.trim();
    const campo     = tipo === 'ETS' ? 'ets' : 'extraordinario';
    const titulo    = tipo === 'ETS' ? 'ACTA DE ETS' : 'ACTA DE EXTRAORDINARIO';

    if (!materiaId) { alert('Selecciona una materia.'); return; }

    const txtOrig = btn.textContent;
    btn.textContent = 'Buscando...'; btn.disabled = true;

    try {
        const snap = await db.collection('calificaciones')
            .where('materiaId', '==', materiaId)
            .get();

        let docs = snap.docs.map(d => d.data())
            .filter(d => d[campo] !== null && d[campo] !== undefined);

        if (ciclo) docs = docs.filter(d => d.periodoAcademico === ciclo);

        if (docs.length === 0) {
            alert(`No hay registros de ${tipo}${ciclo ? ' en el ciclo ' + ciclo : ''} para esa materia.`);
            return;
        }

        // Matrículas desde usuarios (batch)
        const usuariosSnaps = await Promise.all(docs.map(d => db.collection('usuarios').doc(d.alumnoId).get()));
        const matriculaMap  = {};
        usuariosSnaps.forEach(s => { if (s.exists) matriculaMap[s.id] = s.data().matricula || '-'; });

        const materiaNombre  = docs[0].materiaNombre  || '';
        const profesorNombre = docs[0].profesorNombre || '-';
        const periodoLabel   = ciclo || docs[0].periodoAcademico || 'Histórico';

        // Si hay varios grupos, listarlos todos
        const grupos = [...new Set(docs.map(d => d.codigoGrupo).filter(Boolean))];
        const grupoLabel = grupos.length === 1 ? grupos[0] : grupos.join(', ');

        const alumnos = docs
            .map(d => ({ nombre: d.alumnoNombre || '-', matricula: matriculaMap[d.alumnoId] || '-', calificacion: d[campo] }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

        // PDF
        const doc = _acta_jsPDF(); if (!doc) return;
        const pageWidth = doc.internal.pageSize.getWidth();
        const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        if (typeof agregarLogosAlPDF === 'function') agregarLogosAlPDF(doc, false);

        doc.setFontSize(18); doc.setFont(undefined, 'bold');
        doc.text(titulo, 105, 25, { align: 'center' });
        doc.setLineWidth(0.5); doc.line(30, 38, 180, 38);

        doc.setFontSize(11); doc.setFont(undefined, 'normal');
        let y = 45;
        doc.text(`Fecha: ${fecha}`,              pageWidth - 20, y, { align: 'right' });
        doc.text(`Materia: ${materiaNombre}`,    20, y); y += 5;
        doc.text(`Grupo: ${grupoLabel}`,         20, y);
        doc.text(`Ciclo: ${periodoLabel}`,       pageWidth - 20, y, { align: 'right' }); y += 5;
        doc.text(`Profesor: ${profesorNombre}`,  20, y);
        y += 10;

        const tableData = alumnos.map((a, i) => [
            (i + 1).toString(), a.matricula, a.nombre, String(a.calificacion)
        ]);

        doc.autoTable({
            startY: y, margin: { bottom: 40 },
            head: [['No.', 'Matrícula', 'Nombre del Alumno', tipo]],
            body: tableData, theme: 'grid',
            headStyles: { fillColor: [108, 29, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10  },
                1: { halign: 'center', cellWidth: 33  },
                2: { halign: 'left',   cellWidth: 108 },
                3: { halign: 'center', cellWidth: 29, fontStyle: 'bold' }
            },
            didParseCell: data => _acta_colorCalif(data, 3)
        });

        _acta_pie(doc, alumnos.length, doc.lastAutoTable.finalY);

        const sufijo = ciclo ? `_${ciclo}` : '';
        doc.save(`Acta_${tipo}${sufijo}_${materiaNombre.replace(/\s+/g, '_')}.pdf`);

    } catch (e) {
        console.error('[ActasHist] Error:', e);
        alert('Error al generar acta: ' + e.message);
    } finally {
        btn.textContent = txtOrig; btn.disabled = false;
    }
}

// ── Acta ETS ─────────────────────────────────────────────────────────────────

function descargarActaEtsPDF() {
    if (!asignacionCalifActual || alumnosCalifMateria.length === 0) {
        alert('Primero selecciona una materia y carga los alumnos.');
        return;
    }

    const alumnosFiltrados = alumnosCalifMateria.filter(a =>
        a.calificaciones.ets !== null &&
        a.calificaciones.ets !== undefined
    );

    if (alumnosFiltrados.length === 0) {
        alert('No hay alumnos con calificación ETS en esta materia.');
        return;
    }

    try {
        const doc = _acta_jsPDF();
        if (!doc) return;

        const startY = _acta_encabezado(doc, 'ACTA DE ETS');

        const tableData = alumnosFiltrados.map((alumno, index) => [
            (index + 1).toString(),
            alumno.matricula,
            alumno.nombre,
            String(alumno.calificaciones.ets)
        ]);

        doc.autoTable({
            startY,
            margin: { bottom: 40 },
            head: [['No.', 'Matrícula', 'Nombre del Alumno', 'ETS']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [108, 29, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10  },
                1: { halign: 'center', cellWidth: 33  },
                2: { halign: 'left',   cellWidth: 108 },
                3: { halign: 'center', cellWidth: 29, fontStyle: 'bold' }
            },
            didParseCell: data => _acta_colorCalif(data, 3)
        });

        _acta_pie(doc, alumnosFiltrados.length, doc.lastAutoTable.finalY);

        doc.save(`Acta_ETS_${asignacionCalifActual.codigoGrupo}_${asignacionCalifActual.materiaNombre}.pdf`);

    } catch (error) {
        console.error('Error al generar Acta ETS:', error);
        alert('Error al generar PDF. Verifica que jsPDF esté cargado correctamente.');
    }
}

// ── Descarga Masiva (periodo actual, todas las materias de la carrera) ─────────
// Genera un único PDF con todas las actas concatenadas (una por materia).
// No produce ZIP ni WinRAR — el navegador descarga directamente el .pdf.

async function descargarActasMasivas(tipo, btn) {
    if (typeof window.jspdf === 'undefined') {
        alert('Error: jsPDF no está cargado. Recarga la página.');
        return;
    }

    const txtOrig = btn.textContent;
    btn.textContent = 'Generando...'; btn.disabled = true;

    // Overlay de progreso — se elimina en finally
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:14px;padding:32px 40px;text-align:center;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
            <div style="font-size:17px;font-weight:bold;color:#333;margin-bottom:10px;">Generando Actas</div>
            <div id="_mv_msg" style="font-size:14px;color:#666;margin-bottom:18px;">Cargando datos del periodo...</div>
            <div style="height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden;">
                <div id="_mv_bar" style="height:100%;background:#43a047;width:5%;border-radius:3px;transition:width 0.5s;"></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const setProgreso = (msg, pct) => {
        const el = document.getElementById('_mv_msg');
        const bar = document.getElementById('_mv_bar');
        if (el)  el.textContent  = msg;
        if (bar) bar.style.width = pct + '%';
    };

    try {
        const carreraId = usuarioActual && usuarioActual.carreraId;
        const periodo   = typeof periodoActualCarrera !== 'undefined' ? periodoActualCarrera : null;

        if (!carreraId || !periodo) {
            alert('No se pudo determinar la carrera o el periodo activo.');
            return;
        }

        setProgreso('Consultando asignaciones y calificaciones en Firebase...', 15);

        // Cargar todo en paralelo: asignaciones, calificaciones, alumnos, flags de carrera
        const [pmSnap, calSnap, tieneExFinal, esUnParcial, alumnosSnap] = await Promise.all([
            db.collection('profesorMaterias')
              .where('carreraId', '==', carreraId)
              .where('activa',    '==', true)
              .get(),
            db.collection('calificaciones')
              .where('carreraId', '==', carreraId)
              .get(),
            obtenerTieneExamenFinal(carreraId),
            obtenerEsUnParcial(carreraId),
            db.collection('usuarios')
              .where('rol',       '==', 'alumno')
              .where('carreraId', '==', carreraId)
              .get()
        ]);

        // Índice de calificaciones del periodo actual: "codigoGrupo_materiaId" → [calData]
        const calIdx = {};
        calSnap.docs.forEach(d => {
            const c = d.data();
            if (c.periodo !== periodo) return;
            const k = `${c.codigoGrupo}_${c.materiaId}`;
            if (!calIdx[k]) calIdx[k] = [];
            calIdx[k].push(c);
        });

        // Mapa alumnoId → matrícula
        const matMap = {};
        alumnosSnap.docs.forEach(d => { matMap[d.id] = d.data().matricula || '-'; });

        // Ordenar asignaciones por nombre de materia
        const asigs = pmSnap.docs.map(d => d.data())
            .sort((a, b) => (a.materiaNombre || '').localeCompare(b.materiaNombre || ''));

        setProgreso(`Generando PDF con ${asigs.length} materias...`, 55);

        const { jsPDF } = window.jspdf;
        const doc       = new jsPDF({ format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const fecha     = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        const fmtP      = v => (v == null) ? '-' : v === 'NP' ? 'NP' : String(v);

        const tituloActa = tipo === 'GENERAL' ? 'ACTA DE CALIFICACIONES'
                         : tipo === 'ETS'     ? 'ACTA DE ETS'
                         :                      'ACTA DE EXTRAORDINARIO';

        let primeraPagina  = true;
        let actasGeneradas = 0;

        for (const asig of asigs) {
            let cals = calIdx[`${asig.codigoGrupo}_${asig.materiaId}`] || [];

            if (tipo === 'ETS') {
                cals = cals.filter(c => c.ets !== null && c.ets !== undefined);
            } else if (tipo === 'EXT') {
                cals = cals.filter(c => c.extraordinario !== null && c.extraordinario !== undefined);
            }
            if (cals.length === 0) continue;

            if (!primeraPagina) doc.addPage();
            primeraPagina = false;
            actasGeneradas++;

            if (typeof agregarLogosAlPDF === 'function') agregarLogosAlPDF(doc, tieneExFinal);

            // Encabezado
            doc.setFontSize(18); doc.setFont(undefined, 'bold');
            doc.text(tituloActa, 105, 25, { align: 'center' });
            doc.setLineWidth(0.5); doc.line(30, 38, 180, 38);

            doc.setFontSize(11); doc.setFont(undefined, 'normal');
            let y = 45;
            doc.text(`Fecha: ${fecha}`,                   pageWidth - 20, y, { align: 'right' });
            doc.text(`Materia: ${asig.materiaNombre}`,    20, y); y += 5;
            doc.text(`Grupo: ${asig.codigoGrupo}`,        20, y);
            doc.text(`Periodo: ${periodo}`,               pageWidth - 20, y, { align: 'right' }); y += 5;
            doc.text(`Profesor: ${asig.profesorNombre}`,  20, y);
            y += 10;

            // Ordenar alumnos por nombre
            cals.sort((a, b) => (a.alumnoNombre || '').localeCompare(b.alumnoNombre || ''));

            // Tabla y columnas según tipo de acta y de carrera
            let head, columnStyles, calColIndex, tableData;

            if (tipo === 'ETS') {
                head          = [['No.', 'Matrícula', 'Nombre del Alumno', 'ETS']];
                columnStyles  = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:108}, 3:{halign:'center',cellWidth:29,fontStyle:'bold'} };
                calColIndex   = 3;
                tableData     = cals.map((c, i) => [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', String(c.ets)]);

            } else if (tipo === 'EXT') {
                head          = [['No.', 'Matrícula', 'Nombre del Alumno', 'Extraordinario']];
                columnStyles  = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:108}, 3:{halign:'center',cellWidth:29,fontStyle:'bold'} };
                calColIndex   = 3;
                tableData     = cals.map((c, i) => [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', String(c.extraordinario)]);

            } else if (esUnParcial) {
                head          = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'Calificación']];
                columnStyles  = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:97}, 3:{halign:'center',cellWidth:15}, 4:{halign:'center',cellWidth:25,fontStyle:'bold'} };
                calColIndex   = 4;
                tableData     = cals.map((c, i) => {
                    const p1  = c.parciales?.parcial1 ?? null;
                    const cal = calcularCalificacion(p1, null, null, false);
                    return [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(p1), fmtP(cal)];
                });

            } else if (tieneExFinal) {
                head          = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'E.F', 'Calificación', 'Extraordinario']];
                columnStyles  = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:52}, 3:{halign:'center',cellWidth:13}, 4:{halign:'center',cellWidth:13}, 5:{halign:'center',cellWidth:13}, 6:{halign:'center',cellWidth:20,fontStyle:'bold'}, 7:{halign:'center',cellWidth:26} };
                calColIndex   = 6;
                tableData     = cals.map((c, i) => {
                    const p1 = c.parciales?.parcial1 ?? null, p2 = c.parciales?.parcial2 ?? null, p3 = c.parciales?.parcial3 ?? null;
                    const cal = calcularCalificacion(p1, p2, p3, true);
                    const p3n = (p3 != null && p3 !== 'NP') ? parseFloat(p3) : null;
                    const extraVal = c.extraordinario != null ? String(c.extraordinario) : (cal === 'NP' || (p3n !== null && p3n < 6) ? '' : '-');
                    return [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(p1), fmtP(p2), fmtP(p3), fmtP(cal), extraVal];
                });

            } else {
                head          = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'D3', 'Calificación']];
                columnStyles  = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:70}, 3:{halign:'center',cellWidth:14}, 4:{halign:'center',cellWidth:14}, 5:{halign:'center',cellWidth:14}, 6:{halign:'center',cellWidth:25,fontStyle:'bold'} };
                calColIndex   = 6;
                tableData     = cals.map((c, i) => {
                    const p1 = c.parciales?.parcial1 ?? null, p2 = c.parciales?.parcial2 ?? null, p3 = c.parciales?.parcial3 ?? null;
                    const cal = calcularCalificacion(p1, p2, p3, false);
                    return [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(p1), fmtP(p2), fmtP(p3), fmtP(cal)];
                });
            }

            doc.autoTable({
                startY: y, margin: { bottom: 40 },
                head, body: tableData, theme: 'grid',
                headStyles: { fillColor: [108, 29, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
                styles: { fontSize: 10, cellPadding: 2 },
                columnStyles,
                didParseCell: data => _acta_colorCalif(data, calColIndex)
            });

            _acta_pie(doc, cals.length, doc.lastAutoTable.finalY);
        }

        if (actasGeneradas === 0) {
            const label = tipo === 'GENERAL' ? 'calificaciones' : tipo;
            alert(`No hay registros de ${label} para el periodo ${periodo}.`);
            return;
        }

        setProgreso(`Descargando PDF (${actasGeneradas} actas)...`, 95);

        const nomTipo = tipo === 'GENERAL' ? 'Generales' : tipo;
        doc.save(`Actas_${nomTipo}_${carreraId}_${periodo}.pdf`);
        console.log(`[ActasMasivas] ${actasGeneradas} actas generadas — tipo ${tipo}, periodo ${periodo}`);

    } catch (e) {
        console.error('[ActasMasivas] Error:', e);
        alert('Error al generar actas: ' + e.message);
    } finally {
        overlay.remove();
        btn.textContent = txtOrig; btn.disabled = false;
    }
}
