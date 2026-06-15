import React from 'react';
import { createRoot } from 'react-dom/client';
import { JourneyTimeline } from './JourneyTimeline';
import './index.css';

function App() {
  return (
    <div style={{ display: 'flex', gap: 20, padding: 24, flexWrap: 'wrap', alignItems: 'flex-start', background: '#1e293b', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 380, background: '#f1f5f9', borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontFamily: 'system-ui', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Light</h2>
        <JourneyTimeline theme="light" onDismiss={() => alert('Lukk')} />
      </div>
      <div style={{ flex: 1, minWidth: 380, background: '#0b1120', borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontFamily: 'system-ui', fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Dark</h2>
        <JourneyTimeline theme="dark" onDismiss={() => alert('Lukk')} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
