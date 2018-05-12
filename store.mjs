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
    const place = bucket.length - 1;
    while(place >= 0 && bucket[place].time > time) --place;

    const payload = {
      id: subId,
      time,
      status: 'pending',
    };
    
    if(place < 0) bucket.tries.unshift(payload);
    else bucket.tries.splice(place, 0, payload);

    ++bucket.pending;
  }

  accepted(id, question, subId) {
    const bucket = this.bucket(id, question);
    console.log(bucket);
    const index = bucket.tries.findIndex(e => e.id === subId);
    if(index === -1) throw new Error(`Submission ${subId} not found. Maybe the storage is out of sync?`);

    --bucket.pending;
    bucket.tries[index].status = 'accepted';

    // Update faulty count
    if(bucket.tries[index].time < bucket.acceptedAt) {
      bucket.countedFaulty = index;
      bucket.acceptedAt = bucket[index].time;
    }
  }

  faulty(id, question, subId) {
    const bucket = this.bucket(id, question);
    const index = bucket.tries.findIndex(e => e.id === subId);
    if(index === -1) throw new Error(`Submission ${subId} not found. Maybe the storage is out of sync?`);

    --bucket.pending;
    bucket[index].status = 'faulty';

    // Contribute to faulty count
    if(bucket[index].time < bucket.acceptedAt)
      ++bucket.countedFaulty;
  }
}

