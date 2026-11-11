'use client';

import React, { useState } from 'react';
import {
  FrameProblemInput,
  FrameNode,
  FrameElement,
  FrameSupportType,
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
} from '@/components/mobile/MobileUi';

export interface MobileFrameEditorProps {
  input: FrameProblemInput;
  onChange: (updated: FrameProblemInput) => void;
  addNode: () => void;
  addElement: () => void;
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
  { value: 'fixed', label: <>▐ Жёсткая<br />заделка</> },
];

export const MobileFrameEditor: React.FC<MobileFrameEditorProps> = ({
  input,
  onChange,
  addNode,
  addElement,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const updateNode = (idx: number, patch: Partial<FrameNode>) => {
    const next = [...input.nodes];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...input, nodes: next });
  };

  const removeNode = (id: string) => {
    onChange({
      ...input,
      nodes: input.nodes.filter((item) => item.id !== id),
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
    });
  };

  const nodeOptions = input.nodes.map((n) => ({
    value: n.id,
    label: `${n.label} (${formatMeters(n.x)}; ${formatMeters(n.y)} м)`,
  }));

  return (
    <div className="space-y-5">
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
          const len =
            n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : 0;
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
              title={
                <span className="text-[#1E3A8A]">
                  {el.label}
                </span>
              }
              subtitle={
                <>
                  Узлы: <span className="font-mono font-semibold text-[#1F2937]">{n1?.label ?? '?'} → {n2?.label ?? '?'}</span>
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
                    onClick={() =>
                      updateElement(idx, { releaseStart: !el.releaseStart })
                    }
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
                    onClick={() =>
                      updateElement(idx, { releaseEnd: !el.releaseEnd })
                    }
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
    </div>
  );
};
