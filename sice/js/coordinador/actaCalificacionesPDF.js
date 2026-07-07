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
