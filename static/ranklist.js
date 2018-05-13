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

const PINNED = window.location.hash.substr(1).split(',');

let inst;
let timerInst;

const tmpl = {
  el: '#app',
  data: {
    teams: {},
    ranklist: [],
    firstBlood: [],
    lastAC: null,
    bestGirl: null,

    started: false,
    frozen: false,
    ended: false,

    lastUpdated: 0,
    timing: null,

    QUESTIONS,
    PINNED,

	  rolling: false,
	  targetUser: null,
	  targetProb: null,
  },
  async created() {
    const req = await fetch('/teams');
    this.teams = await req.json();
    this.sync();
  },
  methods: {
    async sync() {
      const req = await fetch('/ranklist');
      const { timestamp, timing, ranklist } = await req.json();
      timerInst.timing = timing;
      this.timing = timing;
      this.lastUpdated = timestamp;
      this.ranklist = ranklist;

      for(let r of this.ranklist) {
        const dur = moment.duration(r.time);
        r.clamped_time = Math.floor(dur.asMinutes());
        this.$set(r, 'expanded', false);
        for(let k in r.details) {
          if(r.details[k].acceptedAt) {
            r.details[k].clamped_acceptedAt = this.timeSub(r.details[k].acceptedAt);
            r.details[k].clamped_acceptedAt_sec = this.timeSubSec(r.details[k].acceptedAt);
          }
        }
      }
      this.firstBlood = new Array(this.QUESTIONS.length).fill(null);
      for(let r of this.ranklist) {
        for(let k in r.details) {
          if(r.details[k].acceptedAt
            && (this.firstBlood[k] === null || this.firstBlood[k].acceptedAt > r.details[k].acceptedAt))
            this.firstBlood[k] = r.details[k];
        }
      }

      this.lastAC = null;
      for(let r of this.ranklist) {
        for(let k in r.details) {
          if(r.details[k].acceptedAt
            && (this.lastAC === null || this.lastAC.acceptedAt < r.details[k].acceptedAt))
            this.lastAC = r.details[k];
        }
      }

      this.bestGirl = null;
      for(let r of this.ranklist) {
        if(this.teams[r.id].members.every(k => k.sex === '女')) {
          this.bestGirl = r;
          break;
        }
      }
    },

	  async step() {
		  console.log('wtf');
		  if(!this.rolling) this.rolling = true;
		  else await this.unreveal();

		  await this.findNext();
	  },

	  async unreveal() {
		  await fetch(`/apply/${this.targetUser}/${this.targetProb}`);
		  await this.sync();
	  },

          findNext() {
		  console.log('step');
		  this.targetUser = null;
		  this.targetProb = null;
		  for(let i = this.ranklist.length-1; i >=0; --i) {
			  for(let j = 0; j<QUESTIONS.length; ++j) {
				  if(j in this.ranklist[i].details && this.ranklist[i].details[j].pending > 0) {
					  this.targetUser = this.ranklist[i].id;
					  this.targetProb = j;
					  return;
				  }
			  }
		  }
	  },

    timeSub(ts) {
      const t = moment(ts);
      const starting = moment(this.timing.from);
      return moment.duration(t.diff(starting)).format('h:mm:ss');
    },

    timeSubSec(ts) {
      const t = moment(ts);
      const starting = moment(this.timing.from);
      return '.'+moment.duration(t.diff(starting)).milliseconds();
    },

    expand(r) {
      r.expanded = !r.expanded;
    }
  },

  watch: {
    ranklist() {
      console.log('mutate');
    }
  },
};

const timerTmpl = {
  el: '#timer',
  data: {
    timing: null,
    started: false,
    ended: false,
    frozen: false,
    untilStarting: '',
    time: 0,
  },
  mounted() {
    const updateTime = () => {
      if(this.timing) {
        const now = moment();
        const starting = moment(this.timing.from);
        const ending = moment(this.timing.to);

        this.started = starting <= now;
        this.ended = ending <= now;

        if(this.ended) {
          const dur = moment.duration(now.diff(ending));
          this.time = dur.format('hh:mm:ss.SSS');
        } if(this.started) {
          const dur = moment.duration(ending.diff(now));
          this.time = dur.format('hh:mm:ss.SSS');
          if(dur.hours() < 1) // Frozen
            this.frozen = true;
        } else {
          this.untilStarting = now.to(starting, true);
        }
      }

      requestAnimationFrame(updateTime);
    };

    updateTime();
  },
};

function boot() {
  socket = io('/ranking', {
    path: '/socket',
  });

  socket.on('sync', () => {
    inst.sync();
  });

  inst = new Vue(tmpl);
  timerInst = new Vue(timerTmpl);

	document.addEventListener('keydown', () => {
		inst.step();
	});
}
