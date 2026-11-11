import React, { useRef } from 'react';
import { SteppedRodProblemInput } from '@/types/mechanics';
import { SteppedRodSolverOutput } from '@/core/solver/rodAndShaftSolver';

interface SteppedRodCanvasProps {
  input: SteppedRodProblemInput;
  output: SteppedRodSolverOutput;
  onChange: (updated: SteppedRodProblemInput) => void;
}

export const SteppedRodCanvas: React.FC<SteppedRodCanvasProps> = ({
  input,
  output,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const totalLength = input.segments.reduce((acc, s) => acc + s.length_m, 0);
  const maxArea = Math.max(...input.segments.map((s) => s.area_mm2), input.baseArea_mm2 || 800);

  const width = 880;
  const height = 220;
  const padLeft = 80;
  const padRight = 80;
  const plotWidth = width - padLeft - padRight;
  const yCenter = 110;
  const maxH = 70; // Максимальная графическая высота ступени в пикселях

  const xToPx = (x_m: number) =>
    padLeft + (x_m / Math.max(totalLength, 0.001)) * plotWidth;

  // Определение геометрических координат каждой ступени
  let cursorX = 0;
  const renderedSegments = input.segments.map((seg, idx) => {
    const xStart = cursorX;
    const xEnd = cursorX + seg.length_m;
    cursorX = xEnd;
    const hPx = Math.max(20, (seg.area_mm2 / maxArea) * maxH);
    return {
      ...seg,
      index: idx + 1,
      xStart,
      xEnd,
      hPx,
      px1: xToPx(xStart),
      px2: xToPx(xEnd),
    };
  });

  const toggleFixedEnd = () => {
    onChange({
      ...input,
      fixedEnd: input.fixedEnd === 'left' ? 'right' : 'left',
    });
  };

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1F2937]">
            Интерактивная схема стержня:
          </span>
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
            L = {totalLength.toFixed(2)} м
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-600 font-medium">Опора (заделка):</span>
          <button
            type="button"
            onClick={toggleFixedEnd}
            className="rounded border border-gray-300 bg-[#F8F9FA] px-2.5 py-1 font-semibold text-[#1F2937] transition hover:bg-gray-200"
          >
            {input.fixedEnd === 'left' ? 'Слева (свободен справа)' : 'Справа (свободен слева)'}
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none rounded border border-gray-200 bg-[#F8F9FA] font-mono"
      >
        <defs>
          <pattern id="rod-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#D1D5DB" strokeWidth="1.2" />
          </pattern>
          <marker
            id="rod-force-arrow-pos"
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
            id="rod-force-arrow-neg"
            viewBox="0 0 10 10"
            refX="1"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 10 1.5 L 0 5 L 10 8.5 z" fill="#DC2626" />
          </marker>
        </defs>

        {/* Центральная осевая линия */}
        <line
          x1={padLeft - 20}
          y1={yCenter}
          x2={width - padRight + 20}
          y2={yCenter}
          stroke="#9CA3AF"
          strokeWidth="1"
          strokeDasharray="6 3 2 3"
        />

        {/* Ступени стержня */}
        {renderedSegments.map((seg) => (
          <g key={seg.id}>
            <rect
              x={seg.px1}
              y={yCenter - seg.hPx / 2}
              width={seg.px2 - seg.px1}
              height={seg.hPx}
              fill="url(#rod-hatch)"
              stroke="#1F2937"
              strokeWidth="2.4"
            />
            {/* Подпись ступени и площади */}
            <text
              x={(seg.px1 + seg.px2) / 2}
              y={yCenter + 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fill="#1F2937"
            >
              {seg.areaMultiplier ? `${seg.areaMultiplier}A` : `${seg.area_mm2} мм²`}
            </text>
            <text
              x={(seg.px1 + seg.px2) / 2}
              y={yCenter - seg.hPx / 2 - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#4B5563"
            >
              l_{seg.index} = {seg.length_m} м
            </text>
          </g>
        ))}

        {/* Опорная заделка */}
        {input.fixedEnd === 'left' ? (
          <g>
            <line
              x1={padLeft}
              y1={yCenter - maxH / 2 - 20}
              x2={padLeft}
              y2={yCenter + maxH / 2 + 20}
              stroke="#1F2937"
              strokeWidth="3.5"
            />
            {[-45, -30, -15, 0, 15, 30, 45].map((off, idx) => (
              <line
                key={idx}
                x1={padLeft}
                y1={yCenter + off}
                x2={padLeft - 12}
                y2={yCenter + off - 10}
                stroke="#1F2937"
                strokeWidth="1.5"
              />
            ))}
            <text x={padLeft - 24} y={yCenter - 35} fontSize="11" fontWeight="bold" fill="#1F2937">
              Заделка
            </text>
          </g>
        ) : (
          <g>
            <line
              x1={width - padRight}
              y1={yCenter - maxH / 2 - 20}
              x2={width - padRight}
              y2={yCenter + maxH / 2 + 20}
              stroke="#1F2937"
              strokeWidth="3.5"
            />
            {[-45, -30, -15, 0, 15, 30, 45].map((off, idx) => (
              <line
                key={idx}
                x1={width - padRight}
                y1={yCenter + off}
                x2={width - padRight + 12}
                y2={yCenter + off - 10}
                stroke="#1F2937"
                strokeWidth="1.5"
              />
            ))}
            <text x={width - padRight + 12} y={yCenter - 35} fontSize="11" fontWeight="bold" fill="#1F2937">
              Заделка
            </text>
          </g>
        )}

        {/* Осевые нагрузки P_i */}
        {input.axialLoads.map((load) => {
          const px = xToPx(load.x_m);
          const isRight = load.force_kN >= 0;
          const arrowLen = 42;
          const x1 = isRight ? px - arrowLen : px + arrowLen;
          const x2 = px;

          return (
            <g key={load.id}>
              <line
                x1={x1}
                y1={yCenter}
                x2={x2}
                y2={yCenter}
                stroke="#DC2626"
                strokeWidth="3"
                markerEnd={isRight ? 'url(#rod-force-arrow-pos)' : 'url(#rod-force-arrow-neg)'}
              />
              <circle cx={px} cy={yCenter} r="4" fill="#DC2626" />
              <text
                x={px}
                y={yCenter + maxH / 2 + 22}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#DC2626"
              >
                {load.label} = {Math.abs(load.force_kN)} кН
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};