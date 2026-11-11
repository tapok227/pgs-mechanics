import {
  FrameProblemInput,
  FrameSolverOutput,
  FrameElementResult,
  FrameReactionResult,
  FrameSamplePoint,
} from '@/types/frame';

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < 1e-10) return null;

    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-14) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

interface InternalSubNode {
  id: string;
  x: number;
  y: number;
  Fx: number;
  Fy: number;
  Mz: number;
  fixUx: boolean;
  fixUy: boolean;
  fixTheta: boolean;
}

interface InternalSubElement {
  parentElementId: string;
  n1Idx: number;
  n2Idx: number;
  sStart: number;
  sEnd: number;
  L: number;
  cos: number;
  sin: number;
  EA: number;
  EI: number;
  releaseStart: boolean;
  releaseEnd: boolean;
  qPerp1: number; // кН/м вдоль локальной оси +y
  qPerp2: number;
  qAxial1: number; // кН/м вдоль локальной оси +x
  qAxial2: number;
}

function computeLocalSubElementMatrices(sub: InternalSubElement) {
  const { L, EA, EI, releaseStart, releaseEnd, qPerp1, qPerp2, qAxial1, qAxial2 } = sub;
  const K = Array.from({ length: 6 }, () => Array(6).fill(0));

  // Осевая жесткость (индексы 0 и 3)
  const kAx = EA / L;
  K[0][0] = kAx;
  K[0][3] = -kAx;
  K[3][0] = -kAx;
  K[3][3] = kAx;

  // Изгибная жесткость со статической конденсацией шарниров (индексы 1, 2, 4, 5)
  const L2 = L * L;
  const L3 = L2 * L;

  // Базовые реакции защемленного стержня от трапециевидной поперечной нагрузки q(s)
  const Ry1_fixed = (L / 20) * (7 * qPerp1 + 3 * qPerp2);
  const M1_fixed = (L2 / 60) * (3 * qPerp1 + 2 * qPerp2);
  const Ry2_fixed = (L / 20) * (3 * qPerp1 + 7 * qPerp2);
  const M2_fixed = -(L2 / 60) * (2 * qPerp1 + 3 * qPerp2);

  let Ry1 = Ry1_fixed;
  let M1 = M1_fixed;
  let Ry2 = Ry2_fixed;
  let M2 = M2_fixed;

  if (!releaseStart && !releaseEnd) {
    const c = EI / L3;
    K[1][1] = 12 * c;
    K[1][2] = 6 * L * c;
    K[1][4] = -12 * c;
    K[1][5] = 6 * L * c;

    K[2][1] = 6 * L * c;
    K[2][2] = 4 * L2 * c;
    K[2][4] = -6 * L * c;
    K[2][5] = 2 * L2 * c;

    K[4][1] = -12 * c;
    K[4][2] = -6 * L * c;
    K[4][4] = 12 * c;
    K[4][5] = -6 * L * c;

    K[5][1] = 6 * L * c;
    K[5][2] = 2 * L2 * c;
    K[5][4] = -6 * L * c;
    K[5][5] = 4 * L2 * c;
  } else if (releaseStart && !releaseEnd) {
    // Шарнир в начале стержня (M1 = 0)
    const c = EI / L3;
    K[1][1] = 3 * c;
    K[1][4] = -3 * c;
    K[1][5] = 3 * L * c;

    K[4][1] = -3 * c;
    K[4][4] = 3 * c;
    K[4][5] = -3 * L * c;

    K[5][1] = 3 * L * c;
    K[5][4] = -3 * L * c;
    K[5][5] = 3 * L2 * c;

    Ry1 = Ry1_fixed - (1.5 / L) * M1_fixed;
    M1 = 0;
    Ry2 = Ry2_fixed + (1.5 / L) * M1_fixed;
    M2 = M2_fixed - 0.5 * M1_fixed;
  } else if (!releaseStart && releaseEnd) {
    // Шарнир в конце стержня (M2 = 0)
    const c = EI / L3;
    K[1][1] = 3 * c;
    K[1][2] = 3 * L * c;
    K[1][4] = -3 * c;

    K[2][1] = 3 * L * c;
    K[2][2] = 3 * L2 * c;
    K[2][4] = -3 * L * c;

    K[4][1] = -3 * c;
    K[4][2] = -3 * L * c;
    K[4][4] = 3 * c;

    Ry1 = Ry1_fixed - (1.5 / L) * M2_fixed;
    M1 = M1_fixed - 0.5 * M2_fixed;
    Ry2 = Ry2_fixed + (1.5 / L) * M2_fixed;
    M2 = 0;
  } else {
    // Шарниры по обоим концам (M1 = 0, M2 = 0)
    Ry1 = (L / 6) * (2 * qPerp1 + qPerp2);
    M1 = 0;
    Ry2 = (L / 6) * (qPerp1 + 2 * qPerp2);
    M2 = 0;
  }

  const Rx1 = (L / 6) * (2 * qAxial1 + qAxial2);
  const Rx2 = (L / 6) * (qAxial1 + 2 * qAxial2);

  // Вектор эквивалентных узловых нагрузок от распределенной нагрузки (в локальных осях)
  const fEqLocal = [Rx1, Ry1, M1, Rx2, Ry2, M2];

  // Матрица поворота T (6x6)
  const { cos, sin } = sub;
  const T = [
    [cos, sin, 0, 0, 0, 0],
    [-sin, cos, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, cos, sin, 0],
    [0, 0, 0, -sin, cos, 0],
    [0, 0, 0, 0, 0, 1],
  ];

  // K_global = T^T * K * T
  const KT = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 6; k++) KT[i][j] += K[i][k] * T[k][j];
    }
  }
  const KGlobal = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 6; k++) KGlobal[i][j] += T[k][i] * KT[k][j];
    }
  }

  // fEqGlobal = T^T * fEqLocal
  const fEqGlobal = Array(6).fill(0);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 6; k++) {
      fEqGlobal[i] += T[k][i] * fEqLocal[k];
    }
  }

  return { KLocal: K, fEqLocal, T, KGlobal, fEqGlobal };
}

export function solveFrameProblem(input: FrameProblemInput): FrameSolverOutput {
  const subNodes: InternalSubNode[] = [];
  const nodeMap = new Map<string, number>();

  // 1. Создаем основные узлы рамы
  for (const n of input.nodes) {
    const idx = subNodes.length;
    nodeMap.set(n.id, idx);
    subNodes.push({
      id: n.id,
      x: n.x,
      y: n.y,
      Fx: 0,
      Fy: 0,
      Mz: 0,
      fixUx: n.support === 'pinned' || n.support === 'roller_y' || n.support === 'fixed',
      fixUy: n.support === 'pinned' || n.support === 'roller_x' || n.support === 'fixed',
      fixTheta: n.support === 'fixed',
    });
  }

  // 2. Прикладываем узловые нагрузки (например, наклонную силу P1 под углом alpha)
  for (const load of input.loads) {
    if (load.kind === 'nodal_force') {
      const idx = nodeMap.get(load.nodeId);
      if (idx !== undefined) {
        const rad = (load.angleDeg * Math.PI) / 180;
        subNodes[idx].Fx += load.magnitude_kN * Math.cos(rad);
        subNodes[idx].Fy += load.magnitude_kN * Math.sin(rad);
      }
    }
  }

  // 3. Строим стержни и автоматически разбиваем их в точках приложения сил P2 и моментов M
  const subElements: InternalSubElement[] = [];

  for (const el of input.elements) {
    const nStartOrig = input.nodes.find((n) => n.id === el.nodeStartId);
    const nEndOrig = input.nodes.find((n) => n.id === el.nodeEndId);
    if (!nStartOrig || !nEndOrig) continue;

    const dx = nEndOrig.x - nStartOrig.x;
    const dy = nEndOrig.y - nStartOrig.y;
    const totalL = Math.hypot(dx, dy);
    if (totalL < 1e-6) continue;

    const cos = dx / totalL;
    const sin = dy / totalL;

    // Собираем все промежуточные точки t in (0, 1) на стержне
    const memberPointForces = input.loads.filter(
      (l) => l.kind === 'member_point_force' && l.elementId === el.id
    );
    const memberMoments = input.loads.filter(
      (l) => l.kind === 'member_moment' && l.elementId === el.id
    );
    const memberDistLoads = input.loads.filter(
      (l) => l.kind === 'member_distributed' && l.elementId === el.id
    );

    const tPoints = new Set<number>([0, 1]);
    for (const pf of memberPointForces) {
      if (pf.kind === 'member_point_force') {
        tPoints.add(Math.max(0.02, Math.min(0.98, Number(pf.tPosition.toFixed(4)))));
      }
    }
    for (const pm of memberMoments) {
      if (pm.kind === 'member_moment') {
        tPoints.add(Math.max(0.02, Math.min(0.98, Number(pm.tPosition.toFixed(4)))));
      }
    }

    const sortedT = Array.from(tPoints).sort((a, b) => a - b);
    const chainNodeIndices: number[] = [];

    for (let i = 0; i < sortedT.length; i++) {
      const t = sortedT[i];
      if (i === 0) {
        chainNodeIndices.push(nodeMap.get(el.nodeStartId)!);
      } else if (i === sortedT.length - 1) {
        chainNodeIndices.push(nodeMap.get(el.nodeEndId)!);
      } else {
        const subIdx = subNodes.length;
        const gx = nStartOrig.x + t * dx;
        const gy = nStartOrig.y + t * dy;
        let Fx = 0;
        let Fy = 0;
        let Mz = 0;

        // Силы перпендикулярно стержню в данной точке (например, P2 на CB)
        for (const pf of memberPointForces) {
          if (
            pf.kind === 'member_point_force' &&
            Math.abs(pf.tPosition - t) < 1e-3
          ) {
            // Локальная ось +y имеет направляющие (-sin, cos)
            Fx += pf.magnitude_kN * -sin;
            Fy += pf.magnitude_kN * cos;
          }
        }
        // Сосредоточенные моменты на стержне (например, M на CB)
        for (const pm of memberMoments) {
          if (pm.kind === 'member_moment' && Math.abs(pm.tPosition - t) < 1e-3) {
            Mz += pm.moment_kNm;
          }
        }

        subNodes.push({
          id: `${el.id}_sub_${i}`,
          x: gx,
          y: gy,
          Fx,
          Fy,
          Mz,
          fixUx: false,
          fixUy: false,
          fixTheta: false,
        });
        chainNodeIndices.push(subIdx);
      }
    }

    // Перевод единиц в кН и м: E [МПа] = E * 1000 [кН/м^2]
    const EA = el.E_MPa * 1000 * (el.A_cm2 * 1e-4);
    const EI = el.E_MPa * 1000 * (el.Iz_cm4 * 1e-8);

    const startHasHinge = Boolean(el.releaseStart || nStartOrig.isHinge);
    const endHasHinge = Boolean(el.releaseEnd || nEndOrig.isHinge);

    for (let i = 0; i < sortedT.length - 1; i++) {
      const t1 = sortedT[i];
      const t2 = sortedT[i + 1];
      const sStart = t1 * totalL;
      const sEnd = t2 * totalL;
      const subL = sEnd - sStart;

      let qPerp1 = 0;
      let qPerp2 = 0;
      let qAxial1 = 0;
      let qAxial2 = 0;

      for (const dl of memberDistLoads) {
        if (dl.kind !== 'member_distributed') continue;
        const qAt1 = dl.qStart_kNm + t1 * (dl.qEnd_kNm - dl.qStart_kNm);
        const qAt2 = dl.qStart_kNm + t2 * (dl.qEnd_kNm - dl.qStart_kNm);

        if (dl.direction === 'local_perp') {
          qPerp1 += qAt1;
          qPerp2 += qAt2;
        } else if (dl.direction === 'global_x') {
          qAxial1 += qAt1 * cos;
          qAxial2 += qAt2 * cos;
          qPerp1 += qAt1 * -sin;
          qPerp2 += qAt2 * -sin;
        } else if (dl.direction === 'global_y') {
          qAxial1 += qAt1 * sin;
          qAxial2 += qAt2 * sin;
          qPerp1 += qAt1 * cos;
          qPerp2 += qAt2 * cos;
        }
      }

      subElements.push({
        parentElementId: el.id,
        n1Idx: chainNodeIndices[i],
        n2Idx: chainNodeIndices[i + 1],
        sStart,
        sEnd,
        L: subL,
        cos,
        sin,
        EA,
        EI,
        releaseStart: i === 0 ? startHasHinge : false,
        releaseEnd: i === sortedT.length - 2 ? endHasHinge : false,
        qPerp1,
        qPerp2,
        qAxial1,
        qAxial2,
      });
    }
  }

  // 4. Формирование глобальной матрицы жесткости K (3*N x 3*N)
  const ndof = subNodes.length * 3;
  const KGlobal = Array.from({ length: ndof }, () => Array(ndof).fill(0));
  const FGlobal = Array(ndof).fill(0);

  for (let i = 0; i < subNodes.length; i++) {
    FGlobal[i * 3 + 0] += subNodes[i].Fx;
    FGlobal[i * 3 + 1] += subNodes[i].Fy;
    FGlobal[i * 3 + 2] += subNodes[i].Mz;
  }

  const subMatrices = subElements.map((sub) => computeLocalSubElementMatrices(sub));

  subElements.forEach((sub, idx) => {
    const { KGlobal: ke, fEqGlobal: fe } = subMatrices[idx];
    const map = [
      sub.n1Idx * 3 + 0,
      sub.n1Idx * 3 + 1,
      sub.n1Idx * 3 + 2,
      sub.n2Idx * 3 + 0,
      sub.n2Idx * 3 + 1,
      sub.n2Idx * 3 + 2,
    ];
    for (let r = 0; r < 6; r++) {
      FGlobal[map[r]] += fe[r];
      for (let c = 0; c < 6; c++) {
        KGlobal[map[r]][map[c]] += ke[r][c];
      }
    }
  });

  // Сохраняем копию полной матрицы для вычисления реакций опор
  const KOrig = KGlobal.map((row) => [...row]);
  const FOrig = [...FGlobal];

  // Если узел является полным шарниром (все приходящие стержни имеют шарнир), стабилизируем диагональ theta
  for (let d = 0; d < ndof; d++) {
    if (Math.abs(KGlobal[d][d]) < 1e-9) {
      KGlobal[d][d] = 1.0;
      FGlobal[d] = 0;
    }
  }

  // 5. Наложение граничных условий опор
  for (let i = 0; i < subNodes.length; i++) {
    const locks = [subNodes[i].fixUx, subNodes[i].fixUy, subNodes[i].fixTheta];
    for (let k = 0; k < 3; k++) {
      if (locks[k]) {
        const dof = i * 3 + k;
        for (let j = 0; j < ndof; j++) {
          KGlobal[dof][j] = 0;
          KGlobal[j][dof] = 0;
        }
        KGlobal[dof][dof] = 1.0;
        FGlobal[dof] = 0;
      }
    }
  }

  const U = solveLinearSystem(KGlobal, FGlobal);
  if (!U) {
    return {
      isStable: false,
      errorMessage: 'Система геометрически изменяема или мгновенно изменяема (проверьте опоры и шарниры).',
      reactions: [],
      elementResults: [],
      maxAbs: { N_kN: 0, Q_kN: 0, M_kNm: 0 },
      equilibriumCheck: { sumFx_residual: 0, sumFy_residual: 0, sumM0_residual: 0 },
    };
  }

  // 6. Вычисление опорных реакций: R = K_orig * U - F_orig
  const reactions: FrameReactionResult[] = [];
  for (const n of input.nodes) {
    if (n.support === 'none') continue;
    const idx = nodeMap.get(n.id)!;
    const dofs = [idx * 3 + 0, idx * 3 + 1, idx * 3 + 2];
    const rVec = dofs.map((d) => {
      let sum = 0;
      for (let j = 0; j < ndof; j++) sum += KOrig[d][j] * U[j];
      return sum - FOrig[d];
    });

    reactions.push({
      nodeId: n.id,
      nodeLabel: n.label,
      x: n.x,
      y: n.y,
      Rx_kN: subNodes[idx].fixUx ? Number(rVec[0].toFixed(3)) : 0,
      Ry_kN: subNodes[idx].fixUy ? Number(rVec[1].toFixed(3)) : 0,
      M_kNm: subNodes[idx].fixTheta ? Number(rVec[2].toFixed(3)) : 0,
    });
  }

  // 7. Восстановление внутренних усилий N(s), Q(s), M(s) вдоль каждого стержня рамы
  const elementResults: FrameElementResult[] = [];
  let maxN = 0;
  let maxQ = 0;
  let maxM = 0;

  for (const el of input.elements) {
    const nStartOrig = input.nodes.find((n) => n.id === el.nodeStartId);
    const nEndOrig = input.nodes.find((n) => n.id === el.nodeEndId);
    if (!nStartOrig || !nEndOrig) continue;

    const dx = nEndOrig.x - nStartOrig.x;
    const dy = nEndOrig.y - nStartOrig.y;
    const totalL = Math.hypot(dx, dy);
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    const matchingSubs = subElements
      .map((s, idx) => ({ sub: s, mat: subMatrices[idx] }))
      .filter((item) => item.sub.parentElementId === el.id);

    const samples: FrameSamplePoint[] = [];
    let elMaxM = 0;

    for (const { sub, mat } of matchingSubs) {
      const uGlobal = [
        U[sub.n1Idx * 3 + 0],
        U[sub.n1Idx * 3 + 1],
        U[sub.n1Idx * 3 + 2],
        U[sub.n2Idx * 3 + 0],
        U[sub.n2Idx * 3 + 1],
        U[sub.n2Idx * 3 + 2],
      ];

      // uLocal = T * uGlobal
      const uLocal = Array(6).fill(0);
      for (let i = 0; i < 6; i++) {
        for (let k = 0; k < 6; k++) uLocal[i] += mat.T[i][k] * uGlobal[k];
      }

      // Внутренние узловые силы на концах участка: fInt = KLocal * uLocal - fEqLocal
      const fInt = Array(6).fill(0);
      for (let i = 0; i < 6; i++) {
        let s = 0;
        for (let k = 0; k < 6; k++) s += mat.KLocal[i][k] * uLocal[k];
        fInt[i] = s - mat.fEqLocal[i];
      }

      const N0 = -fInt[0];
      const Q0 = fInt[1];
      const M0 = -fInt[2];

      const numSteps = 16;
      for (let step = 0; step <= numSteps; step++) {
        const xi = (step / numSteps) * sub.L;
        const sGlobal = sub.sStart + xi;
        const tGlobal = sGlobal / totalL;

        const N_val = N0 - sub.qAxial1 * xi - ((sub.qAxial2 - sub.qAxial1) * xi * xi) / (2 * sub.L);
        const Q_val = Q0 + sub.qPerp1 * xi + ((sub.qPerp2 - sub.qPerp1) * xi * xi) / (2 * sub.L);
        const M_val =
          M0 +
          Q0 * xi +
          0.5 * sub.qPerp1 * xi * xi +
          ((sub.qPerp2 - sub.qPerp1) * xi * xi * xi) / (6 * sub.L);

        maxN = Math.max(maxN, Math.abs(N_val));
        maxQ = Math.max(maxQ, Math.abs(Q_val));
        maxM = Math.max(maxM, Math.abs(M_val));
        elMaxM = Math.max(elMaxM, Math.abs(M_val));

        samples.push({
          s_m: Number(sGlobal.toFixed(4)),
          x_global: nStartOrig.x + tGlobal * dx,
          y_global: nStartOrig.y + tGlobal * dy,
          N_kN: Number(N_val.toFixed(3)),
          Q_kN: Number(Q_val.toFixed(3)),
          M_kNm: Number(M_val.toFixed(3)),
        });
      }
    }

    const first = samples[0] ?? { N_kN: 0, Q_kN: 0, M_kNm: 0 };
    const last = samples[samples.length - 1] ?? { N_kN: 0, Q_kN: 0, M_kNm: 0 };

    elementResults.push({
      elementId: el.id,
      label: el.label,
      length_m: Number(totalL.toFixed(3)),
      angleDeg: Number(angleDeg.toFixed(1)),
      x1: nStartOrig.x,
      y1: nStartOrig.y,
      x2: nEndOrig.x,
      y2: nEndOrig.y,
      samples,
      N_start: first.N_kN,
      N_end: last.N_kN,
      Q_start: first.Q_kN,
      Q_end: last.Q_kN,
      M_start: first.M_kNm,
      M_end: last.M_kNm,
      M_max_abs: Number(elMaxM.toFixed(3)),
    });
  }

  // Проверка глобального статического равновесия
  let sumFx = 0;
  let sumFy = 0;
  let sumM0 = 0;

  for (let i = 0; i < subNodes.length; i++) {
    sumFx += FOrig[i * 3 + 0];
    sumFy += FOrig[i * 3 + 1];
    sumM0 += FOrig[i * 3 + 2] + subNodes[i].x * FOrig[i * 3 + 1] - subNodes[i].y * FOrig[i * 3 + 0];
  }
  for (const r of reactions) {
    sumFx += r.Rx_kN;
    sumFy += r.Ry_kN;
    sumM0 += r.M_kNm + r.x * r.Ry_kN - r.y * r.Rx_kN;
  }

  return {
    isStable: true,
    reactions,
    elementResults,
    maxAbs: {
      N_kN: Number(maxN.toFixed(2)),
      Q_kN: Number(maxQ.toFixed(2)),
      M_kNm: Number(maxM.toFixed(2)),
    },
    equilibriumCheck: {
      sumFx_residual: Number(sumFx.toFixed(4)),
      sumFy_residual: Number(sumFy.toFixed(4)),
      sumM0_residual: Number(sumM0.toFixed(4)),
    },
  };
}