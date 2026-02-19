/**
 * Monitoring and Health Check Module
 * ตรวจสอบสถานะของบริการต่างๆ
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

import axios from 'axios';
import { logBoth } from '../mcpLogger';

/**
 * Service health status
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  service: string;
  status: HealthStatus;
  responseTime?: number; // milliseconds
  lastCheck: string;
  message?: string;
  details?: any;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  services: HealthCheckResult[];
  uptime: number; // seconds
}

/**
 * Health check configuration
 */
interface HealthCheckConfig {
  name: string;
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  timeout?: number;
  expectedStatus?: number;
  validateResponse?: (data: any) => boolean;
}

/**
 * Registered health checks
 */
const HEALTH_CHECKS: HealthCheckConfig[] = [
  {
    name: 'Weather API (TMD)',
    url: 'https://data.tmd.go.th/api/Weather3Hours/v1/',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 401, // API ต้องการ token, 401 แสดงว่าเซิร์ฟเวอร์ทำงาน
  },
  {
    name: 'Open-Meteo API',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=13.75&longitude=100.50&current=temperature_2m',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200,
    validateResponse: (data) => data?.current?.temperature_2m !== undefined,
  },
  {
    name: 'OpenSearch (Thai Gov)',
    url: 'https://search.thaigov.go.th/apis/suggestion?q=test',
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200,
  },
  {
    name: 'Redis',
    url: 'redis://localhost:6379',
    method: 'GET',
    timeout: 2000,
  },
  {
    name: 'Database',
    url: 'mysql://localhost:3306',
    method: 'GET',
    timeout: 2000,
  },
];

/**
 * Service start time
 */
const startTime = Date.now();

/**
 * Cache for health check results
 */
const healthCache = new Map<string, HealthCheckResult>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Perform health check on a single service
 */
async function checkService(config: HealthCheckConfig): Promise<HealthCheckResult> {
  const startCheck = Date.now();
  
  try {
    // Check if service is HTTP-based
    if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
      const response = await axios({
        method: config.method || 'GET',
        url: config.url,
        timeout: config.timeout || 5000,
        validateStatus: () => true, // Accept any status
      });
      
      const responseTime = Date.now() - startCheck;
      const expectedStatus = config.expectedStatus || 200;
      const statusMatches = response.status === expectedStatus;
      
      let validResponse = true;
      if (config.validateResponse && response.data) {
        validResponse = config.validateResponse(response.data);
      }
      
      const isHealthy = statusMatches && validResponse;
      
      return {
        service: config.name,
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        lastCheck: new Date().toISOString(),
        message: isHealthy ? 'OK' : `Unexpected status: ${response.status}`,
        details: {
          status: response.status,
          statusText: response.statusText,
        },
      };
    }
    
    // For non-HTTP services (Redis, DB), return unknown
    // Would need specific client libraries to check these
    return {
      service: config.name,
      status: HealthStatus.UNKNOWN,
      lastCheck: new Date().toISOString(),
      message: 'Health check not implemented for this service type',
    };
  } catch (error: any) {
    const responseTime = Date.now() - startCheck;
    
    return {
      service: config.name,
      status: HealthStatus.UNHEALTHY,
      responseTime,
      lastCheck: new Date().toISOString(),
      message: error.message || 'Health check failed',
      details: {
        error: error.code || error.message,
      },
    };
  }
}

/**
 * Get cached health check result if available
 */
function getCachedResult(serviceName: string): HealthCheckResult | null {
  const cached = healthCache.get(serviceName);
  if (!cached) return null;
  
  const age = Date.now() - new Date(cached.lastCheck).getTime();
  if (age > CACHE_TTL) {
    healthCache.delete(serviceName);
    return null;
  }
  
  return cached;
}

/**
 * Check health of all services
 */
export async function checkAllServices(useCache = true): Promise<SystemHealth> {
  const results: HealthCheckResult[] = [];
  
  for (const config of HEALTH_CHECKS) {
    // Try to get cached result
    if (useCache) {
      const cached = getCachedResult(config.name);
      if (cached) {
        results.push(cached);
        continue;
      }
    }
    
    // Perform health check
    const result = await checkService(config);
    healthCache.set(config.name, result);
    results.push(result);
  }
  
  // Determine overall status
  const hasUnhealthy = results.some(r => r.status === HealthStatus.UNHEALTHY);
  const hasDegraded = results.some(r => r.status === HealthStatus.DEGRADED);
  const hasUnknown = results.every(r => r.status === HealthStatus.UNKNOWN);
  
  let overallStatus = HealthStatus.HEALTHY;
  if (hasUnhealthy) {
    overallStatus = HealthStatus.UNHEALTHY;
  } else if (hasDegraded) {
    overallStatus = HealthStatus.DEGRADED;
  } else if (hasUnknown) {
    overallStatus = HealthStatus.UNKNOWN;
  }
  
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: results,
    uptime,
  };
}

/**
 * Check health of a specific service
 */
export async function checkServiceHealth(serviceName: string, useCache = true): Promise<HealthCheckResult> {
  if (useCache) {
    const cached = getCachedResult(serviceName);
    if (cached) return cached;
  }
  
  const config = HEALTH_CHECKS.find(c => c.name === serviceName);
  if (!config) {
    return {
      service: serviceName,
      status: HealthStatus.UNKNOWN,
      lastCheck: new Date().toISOString(),
      message: 'Service not found in health check configuration',
    };
  }
  
  const result = await checkService(config);
  healthCache.set(serviceName, result);
  return result;
}

/**
 * Get system metrics
 */
export function getSystemMetrics() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memUsage = process.memoryUsage();
  
  return {
    uptime,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

/**
 * Start periodic health checks
 */
export function startPeriodicHealthChecks(intervalSeconds = 300): NodeJS.Timeout {
  logBoth('info', `[Monitoring] Starting periodic health checks (interval: ${intervalSeconds}s)`);
  
  const interval = setInterval(async () => {
    try {
      const health = await checkAllServices(false);
      
      if (health.status !== HealthStatus.HEALTHY) {
        const unhealthyServices = health.services
          .filter(s => s.status !== HealthStatus.HEALTHY)
          .map(s => s.service);
        logBoth('warn', `[Monitoring] System health degraded: ${health.status}, Unhealthy services: ${unhealthyServices.join(', ')}`);
      }
    } catch (error) {
      logBoth('error', `[Monitoring] Health check failed: ${error}`);
    }
  }, intervalSeconds * 1000);
  
  return interval;
}

/**
 * Create health check response for HTTP endpoint
 */
export async function createHealthResponse(detailed = false) {
  const health = await checkAllServices(true);
  const metrics = getSystemMetrics();
  
  const response: any = {
    status: health.status.toLowerCase(),
    timestamp: health.timestamp,
    uptime: health.uptime,
  };
  
  if (detailed) {
    response.services = health.services;
    response.metrics = metrics;
  } else {
    // Minimal response - just overall status
    response.services = health.services.map(s => ({
      name: s.service,
      status: s.status.toLowerCase(),
    }));
  }
  
  return response;
}
