/**
 * API Health Monitoring Service
 * Provides comprehensive monitoring, alerting, and reporting for external API integrations
 * Requirements: 2.7, 2.8 - API health monitoring and status indicators
 */

import { apiIntegrationService, ApiHealthStatus } from './apiIntegrationService';
import { createErrorDetail } from './errorHandlingService';
import { ErrorDetail, FailureReason, ProcessingStep } from '../types';

// Health Alert Types
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertType = 'health_degraded' | 'circuit_breaker_open' | 'rate_limit_exceeded' | 'credits_low' | 'queue_backlog' | 'service_timeout';

export interface HealthAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  serviceName: string;
  message: string;
  details: Record<string, any>;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export interface ServiceHealthMetrics {
  serviceName: string;
  health: ApiHealthStatus;
  uptime: number; // percentage
  averageResponseTime: number;
  errorRate: number; // percentage
  rateLimitUtilization: number; // percentage
  circuitBreakerState: string;
  creditsRemaining?: number;
  queueLength: number;
  lastHealthCheck: string;
  alertsCount: number;
}

export interface SystemHealthSummary {
  overallHealth: ApiHealthStatus;
  servicesCount: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  totalAlerts: number;
  criticalAlerts: number;
  averageResponseTime: number;
  totalQueueLength: number;
  lastUpdated: string;
}

// Health Monitoring Configuration
export interface HealthMonitoringConfig {
  checkInterval: number; // milliseconds
  alertThresholds: {
    responseTimeWarning: number; // ms
    responseTimeCritical: number; // ms
    errorRateWarning: number; // percentage
    errorRateCritical: number; // percentage
    rateLimitWarning: number; // percentage
    rateLimitCritical: number; // percentage
    queueLengthWarning: number;
    queueLengthCritical: number;
    creditsLowWarning: number;
    creditsLowCritical: number;
  };
  retentionPeriod: number; // milliseconds
  enableAlerts: boolean;
  enableMetricsCollection: boolean;
}

// Default configuration
const DEFAULT_CONFIG: HealthMonitoringConfig = {
  checkInterval: 30000, // 30 seconds
  alertThresholds: {
    responseTimeWarning: 3000, // 3 seconds
    responseTimeCritical: 10000, // 10 seconds
    errorRateWarning: 10, // 10%
    errorRateCritical: 25, // 25%
    rateLimitWarning: 80, // 80%
    rateLimitCritical: 95, // 95%
    queueLengthWarning: 10,
    queueLengthCritical: 25,
    creditsLowWarning: 20,
    creditsLowCritical: 5
  },
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  enableAlerts: true,
  enableMetricsCollection: true
};

// Metrics Storage
interface MetricsDataPoint {
  timestamp: string;
  serviceName: string;
  responseTime: number;
  success: boolean;
  errorType?: string;
  rateLimitUsage: number;
  creditsUsed?: number;
  queueLength: number;
}

export class ApiHealthMonitoringService {
  private config: HealthMonitoringConfig;
  private alerts: HealthAlert[] = [];
  private metrics: MetricsDataPoint[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private alertCallbacks: Array<(alert: HealthAlert) => void> = [];

  constructor(config: Partial<HealthMonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Health monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting API health monitoring...');

    // Initial health check
    this.performHealthCheck();

    // Schedule regular health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    // Clean up old data periodically
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    console.log('Stopped API health monitoring');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const servicesStatus = apiIntegrationService.getAllServicesStatus();
      const queueStats = apiIntegrationService.getQueueStats();
      const timestamp = new Date().toISOString();

      // Check each service
      for (const [serviceName, serviceStatus] of Object.entries(servicesStatus)) {
        // Collect metrics
        if (this.config.enableMetricsCollection) {
          this.collectMetrics(serviceName, serviceStatus, queueStats, timestamp);
        }

        // Check for alerts
        if (this.config.enableAlerts) {
          this.checkServiceAlerts(serviceName, serviceStatus, queueStats);
        }
      }

      // Check system-wide alerts
      if (this.config.enableAlerts) {
        this.checkSystemAlerts(servicesStatus, queueStats);
      }

    } catch (error) {
      console.error('Health check failed:', error);
      
      if (this.config.enableAlerts) {
        this.createAlert({
          type: 'service_timeout',
          severity: 'error',
          serviceName: 'health_monitor',
          message: 'Health monitoring system encountered an error',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }
  }

  /**
   * Collect metrics for a service
   */
  private collectMetrics(
    serviceName: string, 
    serviceStatus: any, 
    queueStats: any, 
    timestamp: string
  ): void {
    const serviceStats = apiIntegrationService.getServiceStats(serviceName);
    if (!serviceStats) return;

    const dataPoint: MetricsDataPoint = {
      timestamp,
      serviceName,
      responseTime: serviceStats.health.averageResponseTime,
      success: serviceStatus.health === 'healthy',
      rateLimitUsage: serviceStatus.rateLimitUsage,
      creditsUsed: serviceStatus.creditsRemaining ? 
        (100 - serviceStatus.creditsRemaining) : undefined,
      queueLength: serviceStatus.queueLength
    };

    this.metrics.push(dataPoint);
  }

  /**
   * Check for service-specific alerts
   */
  private checkServiceAlerts(serviceName: string, serviceStatus: any, queueStats: any): void {
    const serviceStats = apiIntegrationService.getServiceStats(serviceName);
    if (!serviceStats) return;

    // Health degradation alerts
    if (serviceStatus.health === 'degraded' && !this.hasActiveAlert(serviceName, 'health_degraded')) {
      this.createAlert({
        type: 'health_degraded',
        severity: 'warning',
        serviceName,
        message: `Service ${serviceName} health is degraded`,
        details: { 
          health: serviceStatus.health,
          averageResponseTime: serviceStats.health.averageResponseTime,
          recentErrors: serviceStats.health.recentErrors
        }
      });
    }

    if (serviceStatus.health === 'unhealthy' && !this.hasActiveAlert(serviceName, 'health_degraded')) {
      this.createAlert({
        type: 'health_degraded',
        severity: 'error',
        serviceName,
        message: `Service ${serviceName} is unhealthy`,
        details: { 
          health: serviceStatus.health,
          averageResponseTime: serviceStats.health.averageResponseTime,
          recentErrors: serviceStats.health.recentErrors
        }
      });
    }

    // Circuit breaker alerts
    if (serviceStatus.circuitBreakerState === 'OPEN' && !this.hasActiveAlert(serviceName, 'circuit_breaker_open')) {
      this.createAlert({
        type: 'circuit_breaker_open',
        severity: 'critical',
        serviceName,
        message: `Circuit breaker is OPEN for ${serviceName}`,
        details: { 
          state: serviceStatus.circuitBreakerState,
          failures: serviceStats.circuitBreaker.failures,
          nextRetryTime: serviceStats.circuitBreaker.nextRetryTime
        }
      });
    }

    // Rate limit alerts
    if (serviceStatus.rateLimitUsage >= this.config.alertThresholds.rateLimitCritical && 
        !this.hasActiveAlert(serviceName, 'rate_limit_exceeded')) {
      this.createAlert({
        type: 'rate_limit_exceeded',
        severity: 'critical',
        serviceName,
        message: `Rate limit critically high for ${serviceName}: ${Math.round(serviceStatus.rateLimitUsage)}%`,
        details: { 
          usage: serviceStatus.rateLimitUsage,
          threshold: this.config.alertThresholds.rateLimitCritical
        }
      });
    } else if (serviceStatus.rateLimitUsage >= this.config.alertThresholds.rateLimitWarning && 
               !this.hasActiveAlert(serviceName, 'rate_limit_exceeded')) {
      this.createAlert({
        type: 'rate_limit_exceeded',
        severity: 'warning',
        serviceName,
        message: `Rate limit high for ${serviceName}: ${Math.round(serviceStatus.rateLimitUsage)}%`,
        details: { 
          usage: serviceStatus.rateLimitUsage,
          threshold: this.config.alertThresholds.rateLimitWarning
        }
      });
    }

    // Credits low alerts
    if (serviceStatus.creditsRemaining !== undefined) {
      if (serviceStatus.creditsRemaining <= this.config.alertThresholds.creditsLowCritical && 
          !this.hasActiveAlert(serviceName, 'credits_low')) {
        this.createAlert({
          type: 'credits_low',
          severity: 'critical',
          serviceName,
          message: `Credits critically low for ${serviceName}: ${serviceStatus.creditsRemaining}`,
          details: { 
            remaining: serviceStatus.creditsRemaining,
            threshold: this.config.alertThresholds.creditsLowCritical
          }
        });
      } else if (serviceStatus.creditsRemaining <= this.config.alertThresholds.creditsLowWarning && 
                 !this.hasActiveAlert(serviceName, 'credits_low')) {
        this.createAlert({
          type: 'credits_low',
          severity: 'warning',
          serviceName,
          message: `Credits low for ${serviceName}: ${serviceStatus.creditsRemaining}`,
          details: { 
            remaining: serviceStatus.creditsRemaining,
            threshold: this.config.alertThresholds.creditsLowWarning
          }
        });
      }
    }
  }

  /**
   * Check for system-wide alerts
   */
  private checkSystemAlerts(servicesStatus: any, queueStats: any): void {
    // Queue backlog alerts
    if (queueStats.totalQueued >= this.config.alertThresholds.queueLengthCritical && 
        !this.hasActiveAlert('system', 'queue_backlog')) {
      this.createAlert({
        type: 'queue_backlog',
        severity: 'critical',
        serviceName: 'system',
        message: `Request queue critically backed up: ${queueStats.totalQueued} requests`,
        details: { 
          totalQueued: queueStats.totalQueued,
          averageWaitTime: queueStats.averageWaitTime,
          oldestRequest: queueStats.oldestRequest,
          threshold: this.config.alertThresholds.queueLengthCritical
        }
      });
    } else if (queueStats.totalQueued >= this.config.alertThresholds.queueLengthWarning && 
               !this.hasActiveAlert('system', 'queue_backlog')) {
      this.createAlert({
        type: 'queue_backlog',
        severity: 'warning',
        serviceName: 'system',
        message: `Request queue backed up: ${queueStats.totalQueued} requests`,
        details: { 
          totalQueued: queueStats.totalQueued,
          averageWaitTime: queueStats.averageWaitTime,
          threshold: this.config.alertThresholds.queueLengthWarning
        }
      });
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: {
    type: AlertType;
    severity: AlertSeverity;
    serviceName: string;
    message: string;
    details: Record<string, any>;
  }): void {
    const alert: HealthAlert = {
      id: `${alertData.serviceName}-${alertData.type}-${Date.now()}`,
      ...alertData,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.alerts.push(alert);
    console.warn(`API Health Alert [${alert.severity.toUpperCase()}]:`, alert.message);

    // Notify callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    });
  }

  /**
   * Check if there's an active alert of a specific type for a service
   */
  private hasActiveAlert(serviceName: string, type: AlertType): boolean {
    return this.alerts.some(alert => 
      alert.serviceName === serviceName && 
      alert.type === type && 
      !alert.acknowledged && 
      !alert.resolvedAt
    );
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    const cutoffDate = new Date(cutoffTime).toISOString();

    // Clean up old metrics
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffDate);

    // Clean up old resolved alerts
    this.alerts = this.alerts.filter(alert => 
      !alert.resolvedAt || alert.resolvedAt > cutoffDate
    );

    console.log(`Cleaned up old health monitoring data (cutoff: ${cutoffDate})`);
  }

  /**
   * Get current system health summary
   */
  getSystemHealthSummary(): SystemHealthSummary {
    const servicesStatus = apiIntegrationService.getAllServicesStatus();
    const queueStats = apiIntegrationService.getQueueStats();
    const services = Object.values(servicesStatus);
    
    const healthyCount = services.filter(s => s.health === 'healthy').length;
    const degradedCount = services.filter(s => s.health === 'degraded').length;
    const unhealthyCount = services.filter(s => s.health === 'unhealthy').length;
    
    // Determine overall health
    let overallHealth: ApiHealthStatus = 'healthy';
    if (unhealthyCount > 0) {
      overallHealth = 'unhealthy';
    } else if (degradedCount > 0) {
      overallHealth = 'degraded';
    }

    const activeAlerts = this.alerts.filter(a => !a.acknowledged && !a.resolvedAt);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    // Calculate average response time
    const recentMetrics = this.metrics.filter(m => 
      Date.now() - new Date(m.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
    );
    const avgResponseTime = recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length : 0;

    return {
      overallHealth,
      servicesCount: services.length,
      healthyServices: healthyCount,
      degradedServices: degradedCount,
      unhealthyServices: unhealthyCount,
      totalAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      averageResponseTime: avgResponseTime,
      totalQueueLength: queueStats.totalQueued,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get detailed metrics for a service
   */
  getServiceMetrics(serviceName: string, timeRange: number = 60 * 60 * 1000): ServiceHealthMetrics | null {
    const serviceStatus = apiIntegrationService.getAllServicesStatus()[serviceName];
    if (!serviceStatus) return null;

    const serviceStats = apiIntegrationService.getServiceStats(serviceName);
    if (!serviceStats) return null;

    const cutoffTime = Date.now() - timeRange;
    const serviceMetrics = this.metrics.filter(m => 
      m.serviceName === serviceName && 
      new Date(m.timestamp).getTime() > cutoffTime
    );

    // Calculate uptime
    const totalChecks = serviceMetrics.length;
    const successfulChecks = serviceMetrics.filter(m => m.success).length;
    const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

    // Calculate error rate
    const errorRate = totalChecks > 0 ? ((totalChecks - successfulChecks) / totalChecks) * 100 : 0;

    // Calculate average response time
    const avgResponseTime = serviceMetrics.length > 0 ?
      serviceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / serviceMetrics.length : 0;

    // Count active alerts for this service
    const serviceAlerts = this.alerts.filter(a => 
      a.serviceName === serviceName && 
      !a.acknowledged && 
      !a.resolvedAt
    ).length;

    return {
      serviceName,
      health: serviceStatus.health,
      uptime,
      averageResponseTime: avgResponseTime,
      errorRate,
      rateLimitUtilization: serviceStatus.rateLimitUsage,
      circuitBreakerState: serviceStatus.circuitBreakerState,
      creditsRemaining: serviceStatus.creditsRemaining,
      queueLength: serviceStatus.queueLength,
      lastHealthCheck: serviceStats.health.lastCheckTime ? 
        new Date(serviceStats.health.lastCheckTime).toISOString() : new Date().toISOString(),
      alertsCount: serviceAlerts
    };
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged && !alert.resolvedAt);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): HealthAlert[] {
    return this.getActiveAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      console.log(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolvedAt) {
      alert.resolvedAt = new Date().toISOString();
      console.log(`Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: HealthAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get configuration
   */
  getConfig(): HealthMonitoringConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HealthMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Health monitoring configuration updated');
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusMetrics();
    }
    
    return JSON.stringify({
      summary: this.getSystemHealthSummary(),
      services: Object.keys(apiIntegrationService.getAllServicesStatus()).map(name => 
        this.getServiceMetrics(name)
      ).filter(Boolean),
      alerts: this.getActiveAlerts(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Export metrics in Prometheus format
   */
  private exportPrometheusMetrics(): string {
    const summary = this.getSystemHealthSummary();
    const services = Object.keys(apiIntegrationService.getAllServicesStatus());
    
    let output = '# HELP api_health_status API service health status (0=unhealthy, 1=degraded, 2=healthy)\n';
    output += '# TYPE api_health_status gauge\n';
    
    services.forEach(serviceName => {
      const metrics = this.getServiceMetrics(serviceName);
      if (metrics) {
        const healthValue = metrics.health === 'healthy' ? 2 : metrics.health === 'degraded' ? 1 : 0;
        output += `api_health_status{service="${serviceName}"} ${healthValue}\n`;
        output += `api_response_time_ms{service="${serviceName}"} ${metrics.averageResponseTime}\n`;
        output += `api_error_rate_percent{service="${serviceName}"} ${metrics.errorRate}\n`;
        output += `api_uptime_percent{service="${serviceName}"} ${metrics.uptime}\n`;
      }
    });
    
    output += `api_total_alerts ${summary.totalAlerts}\n`;
    output += `api_critical_alerts ${summary.criticalAlerts}\n`;
    output += `api_queue_length ${summary.totalQueueLength}\n`;
    
    return output;
  }
}

// Global instance
export const apiHealthMonitoringService = new ApiHealthMonitoringService();

// Auto-start monitoring
apiHealthMonitoringService.startMonitoring();

/**
 * Helper function to create API health-related error details
 */
export function createApiHealthError(
  serviceName: string,
  healthStatus: ApiHealthStatus,
  details: Record<string, any>,
  step: ProcessingStep
): ErrorDetail {
  let reason: FailureReason = 'external_service_timeout';
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  
  switch (healthStatus) {
    case 'unhealthy':
      reason = 'external_service_timeout';
      severity = 'high';
      break;
    case 'degraded':
      reason = 'external_service_timeout';
      severity = 'medium';
      break;
    default:
      reason = 'external_service_timeout';
      severity = 'low';
  }
  
  return createErrorDetail(
    reason,
    `API service ${serviceName} health is ${healthStatus}`,
    {
      serviceName,
      healthStatus,
      ...details,
      timestamp: new Date().toISOString()
    },
    step,
    `Service health monitoring detected ${healthStatus} status for ${serviceName}`
  );
}