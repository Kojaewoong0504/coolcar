import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const userProfilePill = readFileSync('src/components/auth/UserProfilePill.tsx', 'utf8');
const logoutButton = readFileSync('src/components/auth/LogoutButton.tsx', 'utf8');
const authMeRoute = readFileSync('src/app/api/auth/me/route.ts', 'utf8');
const logoutRoute = readFileSync('src/app/api/auth/logout/route.ts', 'utf8');
const savedPage = readFileSync('src/app/saved/page.tsx', 'utf8');

assert(userProfilePill.includes('export function clearUserProfileCache'), 'UserProfilePill must export a cache clear function for logout/login transitions.');
assert(userProfilePill.includes('coolcar-auth-changed'), 'UserProfilePill must listen for auth-change events to avoid stale profile display.');
assert(userProfilePill.includes("credentials: 'same-origin'"), 'UserProfilePill /api/auth/me fetch must include same-origin credentials.');
assert(logoutButton.includes('clearUserProfileCache'), 'LogoutButton must clear UserProfilePill cache after logout.');
assert(logoutButton.includes('coolcar-auth-changed'), 'LogoutButton must broadcast auth-change after logout.');
assert(logoutButton.includes("cache: 'no-store'"), 'LogoutButton logout fetch must be no-store.');
assert(logoutButton.includes('!response.ok'), 'LogoutButton must not treat failed logout as success.');
assert(logoutButton.includes("router.replace('/settings')"), 'LogoutButton should navigate to a neutral account surface after logout.');
assert(authMeRoute.includes("dynamic = 'force-dynamic'"), '/api/auth/me must be force-dynamic.');
assert(authMeRoute.includes('no-store'), '/api/auth/me must return no-store headers.');
assert(logoutRoute.includes("dynamic = 'force-dynamic'"), '/api/auth/logout must be force-dynamic.');
assert(logoutRoute.includes('signOut') && logoutRoute.includes('error'), '/api/auth/logout must check signOut errors.');
assert(logoutRoute.includes('no-store'), '/api/auth/logout must return no-store headers.');
assert(savedPage.includes("fetch(`/api/routes/saved?anonymousId=${anonymousId}`, { cache: 'no-store' })"), '/saved route fetch must be no-store to avoid stale owner data.');

console.log(JSON.stringify({
  ok: true,
  profileCache: 'cleared on logout/auth-change',
  authApis: 'force-dynamic no-store',
  savedRoutes: 'no-store fetch',
}, null, 2));
