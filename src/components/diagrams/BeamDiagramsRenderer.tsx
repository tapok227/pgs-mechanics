import React, { useState, useRef, useMemo } from 'react';
import {
  BeamProblemInput,
  BeamSolverOutput,
  SupportNode,
  BeamLoad,
} from '../../types/mechanics';
import { sampleBeamAtX, evalPoly } from '../../core/solver/beamSolver';
import {
  PGS_PALETTE,
  buildPolynomialDiagramPath,
  generateHatchLines,
  computeSignBadgePositions,
} from './svgMathUtils';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface BeamDiagramsRendererProps {
  input: BeamProblemInput;
  solverOutput: BeamSolverOutput;
  width?: number;
  showNormalForceDiagram?: boolean;
  onCrosshairMove?: (xMeters: number | null) => void;
}

export const BeamDiagramsRenderer: React.FC<BeamDiagramsRendererProps> = ({
  input,
  solverOutput,
  width = 960,
  showNormalForceDiagram,
  onCrosshairMove,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverX_m, setHoverX_m] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const hasAxialForces = useMemo(() => {
    if (showNormalForceDiagram !== undefined) return showNormalForceDiagram;
    return solverOutput.extremaAndMax.N_max_abs > 1e-3;
  }, [showNormalForceDiagram, solverOutput.extremaAndMax.N_max_abs]);

  // Геометрическая верстка холста
  const paddingLeft = 90;
  const paddingRight = 70;
  const plotWidth = width - paddingLeft - paddingRight;

  const ySchematic = 135;
  const yDimLine = 225;
  const yDiagramN = hasAxialForces ? 330 : null;
  const yDiagramQ = hasAxialForces ? 500 : 350;
  const yDiagramM = hasAxialForces ? 690 : 540;
  const totalHeight = hasAxialForces ? 820 : 670;

  const maxAmpPx = 65; // Максимальная амплитуда ординаты эпюры в пикселях

  const xToPx = (x_m: number) =>
    paddingLeft + (x_m / Math.max(input.length, 0.001)) * plotWidth;

  const pxToX = (px: number) => {
    const rawX = ((px - paddingLeft) / plotWidth) * input.length;
    return Math.max(0, Math.min(input.length, rawX));
  };

  const scaleN =
    solverOutput.extremaAndMax.N_max_abs > 1e-4
      ? maxAmpPx / solverOutput.extremaAndMax.N_max_abs
      : 1;
  const scaleQ =
    solverOutput.extremaAndMax.Q_max_abs > 1e-4
      ? maxAmpPx / solverOutput.extremaAndMax.Q_max_abs
      : 1;
  const scaleM =
    solverOutput.extremaAndMax.M_max_abs > 1e-4
      ? maxAmpPx / solverOutput.extremaAndMax.M_max_abs
      : 1;

  // Обработка движения курсора для синхронизированного визира (Crosshair Sync)
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const svgX = (e.clientX - rect.left) * scaleX;

    if (svgX < paddingLeft - 10 || svgX > width - paddingRight + 10) {
      setHoverX_m(null);
      onCrosshairMove?.(null);
      return;
    }
    const xMeters = Number(pxToX(svgX).toFixed(3));
    setHoverX_m(xMeters);
    onCrosshairMove?.(xMeters);
  };

  const handleMouseLeave = () => {
    setHoverX_m(null);
    onCrosshairMove?.(null);
  };

  const crosshairData = useMemo(() => {
    if (hoverX_m === null) return null;
    return sampleBeamAtX(solverOutput, hoverX_m);
  }, [hoverX_m, solverOutput]);

  // На экранах < 768px — сенсорный режим: вкладки эпюр + слайдер визира + HUD.
  // Десктопная лента эпюр с визиром мыши рендерится без изменений.
  if (isMobile) {
    return (
      <MobileBeamDiagrams
        input={input}
        solverOutput={solverOutput}
        hasAxialForces={hasAxialForces}
        onCrosshairMove={onCrosshairMove}
      />
    );
  }

  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-gray-300 bg-[#F8F9FA] shadow-sm">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${totalHeight}`}
        className="w-full h-auto select-none font-mono"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* ================================================================
            1. ОПРЕДЕЛЕНИЯ МАРКЕРОВ И МИЛЛИМЕТРОВКИ
        ================================================================ */}
        <defs>
          <pattern id="pgs-grid-minor" width="16" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M 16 0 L 0 0 0 16"
              fill="none"
              stroke={PGS_PALETTE.gridMinor}
              strokeWidth="0.7"
            />
          </pattern>
          <pattern id="pgs-grid-major" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="url(#pgs-grid-minor)" />
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke={PGS_PALETTE.gridMajor}
              strokeWidth="1.1"
            />
          </pattern>

          {/* Маркеры стрелок для внешних сил (рубиновый), реакций (синий) и размеров */}
          <marker
            id="arrow-load"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={PGS_PALETTE.loadRuby} />
          </marker>
          <marker
            id="arrow-reaction"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={PGS_PALETTE.reactionBlue} />
          </marker>
          <marker
            id="arrow-dim"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 10 5 L 0 8 z" fill={PGS_PALETTE.graphite} />
          </marker>
        </defs>

        {/* Фон миллиметровки */}
        <rect width={width} height={totalHeight} fill={PGS_PALETTE.paperBg} />
        <rect width={width} height={totalHeight} fill="url(#pgs-grid-major)" />

        {/* ================================================================
            2. СКВОЗНЫЕ ВЕРТИКАЛЬНЫЕ ЛИНИИ ПРИВЯЗКИ (ХАРАКТЕРНЫЕ СЕЧЕНИЯ)
        ================================================================ */}
        {solverOutput.criticalPointsX.map((xVal, idx) => {
          const px = xToPx(xVal);
          return (
            <line
              key={`guide-${idx}`}
              x1={px}
              y1={55}
              x2={px}
              y2={totalHeight - 35}
              stroke={PGS_PALETTE.guideline}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Сквозные линии привязки для локальных экстремумов (где Q(x_0) = 0) */}
        {solverOutput.segments.map((seg) =>
          seg.localExtrema.map((ext, eIdx) => {
            const px = xToPx(ext.xGlobal);
            return (
              <line
                key={`ext-guide-${seg.index}-${eIdx}`}
                x1={px}
                y1={yDiagramQ}
                x2={px}
                y2={yDiagramM + (ext.M_value >= 0 ? 1 : -1) * Math.abs(ext.M_value) * scaleM}
                stroke={PGS_PALETTE.chalkGreen}
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            );
          })
        )}

        {/* ================================================================
            3. РАСЧЕТНАЯ СХЕМА БАЛКИ, ОПОР, НАГРУЗОК И РЕАКЦИЙ
        ================================================================ */}
        <g id="beam-schematic-layer">
          <text
            x={22}
            y={ySchematic - 48}
            fill={PGS_PALETTE.graphite}
            fontSize="13"
            fontWeight="bold"
          >
            Расчетная схема
          </text>

          {/* Стержень балки */}
          <line
            x1={xToPx(0)}
            y1={ySchematic}
            x2={xToPx(input.length)}
            y2={ySchematic}
            stroke={PGS_PALETTE.graphite}
            strokeWidth="5"
            strokeLinecap="butt"
          />

          {/* Опоры и врезные шарниры */}
          {input.supports.map((sup) => (
            <SupportSymbol
              key={sup.id}
              support={sup}
              cx={xToPx(sup.x)}
              cy={ySchematic}
              isRightEnd={Math.abs(sup.x - input.length) < 1e-4 && sup.x > 0}
            />
          ))}

          {/* Внешние нагрузки (#DC2626) */}
          {input.loads.map((load) => (
            <LoadSymbol
              key={load.id}
              load={load}
              xToPx={xToPx}
              yBeam={ySchematic}
            />
          ))}

          {/* Векторы опорных реакций (#2563EB) */}
          {solverOutput.reactions.map((reac) => (
            <ReactionVectorsSymbol
              key={reac.supportId}
              reaction={reac}
              cx={xToPx(reac.x)}
              cy={ySchematic}
            />
          ))}

          {/* Размерная цепочка участков по ГОСТ */}
          {solverOutput.segments.map((seg) => {
            const x1 = xToPx(seg.xStart);
            const x2 = xToPx(seg.xEnd);
            const mid = 0.5 * (x1 + x2);
            return (
              <g key={`dim-${seg.index}`}>
                <line
                  x1={x1}
                  y1={ySchematic + 18}
                  x2={x1}
                  y2={yDimLine + 6}
                  stroke={PGS_PALETTE.graphite}
                  strokeWidth="0.9"
                />
                <line
                  x1={x2}
                  y1={ySchematic + 18}
                  x2={x2}
                  y2={yDimLine + 6}
                  stroke={PGS_PALETTE.graphite}
                  strokeWidth="0.9"
                />
                <line
                  x1={x1 + 3}
                  y1={yDimLine}
                  x2={x2 - 3}
                  y2={yDimLine}
                  stroke={PGS_PALETTE.graphite}
                  strokeWidth="1.1"
                  markerStart="url(#arrow-dim)"
                  markerEnd="url(#arrow-dim)"
                />
                <rect
                  x={mid - 22}
                  y={yDimLine - 15}
                  width="44"
                  height="13"
                  fill={PGS_PALETTE.paperBg}
                />
                <text
                  x={mid}
                  y={yDimLine - 5}
                  textAnchor="middle"
                  fontSize="11.5"
                  fill={PGS_PALETTE.graphite}
                  fontWeight="600"
                >
                  {Number(seg.length.toFixed(2))} м
                </text>
              </g>
            );
          })}
        </g>

        {/* ================================================================
            4. ЭПЮРА ПРОДОЛЬНЫХ СИЛ N (кН) — ПРИ НАЛИЧИИ ОСЕВЫХ СИЛ
        ================================================================ */}
        {hasAxialForces && yDiagramN !== null && (
          <DiagramTrack
            title="N (кН)"
            unit="кН"
            baseY={yDiagramN}
            xStartPx={xToPx(0)}
            xEndPx={xToPx(input.length)}
            segments={solverOutput.segments}
            polyKey="N_poly"
            scaleY={scaleN}
            invertY={true}
            showSigns={true}
            xToPx={xToPx}
          />
        )}

        {/* ================================================================
            5. ЭПЮРА ПОПЕРЕЧНЫХ СИЛ Q (кН) — СО ШТРИХОВКОЙ И ЗНАКАМИ (+)/(-)
        ================================================================ */}
        <DiagramTrack
          title="Q (кН)"
          unit="кН"
          baseY={yDiagramQ}
          xStartPx={xToPx(0)}
          xEndPx={xToPx(input.length)}
          segments={solverOutput.segments}
          polyKey="Q_poly"
          scaleY={scaleQ}
          invertY={true}
          showSigns={true}
          xToPx={xToPx}
        />

        {/* ================================================================
            6. ЭПЮРА ИЗГИБАЮЩИХ МОМЕНТОВ M (кН*м) — СТРОГО НА РАСТЯНУТЫХ ВОЛОКНАХ, БЕЗ ЗНАКОВ
        ================================================================ */}
        <DiagramTrack
          title="M (кН·м)"
          subtitle="на растянутых волокнах"
          unit="кН·м"
          baseY={yDiagramM}
          xStartPx={xToPx(0)}
          xEndPx={xToPx(input.length)}
          segments={solverOutput.segments}
          polyKey="M_poly"
          scaleY={scaleM}
          invertY={false} // ПРАВИЛО ПГС: M > 0 (растянуты нижние волокна) -> откладывается ВНИЗ (+Y в SVG)
          showSigns={false} // Знаки (+) и (-) на эпюре M НЕ СТАВЯТСЯ
          xToPx={xToPx}
        />

        {/* ================================================================
            7. СИНХРОНИЗИРОВАННЫЙ ВИЗИР (CROSSHAIR SYNC)
        ================================================================ */}
        {crosshairData && hoverX_m !== null && (
          <g id="crosshair-sync-layer" className="pointer-events-none">
            <line
              x1={xToPx(hoverX_m)}
              y1={40}
              x2={xToPx(hoverX_m)}
              y2={totalHeight - 20}
              stroke={PGS_PALETTE.chalkGreen}
              strokeWidth="1.8"
              strokeDasharray="6 3"
            />
            {/* Точки пересечения визира с осями и кривыми */}
            <circle
              cx={xToPx(hoverX_m)}
              cy={ySchematic}
              r="4.5"
              fill={PGS_PALETTE.chalkGreen}
            />
            {hasAxialForces && yDiagramN !== null && (
              <circle
                cx={xToPx(hoverX_m)}
                cy={yDiagramN - crosshairData.N_kN * scaleN}
                r="4.5"
                fill={PGS_PALETTE.reactionBlue}
                stroke="#fff"
                strokeWidth="1.5"
              />
            )}
            <circle
              cx={xToPx(hoverX_m)}
              cy={yDiagramQ - crosshairData.Q_kN * scaleQ}
              r="4.5"
              fill={PGS_PALETTE.reactionBlue}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <circle
              cx={xToPx(hoverX_m)}
              cy={yDiagramM + crosshairData.M_kNm * scaleM}
              r="5"
              fill={PGS_PALETTE.chalkGreen}
              stroke="#fff"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* Плавающий академический тултип визира с эпюрой напряжений sigma(y) по сечению */}
      {crosshairData && hoverX_m !== null && (
        <div
          className="pointer-events-none absolute top-3 right-3 z-10 w-72 rounded-md border border-[#065F46]/40 bg-white/95 p-3 text-xs text-[#1F2937] shadow-md backdrop-blur-sm"
        >
          <div className="mb-1.5 flex items-center justify-between border-b border-gray-200 pb-1 font-bold text-[#065F46]">
            <span>Сечение x = {crosshairData.x_m.toFixed(2)} м</span>
            <span>Участок №{crosshairData.segmentIndex}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 py-1 font-mono">
            <div className="rounded bg-gray-100 p-1 text-center">
              <div className="text-[10px] text-gray-500">N(x)</div>
              <div className="font-semibold">{crosshairData.N_kN.toFixed(2)} кН</div>
            </div>
            <div className="rounded bg-blue-50 p-1 text-center">
              <div className="text-[10px] text-blue-700">Q(x)</div>
              <div className="font-semibold text-blue-800">{crosshairData.Q_kN.toFixed(2)} кН</div>
            </div>
            <div className="rounded bg-emerald-50 p-1 text-center">
              <div className="text-[10px] text-emerald-800">M(x)</div>
              <div className="font-semibold text-emerald-900">
                {Math.abs(crosshairData.M_kNm).toFixed(2)} кН·м
              </div>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-gray-600">
            Растянуты волокна:{' '}
            <span className="font-semibold text-[#1F2937]">
              {crosshairData.stretchedFiber === 'bottom'
                ? 'нижние (эпюра вниз)'
                : crosshairData.stretchedFiber === 'top'
                ? 'верхние (эпюра вверх)'
                : 'не деформированы (M = 0)'}
            </span>
          </div>
          <div className="mt-2 border-t border-gray-200 pt-1.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Нормальные напряжения σ(y) (Двутавр №
              {solverOutput.sectionDesign.selectedIBeam.profileNumber}):
            </div>
            <div className="flex justify-between font-mono text-[11px]">
              <span>Верх: {crosshairData.stressProfile.sigmaTop_MPa.toFixed(1)} МПа</span>
              <span>Низ: {crosshairData.stressProfile.sigmaBottom_MPa.toFixed(1)} МПа</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ДОРОЖКА ОТДЕЛЬНОЙ ЭПЮРЫ (N, Q ИЛИ M)
// ============================================================================

interface DiagramTrackProps {
  title: string;
  subtitle?: string;
  unit: string;
  baseY: number;
  xStartPx: number;
  xEndPx: number;
  segments: BeamSolverOutput['segments'];
  polyKey: 'N_poly' | 'Q_poly' | 'M_poly';
  scaleY: number;
  invertY: boolean;
  showSigns: boolean;
  xToPx: (x_m: number) => number;
  /** Показывать подпись названия эпюры слева (на мобильных название выводится во вкладке) */
  showTitle?: boolean;
  /** Масштаб шрифтов ординат и знаков (для крупного мобильного режима), по умолчанию 1 */
  fontScale?: number;
}

const DiagramTrack: React.FC<DiagramTrackProps> = ({
  title,
  subtitle,
  baseY,
  xStartPx,
  xEndPx,
  segments,
  polyKey,
  scaleY,
  invertY,
  showSigns,
  xToPx,
  showTitle = true,
  fontScale = 1,
}) => {
  const signDir = invertY ? -1 : 1;
  const fs = fontScale;

  return (
    <g>
      {/* Подпись названия эпюры слева */}
      {showTitle && (
        <text
          x={22}
          y={baseY - 4}
          fill={PGS_PALETTE.graphite}
          fontSize="14"
          fontWeight="bold"
        >
          {title}
        </text>
      )}
      {showTitle && subtitle && (
        <text x={22} y={baseY + 12} fill={PGS_PALETTE.chalkGreen} fontSize="9.5">
          ({subtitle})
        </text>
      )}

      {/* Базовая нулевая линия эпюры */}
      <line
        x1={xStartPx}
        y1={baseY}
        x2={xEndPx}
        y2={baseY}
        stroke={PGS_PALETTE.graphite}
        strokeWidth="1.8"
      />

      {/* Отрисовка каждого силового участка */}
      {segments.map((seg) => {
        const poly = seg[polyKey];
        const sx1 = xToPx(seg.xStart);
        const sx2 = xToPx(seg.xEnd);

        const { areaPath, curvePath } = buildPolynomialDiagramPath(
          poly,
          seg.length,
          sx1,
          sx2,
          baseY,
          scaleY,
          invertY
        );

        const hatchLines = generateHatchLines(
          poly,
          seg.length,
          sx1,
          sx2,
          baseY,
          scaleY,
          invertY,
          12
        );

        const badges = showSigns
          ? computeSignBadgePositions(poly, seg.length, sx1, sx2, baseY, scaleY)
          : [];

        const valStart = evalPoly(poly, 0);
        const valEnd = evalPoly(poly, seg.length);
        const yStart = baseY + signDir * valStart * scaleY;
        const yEnd = baseY + signDir * valEnd * scaleY;

        return (
          <g key={`${title}-seg-${seg.index}`}>
            {/* Полупрозрачная заливка контура */}
            <path
              d={areaPath}
              fill={showSigns ? PGS_PALETTE.fillPositive : PGS_PALETTE.fillMoment}
            />

            {/* Перпендикулярная штриховка по ГОСТ */}
            {hatchLines.map((hl, idx) => (
              <line
                key={`hatch-${idx}`}
                x1={hl.x}
                y1={hl.y1}
                x2={hl.x}
                y2={hl.y2}
                stroke={PGS_PALETTE.graphite}
                strokeWidth="0.75"
                strokeOpacity="0.65"
              />
            ))}

            {/* Вертикальные замыкающие ординаты на границах участка */}
            <line
              x1={sx1}
              y1={baseY}
              x2={sx1}
              y2={yStart}
              stroke={PGS_PALETTE.graphite}
              strokeWidth="1.6"
            />
            <line
              x1={sx2}
              y1={baseY}
              x2={sx2}
              y2={yEnd}
              stroke={PGS_PALETTE.graphite}
              strokeWidth="1.6"
            />

            {/* Главная огибающая кривая эпюры */}
            <path
              d={curvePath}
              fill="none"
              stroke={showSigns ? PGS_PALETTE.graphite : PGS_PALETTE.chalkGreen}
              strokeWidth="2.4"
            />

            {/* Кружки со знаками (+) и (-) ТОЛЬКО для эпюр N и Q */}
            {badges.map((b, bIdx) => (
              <g key={`badge-${bIdx}`} transform={`translate(${b.x}, ${b.y})`}>
                <circle
                  r={9 * fs}
                  fill={PGS_PALETTE.paperBg}
                  stroke={PGS_PALETTE.graphite}
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y={3.5 * fs}
                  textAnchor="middle"
                  fontSize={12 * fs}
                  fontWeight="bold"
                  fill={b.sign === '+' ? PGS_PALETTE.reactionBlue : PGS_PALETTE.loadRuby}
                >
                  {b.sign}
                </text>
              </g>
            ))}

            {/* Подписи граничных ординат в начале и конце участка */}
            {Math.abs(valStart) > 1e-2 && (
              <OrdinateLabel
                x={sx1 + 4}
                y={yStart + (yStart >= baseY ? 13 * fs : -6 * fs)}
                value={showSigns ? valStart : Math.abs(valStart)}
                anchor="start"
                fontScale={fs}
              />
            )}
            {Math.abs(valEnd) > 1e-2 && (
              <OrdinateLabel
                x={sx2 - 4}
                y={yEnd + (yEnd >= baseY ? 13 * fs : -6 * fs)}
                value={showSigns ? valEnd : Math.abs(valEnd)}
                anchor="end"
                fontScale={fs}
              />
            )}

            {/* Подписи экстремумов изгибающего момента M(x_0) */}
            {polyKey === 'M_poly' &&
              seg.localExtrema.map((ext, eIdx) => {
                const exPx = xToPx(ext.xGlobal);
                const eyPx = baseY + signDir * ext.M_value * scaleY;
                return (
                  <g key={`ext-label-${eIdx}`}>
                    <line
                      x1={exPx}
                      y1={baseY}
                      x2={exPx}
                      y2={eyPx}
                      stroke={PGS_PALETTE.chalkGreen}
                      strokeWidth="1.4"
                      strokeDasharray="2 2"
                    />
                    <circle cx={exPx} cy={eyPx} r={3.5 * fs} fill={PGS_PALETTE.chalkGreen} />
                    <OrdinateLabel
                      x={exPx}
                      y={eyPx + (eyPx >= baseY ? 15 * fs : -8 * fs)}
                      value={Math.abs(ext.M_value)}
                      anchor="middle"
                      highlight
                      fontScale={fs}
                    />
                  </g>
                );
              })}
          </g>
        );
      })}
    </g>
  );
};

const OrdinateLabel: React.FC<{
  x: number;
  y: number;
  value: number;
  anchor: 'start' | 'middle' | 'end';
  highlight?: boolean;
  fontScale?: number;
}> = ({ x, y, value, anchor, highlight, fontScale = 1 }) => {
  const formatted = Number(value.toFixed(2)).toString();
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={(highlight ? 12 : 11) * fontScale}
      fontWeight="bold"
      fill={highlight ? PGS_PALETTE.chalkGreen : PGS_PALETTE.graphite}
      stroke={PGS_PALETTE.paperBg}
      strokeWidth={3 * fontScale}
      paintOrder="stroke"
    >
      {formatted}
    </text>
  );
};

// ============================================================================
// СИМВОЛЫ ОПОР ПО ГОСТ (ЗАДЕЛКА, ШАРНИРНО-НЕПОДВИЖНАЯ, КАТКОВАЯ, ВРЕЗНОЙ ШАРНИР)
// ============================================================================

const SupportSymbol: React.FC<{
  support: SupportNode;
  cx: number;
  cy: number;
  isRightEnd: boolean;
}> = ({ support, cx, cy, isRightEnd }) => {
  if (support.type === 'internal_hinge') {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r="5"
          fill={PGS_PALETTE.paperBg}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="2"
        />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="bold"
          fill={PGS_PALETTE.graphite}
        >
          {support.label}
        </text>
      </g>
    );
  }

  if (support.type === 'fixed') {
    const dir = isRightEnd ? 1 : -1;
    return (
      <g>
        <line
          x1={cx}
          y1={cy - 26}
          x2={cx}
          y2={cy + 26}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="3"
        />
        {[-22, -14, -6, 2, 10, 18, 24].map((offset, idx) => (
          <line
            key={idx}
            x1={cx}
            y1={cy + offset}
            x2={cx + dir * 10}
            y2={cy + offset - 8}
            stroke={PGS_PALETTE.graphite}
            strokeWidth="1.3"
          />
        ))}
        <text
          x={cx + dir * 14}
          y={cy - 16}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill={PGS_PALETTE.graphite}
        >
          {support.label}
        </text>
      </g>
    );
  }

  // Шарнирно-неподвижная или шарнирно-подвижная опора (с учетом угла наклона площадки)
  const angleDeg = support.surfaceAngleDeg ?? 0;
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${-angleDeg})`}>
      {/* Треугольник опоры */}
      <polygon
        points="0,0 -11,18 11,18"
        fill={PGS_PALETTE.paperBg}
        stroke={PGS_PALETTE.graphite}
        strokeWidth="2"
      />
      {/* Шарнир в вершине */}
      <circle
        cx="0"
        cy="0"
        r="3.8"
        fill={PGS_PALETTE.paperBg}
        stroke={PGS_PALETTE.graphite}
        strokeWidth="1.8"
      />
      {support.type === 'roller' ? (
        <>
          <circle
            cx="-5.5"
            cy="21.5"
            r="3"
            fill={PGS_PALETTE.paperBg}
            stroke={PGS_PALETTE.graphite}
            strokeWidth="1.5"
          />
          <circle
            cx="5.5"
            cy="21.5"
            r="3"
            fill={PGS_PALETTE.paperBg}
            stroke={PGS_PALETTE.graphite}
            strokeWidth="1.5"
          />
          <line
            x1="-16"
            y1="25"
            x2="16"
            y2="25"
            stroke={PGS_PALETTE.graphite}
            strokeWidth="2"
          />
          {[-12, -6, 0, 6, 12].map((hx, idx) => (
            <line
              key={idx}
              x1={hx}
              y1="25"
              x2={hx - 5}
              y2="31"
              stroke={PGS_PALETTE.graphite}
              strokeWidth="1.2"
            />
          ))}
        </>
      ) : (
        <>
          <line
            x1="-16"
            y1="18"
            x2="16"
            y2="18"
            stroke={PGS_PALETTE.graphite}
            strokeWidth="2"
          />
          {[-12, -6, 0, 6, 12].map((hx, idx) => (
            <line
              key={idx}
              x1={hx}
              y1="18"
              x2={hx - 5}
              y2="25"
              stroke={PGS_PALETTE.graphite}
              strokeWidth="1.2"
            />
          ))}
        </>
      )}
      <text
        x="-18"
        y="12"
        fontSize="12"
        fontWeight="bold"
        fill={PGS_PALETTE.graphite}
      >
        {support.label}
      </text>
    </g>
  );
};

// ============================================================================
// СИМВОЛЫ ВНЕШНИХ НАГРУЗОК (СИЛЫ, ПАРЫ СИЛ, РАСПРЕДЕЛЕННЫЕ НАГРУЗКИ q)
// ============================================================================

const LoadSymbol: React.FC<{
  load: BeamLoad;
  xToPx: (x: number) => number;
  yBeam: number;
}> = ({ load, xToPx, yBeam }) => {
  if (load.kind === 'point_force') {
    const px = xToPx(load.x);
    const rad = (load.angleDeg * Math.PI) / 180;
    const len = 52;
    // В экранных координатах ось Y направлена вниз, поэтому проекция по Y берется со знаком минус
    const dx = len * Math.cos(rad);
    const dy = -len * Math.sin(rad);
    const xStart = px - dx;
    const yStart = yBeam - dy;

    return (
      <g>
        <line
          x1={xStart}
          y1={yStart}
          x2={px}
          y2={yBeam}
          stroke={PGS_PALETTE.loadRuby}
          strokeWidth="2.4"
          markerEnd="url(#arrow-load)"
        />
        <text
          x={xStart + (dx >= 0 ? -6 : 6)}
          y={yStart - 6}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill={PGS_PALETTE.loadRuby}
        >
          {load.label}={load.magnitude}кН
        </text>
      </g>
    );
  }

  if (load.kind === 'point_moment') {
    const px = xToPx(load.x);
    const isCCW = load.direction === 'ccw';
    const arcPath = isCCW
      ? `M ${px + 16} ${yBeam - 18} A 22 22 0 1 0 ${px - 16} ${yBeam - 18}`
      : `M ${px - 16} ${yBeam - 18} A 22 22 0 1 1 ${px + 16} ${yBeam - 18}`;

    return (
      <g>
        <line
          x1={px}
          y1={yBeam - 24}
          x2={px}
          y2={yBeam + 24}
          stroke={PGS_PALETTE.loadRuby}
          strokeWidth="1.6"
        />
        <path
          d={arcPath}
          fill="none"
          stroke={PGS_PALETTE.loadRuby}
          strokeWidth="2"
          markerEnd="url(#arrow-load)"
        />
        <text
          x={px}
          y={yBeam - 32}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="bold"
          fill={PGS_PALETTE.loadRuby}
        >
          {load.label}={load.magnitude}кН·м
        </text>
      </g>
    );
  }

  // Распределенная нагрузка q (равномерная, треугольная, трапециевидная)
  const x1 = xToPx(load.xStart);
  const x2 = xToPx(load.xEnd);
  const maxQ = Math.max(Math.abs(load.qStart), Math.abs(load.qEnd), 1);
  const maxH = 34;

  const h1 = (load.qStart / maxQ) * maxH;
  const h2 = (load.qEnd / maxQ) * maxH;
  const topY1 = yBeam - h1;
  const topY2 = yBeam - h2;

  const arrowCount = Math.max(4, Math.floor((x2 - x1) / 22));
  const arrows: Array<{ x: number; yTop: number; yTip: number }> = [];
  for (let i = 0; i <= arrowCount; i++) {
    const t = i / arrowCount;
    const ax = x1 + t * (x2 - x1);
    const ah = h1 + t * (h2 - h1);
    if (Math.abs(ah) < 3) continue;
    arrows.push({
      x: ax,
      yTop: yBeam - ah,
      yTip: ah >= 0 ? yBeam - 3 : yBeam + 3,
    });
  }

  return (
    <g>
      {/* Огибающая линия распределенной нагрузки */}
      <line
        x1={x1}
        y1={topY1}
        x2={x2}
        y2={topY2}
        stroke={PGS_PALETTE.loadRuby}
        strokeWidth="1.8"
      />
      {arrows.map((ar, idx) => (
        <line
          key={idx}
          x1={ar.x}
          y1={ar.yTop}
          x2={ar.x}
          y2={ar.yTip}
          stroke={PGS_PALETTE.loadRuby}
          strokeWidth="1.4"
          markerEnd="url(#arrow-load)"
        />
      ))}
      <text
        x={0.5 * (x1 + x2)}
        y={Math.min(topY1, topY2) - 7}
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="bold"
        fill={PGS_PALETTE.loadRuby}
      >
        {load.label}={Math.max(Math.abs(load.qStart), Math.abs(load.qEnd))}кН/м
      </text>
    </g>
  );
};

// ============================================================================
// ВЕКТОРЫ ОПОРНЫХ РЕАКЦИЙ (#2563EB)
// ============================================================================

const ReactionVectorsSymbol: React.FC<{
  reaction: BeamSolverOutput['reactions'][number];
  cx: number;
  cy: number;
}> = ({ reaction, cx, cy }) => {
  return (
    <g>
      {Math.abs(reaction.Ry_kN) > 1e-3 && (
        <g>
          <line
            x1={cx}
            y1={cy + 46}
            x2={cx}
            y2={cy + 6}
            stroke={PGS_PALETTE.reactionBlue}
            strokeWidth="2.2"
            markerEnd="url(#arrow-reaction)"
          />
          <text
            x={cx + 8}
            y={cy + 44}
            fontSize="11"
            fontWeight="bold"
            fill={PGS_PALETTE.reactionBlue}
          >
            R_{reaction.supportLabel}y={Number(reaction.Ry_kN.toFixed(2))}кН
          </text>
        </g>
      )}
      {Math.abs(reaction.Rx_kN) > 1e-3 && (
        <g>
          <line
            x1={cx - 42}
            y1={cy - 10}
            x2={cx - 4}
            y2={cy - 10}
            stroke={PGS_PALETTE.reactionBlue}
            strokeWidth="2"
            markerEnd="url(#arrow-reaction)"
          />
          <text
            x={cx - 24}
            y={cy - 16}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="bold"
            fill={PGS_PALETTE.reactionBlue}
          >
            R_{reaction.supportLabel}x={Number(reaction.Rx_kN.toFixed(2))}
          </text>
        </g>
      )}
    </g>
  );
};

// ============================================================================
// МОБИЛЬНЫЙ РЕЖИМ ЭПЮР (< 768px): ВКЛАДКИ M / Q / N + СЕНСОРНЫЙ ВИЗИР + HUD
// ============================================================================

type MobileDiagramTab = 'M' | 'Q' | 'N';

const MOBILE_FINE_STEPS: Array<{ delta: number; label: string }> = [
  { delta: -0.5, label: '− 0.5м' },
  { delta: -0.1, label: '− 0.1м' },
  { delta: 0.1, label: '+ 0.1м' },
  { delta: 0.5, label: '+ 0.5м' },
];

const MOBILE_SLIDER_STEP = 0.05;

interface MobileBeamDiagramsProps {
  input: BeamProblemInput;
  solverOutput: BeamSolverOutput;
  hasAxialForces: boolean;
  onCrosshairMove?: (xMeters: number | null) => void;
}

const MobileBeamDiagrams: React.FC<MobileBeamDiagramsProps> = ({
  input,
  solverOutput,
  hasAxialForces,
  onCrosshairMove,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeTab, setActiveTab] = useState<MobileDiagramTab>('M');
  const [rawX_m, setRawX_m] = useState<number>(0);

  const L = Math.max(input.length, 0.001);
  // Визир всегда остается в пределах балки, даже если длину L уменьшили
  const xCur = Math.max(0, Math.min(input.length, rawX_m));

  // Компактная геометрия холста: узкий viewBox => крупные числа при 100% ширины экрана
  const W = 380;
  const padL = 30;
  const padR = 30;
  const plotW = W - padL - padR;
  const ySchem = 76;
  const maxAmp = 86;
  const baseY = 128 + maxAmp + 22;
  const H = baseY + maxAmp + 46;
  const fontScale = 1.32;

  const xToPx = (x_m: number) => padL + (x_m / L) * plotW;

  const commitX = (x: number) => {
    const clamped = Math.max(0, Math.min(input.length, x));
    const rounded = Number(clamped.toFixed(3));
    setRawX_m(rounded);
    onCrosshairMove?.(rounded);
  };

  const snapToStep = (x: number) =>
    Math.round(x / MOBILE_SLIDER_STEP) * MOBILE_SLIDER_STEP;

  // Касание графика (tap) переносит визир; прокрутка страницы при этом не блокируется
  const handleTap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) * W) / rect.width;
    const x = ((svgX - padL) / plotW) * input.length;
    commitX(snapToStep(x));
  };

  const ext = solverOutput.extremaAndMax;
  const tabs: Array<{
    id: MobileDiagramTab;
    label: string;
    unit: string;
    maxAbs: number;
    accent: string;
  }> = [
    { id: 'M', label: 'Эпюра M', unit: 'кН·м', maxAbs: ext.M_max_abs, accent: 'bg-[#065F46]' },
    { id: 'Q', label: 'Эпюра Q', unit: 'кН', maxAbs: ext.Q_max_abs, accent: 'bg-[#2563EB]' },
    { id: 'N', label: 'Эпюра N', unit: 'кН', maxAbs: ext.N_max_abs, accent: 'bg-[#1F2937]' },
  ];
  const tabMeta = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const polyKey: 'M_poly' | 'Q_poly' | 'N_poly' =
    activeTab === 'M' ? 'M_poly' : activeTab === 'Q' ? 'Q_poly' : 'N_poly';
  const isMoment = activeTab === 'M';
  const scaleY = tabMeta.maxAbs > 1e-4 ? maxAmp / tabMeta.maxAbs : 1;

  const crosshairData = useMemo(
    () => sampleBeamAtX(solverOutput, xCur),
    [solverOutput, xCur]
  );

  const crosshairValue = crosshairData
    ? activeTab === 'M'
      ? crosshairData.M_kNm
      : activeTab === 'Q'
      ? crosshairData.Q_kN
      : crosshairData.N_kN
    : 0;
  // ПГС: M > 0 откладывается вниз (растянутые волокна), Q и N > 0 — вверх
  const crosshairDotY = isMoment
    ? baseY + crosshairValue * scaleY
    : baseY - crosshairValue * scaleY;

  // Подписи характерных сечений по оси x (без наложения соседних подписей)
  const axisTicks = useMemo(() => {
    const xs = Array.from(
      new Set([0, ...solverOutput.criticalPointsX, input.length].map((v) => Number(v.toFixed(3))))
    ).sort((a, b) => a - b);
    const minGapPx = 34;
    const result: number[] = [];
    xs.forEach((xv) => {
      const px = padL + (xv / L) * plotW;
      const last = result[result.length - 1];
      const lastPx = last === undefined ? -Infinity : padL + (last / L) * plotW;
      if (px - lastPx >= minGapPx) {
        result.push(xv);
      } else if (Math.abs(xv - input.length) < 1e-6 && result.length > 1) {
        // Конец балки важнее промежуточной подписи
        result[result.length - 1] = xv;
      }
    });
    return result;
  }, [solverOutput.criticalPointsX, input.length, L, plotW]);

  // Быстрый переход к характерным сечениям и экстремумам M(x0)
  const jumpTargets = useMemo(() => {
    const items: Array<{ key: string; x: number; label: string; accent?: boolean }> = [];
    input.supports.forEach((s) =>
      items.push({ key: `s-${s.id}`, x: s.x, label: `${s.label} (${Number(s.x.toFixed(2))} м)` })
    );
    solverOutput.segments.forEach((seg) =>
      seg.localExtrema.forEach((e, idx) =>
        items.push({
          key: `e-${seg.index}-${idx}`,
          x: e.xGlobal,
          label: `M экстр. x₀=${Number(e.xGlobal.toFixed(2))} м`,
          accent: true,
        })
      )
    );
    return items.sort((a, b) => a.x - b.x);
  }, [input.supports, solverOutput.segments]);

  const fillPct = (xCur / L) * 100;
  const rangeStyle = { ['--pgs-range-fill' as string]: `${fillPct}%` } as React.CSSProperties;

  const fiberText = crosshairData
    ? crosshairData.stretchedFiber === 'bottom'
      ? 'нижние (эпюра M вниз)'
      : crosshairData.stretchedFiber === 'top'
      ? 'верхние (эпюра M вверх)'
      : 'не деформированы (M = 0)'
    : '—';

  const fmt = (v: number) => (Math.abs(v) < 5e-3 ? '0.00' : v.toFixed(2));

  return (
    <div className="space-y-3">
      {/* Переключатель эпюр */}
      <div className="rounded-xl border border-gray-300 bg-white p-1.5 shadow-sm">
        <div role="tablist" aria-label="Эпюры внутренних усилий" className="grid grid-cols-3 gap-1.5">
          {tabs.map((t) => {
            const isActive = t.id === activeTab;
            const isEmpty = t.id === 'N' && !hasAxialForces;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.id)}
                className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-sm font-extrabold transition ${
                  isActive
                    ? `${t.accent} text-white shadow-md`
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    isActive ? 'text-white/85' : 'text-gray-500'
                  }`}
                >
                  {isEmpty ? 'N ≡ 0' : `|max| ${Number(t.maxAbs.toFixed(2))}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* HUD-виджет визира: закреплен над эпюрой при прокрутке */}
      <div
        aria-live="polite"
        className="sticky top-2 z-20 rounded-xl border-2 border-[#065F46] bg-white/95 p-3 text-[#1F2937] shadow-lg backdrop-blur-sm"
      >
        {crosshairData ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-mono text-lg font-extrabold text-[#065F46]">
                x = {xCur.toFixed(2)} м
              </div>
              <div className="text-xs font-bold text-gray-500">
                Участок №{crosshairData.segmentIndex}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                { id: 'M' as const, name: 'M(x)', value: Math.abs(crosshairData.M_kNm), unit: 'кН·м', tone: 'bg-emerald-50 text-emerald-900', ring: 'ring-[#065F46]' },
                { id: 'Q' as const, name: 'Q(x)', value: crosshairData.Q_kN, unit: 'кН', tone: 'bg-blue-50 text-blue-900', ring: 'ring-[#2563EB]' },
                { id: 'N' as const, name: 'N(x)', value: crosshairData.N_kN, unit: 'кН', tone: 'bg-gray-100 text-gray-900', ring: 'ring-[#1F2937]' },
              ].map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setActiveTab(tile.id)}
                  className={`rounded-lg px-1 py-1.5 text-center ${tile.tone} ${
                    activeTab === tile.id ? `ring-2 ${tile.ring}` : ''
                  }`}
                >
                  <div className="text-[11px] font-bold opacity-75">{tile.name}</div>
                  <div className="font-mono text-base font-extrabold leading-tight">
                    {fmt(tile.value)}
                  </div>
                  <div className="text-[10px] font-semibold opacity-70">{tile.unit}</div>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[13px] leading-snug">
              <span className="text-gray-600">Растянуты волокна: </span>
              <span className="font-bold">{fiberText}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2 font-mono text-[11px] text-gray-600">
              <span>σ верх: {crosshairData.stressProfile.sigmaTop_MPa.toFixed(1)} МПа</span>
              <span>σ низ: {crosshairData.stressProfile.sigmaBottom_MPa.toFixed(1)} МПа</span>
            </div>
          </>
        ) : (
          <div className="text-sm font-semibold text-red-700">
            Визир недоступен: {solverOutput.errorMessage ?? 'схема не рассчитана'}
          </div>
        )}
      </div>

      {/* Эпюра на 100% ширины экрана */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-300 bg-[#F8F9FA] shadow-sm">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full select-none font-mono"
          onClick={handleTap}
          role="img"
          aria-label={`${tabMeta.label}, ${tabMeta.unit}`}
        >
          <defs>
            <pattern id="pgs-grid-minor" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke={PGS_PALETTE.gridMinor} strokeWidth="0.7" />
            </pattern>
            <marker
              id="arrow-load"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={PGS_PALETTE.loadRuby} />
            </marker>
          </defs>

          <rect width={W} height={H} fill={PGS_PALETTE.paperBg} />
          <rect width={W} height={H} fill="url(#pgs-grid-minor)" />

          {/* Линии привязки характерных сечений */}
          {solverOutput.criticalPointsX.map((xVal, idx) => (
            <line
              key={`m-guide-${idx}`}
              x1={xToPx(xVal)}
              y1={ySchem - 30}
              x2={xToPx(xVal)}
              y2={H - 30}
              stroke={PGS_PALETTE.guideline}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {/* Миниатюрная расчетная схема для ориентации */}
          <line
            x1={xToPx(0)}
            y1={ySchem}
            x2={xToPx(input.length)}
            y2={ySchem}
            stroke={PGS_PALETTE.graphite}
            strokeWidth="5"
          />
          {input.loads.map((load) => (
            <LoadSymbol key={load.id} load={load} xToPx={xToPx} yBeam={ySchem} />
          ))}
          {input.supports.map((sup) => (
            <SupportSymbol
              key={sup.id}
              support={sup}
              cx={xToPx(sup.x)}
              cy={ySchem}
              isRightEnd={Math.abs(sup.x - input.length) < 1e-4 && sup.x > 0}
            />
          ))}

          {/* Выбранная эпюра */}
          <text
            x={padL}
            y={baseY - maxAmp - 10}
            fontSize="15"
            fontWeight="bold"
            fill={PGS_PALETTE.graphite}
          >
            {activeTab} ({tabMeta.unit})
            {isMoment && (
              <tspan fontSize="11" fill={PGS_PALETTE.chalkGreen}>
                {' '}— на растянутых волокнах
              </tspan>
            )}
          </text>
          <DiagramTrack
            title={`${activeTab} (${tabMeta.unit})`}
            unit={tabMeta.unit}
            baseY={baseY}
            xStartPx={xToPx(0)}
            xEndPx={xToPx(input.length)}
            segments={solverOutput.segments}
            polyKey={polyKey}
            scaleY={scaleY}
            invertY={!isMoment}
            showSigns={!isMoment}
            xToPx={xToPx}
            showTitle={false}
            fontScale={fontScale}
          />
          {activeTab === 'N' && !hasAxialForces && (
            <text
              x={W / 2}
              y={baseY - 14}
              textAnchor="middle"
              fontSize="13"
              fontWeight="bold"
              fill={PGS_PALETTE.graphite}
            >
              N(x) ≡ 0 — продольных сил нет
            </text>
          )}

          {/* Подписи оси x в характерных сечениях */}
          {axisTicks.map((xv) => (
            <text
              key={`tick-${xv}`}
              x={xToPx(xv)}
              y={H - 12}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill={PGS_PALETTE.graphite}
            >
              {Number(xv.toFixed(2))}
            </text>
          ))}

          {/* Вертикальная пунктирная линия визира */}
          {crosshairData && (
            <g className="pointer-events-none">
              <line
                x1={xToPx(xCur)}
                y1={ySchem - 40}
                x2={xToPx(xCur)}
                y2={H - 28}
                stroke={PGS_PALETTE.chalkGreen}
                strokeWidth="2.2"
                strokeDasharray="7 4"
              />
              <circle cx={xToPx(xCur)} cy={ySchem} r="5" fill={PGS_PALETTE.chalkGreen} />
              <circle
                cx={xToPx(xCur)}
                cy={crosshairDotY}
                r="6.5"
                fill={isMoment ? PGS_PALETTE.chalkGreen : PGS_PALETTE.reactionBlue}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Сенсорная панель управления визиром */}
      <div className="rounded-xl border border-gray-300 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-gray-600">
          <span className="uppercase tracking-wider">Визир сечения</span>
          <span className="font-mono">0 … {Number(input.length.toFixed(2))} м</span>
        </div>
        <input
          type="range"
          min={0}
          max={input.length}
          step={MOBILE_SLIDER_STEP}
          value={xCur}
          onChange={(e) => commitX(Number(e.target.value))}
          className="pgs-range mt-1"
          style={rangeStyle}
          aria-label="Положение сечения x, м"
          aria-valuetext={`x = ${xCur.toFixed(2)} м`}
        />
        <div className="mt-1 grid grid-cols-4 gap-2">
          {MOBILE_FINE_STEPS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => commitX(xCur + s.delta)}
              className={`h-12 rounded-lg border text-sm font-extrabold transition active:scale-95 ${
                s.delta < 0
                  ? 'border-gray-300 bg-gray-50 text-[#1F2937] active:bg-gray-200'
                  : 'border-[#065F46]/40 bg-emerald-50 text-[#065F46] active:bg-emerald-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {jumpTargets.length > 0 && (
          <div className="scrollbar-none -mx-3 mt-3 flex gap-2 overflow-x-auto whitespace-nowrap px-3">
            {jumpTargets.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => commitX(t.x)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${
                  t.accent
                    ? 'border-[#065F46]/50 bg-[#065F46]/10 text-[#065F46]'
                    : 'border-gray-300 bg-gray-50 text-gray-700'
                }`}
              >
                → {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
