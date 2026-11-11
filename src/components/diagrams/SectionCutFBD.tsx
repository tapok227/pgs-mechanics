import React from 'react';
import { BeamSegmentAnalysis, SupportReactionResult } from '../../types/mechanics';
import { PGS_PALETTE } from './svgMathUtils';

interface SectionCutFBDProps {
  segment: BeamSegmentAnalysis;
  reactionsLeft: SupportReactionResult[];
}

export const SectionCutFBD: React.FC<SectionCutFBDProps> = ({
  segment,
  reactionsLeft,
}) => {
  const width = 460;
  const height = 145;
  const xLeft = 55;
  const xCut = 320;
  const yBeam = 72;

  return (
    <div className="my-2 inline-block rounded border border-gray-300 bg-[#F8F9FA] p-2 shadow-xs">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-auto font-mono">
        <defs>
          <marker
            id="cut-arrow-internal"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={PGS_PALETTE.chalkGreen} />
          </marker>
          <marker
            id="cut-arrow-reac"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={PGS_PALETTE.reactionBlue} />
          </marker>
        </defs>

        <text
          x={14}
          y={20}
          fontSize="11.5"
          fontWeight="bold"
          fill={PGS_PALETTE.graphite}
        >
          Участок {segment.index}: x_{segment.index} ∈ [0; {segment.length} м] (Глоб. [{segment.xStart}; {segment.xEnd} м])
        </text>

        {/* Отсеченная левая часть балки */}
        <line
          x1={xLeft}
          y1={yBeam}
          x2={xCut}
          y2={yBeam}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="5"
        />

        {/* Волнистая линия обрыва в сечении x_i */}
        <path
          d={`M ${xCut} ${yBeam - 26} Q ${xCut - 5} ${yBeam - 13} ${xCut} ${yBeam} T ${xCut} ${yBeam + 26}`}
          fill="none"
          stroke={PGS_PALETTE.graphite}
          strokeWidth="1.5"
        />

        {/* Реакции на левом конце отсеченной части */}
        {reactionsLeft.length > 0 && (
          <g>
            <line
              x1={xLeft}
              y1={yBeam + 38}
              x2={xLeft}
              y2={yBeam + 5}
              stroke={PGS_PALETTE.reactionBlue}
              strokeWidth="2"
              markerEnd="url(#cut-arrow-reac)"
            />
            <text
              x={xLeft + 6}
              y={yBeam + 34}
              fontSize="10.5"
              fontWeight="bold"
              fill={PGS_PALETTE.reactionBlue}
            >
              R_{reactionsLeft[0].supportLabel}y
            </text>
          </g>
        )}

        {/* Внутренняя продольная сила N(x_i) — направлена от сечения вправо */}
        <line
          x1={xCut + 2}
          y1={yBeam}
          x2={xCut + 54}
          y2={yBeam}
          stroke={PGS_PALETTE.chalkGreen}
          strokeWidth="2"
          markerEnd="url(#cut-arrow-internal)"
        />
        <text
          x={xCut + 60}
          y={yBeam + 4}
          fontSize="11.5"
          fontWeight="bold"
          fill={PGS_PALETTE.chalkGreen}
        >
          N(x_{segment.index})
        </text>

        {/* Внутренняя поперечная сила Q(x_i) — для левой части положительна ВНИЗ (по ч.с.) */}
        <line
          x1={xCut + 16}
          y1={yBeam - 22}
          x2={xCut + 16}
          y2={yBeam + 28}
          stroke={PGS_PALETTE.chalkGreen}
          strokeWidth="2"
          markerEnd="url(#cut-arrow-internal)"
        />
        <text
          x={xCut + 22}
          y={yBeam + 36}
          fontSize="11.5"
          fontWeight="bold"
          fill={PGS_PALETTE.chalkGreen}
        >
          Q(x_{segment.index})
        </text>

        {/* Внутренний изгибающий момент M(x_i) — для левой части положителен ПРОТИВ ч.с. (растягивает нижние волокна) */}
        <path
          d={`M ${xCut + 28} ${yBeam + 18} A 24 24 0 0 0 ${xCut + 28} ${yBeam - 22}`}
          fill="none"
          stroke={PGS_PALETTE.chalkGreen}
          strokeWidth="2"
          markerEnd="url(#cut-arrow-internal)"
        />
        <text
          x={xCut + 36}
          y={yBeam - 24}
          fontSize="11.5"
          fontWeight="bold"
          fill={PGS_PALETTE.chalkGreen}
        >
          M(x_{segment.index})
        </text>

        {/* Размерная привязка локальной координаты x_i */}
        <line
          x1={xLeft + 90}
          y1={yBeam}
          x2={xLeft + 90}
          y2={yBeam + 46}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
        <line
          x1={xCut}
          y1={yBeam + 26}
          x2={xCut}
          y2={yBeam + 46}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="0.9"
        />
        <line
          x1={xLeft + 90}
          y1={yBeam + 42}
          x2={xCut}
          y2={yBeam + 42}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="1.1"
        />
        <text
          x={0.5 * (xLeft + 90 + xCut)}
          y={yBeam + 38}
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fill={PGS_PALETTE.graphite}
        >
          x_{segment.index}
        </text>
      </svg>
    </div>
  );
};