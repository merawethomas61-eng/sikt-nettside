// Felles ramme for de nye marketing-sidene: gjenbruker Navbar + Footer fra
// hoved-appen så alt matcher merkevaren (forsiden), og gir riktig topp-padding
// under den faste navbaren. Hver side legger sin egen <Seo/> som første child.
import React from 'react';
import { Navbar } from '../shared/Navbar';
import { Footer } from '../shared/Footer';

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen selection:bg-[#E9E4DA] selection:text-[#1A1A1A] bg-[#F2EFE8] relative overflow-x-hidden">
      <Navbar />
      <main className="relative z-10 pt-28 sm:pt-32">{children}</main>
      <Footer />
    </div>
  );
}

export default PageShell;
