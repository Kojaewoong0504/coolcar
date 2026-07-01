import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { lineColorClass, lineColorValue, lineShortLabel } from '../src/lib/metro-lines';

const gyeonguiInputs = ['경의중앙선', '수도권 전철 경의중앙선', '경의·중앙선'];

for (const line of gyeonguiInputs) {
  assert.equal(lineColorClass(line), 'line-gyeongui-jungang', `${line}은 경의중앙선 전용 class여야 합니다.`);
  assert.equal(lineColorValue(line), 'var(--gyeongui-jungang)', `${line}은 경의중앙선 색상 토큰을 써야 합니다.`);
  assert.notEqual(lineColorClass(line), 'line-default', `${line}이 default 색상으로 떨어지면 안 됩니다.`);
}

assert.equal(lineShortLabel('수도권 전철 경의중앙선'), '경의중앙선');
assert.equal(lineColorClass('2호선'), 'line-2');
assert.equal(lineColorClass('3호선'), 'line-3');

const css = readFileSync('src/app/globals.css', 'utf8');
for (const required of [
  '--gyeongui-jungang',
  '.line-badge.line-gyeongui-jungang',
  '.route-dot.line-gyeongui-jungang',
  '.metro-line-pill.line-gyeongui-jungang',
  '.metro-route-strip .line-gyeongui-jungang',
]) {
  assert(css.includes(required), `CSS에 ${required} 정의가 필요합니다.`);
}

console.log(JSON.stringify({
  ok: true,
  gyeonguiClass: lineColorClass('경의중앙선'),
  gyeonguiValue: lineColorValue('경의중앙선'),
}, null, 2));
