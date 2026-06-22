import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Linkedin, Twitter } from 'lucide-react';
import { companyInfo, copyrightLine } from './companyInfo';

const Footer = ({ onNavigate }: { onNavigate?: (view: string) => void }) => (
  <footer className="bg-[#1A1A1A] text-white py-16 sm:py-20 border-t border-slate-900 overflow-hidden relative text-center">
    <div className="max-w-6xl mx-auto px-5 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 sm:gap-12 mb-16 sm:mb-20">
        <div className="md:col-span-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#1A1A1A] font-black text-xl">S</div>
            <span className="text-2xl font-black tracking-tight">Sikt</span>
          </div>
          <p className="text-[#808080] font-medium max-w-sm leading-relaxed mb-8 mx-auto md:mx-0 text-sm">
            Mange bedrifter gjetter på hvordan de blir synlige på Google. Vi bruker AI til å gi deg en konkret oppskrift på å nå toppen, slik at du får trafikken og veksten du fortjener.
          </p>
          <a href={`mailto:${companyInfo.supportEmail}`} className="inline-flex items-center justify-center md:justify-start gap-3 text-[#808080] transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">
            <Mail size={16} className="text-[#1A1A1A]" />
            <span className="font-bold text-xs">{companyInfo.supportEmail}</span>
          </a>
          {companyInfo.address && (
            <p className="mt-3 text-[#808080] font-bold text-xs">{companyInfo.address}</p>
          )}
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#808080] mb-6 sm:mb-8">Selskap</h4>
          <ul className="space-y-3 sm:space-y-4 text-[#808080] font-bold text-sm">
            <li><Link to="/funksjoner" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">Funksjoner</Link></li>
            <li><Link to="/priser" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">Priser</Link></li>
            <li><Link to="/blogg" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">Blogg</Link></li>
            <li><Link to="/om-oss" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">Om Sikt</Link></li>
            <li><Link to="/kontakt" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">Kontakt</Link></li>
          </ul>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#808080] mb-6 sm:mb-8">Kontakt</h4>
          <div className="flex justify-center md:justify-start gap-4 text-[#808080]">
            <Linkedin size={20} className="cursor-pointer transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]" />
            <Twitter size={20} className="cursor-pointer transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]" />
          </div>
        </div>
      </div>
      <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#808080] text-center">
        <p>{copyrightLine}. NORSK DESIGN.</p>
        <div className="flex gap-6 sm:gap-10">
          <Link
            to="/personvern"
            className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] uppercase tracking-widest [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:text-white/90"
          >
            Personvern
          </Link>
          <Link
            to="/vilkar"
            className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] uppercase tracking-widest [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:text-white/90"
          >
            Vilkår
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

export { Footer };
