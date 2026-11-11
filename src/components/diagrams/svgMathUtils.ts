import { PolynomialCoeffs } from '../../types/mechanics';
import { evalPoly } from '../../core/solver/beamSolver';

export const PGS_PALETTE = {
  paperBg: '#F8F9FA',
  gridMinor: '#E5E7EB',
  gridMajor: '#D1D5DB',
  graphite: '#1F2937',     // Балки, стержни, контуры
  reactionBlue: '#2563EB', // Опорные реакции
  loadRuby: '#DC2626',     // Внешние нагрузки
  chalkGreen: '#065F46',   // Акценты, экстремумы, визир
  guideline: '#9CA3AF',
  fillPositive: 'rgba(37, 99, 235, 0.06)',
  fillNegative: 'rgba(220, 38, 38, 0.06)',
  fillMoment: 'rgba(6, 95, 70, 0.07)',
} as const;

/**
 * Генерирует точный SVG-путь замкнутого контура эпюры (для заливки) и линию огибающей
 * для произвольного полинома 0..3 степени на участке [0, segLength].
 *
 * @param poly Коэффициенты полинома P(u), u in [0, segLength]
 * @param segLength Длина участка в метрах
 * @param xStartPx Экранный X начала участка
 * @param xEndPx Экранный X конца участка
 * @param baseYPx Экранный Y нулевой линии эпюры
 * @param scaleY Масштаб ординаты (пикселей на единицу усилия)
 * @param invertY true для N и Q (+ откладывается вверх: y = baseY - val * scaleY),
 *                false для M по правилу ПГС (+ растягивает нижние волокна, откладывается вниз: y = baseY + val * scaleY)
 */
export function buildPolynomialDiagramPath(
  poly: PolynomialCoeffs,
  segLength: number,
  xStartPx: number,
  xEndPx: number,
  baseYPx: number,
  scaleY: number,
  invertY: boolean
): { areaPath: string; curvePath: string } {
  const signDir = invertY ? -1 : 1;
  const widthPx = xEndPx - xStartPx;

  const toScreenY = (val: number) => baseYPx + signDir * val * scaleY;

  // Если участок линейный (c2 = 0, c3 = 0) — используем точный отрезок
  if (Math.abs(poly.c2) < 1e-7 && Math.abs(poly.c3) < 1e-7) {
    const y0 = toScreenY(evalPoly(poly, 0));
    const y1 = toScreenY(evalPoly(poly, segLength));
    const curvePath = `M ${xStartPx.toFixed(2)} ${y0.toFixed(2)} L ${xEndPx.toFixed(2)} ${y1.toFixed(2)}`;
    const areaPath = `M ${xStartPx.toFixed(2)} ${baseYPx.toFixed(2)} L ${xStartPx.toFixed(2)} ${y0.toFixed(2)} L ${xEndPx.toFixed(2)} ${y1.toFixed(2)} L ${xEndPx.toFixed(2)} ${baseYPx.toFixed(2)} Z`;
    return { areaPath, curvePath };
  }

  // Если квадратичная парабола (c3 = 0) — используем аналитическую квадратичную кривую Безье (Q),
  // контрольная точка которой лежит на пересечении касательных в начале и конце участка:
  // x_ctrl = (xStart + xEnd) / 2, P_ctrl = P(0) + 0.5 * segLength * P'(0) = c0 + 0.5 * c1 * L
  if (Math.abs(poly.c3) < 1e-7) {
    const valStart = evalPoly(poly, 0);
    const valEnd = evalPoly(poly, segLength);
    const valCtrl = poly.c0 + 0.5 * poly.c1 * segLength;

    const y0 = toScreenY(valStart);
    const y1 = toScreenY(valEnd);
    const yCtrl = toScreenY(valCtrl);
    const xCtrl = xStartPx + 0.5 * widthPx;

    const curvePath = `M ${xStartPx.toFixed(2)} ${y0.toFixed(2)} Q ${xCtrl.toFixed(2)} ${yCtrl.toFixed(2)} ${xEndPx.toFixed(2)} ${y1.toFixed(2)}`;
    const areaPath = `M ${xStartPx.toFixed(2)} ${baseYPx.toFixed(2)} L ${xStartPx.toFixed(2)} ${y0.toFixed(2)} Q ${xCtrl.toFixed(2)} ${yCtrl.toFixed(2)} ${xEndPx.toFixed(2)} ${y1.toFixed(2)} L ${xEndPx.toFixed(2)} ${baseYPx.toFixed(2)} Z`;
    return { areaPath, curvePath };
  }

  // Для кубической параболы (треугольная/трапециевидная нагрузка q) — точная кубическая кривая Безье (C)
  const L = segLength;
  const val0 = evalPoly(poly, 0);
  const val3 = evalPoly(poly, L);
  // Производная P'(u) = c1 + 2*c2*u + 3*c3*u^2
  const d0 = poly.c1;
  const dL = poly.c1 + 2 * poly.c2 * L + 3 * poly.c3 * L * L;

  const valCtrl1 = val0 + (L / 3) * d0;
  const valCtrl2 = val3 - (L / 3) * dL;

  const x1 = xStartPx + widthPx / 3;
  const x2 = xStartPx + (2 * widthPx) / 3;

  const y0 = toScreenY(val0);
  const yCtrl1 = toScreenY(valCtrl1);
  const yCtrl2 = toScreenY(valCtrl2);
  const y3 = toScreenY(val3);

  const curvePath = `M ${xStartPx.toFixed(2)} ${y0.toFixed(2)} C ${x1.toFixed(2)} ${yCtrl1.toFixed(2)}, ${x2.toFixed(2)} ${yCtrl2.toFixed(2)}, ${xEndPx.toFixed(2)} ${y3.toFixed(2)}`;
  const areaPath = `M ${xStartPx.toFixed(2)} ${baseYPx.toFixed(2)} L ${xStartPx.toFixed(2)} ${y0.toFixed(2)} C ${x1.toFixed(2)} ${yCtrl1.toFixed(2)}, ${x2.toFixed(2)} ${yCtrl2.toFixed(2)}, ${xEndPx.toFixed(2)} ${y3.toFixed(2)} L ${xEndPx.toFixed(2)} ${baseYPx.toFixed(2)} Z`;
  return { areaPath, curvePath };
}

/**
 * Генерирует массив вертикальных линий перпендикулярной штриховки эпюры
 */
export function generateHatchLines(
  poly: PolynomialCoeffs,
  segLength: number,
  xStartPx: number,
  xEndPx: number,
  baseYPx: number,
  scaleY: number,
  invertY: boolean,
  stepPx = 14
): Array<{ x: number; y1: number; y2: number; value: number }> {
  const widthPx = xEndPx - xStartPx;
  const count = Math.max(2, Math.floor(widthPx / stepPx));
  const signDir = invertY ? -1 : 1;
  const lines: Array<{ x: number; y1: number; y2: number; value: number }> = [];

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const u = t * segLength;
    const val = evalPoly(poly, u);
    if (Math.abs(val) < 1e-4) continue;
    const x = xStartPx + t * widthPx;
    const y2 = baseYPx + signDir * val * scaleY;
    lines.push({ x, y1: baseYPx, y2, value: val });
  }
  return lines;
}

/**
 * Вычисляет оптимальные позиции для постановки знаков (+) и (-) в кружках
 * на эпюрах N и Q (с учетом возможной смены знака внутри участка)
 */
export function computeSignBadgePositions(
  poly: PolynomialCoeffs,
  segLength: number,
  xStartPx: number,
  xEndPx: number,
  baseYPx: number,
  scaleY: number
): Array<{ x: number; y: number; sign: '+' | '-' }> {
  const badges: Array<{ x: number; y: number; sign: '+' | '-' }> = [];
  const valStart = evalPoly(poly, 0);
  const valEnd = evalPoly(poly, segLength);
  const widthPx = xEndPx - xStartPx;

  // Если знак не меняется на участке — ставим один знак в центре тяжести трапеции/прямоугольника
  if (valStart * valEnd >= -1e-5) {
    const uMid = segLength * 0.5;
    const valMid = evalPoly(poly, uMid);
    if (Math.abs(valMid) < 1e-3) return badges;
    const yCurve = baseYPx - valMid * scaleY;
    const yBadge = baseYPx + (yCurve - baseYPx) * 0.5;
    badges.push({
      x: xStartPx + widthPx * 0.5,
      y: yBadge,
      sign: valMid > 0 ? '+' : '-',
    });
    return badges;
  }

  // Если знак меняется (пересечение нуля при u0) — ставим два знака по обе стороны от нуля
  const uZero =
    Math.abs(poly.c1) > 1e-6
      ? Math.max(0.1 * segLength, Math.min(0.9 * segLength, -poly.c0 / poly.c1))
      : 0.5 * segLength;

  const uLeft = uZero * 0.45;
  const uRight = uZero + (segLength - uZero) * 0.55;

  const vL = evalPoly(poly, uLeft);
  if (Math.abs(vL) > 1e-2 && (uZero / segLength) * widthPx > 32) {
    badges.push({
      x: xStartPx + (uLeft / segLength) * widthPx,
      y: baseYPx - vL * scaleY * 0.45,
      sign: vL > 0 ? '+' : '-',
    });
  }

  const vR = evalPoly(poly, uRight);
  if (Math.abs(vR) > 1e-2 && ((segLength - uZero) / segLength) * widthPx > 32) {
    badges.push({
      x: xStartPx + (uRight / segLength) * widthPx,
      y: baseYPx - vR * scaleY * 0.45,
      sign: vR > 0 ? '+' : '-',
    });
  }

  return badges;
}