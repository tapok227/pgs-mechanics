'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  FrameProblemInput,
  FrameSupportType,
  FrameNodalForceLoad,
  FrameMemberPointForceLoad,
  FrameMemberDistributedLoad,
  FrameMemberMomentLoad,
} from '@/types/frame';
import { solveFrameProblem } from '@/core/solver/frameSolver';
import { GOST_8239_IBEAMS } from '@/core/solver/beamSolver';
import {
  generateFrameAcademicSolution,
  AcademicFormulaStep,
} from '@/core/academic/solutionGenerator';
import { FRAME_PRESETS } from '@/data/presets';
import { KatexBlock } from '@/components/academic/AcademicSolutionView';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Hand,
  MapPin,
  GitBranch,
  Move,
  Printer,
  BookOpen,
} from 'lucide-react';
import { MobileFrameEditor } from './MobileFrameEditor';

interface FrameWorkspaceProps {
  input: FrameProblemInput;
  onChange: (updated: FrameProblemInput) => void;
}

type CanvasMode = 'drag' | 'add_node' | 'add_element' | 'pan';

type FrameDragTarget =
  | { kind: 'node'; nodeId: string }
  | {
      kind: 'element';
      elementId: string;
      startNodeId: string;
      endNodeId: string;
      startMouseWorld: { x: number; y: number };
      origStart: { x: number; y: number };
      origEnd: { x: number; y: number };
    }
  | { kind: 'member_load'; loadId: string; elementId: string }
  | { kind: 'nodal_force_angle'; loadId: string; nodeId: string }
  | null;

interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const FrameWorkspace: React.FC<FrameWorkspaceProps> = ({
  input,
  onChange,
}) => {
  const [activeDiagram, setActiveDiagram] = useState<'none' | 'M' | 'Q' | 'N'>('M');
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('drag');
  const [snapStep, setSnapStep] = useState<number>(0.5);
  const [showReactions, setShowReactions] = useState<boolean>(true);
  const [pendingStartNodeId, setPendingStartNodeId] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [dragTarget, setDragTarget] = useState<FrameDragTarget>(null);
  const lockedBoundsRef = useRef<WorldBounds | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Визир сечения вдоль выбранного стержня
  const [selectedElementId, setSelectedElementId] = useState<string>(
    input.elements[0]?.id ?? ''
  );
  const [crosshairS_m, setCrosshairS_m] = useState<number>(0);

  const output = useMemo(() => solveFrameProblem(input), [input]);
  const academicDoc = useMemo(() => {
    if (!output.isStable) return null;
    return generateFrameAcademicSolution(input, output);
  }, [input, output]);

  // Активный стержень для визира (fallback на первый существующий)
  const activeElementResult = useMemo(() => {
    if (!output.isStable || output.elementResults.length === 0) return null;
    return (
      output.elementResults.find((er) => er.elementId === selectedElementId) ??
      output.elementResults[0]
    );
  }, [output, selectedElementId]);

  const activeCrosshairSample = useMemo(() => {
    if (!activeElementResult || activeElementResult.samples.length === 0) return null;
    const sClamped = Math.max(0, Math.min(activeElementResult.length_m, crosshairS_m));
    // Линейная интерполяция по ближайшим семплам для плавного визира
    const samples = activeElementResult.samples;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (sClamped >= a.s_m - 1e-6 && sClamped <= b.s_m + 1e-6) {
        const span = Math.max(b.s_m - a.s_m, 1e-9);
        const t = Math.max(0, Math.min(1, (sClamped - a.s_m) / span));
        return {
          s_m: sClamped,
          x_global: a.x_global + t * (b.x_global - a.x_global),
          y_global: a.y_global + t * (b.y_global - a.y_global),
          N_kN: a.N_kN + t * (b.N_kN - a.N_kN),
          Q_kN: a.Q_kN + t * (b.Q_kN - a.Q_kN),
          M_kNm: a.M_kNm + t * (b.M_kNm - a.M_kNm),
        };
      }
    }
    return samples[samples.length - 1];
  }, [activeElementResult, crosshairS_m]);

  const selectedIBeam = useMemo(() => {
    const num = academicDoc?.strengthSection.selectedProfileNumber;
    return (
      GOST_8239_IBEAMS.find((p) => p.number === num) ?? GOST_8239_IBEAMS[0]
    );
  }, [academicDoc]);

  // Габариты 2D-сцены (стабилизированы во время перетаскивания)
  const naturalBounds: WorldBounds = useMemo(() => {
    const xs = input.nodes.map((n) => n.x);
    const ys = input.nodes.map((n) => n.y);
    return {
      minX: Math.min(...xs, 0) - 1,
      maxX: Math.max(...xs, 8) + 1,
      minY: Math.min(...ys, 0) - 1,
      maxY: Math.max(...ys, 5) + 1,
    };
  }, [input.nodes]);

  const bounds = lockedBoundsRef.current ?? naturalBounds;
  const { minX, maxX, minY, maxY } = bounds;

  const svgW = 920;
  const svgH = 520;
  const pad = 90;

  const spanX = Math.max(maxX - minX, 2);
  const spanY = Math.max(maxY - minY, 2);
  const scale = Math.min((svgW - 2 * pad) / spanX, (svgH - 2 * pad) / spanY);

  const toScreen = (x: number, y: number) => ({
    px: pad + (x - minX) * scale,
    py: svgH - pad - (y - minY) * scale,
  });

  const vbW = svgW / zoom;
  const vbH = svgH / zoom;
  const vbX = (svgW - vbW) / 2 - pan.x;
  const vbY = (svgH - vbH) / 2 - pan.y;

  const clientToWorld = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = vbX + ((clientX - rect.left) / Math.max(rect.width, 1)) * vbW;
    const svgY = vbY + ((clientY - rect.top) / Math.max(rect.height, 1)) * vbH;
    return {
      x: minX + (svgX - pad) / scale,
      y: minY + (svgH - pad - svgY) / scale,
    };
  };

  const snapCoord = (v: number) =>
    Number((Math.round(v / snapStep) * snapStep).toFixed(3));

  const maxDiagramVal =
    activeDiagram === 'M'
      ? Math.max(output.maxAbs.M_kNm, 1)
      : activeDiagram === 'Q'
      ? Math.max(output.maxAbs.Q_kN, 1)
      : Math.max(output.maxAbs.N_kN, 1);

  const diagMaxPx = 56;

  // ============================================================================
  // ОПЕРАЦИИ ДОБАВЛЕНИЯ И УДАЛЕНИЯ УЗЛОВ, СТЕРЖНЕЙ И НАГРУЗОК
  // ============================================================================

  const nextNodeLabel = () => {
    const used = new Set(input.nodes.map((n) => n.label));
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < letters.length; i++) {
      if (!used.has(letters[i])) return letters[i];
    }
    return `N_${input.nodes.length + 1}`;
  };

  const addNodeAt = (x: number, y: number) => {
    const id = `fn_${Date.now()}`;
    const label = nextNodeLabel();
    onChange({
      ...input,
      nodes: [
        ...input.nodes,
        {
          id,
          label,
          x,
          y,
          support: 'none',
          isHinge: false,
        },
      ],
    });
    return id;
  };

  const addNode = () => {
    const maxNodeX = input.nodes.length ? Math.max(...input.nodes.map((n) => n.x)) : 0;
    addNodeAt(Number((maxNodeX + 2).toFixed(1)), 0);
  };

  const addElementBetween = (startId: string, endId: string) => {
    if (startId === endId) return;
    const n1 = input.nodes.find((n) => n.id === startId);
    const n2 = input.nodes.find((n) => n.id === endId);
    if (!n1 || !n2) return;
    const newId = `fe_${Date.now()}`;
    onChange({
      ...input,
      elements: [
        ...input.elements,
        {
          id: newId,
          label: `Стержень ${n1.label.split(' ')[0]}-${n2.label.split(' ')[0]}`,
          nodeStartId: startId,
          nodeEndId: endId,
          E_MPa: 2e5,
          A_cm2: 40,
          Iz_cm4: 3500,
        },
      ],
    });
    setSelectedElementId(newId);
  };

  const addElement = () => {
    if (input.nodes.length < 2) return;
    const n1 = input.nodes[input.nodes.length - 2];
    const n2 = input.nodes[input.nodes.length - 1];
    addElementBetween(n1.id, n2.id);
  };

  const removeNode = (nodeId: string) => {
    const remainingEls = input.elements.filter(
      (e) => e.nodeStartId !== nodeId && e.nodeEndId !== nodeId
    );
    const removedElIds = new Set(
      input.elements
        .filter((e) => e.nodeStartId === nodeId || e.nodeEndId === nodeId)
        .map((e) => e.id)
    );
    onChange({
      ...input,
      nodes: input.nodes.filter((item) => item.id !== nodeId),
      elements: remainingEls,
      loads: input.loads.filter((l) => {
        if (l.kind === 'nodal_force') return l.nodeId !== nodeId;
        return !removedElIds.has(l.elementId);
      }),
    });
  };

  const removeElement = (elementId: string) => {
    onChange({
      ...input,
      elements: input.elements.filter((item) => item.id !== elementId),
      loads: input.loads.filter((l) =>
        l.kind === 'nodal_force' ? true : l.elementId !== elementId
      ),
    });
  };

  const addNodalForce = () => {
    if (input.nodes.length === 0) return;
    const target = input.nodes[0];
    const count = input.loads.filter((l) => l.kind === 'nodal_force').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_nf_${Date.now()}`,
          kind: 'nodal_force',
          nodeId: target.id,
          label: `P_${count}`,
          magnitude_kN: 20,
          angleDeg: -90,
        },
      ],
    });
  };

  const addMemberPointForce = () => {
    if (input.elements.length === 0) return;
    const targetEl =
      input.elements.find((e) => e.id === selectedElementId) ?? input.elements[0];
    const count =
      input.loads.filter((l) => l.kind === 'member_point_force').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_mpf_${Date.now()}`,
          kind: 'member_point_force',
          elementId: targetEl.id,
          label: `F_${count}`,
          tPosition: 0.5,
          magnitude_kN: -15,
        },
      ],
    });
  };

  const addMemberDistributed = (
    profile: 'const' | 'tri_right' | 'tri_left' = 'const'
  ) => {
    if (input.elements.length === 0) return;
    const targetEl =
      input.elements.find((e) => e.id === selectedElementId) ?? input.elements[0];
    const count =
      input.loads.filter((l) => l.kind === 'member_distributed').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_q_${Date.now()}`,
          kind: 'member_distributed',
          elementId: targetEl.id,
          label: count === 1 ? 'q' : `q_${count}`,
          qStart_kNm: profile === 'tri_right' ? 0 : -10,
          qEnd_kNm: profile === 'tri_left' ? 0 : -10,
          direction: 'global_y',
        },
      ],
    });
  };

  const addMemberMoment = () => {
    if (input.elements.length === 0) return;
    const targetEl =
      input.elements.find((e) => e.id === selectedElementId) ?? input.elements[0];
    const count =
      input.loads.filter((l) => l.kind === 'member_moment').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_m_${Date.now()}`,
          kind: 'member_moment',
          elementId: targetEl.id,
          label: count === 1 ? 'M' : `M_${count}`,
          tPosition: 0.5,
          moment_kNm: 15,
        },
      ],
    });
  };

  const updateLoad = (id: string, patch: Record<string, unknown>) => {
    onChange({
      ...input,
      loads: input.loads.map((l) => (l.id === id ? ({ ...l, ...patch } as typeof l) : l)),
    });
  };

  const removeLoad = (id: string) => {
    onChange({
      ...input,
      loads: input.loads.filter((l) => l.id !== id),
    });
  };

  // ============================================================================
  // МАСШТАБ, ПАНОРАМА И DRAG & DROP НА 2D SVG-ХОЛСТЕ
  // ============================================================================

  const handleZoomIn = () => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(0.75, Number((z - 0.25).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const startDrag = (target: FrameDragTarget, e: React.PointerEvent<SVGElement>) => {
    e.stopPropagation();
    lockedBoundsRef.current = naturalBounds;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDragTarget(target);
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (canvasMode === 'add_node') {
      const world = clientToWorld(e.clientX, e.clientY);
      addNodeAt(snapCoord(world.x), snapCoord(world.y));
      return;
    }

    if (canvasMode === 'add_element') {
      const world = clientToWorld(e.clientX, e.clientY);
      const sx = snapCoord(world.x);
      const sy = snapCoord(world.y);
      if (!pendingStartNodeId) {
        const newId = addNodeAt(sx, sy);
        setPendingStartNodeId(newId);
      } else {
        const newId = addNodeAt(sx, sy);
        addElementBetween(pendingStartNodeId, newId);
        setPendingStartNodeId(null);
      }
      return;
    }

    if (canvasMode === 'pan' || (zoom > 1 && !dragTarget)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragTarget) {
      const world = clientToWorld(e.clientX, e.clientY);

      if (dragTarget.kind === 'node') {
        const nx = snapCoord(world.x);
        const ny = snapCoord(world.y);
        onChange({
          ...input,
          nodes: input.nodes.map((n) =>
            n.id === dragTarget.nodeId ? { ...n, x: nx, y: ny } : n
          ),
        });
        return;
      }

      if (dragTarget.kind === 'element') {
        const dx = snapCoord(world.x - dragTarget.startMouseWorld.x);
        const dy = snapCoord(world.y - dragTarget.startMouseWorld.y);
        onChange({
          ...input,
          nodes: input.nodes.map((n) => {
            if (n.id === dragTarget.startNodeId) {
              return {
                ...n,
                x: Number((dragTarget.origStart.x + dx).toFixed(3)),
                y: Number((dragTarget.origStart.y + dy).toFixed(3)),
              };
            }
            if (n.id === dragTarget.endNodeId) {
              return {
                ...n,
                x: Number((dragTarget.origEnd.x + dx).toFixed(3)),
                y: Number((dragTarget.origEnd.y + dy).toFixed(3)),
              };
            }
            return n;
          }),
        });
        return;
      }

      if (dragTarget.kind === 'member_load') {
        const el = input.elements.find((item) => item.id === dragTarget.elementId);
        const n1 = el ? input.nodes.find((n) => n.id === el.nodeStartId) : undefined;
        const n2 = el ? input.nodes.find((n) => n.id === el.nodeEndId) : undefined;
        if (!n1 || !n2) return;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-8) return;
        const rawT =
          ((world.x - n1.x) * dx + (world.y - n1.y) * dy) / len2;
        const snappedT = Math.max(
          0.05,
          Math.min(0.95, Number((Math.round(rawT * 20) / 20).toFixed(2)))
        );
        updateLoad(dragTarget.loadId, { tPosition: snappedT });
        return;
      }

      if (dragTarget.kind === 'nodal_force_angle') {
        const node = input.nodes.find((n) => n.id === dragTarget.nodeId);
        if (!node) return;
        // Хвост вектора направлен от узла против направления силы: v_tail -> node
        const vx = node.x - world.x;
        const vy = node.y - world.y;
        if (Math.hypot(vx, vy) < 1e-4) return;
        const rawDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
        const snappedDeg = Math.round(rawDeg / 5) * 5;
        updateLoad(dragTarget.loadId, { angleDeg: snappedDeg });
        return;
      }
    }

    if (panStartRef.current && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dxSvg =
        ((e.clientX - panStartRef.current.clientX) / Math.max(rect.width, 1)) * vbW;
      const dySvg =
        ((e.clientY - panStartRef.current.clientY) / Math.max(rect.height, 1)) * vbH;
      const maxPanX = (svgW - vbW) / 2 + 160;
      const maxPanY = (svgH - vbH) / 2 + 140;
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.panX + dxSvg)),
        y: Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.panY + dySvg)),
      });
    }
  };

  const handleSvgPointerUp = () => {
    setDragTarget(null);
    lockedBoundsRef.current = null;
    panStartRef.current = null;
  };

  const handleNodePointerDown = (
    nodeId: string,
    e: React.PointerEvent<SVGElement>
  ) => {
    e.stopPropagation();
    if (canvasMode === 'add_element') {
      if (!pendingStartNodeId) {
        setPendingStartNodeId(nodeId);
      } else if (pendingStartNodeId === nodeId) {
        setPendingStartNodeId(null);
      } else {
        addElementBetween(pendingStartNodeId, nodeId);
        setPendingStartNodeId(null);
      }
      return;
    }
    if (canvasMode === 'drag') {
      startDrag({ kind: 'node', nodeId }, e);
    }
  };

  const nodalForces = input.loads.filter(
    (l): l is FrameNodalForceLoad => l.kind === 'nodal_force'
  );
  const memberPointForces = input.loads.filter(
    (l): l is FrameMemberPointForceLoad => l.kind === 'member_point_force'
  );
  const memberDistributed = input.loads.filter(
    (l): l is FrameMemberDistributedLoad => l.kind === 'member_distributed'
  );
  const memberMoments = input.loads.filter(
    (l): l is FrameMemberMomentLoad => l.kind === 'member_moment'
  );

  // Шаги для сетки
  const gridMinX = Math.floor(minX);
  const gridMaxX = Math.ceil(maxX);
  const gridMinY = Math.floor(minY);
  const gridMaxY = Math.ceil(maxY);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Типовые расчетные схемы плоских рам (Пресеты РГР) */}
      <div className="flex flex-col gap-2 rounded-lg border border-gray-300 bg-white p-3 shadow-xs md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3 md:p-3.5 print:hidden">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 md:text-xs">
          Типовые схемы плоских рам 2D из задачников и РГР:
        </span>
        <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto whitespace-nowrap px-3 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:whitespace-normal">
          {FRAME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChange(preset.data);
                setSelectedElementId(preset.data.elements[0]?.id ?? '');
                setCrosshairS_m(0);
                setPendingStartNodeId(null);
                handleZoomReset();
              }}
              className="shrink-0 rounded border border-gray-300 bg-[#F8F9FA] px-3 py-2 text-xs font-semibold text-[#1F2937] transition hover:border-[#065F46] hover:bg-[#065F46]/5 active:bg-[#065F46]/10 md:py-1.5"
              title={preset.sourceNote}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Панель режимов конструктора и переключения эпюр */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-300 bg-white p-3 shadow-xs md:p-4 print:hidden">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F2937]">
              2D-Конструктор плоских рам (Drag & Drop узлов, стержней и нагрузок)
            </h2>
            <p className="text-xs text-gray-600">
              Перетаскивайте узлы, центры стержней (перенос целиком), силы на стержнях и углы узловых сил — или кликайте для добавления новых точек
            </p>
          </div>

          <div className="scrollbar-none -mx-3 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-3 py-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            <span className="mr-1 hidden text-xs font-bold text-gray-600 md:inline">
              Эпюра на раме:
            </span>
            {[
              { id: 'none', label: 'Только схема' },
              { id: 'M', label: 'Эпюра M (кН·м)' },
              { id: 'Q', label: 'Эпюра Q (кН)' },
              { id: 'N', label: 'Эпюра N (кН)' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setActiveDiagram(btn.id as typeof activeDiagram)}
                className={`shrink-0 rounded px-3 py-2 text-xs font-bold transition md:py-1.5 ${
                  activeDiagram === btn.id
                    ? 'bg-[#065F46] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Инструменты холста + шаг сетки + масштаб */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2.5 text-xs">
          <div className="scrollbar-none -mx-3 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-3 md:mx-0 md:flex-wrap md:px-0">
            {[
              { id: 'drag' as const, label: 'Перемещение', icon: Hand },
              { id: 'add_node' as const, label: '+ Узел кликом', icon: MapPin },
              { id: 'add_element' as const, label: '+ Стержень', icon: GitBranch },
              { id: 'pan' as const, label: 'Панорама', icon: Move },
            ].map((m) => {
              const Icon = m.icon;
              const isActive = canvasMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setCanvasMode(m.id);
                    setPendingStartNodeId(null);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-bold transition ${
                    isActive
                      ? 'border-[#1F2937] bg-[#1F2937] text-white'
                      : 'border-gray-300 bg-gray-50 text-[#1F2937] hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
            {canvasMode === 'add_element' && (
              <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-[#1E3A8A]">
                {pendingStartNodeId
                  ? 'Выберите 2-й узел (или точку сетки) для конца стержня'
                  : 'Кликните 1-й узел (или точку сетки)'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showReactions}
                onChange={(e) => setShowReactions(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Реакции R</span>
            </label>

            <div className="flex items-center gap-1">
              <span className="text-gray-500">Шаг:</span>
              {[0.1, 0.25, 0.5, 1.0].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setSnapStep(step)}
                  className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                    snapStep === step
                      ? 'bg-[#1F2937] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {step}м
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleZoomOut}
                aria-label="Уменьшить масштаб схемы рамы"
                className="inline-flex min-h-8 min-w-8 items-center justify-center gap-0.5 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-extrabold text-[#1F2937] hover:bg-gray-100"
              >
                <ZoomOut className="h-3.5 w-3.5" />
                <span>−</span>
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label="Увеличить масштаб схемы рамы"
                className="inline-flex min-h-8 min-w-8 items-center justify-center gap-0.5 rounded border border-[#065F46]/40 bg-emerald-50 px-2 py-1 text-xs font-extrabold text-[#065F46] hover:bg-emerald-100"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span>+</span>
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                aria-label="Сбросить масштаб схемы рамы"
                className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{Math.round(zoom * 100)}%</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Векторный 2D-холст рамы и наложенных эпюр */}
      <div className="rounded-lg border border-gray-300 bg-white p-2.5 shadow-xs md:p-4">
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerUp}
          className={`h-auto w-full select-none rounded border border-gray-200 bg-[#F8F9FA] font-mono ${
            canvasMode === 'add_node' || canvasMode === 'add_element'
              ? 'cursor-crosshair touch-none'
              : canvasMode === 'pan' || dragTarget
              ? 'cursor-grabbing touch-none'
              : zoom > 1
              ? 'cursor-grab touch-none'
              : 'touch-pan-y'
          }`}
        >
          <defs>
            <marker
              id="frame-arrow-blue"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#0284C7" />
            </marker>
            <marker
              id="frame-arrow-red"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#DC2626" />
            </marker>
            <marker
              id="frame-arrow-reaction"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#2563EB" />
            </marker>
          </defs>

          {/* Координатная сетка 1x1 м */}
          {Array.from({ length: gridMaxX - gridMinX + 1 }).map((_, i) => {
            const gx = gridMinX + i;
            const { px } = toScreen(gx, 0);
            return (
              <g key={`gx-${gx}`}>
                <line
                  x1={px}
                  y1={20}
                  x2={px}
                  y2={svgH - 28}
                  stroke={gx === 0 ? '#D1D5DB' : '#E5E7EB'}
                  strokeWidth={gx === 0 ? '1.4' : '1'}
                />
                <text x={px} y={svgH - 10} textAnchor="middle" fontSize="10" fill="#6B7280">
                  x={gx}м
                </text>
              </g>
            );
          })}
          {Array.from({ length: gridMaxY - gridMinY + 1 }).map((_, i) => {
            const gy = gridMinY + i;
            const { py } = toScreen(0, gy);
            return (
              <g key={`gy-${gy}`}>
                <line
                  x1={42}
                  y1={py}
                  x2={svgW - 20}
                  y2={py}
                  stroke={gy === 0 ? '#D1D5DB' : '#E5E7EB'}
                  strokeWidth={gy === 0 ? '1.4' : '1'}
                />
                <text x={22} y={py + 4} textAnchor="middle" fontSize="10" fill="#6B7280">
                  y={gy}м
                </text>
              </g>
            );
          })}

          {/* 1. Наложенные эпюры N, Q, M вдоль стержней */}
          {activeDiagram !== 'none' &&
            output.isStable &&
            output.elementResults.map((er) => {
              const p1 = toScreen(er.x1, er.y1);
              const p2 = toScreen(er.x2, er.y2);
              const sLen = Math.hypot(p2.px - p1.px, p2.py - p1.py);
              if (sLen < 1) return null;

              const nx = -(p2.py - p1.py) / sLen;
              const ny = (p2.px - p1.px) / sLen;

              const polyPoints: string[] = [`${p1.px},${p1.py}`];
              const curvePoints = er.samples.map((smp) => {
                const base = toScreen(smp.x_global, smp.y_global);
                const val =
                  activeDiagram === 'M'
                    ? -smp.M_kNm
                    : activeDiagram === 'Q'
                    ? smp.Q_kN
                    : smp.N_kN;
                const offset = (val / maxDiagramVal) * diagMaxPx;
                const cx = base.px + nx * offset;
                const cy = base.py + ny * offset;
                polyPoints.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                return {
                  base,
                  cx,
                  cy,
                  val: activeDiagram === 'M' ? Math.abs(smp.M_kNm) : val,
                };
              });
              polyPoints.push(`${p2.px},${p2.py}`);

              const color =
                activeDiagram === 'M'
                  ? '#DC2626'
                  : activeDiagram === 'Q'
                  ? '#2563EB'
                  : '#065F46';

              const firstPt = curvePoints[0];
              const midPt = curvePoints[Math.floor(curvePoints.length / 2)];
              const lastPt = curvePoints[curvePoints.length - 1];

              return (
                <g key={`diag-${er.elementId}`} className="pointer-events-none">
                  <polygon
                    points={polyPoints.join(' ')}
                    fill={
                      activeDiagram === 'M'
                        ? 'rgba(220,38,38,0.14)'
                        : activeDiagram === 'Q'
                        ? 'rgba(37,99,235,0.14)'
                        : 'rgba(6,95,70,0.14)'
                    }
                    stroke={color}
                    strokeWidth="2"
                  />
                  {curvePoints
                    .filter((_, idx) => idx % 2 === 0)
                    .map((pt, idx) => (
                      <line
                        key={idx}
                        x1={pt.base.px}
                        y1={pt.base.py}
                        x2={pt.cx}
                        y2={pt.cy}
                        stroke={color}
                        strokeWidth="1"
                        opacity="0.55"
                      />
                    ))}
                  {[firstPt, midPt, lastPt].map(
                    (pt, idx) =>
                      pt &&
                      Math.abs(pt.val) > 0.05 && (
                        <text
                          key={idx}
                          x={pt.cx + nx * 12}
                          y={pt.cy + ny * 12}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill={color}
                        >
                          {pt.val.toFixed(1)}
                        </text>
                      )
                  )}
                </g>
              );
            })}

          {/* 2. Внешние нагрузки на стержнях и узлах */}
          {input.loads.map((load) => {
            if (load.kind === 'member_distributed') {
              const el = input.elements.find((e) => e.id === load.elementId);
              if (!el) return null;
              const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
              const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
              if (!n1 || !n2) return null;

              const p1 = toScreen(n1.x, n1.y);
              const p2 = toScreen(n2.x, n2.y);
              const sLen = Math.hypot(p2.px - p1.px, p2.py - p1.py);
              if (sLen < 2) return null;

              const maxQ = Math.max(Math.abs(load.qStart_kNm), Math.abs(load.qEnd_kNm), 1);
              const maxH = 38;
              // Вектор направления стрелки на экране (из точки огибающей к точке на стержне):
              // global_x: q > 0 вправо => хвост слева (dir = (1, 0))
              // global_y: q > 0 вверх => хвост снизу (в экранных Y: (0, -1)), q < 0 вниз => хвост сверху
              // local_perp: локальный +y = (-sin, cos), на экране (-(-sin), -cos)
              const dxW = n2.x - n1.x;
              const dyW = n2.y - n1.y;
              const lenW = Math.hypot(dxW, dyW) || 1;
              const ux = dxW / lenW;
              const uy = dyW / lenW;

              let dirScrX = 0;
              let dirScrY = 1;
              if (load.direction === 'global_x') {
                dirScrX = 1;
                dirScrY = 0;
              } else if (load.direction === 'global_y') {
                dirScrX = 0;
                dirScrY = -1;
              } else {
                // локальный +y в мировых координатах: (-uy, ux)
                dirScrX = -uy;
                dirScrY = -ux;
              }

              const calcTail = (px: number, py: number, qVal: number) => {
                const offset = (qVal / maxQ) * maxH;
                return {
                  tx: px - dirScrX * offset,
                  ty: py - dirScrY * offset,
                };
              };

              const t1 = calcTail(p1.px, p1.py, load.qStart_kNm);
              const t2 = calcTail(p2.px, p2.py, load.qEnd_kNm);

              const count = 7;
              const arrows = [];
              for (let i = 0; i <= count; i++) {
                const t = i / count;
                const bx = p1.px + t * (p2.px - p1.px);
                const by = p1.py + t * (p2.py - p1.py);
                const qLocal = load.qStart_kNm + t * (load.qEnd_kNm - load.qStart_kNm);
                if (Math.abs(qLocal) < 0.1) continue;
                const tail = calcTail(bx, by, qLocal);
                arrows.push(
                  <line
                    key={i}
                    x1={tail.tx}
                    y1={tail.ty}
                    x2={bx}
                    y2={by}
                    stroke="#0284C7"
                    strokeWidth="1.5"
                    markerEnd="url(#frame-arrow-blue)"
                  />
                );
              }

              const qLabel =
                Math.abs(load.qStart_kNm - load.qEnd_kNm) < 1e-3
                  ? `${load.label}=${load.qStart_kNm}`
                  : `${load.label}:${load.qStart_kNm}→${load.qEnd_kNm}`;

              return (
                <g key={load.id} className="pointer-events-none">
                  <polygon
                    points={`${p1.px},${p1.py} ${t1.tx},${t1.ty} ${t2.tx},${t2.ty} ${p2.px},${p2.py}`}
                    fill="rgba(2, 132, 199, 0.08)"
                  />
                  <line
                    x1={t1.tx}
                    y1={t1.ty}
                    x2={t2.tx}
                    y2={t2.ty}
                    stroke="#0284C7"
                    strokeWidth="1.8"
                  />
                  {arrows}
                  <text
                    x={(t1.tx + t2.tx) / 2 - dirScrX * 14}
                    y={(t1.ty + t2.ty) / 2 - dirScrY * 12}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="bold"
                    fill="#0284C7"
                  >
                    {qLabel}
                  </text>
                </g>
              );
            }

            if (load.kind === 'member_point_force') {
              const el = input.elements.find((e) => e.id === load.elementId);
              if (!el) return null;
              const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
              const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
              if (!n1 || !n2) return null;

              const gx = n1.x + load.tPosition * (n2.x - n1.x);
              const gy = n1.y + load.tPosition * (n2.y - n1.y);
              const pt = toScreen(gx, gy);
              const p1 = toScreen(n1.x, n1.y);
              const p2 = toScreen(n2.x, n2.y);
              const sLen = Math.hypot(p2.px - p1.px, p2.py - p1.py) || 1;
              const nx = -(p2.py - p1.py) / sLen;
              const ny = (p2.px - p1.px) / sLen;
              const sign = load.magnitude_kN >= 0 ? -1 : 1;

              const sx = pt.px + sign * nx * 48;
              const sy = pt.py + sign * ny * 48;
              return (
                <g
                  key={load.id}
                  className={canvasMode === 'drag' ? 'cursor-grab' : ''}
                  onPointerDown={(e) => {
                    if (canvasMode === 'drag') {
                      startDrag(
                        { kind: 'member_load', loadId: load.id, elementId: el.id },
                        e
                      );
                    }
                  }}
                >
                  <line
                    x1={sx}
                    y1={sy}
                    x2={pt.px}
                    y2={pt.py}
                    stroke="#DC2626"
                    strokeWidth="2.8"
                    markerEnd="url(#frame-arrow-red)"
                  />
                  <circle
                    cx={sx}
                    cy={sy}
                    r="6"
                    fill="#DC2626"
                    fillOpacity="0.18"
                    stroke="#DC2626"
                    strokeWidth="1.2"
                  />
                  <text
                    x={sx + sign * nx * 14}
                    y={sy + sign * ny * 12}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="bold"
                    fill="#DC2626"
                  >
                    {load.label}={Math.abs(load.magnitude_kN)}кН
                  </text>
                </g>
              );
            }

            if (load.kind === 'member_moment') {
              const el = input.elements.find((e) => e.id === load.elementId);
              if (!el) return null;
              const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
              const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
              if (!n1 || !n2) return null;
              const gx = n1.x + load.tPosition * (n2.x - n1.x);
              const gy = n1.y + load.tPosition * (n2.y - n1.y);
              const pt = toScreen(gx, gy);
              const isCCW = load.moment_kNm >= 0;
              return (
                <g
                  key={load.id}
                  className={canvasMode === 'drag' ? 'cursor-grab' : ''}
                  onPointerDown={(e) => {
                    if (canvasMode === 'drag') {
                      startDrag(
                        { kind: 'member_load', loadId: load.id, elementId: el.id },
                        e
                      );
                    }
                  }}
                >
                  <circle cx={pt.px} cy={pt.py} r="14" fill="transparent" />
                  <path
                    d={
                      isCCW
                        ? `M ${pt.px + 16} ${pt.py - 8} A 18 18 0 1 0 ${pt.px - 16} ${pt.py + 8}`
                        : `M ${pt.px - 16} ${pt.py - 8} A 18 18 0 1 1 ${pt.px + 16} ${pt.py + 8}`
                    }
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="2.5"
                    markerEnd="url(#frame-arrow-red)"
                  />
                  <text
                    x={pt.px + 22}
                    y={pt.py - 12}
                    fontSize="11.5"
                    fontWeight="bold"
                    fill="#D97706"
                  >
                    {load.label}={Math.abs(load.moment_kNm)}кН·м
                  </text>
                </g>
              );
            }

            if (load.kind === 'nodal_force') {
              const node = input.nodes.find((n) => n.id === load.nodeId);
              if (!node) return null;
              const pt = toScreen(node.x, node.y);
              const rad = (load.angleDeg * Math.PI) / 180;
              const sx = pt.px - 52 * Math.cos(rad);
              const sy = pt.py + 52 * Math.sin(rad);
              return (
                <g key={load.id}>
                  <line
                    x1={sx}
                    y1={sy}
                    x2={pt.px}
                    y2={pt.py}
                    stroke="#DC2626"
                    strokeWidth="2.8"
                    markerEnd="url(#frame-arrow-red)"
                  />
                  {/* Ручка поворота угла узловой силы */}
                  <circle
                    cx={sx}
                    cy={sy}
                    r="6.5"
                    fill="#DC2626"
                    fillOpacity="0.2"
                    stroke="#DC2626"
                    strokeWidth="1.5"
                    className={canvasMode === 'drag' ? 'cursor-grab' : ''}
                    onPointerDown={(e) => {
                      if (canvasMode === 'drag') {
                        startDrag(
                          {
                            kind: 'nodal_force_angle',
                            loadId: load.id,
                            nodeId: node.id,
                          },
                          e
                        );
                      }
                    }}
                  />
                  <text
                    x={sx - 8}
                    y={sy - 8}
                    fontSize="11.5"
                    fontWeight="bold"
                    fill="#DC2626"
                  >
                    {load.label}={load.magnitude_kN}кН
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* 3. Стержни рамы (+ перетаскивание за середину и клик для выбора в визире) */}
          {input.elements.map((el) => {
            const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
            const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
            if (!n1 || !n2) return null;
            const p1 = toScreen(n1.x, n1.y);
            const p2 = toScreen(n2.x, n2.y);
            const midPx = 0.5 * (p1.px + p2.px);
            const midPy = 0.5 * (p1.py + p2.py);
            const isSelected = activeElementResult?.elementId === el.id;

            return (
              <g key={el.id}>
                <line
                  x1={p1.px}
                  y1={p1.py}
                  x2={p2.px}
                  y2={p2.py}
                  stroke={isSelected ? '#065F46' : '#1E3A8A'}
                  strokeWidth={isSelected ? '5.5' : '4.5'}
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(el.id);
                    setCrosshairS_m(0);
                  }}
                />
                {/* Ручка переноса целого стержня в режиме Drag & Drop */}
                {canvasMode === 'drag' && (
                  <circle
                    cx={midPx}
                    cy={midPy}
                    r="6"
                    fill="#FFFFFF"
                    stroke={isSelected ? '#065F46' : '#1E3A8A'}
                    strokeWidth="2"
                    className="cursor-move"
                    onPointerDown={(e) => {
                      const world = clientToWorld(e.clientX, e.clientY);
                      setSelectedElementId(el.id);
                      startDrag(
                        {
                          kind: 'element',
                          elementId: el.id,
                          startNodeId: n1.id,
                          endNodeId: n2.id,
                          startMouseWorld: world,
                          origStart: { x: n1.x, y: n1.y },
                          origEnd: { x: n2.x, y: n2.y },
                        },
                        e
                      );
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* 4. Векторы вычисленных опорных реакций */}
          {showReactions &&
            output.isStable &&
            output.reactions.map((r) => {
              const { px, py } = toScreen(r.x, r.y);
              return (
                <g key={`reac-${r.nodeId}`} className="pointer-events-none">
                  {Math.abs(r.Ry_kN) > 1e-2 && (
                    <g>
                      <line
                        x1={px}
                        y1={r.Ry_kN >= 0 ? py + 44 : py - 44}
                        x2={px}
                        y2={r.Ry_kN >= 0 ? py + 6 : py - 6}
                        stroke="#2563EB"
                        strokeWidth="2.2"
                        markerEnd="url(#frame-arrow-reaction)"
                      />
                      <text
                        x={px + 8}
                        y={r.Ry_kN >= 0 ? py + 42 : py - 34}
                        fontSize="10.5"
                        fontWeight="bold"
                        fill="#2563EB"
                      >
                        R_{r.nodeLabel.split(' ')[0]}y={r.Ry_kN.toFixed(1)}
                      </text>
                    </g>
                  )}
                  {Math.abs(r.Rx_kN) > 1e-2 && (
                    <g>
                      <line
                        x1={r.Rx_kN >= 0 ? px - 44 : px + 44}
                        y1={py}
                        x2={r.Rx_kN >= 0 ? px - 6 : px + 6}
                        y2={py}
                        stroke="#2563EB"
                        strokeWidth="2.2"
                        markerEnd="url(#frame-arrow-reaction)"
                      />
                      <text
                        x={r.Rx_kN >= 0 ? px - 26 : px + 26}
                        y={py - 8}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="bold"
                        fill="#2563EB"
                      >
                        R_{r.nodeLabel.split(' ')[0]}x={r.Rx_kN.toFixed(1)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 5. Узлы, врезные шарниры C и опоры */}
          {input.nodes.map((node) => {
            const { px, py } = toScreen(node.x, node.y);
            const isPending = pendingStartNodeId === node.id;
            return (
              <g
                key={node.id}
                className={
                  canvasMode === 'drag' || canvasMode === 'add_element'
                    ? 'cursor-pointer'
                    : ''
                }
                onPointerDown={(e) => handleNodePointerDown(node.id, e)}
              >
                {node.support === 'fixed' && (
                  <g>
                    <line
                      x1={px - 18}
                      y1={py + 4}
                      x2={px + 18}
                      y2={py + 4}
                      stroke="#4B5563"
                      strokeWidth="3.5"
                    />
                    {[-14, -7, 0, 7, 14].map((dx, i) => (
                      <line
                        key={i}
                        x1={px + dx}
                        y1={py + 4}
                        x2={px + dx - 6}
                        y2={py + 12}
                        stroke="#4B5563"
                        strokeWidth="1.5"
                      />
                    ))}
                  </g>
                )}

                {(node.support === 'pinned' ||
                  node.support === 'roller_x' ||
                  node.support === 'roller_y') && (
                  <g>
                    <polygon
                      points={`${px},${py + 3} ${px - 11},${py + 21} ${px + 11},${py + 21}`}
                      fill="#FFFFFF"
                      stroke="#4B5563"
                      strokeWidth="2.2"
                    />
                    {node.support === 'roller_x' && (
                      <>
                        <circle cx={px - 5} cy={py + 24} r="2.5" fill="#fff" stroke="#4B5563" strokeWidth="1.5" />
                        <circle cx={px + 5} cy={py + 24} r="2.5" fill="#fff" stroke="#4B5563" strokeWidth="1.5" />
                      </>
                    )}
                    <line
                      x1={px - 15}
                      y1={node.support === 'roller_x' ? py + 27 : py + 21}
                      x2={px + 15}
                      y2={node.support === 'roller_x' ? py + 27 : py + 21}
                      stroke="#4B5563"
                      strokeWidth="2.2"
                    />
                  </g>
                )}

                {/* Зона захвата узла пальцем/мышью */}
                <circle cx={px} cy={py} r="14" fill="transparent" />

                {isPending && (
                  <circle
                    cx={px}
                    cy={py}
                    r="11"
                    fill="rgba(30, 58, 138, 0.15)"
                    stroke="#1E3A8A"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                )}

                {node.isHinge ? (
                  <circle
                    cx={px}
                    cy={py}
                    r="6.5"
                    fill="#FFFFFF"
                    stroke="#065F46"
                    strokeWidth="2.6"
                  />
                ) : (
                  <circle cx={px} cy={py} r="4.8" fill="#1F2937" stroke="#fff" strokeWidth="1.2" />
                )}

                <text
                  x={px + 12}
                  y={py - 8}
                  fontSize="11.5"
                  fontWeight="bold"
                  fill="#1F2937"
                  stroke="#F8F9FA"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {node.label} ({node.x}; {node.y})
                </text>
              </g>
            );
          })}

          {/* 6. Точка визира сечения на активном стержне */}
          {activeCrosshairSample && (
            <g className="pointer-events-none">
              {(() => {
                const cpt = toScreen(
                  activeCrosshairSample.x_global,
                  activeCrosshairSample.y_global
                );
                return (
                  <>
                    <circle
                      cx={cpt.px}
                      cy={cpt.py}
                      r="8"
                      fill="rgba(6, 95, 70, 0.25)"
                      stroke="#065F46"
                      strokeWidth="2"
                    />
                    <circle cx={cpt.px} cy={cpt.py} r="3.5" fill="#065F46" />
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* 4. Визир сечений по стержням рамы (Crosshair Sync для N, Q, M) */}
      {output.isStable && activeElementResult && activeCrosshairSample && (
        <div className="rounded-lg border border-[#065F46]/40 bg-white p-3 shadow-xs md:p-4 print:hidden">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#065F46] md:text-sm">
                Визир сечения вдоль стержня рамы (Crosshair Sync)
              </h3>
              <p className="text-xs text-gray-600">
                Кликните по стержню на схеме или выберите ниже, затем двигайте ползунок s
              </p>
            </div>

            <div className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto whitespace-nowrap px-3 md:mx-0 md:flex-wrap md:px-0">
              {output.elementResults.map((er) => (
                <button
                  key={er.elementId}
                  type="button"
                  onClick={() => {
                    setSelectedElementId(er.elementId);
                    setCrosshairS_m(0);
                  }}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                    activeElementResult.elementId === er.elementId
                      ? 'bg-[#065F46] text-white'
                      : 'bg-gray-100 text-[#1F2937] hover:bg-gray-200'
                  }`}
                >
                  {er.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
            <div className="md:col-span-6">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>
                  Сечение s ={' '}
                  <span className="font-mono text-sm text-[#065F46]">
                    {activeCrosshairSample.s_m.toFixed(2)} м
                  </span>{' '}
                  <span className="font-mono text-gray-500">
                    (X={activeCrosshairSample.x_global.toFixed(2)}; Y=
                    {activeCrosshairSample.y_global.toFixed(2)} м)
                  </span>
                </span>
                <span className="font-mono text-gray-500">
                  L = {activeElementResult.length_m.toFixed(2)} м
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={activeElementResult.length_m}
                step={0.05}
                value={Math.min(crosshairS_m, activeElementResult.length_m)}
                onChange={(e) => setCrosshairS_m(Number(e.target.value))}
                className="pgs-range mt-1"
                style={
                  {
                    ['--pgs-range-fill' as string]: `${
                      (Math.min(crosshairS_m, activeElementResult.length_m) /
                        Math.max(activeElementResult.length_m, 0.01)) *
                      100
                    }%`,
                  } as React.CSSProperties
                }
                aria-label="Координата сечения вдоль стержня рамы"
              />

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { d: -0.5, label: '− 0.5м' },
                  { d: -0.1, label: '− 0.1м' },
                  { d: 0.1, label: '+ 0.1м' },
                  { d: 0.5, label: '+ 0.5м' },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() =>
                      setCrosshairS_m((cur) =>
                        Number(
                          Math.max(
                            0,
                            Math.min(activeElementResult.length_m, cur + btn.d)
                          ).toFixed(2)
                        )
                      )
                    }
                    className="min-h-10 rounded-md border border-gray-300 bg-gray-50 text-xs font-extrabold text-[#1F2937] active:scale-95"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* HUD показателей усилий и напряжений в сечении */}
            <div className="rounded-lg border border-gray-200 bg-[#F8F9FA] p-3 md:col-span-6">
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="rounded bg-white p-2 shadow-2xs">
                  <div className="text-[11px] font-bold text-gray-500">N(s)</div>
                  <div className="text-sm font-extrabold text-[#065F46] md:text-base">
                    {activeCrosshairSample.N_kN.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-500">кН</div>
                </div>
                <div className="rounded bg-blue-50 p-2 shadow-2xs">
                  <div className="text-[11px] font-bold text-blue-700">Q(s)</div>
                  <div className="text-sm font-extrabold text-blue-900 md:text-base">
                    {activeCrosshairSample.Q_kN.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-blue-700">кН</div>
                </div>
                <div className="rounded bg-red-50 p-2 shadow-2xs">
                  <div className="text-[11px] font-bold text-red-700">M(s)</div>
                  <div className="text-sm font-extrabold text-red-900 md:text-base">
                    {Math.abs(activeCrosshairSample.M_kNm).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-red-700">кН·м</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-700">
                <span>
                  Растянуты волокна:{' '}
                  <strong className="text-[#1F2937]">
                    {Math.abs(activeCrosshairSample.M_kNm) < 1e-3
                      ? 'M = 0'
                      : activeCrosshairSample.M_kNm > 0
                      ? 'со стороны +n (внутр./нижние)'
                      : 'со стороны −n (наруж./верхние)'}
                  </strong>
                </span>
                <span className="font-mono text-[11px] text-gray-600">
                  Двутавр №{selectedIBeam.number}: σ ≈{' '}
                  {(
                    (Math.abs(activeCrosshairSample.M_kNm) * 1000) /
                      selectedIBeam.Wz_cm3 +
                    (Math.abs(activeCrosshairSample.N_kN) * 10) /
                      selectedIBeam.A_cm2
                  ).toFixed(1)}{' '}
                  МПа
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Мобильный редактор узлов, стержней и всех нагрузок (< 768px) */}
      <div className="md:hidden print:hidden">
        <MobileFrameEditor
          input={input}
          onChange={onChange}
          addNode={addNode}
          addElement={addElement}
          addNodalForce={addNodalForce}
          addMemberPointForce={addMemberPointForce}
          addMemberDistributed={addMemberDistributed}
          addMemberMoment={addMemberMoment}
        />
      </div>

      {/* 6. Десктопные таблицы редактирования узлов, стержней и нагрузок (md+) */}
      <div className="hidden grid-cols-1 gap-4 md:grid lg:grid-cols-12 print:hidden">
        {/* Узлы рамы */}
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-6">
          <div className="mb-2 flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold uppercase text-[#1F2937]">
              Узлы рамы (координаты X, Y, опоры и шарнир C)
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                <span>[σ]=</span>
                <input
                  type="number"
                  step="10"
                  min="10"
                  value={input.allowableStress_MPa}
                  onChange={(e) =>
                    onChange({
                      ...input,
                      allowableStress_MPa: Math.max(10, Number(e.target.value)),
                    })
                  }
                  className="w-16 rounded border px-1.5 py-0.5 font-mono text-xs"
                />
                <span>МПа</span>
              </label>
              <button
                type="button"
                onClick={addNode}
                className="inline-flex items-center gap-1 rounded bg-[#1F2937] px-2 py-1 text-xs font-semibold text-white hover:bg-gray-800"
              >
                <Plus className="h-3.5 w-3.5" /> Узел
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-1">Узел</th>
                  <th>X (м)</th>
                  <th>Y (м)</th>
                  <th>Опора</th>
                  <th className="text-center">Шарнир C</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {input.nodes.map((n, idx) => (
                  <tr key={n.id}>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={n.label}
                        onChange={(e) => {
                          const next = [...input.nodes];
                          next[idx] = { ...n, label: e.target.value };
                          onChange({ ...input, nodes: next });
                        }}
                        className="w-24 rounded border px-1.5 py-0.5 font-sans font-semibold"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        value={n.x}
                        onChange={(e) => {
                          const next = [...input.nodes];
                          next[idx] = { ...n, x: Number(e.target.value) };
                          onChange({ ...input, nodes: next });
                        }}
                        className="w-14 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        value={n.y}
                        onChange={(e) => {
                          const next = [...input.nodes];
                          next[idx] = { ...n, y: Number(e.target.value) };
                          onChange({ ...input, nodes: next });
                        }}
                        className="w-14 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td className="font-sans">
                      <select
                        value={n.support}
                        onChange={(e) => {
                          const next = [...input.nodes];
                          next[idx] = {
                            ...n,
                            support: e.target.value as FrameSupportType,
                          };
                          onChange({ ...input, nodes: next });
                        }}
                        className="rounded border px-1 py-0.5 text-xs"
                      >
                        <option value="none">Свободный узел</option>
                        <option value="pinned">Шарнирно-неподв. (Rx, Ry)</option>
                        <option value="roller_x">Каток гориз. (Ry)</option>
                        <option value="roller_y">Каток верт. (Rx)</option>
                        <option value="fixed">Жесткая заделка</option>
                      </select>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(n.isHinge)}
                        onChange={(e) => {
                          const next = [...input.nodes];
                          next[idx] = { ...n, isHinge: e.target.checked };
                          onChange({ ...input, nodes: next });
                        }}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeNode(n.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Удалить узел"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Стержни рамы */}
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-6">
          <div className="mb-2 flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold uppercase text-[#1E3A8A]">
              Стержни рамы (стойки, ригели, наклонные ноги)
            </h4>
            <button
              type="button"
              onClick={addElement}
              className="inline-flex items-center gap-1 rounded bg-[#1E3A8A] px-2 py-1 text-xs font-semibold text-white hover:bg-blue-900"
            >
              <Plus className="h-3.5 w-3.5" /> Стержень
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-1">Название</th>
                  <th>Начало</th>
                  <th>Конец</th>
                  <th>Шарнир в нач/кон</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {input.elements.map((el, idx) => (
                  <tr key={el.id}>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={el.label}
                        onChange={(e) => {
                          const next = [...input.elements];
                          next[idx] = { ...el, label: e.target.value };
                          onChange({ ...input, elements: next });
                        }}
                        className="w-36 rounded border px-1.5 py-0.5 font-semibold"
                      />
                    </td>
                    <td>
                      <select
                        value={el.nodeStartId}
                        onChange={(e) => {
                          const next = [...input.elements];
                          next[idx] = { ...el, nodeStartId: e.target.value };
                          onChange({ ...input, elements: next });
                        }}
                        className="rounded border px-1 py-0.5"
                      >
                        {input.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={el.nodeEndId}
                        onChange={(e) => {
                          const next = [...input.elements];
                          next[idx] = { ...el, nodeEndId: e.target.value };
                          onChange({ ...input, elements: next });
                        }}
                        className="rounded border px-1 py-0.5"
                      >
                        {input.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="font-mono text-[11px]">
                      <label className="mr-2">
                        <input
                          type="checkbox"
                          checked={Boolean(el.releaseStart)}
                          onChange={(e) => {
                            const next = [...input.elements];
                            next[idx] = { ...el, releaseStart: e.target.checked };
                            onChange({ ...input, elements: next });
                          }}
                        />{' '}
                        Нач
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(el.releaseEnd)}
                          onChange={(e) => {
                            const next = [...input.elements];
                            next[idx] = { ...el, releaseEnd: e.target.checked };
                            onChange({ ...input, elements: next });
                          }}
                        />{' '}
                        Кон
                      </label>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeElement(el.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Удалить стержень"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Распределенные нагрузки q(s) на стержнях */}
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <h4 className="text-xs font-bold uppercase text-[#0284C7]">
              Распределенные нагрузки q(s) на стержнях
            </h4>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => addMemberDistributed('const')}
                className="inline-flex items-center gap-1 rounded bg-[#0284C7] px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" /> ▭ Равном.
              </button>
              <button
                type="button"
                onClick={() => addMemberDistributed('tri_right')}
                className="inline-flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" /> ◢ 0 → q
              </button>
              <button
                type="button"
                onClick={() => addMemberDistributed('tri_left')}
                className="inline-flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" /> ◣ q → 0
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-1">Имя</th>
                  <th>Стержень</th>
                  <th>Напр.</th>
                  <th>q₁</th>
                  <th>q₂</th>
                  <th>Профиль</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {memberDistributed.map((dl) => {
                  const maxV = Math.max(
                    Math.abs(dl.qStart_kNm),
                    Math.abs(dl.qEnd_kNm),
                    10
                  );
                  const sign = dl.qStart_kNm < 0 || dl.qEnd_kNm < 0 ? -1 : 1;
                  return (
                    <tr key={dl.id}>
                      <td className="py-1.5">
                        <input
                          type="text"
                          value={dl.label}
                          onChange={(e) => updateLoad(dl.id, { label: e.target.value })}
                          className="w-11 rounded border px-1 py-0.5 font-bold"
                        />
                      </td>
                      <td className="font-sans">
                        <select
                          value={dl.elementId}
                          onChange={(e) =>
                            updateLoad(dl.id, { elementId: e.target.value })
                          }
                          className="max-w-28 rounded border px-1 py-0.5 text-xs"
                        >
                          {input.elements.map((el) => (
                            <option key={el.id} value={el.id}>
                              {el.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="font-sans">
                        <select
                          value={dl.direction}
                          onChange={(e) =>
                            updateLoad(dl.id, { direction: e.target.value })
                          }
                          className="rounded border px-1 py-0.5 text-xs"
                        >
                          <option value="local_perp">⊥ стерж.</option>
                          <option value="global_x">по X</option>
                          <option value="global_y">по Y</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={dl.qStart_kNm}
                          onChange={(e) =>
                            updateLoad(dl.id, { qStart_kNm: Number(e.target.value) })
                          }
                          className="w-14 rounded border px-1 py-0.5 font-bold text-[#0284C7]"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={dl.qEnd_kNm}
                          onChange={(e) =>
                            updateLoad(dl.id, { qEnd_kNm: Number(e.target.value) })
                          }
                          className="w-14 rounded border px-1 py-0.5 font-bold text-[#0284C7]"
                        />
                      </td>
                      <td className="font-sans">
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateLoad(dl.id, {
                                qStart_kNm: sign * maxV,
                                qEnd_kNm: sign * maxV,
                              })
                            }
                            className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                            title="Равномерная"
                          >
                            ▭
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateLoad(dl.id, {
                                qStart_kNm: 0,
                                qEnd_kNm: sign * maxV,
                              })
                            }
                            className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                            title="Треугольная 0 → q"
                          >
                            ◢
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateLoad(dl.id, {
                                qStart_kNm: sign * maxV,
                                qEnd_kNm: 0,
                              })
                            }
                            className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                            title="Треугольная q → 0"
                          >
                            ◣
                          </button>
                        </div>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => removeLoad(dl.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="inline h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Сосредоточенные силы (узловые и стержневые) + Моменты M */}
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <h4 className="text-xs font-bold uppercase text-[#DC2626]">
              Сосредоточенные силы P и моменты M
            </h4>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={addNodalForce}
                className="inline-flex items-center gap-1 rounded bg-[#DC2626] px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                <Plus className="h-3.5 w-3.5" /> Сила в узле
              </button>
              <button
                type="button"
                onClick={addMemberPointForce}
                className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                <Plus className="h-3.5 w-3.5" /> Сила на стержне
              </button>
              <button
                type="button"
                onClick={addMemberMoment}
                className="inline-flex items-center gap-1 rounded bg-[#D97706] px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Plus className="h-3.5 w-3.5" /> Момент M
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-1">Имя</th>
                  <th>Тип / Где</th>
                  <th>Величина</th>
                  <th>Угол° / t</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nodalForces.map((nf) => (
                  <tr key={nf.id}>
                    <td className="py-1">
                      <input
                        type="text"
                        value={nf.label}
                        onChange={(e) => updateLoad(nf.id, { label: e.target.value })}
                        className="w-11 rounded border px-1 py-0.5 font-bold"
                      />
                    </td>
                    <td className="font-sans">
                      <select
                        value={nf.nodeId}
                        onChange={(e) => updateLoad(nf.id, { nodeId: e.target.value })}
                        className="rounded border px-1 py-0.5 text-xs"
                      >
                        {input.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            Узел {n.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="5"
                        value={nf.magnitude_kN}
                        onChange={(e) =>
                          updateLoad(nf.id, { magnitude_kN: Number(e.target.value) })
                        }
                        className="w-16 rounded border px-1 py-0.5 font-bold text-[#DC2626]"
                      />{' '}
                      <span className="text-[10px] text-gray-500">кН</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="15"
                        value={nf.angleDeg}
                        onChange={(e) =>
                          updateLoad(nf.id, { angleDeg: Number(e.target.value) })
                        }
                        className="w-14 rounded border px-1 py-0.5"
                      />
                      °
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeLoad(nf.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {memberPointForces.map((mf) => (
                  <tr key={mf.id}>
                    <td className="py-1">
                      <input
                        type="text"
                        value={mf.label}
                        onChange={(e) => updateLoad(mf.id, { label: e.target.value })}
                        className="w-11 rounded border px-1 py-0.5 font-bold"
                      />
                    </td>
                    <td className="font-sans">
                      <select
                        value={mf.elementId}
                        onChange={(e) =>
                          updateLoad(mf.id, { elementId: e.target.value })
                        }
                        className="max-w-28 rounded border px-1 py-0.5 text-xs"
                      >
                        {input.elements.map((el) => (
                          <option key={el.id} value={el.id}>
                            {el.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="2"
                        value={mf.magnitude_kN}
                        onChange={(e) =>
                          updateLoad(mf.id, { magnitude_kN: Number(e.target.value) })
                        }
                        className="w-16 rounded border px-1 py-0.5 font-bold text-[#DC2626]"
                      />{' '}
                      <span className="text-[10px] text-gray-500">кН</span>
                    </td>
                    <td>
                      t=
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        max="0.95"
                        value={mf.tPosition}
                        onChange={(e) =>
                          updateLoad(mf.id, { tPosition: Number(e.target.value) })
                        }
                        className="w-12 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeLoad(mf.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {memberMoments.map((mm) => (
                  <tr key={mm.id}>
                    <td className="py-1">
                      <input
                        type="text"
                        value={mm.label}
                        onChange={(e) => updateLoad(mm.id, { label: e.target.value })}
                        className="w-11 rounded border px-1 py-0.5 font-bold"
                      />
                    </td>
                    <td className="font-sans">
                      <select
                        value={mm.elementId}
                        onChange={(e) =>
                          updateLoad(mm.id, { elementId: e.target.value })
                        }
                        className="max-w-28 rounded border px-1 py-0.5 text-xs"
                      >
                        {input.elements.map((el) => (
                          <option key={el.id} value={el.id}>
                            {el.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="5"
                        value={mm.moment_kNm}
                        onChange={(e) =>
                          updateLoad(mm.id, { moment_kNm: Number(e.target.value) })
                        }
                        className="w-16 rounded border px-1 py-0.5 font-bold text-[#D97706]"
                      />{' '}
                      <span className="text-[10px] text-gray-500">кН·м</span>
                    </td>
                    <td>
                      t=
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        max="0.95"
                        value={mm.tPosition}
                        onChange={(e) =>
                          updateLoad(mm.id, { tPosition: Number(e.target.value) })
                        }
                        className="w-12 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeLoad(mm.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. Ошибка при геометрической изменяемости */}
      {!output.isStable && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <span>Расчет плоской рамы невозможен</span>
          </div>
          <p className="mt-1">
            {output.errorMessage ??
              'Проверьте связи (опоры), соединение стержней и отсутствие мгновенной изменяемости.'}
          </p>
        </div>
      )}

      {/* 8. Полный академический лист РГР по плоской раме (Разделы I–IV + ГОСТ 8239-89) */}
      {output.isStable && academicDoc && (
        <div className="rounded-lg border border-gray-300 bg-white p-3.5 text-[#1F2937] shadow-sm md:p-6 print:border-none print:p-0 print:shadow-none">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1F2937] pb-4 md:mb-6 md:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#065F46] md:text-xs">
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>Кафедра ПГС • Строительная механика (Плоские рамы 2D)</span>
              </div>
              <h2 className="mt-1 text-base font-bold tracking-tight text-[#1F2937] md:text-xl">
                {academicDoc.title}
              </h2>
              <p className="text-xs text-gray-600 md:text-sm">{academicDoc.subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#065F46]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Равновесие выполнено</span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-[#F8F9FA] px-3 py-1.5 text-xs font-semibold text-[#1F2937] transition hover:bg-gray-200 print:hidden"
              >
                <Printer className="h-4 w-4" />
                <span>Печать / Экспорт в PDF</span>
              </button>
            </div>
          </div>

          {/* Раздел I */}
          <section className="mb-6 md:mb-7">
            <h3 className="mb-2 border-l-4 border-[#1F2937] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
              I. Геометрия стержней и приведение внешних нагрузок (FBD)
            </h3>
            <p className="mb-3 text-xs text-gray-700 md:text-sm">
              {academicDoc.fbdSection.description}
            </p>
            <div className="space-y-2.5 rounded-md border border-gray-200 bg-[#F8F9FA] p-2.5 md:p-4">
              {academicDoc.fbdSection.steps.map((step, idx) => (
                <FrameFormulaStep key={idx} step={step} />
              ))}
            </div>
          </section>

          {/* Раздел II */}
          <section className="mb-6 md:mb-7">
            <h3 className="mb-2 border-l-4 border-[#2563EB] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
              II. Определение опорных реакций и проверка равновесия
            </h3>
            <div className="space-y-3 rounded-md border border-gray-200 bg-[#F8F9FA] p-2.5 md:p-4">
              {academicDoc.staticsSection.steps.map((step, idx) => (
                <FrameFormulaStep key={idx} step={step} />
              ))}
              <div className="mt-4 rounded-md border border-[#065F46]/40 bg-[#065F46]/5 p-2.5 md:p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#065F46]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Обязательная проверка равновесия</span>
                </div>
                <FrameFormulaStep step={academicDoc.staticsSection.verificationStep} />
              </div>
            </div>
          </section>

          {/* Раздел III */}
          <section className="mb-6 md:mb-7">
            <h3 className="mb-2 border-l-4 border-[#DC2626] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
              III. Внутренние усилия N, Q, M по стержням рамы
            </h3>
            <p className="mb-4 text-xs text-gray-700 md:text-sm">
              {academicDoc.elementsSection.introText}
            </p>
            <div className="space-y-4">
              {academicDoc.elementsSection.rows.map((row) => (
                <div
                  key={row.elementId}
                  className="rounded-md border border-gray-300 bg-[#F8F9FA] p-2.5 md:p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-gray-200 pb-2">
                    <span className="text-sm font-bold text-[#1F2937] md:text-base">
                      {row.label}
                    </span>
                    <span className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-xs font-semibold">
                      L = {row.length_m.toFixed(2)} м • α = {row.angleDeg}°
                    </span>
                  </div>
                  <div className="space-y-2">
                    {row.steps.map((step, sIdx) => (
                      <FrameFormulaStep key={sIdx} step={step} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Раздел IV */}
          <section>
            <h3 className="mb-2 border-l-4 border-[#065F46] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
              IV. Подбор поперечного сечения по ГОСТ 8239-89 и проверка прочности
            </h3>
            <div className="space-y-3 rounded-md border border-gray-200 bg-[#F8F9FA] p-2.5 md:p-4">
              {academicDoc.strengthSection.steps.map((step, idx) => (
                <FrameFormulaStep key={idx} step={step} />
              ))}
              <div className="mt-3 border-t border-gray-300 pt-2.5 text-sm font-semibold text-[#065F46]">
                Итоговый вывод: {academicDoc.strengthSection.conclusionText}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const FrameFormulaStep: React.FC<{ step: AcademicFormulaStep }> = ({ step }) => (
  <div className="text-sm">
    {step.label && <div className="font-medium text-gray-800">{step.label}</div>}
    <div className="pl-2">
      <KatexBlock math={step.katex} />
    </div>
    {step.note && (
      <div className="mt-0.5 text-xs font-medium text-[#065F46]">{step.note}</div>
    )}
  </div>
);
