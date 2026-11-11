import React from 'react';
import { SteppedRodProblemInput } from '@/types/mechanics';
import { Plus, Trash2 } from 'lucide-react';

interface SteppedRodTableFormProps {
  input: SteppedRodProblemInput;
  onChange: (updated: SteppedRodProblemInput) => void;
}

export const SteppedRodTableForm: React.FC<SteppedRodTableFormProps> = ({
  input,
  onChange,
}) => {
  const updateSegment = (idx: number, patch: Partial<SteppedRodProblemInput['segments'][number]>) => {
    const next = [...input.segments];
    next[idx] = { ...next[idx], ...patch };
    // Если изменился коэффициент множителя площади — синхронизируем площадь
    if (patch.areaMultiplier !== undefined) {
      next[idx].area_mm2 = patch.areaMultiplier * input.baseArea_mm2;
    }
    onChange({ ...input, segments: next });
  };

  const addSegment = () => {
    const nextIdx = input.segments.length + 1;
    onChange({
      ...input,
      segments: [
        ...input.segments,
        {
          id: `rod-seg-${Date.now()}`,
          label: `Ступень ${nextIdx}`,
          length_m: 1.0,
          areaMultiplier: 1,
          area_mm2: input.baseArea_mm2,
          E_MPa: 2e5,
        },
      ],
    });
  };

  const removeSegment = (idx: number) => {
    if (input.segments.length <= 1) return;
    onChange({
      ...input,
      segments: input.segments.filter((_, i) => i !== idx),
    });
  };

  const updateLoad = (idx: number, patch: Partial<SteppedRodProblemInput['axialLoads'][number]>) => {
    const next = [...input.axialLoads];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...input, axialLoads: next });
  };

  const addLoad = () => {
    const nextIdx = input.axialLoads.length + 1;
    onChange({
      ...input,
      axialLoads: [
        ...input.axialLoads,
        {
          id: `p-${Date.now()}`,
          label: `P_${nextIdx}`,
          x_m: 0,
          force_kN: 20,
        },
      ],
    });
  };

  const removeLoad = (idx: number) => {
    onChange({
      ...input,
      axialLoads: input.axialLoads.filter((_, i) => i !== idx),
    });
  };

  const setBaseArea = (newBase: number) => {
    const base = Math.max(10, newBase);
    onChange({
      ...input,
      baseArea_mm2: base,
      segments: input.segments.map((s) => ({
        ...s,
        area_mm2: (s.areaMultiplier ?? 1) * base,
      })),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* 1. Базовые параметры стержня и допускаемые значения */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm lg:col-span-4">
        <h4 className="mb-3 border-b border-gray-200 pb-1.5 text-xs font-bold uppercase tracking-wider text-[#1F2937]">
          Характеристики материала и допуски
        </h4>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-700">
              Базовая площадь A (мм²):
            </label>
            <input
              type="number"
              step="50"
              min="10"
              value={input.baseArea_mm2}
              onChange={(e) => setBaseArea(Number(e.target.value))}
              className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-gray-700">
                [σ] допускаемое (МПа):
              </label>
              <input
                type="number"
                step="10"
                value={input.allowableStress_MPa}
                onChange={(e) =>
                  onChange({
                    ...input,
                    allowableStress_MPa: Math.max(1, Number(e.target.value)),
                  })
                }
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700">
                [Δl] допуск. удл. (мм):
              </label>
              <input
                type="number"
                step="0.1"
                value={input.allowableElongation_mm}
                onChange={(e) =>
                  onChange({
                    ...input,
                    allowableElongation_mm: Math.max(0.01, Number(e.target.value)),
                  })
                }
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Таблица ступеней стержня */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm lg:col-span-8">
        <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
            Ступени стержня (геометрия)
          </h4>
          <button
            type="button"
            onClick={addSegment}
            className="inline-flex items-center gap-1 rounded bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Добавить ступень</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-2">Ступень</th>
                <th className="px-2 py-1.5">Длина l_i (м)</th>
                <th className="px-2 py-1.5">Множитель (1A, 2A, ...)</th>
                <th className="px-2 py-1.5">Площадь A_i (мм²)</th>
                <th className="py-1.5 pl-2 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {input.segments.map((seg, idx) => (
                <tr key={seg.id}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={seg.label}
                      onChange={(e) => updateSegment(idx, { label: e.target.value })}
                      className="w-24 rounded border border-gray-300 px-1.5 py-1 font-sans font-medium"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={seg.length_m}
                      onChange={(e) =>
                        updateSegment(idx, { length_m: Math.max(0.01, Number(e.target.value)) })
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={seg.areaMultiplier ?? 1}
                      onChange={(e) =>
                        updateSegment(idx, { areaMultiplier: Number(e.target.value) })
                      }
                      className="w-16 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-bold text-[#1F2937]">
                    {seg.area_mm2.toFixed(0)}
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeSegment(idx)}
                      disabled={input.segments.length <= 1}
                      className="text-red-600 hover:text-red-800 disabled:opacity-40"
                    >
                      <Trash2 className="inline h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Таблица продольных нагрузок */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm lg:col-span-12">
        <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
            Осевые сосредоточенные нагрузки (P)
          </h4>
          <button
            type="button"
            onClick={addLoad}
            className="inline-flex items-center gap-1 rounded bg-[#DC2626] px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Добавить силу P</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-2">Обозначение</th>
                <th className="px-2 py-1.5">Координата x (м)</th>
                <th className="px-2 py-1.5">Сила P (кН) (+ вправо, - влево)</th>
                <th className="py-1.5 pl-2 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {input.axialLoads.map((load, idx) => (
                <tr key={load.id}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={load.label}
                      onChange={(e) => updateLoad(idx, { label: e.target.value })}
                      className="w-20 rounded border border-gray-300 px-1.5 py-1 font-bold"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.1"
                      value={load.x_m}
                      onChange={(e) => updateLoad(idx, { x_m: Number(e.target.value) })}
                      className="w-24 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="5"
                      value={load.force_kN}
                      onChange={(e) => updateLoad(idx, { force_kN: Number(e.target.value) })}
                      className="w-28 rounded border border-gray-300 px-2 py-1 font-bold text-[#DC2626]"
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLoad(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="inline h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};