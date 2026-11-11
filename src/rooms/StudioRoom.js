import colyseus from 'colyseus';
const { Room } = colyseus;
import { RoomState, Player } from './schema/RoomState.js';
import { avatarFor, genRoomCode } from '../avatars.js';
import { assignRoles } from '../roles.js';
import { pickStory } from '../stories.js';
import { PHASES } from '../phases.js';
import { createVoiceToken, setCanPublish } from '../livekit.js';

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 15;

export class StudioRoom extends Room {
  maxClients = MAX_PLAYERS;

  onCreate() {
    const state = new RoomState();
    state.code = genRoomCode();
    this.setState(state);

    // Lets a "join by code" client find this room via client.getAvailableRooms().
    this.setMetadata({ code: state.code });

    // --- secret match data: NEVER put any of this on synced state. ------
    // this.state is broadcast to every client; roles, which story is real,
    // and who's on which team all live only in this plain object instead.
    this.secret = {
      roles: {},        // sessionId -> 'anchor' | 'real' | 'fake' | 'manipulator'
      headline: null,    // the event everyone is told, e.g. "Ambani ke ghar mein chori ho gayi!"
      realText: null,    // whichever claim was randomly chosen as true this match
      fakeText: null,    // the other claim
      newsOptions: null, // [{ key, text, isReal }]
      phaseIndex: 0,
      secondsLeft: 0,
      decisionStarted: false, // only true once all 5 discussion phases have run out
      decided: false,
    };
    this.phaseTimer = null;

    this.onMessage('start_game', (client) => this.handleStartGame(client));
    this.onMessage('submit_choice', (client, message) => this.handleSubmitChoice(client, message));

    console.log(`[studio] room ${this.roomId} created — code ${state.code}`);
  }

  async onJoin(client, options = {}) {
    if (this.state.started) {
      throw new Error('This broadcast has already started.');
    }
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new Error('This studio is full.');
    }

    const name = String(options.name || '').trim().slice(0, 16) || `Guest${this.state.players.size + 1}`;

    const player = new Player();
    player.id = client.sessionId;
    player.name = name;
    player.avatar = avatarFor(name);
    player.isHost = this.state.players.size === 0; // first to join is the host
    player.joinOrder = this.state.players.size;
    player.connected = true;

    this.state.players.set(client.sessionId, player);
    console.log(`[studio ${this.state.code}] ${name} joined (${this.state.players.size}/${MAX_PLAYERS})`);

    // Voice room name = this Colyseus room's id, so it's stable and unique.
    // A null result just means LiveKit isn't configured — client handles that.
    const voice = await createVoiceToken({ identity: client.sessionId, name, roomName: this.roomId });
    if (voice) client.send('voice_token', voice);
  }

  onLeave(client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (player.isHost) {
      console.log(`[studio ${this.state.code}] host left — closing room`);
      this.broadcast('host_left');
      this.state.players.delete(client.sessionId);
      clearInterval(this.phaseTimer);
      this.disconnect(); // spec: if the host disconnects, the room closes
      return;
    }

    if (this.state.started) {
      // Mid-match: keep their seat (and role) so the grid/results don't
      // break, just mark them disconnected. Full reconnection support is
      // a later polish item — see the server README.
      player.connected = false;
      console.log(`[studio ${this.state.code}] ${player.name} disconnected mid-match`);
      return;
    }

    console.log(`[studio ${this.state.code}] ${player.name} left`);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    clearInterval(this.phaseTimer);
    console.log(`[studio ${this.state.code}] room disposed`);
  }

  // --- server-validated actions -------------------------------------------

  handleStartGame(client) {
    const requester = this.state.players.get(client.sessionId);
    if (!requester?.isHost) return;
    if (this.state.started) return;
    if (this.state.players.size < MIN_PLAYERS) return;

    const playerIds = Array.from(this.state.players.keys());
    const roles = assignRoles(playerIds);
    const story = pickStory();

    // Which of the two claims is "real" is picked at random per match —
    // deliberately NOT tied to which claim sounds more sensible, so
    // players can't learn to just pick "the normal-sounding one."
    const realIndex = Math.random() < 0.5 ? 0 : 1;
    const realText = story.claims[realIndex];
    const fakeText = story.claims[1 - realIndex];

    const optionOrder = Math.random() < 0.5
      ? [{ key: 'A', text: realText, isReal: true }, { key: 'B', text: fakeText, isReal: false }]
      : [{ key: 'A', text: fakeText, isReal: false }, { key: 'B', text: realText, isReal: true }];

    this.secret.roles = roles;
    this.secret.headline = story.headline;
    this.secret.realText = realText;
    this.secret.fakeText = fakeText;
    this.secret.newsOptions = optionOrder;
    this.secret.decisionStarted = false;
    this.secret.decided = false;

    this.state.started = true;
    this.state.anchorId = playerIds.find((id) => roles[id] === 'anchor') || '';
    this.lock();

    // Send each player ONLY what their role is entitled to know.
    for (const [sessionId, playerClient] of this.clientsBySessionId()) {
      const role = roles[sessionId];
      const payload = { role, headline: story.headline, story: null, teammates: [] };

      if (role === 'real' || role === 'fake') {
        payload.story = role === 'real' ? realText : fakeText;
        payload.teammates = playerIds
          .filter((id) => id !== sessionId && roles[id] === role)
          .map((id) => this.publicPlayer(id));
      } else if (role === 'manipulator') {
        payload.story = fakeText; // helps the fake side, but never told who they are
      }

      playerClient.send('role_assigned', payload);
    }

    this.broadcast('game_started');
    console.log(`[studio ${this.state.code}] game started with ${this.state.players.size} players`);

    this.beginPhaseTimer();
  }

  handleSubmitChoice(client, message) {
    const role = this.secret.roles[client.sessionId];
    if (role !== 'anchor') return;
    if (!this.secret.decisionStarted) return; // can't lock in before discussion actually ends
    if (this.secret.decided) return;
    const key = message?.key;
    const picked = this.secret.newsOptions?.find((o) => o.key === key);
    if (!picked) return;

    this.secret.decided = true;
    clearInterval(this.phaseTimer);

    const rolesPublic = {};
    for (const id of this.state.players.keys()) rolesPublic[id] = this.secret.roles[id];

    this.broadcast('results', {
      winner: picked.isReal ? 'real' : 'fake',
      chosenKey: key,
      story: { headline: this.secret.headline, real: this.secret.realText, fake: this.secret.fakeText },
      roles: rolesPublic,
    });
    console.log(`[studio ${this.state.code}] anchor picked ${key} — ${picked.isReal ? 'real' : 'fake'} team wins`);
  }

  // --- phase/timer, broadcast once per second so every client shares one clock ---
  beginPhaseTimer() {
    this.secret.phaseIndex = 0;
    this.secret.secondsLeft = PHASES[0].duration;
    this.broadcastPhaseTick();
    this.applyAnchorMicPermission(0);

    clearInterval(this.phaseTimer);
    this.phaseTimer = setInterval(() => {
      this.secret.secondsLeft -= 1;

      if (this.secret.secondsLeft > 0) {
        this.broadcastPhaseTick();
        return;
      }

      const nextIndex = this.secret.phaseIndex + 1;
      if (nextIndex >= PHASES.length) {
        clearInterval(this.phaseTimer);
        this.beginDecisionPhase();
        return;
      }

      this.secret.phaseIndex = nextIndex;
      this.secret.secondsLeft = PHASES[nextIndex].duration;
      this.broadcastPhaseTick();
      this.applyAnchorMicPermission(nextIndex);
    }, 1000);
  }

  // Real, server-enforced mic lock: flips the Anchor's LiveKit publish
  // permission to match the phase, so a modified/bypassed client can't
  // actually transmit audio outside their speaking turns. Every other
  // player can always publish — only the Anchor's permission ever changes.
  applyAnchorMicPermission(phaseIndex) {
    if (!this.state.anchorId) return;
    setCanPublish(this.roomId, this.state.anchorId, PHASES[phaseIndex].anchorCanSpeak);
  }

  broadcastPhaseTick() {
    const phase = PHASES[this.secret.phaseIndex];
    this.broadcast('phase_tick', {
      phaseIndex: this.secret.phaseIndex,
      secondsLeft: this.secret.secondsLeft,
      key: phase.key,
      label: phase.label,
      anchorCanSpeak: phase.anchorCanSpeak,
    });
  }

  beginDecisionPhase() {
    this.secret.decisionStarted = true;
    if (this.state.anchorId) setCanPublish(this.roomId, this.state.anchorId, true); // discussion's over, hand the mic back
    const options = this.secret.newsOptions.map((o) => ({ key: o.key, text: o.text }));
    this.broadcast('decision_time', { headline: this.secret.headline, options });
    console.log(`[studio ${this.state.code}] discussion over — awaiting Anchor's choice`);
  }

  // --- helpers -------------------------------------------------------------
  *clientsBySessionId() {
    for (const c of this.clients) yield [c.sessionId, c];
  }

  publicPlayer(sessionId) {
    const p = this.state.players.get(sessionId);
    return p ? { id: p.id, name: p.name, avatar: p.avatar } : null;
  }
}
