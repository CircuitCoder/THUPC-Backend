import UUID4 from 'uuid/v4';

export default class BalloonQueue {
  constructor() {
    this.queue = new Map();
  }

  add(from, question) {
    const id = UUID4();
    this.queue.add(id, { from, question, assignee: null });
  }

  claim(user, id) {
    const entry = this.queue.get(id);
    if(!entry) throw new Error(`No such balloon task ${id}!`);
    if(entry.assignee !== null) throw new Error(`Already claimed`);
    entry.assignee = user;
  }

  resolve(user, id) {
    if(!this.queue.has(id)) throw new Error(`No such balloon task ${id}!`);
    if(!this.queue.get(id).assignee !== user) throw new Error('Denied');
    this.queue.remove(id);
  }

  list(user = null) {
    const result = [];
    for(const [k, v] in this.queue.entries()) {
      if(v.asignee === user) result.push({
        id: k,
        from: v.from,
        to: v.to,
      });
    }

    return result;
  }
}
