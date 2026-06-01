import fs from 'fs';

const path = 'App.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
const cutoff = 3756;

function fixSection(text) {
  // Fix corrupted substring replacements (bg-violet-50 matched inside bg-violet-500)
  const corruptFixes = [
    ['bg-[rgba(82,164,71,0.08)]0/40', 'bg-[#52A447]/40'],
    ['bg-[rgba(82,164,71,0.08)]0/30', 'bg-[#52A447]/30'],
    ['bg-[rgba(82,164,71,0.08)]0/20', 'bg-[rgba(82,164,71,0.15)]'],
    ['bg-[rgba(82,164,71,0.08)]0/10', 'bg-[#52A447]/10'],
    ['bg-[rgba(82,164,71,0.08)]0/5', 'bg-[#52A447]/5'],
    ['bg-[rgba(82,164,71,0.08)]0', 'bg-[#52A447]'],
    ['hover:bg-[rgba(82,164,71,0.08)]0', 'hover:bg-[#458a3c]'],
  ];

  let out = text;
  for (const [from, to] of corruptFixes) {
    out = out.split(from).join(to);
  }

  // Longer patterns first to avoid substring bugs
  const repl = [
    ['enabled:hover:bg-violet-700', 'enabled:hover:bg-[#458a3c]'],
    ['hover:bg-emerald-700', 'hover:bg-[#458a3c]'],
    ['focus:ring-violet-600', 'focus:ring-[#52A447]'],
    ['hover:border-violet-300', 'hover:border-[rgba(82,164,71,0.35)]'],
    ['hover:border-violet-200', 'hover:border-[rgba(82,164,71,0.18)]'],
    ['border-violet-600', 'border-[#52A447]'],
    ['border-violet-500', 'border-[#52A447]'],
    ['border-violet-200', 'border-[rgba(82,164,71,0.18)]'],
    ['border-violet-100', 'border-[rgba(82,164,71,0.12)]'],
    ['bg-violet-100', 'bg-[rgba(82,164,71,0.12)]'],
    ['text-violet-400', 'text-[#52A447]'],
    ['text-violet-300', 'text-[#6bb85f]'],
    ['decoration-violet-300', 'decoration-[rgba(82,164,71,0.45)]'],
    ['bg-slate-800', 'bg-[#1A1A1A]'],
    ['border-slate-800', 'border-[#EBEBE6]'],
    ['text-slate-50', 'text-[#F5F5F0]'],
    ['bg-slate-800', 'bg-[#1A1A1A]'],
    ['border-t-slate-800', 'border-t-[#1A1A1A]'],
    ['bg-slate-400', 'bg-[#808080]'],
    ['bg-slate-300', 'bg-[#EBEBE6]'],
    ['bg-slate-300/50', 'bg-[#EBEBE6]/50'],
    ['decoration-slate-300', 'decoration-[#EBEBE6]'],
    ['ring-slate-50', 'ring-[#F5F5F0]'],
    ['text-slate-200', 'text-[#EBEBE6]'],
    ['text-slate-100', 'text-[#F5F5F0]'],
    ['bg-slate-600', 'bg-[#808080]'],
    ['bg-slate-700/70', 'bg-[#1A1A1A]/70'],
    ['border-emerald-300', 'border-[rgba(82,164,71,0.35)]'],
    ['bg-emerald-400', 'bg-[#52A447]'],
    ['text-emerald-400', 'text-[#52A447]'],
    ['from-slate-50 to-violet-50', 'from-[#F5F5F0] to-[rgba(82,164,71,0.06)]'],
    ['bg-[#fcfcfd]', 'bg-[#F5F5F0]'],
    ['selection:bg-violet-100 selection:text-violet-900', 'selection:bg-[rgba(82,164,71,0.15)] selection:text-[#1A1A1A]'],
  ];

  for (const [from, to] of repl) {
    out = out.split(from).join(to);
  }

  return out;
}

const publicPart = fixSection(lines.slice(0, cutoff).join('\n'));
const rest = lines.slice(cutoff);

// Fix main public shell wrapper (after cutoff, but still public)
let tail = rest.join('\n');
tail = tail
  .split('min-h-screen selection:bg-violet-100 selection:text-violet-900 bg-[#fcfcfd]')
  .join('min-h-screen selection:bg-[rgba(82,164,71,0.15)] selection:text-[#1A1A1A] bg-[#F5F5F0]');

fs.writeFileSync(path, `${publicPart}\n${tail}`);
console.log('Fixed corrupted classes and applied additional palette substitutions');
