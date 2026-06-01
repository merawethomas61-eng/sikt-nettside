import fs from 'fs';

const path = 'App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const cutoff = 3756;

const G = '#3F8F38';
const G_BG = 'rgba(63,143,56,0.09)';
const G_BORDER = 'rgba(63,143,56,0.18)';

const homeRanges = [
  [815, 850],
  [852, 1085],
  [1715, 1791],
  [1792, 1851],
  [1852, 2002],
  [2003, 2148],
  [2418, 2448],
  [2449, 2546],
  [2547, 2635],
  [2636, 2712],
  [2713, 2786],
  [2787, 2878],
  [2879, 3001],
];

function inHome(lineNum) {
  return homeRanges.some(([a, b]) => lineNum >= a && lineNum <= b);
}

function fixPublicButtons(text) {
  let out = text;
  const repl = [
    ['[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#52A447]', '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700'],
    ['hover:bg-[#52A447]', 'hover:bg-violet-700'],
    ['enabled:hover:bg-[#458a3c]', 'enabled:hover:bg-violet-600'],
    ['hover:bg-[#458a3c]', 'hover:bg-violet-600'],
    ['[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1A1A1A]', '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700'],
    ['hover:bg-[#1A1A1A]"', 'hover:bg-violet-700"'],
    ['? \'bg-[#52A447] hover:bg-[#458a3c] text-white\'', '? \'bg-violet-700 hover:bg-violet-600 text-white\''],
    ['w-full py-5 bg-[#52A447] text-white rounded-xl', 'w-full py-5 bg-violet-700 text-white rounded-xl'],
    ['px-10 py-5 bg-[#52A447] text-white rounded-full', 'px-10 py-5 bg-violet-700 text-white rounded-full'],
    ['[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[#1A1A1A]', '[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700'],
    ['[@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[#1A1A1A]', '[@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700'],
    ['hover:shadow-[rgba(26,26,26,0.12)]', 'hover:shadow-violet-500/20'],
    ['hover:shadow-[rgba(26,26,26,0.1)]', 'hover:shadow-violet-500/20'],
  ];
  for (const [from, to] of repl) out = out.split(from).join(to);
  return out;
}

function applyHomeGreen(line) {
  let l = line;

  l = l.replace(/text-\[#52A447\]/g, `text-[${G}]`);
  l = l.replace(/text-\[#1A1A1A\]/g, (match, offset, str) => {
    const ctx = str.slice(Math.max(0, offset - 40), offset + 80);
    if (
      ctx.includes('SearchIcon') ||
      ctx.includes('TrendingUp size={48}') ||
      ctx.includes('Markedsledende') ||
      ctx.includes('Bare gjøremål') ||
      ctx.includes('Vi snakker norsk') ||
      ctx.includes('MessageCircle className') ||
      ctx.includes('TrendingUp className') ||
      ctx.includes('Activity className') ||
      ctx.includes('FileText className') ||
      ctx.includes('Sparkles className') ||
      ctx.includes('font-bold">#') ||
      ctx.includes('SEO-byrå Oslo') ||
      ctx.includes('Jobber nå') ||
      ctx.includes('Zap size') ||
      ctx.includes('Target size') ||
      ctx.includes('Sparkles size={16}') ||
      ctx.includes('Check className') ||
      ctx.includes('CheckCircle2') ||
      ctx.includes('CheckCircle size') ||
      ctx.includes('Premium') && ctx.includes('uppercase')
    ) {
      return `text-[${G}]`;
    }
    return match;
  });

  l = l.replace(
    "kpi.g.startsWith('+') ? 'bg-[#F5F5F0] text-[#1A1A1A]'",
    `kpi.g.startsWith('+') ? 'bg-[${G_BG}] text-[${G}]'`
  );
  l = l.replace('c: "text-[#1A1A1A]", g: "+', `c: "text-[${G}]", g: "+`);
  l = l.replace(
    'strokeDashoffset="30" />',
    'strokeDashoffset="30" className="text-[#3F8F38]" />'.replace('className="text-[#EBEBE6]" strokeDasharray="200" strokeDashoffset="30" className="text-[#3F8F38]"', 'className="text-[#3F8F38]" strokeDasharray="200" strokeDashoffset="30"')
  );
  if (l.includes('strokeDasharray="200" strokeDashoffset="30"')) {
    l = l.replace('className="text-[#EBEBE6]" strokeDasharray="200" strokeDashoffset="30"', `className="text-[${G}]" strokeDasharray="200" strokeDashoffset="30"`);
  }
  l = l.replace('h-full bg-[#1A1A1A] rounded-full" style={{ width:', `h-full bg-[${G}] rounded-full" style={{ width:`);
  l = l.replace('rounded-full bg-[#1A1A1A]"></div> Fra Google', `rounded-full bg-[${G}]"></div> Fra Google`);
  l = l.replace('w-2 h-2 bg-[#1A1A1A] border-2 border-white rounded-full z-20', `w-2 h-2 bg-[${G}] border-2 border-white rounded-full z-20`);
  l = l.replace('c: "bg-[#1A1A1A]"', `c: "bg-[${G}]"`);
  l = l.replace(
    "i === 0 ? 'bg-[#F5F5F0] text-[#1A1A1A]'",
    `i === 0 ? 'bg-[${G_BG}] text-[${G}]'`
  );
  l = l.replace(
    'px-2 py-0.5 bg-[#F5F5F0] rounded-full border border-[#EBEBE6]',
    `px-2 py-0.5 bg-[${G_BG}] rounded-full border border-[${G_BORDER}]`
  );
  l = l.replace('w-1.5 h-1.5 bg-[#808080] rounded-full animate-pulse"></div> Jobber', `w-1.5 h-1.5 bg-[${G}] rounded-full animate-pulse"></div> Jobber`);
  l = l.replace(
    'rounded-full bg-[#F5F5F0] text-[#1A1A1A] text-[9px]',
    `rounded-full bg-[${G_BG}] text-[${G}] text-[9px]`
  );
  l = l.replace(
    'rounded-full bg-[#F5F5F0] text-[#1A1A1A] text-[10px]',
    `rounded-full bg-[${G_BG}] text-[${G}] text-[10px]`
  );
  l = l.replace('border-l-4 border-[#1A1A1A]', `border-l-4 border-[${G}]`);
  l = l.replace(
    'inline-block p-3 sm:p-4 bg-[#F5F5F0] border-l-4',
    `inline-block p-3 sm:p-4 bg-[${G_BG}] border-l-4`
  );
  l = l.replace(
    'rounded-lg sm:rounded-xl bg-[#F5F5F0] flex items-center justify-center text-[#1A1A1A]',
    `rounded-lg sm:rounded-xl bg-[${G_BG}] flex items-center justify-center text-[${G}]`
  );
  l = l.replace(
    'rounded-xl sm:rounded-2xl bg-[#F5F5F0] flex items-center justify-center text-[#1A1A1A]',
    `rounded-xl sm:rounded-2xl bg-[${G_BG}] flex items-center justify-center text-[${G}]`
  );
  l = l.replace(
    'rounded-2xl bg-[#F5F5F0] flex items-center justify-center text-[#1A1A1A]',
    `rounded-2xl bg-[${G_BG}] flex items-center justify-center text-[${G}]`
  );
  l = l.replace(
    '[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white',
    `[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[${G}] [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white`
  );
  l = l.replace(
    'text-[10px] font-bold text-[#1A1A1A] bg-[#F5F5F0] px-2 py-1 rounded-md',
    `text-[10px] font-bold text-[${G}] bg-[${G_BG}] px-2 py-1 rounded-md`
  );
  l = l.replace('text-[#1A1A1A] font-bold">#', `text-[${G}] font-bold">#`);
  l = l.replace(
    '<span className="text-[#1A1A1A]">Markedsledende.</span>',
    `<span className="text-[${G}]">Markedsledende.</span>`
  );
  l = l.replace(
    '<span className="text-[#1A1A1A]">Bare gjøremål.</span>',
    `<span className="text-[${G}]">Bare gjøremål.</span>`
  );
  l = l.replace(
    '<span className="text-[#1A1A1A]">Vi snakker norsk.</span>',
    `<span className="text-[${G}]">Vi snakker norsk.</span>`
  );
  l = l.replace('decoration-[#EBEBE6]', `decoration-[${G_BORDER}]`);
  l = l.replace(
    'text-4xl sm:text-5xl md:text-7xl font-black text-[#1A1A1A] shrink-0">95%',
    `text-4xl sm:text-5xl md:text-7xl font-black text-[${G}] shrink-0">95%`
  );

  // Premium badges on homepage: violet like before, not black
  l = l.replace(
    'rounded-full bg-[#1A1A1A] text-white text-[8px]',
    'rounded-full bg-violet-700 text-white text-[8px]'
  );
  l = l.replace(
    'rounded-full bg-[#1A1A1A] text-white text-[10px] sm:text-xs font-black px-2.5',
    'rounded-full bg-violet-700 text-white text-[10px] sm:text-xs font-black px-2.5'
  );
  l = l.replace(
    'rounded-full bg-[#1A1A1A] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase',
    'rounded-full bg-violet-700 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase'
  );
  l = l.replace(
    'bg-[#1A1A1A] text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-bl-xl',
    'bg-violet-700 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-bl-xl'
  );
  l = l.replace(
    "plan.highlighted ? 'border-[#1A1A1A] shadow-violet-200/50",
    "plan.highlighted ? 'border-violet-400 shadow-violet-200/50"
  );
  l = l.replace(
    "isDone ? 'bg-[#1A1A1A]' : isActive ? 'bg-white border-2 border-[#1A1A1A]'",
    "isDone ? 'bg-[#3F8F38]' : isActive ? 'bg-white border-2 border-violet-600'"
  );
  l = l.replace(
    "? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-lg'",
    "? 'bg-violet-700 border-violet-700 text-white shadow-lg'"
  );

  // Final CTA checks on violet bg
  l = l.replace('<Check size={16} className="text-[#808080]" />', '<Check size={16} className="text-violet-300" />');

  return l;
}

const out = lines.map((line, idx) => {
  const lineNum = idx + 1;
  if (lineNum > cutoff) return line;
  let next = fixPublicButtons(line);
  if (inHome(lineNum)) next = applyHomeGreen(next);
  return next;
});

fs.writeFileSync(path, out.join('\n'));
console.log('Restored violet buttons + balanced homepage green');
