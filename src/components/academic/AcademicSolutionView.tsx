import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { BeamProblemInput, BeamSolverOutput } from '../../types/mechanics';
import {
  generateBeamAcademicSolution,
  AcademicFormulaStep,
} from '../../core/academic/solutionGenerator';
import { SectionCutFBD } from '../diagrams/SectionCutFBD';
import { CheckCircle2, AlertTriangle, Printer, BookOpen } from 'lucide-react';

interface AcademicSolutionViewProps {
  input: BeamProblemInput;
  solverOutput: BeamSolverOutput;
}

/**
 * Безопасный рендерер формул KaTeX без внешних оберток
 */
export const KatexBlock: React.FC<{ math: string; inline?: boolean }> = ({
  math,
  inline = false,
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: !inline,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return math;
    }
  }, [math, inline]);

  return (
    <span
      className={
        inline
          ? 'inline-block max-w-full overflow-x-auto align-middle'
          : 'my-1.5 block max-w-full overflow-x-auto py-1'
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const AcademicSolutionView: React.FC<AcademicSolutionViewProps> = ({
  input,
  solverOutput,
}) => {
  const doc = useMemo(() => {
    if (!solverOutput.isStaticallyDeterminate) return null;
    return generateBeamAcademicSolution(input, solverOutput);
  }, [input, solverOutput]);

  if (!solverOutput.isStaticallyDeterminate || !doc) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span>Расчет невозможен</span>
        </div>
        <p className="mt-1">{solverOutput.errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-3.5 text-[#1F2937] shadow-sm md:p-6 print:border-none print:p-0 print:shadow-none">
      {/* Шапка академического листа РГР */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1F2937] pb-4 md:mb-6 md:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#065F46] md:text-xs">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>Кафедра ПГС • Строительная механика и сопротивление материалов</span>
          </div>
          <h2 className="mt-1 text-base font-bold tracking-tight text-[#1F2937] md:text-xl">
            {doc.title}
          </h2>
          <p className="text-xs text-gray-600 md:text-sm">{doc.subtitle}</p>
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

      {/* РАЗДЕЛ I. ПРЕОБРАЗОВАНИЕ В РАСЧЕТНУЮ СХЕМУ (FBD) */}
      <section className="mb-6 md:mb-7">
        <h3 className="mb-2 border-l-4 border-[#1F2937] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
          I. Преобразование в расчетную схему (FBD)
        </h3>
        <p className="mb-3 text-xs text-gray-700 md:text-sm">{doc.fbdSection.description}</p>
        <div className="space-y-2.5 rounded-md border border-gray-200 bg-[#F8F9FA] p-2.5 md:p-4">
          {doc.fbdSection.steps.map((step, idx) => (
            <FormulaStepItem key={idx} step={step} />
          ))}
        </div>
      </section>

      {/* РАЗДЕЛ II. ОПРЕДЕЛЕНИЕ ОПОРНЫХ РЕАКЦИЙ ИЗ УРАВНЕНИЙ СТАТИКИ */}
      <section className="mb-6 md:mb-7">
        <h3 className="mb-2 border-l-4 border-[#2563EB] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
          II. Определение опорных реакций (Уравнения статики)
        </h3>
        <div className="space-y-3 rounded-md border border-gray-200 bg-[#F8F9FA] p-2.5 md:p-4">
          {doc.staticsSection.steps.map((step, idx) => (
            <FormulaStepItem key={idx} step={step} />
          ))}

          {/* Плашка обязательной статической проверки (стиль меловой доски #065F46) */}
          <div className="mt-4 rounded-md border border-[#065F46]/40 bg-[#065F46]/5 p-2.5 md:p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#065F46]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Обязательная проверка равновесия</span>
            </div>
            <FormulaStepItem step={doc.staticsSection.verificationStep} />
          </div>
        </div>
      </section>

      {/* РАЗДЕЛ III. МЕТОД СЕЧЕНИЙ (РОРО) И ПОСТРОЕНИЕ ЭПЮР ПО УЧАСТКАМ */}
      <section className="mb-6 md:mb-7">
        <h3 className="mb-2 border-l-4 border-[#DC2626] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
          III. Метод сечений (РОРО) и аналитические уравнения эпюр Q и M
        </h3>
        <p className="mb-4 text-xs text-gray-700 md:text-sm">{doc.sectionsMethod.introText}</p>

        <div className="space-y-4 md:space-y-5">
          {doc.sectionsMethod.segmentBlocks.map((block) => {
            const reactionsLeft = solverOutput.reactions.filter(
              (r) => r.x <= block.segmentData.xStart + 1e-5
            );
            return (
              <div
                key={block.segmentIndex}
                className="rounded-md border border-gray-300 bg-[#F8F9FA] p-2.5 md:p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-gray-200 pb-2">
                  <span className="text-sm font-bold text-[#1F2937] md:text-base">{block.intervalTitle}</span>
                  <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold">
                    <KatexBlock math={block.boundsKatex} inline />
                  </span>
                </div>

                {/* Векторная схема отсеченной части балки */}
                <SectionCutFBD
                  segment={block.segmentData}
                  reactionsLeft={reactionsLeft}
                />

                {/* Пошаговые формулы Q(x_i), M(x_i) и экстремумы */}
                <div className="mt-2 space-y-2.5">
                  {block.steps.map((step, sIdx) => (
                    <FormulaStepItem key={sIdx} step={step} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* РАЗДЕЛ IV. РАСЧЕТ НА ПРОЧНОСТЬ И ПОДБОР СЕЧЕНИЯ ПО СОРТАМЕНТУ ГОСТ */}
      <section>
        <h3 className="mb-2 border-l-4 border-[#065F46] pl-3 text-sm font-bold uppercase tracking-wide text-[#1F2937] md:text-base">
          IV. Подбор поперечного сечения из условия прочности
        </h3>
        <div className="space-y-3 rounded-md border border-gray-200 bg-[#F8F9FA] p-2.5 md:p-4">
          {doc.strengthSection.steps.map((step, idx) => (
            <FormulaStepItem key={idx} step={step} />
          ))}
          <div className="mt-3 border-t border-gray-300 pt-2.5 text-sm font-semibold text-[#065F46]">
            Итоговый вывод: {doc.strengthSection.conclusionText}
          </div>
        </div>
      </section>
    </div>
  );
};

const FormulaStepItem: React.FC<{ step: AcademicFormulaStep }> = ({ step }) => (
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