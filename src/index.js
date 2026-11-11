import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import colyseus from 'colyseus';
const { Server } = colyseus;
import { WebSocketTransport } from '@colyseus/ws-transport';
import { StudioRoom } from './rooms/StudioRoom.js';
import { isVoiceConfigured } from './livekit.js';

const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'fake-news-studio-server', voice: isVoiceConfigured }));

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('studio', StudioRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Fake News Studio server listening on ws://localhost:${PORT}`);
});
