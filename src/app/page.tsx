'use client';

import React, { useState, useMemo } from 'react';
import {
  ProblemType,
  BeamProblemInput,
  SteppedRodProblemInput,
  TorsionShaftProblemInput,
} from '@/types/mechanics';
import { solveBeamProblem } from '@/core/solver/beamSolver';
import {
  solveSteppedRod,
  solveTorsionShaft,
  solveCompositeSection,
  CompositePartInput,
} from '@/core/solver/rodAndShaftSolver';
import {
  generateSteppedRodAcademicSteps,
  generateTorsionAcademicSteps,
} from '@/core/academic/solutionGenerator';
import {
  BEAM_PRESETS,
  DEFAULT_STEPPED_ROD_PRESET,
  DEFAULT_TORSION_PRESET,
  DEFAULT_COMPOSITE_SECTION_PRESET,
} from '@/data/presets';
import { InteractiveBeamCanvas } from '@/components/editor/InteractiveBeamCanvas';
import { QuickTableForm } from '@/components/editor/QuickTableForm';
import { BeamDiagramsRenderer } from '@/components/diagrams/BeamDiagramsRenderer';
import {
  AcademicSolutionView,
  KatexBlock,
} from '@/components/academic/AcademicSolutionView';
import { SteppedRodCanvas } from '@/components/stepped-rod/SteppedRodCanvas';
import { SteppedRodTableForm } from '@/components/stepped-rod/SteppedRodTableForm';
import { SteppedRodDiagramsRenderer } from '@/components/stepped-rod/SteppedRodDiagramsRenderer';
import {
  Compass,
  Layers,
  RotateCw,
  Maximize2,
  Sliders,
} from 'lucide-react';

export default function PgsMechanicsPlatformPage() {
  const [activeModule, setActiveModule] = useState<ProblemType>('beam');

  // Состояния инженерных модулей с функциями обновления
  const [beamInput, setBeamInput] = useState<BeamProblemInput>(BEAM_PRESETS[0].data);
  const [rodInput, setRodInput] = useState<SteppedRodProblemInput>(DEFAULT_STEPPED_ROD_PRESET);
  const [shaftInput, setShaftInput] = useState<TorsionShaftProblemInput>(DEFAULT_TORSION_PRESET);
  const [sectionParts, setSectionParts] = useState<CompositePartInput[]>(DEFAULT_COMPOSITE_SECTION_PRESET);

  // Реактивный пересчет в аналитическом ядре
  const beamOutput = useMemo(() => solveBeamProblem(beamInput), [beamInput]);
  const rodOutput = useMemo(() => solveSteppedRod(rodInput), [rodInput]);
  const shaftOutput = useMemo(() => solveTorsionShaft(shaftInput), [shaftInput]);
  const sectionOutput = useMemo(() => solveCompositeSection(sectionParts), [sectionParts]);

  const rodSteps = useMemo(
    () => generateSteppedRodAcademicSteps(rodInput, rodOutput),
    [rodInput, rodOutput]
  );
  const shaftSteps = useMemo(
    () => generateTorsionAcademicSteps(shaftInput, shaftOutput),
    [shaftInput, shaftOutput]
  );

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#1F2937]">
      {/* Верхняя навигационная панель кафедры ПГС */}
      <header className="border-b border-gray-300 bg-white px-6 py-4 shadow-xs print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#065F46]">
              <Compass className="h-4 w-4" />
              <span>Интерактивный САПР-конструктор • Кафедра ПГС</span>
            </div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#1F2937]">
              Статика, Сопротивление материалов и Строительная механика
            </h1>
          </div>

          {/* Переключатель инженерных модулей */}
          <nav className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveModule('beam')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
                activeModule === 'beam'
                  ? 'bg-[#1F2937] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>1. Изгиб балок и рам (N, Q, M)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('stepped_rod')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
                activeModule === 'stepped_rod'
                  ? 'bg-[#1F2937] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>2. Ступенчатые стержни (N, σ, Δl)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('torsion_shaft')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
                activeModule === 'torsion_shaft'
                  ? 'bg-[#1F2937] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>3. Кручение валов (Mk, τ, φ)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('cross_section')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
                activeModule === 'cross_section'
                  ? 'bg-[#1F2937] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>4. Геометрия сечений (ГОСТ)</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Основная рабочая область */}
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* ================================================================
            МОДУЛЬ 1: ИЗГИБ БАЛОК И РАМ
        ================================================================ */}
        {activeModule === 'beam' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white p-3.5 shadow-xs print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Типовые расчетные схемы из задачников и РГР:
              </span>
              <div className="flex flex-wrap gap-2">
                {BEAM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setBeamInput(preset.data)}
                    className="rounded border border-gray-300 bg-[#F8F9FA] px-3 py-1.5 text-xs font-semibold text-[#1F2937] transition hover:border-[#065F46] hover:bg-[#065F46]/5"
                    title={preset.sourceNote}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="print:hidden">
              <InteractiveBeamCanvas input={beamInput} onChange={setBeamInput} />
            </div>

            <div className="print:hidden">
              <QuickTableForm input={beamInput} onChange={setBeamInput} />
            </div>

            <BeamDiagramsRenderer input={beamInput} solverOutput={beamOutput} />

            <AcademicSolutionView input={beamInput} solverOutput={beamOutput} />
          </>
        )}

        {/* ================================================================
            МОДУЛЬ 2: РАСТЯЖЕНИЕ-СЖАТИЕ СТУПЕНЧАТЫХ СТЕРЖНЕЙ (КОНСТРУКТОР)
        ================================================================ */}
        {activeModule === 'stepped_rod' && (
          <div className="space-y-6">
            {/* 1. Интерактивный чертеж стержня с отображением ступеней разной толщины и осевых сил */}
            <div className="print:hidden">
              <SteppedRodCanvas
                input={rodInput}
                output={rodOutput}
                onChange={setRodInput}
              />
            </div>

            {/* 2. Табличный редактор параметров ступеней (длины, множители площадей) и нагрузок */}
            <div className="print:hidden">
              <SteppedRodTableForm
                input={rodInput}
                onChange={setRodInput}
              />
            </div>

            {/* 3. Векторные эпюры N [кН], sigma [МПа], u [мм] с синхронизированным визиром */}
            <SteppedRodDiagramsRenderer
              input={rodInput}
              output={rodOutput}
            />

            {/* 4. Академический вывод расчета РГР с формулами KaTeX */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-[#1F2937]">
                Расчетно-пояснительная записка: Растяжение-сжатие ступенчатого стержня
              </h2>
              <div className="space-y-3">
                {rodSteps.map((s, idx) => (
                  <div key={idx} className="rounded border border-gray-200 bg-[#F8F9FA] p-3.5">
                    {s.label && <div className="mb-1 text-sm font-semibold text-gray-800">{s.label}</div>}
                    <KatexBlock math={s.katex} />
                    {s.note && (
                      <div className="mt-2 text-xs font-bold text-[#065F46]">{s.note}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            МОДУЛЬ 3: КРУЧЕНИЕ СТУПЕНЧАТЫХ ВАЛОВ
        ================================================================ */}
        {activeModule === 'torsion_shaft' && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold">
              Модуль В: Расчет ступенчатого вала на кручение
            </h2>
            <div className="space-y-3">
              {shaftSteps.map((s, idx) => (
                <div key={idx} className="rounded border border-gray-200 bg-[#F8F9FA] p-3">
                  {s.label && <div className="text-sm font-semibold">{s.label}</div>}
                  <KatexBlock math={s.katex} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================
            МОДУЛЬ 4: ГЕОМЕТРИЧЕСКИЕ ХАРАКТЕРИСТИКИ СЛОЖНЫХ СЕЧЕНИЙ
        ================================================================ */}
        {activeModule === 'cross_section' && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold">
              Модуль Г: Геометрические характеристики составного прокатного сечения
            </h2>
            <div className="rounded border border-gray-200 bg-[#F8F9FA] p-4">
              <KatexBlock
                math={`\\begin{aligned}
                  A_{\\Sigma} &= ${sectionOutput.totalArea_cm2}\\text{ см}^2; \\quad z_C = ${sectionOutput.zc_cm}\\text{ см}; \\quad y_C = ${sectionOutput.yc_cm}\\text{ см}; \\\\
                  I_z &= ${sectionOutput.Iz_central_cm4}\\text{ см}^4; \\quad I_y = ${sectionOutput.Iy_central_cm4}\\text{ см}^4; \\quad I_{zy} = ${sectionOutput.Izy_central_cm4}\\text{ см}^4; \\\\
                  \\alpha_0 &= ${sectionOutput.alpha0_deg}^\\circ; \\quad I_{\\max} = \\mathbf{${sectionOutput.Imax_cm4}\\text{ см}^4}; \\quad I_{\\min} = \\mathbf{${sectionOutput.Imin_cm4}\\text{ см}^4}.
                \\end{aligned}`}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}