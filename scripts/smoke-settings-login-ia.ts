import { existsSync, readFileSync } from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const settings = readFileSync('src/app/settings/page.tsx', 'utf8');
const login = readFileSync('src/app/login/page.tsx', 'utf8');
const privacy = readFileSync('src/app/privacy/page.tsx', 'utf8');
const saved = readFileSync('src/app/saved/page.tsx', 'utf8');
const tabbar = readFileSync('src/components/TabBar.tsx', 'utf8');

assert(existsSync('src/app/privacy/page.tsx'), '개인정보 안내 페이지가 있어야 합니다.');
assert(!settings.includes('SocialLoginButtons'), '내 정보 화면은 소셜 로그인 버튼을 직접 렌더링하면 안 됩니다.');
assert(settings.includes('/login?next=/settings'), '내 정보 화면은 로그인 전용 페이지로 이동하는 CTA를 제공해야 합니다.');
assert(settings.includes('추천은 로그인 없이도'), '내 정보 화면은 로그인 없이도 추천 사용 가능하다는 안내를 보여야 합니다.');
assert(login.includes('SocialLoginButtons'), '로그인 화면에는 소셜 로그인 버튼이 있어야 합니다.');
assert(login.includes('선택 로그인'), '로그인 화면은 선택 로그인임을 한국어로 안내해야 합니다.');
assert(!login.includes('OPTIONAL LOGIN'), '로그인 화면에 영어 기획 문구 OPTIONAL LOGIN이 남아 있으면 안 됩니다.');
assert(tabbar.includes("label: '내 경로'"), '하단탭 저장 라벨은 내 경로여야 합니다.');
assert(tabbar.includes("label: '이용 팁'"), '하단탭 팁 라벨은 이용 팁이어야 합니다.');
assert(!tabbar.includes("label: '저장'"), '하단탭에 저장 단독 라벨이 남아 있으면 안 됩니다.');
assert(!tabbar.includes("label: '팁'"), '하단탭에 팁 단독 라벨이 남아 있으면 안 됩니다.');
assert(privacy.includes('현재 위치는 수집하지 않아요'), '개인정보 안내는 현재 위치 수집 여부를 명확히 안내해야 합니다.');
assert(privacy.includes('이름, 이메일, 프로필 이미지'), '개인정보 안내는 소셜 로그인 시 사용하는 정보를 명확히 안내해야 합니다.');
assert(saved.includes('/login?next=/saved'), '내 경로 화면은 로그인 전용 페이지로 이동하는 CTA를 제공해야 합니다.');
assert(saved.includes('추천은 로그인 없이도'), '내 경로 화면은 로그인 없이도 추천 사용 가능하다는 안내를 보여야 합니다.');
assert(saved.includes('다른 기기'), '내 경로 화면은 로그인 가치를 다른 기기 이어보기로 설명해야 합니다.');

const consumerFiles = [
  ['settings', settings],
  ['login', login],
  ['privacy', privacy],
  ['tabbar', tabbar],
] as const;

const forbiddenVisibleCopy = [
  'OPTIONAL LOGIN',
  '익명 기록',
  'API 캐싱',
  'quota',
  'fallback',
  'OAuth',
  'callback',
  'token',
  'Supabase',
  'localStorage',
  '로그인해야 이용할 수 있어요',
  '로그인 후 계속',
  '필수 로그인',
  '회원 전용',
  '준비 중',
  '추후 제공',
  '베타',
];

for (const [name, text] of consumerFiles) {
  for (const forbidden of forbiddenVisibleCopy) {
    if (text.includes(forbidden)) throw new Error(`${name} exposes forbidden account/settings copy: ${forbidden}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  settings: 'login CTA separated',
  login: 'dedicated social login surface',
  tabbar: ['홈', '내 경로', '이용 팁', '내 정보'],
  privacy: 'expanded',
}, null, 2));
