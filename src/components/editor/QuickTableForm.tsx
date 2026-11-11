import React from 'react';
import {
  BeamProblemInput,
  SupportType,
} from '../../types/mechanics';
import { Trash2, Plus } from 'lucide-react';

interface QuickTableFormProps {
  input: BeamProblemInput;
  onChange: (updated: BeamProblemInput) => void;
}

export const QuickTableForm: React.FC<QuickTableFormProps> = ({
  input,
  onChange,
}) => {
  const updateSupport = (index: number, patch: Partial<BeamProblemInput['supports'][number]>) => {
    const next = [...input.supports];
    next[index] = { ...next[index], ...patch };
    onChange({ ...input, supports: next });
  };

  const removeSupport = (id: string) => {
    onChange({
      ...input,
      supports: input.supports.filter((s) => s.id !== id),
    });
  };

  const removeLoad = (id: string) => {
    onChange({
      ...input,
      loads: input.loads.filter((l) => l.id !== id),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* 1. Общие параметры балки и материала */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-4">
        <h4 className="mb-3 border-b border-gray-200 pb-1.5 text-xs font-bold uppercase tracking-wider text-[#1F2937]">
          Параметры стержня и материала
        </h4>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-700">
              Полная длина балки L (м):
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={input.length}
              onChange={(e) =>
                onChange({ ...input, length: Math.max(0.5, Number(e.target.value)) })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-gray-700">
                Модуль Юнга E (МПа):
              </label>
              <input
                type="number"
                step="10000"
                value={input.E_MPa}
                onChange={(e) =>
                  onChange({ ...input, E_MPa: Math.max(1000, Number(e.target.value)) })
                }
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700">
                Допуск. напр. [σ] (МПа):
              </label>
              <input
                type="number"
                step="10"
                value={input.allowableStress_MPa}
                onChange={(e) =>
                  onChange({
                    ...input,
                    allowableStress_MPa: Math.max(10, Number(e.target.value)),
                  })
                }
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Таблица опор и врезных шарниров */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-8">
        <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
            Таблица узлов опор и связей
          </h4>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...input,
                supports: [
                  ...input.supports,
                  {
                    id: `sup-${Date.now()}`,
                    label: String.fromCharCode(65 + input.supports.length),
                    x: input.length,
                    type: 'roller',
                    surfaceAngleDeg: 0,
                  },
                ],
              })
            }
            className="inline-flex items-center gap-1 rounded bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Добавить опору</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-2">Узел</th>
                <th className="px-2 py-1.5">Тип связи</th>
                <th className="px-2 py-1.5">Координата x (м)</th>
                <th className="px-2 py-1.5">Угол опорной пл. (°)</th>
                <th className="py-1.5 pl-2 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {input.supports.map((sup, idx) => (
                <tr key={sup.id}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={sup.label}
                      onChange={(e) => updateSupport(idx, { label: e.target.value })}
                      className="w-12 rounded border border-gray-300 px-1.5 py-1 text-center font-bold"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-sans">
                    <select
                      value={sup.type}
                      onChange={(e) =>
                        updateSupport(idx, { type: e.target.value as SupportType })
                      }
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="pinned">Шарнирно-неподвижная (Rx, Ry)</option>
                      <option value="roller">Шарнирно-подвижная (каток, R)</option>
                      <option value="fixed">Жесткая заделка (Rx, Ry, M)</option>
                      <option value="internal_hinge">Врезной шарнир (M = 0)</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.1"
                      value={sup.x}
                      onChange={(e) =>
                        updateSupport(idx, { x: Number(e.target.value) })
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="5"
                      disabled={sup.type !== 'roller'}
                      value={sup.surfaceAngleDeg ?? 0}
                      onChange={(e) =>
                        updateSupport(idx, {
                          surfaceAngleDeg: Number(e.target.value),
                        })
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeSupport(sup.id)}
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

      {/* 3. Таблица внешних нагрузок (Силы F, Моменты M, Распределенные нагрузки q) */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-12">
        <h4 className="mb-2 border-b border-gray-200 pb-1.5 text-xs font-bold uppercase tracking-wider text-[#DC2626]">
          Ведомость внешних нагрузок (F, M, q)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-2">Обозн.</th>
                <th className="px-2 py-1.5">Вид нагрузки</th>
                <th className="px-2 py-1.5">Привязка x / [x₁; x₂] (м)</th>
                <th className="px-2 py-1.5">Величина (кН / кН·м / кН/м)</th>
                <th className="px-2 py-1.5">Угол α (°) / Направление</th>
                <th className="py-1.5 pl-2 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {input.loads.map((load, idx) => (
                <tr key={load.id}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={load.label}
                      onChange={(e) => {
                        const next = [...input.loads];
                        next[idx] = { ...load, label: e.target.value };
                        onChange({ ...input, loads: next });
                      }}
                      className="w-16 rounded border border-gray-300 px-1.5 py-1 font-bold"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-sans font-medium text-gray-700">
                    {load.kind === 'point_force' && 'Сосредоточенная сила F'}
                    {load.kind === 'point_moment' && 'Пара сил (момент) M'}
                    {load.kind === 'distributed' && 'Распределенная нагрузка q'}
                  </td>
                  <td className="px-2 py-1.5">
                    {load.kind === 'distributed' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={load.xStart}
                          onChange={(e) => {
                            const next = [...input.loads];
                            next[idx] = { ...load, xStart: Number(e.target.value) };
                            onChange({ ...input, loads: next });
                          }}
                          className="w-16 rounded border border-gray-300 px-1.5 py-1"
                        />
                        <span>…</span>
                        <input
                          type="number"
                          step="0.1"
                          value={load.xEnd}
                          onChange={(e) => {
                            const next = [...input.loads];
                            next[idx] = { ...load, xEnd: Number(e.target.value) };
                            onChange({ ...input, loads: next });
                          }}
                          className="w-16 rounded border border-gray-300 px-1.5 py-1"
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.1"
                        value={load.x}
                        onChange={(e) => {
                          const next = [...input.loads];
                          next[idx] = { ...load, x: Number(e.target.value) };
                          onChange({ ...input, loads: next });
                        }}
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {load.kind === 'distributed' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={load.qStart}
                          onChange={(e) => {
                            const next = [...input.loads];
                            next[idx] = { ...load, qStart: Number(e.target.value) };
                            onChange({ ...input, loads: next });
                          }}
                          className="w-16 rounded border border-gray-300 px-1.5 py-1"
                          title="q_нач (кН/м)"
                        />
                        <span>→</span>
                        <input
                          type="number"
                          step="1"
                          value={load.qEnd}
                          onChange={(e) => {
                            const next = [...input.loads];
                            next[idx] = { ...load, qEnd: Number(e.target.value) };
                            onChange({ ...input, loads: next });
                          }}
                          className="w-16 rounded border border-gray-300 px-1.5 py-1"
                          title="q_кон (кН/м)"
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={load.magnitude}
                        onChange={(e) => {
                          const next = [...input.loads];
                          next[idx] = {
                            ...load,
                            magnitude: Math.max(0, Number(e.target.value)),
                          };
                          onChange({ ...input, loads: next });
                        }}
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-sans">
                    {load.kind === 'point_force' && (
                      <input
                        type="number"
                        step="5"
                        value={load.angleDeg}
                        onChange={(e) => {
                          const next = [...input.loads];
                          next[idx] = { ...load, angleDeg: Number(e.target.value) };
                          onChange({ ...input, loads: next });
                        }}
                        className="w-20 rounded border border-gray-300 px-2 py-1 font-mono"
                      />
                    )}
                    {load.kind === 'point_moment' && (
                      <select
                        value={load.direction}
                        onChange={(e) => {
                          const next = [...input.loads];
                          next[idx] = {
                            ...load,
                            direction: e.target.value as 'ccw' | 'cw',
                          };
                          onChange({ ...input, loads: next });
                        }}
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        <option value="ccw">Против часовой стрелки (+)</option>
                        <option value="cw">По часовой стрелке (-)</option>
                      </select>
                    )}
                    {load.kind === 'distributed' && (
                      <span className="text-gray-500">
                        {Math.abs(load.qStart - load.qEnd) < 1e-4
                          ? 'Равномерная'
                          : 'Трапециевидная / Треугольная'}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLoad(load.id)}
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