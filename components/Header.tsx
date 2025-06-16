
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="mb-8 p-5 bg-slate-900/60 backdrop-blur-lg rounded-xl shadow-2xl shadow-black/30 border border-slate-700/50">
      <h1 className="text-4xl md:text-5xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-400 to-purple-400 py-2">
        <span className="text-glow-sky hover:text-glow-cyan transition-all duration-300">Service Outage</span> <span className="text-glow-purple">Mission Control</span>
      </h1>
      <p className="text-center text-sm text-slate-400 mt-2 tracking-wider">
        Real-time Simulated Overview of Critical Service Status
      </p>
    </header>
  );
};
