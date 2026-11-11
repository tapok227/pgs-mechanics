'use client';

import React from 'react';
import { ChevronDown, Minus, Plus, Trash2 } from 'lucide-react';

/**
 * Сенсорные UI-примитивы для мобильного режима (< 768px).
 * Все интерактивные зоны не меньше 44×44 px, шрифт полей ввода 16px
 * (iOS Safari не масштабирует страницу при фокусе).
 */

// ----------------------------------------------------------------------------
// Форматирование
// ----------------------------------------------------------------------------

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};

/** «F_1» → «F₁», «q_{2}» → «q₂» */
export function prettyLabel(label: string): string {
  return label.replace(/_\{?(\d+)\}?/g, (_, digits: string) =>
    digits
      .split('')
      .map((d) => SUBSCRIPT_DIGITS[d] ?? d)
      .join('')
  );
}

/** Координата для заголовков карточек: 0 → «0.0», 2.25 → «2.25» */
export function formatMeters(v: number): string {
  const clean = Number(v.toFixed(3));
  return Number.isInteger(clean * 10) ? clean.toFixed(1) : String(clean);
}

export function formatNumber(v: number): string {
  return String(Number(v.toFixed(3)));
}

// ----------------------------------------------------------------------------
// Карточка-аккордеон
// ----------------------------------------------------------------------------

interface MobileAccordionCardProps {
  expanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  /** Tailwind-класс цвета левой полосы, например `border-l-[#DC2626]` */
  accentClass: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Быстрые действия, видимые и в свернутом состоянии (направление силы, форма q) */
  quickActions?: React.ReactNode;
  children?: React.ReactNode;
}

export const MobileAccordionCard: React.FC<MobileAccordionCardProps> = ({
  expanded,
  onToggle,
  onDelete,
  deleteLabel = 'Удалить',
  accentClass,
  title,
  subtitle,
  quickActions,
  children,
}) => (
  <div
    className={`overflow-hidden rounded-xl border border-l-4 border-gray-300 bg-white shadow-xs ${accentClass}`}
  >
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left active:bg-gray-50"
      >
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-snug text-[#1F2937]">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-xs leading-snug text-gray-600">{subtitle}</div>
          )}
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="flex w-12 shrink-0 items-center justify-center border-l border-gray-200 text-red-600 active:bg-red-50"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      )}
    </div>
    {quickActions && <div className="px-3 pb-3">{quickActions}</div>}
    {expanded && children && (
      <div className="space-y-3 border-t border-gray-200 bg-[#F8F9FA] px-3 py-3">{children}</div>
    )}
  </div>
);

// ----------------------------------------------------------------------------
// Поля ввода
// ----------------------------------------------------------------------------

interface MobileNumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Дополнительные классы для акцентного цвета значения */
  valueClass?: string;
}

export const MobileNumberField: React.FC<MobileNumberFieldProps> = ({
  label,
  value,
  onChange,
  step = 0.1,
  min,
  max,
  unit,
  valueClass = 'text-[#1F2937]',
}) => {
  const clamp = (v: number) => {
    let next = v;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return Number(next.toFixed(3));
  };

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">
        {label}
        {unit && <span className="font-normal text-gray-500"> ({unit})</span>}
      </span>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          aria-label={`${label}: уменьшить на ${step}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 active:bg-gray-100"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-center font-mono text-base font-bold ${valueClass}`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          aria-label={`${label}: увеличить на ${step}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 active:bg-gray-100"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </label>
  );
};

export const MobileTextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base font-bold text-[#1F2937]"
    />
  </label>
);

export const MobileSelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base font-semibold text-[#1F2937]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

// ----------------------------------------------------------------------------
// Группа крупных кнопок выбора
// ----------------------------------------------------------------------------

export interface MobileChoiceOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
}

export function MobileChoiceGroup<T extends string | number>({
  options,
  value,
  onSelect,
  columns = 2,
  activeClass = 'border-[#1F2937] bg-[#1F2937] text-white',
  label,
}: {
  options: Array<MobileChoiceOption<T>>;
  value: T | null;
  onSelect: (v: T) => void;
  columns?: 2 | 3 | 4;
  activeClass?: string;
  label?: string;
}) {
  const colsClass =
    columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div>
      {label && <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>}
      <div role="group" aria-label={label} className={`grid gap-1.5 ${colsClass}`}>
        {options.map((o) => {
          const isActive = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onSelect(o.value)}
              aria-pressed={isActive}
              aria-label={o.ariaLabel}
              className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-bold leading-tight transition active:scale-[0.97] ${
                isActive
                  ? activeClass
                  : 'border-gray-300 bg-white text-[#1F2937] active:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Заголовок секции и кнопка добавления во всю ширину
// ----------------------------------------------------------------------------

export const MobileSectionHeader: React.FC<{
  title: string;
  count?: number;
  colorClass?: string;
}> = ({ title, count, colorClass = 'text-[#1F2937]' }) => (
  <div className="flex items-center justify-between px-1">
    <h4 className={`text-xs font-extrabold uppercase tracking-wider ${colorClass}`}>{title}</h4>
    {count !== undefined && (
      <span className="rounded-full bg-gray-200 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-700">
        {count}
      </span>
    )}
  </div>
);

export const MobileAddButton: React.FC<{
  label: string;
  onClick: () => void;
  colorClass?: string;
}> = ({ label, onClick, colorClass = 'border-[#1F2937]/40 text-[#1F2937] active:bg-gray-100' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-13 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white text-[15px] font-extrabold transition active:scale-[0.99] ${colorClass}`}
  >
    <Plus className="h-5 w-5" />
    <span>{label.startsWith('+') ? label : `+ ${label}`}</span>
  </button>
);

export const MobileEmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-3 py-3 text-center text-xs text-gray-500">
    {text}
  </div>
);
