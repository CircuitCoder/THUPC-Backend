import url from 'url';
const __dirname = path.dirname(new url.URL(import.meta.url).pathname);

import process from 'process';
import readline from 'readline';
import path from 'path';
import fsMod from 'fs';
const fs = fsMod.promises;

import crypto from 'crypto';

const reader = new readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

if(process.argv[2] === 'load') {
  // Load from csv
  // Chinese name, English name, Member, Cell, School, Grade, Size of shirt, Sex

  const teamMap = new Map();

  const prefix = 'THUPC_2018_';
  let counter = 0;
  let read = 0;

  console.log("Reading");

  reader.on('line', raw=> {
    const input = raw.split(',');
    let team = teamMap.get(input[0]);
    if(!team) {
      ++counter;
      let numStr = `${counter}`.padStart(3, '0');
      team = {
        id: prefix + numStr,
        title: input[0],
        eng_title: input[1],
        members: [],
      };

      teamMap.set(input[0], team);
    }

    team.members.push({
      name: input[2],
      school: input[4],
      grade: input[5],
      sex: input[7],
    });

    console.log(`Read: ${++read}`);
  });

  reader.on('close', async () => {
    const result = {};
    for(const e of teamMap.values())
      result[e.id] = e;

    console.log(result);

    const target = path.resolve(__dirname, './teams.json');
    await fs.writeFile(target, JSON.stringify(result));
    console.log(`Written to ${target}`);
  });
}

if(process.argv[2] === 'pass') {
  async function doPass() {
    const store = path.resolve(__dirname, './teams.json');
    const teams = JSON.parse((await fs.readFile(store)).toString('utf-8'));
    let result = 'username,realname,school,password\n';
    for(const t in teams) {
      const team = teams[t];
      team.pass = crypto.randomBytes(4).toString('hex');
      result += `${team.id},${team.title},THUPC,${team.pass}\n`;
    }

    const target = path.resolve(__dirname, './pass.csv');
    await fs.writeFile(target, result);
    console.log(`Written to ${target}`);
  }

  doPass();
}
