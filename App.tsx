
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ServiceStatusCard } from './components/ServiceStatusCard';
import { DownDetectorPanel } from './components/DownDetectorPanel';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Service, ServiceStatus } from './types';
import { GeminiService } from './services/geminiService';
import { RefreshCwIcon } from './components/icons/RefreshCwIcon';

const CORE_SERVICES = ['AWS', 'Proofpoint', 'Office 365'];
const TOTAL_ADDITIONAL_SERVICES = 7;
const AUTO_REFRESH_INTERVAL = 360000; // 6 minutes (was 300000 / 5 minutes)
const DD_AUTO_REFRESH_CYCLE_MODULO = 3; // DownDetector auto-refreshes every Nth main cycle

const App: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [geminiServiceInstance, setGeminiServiceInstance] = useState<GeminiService | null>(null);
  const [downDetectorRefreshNonce, setDownDetectorRefreshNonce] = useState<number>(0);
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState<number>(AUTO_REFRESH_INTERVAL / 1000);
  const [autoRefreshCycleCount, setAutoRefreshCycleCount] = useState<number>(0);

  const refreshIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (process.env.API_KEY) {
        setGeminiServiceInstance(new GeminiService(process.env.API_KEY));
      } else {
        setError("API_KEY environment variable not set. Please set it to use Gemini features.");
        setIsLoadingServices(false);
      }
    } catch (e) {
      console.error("Failed to initialize Gemini Service:", e);
      setError(`Failed to initialize Gemini Service: ${e instanceof Error ? e.message : String(e)}`);
      setIsLoadingServices(false);
    }
  }, []);

  const fetchServiceData = useCallback(async (gemini: GeminiService, isBackground: boolean = false) => {
    if (!isBackground) {
      setIsLoadingServices(true);
    } else {
      setIsBackgroundRefreshing(true);
    }
    // setError(null); // Keep previous error visible until new data/error comes

    try {
      const currentServiceNames = services.length > 0 ? services.map(s => s.name) : CORE_SERVICES;
      const serviceNamesToFetch = services.length > 0 
        ? currentServiceNames 
        : [...CORE_SERVICES, ...(await gemini.fetchAdditionalServiceNames(CORE_SERVICES, TOTAL_ADDITIONAL_SERVICES))];

      const servicePromises = serviceNamesToFetch.map(async (name, index) => {
        const existingService = services.find(s => s.name === name);
        const id = existingService?.id || `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`; 

        const isCurrentlyOperational = existingService ? existingService.status === ServiceStatus.OPERATIONAL : Math.random() > 0.15;
        const shouldSimulateChange = Math.random() < 0.2; 
        
        let newStatus: ServiceStatus;
        if (isBackground && shouldSimulateChange) {
            newStatus = isCurrentlyOperational ? ServiceStatus.OUTAGE : ServiceStatus.OPERATIONAL;
        } else if (isBackground) {
            newStatus = existingService?.status || (isCurrentlyOperational ? ServiceStatus.OPERATIONAL : ServiceStatus.OUTAGE);
        }
        else { 
            newStatus = isCurrentlyOperational ? ServiceStatus.OPERATIONAL : ServiceStatus.OUTAGE;
        }
        
        let details: string | null = null;
        if (newStatus === ServiceStatus.OUTAGE) {
          try {
            details = await gemini.fetchOutageDetails(name);
          } catch (detailError) {
            console.error(`Failed to fetch details for ${name}:`, detailError);
            if (detailError instanceof Error && (detailError.message.includes("API Rate Limit") || detailError.message.includes("429") || detailError.message.includes("RESOURCE_EXHAUSTED"))) {
              setError(detailError.message); // Propagate rate limit error to main display
            }
            details = "Could not retrieve specific outage details due to an error.";
          }
        }
        
        return {
          id,
          name,
          status: newStatus,
          details,
          lastChecked: new Date(),
        };
      });

      const resolvedServices = await Promise.all(servicePromises);
      setServices(resolvedServices);
      setError(null); // Clear previous errors if this part succeeds

    } catch (err) {
      console.error('Failed to fetch service data:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to load service data. ${errorMessage}`);
      if (!isBackground && services.length === 0) { 
        setServices(CORE_SERVICES.map((name, index) => ({
          id: `${name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          name,
          status: ServiceStatus.UNKNOWN,
          details: 'Failed to fetch initial status.',
          lastChecked: new Date(),
        })));
      }
    } finally {
      if (!isBackground) {
        setIsLoadingServices(false);
      }
      setIsBackgroundRefreshing(false);
    }
  }, [services]); // services dependency is important here for existingService logic

  useEffect(() => {
    if (geminiServiceInstance && services.length === 0 && isLoadingServices) { 
      fetchServiceData(geminiServiceInstance, false);
    }
  }, [geminiServiceInstance, fetchServiceData, services.length, isLoadingServices]);

  const handleManualRefreshAll = () => {
    if (geminiServiceInstance) {
      fetchServiceData(geminiServiceInstance, false); 
      setDownDetectorRefreshNonce(prev => prev + 1); // Refresh DD on manual refresh
      resetCountdown();
      setAutoRefreshCycleCount(0); // Reset cycle count for DD
    } else {
       setError("Gemini service not available to refresh all services.");
    }
  };

  const resetCountdown = useCallback(() => {
    setNextRefreshCountdown(AUTO_REFRESH_INTERVAL / 1000);
  }, []);

  useEffect(() => {
    if (!geminiServiceInstance || !process.env.API_KEY) return;

    const performAutoRefresh = () => {
      if (document.hidden) return; 
      
      fetchServiceData(geminiServiceInstance, true); 

      const newCycleCount = autoRefreshCycleCount + 1;
      setAutoRefreshCycleCount(newCycleCount);

      if (newCycleCount % DD_AUTO_REFRESH_CYCLE_MODULO === 0) {
        setDownDetectorRefreshNonce(prev => prev + 1);
      }
    };

    refreshIntervalRef.current = window.setInterval(performAutoRefresh, AUTO_REFRESH_INTERVAL);
    
    resetCountdown();
    countdownIntervalRef.current = window.setInterval(() => {
      setNextRefreshCountdown(prev => (prev > 0 ? prev - 1 : AUTO_REFRESH_INTERVAL / 1000));
    }, 1000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [geminiServiceInstance, fetchServiceData, resetCountdown, autoRefreshCycleCount]);


  const handleRefreshSingleService = useCallback(async (serviceId: string) => {
    if (!geminiServiceInstance) {
      setError("Gemini service not available for refresh.");
      return;
    }

    const serviceToRefresh = services.find(s => s.id === serviceId);
    if (!serviceToRefresh) return;

    setServices(prevServices =>
      prevServices.map(s =>
        s.id === serviceId ? { ...s, status: ServiceStatus.CHECKING, details: 'Re-validating status...' } : s
      )
    );

    try {
      const shouldFlipStatus = Math.random() < 0.3;
      let newStatus = serviceToRefresh.status;
      
      if (serviceToRefresh.status === ServiceStatus.UNKNOWN) { 
          newStatus = Math.random() < 0.2 ? ServiceStatus.OUTAGE : ServiceStatus.OPERATIONAL;
      } else if (shouldFlipStatus) {
        newStatus = serviceToRefresh.status === ServiceStatus.OPERATIONAL ? ServiceStatus.OUTAGE : ServiceStatus.OPERATIONAL;
      }

      let newDetails: string | null = null;
      if (newStatus === ServiceStatus.OUTAGE) {
         newDetails = await geminiServiceInstance.fetchOutageDetails(serviceToRefresh.name);
      }

      setServices(prevServices =>
        prevServices.map(s =>
          s.id === serviceId
            ? { ...s, status: newStatus, details: newDetails, lastChecked: new Date() }
            : s
        )
      );
      setError(null); // Clear previous error if this single refresh is successful
    } catch (err) {
      console.error(`Failed to refresh service ${serviceToRefresh.name}:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Display the error, potentially overwriting a general rate limit error if this specific call also hits one
      setError(`Error refreshing ${serviceToRefresh.name}: ${errorMessage}`); 
      setServices(prevServices =>
        prevServices.map(s =>
          s.id === serviceId
            ? { ...s, status: ServiceStatus.UNKNOWN, details: `Error refreshing: ${errorMessage.substring(0, 100)}...`, lastChecked: new Date() }
            : s
        )
      );
    }
  }, [geminiServiceInstance, services]);
  
  if (!process.env.API_KEY && !geminiServiceInstance && !isLoadingServices) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-900/70 border border-red-700 text-red-200 p-8 rounded-xl shadow-2xl shadow-red-900/50 max-w-lg text-center backdrop-blur-md">
          <h2 className="text-3xl font-bold mb-6 text-red-300 text-glow-red">API Key Configuration Error</h2>
          <p className="text-lg mb-4">The Gemini API key (process.env.API_KEY) is not configured or is invalid.</p>
          <p className="text-md">This application requires a valid API key to function. Please ensure the <code className="bg-slate-700 p-1 rounded text-sm">API_KEY</code> environment variable is correctly set up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6">
      <Header />
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-sky-400">
          Core services auto-refresh in: <span className="font-semibold text-cyan-300 tabular-nums">{Math.floor(nextRefreshCountdown / 60)}m {nextRefreshCountdown % 60}s</span>
          {isBackgroundRefreshing && <span className="ml-2 text-yellow-400">(Refreshing core services...)</span>}
        </div>
        <button
          onClick={handleManualRefreshAll}
          disabled={isLoadingServices || !geminiServiceInstance || isBackgroundRefreshing}
          className="flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:shadow-sky-500/40 disabled:opacity-60 disabled:shadow-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
          aria-label="Refresh all service statuses and global scanner"
        >
          <RefreshCwIcon className={`w-5 h-5 mr-2 ${(isLoadingServices && !isBackgroundRefreshing) || (isBackgroundRefreshing && services.length === 0) ? 'animate-spin' : ''}`} />
          Refresh All Now
        </button>
      </div>

      {error && !isLoadingServices && (
         <div className="bg-red-900/50 border border-red-700/70 text-red-200 p-4 rounded-lg shadow-xl shadow-red-900/30 mb-6 backdrop-blur-sm">
          <p className="font-bold text-red-300">System Alert:</p>
          <p>{error}</p>
        </div>
      )}

      {isLoadingServices && !services.length ? (
        <div className="flex flex-col justify-center items-center h-64 text-center">
          <LoadingSpinner size={12} color="text-cyan-400" />
          <p className="mt-4 text-xl text-sky-300 text-glow-sky">Initializing Mission Control Systems...</p>
          <p className="text-sm text-slate-400">Please stand by.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="monitored-services-heading" className="mb-8">
            <h2 id="monitored-services-heading" className="text-3xl font-semibold text-sky-300 mb-6 border-b-2 border-sky-500/50 pb-3 text-glow-sky">
              Core Systems Monitor
            </h2>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                {services.map(service => (
                  <ServiceStatusCard
                    key={service.id}
                    service={service}
                    onRefresh={handleRefreshSingleService}
                    isGeminiReady={!!geminiServiceInstance}
                  />
                ))}
              </div>
            ) : (
              !isLoadingServices && <p className="text-slate-400">No services currently configured for monitoring. System may be initializing or encountered an issue.</p>
            )}
            
          </section>
          
          {geminiServiceInstance && (
            <DownDetectorPanel 
              geminiService={geminiServiceInstance} 
              refreshNonce={downDetectorRefreshNonce} 
            />
          )}
        </>
      )}
    </div>
  );
};

export default App;
