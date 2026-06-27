// PeriodoPDF.js — PDF de calificaciones de UN solo periodo académico
// Usado desde historialAlumno.html (botones Historial Anterior e Informe de Calificaciones)

const _TURNOS_PPDF    = { 1: 'MATUTINO', 2: 'VESPERTINO', 3: 'NOCTURNO', 4: 'SABATINO' };
const _SEMESTRES_PPDF = {
  1: 'PRIMERO', 2: 'SEGUNDO',  3: 'TERCERO', 4: 'CUARTO', 5: 'QUINTO',
  6: 'SEXTO',   7: 'SÉPTIMO', 8: 'OCTAVO',   9: 'NOVENO'
};

async function descargarPeriodoPDF(alumnoId, nombreAlumno, periodoKey, esOficial = false, esInforme = false) {
  try {
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no está cargado. Recarga la página.');
      return;
    }

    const { jsPDF } = window.jspdf;

    // ── Cargar calificaciones ─────────────────────────────────────
    const calSnap = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .get();

    if (calSnap.empty) {
      alert('Este alumno no tiene calificaciones registradas.');
      return;
    }

    // ── Datos del alumno y carrera ────────────────────────────────
    let especialidad = '', grupo = '', turnoStr = '', semestreStr = '', noControl = '';
    let tieneEF = false, esMaestria = false;

    const alumnoDoc = await db.collection('usuarios').doc(alumnoId).get();
    if (alumnoDoc.exists) {
      const a = alumnoDoc.data();
      noControl   = a.matricula    || '';
      grupo       = a.codigoGrupo  || '';
      turnoStr    = _TURNOS_PPDF[a.turno]       || String(a.turno    || '');
      semestreStr = _SEMESTRES_PPDF[a.periodo]  || String(a.periodo  || '');

      if (a.carreraId) {
        try {
          const cDoc = await db.collection('carreras').doc(a.carreraId).get();
          if (cDoc.exists) {
            const c = cDoc.data();
            especialidad = (c.nombre || '').toUpperCase();
            tieneEF      = c.tieneExamenFinal === true;
            esMaestria   = (c.codigo || '').startsWith('M') ||
                           (c.nombre  || '').toLowerCase().startsWith('maestr');
          }
        } catch (_) {}
      }
    }

    // ── Filtrar al periodo solicitado ─────────────────────────────
    const normP = v => (v === null || v === undefined || v === '') ? 'N/A' : String(v);
    const registros = [];
    calSnap.forEach(calDoc => {
      const cal = calDoc.data();
      if (periodoKey !== null && normP(cal.periodo) !== periodoKey) return;

      const p1Raw = cal.parciales?.parcial1 ?? null;
      const p2Raw = cal.parciales?.parcial2 ?? null;
      const p3Raw = cal.parciales?.parcial3 ?? null;

      const toN = v => (v !== null && v !== 'NP') ? Number(v) : v;
      const calNum = esMaestria
        ? toN(p1Raw)
        : calcularCalificacion(toN(p1Raw), toN(p2Raw), toN(p3Raw), tieneEF);

      let final = calNum === null ? '-' : (calNum === 'NP' ? 'NP' : String(redondearCalificacion(calNum)));
      if (cal.ets          != null) final = String(redondearCalificacion(cal.ets));
      else if (cal.extraordinario != null) final = String(redondearCalificacion(cal.extraordinario));

      const str = v => (v !== null && v !== undefined) ? String(v) : '-';

      registros.push({
        materiaNombre: cal.materiaNombre || 'Sin nombre',
        p1: str(p1Raw), f1: str(cal.faltas?.falta1 ?? null),
        p2: str(p2Raw), f2: str(cal.faltas?.falta2 ?? null),
        p3: str(p3Raw), f3: (tieneEF || esMaestria) ? '-' : str(cal.faltas?.falta3 ?? null),
        final,
        extra: cal.extraordinario != null ? String(redondearCalificacion(cal.extraordinario)) : '',
        ets:   cal.ets            != null ? String(redondearCalificacion(cal.ets))            : ''
      });
    });

    if (registros.length === 0) {
      alert(`No hay calificaciones registradas para el periodo ${periodoKey ?? 'actual'}.`);
      return;
    }

    // ── Promedio del periodo ──────────────────────────────────────
    const finales = registros.map(r => parseFloat(r.final)).filter(v => !isNaN(v));
    const promedioGeneral = finales.length > 0
      ? (finales.reduce((a, b) => a + b, 0) / finales.length).toFixed(1)
      : '-';

    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).toUpperCase();

    // ── Generar PDF ───────────────────────────────────────────────
    const doc       = new jsPDF({ format: 'letter' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const HEAD_COLOR = [108, 29, 69];

    // Logos
    if (typeof agregarLogosAlPDF === 'function') agregarLogosAlPDF(doc, tieneEF);

    // Encabezado institucional
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('INSTITUTO LEONARDO BRAVO PLANTEL CENTRO', pageWidth / 2, 27, { align: 'center' });
    const tituloDoc    = esInforme ? 'INFORME DE CALIFICACIONES' : 'CALIFICACIONES DEL PERIODO';
    const labelPeriodo = esInforme ? 'ACTUAL' : (periodoKey ?? '');
    doc.setFontSize(11);
    doc.text(tituloDoc, pageWidth / 2, 34, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.setDrawColor(...HEAD_COLOR);
    doc.line(10, 38, pageWidth - 10, 38);
    doc.setDrawColor(0, 0, 0);

    // Datos del alumno
    const C = HEAD_COLOR;
    doc.setFontSize(9);
    const izq = 12, der = pageWidth - 12;
    let y = 44;

    const campo = (label, valor, xLabel, xValor) => {
      doc.setFont(undefined, 'bold');   doc.setTextColor(...C); doc.text(label, xLabel, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0,0,0); doc.text(valor, xValor, y);
    };

    campo('FECHA:',    fecha,         izq,      izq + 16);
    campo('PERIODO:',  labelPeriodo,  der - 60, der - 40);
    y += 6;
    campo('ESPECIALIDAD:', especialidad, izq,      izq + 32);
    campo('NO. CONTROL:',  noControl,    der - 60, der - 35);
    y += 6;
    campo('NOMBRE:',   nombreAlumno.toUpperCase(), izq,    izq + 18);
    campo('SEMESTRE:', semestreStr,                der - 60, der - 38);
    y += 6;
    campo('PROMEDIO GENERAL:', promedioGeneral,  izq,             izq + 36);
    campo('GRUPO:',            grupo,             pageWidth/2-20, pageWidth/2-5);
    campo('TURNO:',            turnoStr,          der - 55,       der - 40);
    doc.setTextColor(0, 0, 0);

    y += 8;

    // ── Tabla ─────────────────────────────────────────────────────
    const HEAD_STYLES = { fillColor: HEAD_COLOR, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 };

    if (esMaestria) {
      // Tabla simplificada: NO | MATERIA | CALIFICACIÓN
      const tableData = registros.map((r, i) => [String(i+1), r.materiaNombre.toUpperCase(), r.final]);

      doc.autoTable({
        startY: y,
        margin: { left: 10, right: 10 },
        head: [['NO.', 'UNIDAD DE APRENDIZAJE', 'CALIFICACIÓN']],
        body: tableData,
        theme: 'grid',
        headStyles: HEAD_STYLES,
        styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 }, valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left',   cellWidth: 140 },
          2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }
        }
      });
    } else {
      const subHeader = tieneEF
        ? ['P1', 'FALTAS', 'P2', 'FALTAS', 'EXAMEN FINAL', '-', 'CALIFICACIÓN', 'EXTRA', 'ETS']
        : ['PERIODO 1', 'FALTAS', 'PERIODO 2', 'FALTAS', 'PERIODO 3', 'FALTAS', 'CALIFICACIÓN', 'EXTRA', 'ETS'];

      const tableData = registros.map((r, i) => [
        String(i + 1),
        r.materiaNombre.toUpperCase(),
        r.p1, r.f1,
        r.p2, r.f2,
        r.p3, r.f3,
        r.final, r.extra, r.ets
      ]);

      doc.autoTable({
        startY: y,
        margin: { left: 10, right: 10 },
        head: [
          [
            { content: 'NO.',                   rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'UNIDAD DE APRENDIZAJE', rowSpan: 2, styles: { valign: 'middle', halign: 'left'   } },
            { content: 'CALIFICACIÓN/FALTAS',   colSpan: 9, styles: { halign: 'center' } }
          ],
          subHeader
        ],
        body: tableData,
        theme: 'grid',
        headStyles: { ...HEAD_STYLES, fontSize: 6 },
        styles: { fontSize: 7, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, valign: 'middle' },
        columnStyles: {
          0:  { halign: 'center', cellWidth: 8   },
          1:  { halign: 'left',   cellWidth: 56  },
          2:  { halign: 'center', cellWidth: 13  },
          3:  { halign: 'center', cellWidth: 12  },
          4:  { halign: 'center', cellWidth: 13  },
          5:  { halign: 'center', cellWidth: 12  },
          6:  { halign: 'center', cellWidth: 13  },
          7:  { halign: 'center', cellWidth: 12  },
          8:  { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
          9:  { halign: 'center', cellWidth: 10  },
          10: { halign: 'center', cellWidth: 10  }
        }
      });
    }

    // Firmas — solo versión oficial
    if (esOficial) {
      const lastPage = doc.internal.getNumberOfPages();
      doc.setPage(lastPage);
      const firmasY = doc.lastAutoTable.finalY + 25;
      if (firmasY < pageHeight - 20) {
        doc.setTextColor(0);
        doc.setLineWidth(0.3);
        doc.line(25,  firmasY, 95,  firmasY);
        doc.line(115, firmasY, 185, firmasY);
      }
    }

    // Pie de página
    const numPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= numPages; i++) {
      doc.setPage(i);
      if (!esOficial) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(200, 0, 0);
        doc.text('ESTE DOCUMENTO NO TIENE VALIDEZ OFICIAL', pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(128);
      doc.text(`Página ${i} de ${numPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    const nombre   = nombreAlumno.replace(/\s+/g, '_');
    const sufijoPer = esInforme ? 'Actual' : (periodoKey ?? '');
    doc.save(`Calificaciones_${sufijoPer}_${nombre}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF de periodo:', error);
    alert('Error al generar el PDF: ' + error.message);
  }
}
