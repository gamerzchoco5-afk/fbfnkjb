// Thin wrapper around livekit-server-sdk. Every call here is a no-op (with
// a console warning) if LiveKit isn't configured, so the rest of the game
// — rooms, roles, the timer — keeps working even before someone sets up a
// LiveKit project. See the server README for how to configure this.
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const WS_URL = process.env.LIVEKIT_URL || '';
const API_KEY = process.env.LIVEKIT_API_KEY || '';
const API_SECRET = process.env.LIVEKIT_API_SECRET || '';
// The server-to-server API needs an http(s) URL, not the wss:// one
// clients connect with. Most LiveKit Cloud projects use the same host for
// both, so we derive it unless LIVEKIT_API_URL is set explicitly.
const API_URL = process.env.LIVEKIT_API_URL || WS_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

export const isVoiceConfigured = Boolean(WS_URL && API_KEY && API_SECRET);

let roomService = null;
if (isVoiceConfigured) {
  roomService = new RoomServiceClient(API_URL, API_KEY, API_SECRET);
} else {
  console.warn(
    '[voice] LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set — ' +
    'voice chat is disabled. The rest of the game still works. See the README.'
  );
}

/**
 * Issues a join token for one player. `canPublish` starts true for
 * everyone (the lobby and most debate phases are open-mic); the Anchor's
 * publish permission is then toggled server-side per phase — see
 * setCanPublish() below — never trusted to the client.
 */
export async function createVoiceToken({ identity, name, roomName }) {
  if (!isVoiceConfigured) return null;
  const at = new AccessToken(API_KEY, API_SECRET, { identity, name, ttl: '2h' });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  const token = await at.toJwt();
  return { token, url: WS_URL, roomName };
}

/**
 * Server-enforced mute: flips whether one participant is allowed to
 * publish audio at all, regardless of what their client-side mic button
 * claims. This is what makes the Anchor's mic lock real instead of a UI
 * suggestion — called whenever a phase transition changes who's allowed
 * to speak.
 */
export async function setCanPublish(roomName, identity, canPublish) {
  if (!isVoiceConfigured) return;
  try {
    await roomService.updateParticipant(roomName, identity, {
      permission: { canPublish, canSubscribe: true, canPublishData: false },
    });
  } catch (err) {
    // Most likely: that participant hasn't connected to LiveKit yet (e.g.
    // their browser blocked the mic prompt). Not fatal to the match.
    console.warn(`[voice] could not update publish permission for ${identity}:`, err.message);
  }
}
