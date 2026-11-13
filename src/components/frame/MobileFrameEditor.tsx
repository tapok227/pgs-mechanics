'use client';

import React, { useState } from 'react';
import {
  FrameProblemInput,
  FrameNode,
  FrameElement,
  FrameSupportType,
  FrameNodalForceLoad,
  FrameMemberPointForceLoad,
  FrameMemberDistributedLoad,
  FrameMemberMomentLoad,
} from '@/types/frame';
import {
  MobileAccordionCard,
  MobileAddButton,
  MobileChoiceGroup,
  MobileEmptyHint,
  MobileNumberField,
  MobileSectionHeader,
  MobileSelectField,
  MobileTextField,
  formatMeters,
  formatNumber,
  prettyLabel,
} from '@/components/mobile/MobileUi';

export interface MobileFrameEditorProps {
  input: FrameProblemInput;
  onChange: (updated: FrameProblemInput) => void;
  addNode: () => void;
  addElement: () => void;
  addNodalForce?: () => void;
  addMemberPointForce?: () => void;
  addMemberDistributed?: (profile?: 'const' | 'tri_right' | 'tri_left') => void;
  addMemberMoment?: () => void;
}

const FRAME_SUPPORT_LABELS: Record<FrameSupportType, string> = {
  none: 'Свободный узел',
  pinned: 'Шарнирно-неподвижная (Rx, Ry)',
  roller_x: 'Каток горизонтальный (Ry)',
  roller_y: 'Каток вертикальный (Rx)',
  fixed: 'Жёсткая заделка (Rx, Ry, M)',
};

const FRAME_SUPPORT_OPTIONS: Array<{ value: FrameSupportType; label: React.ReactNode }> = [
  { value: 'none', label: <>• Свободный<br />узел</> },
  { value: 'pinned', label: <>△ Шарнирно-<br />неподв.</> },
  { value: 'roller_x', label: <>⊼ Каток<br />гориз. (Ry)</> },
  { value: 'roller_y', label: <>⊽ Каток<br />верт. (Rx)</> },
  { value: 'fixed', label: <>▐ Жёсткая<br />заделка</> },
];

const NODAL_FORCE_DIRS: Array<{ value: number; label: React.ReactNode; ariaLabel: string }> = [
  { value: -90, label: '↓ −90°', ariaLabel: 'Вертикально вниз (−90°)' },
  { value: 90, label: '↑ +90°', ariaLabel: 'Вертикально вверх (+90°)' },
  { value: 0, label: '→ 0°', ariaLabel: 'Горизонтально вправо (0°)' },
  { value: 180, label: '← 180°', ariaLabel: 'Горизонтально влево (180°)' },
  { value: -120, label: '↙ −120°', ariaLabel: 'Под углом −120°' },
  { value: 45, label: '↗ +45°', ariaLabel: 'Под углом +45°' },
];

type QShape = 'const' | 'tri_right' | 'tri_left';

const Q_SHAPES: Array<{ value: QShape; label: React.ReactNode }> = [
  { value: 'const', label: <>▭ Равно&shy;мерная</> },
  { value: 'tri_right', label: <>◢ 0 → q</> },
  { value: 'tri_left', label: <>◣ q → 0</> },
];

const Q_DIR_OPTIONS: Array<{
  value: FrameMemberDistributedLoad['direction'];
  label: string;
}> = [
  { value: 'local_perp', label: 'Перпендикулярно стержню' },
  { value: 'global_x', label: 'Горизонтально (по оси X)' },
  { value: 'global_y', label: 'Вертикально (по оси Y)' },
];

function detectQShape(dl: FrameMemberDistributedLoad): QShape | null {
  if (Math.abs(dl.qStart_kNm - dl.qEnd_kNm) < 1e-6) return 'const';
  if (Math.abs(dl.qStart_kNm) < 1e-6 && Math.abs(dl.qEnd_kNm) > 1e-6) return 'tri_right';
  if (Math.abs(dl.qEnd_kNm) < 1e-6 && Math.abs(dl.qStart_kNm) > 1e-6) return 'tri_left';
  return null;
}

export const MobileFrameEditor: React.FC<MobileFrameEditorProps> = ({
  input,
  onChange,
  addNode,
  addElement,
  addNodalForce,
  addMemberPointForce,
  addMemberDistributed,
  addMemberMoment,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const updateNode = (idx: number, patch: Partial<FrameNode>) => {
    const next = [...input.nodes];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...input, nodes: next });
  };

  const removeNode = (id: string) => {
    const remainingEls = input.elements.filter(
      (e) => e.nodeStartId !== id && e.nodeEndId !== id
    );
    const removedElIds = new Set(
      input.elements
        .filter((e) => e.nodeStartId === id || e.nodeEndId === id)
        .map((e) => e.id)
    );
    onChange({
      ...input,
      nodes: input.nodes.filter((item) => item.id !== id),
      elements: remainingEls,
      loads: input.loads.filter((l) => {
        if (l.kind === 'nodal_force') return l.nodeId !== id;
        return !removedElIds.has(l.elementId);
      }),
    });
  };

  const updateElement = (idx: number, patch: Partial<FrameElement>) => {
    const next = [...input.elements];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...input, elements: next });
  };

  const removeElement = (id: string) => {
    onChange({
      ...input,
      elements: input.elements.filter((item) => item.id !== id),
      loads: input.loads.filter((l) =>
        l.kind === 'nodal_force' ? true : l.elementId !== id
      ),
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

  const handleAddNodalForce = () => {
    if (addNodalForce) return addNodalForce();
    if (input.nodes.length === 0) return;
    const target = input.nodes[0];
    const count = input.loads.filter((l) => l.kind === 'nodal_force').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_nf_${Date.now()}`,
          kind: 'nodal_force',
          nodeId: target.id,
          label: `P_${count}`,
          magnitude_kN: 20,
          angleDeg: -90,
        },
      ],
    });
  };

  const handleAddMemberPointForce = () => {
    if (addMemberPointForce) return addMemberPointForce();
    if (input.elements.length === 0) return;
    const el = input.elements[0];
    const count = input.loads.filter((l) => l.kind === 'member_point_force').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_mpf_${Date.now()}`,
          kind: 'member_point_force',
          elementId: el.id,
          label: `F_${count}`,
          tPosition: 0.5,
          magnitude_kN: -15,
        },
      ],
    });
  };

  const handleAddMemberDistributed = (profile: QShape = 'const') => {
    if (addMemberDistributed) return addMemberDistributed(profile);
    if (input.elements.length === 0) return;
    const el = input.elements[0];
    const count = input.loads.filter((l) => l.kind === 'member_distributed').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_q_${Date.now()}`,
          kind: 'member_distributed',
          elementId: el.id,
          label: count === 1 ? 'q' : `q_${count}`,
          qStart_kNm: profile === 'tri_right' ? 0 : -10,
          qEnd_kNm: profile === 'tri_left' ? 0 : -10,
          direction: 'global_y',
        },
      ],
    });
  };

  const handleAddMemberMoment = () => {
    if (addMemberMoment) return addMemberMoment();
    if (input.elements.length === 0) return;
    const el = input.elements[0];
    const count = input.loads.filter((l) => l.kind === 'member_moment').length + 1;
    onChange({
      ...input,
      loads: [
        ...input.loads,
        {
          id: `fl_m_${Date.now()}`,
          kind: 'member_moment',
          elementId: el.id,
          label: count === 1 ? 'M' : `M_${count}`,
          tPosition: 0.5,
          moment_kNm: 15,
        },
      ],
    });
  };

  const nodeOptions = input.nodes.map((n) => ({
    value: n.id,
    label: `${n.label} (${formatMeters(n.x)}; ${formatMeters(n.y)} м)`,
  }));

  const elementOptions = input.elements.map((el) => ({
    value: el.id,
    label: el.label,
  }));

  const nodalForces = input.loads.filter(
    (l): l is FrameNodalForceLoad => l.kind === 'nodal_force'
  );
  const memberForces = input.loads.filter(
    (l): l is FrameMemberPointForceLoad => l.kind === 'member_point_force'
  );
  const memberDist = input.loads.filter(
    (l): l is FrameMemberDistributedLoad => l.kind === 'member_distributed'
  );
  const memberMoments = input.loads.filter(
    (l): l is FrameMemberMomentLoad => l.kind === 'member_moment'
  );

  const applyQShape = (dl: FrameMemberDistributedLoad, shape: QShape) => {
    const qMax = Math.max(Math.abs(dl.qStart_kNm), Math.abs(dl.qEnd_kNm)) || 10;
    const sign = dl.qStart_kNm < 0 || dl.qEnd_kNm < 0 ? -1 : 1;
    const q = sign * qMax;
    if (shape === 'const') updateLoad(dl.id, { qStart_kNm: q, qEnd_kNm: q });
    if (shape === 'tri_right') updateLoad(dl.id, { qStart_kNm: 0, qEnd_kNm: q });
    if (shape === 'tri_left') updateLoad(dl.id, { qStart_kNm: q, qEnd_kNm: 0 });
  };

  return (
    <div className="space-y-5">
      {/* 0. Общие параметры */}
      <section className="space-y-2">
        <MobileSectionHeader title="Параметры расчета рамы" />
        <div className="rounded-xl border border-gray-300 bg-white p-3 shadow-xs">
          <MobileNumberField
            label="Допускаемое напряжение [σ]"
            unit="МПа"
            value={input.allowableStress_MPa}
            step={10}
            min={10}
            onChange={(v) =>
              onChange({ ...input, allowableStress_MPa: Math.max(10, v) })
            }
          />
        </div>
      </section>

      {/* 1. Узлы рамы */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Узлы рамы (координаты X, Y, опоры и шарнир C)"
          count={input.nodes.length}
        />
        {input.nodes.length === 0 && <MobileEmptyHint text="Узлы рамы не заданы" />}
        {input.nodes.map((n, idx) => {
          const cardId = `fnode:${n.id}`;
          return (
            <MobileAccordionCard
              key={n.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeNode(n.id)}
              deleteLabel={`Удалить узел ${n.label}`}
              accentClass={n.isHinge ? 'border-l-[#065F46]' : 'border-l-[#1F2937]'}
              title={
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>Узел {n.label}</span>
                  <span className="text-gray-400">•</span>
                  <span className="font-mono text-sm">
                    ({formatMeters(n.x)}; {formatMeters(n.y)}) м
                  </span>
                  {n.isHinge && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-[#065F46]">
                      ○ Шарнир C
                    </span>
                  )}
                </span>
              }
              subtitle={
                <>
                  {FRAME_SUPPORT_LABELS[n.support]}
                  {n.isHinge ? ' • Врезной шарнир (M = 0)' : ''}
                </>
              }
            >
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <MobileTextField
                  label="Обозначение узла"
                  value={n.label}
                  onChange={(v) => updateNode(idx, { label: v })}
                />
                <button
                  type="button"
                  onClick={() => updateNode(idx, { isHinge: !n.isHinge })}
                  aria-pressed={Boolean(n.isHinge)}
                  className={`h-11 rounded-lg border px-3 text-xs font-extrabold transition ${
                    n.isHinge
                      ? 'border-[#065F46] bg-[#065F46] text-white'
                      : 'border-gray-300 bg-white text-[#1F2937] active:bg-gray-100'
                  }`}
                >
                  ○ Шарнир C (M=0)
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <MobileNumberField
                  label="Координата X"
                  unit="м"
                  value={n.x}
                  step={0.5}
                  onChange={(v) => updateNode(idx, { x: v })}
                />
                <MobileNumberField
                  label="Координата Y"
                  unit="м"
                  value={n.y}
                  step={0.5}
                  onChange={(v) => updateNode(idx, { y: v })}
                />
              </div>

              <MobileChoiceGroup
                label="Опорная связь в узле"
                options={FRAME_SUPPORT_OPTIONS}
                value={n.support}
                onSelect={(sup) => updateNode(idx, { support: sup })}
              />
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton label="+ Добавить узел" onClick={addNode} />
      </section>

      {/* 2. Стержни рамы */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Стержни рамы (стойки, ригели, наклонные)"
          count={input.elements.length}
          colorClass="text-[#1E3A8A]"
        />
        {input.elements.length === 0 && <MobileEmptyHint text="Стержни рамы не заданы" />}
        {input.elements.map((el, idx) => {
          const cardId = `fel:${el.id}`;
          const n1 = input.nodes.find((n) => n.id === el.nodeStartId);
          const n2 = input.nodes.find((n) => n.id === el.nodeEndId);
          const len = n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : 0;
          const releaseBadges: string[] = [];
          if (el.releaseStart) releaseBadges.push('шарнир в нач.');
          if (el.releaseEnd) releaseBadges.push('шарнир в кон.');

          return (
            <MobileAccordionCard
              key={el.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeElement(el.id)}
              deleteLabel={`Удалить стержень ${el.label}`}
              accentClass="border-l-[#1E3A8A]"
              title={<span className="text-[#1E3A8A]">{el.label}</span>}
              subtitle={
                <>
                  Узлы:{' '}
                  <span className="font-mono font-semibold text-[#1F2937]">
                    {n1?.label ?? '?'} → {n2?.label ?? '?'}
                  </span>
                  {' • '}
                  <span className="font-mono">L = {len.toFixed(2)} м</span>
                  {releaseBadges.length > 0 && ` • ${releaseBadges.join(', ')}`}
                </>
              }
            >
              <MobileTextField
                label="Название стержня"
                value={el.label}
                onChange={(v) => updateElement(idx, { label: v })}
              />

              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <MobileSelectField
                  label="Начало стержня"
                  value={el.nodeStartId}
                  options={nodeOptions}
                  onChange={(v) => updateElement(idx, { nodeStartId: v })}
                />
                <MobileSelectField
                  label="Конец стержня"
                  value={el.nodeEndId}
                  options={nodeOptions}
                  onChange={(v) => updateElement(idx, { nodeEndId: v })}
                />
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold text-gray-600">
                  Локальные врезные шарниры по концам стержня
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateElement(idx, { releaseStart: !el.releaseStart })}
                    aria-pressed={Boolean(el.releaseStart)}
                    className={`min-h-11 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                      el.releaseStart
                        ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                        : 'border-gray-300 bg-white text-[#1F2937] active:bg-gray-100'
                    }`}
                  >
                    ○ Шарнир в начале ({n1?.label ?? 'Нач'})
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElement(idx, { releaseEnd: !el.releaseEnd })}
                    aria-pressed={Boolean(el.releaseEnd)}
                    className={`min-h-11 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                      el.releaseEnd
                        ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                        : 'border-gray-300 bg-white text-[#1F2937] active:bg-gray-100'
                    }`}
                  >
                    ○ Шарнир в конце ({n2?.label ?? 'Кон'})
                  </button>
                </div>
              </div>
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton
          label="+ Добавить стержень"
          onClick={addElement}
          colorClass="border-[#1E3A8A]/50 text-[#1E3A8A] active:bg-blue-50"
        />
      </section>

      {/* 3. Узловые и стержневые силы */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Сосредоточенные силы (в узлах и на стержнях)"
          count={nodalForces.length + memberForces.length}
          colorClass="text-[#DC2626]"
        />
        {nodalForces.length === 0 && memberForces.length === 0 && (
          <MobileEmptyHint text="Сосредоточенных сил нет" />
        )}

        {nodalForces.map((nf) => {
          const cardId = `fnf:${nf.id}`;
          const node = input.nodes.find((n) => n.id === nf.nodeId);
          const activeDir = NODAL_FORCE_DIRS.some((d) => d.value === nf.angleDeg)
            ? nf.angleDeg
            : null;
          return (
            <MobileAccordionCard
              key={nf.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(nf.id)}
              deleteLabel={`Удалить узловую силу ${prettyLabel(nf.label)}`}
              accentClass="border-l-[#DC2626]"
              title={
                <>
                  <span className="text-[#DC2626]">
                    {prettyLabel(nf.label)} = {formatNumber(nf.magnitude_kN)} кН
                  </span>{' '}
                  <span className="text-sm font-semibold text-gray-600">
                    (узел {node?.label ?? '?'})
                  </span>
                </>
              }
              subtitle={`Узловая сила • угол α = ${formatNumber(nf.angleDeg)}° к оси X`}
              quickActions={
                <MobileChoiceGroup
                  columns={3}
                  options={NODAL_FORCE_DIRS}
                  value={activeDir}
                  onSelect={(a) => updateLoad(nf.id, { angleDeg: a })}
                  activeClass="border-[#DC2626] bg-[#DC2626] text-white"
                />
              }
            >
              <MobileSelectField
                label="Узел приложения"
                value={nf.nodeId}
                options={nodeOptions}
                onChange={(v) => updateLoad(nf.id, { nodeId: v })}
              />
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={nf.label}
                  onChange={(v) => updateLoad(nf.id, { label: v })}
                />
                <MobileNumberField
                  label="Модуль силы P"
                  unit="кН"
                  value={nf.magnitude_kN}
                  step={5}
                  min={0}
                  valueClass="text-[#DC2626]"
                  onChange={(v) => updateLoad(nf.id, { magnitude_kN: v })}
                />
              </div>
              <MobileNumberField
                label="Угол к оси +X"
                unit="°"
                value={nf.angleDeg}
                step={15}
                onChange={(v) => updateLoad(nf.id, { angleDeg: v })}
              />
            </MobileAccordionCard>
          );
        })}

        {memberForces.map((mf) => {
          const cardId = `fmf:${mf.id}`;
          const el = input.elements.find((e) => e.id === mf.elementId);
          return (
            <MobileAccordionCard
              key={mf.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(mf.id)}
              deleteLabel={`Удалить силу ${prettyLabel(mf.label)}`}
              accentClass="border-l-[#DC2626]"
              title={
                <>
                  <span className="text-[#DC2626]">
                    {prettyLabel(mf.label)} = {formatNumber(mf.magnitude_kN)} кН
                  </span>{' '}
                  <span className="font-mono text-sm text-gray-600">
                    (t = {formatNumber(mf.tPosition)})
                  </span>
                </>
              }
              subtitle={`На стержне «${el?.label ?? '?'}» • перпендикулярно оси`}
              quickActions={
                <div className="grid grid-cols-4 gap-1.5">
                  {[0.25, 0.5, 0.75].map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => updateLoad(mf.id, { tPosition: tp })}
                      className={`min-h-10 rounded-lg border text-xs font-bold ${
                        Math.abs(mf.tPosition - tp) < 1e-3
                          ? 'border-[#DC2626] bg-[#DC2626] text-white'
                          : 'border-gray-300 bg-white text-[#1F2937]'
                      }`}
                    >
                      {tp} L
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateLoad(mf.id, { magnitude_kN: -mf.magnitude_kN })
                    }
                    className="min-h-10 rounded-lg border border-gray-300 bg-white text-xs font-extrabold text-[#1F2937]"
                  >
                    ± Знак
                  </button>
                </div>
              }
            >
              <MobileSelectField
                label="Стержень"
                value={mf.elementId}
                options={elementOptions}
                onChange={(v) => updateLoad(mf.id, { elementId: v })}
              />
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={mf.label}
                  onChange={(v) => updateLoad(mf.id, { label: v })}
                />
                <MobileNumberField
                  label="Положение t (0..1)"
                  value={mf.tPosition}
                  step={0.05}
                  min={0.05}
                  max={0.95}
                  onChange={(v) => updateLoad(mf.id, { tPosition: v })}
                />
              </div>
              <MobileNumberField
                label="Величина силы P"
                unit="кН"
                value={mf.magnitude_kN}
                step={2}
                valueClass="text-[#DC2626]"
                onChange={(v) => updateLoad(mf.id, { magnitude_kN: v })}
              />
            </MobileAccordionCard>
          );
        })}

        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <MobileAddButton
            label="Узловая сила P"
            onClick={handleAddNodalForce}
            colorClass="border-[#DC2626]/50 text-[#DC2626] active:bg-red-50"
          />
          <MobileAddButton
            label="Сила на стержне"
            onClick={handleAddMemberPointForce}
            colorClass="border-[#DC2626]/50 text-[#DC2626] active:bg-red-50"
          />
        </div>
      </section>

      {/* 4. Распределенные нагрузки q */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Распределённые нагрузки q на стержнях"
          count={memberDist.length}
          colorClass="text-[#0284C7]"
        />
        {memberDist.length === 0 && <MobileEmptyHint text="Распределённых нагрузок нет" />}
        {memberDist.map((dl) => {
          const cardId = `fdl:${dl.id}`;
          const el = input.elements.find((e) => e.id === dl.elementId);
          const shape = detectQShape(dl);
          const dirName =
            dl.direction === 'global_x'
              ? 'по оси X'
              : dl.direction === 'global_y'
              ? 'по оси Y'
              : 'перпендикулярно';
          return (
            <MobileAccordionCard
              key={dl.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(dl.id)}
              deleteLabel={`Удалить нагрузку ${prettyLabel(dl.label)}`}
              accentClass="border-l-[#0284C7]"
              title={
                <>
                  <span className="text-[#0284C7]">
                    {shape === 'const'
                      ? `${prettyLabel(dl.label)} = ${formatNumber(dl.qStart_kNm)} кН/м`
                      : `${prettyLabel(dl.label)}: ${formatNumber(dl.qStart_kNm)} → ${formatNumber(dl.qEnd_kNm)} кН/м`}
                  </span>
                </>
              }
              subtitle={`Стержень «${el?.label ?? '?'}» • ${dirName}`}
              quickActions={
                <MobileChoiceGroup
                  columns={3}
                  options={Q_SHAPES}
                  value={shape}
                  onSelect={(s) => applyQShape(dl, s)}
                  activeClass="border-[#0284C7] bg-[#0284C7] text-white"
                />
              }
            >
              <MobileSelectField
                label="Стержень"
                value={dl.elementId}
                options={elementOptions}
                onChange={(v) => updateLoad(dl.id, { elementId: v })}
              />
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={dl.label}
                  onChange={(v) => updateLoad(dl.id, { label: v })}
                />
                <MobileSelectField
                  label="Направление"
                  value={dl.direction}
                  options={Q_DIR_OPTIONS}
                  onChange={(v) => updateLoad(dl.id, { direction: v })}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <MobileNumberField
                  label="q в начале"
                  unit="кН/м"
                  value={dl.qStart_kNm}
                  step={2}
                  valueClass="text-[#0284C7]"
                  onChange={(v) => updateLoad(dl.id, { qStart_kNm: v })}
                />
                <MobileNumberField
                  label="q в конце"
                  unit="кН/м"
                  value={dl.qEnd_kNm}
                  step={2}
                  valueClass="text-[#0284C7]"
                  onChange={(v) => updateLoad(dl.id, { qEnd_kNm: v })}
                />
              </div>
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton
          label="Добавить нагрузку q"
          onClick={() => handleAddMemberDistributed('const')}
          colorClass="border-[#0284C7]/50 text-[#0284C7] active:bg-sky-50"
        />
      </section>

      {/* 5. Изгибающие моменты M на стержнях */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Изгибающие моменты M на стержнях"
          count={memberMoments.length}
          colorClass="text-[#D97706]"
        />
        {memberMoments.length === 0 && <MobileEmptyHint text="Сосредоточенных моментов нет" />}
        {memberMoments.map((mm) => {
          const cardId = `fmm:${mm.id}`;
          const el = input.elements.find((e) => e.id === mm.elementId);
          const dir = mm.moment_kNm >= 0 ? 'ccw' : 'cw';
          return (
            <MobileAccordionCard
              key={mm.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(mm.id)}
              deleteLabel={`Удалить момент ${prettyLabel(mm.label)}`}
              accentClass="border-l-[#D97706]"
              title={
                <>
                  <span className="text-[#D97706]">
                    {prettyLabel(mm.label)} = {formatNumber(Math.abs(mm.moment_kNm))} кН·м
                  </span>{' '}
                  <span className="font-mono text-sm text-gray-600">
                    (t = {formatNumber(mm.tPosition)})
                  </span>
                </>
              }
              subtitle={`Стержень «${el?.label ?? '?'}» • ${
                dir === 'ccw' ? '↺ против ЧС (+)' : '↻ по ЧС (−)'
              }`}
              quickActions={
                <MobileChoiceGroup
                  options={[
                    { value: 'ccw' as const, label: '↺ против ЧС (+)' },
                    { value: 'cw' as const, label: '↻ по ЧС (−)' },
                  ]}
                  value={dir}
                  onSelect={(d) =>
                    updateLoad(mm.id, {
                      moment_kNm:
                        (d === 'ccw' ? 1 : -1) * Math.max(Math.abs(mm.moment_kNm), 1),
                    })
                  }
                  activeClass="border-[#D97706] bg-[#D97706] text-white"
                />
              }
            >
              <MobileSelectField
                label="Стержень"
                value={mm.elementId}
                options={elementOptions}
                onChange={(v) => updateLoad(mm.id, { elementId: v })}
              />
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={mm.label}
                  onChange={(v) => updateLoad(mm.id, { label: v })}
                />
                <MobileNumberField
                  label="Положение t (0..1)"
                  value={mm.tPosition}
                  step={0.05}
                  min={0.05}
                  max={0.95}
                  onChange={(v) => updateLoad(mm.id, { tPosition: v })}
                />
              </div>
              <MobileNumberField
                label="Момент M (+ против ЧС)"
                unit="кН·м"
                value={mm.moment_kNm}
                step={5}
                valueClass="text-[#D97706]"
                onChange={(v) => updateLoad(mm.id, { moment_kNm: v })}
              />
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton
          label="Добавить момент M"
          onClick={handleAddMemberMoment}
          colorClass="border-[#D97706]/50 text-[#D97706] active:bg-amber-50"
        />
      </section>
    </div>
  );
};
