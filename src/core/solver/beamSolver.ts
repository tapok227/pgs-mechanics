import {
  BeamProblemInput,
  BeamSolverOutput,
  BeamSegmentAnalysis,
  SupportReactionResult,
  StaticsEquilibriumLog,
  FBDForceReplacement,
  PolynomialCoeffs,
  StretchedFiberSide,
  SectionSelectionResult,
  CrosshairSamplePoint,
} from '../../types/mechanics';

const EPS = 1e-7;

// ============================================================================
// СПРАВОЧНИК ПРОКАТНЫХ ДВУТАВРОВ ГОСТ 8239-89
// ============================================================================
interface GostIBeamEntry {
  number: string;
  h_mm: number;
  b_mm: number;
  A_cm2: number;
  Iz_cm4: number;
  Wz_cm3: number;
  Iy_cm4: number;
}

export const GOST_8239_IBEAMS: GostIBeamEntry[] = [
  { number: '10', h_mm: 100, b_mm: 55, A_cm2: 12.0, Iz_cm4: 198, Wz_cm3: 39.7, Iy_cm4: 17.9 },
  { number: '12', h_mm: 120, b_mm: 64, A_cm2: 14.7, Iz_cm4: 350, Wz_cm3: 58.4, Iy_cm4: 27.9 },
  { number: '14', h_mm: 140, b_mm: 73, A_cm2: 17.4, Iz_cm4: 572, Wz_cm3: 81.7, Iy_cm4: 41.9 },
  { number: '16', h_mm: 160, b_mm: 81, A_cm2: 20.2, Iz_cm4: 873, Wz_cm3: 109.0, Iy_cm4: 58.6 },
  { number: '18', h_mm: 180, b_mm: 90, A_cm2: 23.4, Iz_cm4: 1290, Wz_cm3: 143.0, Iy_cm4: 82.6 },
  { number: '20', h_mm: 200, b_mm: 100, A_cm2: 26.8, Iz_cm4: 1840, Wz_cm3: 184.0, Iy_cm4: 115.0 },
  { number: '22', h_mm: 220, b_mm: 110, A_cm2: 30.6, Iz_cm4: 2550, Wz_cm3: 232.0, Iy_cm4: 157.0 },
  { number: '24', h_mm: 240, b_mm: 115, A_cm2: 34.8, Iz_cm4: 3460, Wz_cm3: 289.0, Iy_cm4: 198.0 },
  { number: '27', h_mm: 270, b_mm: 125, A_cm2: 40.2, Iz_cm4: 5010, Wz_cm3: 371.0, Iy_cm4: 260.0 },
  { number: '30', h_mm: 300, b_mm: 135, A_cm2: 46.5, Iz_cm4: 7080, Wz_cm3: 472.0, Iy_cm4: 337.0 },
  { number: '36', h_mm: 360, b_mm: 145, A_cm2: 61.9, Iz_cm4: 13380, Wz_cm3: 743.0, Iy_cm4: 516.0 },
  { number: '40', h_mm: 400, b_mm: 155, A_cm2: 72.6, Iz_cm4: 19062, Wz_cm3: 953.0, Iy_cm4: 667.0 },
  { number: '45', h_mm: 450, b_mm: 160, A_cm2: 83.0, Iz_cm4: 27696, Wz_cm3: 1231.0, Iy_cm4: 808.0 },
  { number: '50', h_mm: 500, b_mm: 170, A_cm2: 100.0, Iz_cm4: 39727, Wz_cm3: 1589.0, Iy_cm4: 1043.0 },
];

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
// ============================================================================

export function evalPoly(p: PolynomialCoeffs, x: number): number {
  return p.c0 + p.c1 * x + p.c2 * x * x + p.c3 * x * x * x;
}

function roundClean(val: number, digits = 4): number {
  const factor = Math.pow(10, digits);
  const r = Math.round(val * factor) / factor;
  return Object.is(r, -0) ? 0 : r;
}

function getStretchedFiber(M: number): StretchedFiberSide {
  if (Math.abs(M) < 1e-5) return 'none';
  // Положительный изгибающий момент M > 0 растягивает НИЖНИЕ волокна,
  // отрицательный M < 0 растягивает ВЕРХНИЕ волокна.
  return M > 0 ? 'bottom' : 'top';
}

/**
 * Решение СЛАУ A * x = b методом Гаусса с частичным выбором главного элемента
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
        maxRow = row;
      }
    }
    if (Math.abs(M[maxRow][col]) < 1e-10) {
      return null; // Вырожденная матрица (геометрически изменяемая система)
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }
  return x;
}

/**
 * Форматирование полинома в строку KaTeX
 */
function formatPolyKatex(p: PolynomialCoeffs, varName: string): string {
  const terms: string[] = [];
  const coeffs = [
    { val: roundClean(p.c0, 3), pow: 0 },
    { val: roundClean(p.c1, 3), pow: 1 },
    { val: roundClean(p.c2, 3), pow: 2 },
    { val: roundClean(p.c3, 3), pow: 3 },
  ];

  for (const { val, pow } of coeffs) {
    if (Math.abs(val) < 1e-4) continue;
    const sign = val >= 0 ? (terms.length > 0 ? ' + ' : '') : ' - ';
    const absVal = Math.abs(val);
    let body = '';
    if (pow === 0) body = `${absVal}`;
    else if (pow === 1) body = `${absVal === 1 ? '' : absVal}${varName}`;
    else body = `${absVal === 1 ? '' : absVal}${varName}^{${pow}}`;
    terms.push(`${sign}${body}`);
  }

  return terms.length > 0 ? terms.join('') : '0';
}

// ============================================================================
// ОСНОВНОЙ СОЛВЕР БАЛКИ
// ============================================================================

export function solveBeamProblem(input: BeamProblemInput): BeamSolverOutput {
  const { length, supports, loads, allowableStress_MPa } = input;

  // 1. Сортируем опоры и формируем список неизвестных реакций
  const physicalSupports = supports.filter((s) => s.type !== 'internal_hinge');
  const internalHinges = supports
    .filter((s) => s.type === 'internal_hinge')
    .sort((a, b) => a.x - b.x);

  interface UnknownReaction {
    supportId: string;
    supportLabel: string;
    x: number;
    kind: 'Rx' | 'Ry' | 'R_inclined' | 'M';
    angleRad: number; // Для R_inclined: угол вектора реакции к оси Ox
  }

  const unknowns: UnknownReaction[] = [];
  for (const sup of physicalSupports) {
    if (sup.type === 'fixed') {
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'Rx', angleRad: 0 });
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'Ry', angleRad: Math.PI / 2 });
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'M', angleRad: 0 });
    } else if (sup.type === 'pinned') {
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'Rx', angleRad: 0 });
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'Ry', angleRad: Math.PI / 2 });
    } else if (sup.type === 'roller') {
      const surfAngleRad = ((sup.surfaceAngleDeg ?? 0) * Math.PI) / 180;
      // Реакция катка перпендикулярна опорной плоскости (по умолчанию вертикально вверх +90°)
      const normalAngleRad = surfAngleRad + Math.PI / 2;
      unknowns.push({
        supportId: sup.id,
        supportLabel: sup.label,
        x: sup.x,
        kind: 'R_inclined',
        angleRad: normalAngleRad,
      });
    } else if (sup.type === 'guided') {
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'Ry', angleRad: Math.PI / 2 });
      unknowns.push({ supportId: sup.id, supportLabel: sup.label, x: sup.x, kind: 'M', angleRad: 0 });
    }
  }

  const numEquations = 3 + internalHinges.length;
  if (unknowns.length !== numEquations) {
    return {
      isStaticallyDeterminate: false,
      errorMessage: `Система статически неопределима или геометрически изменяема: неизвестных реакций ${unknowns.length}, уравнений статики ${numEquations}.`,
      reactions: [],
      staticsLog: {
        fbdReplacements: [],
        sumFxKatex: '',
        sumFyKatex: '',
        sumMKatex: [],
        verificationEquationKatex: '',
        verificationResidual: 0,
      },
      segments: [],
      criticalPointsX: [],
      extremaAndMax: { N_max_abs: 0, Q_max_abs: 0, M_max_abs: 0, x_M_max: 0 },
      sectionDesign: selectOptimalSection(0, 0, 0, allowableStress_MPa),
    };
  }

  // 2. Преобразование внешних нагрузок в сосредоточенные равнодействующие для FBD
  const fbdReplacements: FBDForceReplacement[] = [];
  interface EquivalentStaticLoad {
    x: number;
    Fx: number; // + вправо
    Fy: number; // + вверх
    M: number;  // + против ч.с.
    label: string;
  }
  const eqLoads: EquivalentStaticLoad[] = [];

  for (const load of loads) {
    if (load.kind === 'point_force') {
      const rad = (load.angleDeg * Math.PI) / 180;
      const Fx = roundClean(load.magnitude * Math.cos(rad), 6);
      const Fy = roundClean(load.magnitude * Math.sin(rad), 6);
      eqLoads.push({ x: load.x, Fx, Fy, M: 0, label: load.label });
      fbdReplacements.push({
        sourceLoadId: load.id,
        label: load.label,
        xApplication: load.x,
        Fx_kN: Fx,
        Fy_kN: Fy,
        descriptionKatex: `${load.label}: F_x = ${roundClean(Fx, 2)}\\text{ кН},\\; F_y = ${roundClean(Fy, 2)}\\text{ кН} \\text{ при } x = ${load.x}\\text{ м}`,
      });
    } else if (load.kind === 'point_moment') {
      const signedM = load.direction === 'ccw' ? load.magnitude : -load.magnitude;
      eqLoads.push({ x: load.x, Fx: 0, Fy: 0, M: signedM, label: load.label });
    } else if (load.kind === 'distributed') {
      const L_q = load.xEnd - load.xStart;
      // Разбиваем трапецию/треугольник/прямоугольник на точную равнодействующую
      const Q_rect = load.qStart * L_q;
      const x_rect = load.xStart + L_q / 2;
      const Q_tri = 0.5 * (load.qEnd - load.qStart) * L_q;
      const x_tri = load.xStart + (2 / 3) * L_q;
      const Q_total = Q_rect + Q_tri;
      const x_c = Math.abs(Q_total) > EPS ? (Q_rect * x_rect + Q_tri * x_tri) / Q_total : load.xStart + L_q / 2;
      // По стандарту q > 0 действует сверху вниз => Fy = -Q_total
      const Fy = -Q_total;
      eqLoads.push({ x: x_c, Fx: 0, Fy, M: 0, label: `Q_{${load.label}}` });
      fbdReplacements.push({
        sourceLoadId: load.id,
        label: `Q_{${load.label}}`,
        xApplication: roundClean(x_c, 4),
        Fx_kN: 0,
        Fy_kN: roundClean(Fy, 4),
        descriptionKatex: `Q_{${load.label}} = ${roundClean(Math.abs(Q_total), 2)}\\text{ кН},\\; x_C = ${roundClean(x_c, 2)}\\text{ м}`,
      });
    }
  }

  // 3. Составление матрицы уравнений равновесия:
  // Строка 0: Sum F_x = 0
  // Строка 1: Sum F_y = 0
  // Строка 2: Sum M_A = 0 (относительно первой опоры x_A)
  // Строки 3..k: Sum M_{hinge}^{left} = 0 (сумма моментов левой части относительно врезного шарнира)
  const A_mat: number[][] = [];
  const b_vec: number[] = [];

  // Уравнение 1: Sum Fx = 0
  const rowFx = unknowns.map((u) => (u.kind === 'M' ? 0 : Math.cos(u.angleRad)));
  const rhsFx = -eqLoads.reduce((acc, l) => acc + l.Fx, 0);
  A_mat.push(rowFx);
  b_vec.push(rhsFx);

  // Уравнение 2: Sum Fy = 0
  const rowFy = unknowns.map((u) => (u.kind === 'M' ? 0 : Math.sin(u.angleRad)));
  const rhsFy = -eqLoads.reduce((acc, l) => acc + l.Fy, 0);
  A_mat.push(rowFy);
  b_vec.push(rhsFy);

  // Уравнение 3: Sum M_{xPivot} = 0
  const xPivot = physicalSupports[0]?.x ?? 0;
  const rowM = unknowns.map((u) => {
    if (u.kind === 'M') return 1;
    const fyCoeff = Math.sin(u.angleRad);
    return fyCoeff * (u.x - xPivot);
  });
  const rhsM = -eqLoads.reduce((acc, l) => acc + l.M + l.Fy * (l.x - xPivot), 0);
  A_mat.push(rowM);
  b_vec.push(rhsM);

  // Дополнительные уравнения для врезных шарниров (левая отсеченная часть)
  for (const hinge of internalHinges) {
    const rowHinge = unknowns.map((u) => {
      if (u.x > hinge.x + EPS) return 0;
      if (u.kind === 'M') return 1;
      return Math.sin(u.angleRad) * (u.x - hinge.x);
    });
    // Для распределенных нагрузок, которые могут пересекать врезной шарнир,
    // интегрируем момент только от части левее hinge.x
    let externalMomentLeft = 0;
    for (const load of loads) {
      if (load.kind === 'point_force' && load.x <= hinge.x + EPS) {
        const Fy = load.magnitude * Math.sin((load.angleDeg * Math.PI) / 180);
        externalMomentLeft += Fy * (load.x - hinge.x);
      } else if (load.kind === 'point_moment' && load.x <= hinge.x + EPS) {
        externalMomentLeft += load.direction === 'ccw' ? load.magnitude : -load.magnitude;
      } else if (load.kind === 'distributed' && load.xStart < hinge.x - EPS) {
        const x2 = Math.min(load.xEnd, hinge.x);
        const L_total = load.xEnd - load.xStart;
        const L_sub = x2 - load.xStart;
        const q2 = load.qStart + ((load.qEnd - load.qStart) * L_sub) / L_total;
        const Q_rect = load.qStart * L_sub;
        const x_rect = load.xStart + L_sub / 2;
        const Q_tri = 0.5 * (q2 - load.qStart) * L_sub;
        const x_tri = load.xStart + (2 / 3) * L_sub;
        externalMomentLeft += -Q_rect * (x_rect - hinge.x) - Q_tri * (x_tri - hinge.x);
      }
    }
    A_mat.push(rowHinge);
    b_vec.push(-externalMomentLeft);
  }

  const sol = solveLinearSystem(A_mat, b_vec);
  if (!sol) {
    return {
      isStaticallyDeterminate: false,
      errorMessage: 'Система геометрически изменяема (вырожденная матрица связей).',
      reactions: [],
      staticsLog: {
        fbdReplacements,
        sumFxKatex: '',
        sumFyKatex: '',
        sumMKatex: [],
        verificationEquationKatex: '',
        verificationResidual: 0,
      },
      segments: [],
      criticalPointsX: [],
      extremaAndMax: { N_max_abs: 0, Q_max_abs: 0, M_max_abs: 0, x_M_max: 0 },
      sectionDesign: selectOptimalSection(0, 0, 0, allowableStress_MPa),
    };
  }

  // 4. Сборка векторов опорных реакций по узлам
  const reactionMap = new Map<string, SupportReactionResult>();
  for (const sup of physicalSupports) {
    reactionMap.set(sup.id, {
      supportId: sup.id,
      supportLabel: sup.label,
      x: sup.x,
      Rx_kN: 0,
      Ry_kN: 0,
      R_total_kN: 0,
      M_kNm: 0,
    });
  }

  unknowns.forEach((u, idx) => {
    const val = roundClean(sol[idx], 5);
    const rec = reactionMap.get(u.supportId)!;
    if (u.kind === 'Rx') rec.Rx_kN += val;
    else if (u.kind === 'Ry') rec.Ry_kN += val;
    else if (u.kind === 'R_inclined') {
      rec.Rx_kN = roundClean(val * Math.cos(u.angleRad), 5);
      rec.Ry_kN = roundClean(val * Math.sin(u.angleRad), 5);
    } else if (u.kind === 'M') {
      rec.M_kNm += val;
    }
  });

  const reactions = Array.from(reactionMap.values()).map((r) => ({
    ...r,
    R_total_kN: roundClean(Math.hypot(r.Rx_kN, r.Ry_kN), 4),
  }));

  // 5. Уравнение проверки относительно альтернативного полюса xCheck (конец балки или опора B)
  const xCheck =
    physicalSupports.length > 1
      ? physicalSupports[physicalSupports.length - 1].x
      : length;
  let checkSum = 0;
  for (const r of reactions) {
    checkSum += r.M_kNm + r.Ry_kN * (r.x - xCheck);
  }
  for (const l of eqLoads) {
    checkSum += l.M + l.Fy * (l.x - xCheck);
  }
  const verificationResidual = roundClean(checkSum, 6);

  const staticsLog: StaticsEquilibriumLog = {
    fbdReplacements,
    sumFxKatex: `\\sum F_x = 0 \\implies ${reactions
      .map((r) => `R_{${r.supportLabel}x} = ${roundClean(r.Rx_kN, 2)}\\text{ кН}`)
      .join(',\\; ')}`,
    sumFyKatex: `\\sum F_y = 0 \\implies ${reactions
      .map((r) => `R_{${r.supportLabel}y} = ${roundClean(r.Ry_kN, 2)}\\text{ кН}`)
      .join(',\\; ')}`,
    sumMKatex: [
      `\\sum M_{${physicalSupports[0]?.label ?? 'O'}} = 0`,
      ...internalHinges.map((h) => `\\sum M_{${h.label}}^{\\text{лев}} = 0`),
    ],
    verificationEquationKatex: `\\sum M_{\\text{пров}}(x = ${xCheck}\\text{ м}) = ${verificationResidual} = 0`,
    verificationResidual,
  };

  // 6. Разбиение балки на силовые участки
  const xSet = new Set<number>([0, length]);
  supports.forEach((s) => xSet.add(roundClean(s.x, 5)));
  loads.forEach((l) => {
    if (l.kind === 'point_force' || l.kind === 'point_moment') {
      xSet.add(roundClean(l.x, 5));
    } else if (l.kind === 'distributed') {
      xSet.add(roundClean(l.xStart, 5));
      xSet.add(roundClean(l.xEnd, 5));
    }
  });

  const criticalPointsX = Array.from(xSet)
    .filter((x) => x >= -EPS && x <= length + EPS)
    .sort((a, b) => a - b);

  // 7. Метод сечений (РОРО): построение аналитических полиномов N(x_i), Q(x_i), M(x_i)
  const segments: BeamSegmentAnalysis[] = [];
  let N_max_abs = 0;
  let Q_max_abs = 0;
  let M_max_abs = 0;
  let x_M_max = 0;

  for (let i = 0; i < criticalPointsX.length - 1; i++) {
    const xStart = criticalPointsX[i];
    const xEnd = criticalPointsX[i + 1];
    const segLen = roundClean(xEnd - xStart, 6);
    if (segLen < 1e-5) continue;

    // Локальная координата u = x_i in [0, segLen], глобальная координата x = xStart + u
    const N_poly: PolynomialCoeffs = { c0: 0, c1: 0, c2: 0, c3: 0 };
    const Q_poly: PolynomialCoeffs = { c0: 0, c1: 0, c2: 0, c3: 0 };
    const M_poly: PolynomialCoeffs = { c0: 0, c1: 0, c2: 0, c3: 0 };

    // А. Вклад опорных реакций левее сечения (x_sup <= xStart)
    for (const r of reactions) {
      if (r.x <= xStart + EPS) {
        const arm0 = xStart - r.x;
        // Из уравнения равновесия левой части: Sum Fx = R_x + N = 0 => N = -R_x
        N_poly.c0 -= r.Rx_kN;
        // Положительная поперечная сила Q вращает левую отсеченную часть по ч.с.: Q = +R_y
        Q_poly.c0 += r.Ry_kN;
        // Изгибающий момент (правило сопромата: сила вверх слева сжимает верхние и растягивает нижние волокна -> +M)
        // Если внешний/реактивный момент направлен ПО ч.с. (cw, т.е. r.M_kNm < 0), он растягивает нижние волокна слева -> +M
        M_poly.c0 += r.Ry_kN * arm0 - r.M_kNm;
        M_poly.c1 += r.Ry_kN;
      }
    }

    // Б. Вклад внешних нагрузок левее или внутри участка
    for (const load of loads) {
      if (load.kind === 'point_force' && load.x <= xStart + EPS) {
        const rad = (load.angleDeg * Math.PI) / 180;
        const Fx = load.magnitude * Math.cos(rad);
        const Fy = load.magnitude * Math.sin(rad);
        const arm0 = xStart - load.x;

        N_poly.c0 -= Fx;
        Q_poly.c0 += Fy;
        M_poly.c0 += Fy * arm0;
        M_poly.c1 += Fy;
      } else if (load.kind === 'point_moment' && load.x <= xStart + EPS) {
        // Внешний момент по часовой стрелке ('cw') на левой отсеченной части растягивает нижние волокна (+M)
        const mEffect = load.direction === 'cw' ? load.magnitude : -load.magnitude;
        M_poly.c0 += mEffect;
      } else if (load.kind === 'distributed') {
        const L_q = load.xEnd - load.xStart;
        const k_slope = (load.qEnd - load.qStart) / L_q;

        // Случай 1: распределенная нагрузка полностью закончилась левее участка (load.xEnd <= xStart)
        if (load.xEnd <= xStart + EPS) {
          const Q_rect = load.qStart * L_q;
          const x_rect = load.xStart + L_q / 2;
          const Q_tri = 0.5 * (load.qEnd - load.qStart) * L_q;
          const x_tri = load.xStart + (2 / 3) * L_q;
          const Q_tot = Q_rect + Q_tri;

          Q_poly.c0 -= Q_tot;
          M_poly.c0 -= Q_rect * (xStart - x_rect) + Q_tri * (xStart - x_tri);
          M_poly.c1 -= Q_tot;
        }
        // Случай 2: распределенная нагрузка покрывает текущий участок (load.xStart <= xStart и load.xEnd >= xEnd)
        else if (load.xStart <= xStart + EPS && load.xEnd >= xEnd - EPS) {
          // а) Часть нагрузки левее начала участка [load.xStart, xStart]
          const L_left = xStart - load.xStart;
          const q_at_xStart = load.qStart + k_slope * L_left;

          if (L_left > EPS) {
            const Q_rect_left = load.qStart * L_left;
            const x_rect_left = load.xStart + L_left / 2;
            const Q_tri_left = 0.5 * (q_at_xStart - load.qStart) * L_left;
            const x_tri_left = load.xStart + (2 / 3) * L_left;
            const Q_left_tot = Q_rect_left + Q_tri_left;

            Q_poly.c0 -= Q_left_tot;
            M_poly.c0 -= Q_rect_left * (xStart - x_rect_left) + Q_tri_left * (xStart - x_tri_left);
            M_poly.c1 -= Q_left_tot;
          }

          // б) Часть нагрузки непосредственно на участке u in [0, segLen]:
          // q(u) = q_at_xStart + k_slope * u
          // Вклад в Q(u): - (q_at_xStart * u + 0.5 * k_slope * u^2)
          // Вклад в M(u): - (0.5 * q_at_xStart * u^2 + (1/6) * k_slope * u^3)
          Q_poly.c1 -= q_at_xStart;
          Q_poly.c2 -= 0.5 * k_slope;

          M_poly.c2 -= 0.5 * q_at_xStart;
          M_poly.c3 -= (1 / 6) * k_slope;
        }
      }
    }

    const N_start = roundClean(evalPoly(N_poly, 0), 4);
    const N_end = roundClean(evalPoly(N_poly, segLen), 4);
    const Q_start = roundClean(evalPoly(Q_poly, 0), 4);
    const Q_end = roundClean(evalPoly(Q_poly, segLen), 4);
    const M_start = roundClean(evalPoly(M_poly, 0), 4);
    const M_end = roundClean(evalPoly(M_poly, segLen), 4);

    // 8. Поиск локальных экстремумов M(x_i) внутри участка из условия dM/dx_i = Q(x_i) = 0
    const localExtrema: BeamSegmentAnalysis['localExtrema'] = [];
    const candidateRoots: number[] = [];

    if (Math.abs(Q_poly.c2) > EPS) {
      // Квадратное уравнение c2*u^2 + c1*u + c0 = 0
      const disc = Q_poly.c1 * Q_poly.c1 - 4 * Q_poly.c2 * Q_poly.c0;
      if (disc >= 0) {
        const sqrtD = Math.sqrt(disc);
        candidateRoots.push((-Q_poly.c1 - sqrtD) / (2 * Q_poly.c2));
        candidateRoots.push((-Q_poly.c1 + sqrtD) / (2 * Q_poly.c2));
      }
    } else if (Math.abs(Q_poly.c1) > EPS) {
      // Линейное уравнение c1*u + c0 = 0
      candidateRoots.push(-Q_poly.c0 / Q_poly.c1);
    }

    for (const rootU of candidateRoots) {
      if (rootU > 1e-4 && rootU < segLen - 1e-4) {
        const M_ext = roundClean(evalPoly(M_poly, rootU), 4);
        localExtrema.push({
          xLocal: roundClean(rootU, 4),
          xGlobal: roundClean(xStart + rootU, 4),
          M_value: M_ext,
          stretchedFiber: getStretchedFiber(M_ext),
        });
      }
    }

    // Обновление глобальных максимумов
    N_max_abs = Math.max(N_max_abs, Math.abs(N_start), Math.abs(N_end));
    Q_max_abs = Math.max(Q_max_abs, Math.abs(Q_start), Math.abs(Q_end));

    const checkMomentMax = (mVal: number, xGlob: number) => {
      if (Math.abs(mVal) > M_max_abs) {
        M_max_abs = roundClean(Math.abs(mVal), 4);
        x_M_max = roundClean(xGlob, 4);
      }
    };
    checkMomentMax(M_start, xStart);
    checkMomentMax(M_end, xEnd);
    localExtrema.forEach((ext) => checkMomentMax(ext.M_value, ext.xGlobal));

    const varSub = `x_${i + 1}`;
    segments.push({
      index: i + 1,
      xStart,
      xEnd,
      length: segLen,
      N_poly,
      Q_poly,
      M_poly,
      N_start,
      N_end,
      Q_start,
      Q_end,
      M_start,
      M_end,
      stretchedStart: getStretchedFiber(M_start),
      stretchedEnd: getStretchedFiber(M_end),
      localExtrema,
      N_formulaKatex: `N(${varSub}) = ${formatPolyKatex(N_poly, varSub)}\\text{ кН}`,
      Q_formulaKatex: `Q(${varSub}) = ${formatPolyKatex(Q_poly, varSub)}\\text{ кН}`,
      M_formulaKatex: `M(${varSub}) = ${formatPolyKatex(M_poly, varSub)}\\text{ кН}\\cdot\\text{м}`,
    });
  }

  const sectionDesign = selectOptimalSection(
    M_max_abs,
    Q_max_abs,
    x_M_max,
    allowableStress_MPa
  );

  return {
    isStaticallyDeterminate: true,
    reactions,
    staticsLog,
    segments,
    criticalPointsX,
    extremaAndMax: {
      N_max_abs: roundClean(N_max_abs, 4),
      Q_max_abs: roundClean(Q_max_abs, 4),
      M_max_abs: roundClean(M_max_abs, 4),
      x_M_max,
    },
    sectionDesign,
  };
}

// ============================================================================
// МОДУЛЬ ПОДБОРА ПОПЕРЕЧНЫХ СЕЧЕНИЙ ПО УСЛОВИЮ ПРОЧНОСТИ
// ============================================================================

export function selectOptimalSection(
  M_max_abs_kNm: number,
  Q_max_abs_kN: number,
  x_dangerous_m: number,
  allowableStress_MPa: number
): SectionSelectionResult {
  // W_z,треб [см^3] = (M_max [кН*м] * 10^6 [Н*мм]) / ([sigma] [Н/мм^2] * 10^3 [мм^3/см^3])
  const Wz_required_cm3 = roundClean(
    (M_max_abs_kNm * 1000) / Math.max(allowableStress_MPa, 1),
    2
  );

  // Подбор ближайшего двутавра ГОСТ 8239-89
  const matchedIBeam =
    GOST_8239_IBEAMS.find((b) => b.Wz_cm3 >= Wz_required_cm3) ??
    GOST_8239_IBEAMS[GOST_8239_IBEAMS.length - 1];

  const actualStressIBeam =
    matchedIBeam.Wz_cm3 > 0
      ? roundClean((M_max_abs_kNm * 1000) / matchedIBeam.Wz_cm3, 2)
      : 0;
  const utilizationPercent = roundClean(
    (actualStressIBeam / allowableStress_MPa) * 100,
    2
  );
  const overstressPercent = roundClean(
    ((allowableStress_MPa - actualStressIBeam) / allowableStress_MPa) * 100,
    2
  );

  // Подбор круглого сплошного сечения: W_z = pi * d^3 / 32 >= W_z,треб
  const d_exact_cm = Math.cbrt((32 * Wz_required_cm3) / Math.PI);
  const d_rounded_mm = Math.max(10, Math.ceil(d_exact_cm * 10)); // Округление до 1 мм вверх
  const Wz_circle_cm3 = roundClean(
    (Math.PI * Math.pow(d_rounded_mm / 10, 3)) / 32,
    2
  );
  const actualStressCircle =
    Wz_circle_cm3 > 0
      ? roundClean((M_max_abs_kNm * 1000) / Wz_circle_cm3, 2)
      : 0;

  return {
    M_max_abs_kNm,
    Q_max_abs_kN,
    x_dangerous_m,
    Wz_required_cm3,
    selectedIBeam: {
      profileNumber: matchedIBeam.number,
      Wz_cm3: matchedIBeam.Wz_cm3,
      Iz_cm4: matchedIBeam.Iz_cm4,
      A_cm2: matchedIBeam.A_cm2,
      actualStress_MPa: actualStressIBeam,
      utilizationPercent,
      overstressPercent,
    },
    selectedCircle: {
      diameter_mm: d_rounded_mm,
      Wz_cm3: Wz_circle_cm3,
      actualStress_MPa: actualStressCircle,
    },
  };
}

// ============================================================================
// ЗАПРОС ТОЧКИ ДЛЯ СИНХРОНИЗИРОВАННОГО ВИЗИРА (CROSSHAIR SYNC)
// ============================================================================

export function sampleBeamAtX(
  output: BeamSolverOutput,
  xGlobal: number
): CrosshairSamplePoint | null {
  if (!output.isStaticallyDeterminate || output.segments.length === 0) {
    return null;
  }

  const clampedX = Math.max(
    output.segments[0].xStart,
    Math.min(xGlobal, output.segments[output.segments.length - 1].xEnd)
  );

  const seg =
    output.segments.find(
      (s) => clampedX >= s.xStart - EPS && clampedX <= s.xEnd + EPS
    ) ?? output.segments[output.segments.length - 1];

  const xLocal = Math.max(0, Math.min(clampedX - seg.xStart, seg.length));
  const N_kN = roundClean(evalPoly(seg.N_poly, xLocal), 3);
  const Q_kN = roundClean(evalPoly(seg.Q_poly, xLocal), 3);
  const M_kNm = roundClean(evalPoly(seg.M_poly, xLocal), 3);

  const Wz_cm3 = output.sectionDesign.selectedIBeam.Wz_cm3;
  const A_cm2 = output.sectionDesign.selectedIBeam.A_cm2;

  // Напряжения по краям сечения с учетом продольной силы N и изгибающего момента M_z:
  // При M > 0 верхние волокна сжаты (-), нижние растянуты (+)
  const sigmaAxial = A_cm2 > 0 ? (N_kN * 10) / A_cm2 : 0; // кН/см^2 * 10 = МПа
  const sigmaBend = Wz_cm3 > 0 ? (M_kNm * 1000) / Wz_cm3 : 0; // МПа

  return {
    x_m: roundClean(clampedX, 3),
    segmentIndex: seg.index,
    N_kN,
    Q_kN,
    M_kNm,
    stretchedFiber: getStretchedFiber(M_kNm),
    stressProfile: {
      sigmaTop_MPa: roundClean(sigmaAxial - sigmaBend, 2),
      sigmaBottom_MPa: roundClean(sigmaAxial + sigmaBend, 2),
      neutralAxisY_mm: 0,
    },
  };
}