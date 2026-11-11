import React, { useState, useRef } from 'react';
import {
  BeamProblemInput,
  SupportType,
} from '../../types/mechanics';
import { PGS_PALETTE } from '../diagrams/svgMathUtils';
import { Magnet, MousePointer, PlusCircle } from 'lucide-react';

interface InteractiveBeamCanvasProps {
  input: BeamProblemInput;
  onChange: (updated: BeamProblemInput) => void;
}

type ActiveTool =
  | 'select_drag'
  | 'add_pinned'
  | 'add_roller'
  | 'add_hinge'
  | 'add_force'
  | 'add_moment'
  | 'add_distributed';

type DragTarget =
  | { kind: 'support'; id: string }
  | { kind: 'point_load'; id: string }
  | { kind: 'dist_start'; id: string }
  | { kind: 'dist_end'; id: string };

export const InteractiveBeamCanvas: React.FC<InteractiveBeamCanvasProps> = ({
  input,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [snapStep, setSnapStep] = useState<0.1 | 0.5>(0.5);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select_drag');
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [cursorXMeters, setCursorXMeters] = useState<number>(0);

  const width = 920;
  const height = 220;
  const padLeft = 80;
  const padRight = 60;
  const plotWidth = width - padLeft - padRight;
  const yBeam = 120;

  const snapValue = (val: number): number => {
    const snapped = Math.round(val / snapStep) * snapStep;
    return Number(Math.max(0, Math.min(input.length, snapped)).toFixed(2));
  };

  const xToPx = (x_m: number) =>
    padLeft + (x_m / Math.max(input.length, 0.001)) * plotWidth;

  const clientXToSnappedMeters = (clientX: number): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const svgX = (clientX - rect.left) * scaleX;
    const rawMeters = ((svgX - padLeft) / plotWidth) * input.length;
    return snapValue(rawMeters);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const snappedX = clientXToSnappedMeters(e.clientX);
    setCursorXMeters(snappedX);

    if (!dragTarget) return;

    if (dragTarget.kind === 'support') {
      onChange({
        ...input,
        supports: input.supports.map((s) =>
          s.id === dragTarget.id ? { ...s, x: snappedX } : s
        ),
      });
    } else if (dragTarget.kind === 'point_load') {
      onChange({
        ...input,
        loads: input.loads.map((l) =>
          l.id === dragTarget.id && (l.kind === 'point_force' || l.kind === 'point_moment')
            ? { ...l, x: snappedX }
            : l
        ),
      });
    } else if (dragTarget.kind === 'dist_start') {
      onChange({
        ...input,
        loads: input.loads.map((l) =>
          l.id === dragTarget.id && l.kind === 'distributed'
            ? { ...l, xStart: Math.min(snappedX, l.xEnd - snapStep) }
            : l
        ),
      });
    } else if (dragTarget.kind === 'dist_end') {
      onChange({
        ...input,
        loads: input.loads.map((l) =>
          l.id === dragTarget.id && l.kind === 'distributed'
            ? { ...l, xEnd: Math.max(snappedX, l.xStart + snapStep) }
            : l
        ),
      });
    }
  };

  const handlePointerUp = () => {
    setDragTarget(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select_drag') return;
    const xPos = clientXToSnappedMeters(e.clientX);
    const uid = Math.random().toString(36).slice(2, 7);

    if (
      activeTool === 'add_pinned' ||
      activeTool === 'add_roller' ||
      activeTool === 'add_hinge'
    ) {
      const typeMap: Record<string, SupportType> = {
        add_pinned: 'pinned',
        add_roller: 'roller',
        add_hinge: 'internal_hinge',
      };
      const nextChar = String.fromCharCode(65 + input.supports.length);
      onChange({
        ...input,
        supports: [
          ...input.supports,
          {
            id: `sup-${uid}`,
            label: nextChar,
            x: xPos,
            type: typeMap[activeTool],
            surfaceAngleDeg: 0,
          },
        ],
      });
      setActiveTool('select_drag');
    } else if (activeTool === 'add_force') {
      const idx = input.loads.filter((l) => l.kind === 'point_force').length + 1;
      onChange({
        ...input,
        loads: [
          ...input.loads,
          {
            id: `F-${uid}`,
            kind: 'point_force',
            label: `F_${idx}`,
            x: xPos,
            magnitude: 20,
            angleDeg: -90,
          },
        ],
      });
      setActiveTool('select_drag');
    } else if (activeTool === 'add_moment') {
      const idx = input.loads.filter((l) => l.kind === 'point_moment').length + 1;
      onChange({
        ...input,
        loads: [
          ...input.loads,
          {
            id: `M-${uid}`,
            kind: 'point_moment',
            label: `M_${idx}`,
            x: xPos,
            magnitude: 15,
            direction: 'cw',
          },
        ],
      });
      setActiveTool('select_drag');
    } else if (activeTool === 'add_distributed') {
      const xEnd = Math.min(input.length, Number((xPos + Math.max(1, snapStep * 4)).toFixed(2)));
      const xStart = Math.max(0, Number((xEnd - Math.max(1, snapStep * 4)).toFixed(2)));
      onChange({
        ...input,
        loads: [
          ...input.loads,
          {
            id: `q-${uid}`,
            kind: 'distributed',
            label: 'q',
            xStart,
            xEnd,
            qStart: 10,
            qEnd: 10,
          },
        ],
      });
      setActiveTool('select_drag');
    }
  };

  // Генерация делений сетки snap-to-grid
  const gridTicks: number[] = [];
  for (let x = 0; x <= input.length + 1e-5; x += snapStep) {
    gridTicks.push(Number(x.toFixed(2)));
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-3 shadow-xs">
      {/* Панель инструментов интерактивного холста */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTool('select_drag')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-semibold transition ${
              activeTool === 'select_drag'
                ? 'bg-[#1F2937] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MousePointer className="h-3.5 w-3.5" />
            <span>Перемещение (Drag)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add_pinned')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition ${
              activeTool === 'add_pinned'
                ? 'bg-[#2563EB] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Шарнир неподв.</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add_roller')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition ${
              activeTool === 'add_roller'
                ? 'bg-[#2563EB] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Каток подв.</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add_hinge')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition ${
              activeTool === 'add_hinge'
                ? 'bg-[#2563EB] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Врезной шарнир</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add_force')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition ${
              activeTool === 'add_force'
                ? 'bg-[#DC2626] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Сила F</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add_moment')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition ${
              activeTool === 'add_moment'
                ? 'bg-[#DC2626] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Момент M</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add_distributed')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition ${
              activeTool === 'add_distributed'
                ? 'bg-[#DC2626] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Нагрузка q</span>
          </button>
        </div>

        {/* Переключатель шага привязки Snap-to-Grid */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-[#065F46]">
            <Magnet className="h-3.5 w-3.5" />
            <span>Сетка Snap:</span>
          </span>
          {([0.1, 0.5] as const).map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => setSnapStep(step)}
              className={`rounded px-2 py-1 font-mono font-semibold ${
                snapStep === step
                  ? 'bg-[#065F46] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {step} м
            </button>
          ))}
          <span className="ml-2 rounded bg-gray-100 px-2 py-1 font-mono text-gray-800">
            x = {cursorXMeters.toFixed(2)} м
          </span>
        </div>
      </div>

      {/* Интерактивный SVG-холст конструктора с маркерами перетаскивания */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair select-none rounded border border-gray-200 bg-[#F8F9FA] font-mono"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleCanvasClick}
      >
        {/* Линии сетки привязки */}
        {gridTicks.map((tickX) => {
          const px = xToPx(tickX);
          const isMajor = Math.abs(tickX - Math.round(tickX)) < 1e-4;
          return (
            <g key={`snap-tick-${tickX}`}>
              <line
                x1={px}
                y1={25}
                x2={px}
                y2={height - 25}
                stroke={isMajor ? '#D1D5DB' : '#E5E7EB'}
                strokeWidth={isMajor ? '1.1' : '0.7'}
              />
              {isMajor && (
                <text
                  x={px}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6B7280"
                >
                  {tickX}м
                </text>
              )}
            </g>
          );
        })}

        {/* Стержень балки */}
        <line
          x1={xToPx(0)}
          y1={yBeam}
          x2={xToPx(input.length)}
          y2={yBeam}
          stroke={PGS_PALETTE.graphite}
          strokeWidth="6"
        />

        {/* Интерактивные маркеры распределенных нагрузок (левый и правый ползунки) */}
        {input.loads.map((load) => {
          if (load.kind !== 'distributed') return null;
          const x1 = xToPx(load.xStart);
          const x2 = xToPx(load.xEnd);
          return (
            <g key={load.id}>
              <rect
                x={x1}
                y={yBeam - 34}
                width={Math.max(4, x2 - x1)}
                height={31}
                fill="rgba(220, 38, 38, 0.14)"
                stroke={PGS_PALETTE.loadRuby}
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <text
                x={0.5 * (x1 + x2)}
                y={yBeam - 40}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill={PGS_PALETTE.loadRuby}
              >
                {load.label}: [{load.xStart}..{load.xEnd}м] ({load.qStart}→{load.qEnd} кН/м)
              </text>
              {/* Ползунок начала q */}
              <circle
                cx={x1}
                cy={yBeam - 18}
                r="6.5"
                fill="#fff"
                stroke={PGS_PALETTE.loadRuby}
                strokeWidth="2.5"
                className="cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'dist_start', id: load.id });
                }}
              />
              {/* Ползунок конца q */}
              <circle
                cx={x2}
                cy={yBeam - 18}
                r="6.5"
                fill="#fff"
                stroke={PGS_PALETTE.loadRuby}
                strokeWidth="2.5"
                className="cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'dist_end', id: load.id });
                }}
              />
            </g>
          );
        })}

        {/* Интерактивные маркеры сосредоточенных сил и моментов */}
        {input.loads.map((load) => {
          if (load.kind === 'distributed') return null;
          const px = xToPx(load.x);
          return (
            <g
              key={load.id}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDragTarget({ kind: 'point_load', id: load.id });
              }}
            >
              <line
                x1={px}
                y1={yBeam - 52}
                x2={px}
                y2={yBeam - 4}
                stroke={PGS_PALETTE.loadRuby}
                strokeWidth="2.8"
              />
              <circle
                cx={px}
                cy={yBeam - 52}
                r="7"
                fill={PGS_PALETTE.loadRuby}
                stroke="#fff"
                strokeWidth="1.8"
              />
              <text
                x={px}
                y={yBeam - 64}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill={PGS_PALETTE.loadRuby}
              >
                {load.label} ({load.x}м)
              </text>
            </g>
          );
        })}

        {/* Интерактивные маркеры опор */}
        {input.supports.map((sup) => {
          const px = xToPx(sup.x);
          return (
            <g
              key={sup.id}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDragTarget({ kind: 'support', id: sup.id });
              }}
            >
              <polygon
                points={`${px},${yBeam + 2} ${px - 11},${yBeam + 22} ${px + 11},${yBeam + 22}`}
                fill={PGS_PALETTE.reactionBlue}
                fillOpacity="0.85"
                stroke={PGS_PALETTE.graphite}
                strokeWidth="1.5"
              />
              <text
                x={px}
                y={yBeam + 36}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill={PGS_PALETTE.reactionBlue}
              >
                {sup.label} ({sup.x}м)
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};