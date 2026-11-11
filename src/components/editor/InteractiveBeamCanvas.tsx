import React, { useState, useRef } from 'react';
import { BeamProblemInput } from '@/types/mechanics';

interface InteractiveBeamCanvasProps {
  input: BeamProblemInput;
  onChange: (updated: BeamProblemInput) => void;
}

type DragTarget =
  | { kind: 'support'; id: string }
  | { kind: 'load_point'; id: string }
  | { kind: 'load_dist_start'; id: string }
  | { kind: 'load_dist_end'; id: string }
  | null;

export const InteractiveBeamCanvas: React.FC<InteractiveBeamCanvasProps> = ({
  input,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [snapStep, setSnapStep] = useState<number>(0.5);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [showResultantQ, setShowResultantQ] = useState<boolean>(true);

  const width = 920;
  const height = 240;
  const padLeft = 75;
  const padRight = 75;
  const plotWidth = width - padLeft - padRight;
  const yBeam = 135;

  const xToPx = (x: number) =>
    padLeft + (x / Math.max(input.length, 0.1)) * plotWidth;

  const pxToSnappedX = (px: number) => {
    const raw = ((px - padLeft) / plotWidth) * input.length;
    const clamped = Math.max(0, Math.min(input.length, raw));
    const snapped = Math.round(clamped / snapStep) * snapStep;
    return Number(snapped.toFixed(3));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragTarget || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) * width) / rect.width;
    const newX = pxToSnappedX(svgX);

    if (dragTarget.kind === 'support') {
      onChange({
        ...input,
        supports: input.supports.map((s) =>
          s.id === dragTarget.id ? { ...s, x: newX } : s
        ),
      });
    } else if (dragTarget.kind === 'load_point') {
      onChange({
        ...input,
        loads: input.loads.map((l) =>
          l.id === dragTarget.id && (l.kind === 'point_force' || l.kind === 'point_moment')
            ? { ...l, x: newX }
            : l
        ),
      });
    } else if (dragTarget.kind === 'load_dist_start') {
      onChange({
        ...input,
        loads: input.loads.map((l) =>
          l.id === dragTarget.id && l.kind === 'distributed'
            ? { ...l, xStart: Math.min(newX, l.xEnd - 0.1) }
            : l
        ),
      });
    } else if (dragTarget.kind === 'load_dist_end') {
      onChange({
        ...input,
        loads: input.loads.map((l) =>
          l.id === dragTarget.id && l.kind === 'distributed'
            ? { ...l, xEnd: Math.max(newX, l.xStart + 0.1) }
            : l
        ),
      });
    }
  };

  const maxQ = Math.max(
    ...input.loads
      .filter((l) => l.kind === 'distributed')
      .flatMap((l) => (l.kind === 'distributed' ? [Math.abs(l.qStart), Math.abs(l.qEnd)] : [])),
    10
  );

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-3 shadow-xs md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5 md:gap-3">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1F2937]">
            Интерактивный холст балки (Drag & Drop):
          </span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#065F46]">
            Перетаскивайте опоры, силы и края треугольной/равномерной нагрузки мышью
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs md:gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showResultantQ}
              onChange={(e) => setShowResultantQ(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Показать равнодействующую Q̄</span>
          </label>

          <div className="flex items-center gap-1">
            <span className="text-gray-500">Шаг сетки:</span>
            {[0.1, 0.25, 0.5, 1.0].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setSnapStep(step)}
                className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                  snapStep === step
                    ? 'bg-[#1F2937] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {step}м
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full select-none rounded border border-gray-200 bg-[#F8F9FA] font-mono"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragTarget(null)}
        onPointerLeave={() => setDragTarget(null)}
      >
        <defs>
          <marker
            id="arrow-q-blue"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#2563EB" />
          </marker>
          <marker
            id="arrow-force-red"
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
            id="arrow-resultant-dark"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#1F2937" />
          </marker>
        </defs>

        {/* Вертикальные линии сетки */}
        {Array.from({ length: Math.floor(input.length / 0.5) + 1 }).map((_, idx) => {
          const xVal = idx * 0.5;
          if (xVal > input.length + 1e-4) return null;
          const px = xToPx(xVal);
          const isMajor = Math.abs(xVal - Math.round(xVal)) < 1e-4;
          return (
            <g key={idx}>
              <line
                x1={px}
                y1={20}
                x2={px}
                y2={height - 25}
                stroke={isMajor ? '#E5E7EB' : '#F3F4F6'}
                strokeWidth={isMajor ? '1.2' : '1'}
              />
              {isMajor && (
                <text
                  x={px}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6B7280"
                >
                  {xVal}м
                </text>
              )}
            </g>
          );
        })}

        {/* Распределенные нагрузки (прямоугольные, треугольные, трапециевидные) */}
        {input.loads.map((load) => {
          if (load.kind !== 'distributed') return null;
          const x1 = xToPx(load.xStart);
          const x2 = xToPx(load.xEnd);
          const maxH = 54;
          const h1 = (load.qStart / maxQ) * maxH;
          const h2 = (load.qEnd / maxQ) * maxH;
          const y1 = yBeam - 4 - h1;
          const y2 = yBeam - 4 - h2;

          const spanM = Math.max(0.01, load.xEnd - load.xStart);
          const numArrows = Math.max(4, Math.min(14, Math.round((x2 - x1) / 22)));
          const arrows = [];
          for (let i = 0; i <= numArrows; i++) {
            const t = i / numArrows;
            const ax = x1 + t * (x2 - x1);
            const ayTop = y1 + t * (y2 - y1);
            const qLocal = load.qStart + t * (load.qEnd - load.qStart);
            if (Math.abs(qLocal) > 0.2) {
              arrows.push(
                <line
                  key={i}
                  x1={ax}
                  y1={ayTop}
                  x2={ax}
                  y2={yBeam - 5}
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow-q-blue)"
                />
              );
            }
          }

          // Центр тяжести и равнодействующая Q_bar трапеции/треугольника
          const qSum = load.qStart + load.qEnd;
          const Q_resultant = 0.5 * qSum * spanM;
          const xCentroid =
            Math.abs(qSum) > 1e-5
              ? load.xStart + (spanM * (load.qStart + 2 * load.qEnd)) / (3 * qSum)
              : load.xStart + spanM / 2;
          const pxCentroid = xToPx(xCentroid);

          return (
            <g key={load.id}>
              {/* Заливка контура нагрузки */}
              <polygon
                points={`${x1},${yBeam - 4} ${x1},${y1} ${x2},${y2} ${x2},${yBeam - 4}`}
                fill="rgba(37, 99, 235, 0.10)"
              />
              {/* Верхняя огибающая линия (наклонная для треугольника) */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#2563EB"
                strokeWidth="2.2"
              />
              {arrows}

              {/* Подписи интенсивностей q_нач и q_кон */}
              {Math.abs(load.qStart - load.qEnd) < 1e-3 ? (
                <text
                  x={(x1 + x2) / 2}
                  y={Math.min(y1, y2) - 8}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="bold"
                  fill="#2563EB"
                >
                  {load.label} = {load.qStart} кН/м
                </text>
              ) : (
                <>
                  {Math.abs(load.qStart) > 1e-2 && (
                    <text
                      x={x1}
                      y={y1 - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#2563EB"
                    >
                      {load.qStart} кН/м
                    </text>
                  )}
                  {Math.abs(load.qEnd) > 1e-2 && (
                    <text
                      x={x2}
                      y={y2 - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#2563EB"
                    >
                      {load.label}_max = {load.qEnd} кН/м
                    </text>
                  )}
                </>
              )}

              {/* Отображение равнодействующей Q_bar и привязки 2/3 AB и 1/3 AB */}
              {showResultantQ && Math.abs(Q_resultant) > 1e-2 && (
                <g>
                  <line
                    x1={pxCentroid}
                    y1={yBeam}
                    x2={pxCentroid}
                    y2={yBeam + 46}
                    stroke="#1F2937"
                    strokeWidth="2.2"
                    strokeDasharray="3 2"
                    markerEnd="url(#arrow-resultant-dark)"
                  />
                  <text
                    x={pxCentroid + 8}
                    y={yBeam + 42}
                    fontSize="11.5"
                    fontWeight="bold"
                    fill="#1F2937"
                  >
                    Q̄ = {Q_resultant.toFixed(1)} кН (x_C={xCentroid.toFixed(2)}м)
                  </text>
                </g>
              )}

              {/* Маркеры перетаскивания границ участка q */}
              <circle
                cx={x1}
                cy={y1}
                r="5.5"
                fill="#2563EB"
                stroke="#fff"
                strokeWidth="1.5"
                className="cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'load_dist_start', id: load.id });
                }}
              />
              <circle
                cx={x2}
                cy={y2}
                r="5.5"
                fill="#2563EB"
                stroke="#fff"
                strokeWidth="1.5"
                className="cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'load_dist_end', id: load.id });
                }}
              />
            </g>
          );
        })}

        {/* Стержень балки */}
        <line
          x1={padLeft}
          y1={yBeam}
          x2={width - padRight}
          y2={yBeam}
          stroke="#1F2937"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Опоры и врезные шарниры */}
        {input.supports.map((sup) => {
          const px = xToPx(sup.x);
          return (
            <g
              key={sup.id}
              className="cursor-ew-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDragTarget({ kind: 'support', id: sup.id });
              }}
            >
              {sup.type === 'internal_hinge' ? (
                <circle
                  cx={px}
                  cy={yBeam}
                  r="6"
                  fill="#FFFFFF"
                  stroke="#1F2937"
                  strokeWidth="2.5"
                />
              ) : sup.type === 'fixed' ? (
                <g>
                  <line
                    x1={px}
                    y1={yBeam - 28}
                    x2={px}
                    y2={yBeam + 28}
                    stroke="#1F2937"
                    strokeWidth="4"
                  />
                  {[-24, -12, 0, 12, 24].map((dy, i) => (
                    <line
                      key={i}
                      x1={px}
                      y1={yBeam + dy}
                      x2={sup.x <= input.length / 2 ? px - 10 : px + 10}
                      y2={yBeam + dy - 8}
                      stroke="#1F2937"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              ) : (
                <g>
                  <polygon
                    points={`${px},${yBeam + 3} ${px - 11},${yBeam + 22} ${px + 11},${yBeam + 22}`}
                    fill="#FFFFFF"
                    stroke="#1F2937"
                    strokeWidth="2.2"
                  />
                  {sup.type === 'roller' && (
                    <line
                      x1={px - 14}
                      y1={yBeam + 27}
                      x2={px + 14}
                      y2={yBeam + 27}
                      stroke="#1F2937"
                      strokeWidth="2.2"
                    />
                  )}
                </g>
              )}
              <text
                x={px}
                y={yBeam + 42}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#1F2937"
              >
                {sup.label}
              </text>
            </g>
          );
        })}

        {/* Сосредоточенные силы F и Моменты M */}
        {input.loads.map((load) => {
          if (load.kind === 'point_force') {
            const px = xToPx(load.x);
            const rad = (load.angleDeg * Math.PI) / 180;
            const len = 52;
            const xStart = px - len * Math.cos(rad);
            const yStart = yBeam + len * Math.sin(rad);
            return (
              <g
                key={load.id}
                className="cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'load_point', id: load.id });
                }}
              >
                <line
                  x1={xStart}
                  y1={yStart}
                  x2={px}
                  y2={yBeam}
                  stroke="#DC2626"
                  strokeWidth="3"
                  markerEnd="url(#arrow-force-red)"
                />
                <text
                  x={xStart}
                  y={yStart - 6}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="bold"
                  fill="#DC2626"
                >
                  {load.label}={load.magnitude}кН
                </text>
              </g>
            );
          }

          if (load.kind === 'point_moment') {
            const px = xToPx(load.x);
            const isCCW = load.direction === 'ccw';
            return (
              <g
                key={load.id}
                className="cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'load_point', id: load.id });
                }}
              >
                <path
                  d={
                    isCCW
                      ? `M ${px + 14} ${yBeam - 18} A 18 18 0 1 0 ${px - 14} ${yBeam + 18}`
                      : `M ${px - 14} ${yBeam - 18} A 18 18 0 1 1 ${px + 14} ${yBeam + 18}`
                  }
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="2.6"
                />
                <text
                  x={px}
                  y={yBeam - 26}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="bold"
                  fill="#D97706"
                >
                  {load.label}={load.magnitude}кН·м
                </text>
              </g>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
};