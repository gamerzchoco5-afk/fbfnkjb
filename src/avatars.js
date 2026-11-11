// Kept in sync with the frontend's src/data/mock.js avatarFor() so a given
// username renders as the same avatar on both client and server.
export const AVATAR_EMOJIS = ['🦁', '🐯', '🐼', '🦊', '🐸', '🐵', '🦉', '🐙', '🦄', '🐧', '🦓', '🐨', '🐶', '🐱', '🐷'];

export function avatarFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}
