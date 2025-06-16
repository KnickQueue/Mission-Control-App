
import React from 'react';
import { Service, ServiceStatus } from '../types';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { RefreshCwIcon } from './icons/RefreshCwIcon';
import { HelpCircleIcon } from './icons/HelpCircleIcon';

interface ServiceStatusCardProps {
  service: Service;
  onRefresh: (serviceId: string) => void;
  isGeminiReady: boolean;
}

export const ServiceStatusCard: React.FC<ServiceStatusCardProps> = ({ service, onRefresh, isGeminiReady }) => {
  const getStatusClasses = () => {
    switch (service.status) {
      case ServiceStatus.OPERATIONAL:
        return {
          border: 'border-green-500/70',
          shadow: 'shadow-[0_0_15px_rgba(52,211,153,0.5)] hover:shadow-[0_0_20px_rgba(52,211,153,0.7)]',
          text: 'text-green-300',
          iconColor: 'text-green-400',
          detailsBg: 'bg-green-800/40',
        };
      case ServiceStatus.OUTAGE:
        return {
          border: 'border-red-500/70',
          shadow: 'shadow-[0_0_15px_rgba(248,113,113,0.5)] hover:shadow-[0_0_20px_rgba(248,113,113,0.7)]',
          text: 'text-red-300',
          iconColor: 'text-red-400',
          detailsBg: 'bg-red-800/40',
        };
      case ServiceStatus.CHECKING:
        return {
          border: 'border-yellow-500/70',
          shadow: 'shadow-[0_0_15px_rgba(250,204,21,0.5)] hover:shadow-[0_0_20px_rgba(250,204,21,0.7)]',
          text: 'text-yellow-300',
          iconColor: 'text-yellow-400',
          detailsBg: 'bg-yellow-800/40',
        };
      case ServiceStatus.UNKNOWN:
      default:
        return {
          border: 'border-slate-600/70',
          shadow: 'shadow-[0_0_10px_rgba(100,116,139,0.3)] hover:shadow-[0_0_15px_rgba(100,116,139,0.5)]',
          text: 'text-slate-400',
          iconColor: 'text-slate-500',
          detailsBg: 'bg-slate-800/40',
        };
    }
  };

  const statusStyle = getStatusClasses();

  const getStatusIcon = () => {
    const iconBaseClass = "w-7 h-7";
    switch (service.status) {
      case ServiceStatus.OPERATIONAL:
        return <CheckCircleIcon className={`${iconBaseClass} ${statusStyle.iconColor}`} />;
      case ServiceStatus.OUTAGE:
        return <XCircleIcon className={`${iconBaseClass} ${statusStyle.iconColor}`} />;
      case ServiceStatus.CHECKING:
        return <RefreshCwIcon className={`${iconBaseClass} ${statusStyle.iconColor} animate-spin`} />;
       case ServiceStatus.UNKNOWN:
        return <HelpCircleIcon className={`${iconBaseClass} ${statusStyle.iconColor}`} />;
      default:
        return null;
    }
  };

  return (
    <div 
        className={`p-5 rounded-xl transition-all duration-300 border ${statusStyle.border} ${statusStyle.shadow} flex flex-col justify-between min-h-[240px] bg-slate-800/70 hover:bg-slate-800/90 backdrop-blur-md group`}
    >
      <div>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-semibold text-sky-200 group-hover:text-sky-100 transition-colors">{service.name}</h3>
          {getStatusIcon()}
        </div>
        <p className={`text-sm font-medium mb-1 ${statusStyle.text}`}>
          Status: <span className="font-bold">{service.status.charAt(0) + service.status.slice(1).toLowerCase().replace('_', ' ')}</span>
        </p>
        {(service.status === ServiceStatus.OUTAGE || service.status === ServiceStatus.CHECKING || service.status === ServiceStatus.UNKNOWN) && service.details && (
          <div className={`mt-2 p-3 ${statusStyle.detailsBg} rounded-md text-xs backdrop-blur-sm`}>
            <p className={`font-semibold ${statusStyle.text}`}>{service.status === ServiceStatus.OUTAGE ? 'Details:' : service.status === ServiceStatus.CHECKING ? 'Status:' : 'Info:'}</p>
            <p className="text-slate-300">{service.details}</p>
          </div>
        )}
      </div>
      <div className="mt-auto pt-4">
        {service.lastChecked && (
          <p className="text-xs text-slate-500 mb-2 group-hover:text-slate-400 transition-colors">
            Last update: {service.lastChecked.toLocaleTimeString()}
          </p>
        )}
        <button
          onClick={() => onRefresh(service.id)}
          disabled={service.status === ServiceStatus.CHECKING || !isGeminiReady}
          className="w-full flex items-center justify-center px-3 py-2.5 text-sm bg-sky-700/80 hover:bg-sky-600/90 disabled:bg-slate-600/70 text-sky-100 font-medium rounded-lg shadow-md hover:shadow-sky-500/30 disabled:shadow-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-60"
          aria-label={`Refresh status for ${service.name}`}
        >
          <RefreshCwIcon className={`w-4 h-4 mr-2 ${service.status === ServiceStatus.CHECKING ? 'animate-spin' : ''}`} />
          {service.status === ServiceStatus.CHECKING ? 'Validating...' : 'Re-Validate'}
        </button>
      </div>
    </div>
  );
};
