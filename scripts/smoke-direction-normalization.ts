import { normalizeDirection } from '../src/lib/doorGuidance/normalize';

const cases: Array<[string, string | undefined]> = [
  ['시청', 'TOWARD_시청'],
  ['시청 방면', 'TOWARD_시청'],
  ['시청행', 'TOWARD_시청'],
  ['시청 방향', 'TOWARD_시청'],
  ['시청역 방면', 'TOWARD_시청'],
  ['강남쪽', 'TOWARD_강남'],
  ['내선', 'INNER'],
  ['외선', 'OUTER'],
];

for (const [input, expected] of cases) {
  const actual = normalizeDirection(input);
  if (actual !== expected) {
    throw new Error(`normalizeDirection(${input}) expected ${expected}, got ${actual}`);
  }
}

console.log(JSON.stringify({ ok: true, cases: cases.length }, null, 2));
