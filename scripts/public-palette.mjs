import fs from 'fs';

const path = 'App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const cutoff = 3756;
const publicLines = lines.slice(0, cutoff);
const rest = lines.slice(cutoff);
const repl = [
  ['text-slate-950', 'text-[#1A1A1A]'],
  ['text-slate-900', 'text-[#1A1A1A]'],
  ['text-slate-800', 'text-[#1A1A1A]'],
  ['text-slate-700', 'text-[#1A1A1A]'],
  ['text-slate-600', 'text-[#808080]'],
  ['text-slate-500', 'text-[#808080]'],
  ['text-slate-400', 'text-[#808080]'],
  ['text-slate-300', 'text-[#808080]'],
  ['bg-slate-950', 'bg-[#1A1A1A]'],
  ['bg-slate-900', 'bg-[#1A1A1A]'],
  ['border-slate-200', 'border-[#EBEBE6]'],
  ['border-slate-100', 'border-[#EBEBE6]'],
  ['border-slate-50', 'border-[#EBEBE6]'],
  ['bg-slate-50', 'bg-[#F5F5F0]'],
  ['bg-slate-100', 'bg-[#F5F5F0]'],
  ['hover:bg-slate-50', 'hover:bg-[#F5F5F0]'],
  ['text-violet-700', 'text-[#52A447]'],
  ['text-violet-600', 'text-[#52A447]'],
  ['text-violet-500', 'text-[#52A447]'],
  ['hover:text-violet-700', 'hover:text-[#52A447]'],
  ['hover:text-violet-600', 'hover:text-[#52A447]'],
  ['hover:text-violet-500', 'hover:text-[#52A447]'],
  ['bg-violet-600', 'bg-[#52A447]'],
  ['hover:bg-violet-600', 'hover:bg-[#52A447]'],
  ['border-violet-100', 'border-[#EBEBE6]'],
  ['bg-violet-50', 'bg-[rgba(82,164,71,0.08)]'],
  ['text-emerald-600', 'text-[#52A447]'],
  ['text-emerald-500', 'text-[#52A447]'],
  ['bg-emerald-600', 'bg-[#52A447]'],
  ['bg-emerald-500', 'bg-[#52A447]'],
  ['bg-emerald-50', 'bg-[rgba(82,164,71,0.08)]'],
  ['border-emerald-100', 'border-[rgba(82,164,71,0.18)]'],
  ['text-blue-600', 'text-[#52A447]'],
  ['bg-blue-600', 'bg-[#52A447]'],
  ['shadow-slate-200', 'shadow-[rgba(26,26,26,0.08)]'],
  ['hover:shadow-violet-500/30', 'hover:shadow-[rgba(82,164,71,0.25)]'],
  ['hover:shadow-violet-500/20', 'hover:shadow-[rgba(82,164,71,0.2)]'],
  ['bg-slate-200', 'bg-[#EBEBE6]'],
  ['divide-slate-200', 'divide-[#EBEBE6]'],
  ['ring-slate-200', 'ring-[#EBEBE6]'],
];

let out = publicLines.join('\n');
for (const [from, to] of repl) {
  out = out.split(from).join(to);
}

fs.writeFileSync(path, `${out}\n${rest.join('\n')}`);
console.log(`Updated public section lines 1-${cutoff}`);
