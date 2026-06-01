import fs from 'fs';

const path = 'App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const cutoff = 3756;

function demoteDecorativeGreen(text) {
  let out = text;

  const repl = [
    ['focus:ring-[#52A447]', 'focus:ring-[#808080]/25'],
    ['border-2 border-[#52A447]', 'border-2 border-[#1A1A1A]'],
    ['border-[#52A447]', 'border-[#1A1A1A]'],
    ['w-1 h-1 rounded-full bg-[#52A447]', 'w-1 h-1 rounded-full bg-[#808080]'],
    ['w-2 h-2 bg-[#52A447] border-2', 'w-2 h-2 bg-[#1A1A1A] border-2'],
    ['h-full bg-[#52A447] animate-draw-line', 'h-full bg-[#1A1A1A] animate-draw-line'],
    ['w-11 h-11 sm:w-12 sm:h-12 bg-[#52A447] rounded-xl', 'w-11 h-11 sm:w-12 sm:h-12 bg-[#1A1A1A] rounded-xl'],
    ['w-16 h-16 sm:w-20 sm:h-20 bg-[#52A447] rounded-2xl', 'w-16 h-16 sm:w-20 sm:h-20 bg-[#1A1A1A] rounded-2xl'],
    ['w-10 h-10 bg-[#52A447] rounded-lg', 'w-10 h-10 bg-[#1A1A1A] rounded-lg'],
    ['? \'bg-[#52A447] border-[#52A447] text-white', '? \'bg-[#1A1A1A] border-[#1A1A1A] text-white'],
    ['circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#1A1A1A]"', 'circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#EBEBE6]"'],
  ];

  for (const [from, to] of repl) {
    out = out.split(from).join(to);
  }

  return out;
}

const publicPart = demoteDecorativeGreen(lines.slice(0, cutoff).join('\n'));
fs.writeFileSync(path, `${publicPart}\n${lines.slice(cutoff).join('\n')}`);
console.log('Demoted decorative green accents');
