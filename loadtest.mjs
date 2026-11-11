// Stage 10 load/edge-case test. Spins up 15 simulated players (the spec's
// max room size) through join, a full start_game, and several edge cases
// a real session could hit — overflow, late joins, a non-host trying to
// start, a mid-match disconnect, and a host leaving. Run against a
// server already listening on localhost:2567:
//
//   npm start            (in one terminal)
//   npm run loadtest      (in another)
//
// Requires the colyseus.js devDependency (already in package.json).
import { Client } from 'colyseus.js';

const client = new Client('ws://localhost:2567');
const NAMES = [
  'Rohan','Priya','Arjun','Fatima','Sana','Vikram','Meera','Dev',
  'Isha','Kabir','Neha','Zoya','Aman','Riya','Kunal',
];

function wire(c, bag) {
  c.onMessage('role_assigned', (m) => { bag.roles[c.sessionId] = m; });
  c.onMessage('voice_token', () => { bag.voiceCount++; });
  c.onMessage('phase_tick', (m) => { bag.ticks++; bag.lastTick = m; });
  c.onMessage('decision_time', (m) => { bag.decision = m; });
  c.onMessage('results', (m) => { bag.results = m; });
  c.onMessage('host_left', () => { bag.hostLeftSeen = true; });
}

async function main() {
  console.log(`--- Load test: ${NAMES.length} players ---`);
  const bag = { roles: {}, voiceCount: 0, ticks: 0, decision: null, results: null, hostLeftSeen: false };

  const t0 = Date.now();
  const host = await client.create('studio', { name: NAMES[0] });
  wire(host, bag);
  await new Promise((r) => setTimeout(r, 150));
  const code = (await client.getAvailableRooms('studio'))[0].metadata.code;

  const guests = [];
  for (const name of NAMES.slice(1)) {
    const rooms = await client.getAvailableRooms('studio');
    const match = rooms.find((r) => r.metadata?.code === code);
    const g = await client.joinById(match.roomId, { name });
    wire(g, bag);
    guests.push(g);
  }
  const allClients = [host, ...guests];
  await new Promise((r) => setTimeout(r, 400));
  console.log(`joined ${allClients.length} players in ${Date.now() - t0}ms`);
  console.log('all have same roomId:', new Set(allClients.map(c => c.id)).size === 1);
  console.log('player count visible to host:', host.state.players.size);

  // --- edge case: a 16th join attempt must be rejected (max 15) ---
  try {
    await client.joinById(host.id, { name: 'Overflow' });
    console.log('FAIL: 16th player was allowed to join');
  } catch (e) {
    console.log('OK: 16th join rejected —', e.message);
  }

  // --- edge case: non-host can't start the game ---
  guests[0].send('start_game');
  await new Promise((r) => setTimeout(r, 200));
  console.log('OK: non-host start_game ignored (still not started):', !host.state.started);

  host.send('start_game');
  await new Promise((r) => setTimeout(r, 500));
  console.log('game started:', host.state.started);
  console.log('roles assigned to all players:', Object.keys(bag.roles).length, '/', allClients.length);
  const dist = {};
  Object.values(bag.roles).forEach((r) => { dist[r.role] = (dist[r.role] || 0) + 1; });
  console.log('role distribution:', dist, '(spec for 15: anchor1 fake4 real9 manipulator1)');
  console.log('voice tokens delivered:', bag.voiceCount, '/', allClients.length, '(0 expected — no LiveKit configured in this run)');

  // --- edge case: a join attempt after the match started must be rejected ---
  try {
    await client.joinById(host.id, { name: 'LateJoiner' });
    console.log('FAIL: late join was allowed after match started');
  } catch (e) {
    console.log('OK: late join rejected —', e.message);
  }

  // --- edge case: a mid-match disconnect keeps the player's seat ---
  const midLeaver = guests[guests.length - 1];
  const leaverName = Array.from(host.state.players.values()).find(p => p.id === midLeaver.sessionId)?.name;
  midLeaver.leave();
  await new Promise((r) => setTimeout(r, 300));
  const stillPresent = host.state.players.get(midLeaver.sessionId);
  console.log(`OK: mid-match leaver (${leaverName}) kept in state, connected=${stillPresent?.connected}:`, !!stillPresent && stillPresent.connected === false);

  console.log(`ticks received so far: ${bag.ticks}`);

  // --- host disconnect closes the room for everyone ---
  host.leave();
  await new Promise((r) => setTimeout(r, 400));
  console.log('OK: host_left broadcast seen by a guest:', bag.hostLeftSeen);

  guests.filter(g => g !== midLeaver).forEach((g) => { try { g.leave(); } catch {} });
  console.log('--- load test complete ---');
  process.exit(0);
}

main().catch((e) => { console.error('LOAD TEST FAILED:', e); process.exit(1); });
