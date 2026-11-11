export type FrameSupportType = 'none' | 'pinned' | 'roller_x' | 'roller_y' | 'fixed';

export interface FrameNode {
  id: string;
  label: string;            // Например: "A", "B", "C", "D"
  x: number;                // Горизонтальная координата X, м
  y: number;                // Вертикальная координата Y, м
  support: FrameSupportType;
  isHinge?: boolean;        // Врезной шарнир в узле (M = 0, как шарнир C на схеме)
}

export interface FrameElement {
  id: string;
  label: string;
  nodeStartId: string;
  nodeEndId: string;
  E_MPa: number;            // Модуль упругости, МПа
  A_cm2: number;            // Площадь сечения, см^2
  Iz_cm4: number;           // Момент инерции, см^4
  releaseStart?: boolean;   // Локальный шарнир в начале стержня
  releaseEnd?: boolean;     // Локальный шарнир в конце стержня
}

export interface FrameNodalForceLoad {
  id: string;
  kind: 'nodal_force';
  nodeId: string;
  label: string;            // Например: "P_1"
  magnitude_kN: number;     // Модуль силы, кН
  angleDeg: number;         // Угол к оси +Ox в градусах (например, -120° для силы P1 под углом alpha=60°)
}

export interface FrameMemberDistributedLoad {
  id: string;
  kind: 'member_distributed';
  elementId: string;
  label: string;            // Например: "q"
  qStart_kNm: number;       // Интенсивность в начале стержня, кН/м
  qEnd_kNm: number;         // Интенсивность в конце стержня, кН/м
  direction: 'local_perp' | 'global_x' | 'global_y';
}

export interface FrameMemberPointForceLoad {
  id: string;
  kind: 'member_point_force';
  elementId: string;
  label: string;            // Например: "P_2"
  tPosition: number;        // Относительная координата вдоль стержня (0..1, 0.5 — середина стержня CB)
  magnitude_kN: number;     // Величина силы перпендикулярно стержню, кН
}

export interface FrameMemberMomentLoad {
  id: string;
  kind: 'member_moment';
  elementId: string;
  label: string;            // Например: "M"
  tPosition: number;        // Относительная координата вдоль стержня (0..1)
  moment_kNm: number;       // Момент, кН*м (+ против ЧС, - по ЧС)
}

export type FrameLoad =
  | FrameNodalForceLoad
  | FrameMemberDistributedLoad
  | FrameMemberPointForceLoad
  | FrameMemberMomentLoad;

export interface FrameProblemInput {
  title: string;
  nodes: FrameNode[];
  elements: FrameElement[];
  loads: FrameLoad[];
  allowableStress_MPa: number;
}

export interface FrameSamplePoint {
  s_m: number;              // Локальная координата вдоль стержня от 0 до L, м
  x_global: number;
  y_global: number;
  N_kN: number;             // Продольная сила, кН (+ растяжение)
  Q_kN: number;             // Поперечная сила, кН
  M_kNm: number;            // Изгибающий момент, кН*м
}

export interface FrameElementResult {
  elementId: string;
  label: string;
  length_m: number;
  angleDeg: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  samples: FrameSamplePoint[];
  N_start: number;
  N_end: number;
  Q_start: number;
  Q_end: number;
  M_start: number;
  M_end: number;
  M_max_abs: number;
}

export interface FrameReactionResult {
  nodeId: string;
  nodeLabel: string;
  x: number;
  y: number;
  Rx_kN: number;
  Ry_kN: number;
  M_kNm: number;
}

export interface FrameSolverOutput {
  isStable: boolean;
  errorMessage?: string;
  reactions: FrameReactionResult[];
  elementResults: FrameElementResult[];
  maxAbs: {
    N_kN: number;
    Q_kN: number;
    M_kNm: number;
  };
  equilibriumCheck: {
    sumFx_residual: number;
    sumFy_residual: number;
    sumM0_residual: number;
  };
}