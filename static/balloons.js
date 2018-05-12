const INTERVAL = 60 * 1000;
const ID = window.location.hash.substr(1);

let socket;

const tmpl = {
  el: '#app',
  data: {
    unclaimed: [],
    assigned: [],
    teams: {},
  },
  async created() {
    const req = await fetch('/teams');
    this.teams = await req.json();
    this.sync();
  },
  methods: {
    async sync() {
      const req = await fetch(`/balloons/${ID}`);
      const { unclaimed, assigned } = await req.json();
      this.unclaimed = unclaimed;
      this.assigned = assigned;
    },

    claim(b) {
      console.log(b);
      socket.emit('claim', b.id);
    },

    resolve(b) {
      console.log(b);
      socket.emit('resolve', b.id);
    },
  },
};

function boot() {
  socket = io('/balloon', {
    path: '/socket',
  });

  socket.emit('authenticate', ID);

  socket.on('reconnect', () => {
    console.log('reconnect');
    socket.emit('authenticate', ID);
  });

  socket.on('authentication', payload => {
    if(payload !== 'accepted') alert('您的URL无效，请联系工作人员！');
  });

  socket.on('sync', () => {
    inst.sync();
  });

  socket.on('failed', () => {
    alert('没抢到啦...');
  });

  const inst = new Vue(tmpl);
  setInterval(() => {
    inst.sync();
  }, INTERVAL)
}
