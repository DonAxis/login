// InformeCalificacionesPDF.js - Informe de Calificaciones por alumno

const TURNOS_INFORME = { 1: 'MATUTINO', 2: 'VESPERTINO', 3: 'NOCTURNO', 4: 'SABATINO' };
const SEMESTRES_INFORME = {
  1: 'PRIMERO', 2: 'SEGUNDO', 3: 'TERCERO', 4: 'CUARTO', 5: 'QUINTO',
  6: 'SEXTO', 7: 'SÉPTIMO', 8: 'OCTAVO', 9: 'NOVENO'
};

async function descargarInformeCalificacionesPDF(alumnoId, nombreAlumno) {
  try {
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no está cargado. Recarga la página.');
      return;
    }

    const { jsPDF } = window.jspdf;

    // ── Fetch calificaciones ──────────────────────────────────────────
    const calSnap = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .get();

    if (calSnap.empty) {
      alert('Este alumno no tiene calificaciones registradas.');
      return;
    }

    // ── Fetch datos del alumno primero (necesario para tieneExamenFinalInforme) ──
    let especialidad = '';
    let grupo = '';
    let turnoStr = '';
    let semestreStr = '';
    let noControl = '';
    let tieneExamenFinalInforme = false;

    try {
      const aDoc = await db.collection('usuarios').doc(alumnoId).get();
      if (aDoc.exists) {
        const a = aDoc.data();
        noControl  = a.matricula   || '';
        grupo      = a.codigoGrupo || '';
        turnoStr   = TURNOS_INFORME[a.turno]    || String(a.turno || '');
        semestreStr = SEMESTRES_INFORME[a.periodo] || String(a.periodo || '');

        if (a.carreraId) {
          try {
            const cDoc = await db.collection('carreras').doc(a.carreraId).get();
            if (cDoc.exists) {
              especialidad = (cDoc.data().nombre || '').toUpperCase();
              tieneExamenFinalInforme = cDoc.data().tieneExamenFinal === true;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Cache de materias
    const materiasCache = {};
    const registros = [];

    for (const calDoc of calSnap.docs) {
      const cal = calDoc.data();

      let materiaNombre = cal.materiaNombre || '';
      if (!materiaNombre && cal.materiaId) {
        if (!materiasCache[cal.materiaId]) {
          try {
            const mDoc = await db.collection('materias').doc(cal.materiaId).get();
            if (mDoc.exists) materiasCache[cal.materiaId] = mDoc.data();
          } catch (_) {}
        }
        materiaNombre = (materiasCache[cal.materiaId] || {}).nombre || 'Sin nombre';
      }

      const p1Raw = cal.parciales?.parcial1 ?? null;
      const p2Raw = cal.parciales?.parcial2 ?? null;
      const p3Raw = cal.parciales?.parcial3 ?? null;

      const p1 = p1Raw ?? '-';
      const p2 = p2Raw ?? '-';
      const p3 = p3Raw ?? '-';

      // Calcular calificación usando la función centralizada
      const p1Num = (p1Raw !== null && p1Raw !== 'NP') ? Number(p1Raw) : p1Raw;
      const p2Num = (p2Raw !== null && p2Raw !== 'NP') ? Number(p2Raw) : p2Raw;
      const p3Num = (p3Raw !== null && p3Raw !== 'NP') ? Number(p3Raw) : p3Raw;
      const calNum = calcularCalificacion(p1Num, p2Num, p3Num, tieneExamenFinalInforme);
      const final = calNum === null ? '-' : (calNum === 'NP' ? 'NP' : calNum.toFixed(1));

      const f1 = cal.faltas?.falta1 ?? '-';
      const f2 = cal.faltas?.falta2 ?? '-';
      // No hay faltas para el examen final en carreras con tieneExamenFinal
      const f3 = tieneExamenFinalInforme ? '-' : (cal.faltas?.falta3 ?? '-');

      registros.push({
        periodo: cal.periodo || 'N/A',
        materiaNombre,
        p1: String(p1), f1: String(f1),
        p2: String(p2), f2: String(f2),
        p3: String(p3), f3: String(f3),
        final: String(final),
        extra: (p1Raw === 'NP' || p2Raw === 'NP') ? 'NP' : (cal.extraordinario != null ? String(cal.extraordinario) : ''),
        ets: cal.ets != null ? String(cal.ets) : ''
      });
    }

    // ── Agrupar por periodo académico ─────────────────────────────────
    const porPeriodo = {};
    registros.forEach(r => {
      if (!porPeriodo[r.periodo]) porPeriodo[r.periodo] = [];
      porPeriodo[r.periodo].push(r);
    });
    const periodosOrdenados = Object.keys(porPeriodo).sort().reverse();

    // Promedio general (sobre finales numéricas)
    const finalesNumericas = registros
      .map(r => parseFloat(r.final))
      .filter(v => !isNaN(v));
    const promedioGeneral = finalesNumericas.length > 0
      ? (finalesNumericas.reduce((a, b) => a + b, 0) / finalesNumericas.length).toFixed(1)
      : '-';

    // Fecha
    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).toUpperCase();

    // ── Generar PDF ───────────────────────────────────────────────────
    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();   // 210
    const pageHeight = doc.internal.pageSize.getHeight();  // 297

    function dibujarEncabezado(doc) {
      // Logos
      if (typeof agregarLogosAlPDF === 'function') {
        agregarLogosAlPDF(doc);
      }

      // Nombre institución
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('INSTITUTO LEONARDO BRAVO PLANTEL CENTRO', pageWidth / 2, 18, { align: 'center' });

      // Subtítulo
      doc.setFontSize(11);
      doc.text('INFORME DE CALIFICACIONES', pageWidth / 2, 26, { align: 'center' });

      // Línea separadora
      doc.setLineWidth(0.5);
      doc.setDrawColor(108, 29, 69);
      doc.line(10, 30, pageWidth - 10, 30);
      doc.setDrawColor(0, 0, 0);
    }

    function dibujarInfoAlumno(doc, periodoAcademico) {
      const COLOR = [108, 29, 69];
      doc.setFontSize(9);

      const izq = 12;
      const der = pageWidth - 12;
      let y = 37;

      // Fila 1
      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('FECHA:', izq, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(fecha, izq + 16, y);

      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('PERIODO:', der - 60, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(periodoAcademico, der - 40, y);

      y += 6;
      // Fila 2
      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('ESPECIALIDAD:', izq, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(especialidad, izq + 32, y);

      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('NO. CONTROL:', der - 60, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(noControl, der - 35, y);

      y += 6;
      // Fila 3
      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('NOMBRE:', izq, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(nombreAlumno.toUpperCase(), izq + 18, y);

      // Centro: PROMEDIO GENERAL
      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('PROMEDIO GENERAL:', pageWidth / 2 - 20, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(promedioGeneral, pageWidth / 2 + 22, y);

      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('SEMESTRE:', der - 60, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(semestreStr, der - 38, y);

      y += 6;
      // Fila 4
      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('GRUPO:', izq, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(grupo, izq + 15, y);

      // Centro: TURNO
      doc.setFont(undefined, 'bold'); doc.setTextColor(...COLOR);
      doc.text('TURNO:', pageWidth / 2 - 20, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(turnoStr, pageWidth / 2 - 4, y);

      doc.setTextColor(0, 0, 0);
      return y + 6;
    }

    const HEAD_COLOR = [108, 29, 69];
    const HEAD_STYLES = { fillColor: HEAD_COLOR, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 };

    let primeraTabla = true;

    for (const periodo of periodosOrdenados) {
      const materias = porPeriodo[periodo];

      if (!primeraTabla) {
        doc.addPage();
      }
      primeraTabla = false;

      dibujarEncabezado(doc);
      const startY = dibujarInfoAlumno(doc, periodo);

      const tableData = materias.map((m, i) => [
        String(i + 1),
        m.materiaNombre.toUpperCase(),
        m.p1, m.f1,
        m.p2, m.f2,
        m.p3, m.f3,
        m.final, m.extra, m.ets
      ]);

      const subHeaderCols = tieneExamenFinalInforme
        ? ['P1', 'FALTAS', 'P2', 'FALTAS', 'EXAMEN FINAL', '-', 'CALIFICACIÓN', 'EXTRA', 'ETS']
        : ['PERIODO 1', 'FALTAS', 'PERIODO 2', 'FALTAS', 'PERIODO 3', 'FALTAS', 'CALIFICACIÓN', 'EXTRA', 'ETS'];

      doc.autoTable({
        startY,
        margin: { left: 10, right: 10 },
        head: [
          [
            { content: 'NO.',                   rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'UNIDAD DE APRENDIZAJE', rowSpan: 2, styles: { valign: 'middle', halign: 'left'   } },
            { content: 'CALIFICACIÓN/FALTAS',   colSpan: 9, styles: { halign: 'center' } }
          ],
          subHeaderCols
        ],
        body: tableData,
        theme: 'grid',
        headStyles: { ...HEAD_STYLES, fontSize: 6 },
        styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
        columnStyles: {
          0:  { halign: 'center', cellWidth: 8   },
          1:  { halign: 'left',   cellWidth: 62  },
          2:  { halign: 'center', cellWidth: 15  },
          3:  { halign: 'center', cellWidth: 10  },
          4:  { halign: 'center', cellWidth: 15  },
          5:  { halign: 'center', cellWidth: 10  },
          6:  { halign: 'center', cellWidth: 15  },
          7:  { halign: 'center', cellWidth: 10  },
          8:  { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
          9:  { halign: 'center', cellWidth: 10  },
          10: { halign: 'center', cellWidth: 10  }
        }
      });
    }

    // Pie de página en todas las páginas
    const numPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= numPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(200, 0, 0);
      doc.text('ESTE DOCUMENTO NO TIENE VALIDEZ OFICIAL', pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(128);
      doc.text(`Página ${i} de ${numPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    const nombre = nombreAlumno.replace(/\s+/g, '_');
    doc.save(`Calificaciones_${nombre}.pdf`);

  } catch (error) {
    console.error('Error al generar Informe de Calificaciones:', error);
    alert('Error al generar el informe: ' + error.message);
  }
}

console.log('Función descargarInformeCalificacionesPDF cargada');
