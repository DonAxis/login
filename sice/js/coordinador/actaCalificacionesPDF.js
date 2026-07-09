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
    const pageHeight = doc.internal.pageSize.getHeight();
    let finalY = startY + 10;

    // Si las firmas no caben en la página actual, abrir una nueva
    if (finalY + 45 > pageHeight) {
        doc.addPage();
        finalY = 20;
    }

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

        // Índice de calificaciones sin filtro de periodo: el scope lo da profesorMaterias (activa=true).
        // calificaciones.periodo puede estar desfasado si los profesores capturaron en ciclo anterior.
        const calIdx = {};
        calSnap.docs.forEach(d => {
            const c = d.data();
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
                    const cal = redondearCalificacion(calcularCalificacion(p1, null, null, false));
                    return [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(p1), fmtP(cal)];
                });

            } else if (tieneExFinal) {
                head          = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'E.F', 'Calificación', 'Extraordinario']];
                columnStyles  = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:52}, 3:{halign:'center',cellWidth:13}, 4:{halign:'center',cellWidth:13}, 5:{halign:'center',cellWidth:13}, 6:{halign:'center',cellWidth:20,fontStyle:'bold'}, 7:{halign:'center',cellWidth:26} };
                calColIndex   = 6;
                tableData     = cals.map((c, i) => {
                    const p1 = c.parciales?.parcial1 ?? null, p2 = c.parciales?.parcial2 ?? null, p3 = c.parciales?.parcial3 ?? null;
                    const cal = redondearCalificacion(calcularCalificacion(p1, p2, p3, true));
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
                    const cal = redondearCalificacion(calcularCalificacion(p1, p2, p3, false));
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

// ── Panel Actas ───────────────────────────────────────────────────────────────

let _actasHistAlumnosCache = null;
let _actasHistCarreraNombre = null;

async function inicializarSeccionActas() {
    const sel        = document.getElementById('selectMateriaActas');
    const contenedor = document.getElementById('contenedorVistaActas');
    if (!sel) return;
    if (contenedor) contenedor.style.display = 'none';

    sel.innerHTML = '<option value="">Cargando...</option>';

    const carreraId = usuarioActual && usuarioActual.carreraId;
    if (!carreraId) { sel.innerHTML = '<option value="">Sin carrera activa</option>'; return; }

    try {
        const snap = await db.collection('profesorMaterias')
            .where('carreraId', '==', carreraId)
            .where('activa',    '==', true)
            .get();

        sel.innerHTML = '<option value="">Seleccionar materia...</option>';
        const asigs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.codigoGrupo || '').localeCompare(b.codigoGrupo || '') || (a.materiaNombre || '').localeCompare(b.materiaNombre || ''));

        const gruposMap = {};
        asigs.forEach(asig => {
            const g = asig.codigoGrupo || 'Sin grupo';
            if (!gruposMap[g]) gruposMap[g] = [];
            gruposMap[g].push(asig);
        });
        Object.keys(gruposMap).sort().forEach(grupo => {
            const optgrp = document.createElement('optgroup');
            optgrp.label = `Grupo ${grupo}`;
            gruposMap[grupo].forEach(asig => {
                const o = document.createElement('option');
                o.value       = asig.id;
                o.textContent = asig.materiaNombre;
                optgrp.appendChild(o);
            });
            sel.appendChild(optgrp);
        });
    } catch (e) {
        console.error('[Actas] Error cargando materias:', e);
        sel.innerHTML = '<option value="">Error al cargar</option>';
    }

    // Actualizar label del periodo en Descarga Masiva
    const spanPer = document.getElementById('spanPeriodoMasiva');
    if (spanPer) {
        spanPer.textContent = (typeof periodoActualCarrera !== 'undefined' && periodoActualCarrera)
            ? periodoActualCarrera : '(sin periodo)';
    }

    // Resetear sección Históricas
    _actasHistAlumnosCache  = null;
    _actasHistCarreraNombre = null;
    const histInput = document.getElementById('inputActasHistAlumno');
    const histResul = document.getElementById('actasHistResultados');
    const histDet   = document.getElementById('actasHistDetalle');
    const histBusq  = document.getElementById('actasHistBusqueda');
    if (histInput) histInput.value    = '';
    if (histResul) histResul.innerHTML = '';
    if (histDet)   histDet.style.display  = 'none';
    if (histBusq)  histBusq.style.display = '';

    cargarAlumnosActasHist();
}

async function cargarVistaActas() {
    const sel        = document.getElementById('selectMateriaActas');
    const contenedor = document.getElementById('contenedorVistaActas');
    if (!sel || !contenedor) return;

    if (!sel.value) { contenedor.style.display = 'none'; return; }

    contenedor.innerHTML = '<p style="color:#888; padding:20px 0;">Cargando...</p>';
    contenedor.style.display = '';

    try {
        const carreraId = usuarioActual && usuarioActual.carreraId;

        const pmDoc = await db.collection('profesorMaterias').doc(sel.value).get();
        if (!pmDoc.exists) { contenedor.innerHTML = '<p style="color:red;">Materia no encontrada.</p>'; return; }
        const asig = { id: pmDoc.id, ...pmDoc.data() };

        // Fijar globals que usan las funciones PDF
        asignacionCalifActual = asig;
        [tieneExamenFinalCoord, esMaestriaCoord] = await Promise.all([
            obtenerTieneExamenFinal(carreraId),
            obtenerEsUnParcial(carreraId)
        ]);

        // Query por materiaId (campo único, sin índice compuesto), filtrar grupo en memoria
        const calSnap = await db.collection('calificaciones').where('materiaId', '==', asig.materiaId).get();
        const calDocs = calSnap.docs.filter(d => d.data().codigoGrupo === asig.codigoGrupo);

        if (calDocs.length === 0) {
            alumnosCalifMateria = [];
            contenedor.innerHTML = '<p style="color:#888; margin-top:12px;">Sin calificaciones registradas para esta materia.</p>';
            return;
        }

        // Matrículas en batch (máx 30 por consulta 'in')
        const alumnoIds = [...new Set(calDocs.map(d => d.data().alumnoId))];
        const chunks    = [];
        for (let i = 0; i < alumnoIds.length; i += 30) chunks.push(alumnoIds.slice(i, i + 30));
        const userSnaps = await Promise.all(
            chunks.map(ch =>
                db.collection('usuarios')
                  .where(firebase.firestore.FieldPath.documentId(), 'in', ch)
                  .get()
            )
        );
        const matMap = {};
        userSnaps.forEach(s => s.docs.forEach(d => { matMap[d.id] = d.data().matricula || '-'; }));

        // Construir alumnosCalifMateria con el formato que esperan las funciones PDF
        alumnosCalifMateria = calDocs.map(d => {
            const c = d.data();
            return {
                id:        c.alumnoId,
                nombre:    c.alumnoNombre || '-',
                matricula: matMap[c.alumnoId] || '-',
                calificaciones: {
                    parcial1:          c.parciales?.parcial1 ?? null,
                    parcial2:          c.parciales?.parcial2 ?? null,
                    parcial3:          c.parciales?.parcial3 ?? null,
                    extraordinario:    c.extraordinario      ?? null,
                    ets:               c.ets                 ?? null,
                    falta1:            c.faltas?.falta1       ?? null,
                    falta2:            c.faltas?.falta2       ?? null,
                    falta3:            c.faltas?.falta3       ?? null,
                    _hasExtraDropdown: false
                }
            };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

        _renderVistaActas(asig);

    } catch (e) {
        console.error('[Actas] Error:', e);
        contenedor.innerHTML = '<p style="color:red;">Error: ' + e.message + '</p>';
    }
}

function _renderVistaActas(asig) {
    const contenedor = document.getElementById('contenedorVistaActas');
    if (!contenedor) return;

    const fmtP = v => (v == null) ? '-' : v === 'NP' ? 'NP' : String(v);

    let thExtra, rowsFn;
    if (esMaestriaCoord) {
        thExtra = '<th style="text-align:center; padding:8px 6px; width:60px;">D1</th>';
        rowsFn  = c => `<td style="text-align:center; padding:6px;">${fmtP(c.parcial1)}</td>`;
    } else if (tieneExamenFinalCoord) {
        thExtra = '<th style="text-align:center; padding:8px 6px;">D1</th><th style="text-align:center; padding:8px 6px;">D2</th><th style="text-align:center; padding:8px 6px;">E.F</th>';
        rowsFn  = c => `<td style="text-align:center; padding:6px;">${fmtP(c.parcial1)}</td><td style="text-align:center; padding:6px;">${fmtP(c.parcial2)}</td><td style="text-align:center; padding:6px;">${fmtP(c.parcial3)}</td>`;
    } else {
        thExtra = '<th style="text-align:center; padding:8px 6px;">D1</th><th style="text-align:center; padding:8px 6px;">D2</th><th style="text-align:center; padding:8px 6px;">D3</th>';
        rowsFn  = c => `<td style="text-align:center; padding:6px;">${fmtP(c.parcial1)}</td><td style="text-align:center; padding:6px;">${fmtP(c.parcial2)}</td><td style="text-align:center; padding:6px;">${fmtP(c.parcial3)}</td>`;
    }

    const rows = alumnosCalifMateria.map((a, i) => {
        let cal;
        try { cal = calcularPromedioAlumno(a); } catch (_) { cal = null; }
        const calStr   = (cal == null) ? '-' : cal === 'NP' ? 'NP' : String(cal);
        const calColor = (!isNaN(parseFloat(calStr)) && parseFloat(calStr) < 6) ? '#f44336' : '#388e3c';
        return `<tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'}">
            <td style="text-align:center; padding:6px 8px; color:#888;">${i + 1}</td>
            <td style="text-align:center; padding:6px 8px;">${a.matricula}</td>
            <td style="padding:6px 10px;">${a.nombre}</td>
            ${rowsFn(a.calificaciones)}
            <td style="text-align:center; font-weight:700; color:${calColor}; padding:6px 8px;">${calStr}</td>
        </tr>`;
    }).join('');

    contenedor.innerHTML = `
        <div style="background:#f5f5f5; border-radius:8px; padding:14px 18px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                <div style="font-weight:700; color:#333; font-size:0.97rem;">${asig.materiaNombre}</div>
                <div style="font-size:0.85rem; color:#666; margin-top:3px;">Grupo: ${asig.codigoGrupo} &nbsp;·&nbsp; Prof: ${asig.profesorNombre} &nbsp;·&nbsp; ${alumnosCalifMateria.length} alumno(s)</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button onclick="descargarActaPDF()"
                  style="padding:8px 14px; background:linear-gradient(135deg,#c62828,#8b0000); color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.87rem;">
                  Acta General
                </button>
                <button onclick="descargarActaExtraordinarioPDF()"
                  style="padding:8px 14px; background:linear-gradient(135deg,#6a1b9a,#4a148c); color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.87rem;">
                  Acta Extraordinario
                </button>
                <button onclick="descargarActaEtsPDF()"
                  style="padding:8px 14px; background:linear-gradient(135deg,#1565c0,#0a3880); color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.87rem;">
                  Acta ETS
                </button>
            </div>
        </div>
        <div style="overflow-x:auto; border-radius:8px; border:1px solid #e0e0e0; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="background:#6c1d45; color:white;">
                        <th style="text-align:center; padding:8px 6px; width:40px;">No.</th>
                        <th style="text-align:center; padding:8px 6px; width:130px;">Matrícula</th>
                        <th style="padding:8px 10px; text-align:left;">Nombre</th>
                        ${thExtra}
                        <th style="text-align:center; padding:8px 6px; width:90px;">Calificación</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="padding:8px 0 0; font-size:0.83rem; color:#888;">Total: ${alumnosCalifMateria.length} alumno(s)</div>`;
}

// ── Actas Históricas — buscador por alumno ────────────────────────────────────

async function cargarAlumnosActasHist() {
    const lista     = document.getElementById('actasHistResultados');
    const carreraId = usuarioActual && usuarioActual.carreraId;
    if (!lista || !carreraId) return;

    lista.innerHTML = '<p style="color:#888; padding:10px 15px;">Cargando alumnos...</p>';

    try {
        if (!_actasHistAlumnosCache) {
            const snap = await db.collection('usuarios')
                .where('rol',       '==', 'alumno')
                .where('carreraId', '==', carreraId)
                .get();
            _actasHistAlumnosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        if (!_actasHistCarreraNombre) {
            try {
                const cDoc = await db.collection('carreras').doc(carreraId).get();
                _actasHistCarreraNombre = cDoc.exists ? (cDoc.data().nombre || carreraId) : carreraId;
            } catch (_) { _actasHistCarreraNombre = carreraId; }
        }
        _renderAlumnosActasHist('');
    } catch (e) {
        lista.innerHTML = `<p style="color:red; padding:10px 15px;">Error: ${e.message}</p>`;
    }
}

function buscarAlumnosActasHist() {
    if (!_actasHistAlumnosCache) return;
    const input = document.getElementById('inputActasHistAlumno');
    _renderAlumnosActasHist(input ? input.value.trim().toLowerCase() : '');
}

function _renderAlumnosActasHist(termino) {
    const lista = document.getElementById('actasHistResultados');
    if (!lista || !_actasHistAlumnosCache) return;

    const res = (termino
        ? _actasHistAlumnosCache.filter(a =>
            (a.nombre    || '').toLowerCase().includes(termino) ||
            (a.matricula || '').toLowerCase().includes(termino))
        : _actasHistAlumnosCache
    ).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    if (res.length === 0) {
        lista.innerHTML = '<p style="color:#888; padding:10px 15px;">Sin resultados.</p>';
        return;
    }

    const filas = res.map(a => {
        const nombreEsc = (a.nombre || '-').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const matEsc    = (a.matricula || '').replace(/'/g, "\\'");
        return `<tr onmouseover="this.style.background='#f9f5f7'" onmouseout="this.style.background=''"
                   style="cursor:pointer;" onclick="verActasAlumno('${a.id}','${nombreEsc}','${matEsc}')">
            <td style="padding:10px 12px; font-weight:600; color:#333;">${a.nombre || '-'}</td>
            <td style="padding:10px 12px; color:#555; text-align:center;">${a.matricula || '-'}</td>
            <td style="padding:10px 12px; color:#555;">${_actasHistCarreraNombre || ''}</td>
            <td style="padding:10px 12px; color:#555; text-align:center;">${a.periodo || '-'}</td>
            <td style="padding:10px 12px; text-align:center;">
                <button onclick="event.stopPropagation(); verActasAlumno('${a.id}','${nombreEsc}','${matEsc}')"
                  style="padding:5px 12px; background:linear-gradient(135deg,#6c1d45,#4a1230); color:white; border:none; border-radius:5px; font-size:0.82rem; font-weight:600; cursor:pointer; white-space:nowrap;">
                  Ver Actas
                </button>
            </td>
        </tr>`;
    }).join('');

    lista.innerHTML = `
        <div style="overflow-x:auto; border-radius:8px; border:1px solid #e0e0e0; overflow:hidden; margin-top:4px;">
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="background:#6c1d45; color:white;">
                        <th style="padding:10px 12px; text-align:left;">Nombre</th>
                        <th style="padding:10px 12px; text-align:center; width:120px;">Matrícula</th>
                        <th style="padding:10px 12px; text-align:left;">Carrera</th>
                        <th style="padding:10px 12px; text-align:center; width:100px;">Periodo Actual</th>
                        <th style="padding:10px 12px; text-align:center; width:110px;">Acción</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>` +
        (res.length > 100 ? `<p style="color:#999; padding:8px 4px; font-size:0.82rem;">${res.length} alumnos — escribe para filtrar.</p>` : '');
}

async function verActasAlumno(alumnoId, alumnoNombre, matricula) {
    const busq = document.getElementById('actasHistBusqueda');
    const det  = document.getElementById('actasHistDetalle');
    if (!busq || !det) return;

    busq.style.display = 'none';
    det.style.display  = '';
    det.innerHTML = '<p style="color:#888; padding:20px 0;">Cargando historial...</p>';

    const btnVolver = `<button onclick="volverActasHist()"
        style="padding:7px 14px; background:#f5f5f5; border:1px solid #ddd; border-radius:6px; cursor:pointer; font-size:0.88rem; margin-bottom:14px;">
        ← Volver</button>`;

    try {
        const histDoc = await db.collection('historialAcademico').doc(alumnoId).get();

        if (!histDoc.exists) {
            det.innerHTML = `${btnVolver}<p style="color:#888;">Sin historial académico registrado.</p>`;
            return;
        }

        const materias = (histDoc.data().materias || [])
            .filter(m =>
                m.valida !== false &&
                m.periodoAcademico != null &&
                m.calificacion != null
            )
            .sort((a, b) => (a.periodo || 0) - (b.periodo || 0) || (a.materiaNombre || '').localeCompare(b.materiaNombre || ''));

        if (materias.length === 0) {
            det.innerHTML = `${btnVolver}<p style="color:#888; margin-top:4px;">Sin calificaciones registradas.</p>`;
            return;
        }

        const rows = materias.map((m, i) => {
            const tipo     = m.acr === 'ETS' ? 'ETS' : m.acr === 'EXT' ? 'EXT' : 'GENERAL';
            const btnLabel = tipo === 'ETS'  ? 'Acta ETS'
                           : tipo === 'EXT'  ? 'Acta Extraordinario'
                           :                   'Acta General';
            const btnGrad  = tipo === 'ETS'  ? 'linear-gradient(135deg,#1565c0,#0a3880)'
                           : tipo === 'EXT'  ? 'linear-gradient(135deg,#6a1b9a,#4a148c)'
                           :                   'linear-gradient(135deg,#c62828,#8b0000)';
            const calStr   = m.calificacion == null ? '-' : m.calificacion === 'NP' ? 'NP' : String(m.calificacion);
            const calColor = (!isNaN(parseFloat(calStr)) && parseFloat(calStr) < 6) ? '#f44336' : '#333';

            return `<tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'}">
                <td style="padding:8px 10px;">${m.materiaNombre || '-'}</td>
                <td style="text-align:center; padding:8px 6px; color:#666;">${m.periodo || '-'}</td>
                <td style="text-align:center; font-weight:700; color:${calColor}; padding:8px 6px;">${calStr}</td>
                <td style="text-align:center; padding:8px 6px; color:#666; font-size:0.82rem;">${m.acr || '-'}</td>
                <td style="text-align:center; padding:8px 6px; color:#666; font-size:0.82rem;">${m.periodoAcademico || '-'}</td>
                <td style="padding:8px 6px; text-align:center;">
                    <button onclick="descargarActaHistoricaAlumno('${alumnoId}','${m.materiaId}','${tipo}','${m.periodoAcademico || ''}',this)"
                      style="padding:5px 10px; background:${btnGrad}; color:white; border:none; border-radius:5px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap;">
                      ${btnLabel}
                    </button>
                </td>
            </tr>`;
        }).join('');

        det.innerHTML = `
            ${btnVolver}
            <div style="margin-bottom:14px;">
                <div style="font-weight:700; color:#333; font-size:1rem;">${alumnoNombre}</div>
                <div style="font-size:0.83rem; color:#888;">Matrícula: ${matricula || '-'}</div>
            </div>
            <div style="overflow-x:auto; border-radius:8px; border:1px solid #e0e0e0; overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                    <thead>
                        <tr style="background:#6c1d45; color:white;">
                            <th style="padding:10px; text-align:left;">Materia</th>
                            <th style="text-align:center; padding:10px; width:55px;">Sem.</th>
                            <th style="text-align:center; padding:10px; width:70px;">Cal.</th>
                            <th style="text-align:center; padding:10px; width:55px;">Acr.</th>
                            <th style="text-align:center; padding:10px; width:85px;">Ciclo</th>
                            <th style="text-align:center; padding:10px; width:160px;">Acta</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div style="padding:8px 0 0; font-size:0.83rem; color:#888;">${materias.length} materia(s) acreditada(s)</div>`;

    } catch (e) {
        det.innerHTML = `${btnVolver}<p style="color:red; margin-top:4px;">Error: ${e.message}</p>`;
    }
}

function volverActasHist() {
    const busq = document.getElementById('actasHistBusqueda');
    const det  = document.getElementById('actasHistDetalle');
    if (busq) busq.style.display = '';
    if (det)  det.style.display  = 'none';
}

async function descargarActaHistoricaAlumno(alumnoId, materiaId, tipo, periodoAcad, btn) {
    const txtOrig = btn.textContent;
    btn.textContent = 'Generando...'; btn.disabled = true;

    try {
        // Leer el doc del alumno para obtener codigoGrupo (ID: alumnoId_materiaId)
        const calRef = db.collection('calificaciones').doc(`${alumnoId}_${materiaId}`);
        const calDoc = await calRef.get();
        if (!calDoc.exists) { alert('No se encontró el registro de calificaciones.'); return; }

        const refData        = calDoc.data();
        const codigoGrupo    = refData.codigoGrupo    || '-';
        const materiaNombre  = refData.materiaNombre  || 'Materia';
        const profesorNombre = refData.profesorNombre || '-';
        const periodoLabel   = refData.periodoAcademico || refData.periodo || '';
        const carreraId      = refData.carreraId;

        // Cargar todos los registros de esa materia, filtrar por grupo en memoria
        const snap  = await db.collection('calificaciones').where('materiaId', '==', materiaId).get();
        let calDocs = snap.docs.map(d => d.data()).filter(d => d.codigoGrupo === codigoGrupo);

        // Acotar al periodo histórico: usa periodoAcad (de historialAcademico) para scopear
        // en registros viejos c.ets/c.extraordinario pueden ser null aunque el grado esté en c.promedio
        if (periodoAcad) {
            const docsDelPeriodo = calDocs.filter(d => d.periodo === periodoAcad);
            if (docsDelPeriodo.length > 0) calDocs = docsDelPeriodo;
        }

        if (calDocs.length === 0) {
            alert('No se encontraron registros de calificaciones para esta materia y grupo.');
            return;
        }

        // Flags de carrera (necesarios para columnas de GENERAL)
        let tieneExFinal = false, esUnParcial = false;
        if (carreraId) {
            [tieneExFinal, esUnParcial] = await Promise.all([
                obtenerTieneExamenFinal(carreraId),
                obtenerEsUnParcial(carreraId)
            ]);
        }

        // Matrículas en batch
        const alumnoIds = [...new Set(calDocs.map(c => c.alumnoId))];
        const chunks    = [];
        for (let i = 0; i < alumnoIds.length; i += 30) chunks.push(alumnoIds.slice(i, i + 30));
        const userSnaps = await Promise.all(
            chunks.map(ch => db.collection('usuarios').where(firebase.firestore.FieldPath.documentId(), 'in', ch).get())
        );
        const matMap = {};
        userSnaps.forEach(s => s.docs.forEach(d => { matMap[d.id] = d.data().matricula || '-'; }));

        calDocs.sort((a, b) => (a.alumnoNombre || '').localeCompare(b.alumnoNombre || ''));

        // Generar PDF (mismo formato que las actas del periodo actual)
        const doc = _acta_jsPDF(); if (!doc) return;
        const pageWidth = doc.internal.pageSize.getWidth();
        const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        const titulo = tipo === 'ETS'  ? 'ACTA DE ETS'
                     : tipo === 'EXT'  ? 'ACTA DE EXTRAORDINARIO'
                     :                   'ACTA DE CALIFICACIONES';

        if (typeof agregarLogosAlPDF === 'function') agregarLogosAlPDF(doc, tieneExFinal);

        doc.setFontSize(18); doc.setFont(undefined, 'bold');
        doc.text(titulo, 105, 25, { align: 'center' });
        doc.setLineWidth(0.5); doc.line(30, 38, 180, 38);

        doc.setFontSize(11); doc.setFont(undefined, 'normal');
        let y = 45;
        doc.text(`Fecha: ${fecha}`,            pageWidth - 20, y, { align: 'right' });
        doc.text(`Materia: ${materiaNombre}`,   20, y); y += 5;
        doc.text(`Grupo: ${codigoGrupo}`,       20, y);
        if (periodoLabel) doc.text(`Ciclo: ${periodoLabel}`, pageWidth - 20, y, { align: 'right' });
        y += 5;
        doc.text(`Profesor: ${profesorNombre}`, 20, y);
        y += 10;

        const fmtP = v => (v == null) ? '-' : v === 'NP' ? 'NP' : String(v);
        let head, columnStyles, calColIndex, tableData;

        if (tipo === 'ETS') {
            head         = [['No.', 'Matrícula', 'Nombre del Alumno', 'ETS']];
            columnStyles = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:108}, 3:{halign:'center',cellWidth:29,fontStyle:'bold'} };
            calColIndex  = 3;
            // c.ets si está capturado; si no, c.promedio (cuando Boleta Global guardó el grado en promedio con acreditacion=ETS)
            tableData    = calDocs.map((c, i) => [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(c.ets ?? c.promedio)]);

        } else if (tipo === 'EXT') {
            head         = [['No.', 'Matrícula', 'Nombre del Alumno', 'Extraordinario']];
            columnStyles = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:108}, 3:{halign:'center',cellWidth:29,fontStyle:'bold'} };
            calColIndex  = 3;
            tableData    = calDocs.map((c, i) => [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(c.extraordinario ?? c.promedio)]);

        } else if (esUnParcial) {
            head         = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'Calificación']];
            columnStyles = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:97}, 3:{halign:'center',cellWidth:15}, 4:{halign:'center',cellWidth:25,fontStyle:'bold'} };
            calColIndex  = 4;
            tableData    = calDocs.map((c, i) => {
                const p1  = c.parciales?.parcial1 ?? null;
                const cal = calcularCalificacion(p1, null, null, false);
                return [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(p1), fmtP(cal)];
            });

        } else if (tieneExFinal) {
            head         = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'E.F', 'Calificación', 'Extraordinario']];
            columnStyles = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:52}, 3:{halign:'center',cellWidth:13}, 4:{halign:'center',cellWidth:13}, 5:{halign:'center',cellWidth:13}, 6:{halign:'center',cellWidth:20,fontStyle:'bold'}, 7:{halign:'center',cellWidth:26} };
            calColIndex  = 6;
            tableData    = calDocs.map((c, i) => {
                const p1 = c.parciales?.parcial1 ?? null, p2 = c.parciales?.parcial2 ?? null, p3 = c.parciales?.parcial3 ?? null;
                const cal = calcularCalificacion(p1, p2, p3, true);
                const p3n = (p3 != null && p3 !== 'NP') ? parseFloat(p3) : null;
                const extraVal = c.extraordinario != null ? String(c.extraordinario) : (cal === 'NP' || (p3n !== null && p3n < 6) ? '' : '-');
                return [(i+1).toString(), matMap[c.alumnoId]||'-', c.alumnoNombre||'-', fmtP(p1), fmtP(p2), fmtP(p3), fmtP(cal), extraVal];
            });

        } else {
            head         = [['No.', 'Matrícula', 'Nombre del Alumno', 'D1', 'D2', 'D3', 'Calificación']];
            columnStyles = { 0:{halign:'center',cellWidth:10}, 1:{halign:'center',cellWidth:33}, 2:{halign:'left',cellWidth:70}, 3:{halign:'center',cellWidth:14}, 4:{halign:'center',cellWidth:14}, 5:{halign:'center',cellWidth:14}, 6:{halign:'center',cellWidth:25,fontStyle:'bold'} };
            calColIndex  = 6;
            tableData    = calDocs.map((c, i) => {
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

        _acta_pie(doc, calDocs.length, doc.lastAutoTable.finalY);

        const sufijo = periodoLabel ? `_${periodoLabel}` : '';
        doc.save(`Acta_${tipo}${sufijo}_${materiaNombre.replace(/\s+/g, '_')}.pdf`);

    } catch (e) {
        console.error('[ActasHistAlumno] Error:', e);
        alert('Error al generar acta: ' + e.message);
    } finally {
        btn.textContent = txtOrig; btn.disabled = false;
    }
}
