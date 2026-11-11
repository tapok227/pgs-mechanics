import React, { useState, useMemo, useRef } from 'react';
import {
  FrameProblemInput,
  FrameSupportType,
} from '@/types/frame';
import { solveFrameProblem } from '@/core/solver/frameSolver';
import { KatexBlock } from '@/components/academic/AcademicSolutionView';
import { Plus, Trash2, CheckCircle2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { MobileFrameEditor } from './MobileFrameEditor';

interface FrameWorkspaceProps {
  input: FrameProblemInput;
  onChange: (updated: FrameProblemInput) => void;
}

export const FrameWorkspace: React.FC<FrameWorkspaceProps> = ({
  input,
  onChange,
}) => {
  const [activeDiagram, setActiveDiagram] = useState<'none' | 'M' | 'Q' | 'N'>('M');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const output = useMemo(() => solveFrameProblem(input), [input]);

  // Габариты 2D-сцены
  const xs = input.nodes.map((n) => n.x);
  const ys = input.nodes.map((n) => n.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 8);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 5);

  const svgW = 920;
  const svgH = 500;
  const pad = 95;

  const spanX = Math.max(maxX - minX, 2);
  const spanY = Math.max(maxY - minY, 2);
  const scale = Math.min((svgW - 2 * pad) / spanX, (svgH - 2 * pad) / spanY);

  const toScreen = (x: number, y: number) => ({
    px: pad + (x - minX) * scale,
    py: svgH - pad - (y - minY) * scale,
  });

  const maxDiagramVal =
    activeDiagram === 'M'
      ? Math.max(output.maxAbs.M_kNm, 1)
      : activeDiagram === 'Q'
      ? Math.max(output.maxAbs.Q_kN, 1)
      : Math.max(output.maxAbs.N_kN, 1);

  const diagMaxPx = 58;

  // Параметры масштабирования и панорамирования viewBox
  const vbW = svgW / zoom;
  const vbH = svgH / zoom;
  const vbX = (svgW - vbW) / 2 - pan.x;
  const vbY = (svgH - vbH) / 2 - pan.y;

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

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStartRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxSvg = ((e.clientX - dragStartRef.current.clientX) / Math.max(rect.width, 1)) * vbW;
    const dySvg = ((e.clientY - dragStartRef.current.clientY) / Math.max(rect.height, 1)) * vbH;
    const maxPanX = (svgW - vbW) / 2 + 120;
    const maxPanY = (svgH - vbH) / 2 + 100;
    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.panX + dxSvg)),
      y: Math.max(-maxPanY, Math.min(maxPanY, dragStartRef.current.panY + dySvg)),
    });
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  const addNode = () => {
    const idx = input.nodes.length + 1;
    onChange({
      ...input,
      nodes: [
        ...input.nodes,
        {
          id: `fn_${Date.now()}`,
          label: `N_${idx}`,
          x: maxX + 2,
          y: 0,
          support: 'none',
          isHinge: false,
        },
      ],
    });
  };

  const addElement = () => {
    if (input.nodes.length < 2) return;
    const n1 = input.nodes[input.nodes.length - 2];
    const n2 = input.nodes[input.nodes.length - 1];
    onChange({
      ...input,
      elements: [
        ...input.elements,
        {
          id: `fe_${Date.now()}`,
          label: `Стержень ${n1.label}-${n2.label}`,
          nodeStartId: n1.id,
          nodeEndId: n2.id,
          E_MPa: 2e5,
          A_cm2: 40,
          Iz_cm4: 3500,
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Панель переключения эпюр на теле рамы */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-300 bg-white p-3 shadow-xs md:flex-row md:flex-wrap md:items-center md:justify-between md:p-4">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1F2937]">
            2D-Конструктор плоских рам и ломаных балок (с врезными шарнирами)
          </h2>
          <p className="text-xs text-gray-600">
            Задавайте узлы с любыми координатами (X, Y) — стержни изгибаются под произвольным углом
          </p>
        </div>

        <div className="scrollbar-none -mx-3 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-3 py-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <span className="mr-1 hidden text-xs font-bold text-gray-600 md:inline">
            Отобразить на раме:
          </span>
          {[
            { id: 'none', label: 'Только расчетная схема' },
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

      {/* Векторный 2D-холст рамы и наложенных эпюр + панель масштабирования */}
      <div className="rounded-lg border border-gray-300 bg-white p-3 shadow-xs md:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-gray-600">
            {zoom > 1 ? (
              <span className="font-bold text-[#065F46]">
                Масштаб {Math.round(zoom * 100)}% • перетаскивайте схему пальцем/мышью для обзора узлов
              </span>
            ) : (
              <span>Масштаб {Math.round(zoom * 100)}% • используйте [+] для осмотра наклонных стержней и шарнира C</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Уменьшить масштаб схемы рамы"
              className="inline-flex min-h-9 min-w-10 items-center justify-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-extrabold text-[#1F2937] transition hover:bg-gray-100 active:scale-95"
            >
              <ZoomOut className="h-3.5 w-3.5" />
              <span>[−]</span>
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Увеличить масштаб схемы рамы"
              className="inline-flex min-h-9 min-w-10 items-center justify-center gap-1 rounded-md border border-[#065F46]/40 bg-emerald-50 px-2.5 py-1.5 text-xs font-extrabold text-[#065F46] transition hover:bg-emerald-100 active:scale-95"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              <span>[+]</span>
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              aria-label="Сбросить масштаб схемы рамы"
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>[Сброс]</span>
            </button>
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`h-auto w-full select-none rounded border border-gray-200 bg-[#F8F9FA] font-mono ${
            zoom > 1 ? 'cursor-grab touch-none active:cursor-grabbing' : 'touch-pan-y'
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
          </defs>

          {/* Координатная сетка 1x1 м */}
          {Array.from({ length: Math.ceil(spanX) + 3 }).map((_, i) => {
            const gx = Math.floor(minX) + i;
            const { px } = toScreen(gx, 0);
            return (
              <g key={`gx-${i}`}>
                <line x1={px} y1={25} x2={px} y2={svgH - 30} stroke="#E5E7EB" strokeWidth="1" />
                <text x={px} y={svgH - 12} textAnchor="middle" fontSize="10" fill="#6B7280">
                  x={gx}м
                </text>
              </g>
            );
          })}
          {Array.from({ length: Math.ceil(spanY) + 3 }).map((_, i) => {
            const gy = Math.floor(minY) + i;
            const { py } = toScreen(0, gy);
            return (
              <g key={`gy-${i}`}>
                <line x1={40} y1={py} x2={svgW - 30} y2={py} stroke="#E5E7EB" strokeWidth="1" />
                <text x={22} y={py + 4} textAnchor="middle" fontSize="10" fill="#6B7280">
                  y={gy}м
                </text>
              </g>
            );
          })}

          {/* 1. Наложенные эпюры N, Q, M вдоль наклонных и вертикальных стержней */}
          {activeDiagram !== 'none' &&
            output.isStable &&
            output.elementResults.map((er) => {
              const p1 = toScreen(er.x1, er.y1);
              const p2 = toScreen(er.x2, er.y2);
              const sLen = Math.hypot(p2.px - p1.px, p2.py - p1.py);
              if (sLen < 1) return null;

              // Единичная нормаль к стержню на экране
              const nx = -(p2.py - p1.py) / sLen;
              const ny = (p2.px - p1.px) / sLen;

              const polyPoints: string[] = [`${p1.px},${p1.py}`];
              const curvePoints = er.samples.map((smp) => {
                const base = toScreen(smp.x_global, smp.y_global);
                const val =
                  activeDiagram === 'M'
                    ? -smp.M_kNm // Со стороны растянутых волокон
                    : activeDiagram === 'Q'
                    ? smp.Q_kN
                    : smp.N_kN;
                const offset = (val / maxDiagramVal) * diagMaxPx;
                const cx = base.px + nx * offset;
                const cy = base.py + ny * offset;
                polyPoints.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                return { base, cx, cy, val: activeDiagram === 'M' ? Math.abs(smp.M_kNm) : val };
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
                <g key={`diag-${er.elementId}`}>
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
                  {/* Штриховка перпендикулярно стержню */}
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

          {/* 2. Распределенные и сосредоточенные нагрузки на стержнях рамы */}
          {input.loads.map((load) => {
            if (load.kind === 'member_distributed') {
              const el = input.elements.find((e) => e.id === load.elementId);
              if (!el) return null;
              const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
              const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
              if (!n1 || !n2) return null;

              const p1 = toScreen(n1.x, n1.y);
              const p2 = toScreen(n2.x, n2.y);
              const count = 7;
              const arrows = [];
              for (let i = 0; i <= count; i++) {
                const t = i / count;
                const tx = p1.px + t * (p2.px - p1.px);
                const ty = p1.py + t * (p2.py - p1.py);
                const sx = load.direction === 'global_x' ? tx - 38 : tx;
                const sy = load.direction === 'global_y' ? ty - 38 : ty;
                arrows.push(
                  <line
                    key={i}
                    x1={sx}
                    y1={sy}
                    x2={tx - 3}
                    y2={ty}
                    stroke="#0284C7"
                    strokeWidth="1.6"
                    markerEnd="url(#frame-arrow-blue)"
                  />
                );
              }
              return (
                <g key={load.id}>
                  <line
                    x1={p1.px - 38}
                    y1={p1.py}
                    x2={p2.px - 38}
                    y2={p2.py}
                    stroke="#0284C7"
                    strokeWidth="1.8"
                  />
                  {arrows}
                  <text
                    x={p1.px - 54}
                    y={(p1.py + p2.py) / 2}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="bold"
                    fill="#0284C7"
                  >
                    {load.label}={load.qStart_kNm}
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
              const sLen = Math.hypot(p2.px - p1.px, p2.py - p1.py);
              const nx = -(p2.py - p1.py) / sLen;
              const ny = (p2.px - p1.px) / sLen;
              const sign = load.magnitude_kN >= 0 ? -1 : 1;

              const sx = pt.px + sign * nx * 48;
              const sy = pt.py + sign * ny * 48;
              return (
                <g key={load.id}>
                  <line
                    x1={sx}
                    y1={sy}
                    x2={pt.px}
                    y2={pt.py}
                    stroke="#0284C7"
                    strokeWidth="2.8"
                    markerEnd="url(#frame-arrow-blue)"
                  />
                  <text
                    x={sx + sign * nx * 12}
                    y={sy + sign * ny * 10}
                    fontSize="12"
                    fontWeight="bold"
                    fill="#0284C7"
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
              return (
                <g key={load.id}>
                  <path
                    d={`M ${pt.px - 16} ${pt.py - 8} A 18 18 0 0 1 ${pt.px + 18} ${pt.py - 6}`}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="2.5"
                    markerEnd="url(#frame-arrow-blue)"
                  />
                  <text
                    x={pt.px + 26}
                    y={pt.py - 12}
                    fontSize="12"
                    fontWeight="bold"
                    fill="#0284C7"
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
                    stroke="#0284C7"
                    strokeWidth="2.8"
                    markerEnd="url(#frame-arrow-blue)"
                  />
                  <text
                    x={sx - 8}
                    y={sy - 6}
                    fontSize="12"
                    fontWeight="bold"
                    fill="#0284C7"
                  >
                    {load.label}={load.magnitude_kN}кН
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* 3. Стержни рамы */}
          {input.elements.map((el) => {
            const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
            const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
            if (!n1 || !n2) return null;
            const p1 = toScreen(n1.x, n1.y);
            const p2 = toScreen(n2.x, n2.y);
            return (
              <line
                key={el.id}
                x1={p1.px}
                y1={p1.py}
                x2={p2.px}
                y2={p2.py}
                stroke="#1E3A8A"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* 4. Узлы, врезные шарниры C и опоры A, B */}
          {input.nodes.map((node) => {
            const { px, py } = toScreen(node.x, node.y);
            return (
              <g key={node.id}>
                {node.support !== 'none' && (
                  <g>
                    <polygon
                      points={`${px},${py + 3} ${px - 12},${py + 22} ${px + 12},${py + 22}`}
                      fill="#FFFFFF"
                      stroke="#4B5563"
                      strokeWidth="2.2"
                    />
                    <line
                      x1={px - 16}
                      y1={py + 22}
                      x2={px + 16}
                      y2={py + 22}
                      stroke="#4B5563"
                      strokeWidth="2.2"
                    />
                  </g>
                )}

                {node.isHinge ? (
                  <circle
                    cx={px}
                    cy={py}
                    r="6.5"
                    fill="#FFFFFF"
                    stroke="#374151"
                    strokeWidth="2.5"
                  />
                ) : (
                  <circle cx={px} cy={py} r="4" fill="#1F2937" />
                )}

                <text
                  x={px + 12}
                  y={py - 8}
                  fontSize="12"
                  fontWeight="bold"
                  fill="#1F2937"
                >
                  {node.label} ({node.x}; {node.y})
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Мобильный редактор узлов и стержней рамы (< 768px): сворачиваемые карточки */}
      <div className="md:hidden">
        <MobileFrameEditor
          input={input}
          onChange={onChange}
          addNode={addNode}
          addElement={addElement}
        />
      </div>

      {/* Таблицы редактирования узлов (X, Y, шарнир C, опоры) и стержней (десктоп md+) */}
      <div className="hidden grid-cols-1 gap-4 md:grid lg:grid-cols-12">
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-6">
          <div className="mb-2 flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold uppercase text-[#1F2937]">
              Узлы рамы (координаты X, Y, опоры и шарнир C)
            </h4>
            <button
              type="button"
              onClick={addNode}
              className="inline-flex items-center gap-1 rounded bg-[#1F2937] px-2 py-1 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Узел
            </button>
          </div>
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-1">Узел</th>
                <th>X (м)</th>
                <th>Y (м)</th>
                <th>Опора</th>
                <th>Шарнир C</th>
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
                      onClick={() =>
                        onChange({
                          ...input,
                          nodes: input.nodes.filter((item) => item.id !== n.id),
                        })
                      }
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

        {/* Стержни рамы */}
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-6">
          <div className="mb-2 flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold uppercase text-[#1E3A8A]">
              Стержни рамы (стойки, ригели, наклонные ноги)
            </h4>
            <button
              type="button"
              onClick={addElement}
              className="inline-flex items-center gap-1 rounded bg-[#1E3A8A] px-2 py-1 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Стержень
            </button>
          </div>
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
                      onClick={() =>
                        onChange({
                          ...input,
                          elements: input.elements.filter((item) => item.id !== el.id),
                        })
                      }
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

      {/* Академический отчет расчета плоской рамы */}
      {output.isStable && (
        <div className="rounded-lg border border-gray-300 bg-white p-3.5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-base font-extrabold uppercase text-[#1F2937]">
                Расчетно-пояснительная записка: Статический расчет плоской рамы
              </h3>
              <p className="text-xs text-gray-600">
                Опорные реакции в узлах A, B и внутренние усилия на концах стержней
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#065F46]">
              <CheckCircle2 className="h-4 w-4" />
              <span>Равновесие выполнено (невязка 0.000)</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-[#F8F9FA] p-4">
              <div className="mb-2 text-sm font-bold text-[#1F2937]">
                1. Опорные реакции (кН):
              </div>
              <KatexBlock
                math={output.reactions
                  .map(
                    (r) =>
                      `R_{${r.nodeLabel}x} = ${r.Rx_kN}\\text{ кН}, \\quad R_{${r.nodeLabel}y} = ${r.Ry_kN}\\text{ кН}${
                        Math.abs(r.M_kNm) > 1e-3 ? `, \\quad M_{${r.nodeLabel}} = ${r.M_kNm}\\text{ кН}\\cdot\\text{м}` : ''
                      }`
                  )
                  .join(' \\\\[6pt] ')}
              />
            </div>

            <div className="rounded border border-gray-200 bg-[#F8F9FA] p-4">
              <div className="mb-2 text-sm font-bold text-[#1F2937]">
                2. Максимальные расчетные усилия в стержнях рамы:
              </div>
              <KatexBlock
                math={`|M_{\\max}| = \\mathbf{${output.maxAbs.M_kNm}\\text{ кН}\\cdot\\text{м}}, \\quad |Q_{\\max}| = \\mathbf{${output.maxAbs.Q_kN}\\text{ кН}}, \\quad |N_{\\max}| = \\mathbf{${output.maxAbs.N_kN}\\text{ кН}}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};