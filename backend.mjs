const __dirname = path.dirname(new url.URL(import.meta.url).pathname);

import Koa from 'koa';
import KoaRouter from 'koa-router';
import KoaStatic from 'koa-static';

import SocketIO from 'socket.io';

import redis from 'redis';

import moment from 'moment';

import url from 'url';
import path from 'path';
import http from 'http';
import fsMod from 'fs';
const fs = fsMod.promises;

import Store from './store';
import BalloonQueue from './balloonQueue';
import Config from './config';

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
  if(!(ctx.params.id in keys)) return ctx.status = 403;
  ctx.body = {
    unclaimed: balloons.list(),
    assigned: balloons.list(ctx.params.id),
  };
});

router.get('/ranklist', async ctx => {
  return ctx.body = {
    timestamp: Date.now(),
    timing: {
      from: moment(Config.contest.from),
      to: moment(Config.contest.to),
    },
    ranklist: store.rank(),
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

  /*
  ioRanking.emit('new', {
    id: payload.id,
    from: payload.from,
    question: payload.question,
    time: payload.time,
  });
  */
  ioRanking.emit('sync');

  ioStatus.emit('pending', {
    timing: Config.contest,

    id: payload.id,
    from: payload.from,
    question: payload.question,
    time: payload.time,
  });
}

async function finalize(payload) {
  let cont;
  if(payload.accepted)
    cont = store.accepted(payload.from, payload.question, payload.id);
  else
    cont =- store.faulty(payload.from, payload.question, payload.id);
  const endingTime = moment(Config.contest.to);
  endingTime.subtract(1).hours();

  if(endingTime < moment(cont.time)) {

    // Frozen
    return;
  }

  /*
  ioRanking.emit('update', {
    id: payload.id,
    accepted: payload.accepted,
  });
  */
  ioRanking.emit('sync');

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
      try {
        balloons.resolve(key, id);
        ioBalloon.emit('sync');
      } catch(e) { console.error(e) }
    });

    client.on('claim', id => {
      try {
        balloons.claim(key, id);
        ioBalloon.emit('sync');
      } catch(e) { client.emit('failed'); }
    });
  });
});

// PubSub
const hub = redis.createClient();
hub.subscribe('submission');
hub.subscribe('finalize');

hub.on('message', (channel, msg) => {
  const payload = JSON.parse(msg);

  // Deferred async execution
  if(channel === 'submission') submission(payload);
  else if(channel === 'finalize') finalize(payload);
});

// Bootstrap 
async function boot() {
  const teamsStr = (await fs.readFile(path.resolve(__dirname, './teams.json')))
    .toString('utf-8');
  teams = JSON.parse(teamsStr);

  const keysStr = (await fs.readFile(path.resolve(__dirname, './keys.json')))
    .toString('utf-8');
  keys = JSON.parse(keysStr);

  store = new Store(teams);
  balloons = new BalloonQueue();

  const backlog = await fsMod.createWriteStream(path.resolve(__dirname, './balloons.log'), { flags: 'a' });
  balloons.on('resolve', ({ from, question, assignee }) => {
    const curtime = moment().format('hh:mm:ss.SSS');
    backlog.write(`[${curtime}] ${from}:\t${question} # ${assignee}\n`);
  });

  const port = process.env.PORT || 6858;
  server.listen(port, () => {
    console.log(`Server up at ${port}`);
  });
}

boot();
