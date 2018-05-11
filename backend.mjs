const __dirname = path.dirname(new url.URL(import.meta.url).pathname);

import Koa from 'koa';
import KoaRouter from 'koa-router';
import KoaStatic from 'koa-static';

import SocketIO from 'socket.io';

import redis from 'redis';

import url from 'url';
import path from 'path';
import http from 'http';
import fsMod from 'fs';
const fs = fsMod.promises;

import Store from './store';
import BalloonQueue from './balloonQueue';

// Stores
let teams;
let keys;

let store;
let balloons;

// Connections

const app = new Koa();
const router = new KoaRouter();
router.get('/teams', async ctx => {
  ctx.body = teams;
});

router.get('/balloons/:id', async ctx => {
  if(!(id in keys)) return ctx.status = 403;
  ctx.body = {
    unclaimed: balloons.list(),
    assigned: balloons.list(ctx.params.iD),
  };
});

app.use(router.routes(), router.allowedMethods());
app.use(KoaStatic(path.resolve(__dirname, 'static')));

const server = http.createServer(app.callback());
const io = new SocketIO(server, {
  wsEngine: 'uws',
  path: '/socket',
});

const ioRanking = io.of('/ranking');
const ioStatus = io.of('/status');
const ioBalloon = io.of('/balloon');

// Handlers
async function submission(payload) {
  store.pending(payload.from, payload.question, payload.id, payload.time);

  ioRanking.emit('new', {
    id: payload.id,
    from: payload.from,
    question: payload.question,
    time: payload.time,
  });

  ioStatus.emit('pending', {
    id: payload.id,
    from: payload.from,
    question: payload.question,
    time: payload.time,
  });
}

async function finalized(payload) {
  // TODO: suspended
  if(payload.accepted)
    store.accepted(payload.from, payload.question, payload.id);
  else
    store.faulty(payload.from, payload.question, payload.id);

  ioRanking.emit('update', {
    id: payload.id,
    accepted: payload.accepted,
  });

  ioStatus.emit('resolve', {
    id: payload.id,
    accepted: payload.accepted,
    detail: payload.detail, // AC, WA, TLE, MLE...
  });

  if(payload.accepted) {
    balloons.add(payload.from, payload.question);
    ioBalloon.emit('sync');
  }
}

ioBalloon.on('connection', client => {
  client.once('authenticate', key => {
    if(!(key in keys)) {
      client.emit('authentication', 'denied');
      return;
    }

    client.emit('authentication', 'accepted');

    client.on('resolve', id => {
      balloons.resolve(key, id);
      ioBalloon.emit('sync');
    });

    client.on('claim', id => {
      balloons.claim(key, id);
      ioBalloon.emit('sync');
    });
  });
});

// PubSub
const hub = redis.createClient();
hub.subscribe('submission');
hub.subscribe('finalized');

hub.on('message', (channel, msg) => {
  const payload = JSON.parse(msg);

  // Deferred async execution
  if(channel === 'submission') submission(payload);
  else if(channel === 'finalized') finalized(payload);
});

// Bootstrap 
async function boot() {
  const teamsStr = (await fs.readFile(path.resolve(__dirname, './teams.json')))
    .toString('utf-8');
  teams = JSON.parse(dataStr);

  const keysStr = (await fs.readFile(path.resolve(__dirname, './keys.json')))
    .toString('utf-8');
  keys = JSON.parse(keysStr);

  store = new Store(teams);
  balloons = new BalloonQueue();

  const port = process.env.PORT || 6858;
  server.listen(port, () => {
    console.log(`Server up at ${port}`);
  });
}

boot();
