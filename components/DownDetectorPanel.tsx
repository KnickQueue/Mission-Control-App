
import React, { useState, useEffect, useCallback } from 'react';
import { GeminiService } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon'; // Using this for general "scan"
import { GroundingChunk } from '../types';

interface DownDetectorPanelProps {
  geminiService: GeminiService;
  refreshNonce: number; // Used to trigger refresh from parent
}

export const DownDetectorPanel: React.FC<DownDetectorPanelProps> = ({ geminiService, refreshNonce }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDownDetectorData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    // Keep previous summary visible while loading new, or clear it:
    // setSummary(null); 
    // setSources([]);
    try {
      const result = await geminiService.fetchDownDetectorSummaryWithSearch();
      if (typeof result.summary === 'string') {
         setSummary(result.summary);
      } else if (result.summary === null || result.summary === undefined) {
         setSummary("No global outage summary available at this moment.");
      }
      else {
         setSummary("Received unexpected summary format. Displaying raw data: " + JSON.stringify(result.summary));
      }
      setSources(result.sources || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch Down Detector summary:', err);
      setError(`Failed to load Global Outage Scanner data. ${err instanceof Error ? err.message : String(err)}`);
      setSummary("Could not load current global outage reports.");
    } finally {
      setIsLoading(false);
    }
  }, [geminiService]);

  useEffect(() => {
    fetchDownDetectorData();
  }, [fetchDownDetectorData, refreshNonce]); // Re-fetch when refreshNonce changes

  return (
    <section aria-labelledby="downdetector-heading" className="bg-slate-800/60 backdrop-blur-md border border-sky-700/40 p-6 rounded-xl shadow-2xl shadow-black/30">
      <div className="flex justify-between items-center mb-4">
        <h2 id="downdetector-heading" className="text-2xl font-semibold text-cyan-300 text-glow-cyan border-b-2 border-cyan-500/60 pb-2 flex items-center">
          <AlertTriangleIcon className="w-7 h-7 mr-3 text-cyan-400" />
          Global Outage Scanner
        </h2>
        {isLoading && <LoadingSpinner size={6} color="text-cyan-400" />}
      </div>
      
      {error && !isLoading && (
        <div className="text-red-300 bg-red-900/60 p-4 rounded-md border border-red-700/50">
          <p className="font-semibold text-red-200">Scanner Error:</p>
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && summary && (
        <div className="text-slate-200 space-y-4">
          <p className="whitespace-pre-wrap leading-relaxed text-sm">{summary}</p>
          {sources.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-700/70">
              <h3 className="text-sm font-semibold text-sky-400 mb-2">Corroborating Intel (via Google Search):</h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs pl-2">
                {sources.map((source, index) => (
                  <li key={index} className="text-sky-500 hover:text-sky-300 transition-colors">
                    <a
                      href={source.web?.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={source.web?.title}
                      className="hover:underline focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-0.5 py-0.5"
                    >
                      {source.web?.title || source.web?.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
       {!isLoading && !error && !summary && (
         <p className="text-slate-400">No significant widespread disruptions detected by the scanner.</p>
       )}
        {lastUpdated && !isLoading && (
          <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-700/50">
            Scanner last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
    </section>
  );
};
