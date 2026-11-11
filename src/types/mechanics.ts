// ============================================================================
// 1. БАЗОВЫЕ ЕДИНИЦЫ И ГЕОМЕТРИЧЕСКИЕ ПРИМИТИВЫ
// ============================================================================

export type ProblemType = 'beam' | 'stepped_rod' | 'torsion_shaft' | 'cross_section';

export interface Point2D {
  x: number; // м
  y: number; // м
}

/**
 * Полином до 3-й степени включительно на локальном участке x_local in [0, length]:
 * P(x) = c0 + c1*x + c2*x^2 + c3*x^3
 */
export interface PolynomialCoeffs {
  c0: number;
  c1: number;
  c2: number;
  c3: number;
}

// ============================================================================
// 2. ОПОРЫ (СВЯЗИ) И ВРЕЗНЫЕ ШАРНИРЫ
// ============================================================================

export type SupportType =
  | 'pinned'          // Шарнирно-неподвижная опора (2 реакции: Rx, Ry)
  | 'roller'          // Шарнирно-подвижная опора (1 реакция R под углом к нормали)
  | 'fixed'           // Жесткая заделка (3 реакции: Rx, Ry, M)
  | 'guided'          // Скользящая заделка (2 реакции: R, M)
  | 'internal_hinge'; // Промежуточный врезной шарнир (M_hinge = 0)

export interface SupportNode {
  id: string;
  label: string;       // Например: "A", "B", "C"
  x: number;           // Координата по оси балки, м
  y?: number;          // Для плоских рам, м (по умолчанию 0)
  type: SupportType;
  /**
   * Угол наклона опорной площадки для подвижной опоры (в градусах к горизонту).
   * Например, 0° — горизонтальная опора (реакция вертикальна, 90°),
   * 45° или 60° — наклонная катковая опора из задач статики.
   */
  surfaceAngleDeg?: number;
}

// ============================================================================
// 3. ВНЕШНИЕ НАГРУЗКИ (ДЛЯ БАЛОК И РАМ)
// ============================================================================

export interface PointForceLoad {
  id: string;
  kind: 'point_force';
  label: string;       // Например: "F_1", "P"
  x: number;           // Точка приложения, м
  magnitude: number;   // Модуль силы F >= 0, кН
  /**
   * Угол наклона вектора силы к положительному направлению оси Ox в градусах:
   * -90° — вертикально вниз, +90° — вертикально вверх,
   * произвольный угол alpha (например, 45°, 60°, -135°).
   */
  angleDeg: number;
}

export interface PointMomentLoad {
  id: string;
  kind: 'point_moment';
  label: string;       // Например: "M_1", "M"
  x: number;           // Точка приложения, м
  /**
   * Модуль момента пары сил M >= 0, кН*м
   */
  magnitude: number;
  /**
   * Направление вращения:
   * 'ccw' (против часовой стрелки, в статике +)
   * 'cw'  (по часовой стрелке, в статике -)
   */
  direction: 'ccw' | 'cw';
}

export interface DistributedLoad {
  id: string;
  kind: 'distributed';
  label: string;       // Например: "q", "q_max"
  xStart: number;      // Начало участка, м
  xEnd: number;        // Конец участка, м
  /**
   * Интенсивность в начале и конце участка, кН/м.
   * Положительное значение q > 0 направлено СВЕРХУ ВНИЗ (стандарт ПГС),
   * отрицательное q < 0 — СНИЗУ ВВЕРХ.
   * Равномерная: qStart === qEnd.
   * Треугольная: qStart === 0 или qEnd === 0.
   * Трапециевидная: qStart !== qEnd.
   */
  qStart: number;
  qEnd: number;
}

export type BeamLoad = PointForceLoad | PointMomentLoad | DistributedLoad;

// ============================================================================
// 4. СОРТАМЕНТ И ГЕОМЕТРИЯ ПОПЕРЕЧНЫХ СЕЧЕНИЙ
// ============================================================================

export type CrossSectionShape =
  | { type: 'solid_circle'; d_mm: number }
  | { type: 'hollow_circle'; d_inner_mm: number; D_outer_mm: number }
  | { type: 'rectangle'; b_mm: number; h_mm: number }
  | { type: 'gost_ibeam'; profileNumber: string }     // ГОСТ 8239-89
  | { type: 'gost_channel'; profileNumber: string };  // ГОСТ 8240-89

export interface CrossSectionProperties {
  shape: CrossSectionShape;
  A_cm2: number;      // Площадь сечения, см^2
  Iz_cm4: number;     // Осевой момент инерции относительно главной оси z, см^4
  Iy_cm4: number;     // Осевой момент инерции относительно оси y, см^4
  Wz_cm3: number;     // Момент сопротивления изгибу, см^3
  Ip_cm4: number;     // Полярный момент инерции (кручение), см^4
  Wp_cm3: number;     // Полярный момент сопротивления (кручение), см^3
  halfHeight_mm: number; // Расстояние до крайнего волокна y_max, мм
}

// ============================================================================
// 5. ВХОДНЫЕ МОДЕЛИ ЗАДАЧ
// ============================================================================

export interface BeamProblemInput {
  length: number;              // Полная длина балки L, м
  supports: SupportNode[];     // Опоры и врезные шарниры
  loads: BeamLoad[];           // Внешние нагрузки
  E_MPa: number;               // Модуль Юнга, МПа (по умолчанию 2e5 для стали)
  allowableStress_MPa: number; // Допускаемое напряжение [sigma], МПа (например 160)
  crossSection?: CrossSectionShape;
}

export interface SteppedRodSegmentInput {
  id: string;
  label: string;
  length_m: number;            // Длина ступени l_i, м
  areaMultiplier?: number;     // Коэффициент площади (1A, 2A, 3A)
  area_mm2: number;            // Фактическая площадь A_i, мм^2
  E_MPa: number;               // Модуль упругости материала ступени E_i, МПа
  crossSection?: CrossSectionShape;
}

export interface AxialForceNodeLoad {
  id: string;
  label: string;               // "P_1", "P_2", "P_3"
  x_m: number;                 // Координата приложения (от левого края), м
  force_kN: number;            // Проекция на ось стержня (+ вправо, - влево), кН
}

export interface SteppedRodProblemInput {
  fixedEnd: 'left' | 'right';
  baseArea_mm2: number;        // Базовая площадь A, мм^2
  segments: SteppedRodSegmentInput[];
  axialLoads: AxialForceNodeLoad[];
  allowableStress_MPa: number; // [sigma], МПа
  allowableElongation_mm: number; // [Delta l], мм
}

export interface TorsionShaftSegmentInput {
  id: string;
  label: string;
  length_m: number;
  G_MPa: number;               // Модуль сдвига G, МПа (8e4 для стали)
  section:
    | { type: 'solid_circle'; D_mm: number }
    | { type: 'hollow_circle'; d_mm: number; D_mm: number }
    | { type: 'rectangle'; b_mm: number; h_mm: number };
}

export interface TorsionMomentNodeLoad {
  id: string;
  label: string;               // "M_1", "M_2", "M_3", "M_4"
  x_m: number;
  moment_kNm: number;          // + против часовой стрелки со стороны свободного конца
}

export interface TorsionShaftProblemInput {
  fixedEnd: 'left' | 'right';
  segments: TorsionShaftSegmentInput[];
  moments: TorsionMomentNodeLoad[];
  allowableShearStress_MPa: number; // [tau], МПа
  allowableTwistDegPerMeter?: number; // [theta], град/м
}

// ============================================================================
// 6. СТРУКТУРЫ РЕЗУЛЬТАТОВ РАСЧЕТА (АКАДЕМИЧЕСКИЙ ВЫВОД И ВИЗУАЛИЗАЦИЯ)
// ============================================================================

export interface SupportReactionResult {
  supportId: string;
  supportLabel: string;
  x: number;
  Rx_kN: number;               // Горизонтальная составляющая реакции, кН
  Ry_kN: number;               // Вертикальная составляющая реакции, кН
  R_total_kN: number;          // Полный модуль реакции, кН
  M_kNm: number;               // Реактивный момент в заделке (+ против ч.с.), кН*м
}

export interface FBDForceReplacement {
  sourceLoadId: string;
  label: string;
  xApplication: number;
  Fx_kN: number;
  Fy_kN: number;
  descriptionKatex: string;
}

export interface StaticsEquilibriumLog {
  fbdReplacements: FBDForceReplacement[];
  sumFxKatex: string;
  sumFyKatex: string;
  sumMKatex: string[];
  verificationEquationKatex: string;
  verificationResidual: number; // Должен быть ~ 0 (погрешность < 1e-9)
}

export type StretchedFiberSide = 'bottom' | 'top' | 'none';

export interface BeamSegmentAnalysis {
  index: number;               // Номер участка (1, 2, ...)
  xStart: number;              // Глобальная координата начала участка, м
  xEnd: number;                // Глобальная координата конца участка, м
  length: number;              // Длина участка l_i, м
  /**
   * Полиномы от локальной координаты x_i in [0, length]
   */
  N_poly: PolynomialCoeffs;
  Q_poly: PolynomialCoeffs;
  M_poly: PolynomialCoeffs;

  // Граничные значения
  N_start: number;
  N_end: number;
  Q_start: number;
  Q_end: number;
  M_start: number;
  M_end: number;

  // Растянутые волокна в начале и конце участка (для правила ПГС)
  stretchedStart: StretchedFiberSide;
  stretchedEnd: StretchedFiberSide;

  // Экстремумы на участке (если Q(x_0) = 0 внутри интервала (0, length))
  localExtrema: Array<{
    xLocal: number;
    xGlobal: number;
    M_value: number;
    stretchedFiber: StretchedFiberSide;
  }>;

  // Формулы для академического вывода KaTeX
  N_formulaKatex: string;
  Q_formulaKatex: string;
  M_formulaKatex: string;
}

export interface SectionSelectionResult {
  M_max_abs_kNm: number;
  Q_max_abs_kN: number;
  x_dangerous_m: number;
  Wz_required_cm3: number;
  selectedIBeam: {
    profileNumber: string;
    Wz_cm3: number;
    Iz_cm4: number;
    A_cm2: number;
    actualStress_MPa: number;
    utilizationPercent: number; // % загрузки сечения
    overstressPercent: number;  // + недогруз / - перегруз в %
  };
  selectedCircle: {
    diameter_mm: number;
    Wz_cm3: number;
    actualStress_MPa: number;
  };
}

/**
 * Мгновенный срез данных для синхронизированного визира (Crosshair Sync)
 */
export interface CrosshairSamplePoint {
  x_m: number;
  segmentIndex: number;
  N_kN: number;
  Q_kN: number;
  M_kNm: number;
  stretchedFiber: StretchedFiberSide;
  /**
   * Профиль нормальных напряжений по высоте сечения sigma(y), МПа
   */
  stressProfile: {
    sigmaTop_MPa: number;      // При y = +h/2
    sigmaBottom_MPa: number;   // При y = -h/2
    neutralAxisY_mm: number;   // Положение нейтральной линии
  };
}

export interface BeamSolverOutput {
  isStaticallyDeterminate: boolean;
  errorMessage?: string;
  reactions: SupportReactionResult[];
  staticsLog: StaticsEquilibriumLog;
  segments: BeamSegmentAnalysis[];
  criticalPointsX: number[];
  extremaAndMax: {
    N_max_abs: number;
    Q_max_abs: number;
    M_max_abs: number;
    x_M_max: number;
  };
  sectionDesign: SectionSelectionResult;
}