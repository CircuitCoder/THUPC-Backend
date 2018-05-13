const QUESTIONS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
];

const THRESHOLD = 8;

let inst;

const tmpl = {
  el: '#app',
  data: {
    list: [],
    teams: {},

    QUESTIONS,
  }, 
  async created() {
    const req = await fetch('/teams');
    this.teams = await req.json();
  },
  methods: {
    push(data) {
      data.resolved = false;
      data.time = moment.duration(moment(data.time).diff(moment(data.timing.from))).format('h:mm:ss.SSS');
      this.list.unshift(data);
      if(this.list.length > THRESHOLD)
        this.list.shift();
    },

    resolve(resolver) {
      const index = this.list.findIndex(k => k.id === resolver.id);
      if(index === -1) // Already unqueued
        return;

      this.list[index].resolved = true;
      this.list[index].accepted = resolver.accepted;
      this.list[index].detail = resolver.detail;
    },
  },
};

function boot() {
  inst = new Vue(tmpl);

  socket = io('/status', {
    path: '/socket',
  });

  socket.on('pending', data => {
    inst.push(data);
  });

  socket.on('resolve', data => {
    inst.resolve(data);
  });
}
