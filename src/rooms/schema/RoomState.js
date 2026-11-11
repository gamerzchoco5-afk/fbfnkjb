import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

/**
 * Public-safe player info. NOTE: nothing secret (role, team, story) lives
 * here — this schema is broadcast to every client in the room. Secret
 * per-player data is sent individually via private messages once role
 * assignment is implemented (Stage 4), never through synced state.
 */
export class Player extends Schema {
  constructor() {
    super();
    this.id = '';
    this.name = '';
    this.avatar = '';
    this.isHost = false;
    this.connected = true;
    this.joinOrder = 0;
  }
}
defineTypes(Player, {
  id: 'string',
  name: 'string',
  avatar: 'string',
  isHost: 'boolean',
  connected: 'boolean',
  joinOrder: 'number',
});

export class RoomState extends Schema {
  constructor() {
    super();
    this.code = '';
    this.started = false;
    this.players = new MapSchema();
    // Public by design: the spec's UI calls for a clearly-marked Anchor
    // panel, so the Anchor's identity is not secret — only team
    // membership (Fake News / Real News / Manipulator) is, and that never
    // goes on synced state at all (see StudioRoom's `secret` object).
    this.anchorId = '';
  }
}
defineTypes(RoomState, {
  code: 'string',
  started: 'boolean',
  players: { map: Player },
  anchorId: 'string',
});
