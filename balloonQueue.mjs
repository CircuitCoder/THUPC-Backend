import UUID4 from 'uuid/v4';
import EventEmitter from 'events';

export default class BalloonQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = new Map();
  }

  add(from, question) {
    const id = UUID4();
    this.queue.set(id, { from, question, assignee: null });
  }

  claim(user, id) {
    const entry = this.queue.get(id);
    if(!entry) throw new Error(`No such balloon task ${id}!`);
    if(entry.assignee !== null) throw new Error(`Already claimed`);
    entry.assignee = user;
  }

  resolve(user, id) {
    if(!this.queue.has(id)) throw new Error(`No such balloon task ${id}!`);
    const task = this.queue.get(id);
    if(task.assignee !== user) throw new Error('Denied');
    this.queue.delete(id);
    this.emit('resolve', task);
  }

  list(user = null) {
    const result = [];
    for(const [k, v] of this.queue.entries())
      if(v.assignee === user) result.push({
        id: k,
        from: v.from,
        question: v.question,
      });

    return result;
  }
}
