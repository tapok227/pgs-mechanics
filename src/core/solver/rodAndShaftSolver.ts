import {
  SteppedRodProblemInput,
  TorsionShaftProblemInput,
} from '../../types/mechanics';

// ============================================================================
// 1. СОЛВЕР РАСТЯЖЕНИЯ-СЖАТИЯ СТУПЕНЧАТЫХ СТЕРЖНЕЙ
// ============================================================================

export interface SteppedRodSegmentResult {
  segmentId: string;
  label: string;
  xStart_m: number;
  xEnd_m: number;
  length_m: number;
  area_mm2: number;
  N_kN: number;
  sigma_MPa: number;
  deltaL_mm: number;
  uStart_mm: number; // Перемещение начала участка относительно заделки
  uEnd_mm: number;   // Перемещение конца участка относительно заделки
}

export interface SteppedRodSolverOutput {
  reactionWall_kN: number;
  segments: SteppedRodSegmentResult[];
  maxStressAbs_MPa: number;
  totalElongation_mm: number;
  maxDisplacementAbs_mm: number;
  isStrengthOk: boolean;
  isStiffnessOk: boolean;
  recalculatedBaseArea_mm2?: number; // Если требуется перерасчет по условию прочности/жесткости
}

export function solveSteppedRod(input: SteppedRodProblemInput): SteppedRodSolverOutput {
  const { fixedEnd, segments, axialLoads, allowableStress_MPa, allowableElongation_mm } = input;

  // Суммарная внешняя продольная нагрузка: Sum Fx = R_wall + Sum F_i = 0
  const sumExternalForces_kN = axialLoads.reduce((acc, f) => acc + f.force_kN, 0);
  const reactionWall_kN = -sumExternalForces_kN;

  // Вычисляем координаты границ ступеней слева направо
  let cursorX = 0;
  const geomSegments = segments.map((s) => {
    const xStart = cursorX;
    const xEnd = Number((cursorX + s.length_m).toFixed(6));
    cursorX = xEnd;
    return { ...s, xStart, xEnd };
  });
  const totalLength = cursorX;

  // Собираем все точки разрыва (границы ступеней + точки приложения осевых сил)
  const xPoints = new Set<number>([0, totalLength]);
  geomSegments.forEach((s) => {
    xPoints.add(s.xStart);
    xPoints.add(s.xEnd);
  });
  axialLoads.forEach((l) => xPoints.add(Number(l.x_m.toFixed(6))));
  const sortedX = Array.from(xPoints).sort((a, b) => a - b);

  const results: SteppedRodSegmentResult[] = [];

  for (let i = 0; i < sortedX.length - 1; i++) {
    const xStart = sortedX[i];
    const xEnd = sortedX[i + 1];
    const length_m = Number((xEnd - xStart).toFixed(6));
    if (length_m < 1e-6) continue;

    const midX = (xStart + xEnd) / 2;
    const parentSeg =
      geomSegments.find((g) => midX >= g.xStart - 1e-6 && midX <= g.xEnd + 1e-6) ??
      geomSegments[0];

    // Метод сечений: сумма сил со стороны свободного конца
    // Положительная сила N_i растягивает участок (направлена от сечения)
    let N_kN = 0;
    if (fixedEnd === 'left') {
      // Рассматриваем правую отсеченную часть (x_load >= xEnd):
      // Сила, направленная вправо (+), растягивает стержень (+N)
      for (const load of axialLoads) {
        if (load.x_m >= xEnd - 1e-6) {
          N_kN += load.force_kN;
        }
      }
    } else {
      // Заделка справа -> рассматриваем левую отсеченную часть (x_load <= xStart):
      // Сила, направленная влево (-), растягивает стержень (+N)
      for (const load of axialLoads) {
        if (load.x_m <= xStart + 1e-6) {
          N_kN -= load.force_kN;
        }
      }
    }

    // sigma [МПа] = N [кН] * 1000 [Н/кН] / A [мм^2]
    const sigma_MPa = Number(((N_kN * 1000) / parentSeg.area_mm2).toFixed(3));
    // deltaL [мм] = (N [Н] * L [мм]) / (E [МПа] * A [мм^2])
    const deltaL_mm = Number(
      (((N_kN * 1000) * (length_m * 1000)) / (parentSeg.E_MPa * parentSeg.area_mm2)).toFixed(5)
    );

    results.push({
      segmentId: `${parentSeg.id}_${i + 1}`,
      label: `Участок ${i + 1}`,
      xStart_m: xStart,
      xEnd_m: xEnd,
      length_m,
      area_mm2: parentSeg.area_mm2,
      N_kN: Number(N_kN.toFixed(4)),
      sigma_MPa,
      deltaL_mm,
      uStart_mm: 0,
      uEnd_mm: 0,
    });
  }

  // Накопление перемещений u(x) от неподвижной заделки
  if (fixedEnd === 'left') {
    let accU = 0;
    for (const seg of results) {
      seg.uStart_mm = Number(accU.toFixed(5));
      accU += seg.deltaL_mm;
      seg.uEnd_mm = Number(accU.toFixed(5));
    }
  } else {
    let accU = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      results[i].uEnd_mm = Number(accU.toFixed(5));
      accU += results[i].deltaL_mm;
      results[i].uStart_mm = Number(accU.toFixed(5));
    }
  }

  const maxStressAbs_MPa = Math.max(...results.map((r) => Math.abs(r.sigma_MPa)), 0);
  const totalElongation_mm = Number(
    results.reduce((acc, r) => acc + r.deltaL_mm, 0).toFixed(5)
  );
  const maxDisplacementAbs_mm = Math.max(
    ...results.map((r) => Math.max(Math.abs(r.uStart_mm), Math.abs(r.uEnd_mm))),
    0
  );

  const isStrengthOk = maxStressAbs_MPa <= allowableStress_MPa;
  const isStiffnessOk = maxDisplacementAbs_mm <= allowableElongation_mm;

  let recalculatedBaseArea_mm2: number | undefined;
  if (!isStrengthOk || !isStiffnessOk) {
    const scaleStrength = maxStressAbs_MPa / allowableStress_MPa;
    const scaleStiffness =
      allowableElongation_mm > 0 ? maxDisplacementAbs_mm / allowableElongation_mm : 1;
    const requiredMultiplier = Math.max(scaleStrength, scaleStiffness);
    recalculatedBaseArea_mm2 = Math.ceil(input.baseArea_mm2 * requiredMultiplier);
  }

  return {
    reactionWall_kN,
    segments: results,
    maxStressAbs_MPa,
    totalElongation_mm,
    maxDisplacementAbs_mm,
    isStrengthOk,
    isStiffnessOk,
    recalculatedBaseArea_mm2,
  };
}

// ============================================================================
// 2. СОЛВЕР КРУЧЕНИЯ СТУПЕНЧАТЫХ ВАЛОВ (С УЧЕТОМ СЕЧЕНИЙ КРУГА, КОЛЬЦА И ПРЯМОУГОЛЬНИКА)
// ============================================================================

/**
 * Таблица коэффициентов Сен-Венана для кручения прямоугольного бруса (соотношение h/b)
 */
const RECT_TORSION_TABLE: Array<{ ratio: number; alpha: number; beta: number }> = [
  { ratio: 1.0, alpha: 0.141, beta: 0.208 },
  { ratio: 1.2, alpha: 0.166, beta: 0.219 },
  { ratio: 1.4, alpha: 0.187, beta: 0.227 },
  { ratio: 1.5, alpha: 0.196, beta: 0.231 },
  { ratio: 1.6, alpha: 0.204, beta: 0.234 },
  { ratio: 1.7, alpha: 0.211, beta: 0.238 },
  { ratio: 1.8, alpha: 0.217, beta: 0.240 },
  { ratio: 2.0, alpha: 0.229, beta: 0.246 },
  { ratio: 2.2, alpha: 0.238, beta: 0.251 },
  { ratio: 2.5, alpha: 0.249, beta: 0.258 },
  { ratio: 3.0, alpha: 0.263, beta: 0.267 },
  { ratio: 4.0, alpha: 0.281, beta: 0.282 },
  { ratio: 5.0, alpha: 0.291, beta: 0.291 },
  { ratio: 10.0, alpha: 0.312, beta: 0.312 },
];

export function computeTorsionSectionProps(
  section: TorsionShaftProblemInput['segments'][number]['section']
): { Ip_cm4: number; Wp_cm3: number } {
  if (section.type === 'solid_circle') {
    const D_cm = section.D_mm / 10;
    const Ip_cm4 = (Math.PI * Math.pow(D_cm, 4)) / 32;
    const Wp_cm3 = (Math.PI * Math.pow(D_cm, 3)) / 16;
    return { Ip_cm4, Wp_cm3 };
  }
  if (section.type === 'hollow_circle') {
    const D_cm = section.D_mm / 10;
    const c = section.d_mm / section.D_mm;
    const factor = 1 - Math.pow(c, 4);
    const Ip_cm4 = ((Math.PI * Math.pow(D_cm, 4)) / 32) * factor;
    const Wp_cm3 = ((Math.PI * Math.pow(D_cm, 3)) / 16) * factor;
    return { Ip_cm4, Wp_cm3 };
  }
  // Прямоугольное сечение: I_p = alpha * h * b^3, W_p = beta * h * b^2 (где h >= b)
  const h_cm = Math.max(section.h_mm, section.b_mm) / 10;
  const b_cm = Math.min(section.h_mm, section.b_mm) / 10;
  const ratio = h_cm / b_cm;

  let alpha = 0.333;
  let beta = 0.333;
  if (ratio <= RECT_TORSION_TABLE[0].ratio) {
    alpha = RECT_TORSION_TABLE[0].alpha;
    beta = RECT_TORSION_TABLE[0].beta;
  } else {
    for (let i = 0; i < RECT_TORSION_TABLE.length - 1; i++) {
      const p1 = RECT_TORSION_TABLE[i];
      const p2 = RECT_TORSION_TABLE[i + 1];
      if (ratio >= p1.ratio && ratio <= p2.ratio) {
        const t = (ratio - p1.ratio) / (p2.ratio - p1.ratio);
        alpha = p1.alpha + t * (p2.alpha - p1.alpha);
        beta = p1.beta + t * (p2.beta - p1.beta);
        break;
      }
    }
  }

  const Ip_cm4 = alpha * h_cm * Math.pow(b_cm, 3);
  const Wp_cm3 = beta * h_cm * Math.pow(b_cm, 2);
  return { Ip_cm4, Wp_cm3 };
}

export interface TorsionSegmentResult {
  segmentId: string;
  xStart_m: number;
  xEnd_m: number;
  length_m: number;
  Mk_kNm: number;
  Ip_cm4: number;
  Wp_cm3: number;
  tauMax_MPa: number;
  deltaPhi_rad: number;
  phiStart_deg: number;
  phiEnd_deg: number;
}

export interface TorsionSolverOutput {
  reactionMomentWall_kNm: number;
  segments: TorsionSegmentResult[];
  maxShearStress_MPa: number;
  maxTwistAngleAbs_deg: number;
}

export function solveTorsionShaft(input: TorsionShaftProblemInput): TorsionSolverOutput {
  const { fixedEnd, segments, moments } = input;
  const reactionMomentWall_kNm = -moments.reduce((acc, m) => acc + m.moment_kNm, 0);

  let cursorX = 0;
  const geomSegments = segments.map((s) => {
    const xStart = cursorX;
    const xEnd = Number((cursorX + s.length_m).toFixed(6));
    cursorX = xEnd;
    return { ...s, xStart, xEnd };
  });
  const totalLength = cursorX;

  const xPoints = new Set<number>([0, totalLength]);
  geomSegments.forEach((s) => {
    xPoints.add(s.xStart);
    xPoints.add(s.xEnd);
  });
  moments.forEach((m) => xPoints.add(Number(m.x_m.toFixed(6))));
  const sortedX = Array.from(xPoints).sort((a, b) => a - b);

  const results: TorsionSegmentResult[] = [];

  for (let i = 0; i < sortedX.length - 1; i++) {
    const xStart = sortedX[i];
    const xEnd = sortedX[i + 1];
    const length_m = Number((xEnd - xStart).toFixed(6));
    if (length_m < 1e-6) continue;

    const midX = (xStart + xEnd) / 2;
    const parentSeg =
      geomSegments.find((g) => midX >= g.xStart - 1e-6 && midX <= g.xEnd + 1e-6) ??
      geomSegments[0];

    let Mk_kNm = 0;
    if (fixedEnd === 'left') {
      for (const m of moments) {
        if (m.x_m >= xEnd - 1e-6) Mk_kNm += m.moment_kNm;
      }
    } else {
      for (const m of moments) {
        if (m.x_m <= xStart + 1e-6) Mk_kNm -= m.moment_kNm;
      }
    }

    const { Ip_cm4, Wp_cm3 } = computeTorsionSectionProps(parentSeg.section);
    // tau_max [МПа] = |M_k| [кН*м] * 1000 / W_p [см^3]
    const tauMax_MPa = Number(((Math.abs(Mk_kNm) * 1000) / Wp_cm3).toFixed(2));
    // deltaPhi [рад] = (M_k [Н*мм] * L [мм]) / (G [Н/мм^2] * I_p [мм^4])
    const deltaPhi_rad =
      ((Mk_kNm * 1e6) * (length_m * 1000)) / (parentSeg.G_MPa * (Ip_cm4 * 1e4));

    results.push({
      segmentId: `${parentSeg.id}_${i + 1}`,
      xStart_m: xStart,
      xEnd_m: xEnd,
      length_m,
      Mk_kNm: Number(Mk_kNm.toFixed(4)),
      Ip_cm4: Number(Ip_cm4.toFixed(3)),
      Wp_cm3: Number(Wp_cm3.toFixed(3)),
      tauMax_MPa,
      deltaPhi_rad,
      phiStart_deg: 0,
      phiEnd_deg: 0,
    });
  }

  const radToDeg = 180 / Math.PI;
  if (fixedEnd === 'left') {
    let accRad = 0;
    for (const seg of results) {
      seg.phiStart_deg = Number((accRad * radToDeg).toFixed(4));
      accRad += seg.deltaPhi_rad;
      seg.phiEnd_deg = Number((accRad * radToDeg).toFixed(4));
    }
  } else {
    let accRad = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      results[i].phiEnd_deg = Number((accRad * radToDeg).toFixed(4));
      accRad += results[i].deltaPhi_rad;
      results[i].phiStart_deg = Number((accRad * radToDeg).toFixed(4));
    }
  }

  return {
    reactionMomentWall_kNm,
    segments: results,
    maxShearStress_MPa: Math.max(...results.map((r) => r.tauMax_MPa), 0),
    maxTwistAngleAbs_deg: Math.max(
      ...results.map((r) => Math.max(Math.abs(r.phiStart_deg), Math.abs(r.phiEnd_deg))),
      0
    ),
  };
}

// ============================================================================
// 3. МОДУЛЬ ГЕОМЕТРИЧЕСКИХ ХАРАКТЕРИСТИК СОСТАВНЫХ СЕЧЕНИЙ
// ============================================================================

export interface CompositePartInput {
  id: string;
  label: string;
  A_cm2: number;      // Площадь элемента (отрицательная для вырезов/отверстий)
  z_c_cm: number;     // Координата ЦТ элемента по горизонтальной оси Oz, см
  y_c_cm: number;     // Координата ЦТ элемента по вертикальной оси Oy, см
  Iz_own_cm4: number; // Собственный осевой момент инерции относительно оси z_i, см^4
  Iy_own_cm4: number; // Собственный осевой момент инерции относительно оси y_i, см^4
  Izy_own_cm4: number;// Собственный центробежный момент инерции, см^4
}

export interface CompositeSectionOutput {
  totalArea_cm2: number;
  Sz_cm3: number;
  Sy_cm3: number;
  zc_cm: number;
  yc_cm: number;
  Iz_central_cm4: number;
  Iy_central_cm4: number;
  Izy_central_cm4: number;
  alpha0_deg: number; // Угол поворота главных центральных осей, град
  Imax_cm4: number;
  Imin_cm4: number;
}

export function solveCompositeSection(parts: CompositePartInput[]): CompositeSectionOutput {
  let totalArea_cm2 = 0;
  let Sz_cm3 = 0;
  let Sy_cm3 = 0;

  for (const p of parts) {
    totalArea_cm2 += p.A_cm2;
    Sz_cm3 += p.A_cm2 * p.y_c_cm;
    Sy_cm3 += p.A_cm2 * p.z_c_cm;
  }

  const zc_cm = totalArea_cm2 !== 0 ? Sy_cm3 / totalArea_cm2 : 0;
  const yc_cm = totalArea_cm2 !== 0 ? Sz_cm3 / totalArea_cm2 : 0;

  // Перенос осей по теореме Гюйгенса-Штейнера к центральным осям Z_c, Y_c
  let Iz_central_cm4 = 0;
  let Iy_central_cm4 = 0;
  let Izy_central_cm4 = 0;

  for (const p of parts) {
    const a_y = p.y_c_cm - yc_cm;
    const b_z = p.z_c_cm - zc_cm;
    Iz_central_cm4 += p.Iz_own_cm4 + p.A_cm2 * a_y * a_y;
    Iy_central_cm4 += p.Iy_own_cm4 + p.A_cm2 * b_z * b_z;
    Izy_central_cm4 += p.Izy_own_cm4 + p.A_cm2 * a_y * b_z;
  }

  // Угол наклона главных центральных осей: tg(2*alpha_0) = 2 * I_zy / (I_z - I_y)
  const alpha0_rad = 0.5 * Math.atan2(2 * Izy_central_cm4, Iz_central_cm4 - Iy_central_cm4);
  const alpha0_deg = Number(((alpha0_rad * 180) / Math.PI).toFixed(2));

  const halfSum = 0.5 * (Iz_central_cm4 + Iy_central_cm4);
  const radius = 0.5 * Math.hypot(Iz_central_cm4 - Iy_central_cm4, 2 * Izy_central_cm4);

  return {
    totalArea_cm2: Number(totalArea_cm2.toFixed(3)),
    Sz_cm3: Number(Sz_cm3.toFixed(3)),
    Sy_cm3: Number(Sy_cm3.toFixed(3)),
    zc_cm: Number(zc_cm.toFixed(3)),
    yc_cm: Number(yc_cm.toFixed(3)),
    Iz_central_cm4: Number(Iz_central_cm4.toFixed(3)),
    Iy_central_cm4: Number(Iy_central_cm4.toFixed(3)),
    Izy_central_cm4: Number(Izy_central_cm4.toFixed(3)),
    alpha0_deg,
    Imax_cm4: Number((halfSum + radius).toFixed(3)),
    Imin_cm4: Number((halfSum - radius).toFixed(3)),
  };
}