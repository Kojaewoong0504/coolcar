export function lineColorClass(line?: string | null) {
  if (!line) return 'line-default';
  if (line.includes('1호선')) return 'line-1';
  if (line.includes('2호선')) return 'line-2';
  if (line.includes('3호선')) return 'line-3';
  if (line.includes('4호선')) return 'line-4';
  if (line.includes('5호선')) return 'line-5';
  if (line.includes('6호선')) return 'line-6';
  if (line.includes('7호선')) return 'line-7';
  if (line.includes('8호선')) return 'line-8';
  if (line.includes('9호선')) return 'line-9';
  if (line.includes('공항')) return 'line-airport';
  if (line.includes('신분당')) return 'line-shinbundang';
  if (line.includes('수인') || line.includes('분당')) return 'line-suinbundang';
  return 'line-default';
}

export function lineShortLabel(line?: string | null) {
  if (!line) return '노선';
  return line.replace('수도권 ', '').replace('전철 ', '');
}

export function routeLineLabels(lines: Array<string | undefined | null>) {
  return lines.filter((line): line is string => Boolean(line));
}
