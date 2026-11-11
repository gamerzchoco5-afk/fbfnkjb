// Server-authoritative story bank. Short, simple Hinglish lines — easy to
// read at a glance, not literary. Each entry is just a headline (the
// event) plus two short competing claims about it; the server picks
// which claim is "real" at random per match (see StudioRoom), so neither
// claim is reliably the sensible one or the absurd one. A player can't
// learn to guess "the normal-sounding claim is always real" — sometimes
// the weird one is true.
export const STORY_BANK = [
  {
    headline: 'Ambani ke ghar mein chori ho gayi!',
    claims: ['Chor raat ko chori kar gaye.', 'Modi ji khud aake chori kar gaye.'],
  },
  {
    headline: 'School mein bomb mil gaya!',
    claims: ['Bacche ka tiffin box nikla.', 'Asli bomb tha, squad bulani padi.'],
  },
  {
    headline: 'Sarkar ne naya note nikala!',
    claims: ['Note pe cartoon character chapa hai.', 'Note bilkul normal hai, bas rang naya hai.'],
  },
  {
    headline: 'Cricket match ke baad dange ho gaye!',
    claims: ['Do fan aapas mein lad gaye.', 'Pura stadium maidan mein utar gaya.'],
  },
  {
    headline: 'Shehar ka sabse bada mall band ho gaya!',
    claims: ['Bijli chali gayi thi.', 'Mall mein bhoot dikha, isliye band hua.'],
  },
  {
    headline: 'Netaji stage par behosh ho gaye!',
    claims: ['Garmi ki wajah se behosh hue.', 'Jhooth bolte bolte behosh ho gaye.'],
  },
  {
    headline: 'Local train 2 ghante late ho gayi!',
    claims: ['Signal fail ho gaya tha.', 'Driver chai peene chala gaya tha.'],
  },
  {
    headline: 'Shehar ke upar UFO dikha!',
    claims: ['Wo ek drone tha.', 'Asli UFO tha, scientist aa rahe hain.'],
  },
  {
    headline: 'CM ne press conference beech mein chhod di!',
    claims: ['Unka phone baj gaya tha.', 'Sawal sunke gussa ho gaye.'],
  },
  {
    headline: 'Pure shehar ka internet band ho gaya!',
    claims: ['Cable kaat gayi thi.', 'Sarkar ne jaan-bujhkar band kiya.'],
  },
];

export function pickStory() {
  return STORY_BANK[Math.floor(Math.random() * STORY_BANK.length)];
}
