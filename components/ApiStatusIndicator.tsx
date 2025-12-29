import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { apiIntegrationService, ApiHealthStatus, CircuitBreakerState } from '../services/apiIntegrationService';

// Redefine locally to match usage
interface ServiceStatus {
  name: string;
  priority: string;
  health: ApiHealthStatus;
  rateLimitUsage: number;
  circuitBreakerState: CircuitBreakerState;
  creditsRemaining?: number;
  queueLength: number;
}

interface ApiStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
}

export const ApiStatusIndicator: React.FC<ApiStatusIndicatorProps> = ({
  compact = false,
  showDetails = false
}) => {
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [queueStats, setQueueStats] = useState({
    totalQueued: 0,
    byPriority: { high: 0, medium: 0, low: 0 },
    averageWaitTime: 0,
    oldestRequest: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      try {
        const servicesStatus = apiIntegrationService.getAllServicesStatus();
        const queueStatus = apiIntegrationService.getQueueStats();

        setServices(servicesStatus as unknown as Record<string, ServiceStatus>);
        setQueueStats(queueStatus);
      } catch (error) {
        console.warn('Failed to get API status:', error);
      }
    };

    // Initial update
    updateStatus();

    // Update every 5 seconds
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCircuitBreakerIcon = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return <Wifi className="w-3 h-3 text-green-500" />;
      case 'OPEN':
        return <WifiOff className="w-3 h-3 text-red-500" />;
      case 'HALF_OPEN':
        return <Activity className="w-3 h-3 text-yellow-500" />;
      default:
        return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getOverallHealth = () => {
    const servicesList = Object.values(services) as any[];
    if (servicesList.length === 0) return 'unknown';

    const unhealthyCount = servicesList.filter(s => s.health === 'unhealthy').length;
    const degradedCount = servicesList.filter(s => s.health === 'degraded').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  if (compact) {
    const overallHealth = getOverallHealth();
    const totalQueued = queueStats.totalQueued;

    return (
      <div
        className="flex items-center gap-2 px-3 py-1 bg-surface/50 border border-border-subtle rounded-lg cursor-pointer hover:bg-surface transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {getHealthIcon(overallHealth)}
        <span className="text-sm font-medium text-primary">
          APIs {overallHealth}
        </span>
        {totalQueued > 0 && (
          <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
            {totalQueued} queued
          </span>
        )}

        {isExpanded && (
          <div className="absolute bottom-full left-0 mb-2 w-80 bg-card border border-border-subtle rounded-lg shadow-xl shadow-black/50 z-50 p-4 text-primary">
            <h3 className="font-semibold text-primary mb-3">API Services Status</h3>

            {Object.entries(services).map(([serviceName, service]: [string, any]) => (
              <div key={serviceName} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-b-0">
                <div className="flex items-center gap-2">
                  {getHealthIcon(service.health)}
                  <span className="font-medium capitalize text-primary">{serviceName}</span>
                  {getCircuitBreakerIcon(service.circuitBreakerState)}
                </div>
                <div className="flex items-center gap-2 text-sm text-primary-subtle">
                  <span>{Math.round(service.rateLimitUsage)}%</span>
                  {service.creditsRemaining !== undefined && (
                    <span className="text-blue-400">{service.creditsRemaining} credits</span>
                  )}
                </div>
              </div>
            ))}

            {queueStats.totalQueued > 0 && (
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <div className="text-sm text-primary-subtle">
                  <div>Queue: {queueStats.totalQueued} requests</div>
                  <div>Avg wait: {formatTime(queueStats.averageWaitTime)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!showDetails) {
    return (
      <div className="flex items-center gap-4">
        {Object.entries(services).map(([serviceName, service]: [string, any]) => (
          <div key={serviceName} className="flex items-center gap-2">
            {getHealthIcon(service.health)}
            <span className="text-sm font-medium capitalize">{serviceName}</span>
            {service.circuitBreakerState === 'OPEN' && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Circuit Open
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">API Services Status</h2>
        <div className="flex items-center gap-2">
          {getHealthIcon(getOverallHealth())}
          <span className="text-sm font-medium">Overall: {getOverallHealth()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {Object.entries(services).map(([serviceName, service]: [string, any]) => (
          <div key={serviceName} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold capitalize">{serviceName}</h3>
              <div className="flex items-center gap-1">
                {getHealthIcon(service.health)}
                {getCircuitBreakerIcon(service.circuitBreakerState)}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Priority:</span>
                <span className={`font-medium ${service.priority === 'high' ? 'text-red-600' :
                  service.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                  {service.priority}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Rate Limit:</span>
                <div className="flex items-center gap-1">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${service.rateLimitUsage > 80 ? 'bg-red-500' :
                        service.rateLimitUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                      style={{ width: `${Math.min(service.rateLimitUsage, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs">{Math.round(service.rateLimitUsage)}%</span>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Circuit:</span>
                <span className={`font-medium ${service.circuitBreakerState === 'CLOSED' ? 'text-green-600' :
                  service.circuitBreakerState === 'HALF_OPEN' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                  {service.circuitBreakerState}
                </span>
              </div>

              {service.creditsRemaining !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits:</span>
                  <span className="font-medium text-blue-600">{service.creditsRemaining}</span>
                </div>
              )}

              {service.queueLength > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Queued:</span>
                  <span className="font-medium text-orange-600">{service.queueLength}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {queueStats.totalQueued > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Request Queue</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Queued:</span>
              <div className="font-semibold text-lg">{queueStats.totalQueued}</div>
            </div>
            <div>
              <span className="text-gray-600">High Priority:</span>
              <div className="font-semibold text-lg text-red-600">{queueStats.byPriority.high}</div>
            </div>
            <div>
              <span className="text-gray-600">Average Wait:</span>
              <div className="font-semibold text-lg">{formatTime(queueStats.averageWaitTime)}</div>
            </div>
            <div>
              <span className="text-gray-600">Oldest Request:</span>
              <div className="font-semibold text-lg">{formatTime(queueStats.oldestRequest)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiStatusIndicator;