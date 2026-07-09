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
