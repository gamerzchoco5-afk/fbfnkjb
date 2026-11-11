// Server-authoritative copy of the frontend's role distribution table.
// Keep in sync with fake-news-studio/src/data/mock.js if either changes —
// duplicated on purpose since the two projects deploy independently.
export const ROLE_DISTRIBUTION = {
  4: { anchor: 1, fake: 1, real: 1, manipulator: 1 },
  5: { anchor: 1, fake: 1, real: 2, manipulator: 1 },
  6: { anchor: 1, fake: 2, real: 2, manipulator: 1 },
  7: { anchor: 1, fake: 2, real: 3, manipulator: 1 },
  8: { anchor: 1, fake: 2, real: 4, manipulator: 1 },
  9: { anchor: 1, fake: 3, real: 3, manipulator: 1 },
  10: { anchor: 1, fake: 3, real: 4, manipulator: 1 },
  11: { anchor: 1, fake: 3, real: 5, manipulator: 1 },
  12: { anchor: 1, fake: 3, real: 6, manipulator: 1 },
  13: { anchor: 1, fake: 4, real: 6, manipulator: 1 },
  14: { anchor: 1, fake: 4, real: 7, manipulator: 1 },
  15: { anchor: 1, fake: 4, real: 9, manipulator: 1 },
};

export function assignRoles(playerIds) {
  const n = playerIds.length;
  const dist = ROLE_DISTRIBUTION[n];
  if (!dist) throw new Error(`No role distribution for ${n} players`);

  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const roles = {};
  let i = 0;
  const take = (count) => shuffled.slice(i, (i += count));

  take(dist.anchor).forEach((id) => (roles[id] = 'anchor'));
  take(dist.fake).forEach((id) => (roles[id] = 'fake'));
  take(dist.real).forEach((id) => (roles[id] = 'real'));
  take(dist.manipulator).forEach((id) => (roles[id] = 'manipulator'));

  return roles;
}
