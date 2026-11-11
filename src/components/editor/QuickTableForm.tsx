import React from 'react';
import {
  BeamProblemInput,
  SupportNode,
  SupportType,
  PointForceLoad,
  PointMomentLoad,
  DistributedLoad,
} from '@/types/mechanics';
import { Plus, Trash2 } from 'lucide-react';
import { MobileBeamEditor } from './MobileBeamEditor';

interface QuickTableFormProps {
  input: BeamProblemInput;
  onChange: (updated: BeamProblemInput) => void;
}

export const QuickTableForm: React.FC<QuickTableFormProps> = ({
  input,
  onChange,
}) => {
  const updateSupport = (idx: number, patch: Partial<SupportNode>) => {
    const next = [...input.supports];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...input, supports: next });
  };

  const addSupport = () => {
    const nextIdx = input.supports.length + 1;
    const label = String.fromCharCode(64 + nextIdx);
    onChange({
      ...input,
      supports: [
        ...input.supports,
        {
          id: `sup-${Date.now()}`,
          label,
          x: Math.min(input.length, Number((input.length / 2).toFixed(1))),
          type: 'roller',
          surfaceAngleDeg: 0,
        },
      ],
    });
  };

  const removeSupport = (id: string) => {
    onChange({
      ...input,
      supports: input.supports.filter((s) => s.id !== id),
    });
  };

  const updateLoad = (id: string, patch: Record<string, unknown>) => {
    onChange({
      ...input,
      loads: input.loads.map((l) => (l.id === id ? ({ ...l, ...patch } as typeof l) : l)),
    });
  };

  const removeLoad = (id: string) => {
    onChange({
      ...input,
      loads: input.loads.filter((l) => l.id !== id),
    });
  };

  const addPointForce = () => {
    const count = input.loads.filter((l) => l.kind === 'point_force').length + 1;
    const newLoad: PointForceLoad = {
      id: `pf-${Date.now()}`,
      kind: 'point_force',
      label: `F_${count}`,
      x: Number((input.length / 2).toFixed(1)),
      magnitude: 20,
      angleDeg: -90,
    };
    onChange({ ...input, loads: [...input.loads, newLoad] });
  };

  const addDistributedLoad = (profile: 'const' | 'tri_right' | 'tri_left' = 'const') => {
    const count = input.loads.filter((l) => l.kind === 'distributed').length + 1;
    const newLoad: DistributedLoad = {
      id: `dl-${Date.now()}`,
      kind: 'distributed',
      label: count === 1 ? 'q' : `q_${count}`,
      xStart: 0,
      xEnd: Math.min(input.length, 3),
      qStart: profile === 'tri_right' ? 0 : 15,
      qEnd: profile === 'tri_left' ? 0 : 15,
    };
    onChange({ ...input, loads: [...input.loads, newLoad] });
  };

  const addPointMoment = () => {
    const count = input.loads.filter((l) => l.kind === 'point_moment').length + 1;
    const newLoad: PointMomentLoad = {
      id: `pm-${Date.now()}`,
      kind: 'point_moment',
      label: count === 1 ? 'M' : `M_${count}`,
      x: Number((input.length / 2).toFixed(1)),
      magnitude: 25,
      direction: 'ccw',
    };
    onChange({ ...input, loads: [...input.loads, newLoad] });
  };

  const pointForces = input.loads.filter((l): l is PointForceLoad => l.kind === 'point_force');
  const distributedLoads = input.loads.filter((l): l is DistributedLoad => l.kind === 'distributed');
  const pointMoments = input.loads.filter((l): l is PointMomentLoad => l.kind === 'point_moment');

  return (
    <>
    {/* Мобильный режим (< 768px): карточки-аккордеоны вместо широких таблиц */}
    <div className="md:hidden">
      <MobileBeamEditor
        input={input}
        onChange={onChange}
        updateSupport={updateSupport}
        addSupport={addSupport}
        removeSupport={removeSupport}
        updateLoad={updateLoad}
        removeLoad={removeLoad}
        addPointForce={addPointForce}
        addDistributedLoad={addDistributedLoad}
        addPointMoment={addPointMoment}
      />
    </div>

    {/* Десктопный режим (md и шире): табличный ввод без изменений */}
    <div className="hidden grid-cols-1 gap-4 md:grid lg:grid-cols-12">
      {/* 1. Общие параметры и опоры */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-5">
        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F2937]">
            Геометрия балки и опоры
          </h4>
          <button
            type="button"
            onClick={addSupport}
            className="inline-flex items-center gap-1 rounded bg-[#1F2937] px-2.5 py-1 text-xs font-semibold text-white hover:bg-gray-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Опора / Шарнир</span>
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-600">Длина балки L (м):</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={input.length}
              onChange={(e) =>
                onChange({ ...input, length: Math.max(0.5, Number(e.target.value)) })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600">Допускаемое [σ] (МПа):</label>
            <input
              type="number"
              step="10"
              min="10"
              value={input.allowableStress_MPa}
              onChange={(e) =>
                onChange({
                  ...input,
                  allowableStress_MPa: Math.max(10, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1 pr-2">Узел</th>
                <th className="px-2 py-1">x (м)</th>
                <th className="px-2 py-1">Тип связи</th>
                <th className="py-1 pl-2 text-right">Удалить</th>
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
                      className="w-12 rounded border border-gray-300 px-1.5 py-0.5 font-bold"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={input.length}
                      value={sup.x}
                      onChange={(e) => updateSupport(idx, { x: Number(e.target.value) })}
                      className="w-16 rounded border border-gray-300 px-1.5 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-sans">
                    <select
                      value={sup.type}
                      onChange={(e) =>
                        updateSupport(idx, { type: e.target.value as SupportType })
                      }
                      className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                    >
                      <option value="pinned">Шарнирно-неподвижная</option>
                      <option value="roller">Шарнирно-подвижная</option>
                      <option value="fixed">Жесткая заделка</option>
                      <option value="internal_hinge">Врезной шарнир (M=0)</option>
                    </select>
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeSupport(sup.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="inline h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Распределенные нагрузки q(x) (Постоянные, Треугольные, Трапециевидные) */}
      <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-xs lg:col-span-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
            Распределенные нагрузки q(x) — Постоянные и Треугольные
          </h4>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => addDistributedLoad('const')}
              className="inline-flex items-center gap-1 rounded bg-[#2563EB] px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>▭ Постоянная q</span>
            </button>
            <button
              type="button"
              onClick={() => addDistributedLoad('tri_right')}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-800"
              title="Треугольная возрастающая нагрузка от 0 до q_max"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>◢ Треуг. (0 → q_max)</span>
            </button>
            <button
              type="button"
              onClick={() => addDistributedLoad('tri_left')}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-800"
              title="Треугольная убывающая нагрузка от q_max до 0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>◣ Треуг. (q_max → 0)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1 pr-2">Имя</th>
                <th className="px-1.5 py-1">x_нач (м)</th>
                <th className="px-1.5 py-1">x_кон (м)</th>
                <th className="px-1.5 py-1">q_нач (кН/м)</th>
                <th className="px-1.5 py-1">q_кон (кН/м)</th>
                <th className="px-1.5 py-1">Форма</th>
                <th className="py-1 pl-1 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {distributedLoads.map((dl) => {
                const maxVal = Math.max(Math.abs(dl.qStart), Math.abs(dl.qEnd), 10);
                return (
                  <tr key={dl.id}>
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        value={dl.label}
                        onChange={(e) => updateLoad(dl.id, { label: e.target.value })}
                        className="w-12 rounded border border-gray-300 px-1.5 py-0.5 font-bold"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={dl.xStart}
                        onChange={(e) => updateLoad(dl.id, { xStart: Number(e.target.value) })}
                        className="w-16 rounded border border-gray-300 px-1.5 py-0.5"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={dl.xEnd}
                        onChange={(e) => updateLoad(dl.id, { xEnd: Number(e.target.value) })}
                        className="w-16 rounded border border-gray-300 px-1.5 py-0.5"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="number"
                        step="1"
                        value={dl.qStart}
                        onChange={(e) => updateLoad(dl.id, { qStart: Number(e.target.value) })}
                        className="w-16 rounded border border-blue-300 bg-blue-50/40 px-1.5 py-0.5 font-bold text-[#2563EB]"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="number"
                        step="1"
                        value={dl.qEnd}
                        onChange={(e) => updateLoad(dl.id, { qEnd: Number(e.target.value) })}
                        className="w-16 rounded border border-blue-300 bg-blue-50/40 px-1.5 py-0.5 font-bold text-[#2563EB]"
                      />
                    </td>
                    <td className="px-1.5 py-1.5 font-sans">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateLoad(dl.id, { qStart: maxVal, qEnd: maxVal })}
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                          title="Равномерная"
                        >
                          ▭
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLoad(dl.id, { qStart: 0, qEnd: maxVal })}
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                          title="Треугольная 0 → q_max"
                        >
                          ◢
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLoad(dl.id, { qStart: maxVal, qEnd: 0 })}
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                          title="Треугольная q_max → 0"
                        >
                          ◣
                        </button>
                      </div>
                    </td>
                    <td className="py-1.5 pl-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeLoad(dl.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. Сосредоточенные силы F и Моменты M */}
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-200 pt-3 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#DC2626]">
                Сосредоточенные силы F
              </span>
              <button
                type="button"
                onClick={addPointForce}
                className="inline-flex items-center gap-1 rounded bg-[#DC2626] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700"
              >
                <Plus className="h-3 w-3" /> Сила F
              </button>
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b text-gray-500">
                  <th>Имя</th>
                  <th>x (м)</th>
                  <th>F (кН)</th>
                  <th>Угол °</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pointForces.map((pf) => (
                  <tr key={pf.id}>
                    <td className="py-1">
                      <input
                        type="text"
                        value={pf.label}
                        onChange={(e) => updateLoad(pf.id, { label: e.target.value })}
                        className="w-11 rounded border px-1 py-0.5 font-bold"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={pf.x}
                        onChange={(e) => updateLoad(pf.id, { x: Number(e.target.value) })}
                        className="w-14 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="5"
                        value={pf.magnitude}
                        onChange={(e) => updateLoad(pf.id, { magnitude: Number(e.target.value) })}
                        className="w-14 rounded border px-1 py-0.5 font-bold text-[#DC2626]"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="15"
                        value={pf.angleDeg}
                        onChange={(e) => updateLoad(pf.id, { angleDeg: Number(e.target.value) })}
                        className="w-14 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeLoad(pf.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#D97706]">
                Изгибающие моменты M
              </span>
              <button
                type="button"
                onClick={addPointMoment}
                className="inline-flex items-center gap-1 rounded bg-[#D97706] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                <Plus className="h-3 w-3" /> Момент M
              </button>
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b text-gray-500">
                  <th>Имя</th>
                  <th>x (м)</th>
                  <th>M (кН·м)</th>
                  <th>Напр.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pointMoments.map((pm) => (
                  <tr key={pm.id}>
                    <td className="py-1">
                      <input
                        type="text"
                        value={pm.label}
                        onChange={(e) => updateLoad(pm.id, { label: e.target.value })}
                        className="w-11 rounded border px-1 py-0.5 font-bold"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={pm.x}
                        onChange={(e) => updateLoad(pm.id, { x: Number(e.target.value) })}
                        className="w-14 rounded border px-1 py-0.5"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="5"
                        value={pm.magnitude}
                        onChange={(e) => updateLoad(pm.id, { magnitude: Number(e.target.value) })}
                        className="w-14 rounded border px-1 py-0.5 font-bold text-[#D97706]"
                      />
                    </td>
                    <td className="font-sans">
                      <select
                        value={pm.direction}
                        onChange={(e) =>
                          updateLoad(pm.id, { direction: e.target.value as 'ccw' | 'cw' })
                        }
                        className="rounded border px-1 py-0.5 text-xs"
                      >
                        <option value="ccw">↺ против ЧС</option>
                        <option value="cw">↻ по ЧС</option>
                      </select>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeLoad(pm.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};