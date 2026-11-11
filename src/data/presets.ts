import {
  BeamProblemInput,
  SteppedRodProblemInput,
  TorsionShaftProblemInput,
} from '../types/mechanics';
import { CompositePartInput } from '../core/solver/rodAndShaftSolver';
import { FrameProblemInput } from '@/types/frame';
export interface BeamPresetItem {
  id: string;
  title: string;
  sourceNote: string;
  data: BeamProblemInput;
}

export const BEAM_PRESETS: BeamPresetItem[] = [
  {
    id: 'sheet-inclined-force',
    title: 'Двухопорная балка с наклонной силой F = 60 кН (α = 40°), M = 45 кН·м и q = 18 кН/м',
    sourceNote: 'Расчетно-графическое задание (a = 2 м, b = 3 м, L = 5 м)',
    data: {
      length: 5,
      E_MPa: 2e5,
      allowableStress_MPa: 160,
      supports: [
        { id: 'sup-A', label: 'A', x: 0, type: 'pinned', surfaceAngleDeg: 0 },
        { id: 'sup-C', label: 'C', x: 5, type: 'roller', surfaceAngleDeg: 0 },
      ],
      loads: [
        {
          id: 'load-M',
          kind: 'point_moment',
          label: 'M',
          x: 0,
          magnitude: 45,
          direction: 'ccw',
        },
        {
          id: 'load-F',
          kind: 'point_force',
          label: 'F',
          x: 2,
          magnitude: 60,
          angleDeg: 140, // Вверх-влево под углом 40° к оси балки
        },
        {
          id: 'load-q',
          kind: 'distributed',
          label: 'q',
          xStart: 2,
          xEnd: 5,
          qStart: 18,
          qEnd: 18,
        },
      ],
    },
  },
  {
    id: 'hohlov-overhang-beam',
    title: 'Балка с консолью (q = 4 кН/м, M = 6 кН·м)',
    sourceNote: 'Учебное пособие В.А. Хохлова, Глава 7, рис. 7.15 (a = 1 м, L = 4 м)',
    data: {
      length: 4,
      E_MPa: 2e5,
      allowableStress_MPa: 160,
      supports: [
        { id: 'sup-B', label: 'B', x: 1, type: 'pinned', surfaceAngleDeg: 0 },
        { id: 'sup-D', label: 'D', x: 4, type: 'roller', surfaceAngleDeg: 0 },
      ],
      loads: [
        {
          id: 'load-q1',
          kind: 'distributed',
          label: 'q',
          xStart: 0,
          xEnd: 2,
          qStart: 4,
          qEnd: 4,
        },
        {
          id: 'load-M1',
          kind: 'point_moment',
          label: 'M',
          x: 1,
          magnitude: 6,
          direction: 'cw',
        },
      ],
    },
  },
  {
    id: 'coursework-cantilever-v0',
    title: 'Консольная балка: Вариант 0 (a = 2 м, L = 20 м)',
    sourceNote: 'Курсовая работа по сопромату, Задача 3 (Изгиб), Схема вариант 0',
    data: {
      length: 20,
      E_MPa: 2e5,
      allowableStress_MPa: 160,
      supports: [
        { id: 'sup-A', label: 'A', x: 0, type: 'fixed' },
      ],
      loads: [
        {
          id: 'load-P1',
          kind: 'point_force',
          label: 'P_1',
          x: 6,
          magnitude: 40,
          angleDeg: 90, // Вертикально вверх
        },
        {
          id: 'load-q',
          kind: 'distributed',
          label: 'q',
          xStart: 6,
          xEnd: 10,
          qStart: 10,
          qEnd: 10,
        },
        {
          id: 'load-P2',
          kind: 'point_force',
          label: 'P_2',
          x: 16,
          magnitude: 30,
          angleDeg: -90, // Вертикально вниз
        },
        {
          id: 'load-M',
          kind: 'point_moment',
          label: 'M',
          x: 20,
          magnitude: 10,
          direction: 'ccw',
        },
      ],
    },
  },
];

export const DEFAULT_STEPPED_ROD_PRESET: SteppedRodProblemInput = {
  fixedEnd: 'right',
  baseArea_mm2: 800, // A = 8 см^2 = 800 мм^2 (задача с аудиторной доски)
  allowableStress_MPa: 160,
  allowableElongation_mm: 2.5,
  segments: [
    { id: 'rod-1', label: 'Участок a (1A)', length_m: 0.72, areaMultiplier: 1, area_mm2: 800, E_MPa: 2e5 },
    { id: 'rod-2', label: 'Участок b (1A)', length_m: 0.56, areaMultiplier: 1, area_mm2: 800, E_MPa: 2e5 },
    { id: 'rod-3', label: 'Участок c (2A)', length_m: 0.64, areaMultiplier: 2, area_mm2: 1600, E_MPa: 2e5 },
  ],
  axialLoads: [
    { id: 'p1', label: 'P_1', x_m: 0, force_kN: -125 },   // Свободный левый конец, влево 125 кН
    { id: 'p2', label: 'P_2', x_m: 0.72, force_kN: 170 }, // Вправо 170 кН
    { id: 'p3', label: 'P_3', x_m: 1.28, force_kN: 115 }, // Вправо 115 кН
  ],
};

export const DEFAULT_TORSION_PRESET: TorsionShaftProblemInput = {
  fixedEnd: 'left',
  allowableShearStress_MPa: 70,
  allowableTwistDegPerMeter: 2.0,
  segments: [
    {
      id: 'shaft-1',
      label: 'Ступень 1 (2a, прямоугольник)',
      length_m: 4,
      G_MPa: 8e4,
      section: { type: 'rectangle', b_mm: 40, h_mm: 40 },
    },
    {
      id: 'shaft-2',
      label: 'Ступень 2 (2a, сплошной круг D)',
      length_m: 4,
      G_MPa: 8e4,
      section: { type: 'solid_circle', D_mm: 72 },
    },
    {
      id: 'shaft-3',
      label: 'Ступень 3 (3a, кольцо d/D)',
      length_m: 6,
      G_MPa: 8e4,
      section: { type: 'hollow_circle', d_mm: 40, D_mm: 72 },
    },
  ],
  moments: [
    { id: 'm2', label: 'M_2', x_m: 4, moment_kNm: 20 },
    { id: 'm4', label: 'M_4', x_m: 6, moment_kNm: -38 },
    { id: 'm3', label: 'M_3', x_m: 8, moment_kNm: 24 },
    { id: 'm1', label: 'M_1', x_m: 14, moment_kNm: -11 },
  ],
};

export const DEFAULT_COMPOSITE_SECTION_PRESET: CompositePartInput[] = [
  {
    id: 'part-1',
    label: '1 — Лист 200×20 мм',
    A_cm2: 40.0,
    z_c_cm: 16.3,
    y_c_cm: 31.0,
    Iz_own_cm4: 13.3,
    Iy_own_cm4: 1333.0,
    Izy_own_cm4: 0,
  },
  {
    id: 'part-2',
    label: '2 — Швеллер №30 (ГОСТ 8240-89)',
    A_cm2: 40.5,
    z_c_cm: 8.82,
    y_c_cm: 15.0,
    Iz_own_cm4: 5810.0,
    Iy_own_cm4: 327.0,
    Izy_own_cm4: 0,
  },
  {
    id: 'part-3',
    label: '3 — Неравнополочный уголок 100×63×10 (ГОСТ 8510-86)',
    A_cm2: 15.5,
    z_c_cm: 4.72,
    y_c_cm: 3.4,
    Iz_own_cm4: 154.0,
    Iy_own_cm4: 47.1,
    Izy_own_cm4: 49.0,
  },
];
export const DEFAULT_FRAME_PRESET: FrameProblemInput = {
  title: 'Составная рама с врезным шарниром C и наклонной ногой CB (из задания)',
  allowableStress_MPa: 160,
  nodes: [
    { id: 'n_left', label: 'D (консоль)', x: 0, y: 4, support: 'none' },
    { id: 'n_joint', label: 'K (узел)', x: 3, y: 4, support: 'none' },
    { id: 'n_A', label: 'A', x: 3, y: 0, support: 'pinned' },
    { id: 'n_C', label: 'C (шарнир)', x: 6, y: 4, support: 'none', isHinge: true },
    { id: 'n_B', label: 'B', x: 8, y: 1, support: 'pinned' },
  ],
  elements: [
    {
      id: 'el_DK',
      label: 'Консоль DK (3 м)',
      nodeStartId: 'n_left',
      nodeEndId: 'n_joint',
      E_MPa: 2e5,
      A_cm2: 40,
      Iz_cm4: 3500,
    },
    {
      id: 'el_AK',
      label: 'Стойка AK (4 м)',
      nodeStartId: 'n_A',
      nodeEndId: 'n_joint',
      E_MPa: 2e5,
      A_cm2: 40,
      Iz_cm4: 3500,
    },
    {
      id: 'el_KC',
      label: 'Ригель KC (3 м)',
      nodeStartId: 'n_joint',
      nodeEndId: 'n_C',
      E_MPa: 2e5,
      A_cm2: 40,
      Iz_cm4: 3500,
      releaseEnd: true,
    },
    {
      id: 'el_CB',
      label: 'Наклонный стержень CB (3.61 м)',
      nodeStartId: 'n_C',
      nodeEndId: 'n_B',
      E_MPa: 2e5,
      A_cm2: 40,
      Iz_cm4: 3500,
      releaseStart: true,
    },
  ],
  loads: [
    {
      id: 'fl_P1',
      kind: 'nodal_force',
      nodeId: 'n_left',
      label: 'P_1',
      magnitude_kN: 20,
      angleDeg: -120, // Сила P1 под углом alpha = 60° к горизонту влево-вниз
    },
    {
      id: 'fl_q',
      kind: 'member_distributed',
      elementId: 'el_AK',
      label: 'q',
      qStart_kNm: 10,
      qEnd_kNm: 10,
      direction: 'global_x', // Горизонтальная нагрузка q вправо на стойку A (4 м)
    },
    {
      id: 'fl_M',
      kind: 'member_moment',
      elementId: 'el_CB',
      label: 'M',
      tPosition: 0.25,
      moment_kNm: -15, // Момент M по часовой стрелке на стержне CB
    },
    {
      id: 'fl_P2',
      kind: 'member_point_force',
      elementId: 'el_CB',
      label: 'P_2',
      tPosition: 0.5, // Посередине наклонного участка CB (1 м и 1 м по горизонтали)
      magnitude_kN: -18, // Перпендикулярно наклонному стержню CB
    },
  ],
};