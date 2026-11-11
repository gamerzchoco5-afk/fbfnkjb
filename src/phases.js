// Server-authoritative phase table — the single source of truth for match
// timing (the frontend has no local copy; it just renders whatever
// `phase_tick` broadcasts). Total match length: 8 minutes.
//
// The Anchor's two speaking turns stay at the spec's 60s max each; the
// extra time over the original 5-minute cut goes into the three
// discussion phases instead (120s each), so: 120 + 60 + 120 + 60 + 120 = 480s.
export const PHASES = [
  { key: 'open-1', label: 'Open Discussion', duration: 120, anchorCanSpeak: false },
  { key: 'anchor-1', label: 'Anchor Speaking Time', duration: 60, anchorCanSpeak: true },
  { key: 'open-2', label: 'Discussion', duration: 120, anchorCanSpeak: false },
  { key: 'anchor-2', label: 'Anchor Speaking Time', duration: 60, anchorCanSpeak: true },
  { key: 'final', label: 'Final Discussion', duration: 120, anchorCanSpeak: false },
];
