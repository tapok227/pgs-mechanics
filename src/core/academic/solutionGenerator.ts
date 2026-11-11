import {
  BeamProblemInput,
  BeamSolverOutput,
  BeamSegmentAnalysis,
  SteppedRodProblemInput,
  TorsionShaftProblemInput,
} from '../../types/mechanics';
import {
  SteppedRodSolverOutput,
  TorsionSolverOutput,
} from '../solver/rodAndShaftSolver';

// ============================================================================
// СТРУКТУРА АКАДЕМИЧЕСКОГО ДОКУМЕНТА (РАСЧЕТНО-ПОЯСНИТЕЛЬНОЙ ЗАПИСКИ)
// ============================================================================

export interface AcademicFormulaStep {
  label?: string;       // Пояснение перед формулой
  katex: string;        // Строка LaTeX/KaTeX (display mode)
  note?: string;        // Вывод после формулы (например, о растянутых волокнах)
}

export interface AcademicSegmentBlock {
  segmentIndex: number;
  intervalTitle: string;
  boundsKatex: string;
  segmentData: BeamSegmentAnalysis;
  steps: AcademicFormulaStep[];
}

export interface AcademicSolutionDocument {
  title: string;
  subtitle: string;
  fbdSection: {
    description: string;
    steps: AcademicFormulaStep[];
  };
  staticsSection: {
    steps: AcademicFormulaStep[];
    verificationStep: AcademicFormulaStep;
    isVerified: boolean;
  };
  sectionsMethod: {
    introText: string;
    segmentBlocks: AcademicSegmentBlock[];
  };
  strengthSection: {
    steps: AcademicFormulaStep[];
    conclusionText: string;
  };
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФОРМАТТЕРЫ ДЛЯ АКАДЕМИЧЕСКОЙ ЗАПИСИ В KATEX
// ============================================================================

function fmtNum(n: number, decimals = 2): string {
  const clean = Math.abs(n) < 1e-7 ? 0 : Number(n.toFixed(decimals));
  return clean.toString();
}

/**
 * Форматирует слагаемое со знаком для цепочки подстановки: "+ 15 \cdot 4" или "- 10 \cdot 2"
 */
function fmtSignedTerm(coeff: number, expr: string, isFirst: boolean): string {
  if (Math.abs(coeff) < 1e-6) return '';
  const sign = coeff >= 0 ? (isFirst ? '' : ' + ') : isFirst ? '-' : ' - ';
  return `${sign}${expr}`;
}

function fiberDescriptionRu(M: number): string {
  if (Math.abs(M) < 1e-4) return 'изгибающий момент равен нулю';
  return M > 0
    ? 'растянуты нижние волокна (ордината эпюры M откладывается вниз)'
    : 'растянуты верхние волокна (ордината эпюры M откладывается вверх)';
}

// ============================================================================
// 1. ГЕНЕРАТОР АКАДЕМИЧЕСКОГО РЕШЕНИЯ ДЛЯ БАЛКИ (ИЗГИБ И МЕТОД СЕЧЕНИЙ)
// ============================================================================

export function generateBeamAcademicSolution(
  input: BeamProblemInput,
  output: BeamSolverOutput
): AcademicSolutionDocument {
  const fbdSteps: AcademicFormulaStep[] = [];

  // 1. Разложение наклонных сосредоточенных сил и замена распределенных нагрузок
  for (const load of input.loads) {
    if (load.kind === 'point_force') {
      const rad = (load.angleDeg * Math.PI) / 180;
      const Fx = load.magnitude * Math.cos(rad);
      const Fy = load.magnitude * Math.sin(rad);
      const absAngle = Math.abs(load.angleDeg);

      if (Math.abs(absAngle - 90) > 1e-3 && Math.abs(absAngle) > 1e-3) {
        fbdSteps.push({
          label: `Раскладываем сосредоточенную силу ${load.label} = ${load.magnitude} кН (при x = ${load.x} м, угол α = ${load.angleDeg}°) на координатные оси Ox и Oy:`,
          katex: `\\begin{aligned}
            ${load.label}_x &= ${load.label} \\cdot \\cos(${load.angleDeg}^\\circ) = ${load.magnitude} \\cdot ${fmtNum(Math.cos(rad), 4)} = ${fmtNum(Fx)}\\text{ кН}; \\\\
            ${load.label}_y &= ${load.label} \\cdot \\sin(${load.angleDeg}^\\circ) = ${load.magnitude} \\cdot ${fmtNum(Math.sin(rad), 4)} = ${fmtNum(Fy)}\\text{ кН}.
          \\end{aligned}`,
        });
      } else {
        fbdSteps.push({
          label: `Сосредоточенная сила ${load.label} в сечении x = ${load.x} м:`,
          katex: `${load.label}_x = ${fmtNum(Fx)}\\text{ кН}, \\quad ${load.label}_y = ${fmtNum(Fy)}\\text{ кН}.`,
        });
      }
    } else if (load.kind === 'distributed') {
      const L_q = Number((load.xEnd - load.xStart).toFixed(4));
      if (Math.abs(load.qStart - load.qEnd) < 1e-5) {
        // Равномерно распределенная нагрузка
        const Q_val = load.qStart * L_q;
        const x_c = load.xStart + L_q / 2;
        fbdSteps.push({
          label: `Заменяем равномерно распределенную нагрузку ${load.label} = ${load.qStart} кН/м на участке [${load.xStart}; ${load.xEnd}] м (длиной l = ${L_q} м) сосредоточенной равнодействующей силой Q_${load.label}, приложенной в середине участка:`,
          katex: `Q_{${load.label}} = q \\cdot l = ${load.qStart} \\cdot ${L_q} = ${fmtNum(Q_val)}\\text{ кН}, \\quad x_C = ${load.xStart} + \\frac{${L_q}}{2} = ${fmtNum(x_c)}\\text{ м}.`,
        });
      } else if (Math.abs(load.qStart) < 1e-5 || Math.abs(load.qEnd) < 1e-5) {
        // Треугольная нагрузка
        const q_max = Math.max(Math.abs(load.qStart), Math.abs(load.qEnd));
        const Q_val = 0.5 * q_max * L_q;
        const isIncreasing = Math.abs(load.qEnd) > Math.abs(load.qStart);
        const x_c = isIncreasing
          ? load.xStart + (2 / 3) * L_q
          : load.xStart + (1 / 3) * L_q;
        fbdSteps.push({
          label: `Заменяем линейно распределенную (треугольную) нагрузку ${load.label} на участке [${load.xStart}; ${load.xEnd}] м равнодействующей силой Q_${load.label} на расстоянии 1/3 длины участка от максимальной ординаты q_max:`,
          katex: `Q_{${load.label}} = \\frac{1}{2} q_{\\max} \\cdot l = \\frac{1}{2} \\cdot ${q_max} \\cdot ${L_q} = ${fmtNum(Q_val)}\\text{ кН}, \\quad x_C = ${fmtNum(x_c)}\\text{ м}.`,
        });
      } else {
        // Трапециевидная нагрузка
        const Q_val = 0.5 * (load.qStart + load.qEnd) * L_q;
        const x_c =
          load.xStart +
          (L_q * (load.qStart + 2 * load.qEnd)) / (3 * (load.qStart + load.qEnd));
        fbdSteps.push({
          label: `Заменяем трапециевидную нагрузку ${load.label} на участке [${load.xStart}; ${load.xEnd}] м равнодействующей Q_${load.label}:`,
          katex: `Q_{${load.label}} = \\frac{q_{\\min} + q_{\\max}}{2} \\cdot l = \\frac{${load.qStart} + ${load.qEnd}}{2} \\cdot ${L_q} = ${fmtNum(Q_val)}\\text{ кН}, \\quad x_C = ${fmtNum(x_c)}\\text{ м}.`,
        });
      }
    } else if (load.kind === 'point_moment') {
      fbdSteps.push({
        label: `Сосредоточенная пара сил (момент) ${load.label} в сечении x = ${load.x} м:`,
        katex: `${load.label} = ${load.magnitude}\\text{ кН}\\cdot\\text{м} \\; (${
          load.direction === 'ccw' ? '\\text{против хода часовой стрелки, } +' : '\\text{по ходу часовой стрелки, } -'
        }).`,
      });
    }
  }

  // 2. Составление развернутых уравнений статики с числовой подстановкой
  const staticsSteps: AcademicFormulaStep[] = [];
  const primarySupport = input.supports.find((s) => s.type !== 'internal_hinge') ?? {
    id: 'A',
    label: 'A',
    x: 0,
    type: 'fixed',
  };

  // А) Уравнение проекций на ось Ox: \sum F_x = 0
  const symFxTerms: string[] = [];
  const numFxTerms: string[] = [];

  output.reactions.forEach((r) => {
    const sup = input.supports.find((s) => s.id === r.supportId);
    if (sup?.type === 'fixed' || sup?.type === 'pinned') {
      symFxTerms.push(symFxTerms.length === 0 ? `R_{${r.supportLabel}x}` : ` + R_{${r.supportLabel}x}`);
      numFxTerms.push( fmtSignedTerm(1, `R_{${r.supportLabel}x}`, numFxTerms.length === 0) );
    } else if (sup?.type === 'roller' && Math.abs(sup.surfaceAngleDeg ?? 0) > 1e-3) {
      symFxTerms.push(symFxTerms.length === 0 ? `R_{${r.supportLabel}x}` : ` + R_{${r.supportLabel}x}`);
      numFxTerms.push( fmtSignedTerm(1, fmtNum(r.Rx_kN), numFxTerms.length === 0) );
    }
  });

  input.loads.forEach((l) => {
    if (l.kind === 'point_force') {
      const Fx = l.magnitude * Math.cos((l.angleDeg * Math.PI) / 180);
      if (Math.abs(Fx) > 1e-4) {
        symFxTerms.push(fmtSignedTerm(Fx, `${l.label}_x`, symFxTerms.length === 0));
        numFxTerms.push(fmtSignedTerm(Fx, fmtNum(Math.abs(Fx)), numFxTerms.length === 0));
      }
    }
  });

  const rxSummary = output.reactions
    .map((r) => `R_{${r.supportLabel}x} = ${fmtNum(r.Rx_kN)}\\text{ кН}`)
    .join(', \\; ');

  staticsSteps.push({
    label: '1. Сумма проекций всех сил на горизонтальную ось Ox:',
    katex: `\\sum F_x = 0: \\quad ${symFxTerms.join('') || '0'} = 0 \\implies ${numFxTerms.join('') || '0'} = 0 \\implies ${rxSummary}.`,
  });

  // Б) Уравнение моментов относительно опоры A: \sum M_A = 0
  const xA = primarySupport.x;
  const symMTerms: string[] = [];
  const numMTerms: string[] = [];

  output.reactions.forEach((r) => {
    const sup = input.supports.find((s) => s.id === r.supportId);
    if (sup?.type === 'fixed' || sup?.type === 'guided') {
      symMTerms.push(symMTerms.length === 0 ? `M_{${r.supportLabel}}` : ` + M_{${r.supportLabel}}`);
      numMTerms.push(numMTerms.length === 0 ? `M_{${r.supportLabel}}` : ` + M_{${r.supportLabel}}`);
    }
    const arm = Number((r.x - xA).toFixed(4));
    if (Math.abs(arm) > 1e-4) {
      const sign = arm > 0 ? 1 : -1;
      symMTerms.push(fmtSignedTerm(sign, `R_{${r.supportLabel}y} \\cdot ${Math.abs(arm)}`, symMTerms.length === 0));
      numMTerms.push(fmtSignedTerm(sign, `R_{${r.supportLabel}y} \\cdot ${Math.abs(arm)}`, numMTerms.length === 0));
    }
  });

  input.loads.forEach((l) => {
    if (l.kind === 'point_force') {
      const Fy = l.magnitude * Math.sin((l.angleDeg * Math.PI) / 180);
      const arm = Number((l.x - xA).toFixed(4));
      const momentVal = Fy * arm;
      if (Math.abs(momentVal) > 1e-4) {
        symMTerms.push(
          fmtSignedTerm(momentVal, `${l.label}_y \\cdot ${fmtNum(Math.abs(arm))}`, symMTerms.length === 0)
        );
        numMTerms.push(
          fmtSignedTerm(
            momentVal,
            `${fmtNum(Math.abs(Fy))} \\cdot ${fmtNum(Math.abs(arm))}`,
            numMTerms.length === 0
          )
        );
      }
    } else if (l.kind === 'point_moment') {
      const mVal = l.direction === 'ccw' ? l.magnitude : -l.magnitude;
      symMTerms.push(fmtSignedTerm(mVal, l.label, symMTerms.length === 0));
      numMTerms.push(fmtSignedTerm(mVal, fmtNum(l.magnitude), numMTerms.length === 0));
    } else if (l.kind === 'distributed') {
      const L_q = l.xEnd - l.xStart;
      const Q_val = 0.5 * (l.qStart + l.qEnd) * L_q;
      const x_c =
        Math.abs(l.qStart + l.qEnd) > 1e-5
          ? l.xStart + (L_q * (l.qStart + 2 * l.qEnd)) / (3 * (l.qStart + l.qEnd))
          : l.xStart + L_q / 2;
      const arm = Number((x_c - xA).toFixed(4));
      const momentVal = -Q_val * arm; // q > 0 давит вниз (Fy = -Q_val)
      if (Math.abs(momentVal) > 1e-4) {
        symMTerms.push(
          fmtSignedTerm(momentVal, `Q_{${l.label}} \\cdot ${fmtNum(Math.abs(arm))}`, symMTerms.length === 0)
        );
        numMTerms.push(
          fmtSignedTerm(
            momentVal,
            `${fmtNum(Math.abs(Q_val))} \\cdot ${fmtNum(Math.abs(arm))}`,
            numMTerms.length === 0
          )
        );
      }
    }
  });

  staticsSteps.push({
    label: `2. Сумма моментов всех сил относительно точки ${primarySupport.label} (x = ${xA} м):`,
    katex: `\\begin{aligned}
      \\sum M_{${primarySupport.label}} = 0: \\quad & ${symMTerms.join('') || '0'} = 0 \\\\
      & ${numMTerms.join('') || '0'} = 0.
    \\end{aligned}`,
  });

  // В) Уравнение проекций на ось Oy: \sum F_y = 0
  const symFyTerms: string[] = [];
  const numFyTerms: string[] = [];

  output.reactions.forEach((r) => {
    symFyTerms.push(symFyTerms.length === 0 ? `R_{${r.supportLabel}y}` : ` + R_{${r.supportLabel}y}`);
    numFyTerms.push(fmtSignedTerm(1, `R_{${r.supportLabel}y}`, numFyTerms.length === 0));
  });

  input.loads.forEach((l) => {
    if (l.kind === 'point_force') {
      const Fy = l.magnitude * Math.sin((l.angleDeg * Math.PI) / 180);
      if (Math.abs(Fy) > 1e-4) {
        symFyTerms.push(fmtSignedTerm(Fy, `${l.label}_y`, symFyTerms.length === 0));
        numFyTerms.push(fmtSignedTerm(Fy, fmtNum(Math.abs(Fy)), numFyTerms.length === 0));
      }
    } else if (l.kind === 'distributed') {
      const Q_val = 0.5 * (l.qStart + l.qEnd) * (l.xEnd - l.xStart);
      symFyTerms.push(fmtSignedTerm(-Q_val, `Q_{${l.label}}`, symFyTerms.length === 0));
      numFyTerms.push(fmtSignedTerm(-Q_val, fmtNum(Math.abs(Q_val)), numFyTerms.length === 0));
    }
  });

  const rySummary = output.reactions
    .map((r) => {
      const mStr =
        Math.abs(r.M_kNm) > 1e-4 ? `, \\; M_{${r.supportLabel}} = ${fmtNum(r.M_kNm)}\\text{ кН}\\cdot\\text{м}` : '';
      return `R_{${r.supportLabel}y} = ${fmtNum(r.Ry_kN)}\\text{ кН}${mStr}`;
    })
    .join('; \\quad ');

  staticsSteps.push({
    label: '3. Сумма проекций всех сил на вертикальную ось Oy и найденные опорные реакции:',
    katex: `\\begin{aligned}
      \\sum F_y = 0: \\quad & ${symFyTerms.join('') || '0'} = 0 \\implies ${numFyTerms.join('') || '0'} = 0 \\\\
      \\implies & \\mathbf{${rySummary}}.
    \\end{aligned}`,
  });

  // Г) Уравнение проверки равновесия относительно альтернативной точки B (или правого конца балки)
  const checkPointX =
    output.reactions.length > 1
      ? output.reactions[output.reactions.length - 1].x
      : input.length;
  const checkPointLabel =
    output.reactions.length > 1
      ? output.reactions[output.reactions.length - 1].supportLabel
      : 'K';

  const checkNumTerms: string[] = [];
  output.reactions.forEach((r) => {
    if (Math.abs(r.M_kNm) > 1e-4) {
      checkNumTerms.push(fmtSignedTerm(r.M_kNm, fmtNum(Math.abs(r.M_kNm)), checkNumTerms.length === 0));
    }
    const arm = Number((r.x - checkPointX).toFixed(4));
    const mVal = r.Ry_kN * arm;
    if (Math.abs(mVal) > 1e-4) {
      checkNumTerms.push(
        fmtSignedTerm(
          mVal,
          `${fmtNum(Math.abs(r.Ry_kN))} \\cdot ${fmtNum(Math.abs(arm))}`,
          checkNumTerms.length === 0
        )
      );
    }
  });

  input.loads.forEach((l) => {
    if (l.kind === 'point_force') {
      const Fy = l.magnitude * Math.sin((l.angleDeg * Math.PI) / 180);
      const arm = Number((l.x - checkPointX).toFixed(4));
      const mVal = Fy * arm;
      if (Math.abs(mVal) > 1e-4) {
        checkNumTerms.push(
          fmtSignedTerm(
            mVal,
            `${fmtNum(Math.abs(Fy))} \\cdot ${fmtNum(Math.abs(arm))}`,
            checkNumTerms.length === 0
          )
        );
      }
    } else if (l.kind === 'point_moment') {
      const mVal = l.direction === 'ccw' ? l.magnitude : -l.magnitude;
      checkNumTerms.push(fmtSignedTerm(mVal, fmtNum(l.magnitude), checkNumTerms.length === 0));
    } else if (l.kind === 'distributed') {
      const L_q = l.xEnd - l.xStart;
      const Q_val = 0.5 * (l.qStart + l.qEnd) * L_q;
      const x_c =
        Math.abs(l.qStart + l.qEnd) > 1e-5
          ? l.xStart + (L_q * (l.qStart + 2 * l.qEnd)) / (3 * (l.qStart + l.qEnd))
          : l.xStart + L_q / 2;
      const arm = Number((x_c - checkPointX).toFixed(4));
      const mVal = -Q_val * arm;
      if (Math.abs(mVal) > 1e-4) {
        checkNumTerms.push(
          fmtSignedTerm(
            mVal,
            `${fmtNum(Math.abs(Q_val))} \\cdot ${fmtNum(Math.abs(arm))}`,
            checkNumTerms.length === 0
          )
        );
      }
    }
  });

  const verificationStep: AcademicFormulaStep = {
    label: `Проверка правильности определения опорных реакций (сумма моментов всех сил относительно точки ${checkPointLabel}, x = ${checkPointX} м):`,
    katex: `\\sum M_{${checkPointLabel}} = ${checkNumTerms.join('') || '0'} = ${fmtNum(
      output.staticsLog.verificationResidual,
      4
    )} \\equiv 0 \\quad (\\text{условие равновесия выполняется верно}).`,
  };

  // 3. Метод сечений (РОРО) по каждому силовому участку
  const segmentBlocks: AcademicSegmentBlock[] = output.segments.map((seg) => {
    const idx = seg.index;
    const varName = `x_${idx}`;
    const steps: AcademicFormulaStep[] = [];

    if (output.extremaAndMax.N_max_abs > 1e-3) {
      steps.push({
        label: `Уравнение продольных сил N(${varName}):`,
        katex: `${seg.N_formulaKatex} \\implies N(0) = ${fmtNum(seg.N_start)}\\text{ кН}, \\; N(${fmtNum(
          seg.length
        )}) = ${fmtNum(seg.N_end)}\\text{ кН}.`,
      });
    }

    steps.push({
      label: `Аналитическое выражение поперечной силы Q(${varName}) и значения на границах участка:`,
      katex: `\\begin{aligned}
        & ${seg.Q_formulaKatex}; \\\\
        & \\text{при } ${varName} = 0\\text{ м}: \\quad Q(0) = ${fmtNum(seg.Q_start)}\\text{ кН}; \\\\
        & \\text{при } ${varName} = ${fmtNum(seg.length)}\\text{ м}: \\quad Q(${fmtNum(seg.length)}) = ${fmtNum(seg.Q_end)}\\text{ кН}.
      \\end{aligned}`,
    });

    steps.push({
      label: `Аналитическое выражение изгибающего момента M(${varName}) и граничные ординаты:`,
      katex: `\\begin{aligned}
        & ${seg.M_formulaKatex}; \\\\
        & \\text{при } ${varName} = 0\\text{ м}: \\quad M(0) = ${fmtNum(seg.M_start)}\\text{ кН}\\cdot\\text{м} \\; (\\text{${fiberDescriptionRu(seg.M_start)}}); \\\\
        & \\text{при } ${varName} = ${fmtNum(seg.length)}\\text{ м}: \\quad M(${fmtNum(seg.length)}) = ${fmtNum(seg.M_end)}\\text{ кН}\\cdot\\text{м} \\; (\\text{${fiberDescriptionRu(seg.M_end)}}).
      \\end{aligned}`,
    });

    // Если на участке есть локальный экстремум (Q(x_0) = 0)
    for (const ext of seg.localExtrema) {
      steps.push({
        label: `На участке №${idx} поперечная сила меняет знак. Находим координату экстремума изгибающего момента из теоремы Журавского:`,
        katex: `\\begin{aligned}
          & \\frac{dM(${varName})}{d${varName}} = Q(${varName}) = 0 \\implies ${varName}_0 = ${fmtNum(
            ext.xLocal,
            3
          )}\\text{ м} \\; (x_{\\text{глоб}} = ${fmtNum(ext.xGlobal, 3)}\\text{ м}); \\\\
          & M_{\\text{экстр}} = M(${fmtNum(ext.xLocal, 3)}) = \\mathbf{${fmtNum(
            ext.M_value
          )}\\text{ кН}\\cdot\\text{м}} \\; (\\text{${fiberDescriptionRu(ext.M_value)}}).
        \\end{aligned}`,
      });
    }

    return {
      segmentIndex: idx,
      intervalTitle: `Участок №${idx} (глобальная координата x ∈ [${fmtNum(seg.xStart)}; ${fmtNum(
        seg.xEnd
      )}] м)`,
      boundsKatex: `0 \\le x_${idx} \\le ${fmtNum(seg.length)}\\text{ м}`,
      segmentData: seg,
      steps,
    };
  });

  // 4. Расчет на прочность и подбор сечения по ГОСТ 8239-89
  const sd = output.sectionDesign;
  const strengthSteps: AcademicFormulaStep[] = [
    {
      label: 'По эпюре изгибающих моментов определяем опасное сечение балки:',
      katex: `|M_{\\max}| = ${fmtNum(sd.M_max_abs_kNm)}\\text{ кН}\\cdot\\text{м} = ${fmtNum(
        sd.M_max_abs_kNm * 1e6,
        0
      )}\\text{ Н}\\cdot\\text{мм} \\quad (\\text{при } x = ${fmtNum(sd.x_dangerous_m)}\\text{ м}), \\quad |Q_{\\max}| = ${fmtNum(
        sd.Q_max_abs_kN
      )}\\text{ кН}.`,
    },
    {
      label: `Из условия прочности при изгибе определяем требуемый осевой момент сопротивления (при [σ] = ${input.allowableStress_MPa} МПа):`,
      katex: `\\sigma_{\\max} = \\frac{|M_{\\max}|}{W_z} \\le [\\sigma] \\implies W_{z,\\text{треб}} = \\frac{|M_{\\max}|}{[\\sigma]} = \\frac{${fmtNum(
        sd.M_max_abs_kNm
      )} \\cdot 10^3}{${input.allowableStress_MPa}} = \\mathbf{${fmtNum(sd.Wz_required_cm3)}\\text{ см}^3}.`,
    },
    {
      label: 'По сортаменту ГОСТ 8239-89 подбираем ближайший стальной двутавр:',
      katex: `\\text{Двутавр №${sd.selectedIBeam.profileNumber}}: \\quad W_z = ${sd.selectedIBeam.Wz_cm3}\\text{ см}^3, \\quad I_z = ${sd.selectedIBeam.Iz_cm4}\\text{ см}^4, \\quad A = ${sd.selectedIBeam.A_cm2}\\text{ см}^2.`,
    },
    {
      label: 'Выполняем проверочный расчет нормальных напряжений для принятого двутавра:',
      katex: `\\sigma_{\\text{факт}} = \\frac{|M_{\\max}|}{W_z} = \\frac{${fmtNum(
        sd.M_max_abs_kNm
      )} \\cdot 10^3}{${sd.selectedIBeam.Wz_cm3}} = \\mathbf{${fmtNum(
        sd.selectedIBeam.actualStress_MPa
      )}\\text{ МПа}} \\le [\\sigma] = ${input.allowableStress_MPa}\\text{ МПа}.`,
      note: `Недогруз сечения составляет ${fmtNum(
        sd.selectedIBeam.overstressPercent
      )}% (коэффициент использования сечения ${fmtNum(sd.selectedIBeam.utilizationPercent)}%).`,
    },
    {
      label: 'Подбор эквивалентного сплошного круглого сечения диаметром d:',
      katex: `W_z = \\frac{\\pi d^3}{32} \\ge W_{z,\\text{треб}} \\implies d \\ge \\sqrt[3]{\\frac{32 \\cdot ${fmtNum(
        sd.Wz_required_cm3
      )}}{\\pi}} \\implies \\text{принимаем } d = \\mathbf{${
        sd.selectedCircle.diameter_mm
      }\\text{ мм}} \\; (W_z = ${fmtNum(sd.selectedCircle.Wz_cm3)}\\text{ см}^3, \\; \\sigma = ${fmtNum(
        sd.selectedCircle.actualStress_MPa
      )}\\text{ МПа}).`,
    },
  ];

  return {
    title: 'РАСЧЕТНО-ПОЯСНИТЕЛЬНАЯ ЗАПИСКА',
    subtitle: 'Определение опорных реакций, построение эпюр внутренних усилий и подбор сечения балки',
    fbdSection: {
      description:
        'Освобождаем балку от связей, заменяем опоры реактивными силами и моментами, раскладываем наклонные силы на оси координат и заменяем распределенные нагрузки их равнодействующими.',
      steps: fbdSteps,
    },
    staticsSection: {
      steps: staticsSteps,
      verificationStep,
      isVerified: Math.abs(output.staticsLog.verificationResidual) < 1e-4,
    },
    sectionsMethod: {
      introText:
        'Применяем метод сечений (РОРО) на каждом силовом участке. Эпюра изгибающих моментов M строится строго со стороны растянутых волокон (без постановки знаков), а параболические участки направлены навстречу распределенной нагрузке q.',
      segmentBlocks,
    },
    strengthSection: {
      steps: strengthSteps,
      conclusionText: `Прочность балки обеспечена при применении прокатного двутавра №${sd.selectedIBeam.profileNumber} (ГОСТ 8239-89) или круглого сплошного сечения диаметром d = ${sd.selectedCircle.diameter_mm} мм.`,
    },
  };
}

// ============================================================================
// 2. ГЕНЕРАТОР АКАДЕМИЧЕСКОГО РЕШЕНИЯ ДЛЯ СТУПЕНЧАТОГО СТЕРЖНЯ И ВАЛА
// ============================================================================

export function generateSteppedRodAcademicSteps(
  input: SteppedRodProblemInput,
  output: SteppedRodSolverOutput
): AcademicFormulaStep[] {
  const steps: AcademicFormulaStep[] = [
    {
      label: '1. Реакция жесткой заделки из уравнения равновесия продольных сил ∑F_x = 0:',
      katex: `\\sum F_x = 0 \\implies R_{\\text{зад}} = ${fmtNum(output.reactionWall_kN)}\\text{ кН}.`,
    },
  ];

  output.segments.forEach((seg, idx) => {
    const i = idx + 1;
    steps.push({
      label: `2.${i}. Силовой участок №${i} (x ∈ [${fmtNum(seg.xStart_m)}; ${fmtNum(
        seg.xEnd_m
      )}] м, длина l_${i} = ${fmtNum(seg.length_m)} м, площадь A_${i} = ${fmtNum(
        seg.area_mm2
      )} мм²):`,
      katex: `\\begin{aligned}
        N_${i} &= ${fmtNum(seg.N_kN)}\\text{ кН} \\; (${
          seg.N_kN >= 0 ? '\\text{растяжение}' : '\\text{сжатие}'
        }); \\\\
        \\sigma_${i} &= \\frac{N_${i}}{A_${i}} = \\frac{${fmtNum(seg.N_kN)} \\cdot 10^3\\text{ Н}}{${fmtNum(
          seg.area_mm2
        )}\\text{ мм}^2} = \\mathbf{${fmtNum(seg.sigma_MPa)}\\text{ МПа}}; \\\\
        \\Delta l_${i} &= \\frac{N_${i} \\cdot l_${i}}{E \\cdot A_${i}} = \\frac{${fmtNum(
          seg.N_kN * 1000
        )} \\cdot ${fmtNum(seg.length_m * 1000)}}{2 \\cdot 10^5 \\cdot ${fmtNum(
          seg.area_mm2
        )}} = \\mathbf{${fmtNum(seg.deltaL_mm, 4)}\\text{ мм}}.
      \\end{aligned}`,
    });
  });

  steps.push({
    label: '3. Полная деформация стержня и проверка условий прочности и жесткости:',
    katex: `\\begin{aligned}
      \\Delta l_{\\Sigma} &= \\sum_{i=1}^{${output.segments.length}} \\Delta l_i = \\mathbf{${fmtNum(
        output.totalElongation_mm,
        4
      )}\\text{ мм}}; \\\\
      |\\sigma_{\\max}| &= ${fmtNum(output.maxStressAbs_MPa)}\\text{ МПа} ${
        output.isStrengthOk ? '\\le' : '>'
      } [\\sigma] = ${input.allowableStress_MPa}\\text{ МПа}; \\\\
      |\\Delta l_{\\max}| &= ${fmtNum(output.maxDisplacementAbs_mm, 4)}\\text{ мм} ${
        output.isStiffnessOk ? '\\le' : '>'
      } [\\Delta l] = ${input.allowableElongation_mm}\\text{ мм}.
    \\end{aligned}`,
    note: output.recalculatedBaseArea_mm2
      ? `Требуется перерасчет площади сечения! Минимально необходимая базовая площадь: A_треб = ${output.recalculatedBaseArea_mm2} мм².`
      : 'Условия прочности и жесткости ступенчатого стержня полностью выполняются.',
  });

  return steps;
}

export function generateTorsionAcademicSteps(
  input: TorsionShaftProblemInput,
  output: TorsionSolverOutput
): AcademicFormulaStep[] {
  const steps: AcademicFormulaStep[] = [
    {
      label: '1. Реактивный момент в жесткой заделке из условия равновесия ∑M_x = 0:',
      katex: `\\sum M_x = 0 \\implies M_{\\text{зад}} = ${fmtNum(output.reactionMomentWall_kNm)}\\text{ кН}\\cdot\\text{м}.`,
    },
  ];

  output.segments.forEach((seg, idx) => {
    const i = idx + 1;
    steps.push({
      label: `2.${i}. Участок вала №${i} (x ∈ [${fmtNum(seg.xStart_m)}; ${fmtNum(
        seg.xEnd_m
      )}] м, длина l_${i} = ${fmtNum(seg.length_m)} м):`,
      katex: `\\begin{aligned}
        M_{k,${i}} &= ${fmtNum(seg.Mk_kNm)}\\text{ кН}\\cdot\\text{м}; \\quad I_{p,${i}} = ${fmtNum(
          seg.Ip_cm4,
          3
        )}\\text{ см}^4; \\quad W_{p,${i}} = ${fmtNum(seg.Wp_cm3, 3)}\\text{ см}^3; \\\\
        \\tau_{\\max,${i}} &= \\frac{|M_{k,${i}}|}{W_{p,${i}}} = \\frac{${fmtNum(
          Math.abs(seg.Mk_kNm) * 1000
        )}}{${fmtNum(seg.Wp_cm3, 3)}} = \\mathbf{${fmtNum(seg.tauMax_MPa)}\\text{ МПа}}; \\\\
        \\varphi_${i} &= \\text{от } ${fmtNum(seg.phiStart_deg, 3)}^\\circ \\text{ до } \\mathbf{${fmtNum(
          seg.phiEnd_deg,
          3
        )}^\\circ}.
      \\end{aligned}`,
    });
  });

  return steps;
}