import fs from 'fs';

const path = 'App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const cutoff = 3756;

function softenGreen(text) {
  let out = text;

  // Remove light green washes — use neutral palette instead
  const neutralize = [
    ['bg-[rgba(82,164,71,0.08)]/60', 'bg-[#F5F5F0]'],
    ['bg-[rgba(82,164,71,0.08)]/40', 'bg-[#F5F5F0]'],
    ['bg-[rgba(82,164,71,0.12)]/40', 'bg-[#F5F5F0]'],
    ['bg-[rgba(82,164,71,0.08)]', 'bg-[#F5F5F0]'],
    ['bg-[rgba(82,164,71,0.12)]', 'bg-[#F5F5F0]'],
    ['bg-[rgba(82,164,71,0.15)]', 'bg-[#EBEBE6]'],
    ['border-[rgba(82,164,71,0.18)]', 'border-[#EBEBE6]'],
    ['border-[rgba(82,164,71,0.35)]', 'border-[#808080]'],
    ['decoration-[rgba(82,164,71,0.45)]', 'decoration-[#EBEBE6]'],
    ['hover:border-[rgba(82,164,71,0.35)]', 'hover:border-[#808080]'],
    ['hover:bg-[rgba(82,164,71,0.08)]', 'hover:bg-[#EBEBE6]'],
    ['from-[#F5F5F0] to-[rgba(82,164,71,0.06)]', 'from-[#F5F5F0] to-[#F5F5F0]'],
    ['bg-[#52A447]/40', 'bg-[#EBEBE6]'],
    ['bg-[#52A447]/30', 'bg-[#F5F5F0]'],
    ['bg-[#52A447]/20', 'bg-[#F5F5F0]'],
    ['bg-[#52A447]/10', 'bg-[#F5F5F0]'],
    ['bg-[#52A447]/5', 'bg-transparent'],
    ['shadow-[rgba(82,164,71,0.25)]', 'shadow-[rgba(26,26,26,0.12)]'],
    ['shadow-[rgba(82,164,71,0.2)]', 'shadow-[rgba(26,26,26,0.1)]'],
    ['hover:shadow-[rgba(82,164,71,0.35)]', 'hover:shadow-[rgba(26,26,26,0.12)]'],
    ['text-[#6bb85f]', 'text-[#808080]'],
    ['border-[#52A447]/30', 'border-[#EBEBE6]'],
    ['border-[#52A447]/40', 'border-[#EBEBE6]'],
    ['border-[#52A447]/20', 'border-[#EBEBE6]'],
    ['border-l-4 border-[#52A447]', 'border-l-4 border-[#1A1A1A]'],
    ['bg-[#52A447]/10 backdrop-blur-md', 'bg-[#F5F5F0]'],
  ];

  for (const [from, to] of neutralize) {
    out = out.split(from).join(to);
  }

  // Demote accent text — green reserved for CTAs + hero word (restored below)
  out = out.split('text-[#52A447]').join('text-[#1A1A1A]');

  // Decorative dots / chart fills in mockups
  out = out.split('bg-[#52A447] rounded-full').join('bg-[#808080] rounded-full');
  out = out.split('bg-[#52A447]"').join('bg-[#1A1A1A]"');
  out = out.split("bg-[#52A447]'").join("bg-[#1A1A1A]'");
  out = out.split('c: "bg-[#52A447]"').join('c: "bg-[#1A1A1A]"');

  // Nav / logo hovers: neutral instead of green flash
  out = out
    .split('[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[#52A447]')
    .join('[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[#1A1A1A]');
  out = out
    .split('[@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[#52A447]')
    .join('[@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[#1A1A1A]');

  // Active nav: neutral pill, not green wash
  out = out
    .split("currentView === 'dashboard' ? 'bg-[#F5F5F0] text-[#1A1A1A]'")
    .join("currentView === 'dashboard' ? 'bg-[#EBEBE6] text-[#1A1A1A]'");
  out = out
    .split("currentView === 'deepdive' ? 'text-[#1A1A1A]'")
    .join("currentView === 'deepdive' ? 'text-[#1A1A1A] font-black'");
  out = out
    .split("currentView === 'technology' ? 'text-[#1A1A1A]'")
    .join("currentView === 'technology' ? 'text-[#1A1A1A] font-black'");

  // Restore hero accent word only
  out = out.replace(
    /lowercase">automatisk\.<\/span>/,
    'lowercase text-[#52A447]">automatisk.</span>'
  );
  // Fix double class if re-run
  out = out.replace(
    'lowercase text-[#52A447] text-[#52A447]">automatisk.',
    'lowercase text-[#52A447]">automatisk.'
  );

  return out;
}

let publicPart = softenGreen(lines.slice(0, cutoff).join('\n'));
let tail = lines.slice(cutoff).join('\n');

tail = tail
  .split('selection:bg-[rgba(82,164,71,0.15)] selection:text-[#1A1A1A]')
  .join('selection:bg-[#EBEBE6] selection:text-[#1A1A1A]');

fs.writeFileSync(path, `${publicPart}\n${tail}`);
console.log('Softened green usage in public section');
