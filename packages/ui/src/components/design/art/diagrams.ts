// Diagrams for technical posts: empty boxes joined by arrows, drawn in the brand's accent over
// its background. Text layers go on top of the boxes.

import type { ICArtDef, ICArtSlot } from './art.js';

const SLOTS: ICArtSlot[] = [
  { key: 'main', label: 'Lines', role: 'accent', color: '#35e0c1' },
  { key: 'face', label: 'Fill', role: 'bg', color: '#0f1010' },
];

const BOX_W = 96;
const BOX_H = 64;
const GAP = 36;
const PAD = 4;

const box = (x: number) =>
  `<rect x="${x}" y="${PAD}" width="${BOX_W}" height="${BOX_H}" rx="10" fill="{{face}}" stroke="{{main}}" stroke-width="3"/>`;

/** An arrow across the gap that starts at `x`, with room left at both ends. */
function arrow(x: number): string {
  const y = PAD + BOX_H / 2;
  const tip = x + GAP - 7;
  return `<path d="M${x + 7} ${y}H${tip}M${tip - 8} ${y - 7}l8 7-8 7" fill="none" stroke="{{main}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** `count` boxes in a row, each pointing at the next. */
function flow(count: number): ICArtDef {
  const step = BOX_W + GAP;
  const w = PAD * 2 + count * BOX_W + (count - 1) * GAP;
  const h = PAD * 2 + BOX_H;
  let body = '';
  for (let i = 0; i < count; i++) {
    body += box(PAD + i * step);
    if (i < count - 1) body += arrow(PAD + i * step + BOX_W);
  }
  return {
    id: 'diagram-flow',
    name: 'Diagram block',
    kind: 'shape',
    group: 'Diagrams',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body,
    slots: SLOTS,
  };
}

export const DIAGRAMS: ICArtDef[] = [flow(3)];
