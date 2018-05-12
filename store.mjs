import moment from 'moment';
import Config from './config';

const STARTING = moment(Config.contest.from);

function addPenalty(dur, times) {
  return dur.add(20*times).minutes();
}

export default class Store {
  constructor(teams) {
    this.map = new Map();
    for(const t in teams)
      this.map.set(t, new Map());
  }

  bucket(id, question) {
    const user = this.map.get(id);
    if(!user) throw new Error(`Unknown user ${id}, please update your teams file`);
    if(user.has(question)) return user.get(question);
    else {
      const entry = {
        tries: [],
        pending: 0,
        countedFaulty: 0,
        acceptedAt: null,
      };

      user.set(question, entry);
      return entry;
    }
  }

  pending(id, question, subId, time) {
    const bucket = this.bucket(id, question);
    const place = bucket.tries.length - 1;
    while(place >= 0 && bucket.tries[place].time > time)
      --place;

    const payload = {
      id: subId,
      time,
      status: 'pending',
    };
    
    if(place < 0) bucket.tries.unshift(payload);
    else bucket.tries.splice(place+1, 0, payload);

    ++bucket.pending;
  }

  accepted(id, question, subId) {
    const bucket = this.bucket(id, question);
    const index = bucket.tries.findIndex(e => e.id === subId);
    if(index === -1) throw new Error(`Submission ${subId} not found. Maybe the storage is out of sync?`);

    --bucket.pending;
    bucket.tries[index].status = 'accepted';

    // Update faulty count
    if(bucket.acceptedAt === null || bucket.tries[index].time < bucket.acceptedAt) {
      bucket.countedFaulty = 0;
      for(let i = 0; i<index; ++i)
        if(bucket.tries[i].status === 'faulty')
          ++bucket.countedFaulty;
      bucket.acceptedAt = bucket.tries[index].time;
    }

    return bucket.tries[index];
  }

  faulty(id, question, subId) {
    const bucket = this.bucket(id, question);
    const index = bucket.tries.findIndex(e => e.id === subId);
    if(index === -1) throw new Error(`Submission ${subId} not found. Maybe the storage is out of sync?`);

    --bucket.pending;
    bucket.tries[index].status = 'faulty';

    // Contribute to faulty count
    if(bucket.acceptedAt === null || bucket.tries[index].time < bucket.acceptedAt)
      ++bucket.countedFaulty;

    return bucket.tries[index];
  }

  rank() {
    const ranklist =
      Array.from(this.map.entries())
      .map(([id, buckets]) => {
        let totalTime = moment.duration(0);
        let totalPenalty = 0;
        let totalAccepted = 0;

        const details = {};

        for(const [question, entry] of buckets.entries()) {
          details[question] = {
            pending: entry.pending,
            acceptedAt: entry.acceptedAt,
            countedFaulty: entry.countedFaulty,
          };

          if(entry.acceptedAt !== null) {
            ++totalAccepted;
            totalPenalty += entry.countedFaulty;
            totalTime.add(
              moment.duration(
                moment(entry.acceptedAt).diff(STARTING)
              )
            );
          }
        }

        addPenalty(totalTime, totalPenalty);

        return {
          id,
          details,
          accepted: totalAccepted,
          time: totalTime,
        };
      });

    ranklist.sort((a,b) => {
      if(a.accepted !== b.accepted) return b.accepted - a.accepted;
      if(a.time < b.time) return -1;
      if(a.time > b.time) return 1;
      return a.id.localeCompare(b.id);
    });

    for(let i = 0; i<ranklist.length; ++i) {
      if(i === 0 
        || ranklist[i-1].accepted > ranklist[i].accepted
        || ranklist[i-1].time < ranklist[i].time) ranklist[i].rank = i+1;
      else ranklist[i].rank = ranklist[i-1].rank;
    }

    return ranklist;
  }
}

