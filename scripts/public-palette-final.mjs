import fs from 'fs';

const path = 'App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const cutoff = 3756;

const repl = [
  ['bg-violet-400', 'bg-[#52A447]'],
  ['[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#52A447] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/50', '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#458a3c] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[rgba(82,164,71,0.35)]'],
  ['border-emerald-400/30', 'border-[#52A447]/30'],
  ['border-violet-400/30', 'border-[#52A447]/30'],
  ['border-violet-400/40', 'border-[#52A447]/40'],
  ['border-violet-400/20', 'border-[#52A447]/20'],
];

let publicPart = lines.slice(0, cutoff).join('\n');
for (const [from, to] of repl) {
  publicPart = publicPart.split(from).join(to);
}

fs.writeFileSync(path, `${publicPart}\n${lines.slice(cutoff).join('\n')}`);
console.log('Applied final accent fixes in public section');
