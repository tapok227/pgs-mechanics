'use client';

import React, { useState } from 'react';
import {
  BeamProblemInput,
  SupportNode,
  SupportType,
  PointForceLoad,
  PointMomentLoad,
  DistributedLoad,
} from '@/types/mechanics';
import {
  MobileAccordionCard,
  MobileAddButton,
  MobileChoiceGroup,
  MobileEmptyHint,
  MobileNumberField,
  MobileSectionHeader,
  MobileTextField,
  formatMeters,
  formatNumber,
  prettyLabel,
} from '@/components/mobile/MobileUi';

/**
 * Мобильный (< 768px) редактор расчетной схемы балки: карточки-аккордеоны
 * вместо широких таблиц QuickTableForm. Все мутации данных делегируются
 * тем же обработчикам, что использует десктопная таблица.
 */
export interface MobileBeamEditorProps {
  input: BeamProblemInput;
  onChange: (updated: BeamProblemInput) => void;
  updateSupport: (idx: number, patch: Partial<SupportNode>) => void;
  addSupport: () => void;
  removeSupport: (id: string) => void;
  updateLoad: (id: string, patch: Record<string, unknown>) => void;
  removeLoad: (id: string) => void;
  addPointForce: () => void;
  addDistributedLoad: (profile?: 'const' | 'tri_right' | 'tri_left') => void;
  addPointMoment: () => void;
}

export const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  pinned: 'Шарнирно-неподвижная',
  roller: 'Шарнирно-подвижная',
  fixed: 'Жёсткая заделка',
  guided: 'Скользящая заделка',
  internal_hinge: 'Врезной шарнир (M = 0)',
};

const SUPPORT_TYPE_OPTIONS: Array<{ value: SupportType; label: React.ReactNode }> = [
  { value: 'pinned', label: <>△ Шарнирно-<br />неподвижная</> },
  { value: 'roller', label: <>⊼ Шарнирно-<br />подвижная</> },
  { value: 'fixed', label: <>▐ Жёсткая<br />заделка</> },
  { value: 'internal_hinge', label: <>○ Врезной<br />шарнир</> },
];

const FORCE_DIRECTIONS: Array<{ value: number; label: React.ReactNode; ariaLabel: string }> = [
  { value: -90, label: <span className="text-2xl leading-none">↓</span>, ariaLabel: 'Вниз (−90°)' },
  { value: 90, label: <span className="text-2xl leading-none">↑</span>, ariaLabel: 'Вверх (+90°)' },
  { value: -135, label: <span className="text-2xl leading-none">↙</span>, ariaLabel: 'Вниз-влево (−135°)' },
  { value: 45, label: <span className="text-2xl leading-none">↗</span>, ariaLabel: 'Вверх-вправо (+45°)' },
];

type QShape = 'const' | 'tri_right' | 'tri_left';

const Q_SHAPES: Array<{ value: QShape; label: React.ReactNode }> = [
  { value: 'const', label: <>▭ Равно&shy;мерная</> },
  { value: 'tri_right', label: <>◢ 0 → q</> },
  { value: 'tri_left', label: <>◣ q → 0</> },
];

/** Нормализация угла в диапазон (−180°; 180°] */
function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return a;
}

function describeForceDirection(angleDeg: number): string {
  const a = normalizeAngle(angleDeg);
  if (a === -90) return '↓ вертикально вниз';
  if (a === 90) return '↑ вертикально вверх';
  if (a === 0) return '→ вдоль оси вправо';
  if (a === 180) return '← вдоль оси влево';
  return `под углом α = ${formatNumber(angleDeg)}° к оси x`;
}

function detectQShape(dl: DistributedLoad): QShape | null {
  if (Math.abs(dl.qStart - dl.qEnd) < 1e-9) return 'const';
  if (Math.abs(dl.qStart) < 1e-9 && Math.abs(dl.qEnd) > 1e-9) return 'tri_right';
  if (Math.abs(dl.qEnd) < 1e-9 && Math.abs(dl.qStart) > 1e-9) return 'tri_left';
  return null;
}

function describeQShape(dl: DistributedLoad): string {
  switch (detectQShape(dl)) {
    case 'const':
      return 'Равномерная';
    case 'tri_right':
      return 'Треугольная, возрастающая 0 → q';
    case 'tri_left':
      return 'Треугольная, убывающая q → 0';
    default:
      return 'Трапециевидная';
  }
}

export const MobileBeamEditor: React.FC<MobileBeamEditorProps> = ({
  input,
  onChange,
  updateSupport,
  addSupport,
  removeSupport,
  updateLoad,
  removeLoad,
  addPointForce,
  addDistributedLoad,
  addPointMoment,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const pointForces = input.loads.filter((l): l is PointForceLoad => l.kind === 'point_force');
  const distributedLoads = input.loads.filter(
    (l): l is DistributedLoad => l.kind === 'distributed'
  );
  const pointMoments = input.loads.filter((l): l is PointMomentLoad => l.kind === 'point_moment');

  const applyQShape = (dl: DistributedLoad, shape: QShape) => {
    const qMax = Math.max(Math.abs(dl.qStart), Math.abs(dl.qEnd)) || 10;
    const sign = dl.qStart < 0 || dl.qEnd < 0 ? -1 : 1;
    const q = sign * qMax;
    if (shape === 'const') updateLoad(dl.id, { qStart: q, qEnd: q });
    if (shape === 'tri_right') updateLoad(dl.id, { qStart: 0, qEnd: q });
    if (shape === 'tri_left') updateLoad(dl.id, { qStart: q, qEnd: 0 });
  };

  return (
    <div className="space-y-5">
      {/* 1. Общие параметры */}
      <section className="space-y-2">
        <MobileSectionHeader title="Геометрия и материал" />
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-300 bg-white p-3 shadow-xs min-[400px]:grid-cols-2">
          <MobileNumberField
            label="Длина балки L"
            unit="м"
            value={input.length}
            step={0.5}
            min={0.5}
            onChange={(v) => onChange({ ...input, length: Math.max(0.5, v) })}
          />
          <MobileNumberField
            label="Допускаемое [σ]"
            unit="МПа"
            value={input.allowableStress_MPa}
            step={10}
            min={10}
            onChange={(v) => onChange({ ...input, allowableStress_MPa: Math.max(10, v) })}
          />
        </div>
      </section>

      {/* 2. Опоры и врезные шарниры */}
      <section className="space-y-2">
        <MobileSectionHeader title="Опоры и шарниры" count={input.supports.length} />
        {input.supports.length === 0 && <MobileEmptyHint text="Опоры не заданы" />}
        {input.supports.map((sup, idx) => {
          const cardId = `sup:${sup.id}`;
          const noun = sup.type === 'internal_hinge' ? 'Шарнир' : 'Опора';
          return (
            <MobileAccordionCard
              key={sup.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeSupport(sup.id)}
              deleteLabel={`Удалить ${noun.toLowerCase()} ${sup.label}`}
              accentClass="border-l-[#1F2937]"
              title={
                <>
                  {noun} {sup.label} <span className="text-gray-400">•</span>{' '}
                  <span className="font-mono">x = {formatMeters(sup.x)} м</span>
                </>
              }
              subtitle={SUPPORT_TYPE_LABELS[sup.type]}
            >
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={sup.label}
                  onChange={(v) => updateSupport(idx, { label: v })}
                />
                <MobileNumberField
                  label="Координата x"
                  unit="м"
                  value={sup.x}
                  step={0.1}
                  min={0}
                  max={input.length}
                  onChange={(v) => updateSupport(idx, { x: v })}
                />
              </div>
              <MobileChoiceGroup
                label="Тип связи"
                options={SUPPORT_TYPE_OPTIONS}
                value={sup.type}
                onSelect={(t) => updateSupport(idx, { type: t })}
              />
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton label="Добавить опору" onClick={addSupport} />
      </section>

      {/* 3. Сосредоточенные силы F */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Сосредоточенные силы F"
          count={pointForces.length}
          colorClass="text-[#DC2626]"
        />
        {pointForces.length === 0 && <MobileEmptyHint text="Сосредоточенных сил нет" />}
        {pointForces.map((pf) => {
          const cardId = `pf:${pf.id}`;
          const angleNorm = normalizeAngle(pf.angleDeg);
          const activeDir = FORCE_DIRECTIONS.some((d) => d.value === angleNorm) ? angleNorm : null;
          return (
            <MobileAccordionCard
              key={pf.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(pf.id)}
              deleteLabel={`Удалить силу ${prettyLabel(pf.label)}`}
              accentClass="border-l-[#DC2626]"
              title={
                <>
                  <span className="text-[#DC2626]">
                    {prettyLabel(pf.label)} = {formatNumber(pf.magnitude)} кН
                  </span>{' '}
                  <span className="font-mono text-sm text-gray-600">(x = {formatMeters(pf.x)} м)</span>
                </>
              }
              subtitle={describeForceDirection(pf.angleDeg)}
              quickActions={
                <MobileChoiceGroup
                  columns={4}
                  options={FORCE_DIRECTIONS}
                  value={activeDir}
                  onSelect={(a) => updateLoad(pf.id, { angleDeg: a })}
                  activeClass="border-[#DC2626] bg-[#DC2626] text-white"
                />
              }
            >
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={pf.label}
                  onChange={(v) => updateLoad(pf.id, { label: v })}
                />
                <MobileNumberField
                  label="Координата x"
                  unit="м"
                  value={pf.x}
                  step={0.1}
                  min={0}
                  max={input.length}
                  onChange={(v) => updateLoad(pf.id, { x: v })}
                />
              </div>
              <MobileNumberField
                label="Модуль силы F"
                unit="кН"
                value={pf.magnitude}
                step={5}
                min={0}
                valueClass="text-[#DC2626]"
                onChange={(v) => updateLoad(pf.id, { magnitude: v })}
              />
              <MobileNumberField
                label="Угол к оси x"
                unit="°"
                value={pf.angleDeg}
                step={15}
                onChange={(v) => updateLoad(pf.id, { angleDeg: v })}
              />
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton
          label="Добавить силу"
          onClick={addPointForce}
          colorClass="border-[#DC2626]/50 text-[#DC2626] active:bg-red-50"
        />
      </section>

      {/* 4. Распределенные нагрузки q */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Распределённые нагрузки q"
          count={distributedLoads.length}
          colorClass="text-[#2563EB]"
        />
        {distributedLoads.length === 0 && <MobileEmptyHint text="Распределённых нагрузок нет" />}
        {distributedLoads.map((dl) => {
          const cardId = `dl:${dl.id}`;
          const shape = detectQShape(dl);
          const span = `[${formatNumber(dl.xStart)} → ${formatNumber(dl.xEnd)} м]`;
          return (
            <MobileAccordionCard
              key={dl.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(dl.id)}
              deleteLabel={`Удалить нагрузку ${prettyLabel(dl.label)}`}
              accentClass="border-l-[#2563EB]"
              title={
                <>
                  <span className="text-[#2563EB]">
                    {shape === 'const'
                      ? `${prettyLabel(dl.label)} = ${formatNumber(dl.qStart)} кН/м`
                      : `${prettyLabel(dl.label)}: ${formatNumber(dl.qStart)} → ${formatNumber(dl.qEnd)} кН/м`}
                  </span>{' '}
                  <span className="font-mono text-sm text-gray-600">{span}</span>
                </>
              }
              subtitle={describeQShape(dl)}
              quickActions={
                <MobileChoiceGroup
                  columns={3}
                  options={Q_SHAPES}
                  value={shape}
                  onSelect={(s) => applyQShape(dl, s)}
                  activeClass="border-[#2563EB] bg-[#2563EB] text-white"
                />
              }
            >
              <MobileTextField
                label="Имя"
                value={dl.label}
                onChange={(v) => updateLoad(dl.id, { label: v })}
              />
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <MobileNumberField
                  label="Начало x₁"
                  unit="м"
                  value={dl.xStart}
                  step={0.1}
                  min={0}
                  max={input.length}
                  onChange={(v) => updateLoad(dl.id, { xStart: v })}
                />
                <MobileNumberField
                  label="Конец x₂"
                  unit="м"
                  value={dl.xEnd}
                  step={0.1}
                  min={0}
                  max={input.length}
                  onChange={(v) => updateLoad(dl.id, { xEnd: v })}
                />
                <MobileNumberField
                  label="q в начале"
                  unit="кН/м"
                  value={dl.qStart}
                  step={1}
                  valueClass="text-[#2563EB]"
                  onChange={(v) => updateLoad(dl.id, { qStart: v })}
                />
                <MobileNumberField
                  label="q в конце"
                  unit="кН/м"
                  value={dl.qEnd}
                  step={1}
                  valueClass="text-[#2563EB]"
                  onChange={(v) => updateLoad(dl.id, { qEnd: v })}
                />
              </div>
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton
          label="Добавить q"
          onClick={() => addDistributedLoad('const')}
          colorClass="border-[#2563EB]/50 text-[#2563EB] active:bg-blue-50"
        />
      </section>

      {/* 5. Сосредоточенные моменты M */}
      <section className="space-y-2">
        <MobileSectionHeader
          title="Сосредоточенные моменты M"
          count={pointMoments.length}
          colorClass="text-[#D97706]"
        />
        {pointMoments.length === 0 && <MobileEmptyHint text="Сосредоточенных моментов нет" />}
        {pointMoments.map((pm) => {
          const cardId = `pm:${pm.id}`;
          return (
            <MobileAccordionCard
              key={pm.id}
              expanded={expandedId === cardId}
              onToggle={() => toggle(cardId)}
              onDelete={() => removeLoad(pm.id)}
              deleteLabel={`Удалить момент ${prettyLabel(pm.label)}`}
              accentClass="border-l-[#D97706]"
              title={
                <>
                  <span className="text-[#D97706]">
                    {prettyLabel(pm.label)} = {formatNumber(pm.magnitude)} кН·м
                  </span>{' '}
                  <span className="font-mono text-sm text-gray-600">(x = {formatMeters(pm.x)} м)</span>
                </>
              }
              subtitle={pm.direction === 'ccw' ? '↺ против часовой стрелки' : '↻ по часовой стрелке'}
              quickActions={
                <MobileChoiceGroup
                  options={[
                    { value: 'ccw' as const, label: '↺ против ЧС' },
                    { value: 'cw' as const, label: '↻ по ЧС' },
                  ]}
                  value={pm.direction}
                  onSelect={(d) => updateLoad(pm.id, { direction: d })}
                  activeClass="border-[#D97706] bg-[#D97706] text-white"
                />
              }
            >
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <MobileTextField
                  label="Имя"
                  value={pm.label}
                  onChange={(v) => updateLoad(pm.id, { label: v })}
                />
                <MobileNumberField
                  label="Координата x"
                  unit="м"
                  value={pm.x}
                  step={0.1}
                  min={0}
                  max={input.length}
                  onChange={(v) => updateLoad(pm.id, { x: v })}
                />
              </div>
              <MobileNumberField
                label="Модуль момента M"
                unit="кН·м"
                value={pm.magnitude}
                step={5}
                min={0}
                valueClass="text-[#D97706]"
                onChange={(v) => updateLoad(pm.id, { magnitude: v })}
              />
            </MobileAccordionCard>
          );
        })}
        <MobileAddButton
          label="Добавить момент"
          onClick={addPointMoment}
          colorClass="border-[#D97706]/50 text-[#D97706] active:bg-amber-50"
        />
      </section>
    </div>
  );
};
