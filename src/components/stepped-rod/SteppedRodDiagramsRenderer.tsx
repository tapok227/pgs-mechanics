import React, { useState, useRef } from 'react';
import { SteppedRodProblemInput } from '@/types/mechanics';
import { SteppedRodSolverOutput } from '@/core/solver/rodAndShaftSolver';
import { PGS_PALETTE } from '../diagrams/svgMathUtils';

interface SteppedRodDiagramsRendererProps {
  input: SteppedRodProblemInput;
  output: SteppedRodSolverOutput;
}

export const SteppedRodDiagramsRenderer: React.FC<SteppedRodDiagramsRendererProps> = ({
  input,
  output,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const totalLength = input.segments.reduce((acc, s) => acc + s.length_m, 0);

  const width = 880;
  const height = 480;
  const padLeft = 80;
  const padRight = 80;
  const plotWidth = width - padLeft - padRight;

  const yDiagramN = 100;      // Эпюра N (кН)
  const yDiagramSigma = 240;  // Эпюра sigma (МПа)
  const yDiagramU = 390;      // Эпюра u (мм)
  const maxAmp = 50;

  const xToPx = (x_m: number) =>
    padLeft + (x_m / Math.max(totalLength, 0.001)) * plotWidth;

  const pxToX = (px: number) => {
    const raw = ((px - padLeft) / plotWidth) * totalLength;
    return Math.max(0, Math.min(totalLength, raw));
  };

  const maxN = Math.max(...output.segments.map((s) => Math.abs(s.N_kN)), 1);
  const maxSigma = Math.max(...output.segments.map((s) => Math.abs(s.sigma_MPa)), 1);
  const maxU = Math.max(
    ...output.segments.map((s) => Math.max(Math.abs(s.uStart_mm), Math.abs(s.uEnd_mm))),
    0.01
  );

  const scaleN = maxAmp / maxN;
  const scaleSigma = maxAmp / maxSigma;
  const scaleU = maxAmp / maxU;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const svgX = (e.clientX - rect.left) * scaleX;
    if (svgX < padLeft || svgX > width - padRight) {
      setHoverX(null);
      return;
    }
    setHoverX(Number(pxToX(svgX).toFixed(3)));
  };

  // Выборка данных для визира
  const activeSample = hoverX !== null
    ? output.segments.find((s) => hoverX >= s.xStart_m - 1e-4 && hoverX <= s.xEnd_m + 1e-4) ?? output.segments[0]
    : null;

  const sampleU = activeSample && hoverX !== null
    ? activeSample.uStart_mm +
      ((hoverX - activeSample.xStart_m) / activeSample.length_m) * (activeSample.uEnd_mm - activeSample.uStart_mm)
    : 0;

  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-gray-300 bg-[#F8F9FA] p-3 shadow-sm">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none font-mono"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverX(null)}
      >
        {/* Базовые нулевые линии эпюр */}
        <line x1={padLeft} y1={yDiagramN} x2={width - padRight} y2={yDiagramN} stroke="#1F2937" strokeWidth="1.8" />
        <line x1={padLeft} y1={yDiagramSigma} x2={width - padRight} y2={yDiagramSigma} stroke="#1F2937" strokeWidth="1.8" />
        <line x1={padLeft} y1={yDiagramU} x2={width - padRight} y2={yDiagramU} stroke="#1F2937" strokeWidth="1.8" />

        {/* Названия эпюр слева */}
        <text x="14" y={yDiagramN - 6} fill="#1F2937" fontSize="13" fontWeight="bold">N (кН)</text>
        <text x="14" y={yDiagramSigma - 6} fill="#1F2937" fontSize="13" fontWeight="bold">σ (МПа)</text>
        <text x="14" y={yDiagramU - 6} fill="#1F2937" fontSize="13" fontWeight="bold">u (мм)</text>

        {/* 1. ЭПЮРА ПРОДОЛЬНЫХ СИЛ N (кН) */}
        {output.segments.map((seg) => {
          const x1 = xToPx(seg.xStart_m);
          const x2 = xToPx(seg.xEnd_m);
          const yVal = yDiagramN - seg.N_kN * scaleN;
          const isTensile = seg.N_kN >= 0;

          return (
            <g key={`diag-N-${seg.segmentId}`}>
              <polygon
                points={`${x1},${yDiagramN} ${x1},${yVal} ${x2},${yVal} ${x2},${yDiagramN}`}
                fill={isTensile ? 'rgba(37, 99, 235, 0.08)' : 'rgba(220, 38, 38, 0.08)'}
                stroke="#1F2937"
                strokeWidth="1.6"
              />
              {/* Знаки (+) и (-) в кружках */}
              {Math.abs(seg.N_kN) > 1e-2 && (
                <g transform={`translate(${(x1 + x2) / 2}, ${(yDiagramN + yVal) / 2})`}>
                  <circle r="8" fill="#fff" stroke="#1F2937" strokeWidth="1" />
                  <text x="0" y="3.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill={isTensile ? '#2563EB' : '#DC2626'}>
                    {isTensile ? '+' : '-'}
                  </text>
                </g>
              )}
              {/* Ордината */}
              <text
                x={(x1 + x2) / 2}
                y={yVal + (seg.N_kN >= 0 ? -6 : 14)}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#1F2937"
              >
                {Math.abs(seg.N_kN).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* 2. ЭПЮРА НАПРЯЖЕНИЙ sigma (МПа) */}
        {output.segments.map((seg) => {
          const x1 = xToPx(seg.xStart_m);
          const x2 = xToPx(seg.xEnd_m);
          const yVal = yDiagramSigma - seg.sigma_MPa * scaleSigma;
          const isTensile = seg.sigma_MPa >= 0;

          return (
            <g key={`diag-sigma-${seg.segmentId}`}>
              <polygon
                points={`${x1},${yDiagramSigma} ${x1},${yVal} ${x2},${yVal} ${x2},${yDiagramSigma}`}
                fill={isTensile ? 'rgba(37, 99, 235, 0.08)' : 'rgba(220, 38, 38, 0.08)'}
                stroke="#1F2937"
                strokeWidth="1.6"
              />
              <text
                x={(x1 + x2) / 2}
                y={yVal + (seg.sigma_MPa >= 0 ? -6 : 14)}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#1F2937"
              >
                {Math.abs(seg.sigma_MPa).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* 3. ЭПЮРА ПЕРЕМЕЩЕНИЙ u (мм) */}
        {output.segments.map((seg) => {
          const x1 = xToPx(seg.xStart_m);
          const x2 = xToPx(seg.xEnd_m);
          const y1 = yDiagramU - seg.uStart_mm * scaleU;
          const y2 = yDiagramU - seg.uEnd_mm * scaleU;

          return (
            <g key={`diag-u-${seg.segmentId}`}>
              <polygon
                points={`${x1},${yDiagramU} ${x1},${y1} ${x2},${y2} ${x2},${yDiagramU}`}
                fill="rgba(6, 95, 70, 0.08)"
              />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#065F46" strokeWidth="2.2" />
              <line x1={x1} y1={yDiagramU} x2={x1} y2={y1} stroke="#1F2937" strokeWidth="1" />
              <line x1={x2} y1={yDiagramU} x2={x2} y2={y2} stroke="#1F2937" strokeWidth="1" />
              <text x={x2} y={y2 + (seg.uEnd_mm >= 0 ? -6 : 12)} textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="#065F46">
                {seg.uEnd_mm.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* Сквозной визир Crosshair Sync */}
        {hoverX !== null && (
          <g className="pointer-events-none">
            <line
              x1={xToPx(hoverX)}
              y1={50}
              x2={xToPx(hoverX)}
              y2={height - 20}
              stroke="#065F46"
              strokeWidth="1.6"
              strokeDasharray="4 3"
            />
          </g>
        )}
      </svg>

      {/* Тултип визира */}
      {hoverX !== null && activeSample && (
        <div className="pointer-events-none absolute top-3 right-3 z-10 w-64 rounded border border-[#065F46]/40 bg-white/95 p-2.5 text-xs text-[#1F2937] shadow-md backdrop-blur-sm">
          <div className="font-bold text-[#065F46] border-b border-gray-200 pb-1">
            Координата x = {hoverX.toFixed(2)} м
          </div>
          <div className="mt-1 space-y-1 font-mono text-[11px]">
            <div>N(x) = <span className="font-bold">{activeSample.N_kN.toFixed(1)} кН</span></div>
            <div>σ(x) = <span className="font-bold">{activeSample.sigma_MPa.toFixed(1)} МПа</span></div>
            <div>u(x) = <span className="font-bold">{sampleU.toFixed(4)} мм</span></div>
          </div>
        </div>
      )}
    </div>
  );
};