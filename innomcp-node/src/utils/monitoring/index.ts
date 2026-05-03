/**
 * Monitoring and Health Check Module
 * ตรวจสอบสถานะของบริการต่างๆ
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

import axios from 'axios';
import { logBoth } from '../mcpLogger';
import { getRedisClient, getRedisHealthSnapshot } from '../redis';
import { pingDatabase } from '../db';

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
  acceptableStatuses?: number[];
  headers?: Record<string, string>;
  validateResponse?: (data: any) => boolean;
  /** When false, this service's failure causes DEGRADED (not UNHEALTHY) overall. Default: true */
  critical?: boolean;
}

interface SearchProviderProbe {
  provider: string;
  url: string;
  headers?: Record<string, string>;
  expectedStatus: number;
  acceptableStatuses?: number[];
  timeout?: number;
  validateResponse?: (data: any) => boolean;
}

interface TmdHealthProbe {
  endpoint: string;
  url: string;
  expectedStatus: number;
  timeout: number;
  validateResponse?: (data: any) => boolean;
}

function hasConfiguredTmdApiCredentials(): boolean {
  const uid = String(process.env.TMD_UID_API || process.env.TMD_UID || '').trim();
  const ukey = String(process.env.TMD_UKEY_API || process.env.TMD_UKEY || '').trim();
  return Boolean(uid && ukey && !(uid === 'demo' && ukey === 'demo'));
}

function getTmdHealthProbe(): TmdHealthProbe | null {
  const uid = String(process.env.TMD_UID_API || process.env.TMD_UID || '').trim();
  const ukey = String(process.env.TMD_UKEY_API || process.env.TMD_UKEY || '').trim();
  if (!uid || !ukey) {
    return null;
  }

  const url = new URL('https://data.tmd.go.th/api/WeatherWarningNews/v2/');
  url.searchParams.set('uid', uid);
  url.searchParams.set('ukey', ukey);
  url.searchParams.set('format', 'json');

  return {
    endpoint: 'WeatherWarningNews/v2',
    url: url.toString(),
    expectedStatus: 200,
    timeout: 10000,
    validateResponse: (data) => Boolean(data?.header?.title),
  };
}

function getSearchProviderProbe(): SearchProviderProbe {
  const googleApiKey = String(process.env.GOOGLE_SEARCH_API_KEY || '').trim();
  const googleCx = String(process.env.GOOGLE_SEARCH_CX || '').trim();
  if (googleApiKey && googleCx) {
    return {
      provider: 'google-custom-search',
      url: `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=health&num=1`,
      expectedStatus: 200,
      validateResponse: (data) => typeof data?.searchInformation?.totalResults === 'string' || Array.isArray(data?.items),
    };
  }

  const serpApiKey = String(process.env.SERPAPI_API_KEY || '').trim();
  if (serpApiKey) {
    return {
      provider: 'serpapi',
      url: `https://serpapi.com/search?engine=google&q=health&api_key=${serpApiKey}&num=1`,
      expectedStatus: 200,
      validateResponse: (data) => Array.isArray(data?.organic_results),
    };
  }

  const braveApiKey = String(process.env.BRAVE_SEARCH_API_KEY || '').trim();
  if (braveApiKey) {
    return {
      provider: 'brave-search',
      url: 'https://api.search.brave.com/res/v1/web/search?q=health&count=1',
      headers: {
        'X-Subscription-Token': braveApiKey,
      },
      expectedStatus: 200,
      validateResponse: (data) => Array.isArray(data?.web?.results),
    };
  }

  return {
    provider: 'duckduckgo-public',
    url: 'https://api.duckduckgo.com/?q=thailand&format=json&no_redirect=1&no_html=1',
    expectedStatus: 200,
    acceptableStatuses: [200, 202],
    timeout: 5000,
    validateResponse: (data) => typeof data?.Abstract === 'string' || Array.isArray(data?.RelatedTopics),
  };
}

/**
 * Registered health checks
 * critical=false: external APIs — their failure degrades but does not break core chat functionality
 */
const HEALTH_CHECKS: HealthCheckConfig[] = [
  {
    name: 'Weather API (TMD)',
    url: 'https://data.tmd.go.th/api/WeatherWarningNews/v2/',
    method: 'GET',
    timeout: 10000,
    expectedStatus: 200,
    critical: false,
  },
  {
    name: 'Open-Meteo API',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=13.75&longitude=100.50&current=temperature_2m',
    method: 'GET',
    timeout: 3000,
    expectedStatus: 200,
    validateResponse: (data) => data?.current?.temperature_2m !== undefined,
    critical: false,
  },
  {
    name: 'OpenSearch (Thai Gov)',
    url: 'https://api.search.brave.com/res/v1/web/search?q=health&count=1',
    method: 'GET',
    timeout: 3000,
    expectedStatus: 200,
    critical: false,
  },
  {
    name: 'Redis',
    url: 'redis://localhost:6379',
    method: 'GET',
    timeout: 2000,
    // Optional: caching falls back to in-memory in src/utils/cache.ts when Redis
    // is unreachable. Marking critical=true caused mode=offline even though
    // chat/MCP work fine. Demote to optional → DEGRADED at worst.
    critical: false,
  },
  {
    name: 'Database',
    url: 'mysql://localhost:3306',
    method: 'GET',
    timeout: 2000,
    critical: true,
  },
  {
    name: 'MCP Server',
    url: process.env.MCP_SERVER_URL || 'http://localhost:3012/health',
    method: 'GET',
    timeout: 3000,
    expectedStatus: 200,
    critical: true,
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
const CACHE_TTL = 300000; // 5 minutes

/**
 * Perform health check on a single service
 */
async function checkService(config: HealthCheckConfig): Promise<HealthCheckResult> {
  const startCheck = Date.now();
  
  try {
    if (config.name === 'Weather API (TMD)' && !hasConfiguredTmdApiCredentials()) {
      return {
        service: config.name,
        status: HealthStatus.UNKNOWN,
        responseTime: Date.now() - startCheck,
        lastCheck: new Date().toISOString(),
        message: 'TMD API credentials not configured',
      };
    }

    let requestConfig = config;
    let requestDetails: Record<string, unknown> | undefined;

    if (config.name === 'Weather API (TMD)') {
      const probe = getTmdHealthProbe();
      if (!probe) {
        return {
          service: config.name,
          status: HealthStatus.UNKNOWN,
          responseTime: Date.now() - startCheck,
          lastCheck: new Date().toISOString(),
          message: 'TMD API credentials not configured',
        };
      }

      requestConfig = {
        ...config,
        url: probe.url,
        timeout: probe.timeout,
        expectedStatus: probe.expectedStatus,
        validateResponse: probe.validateResponse,
      };
      requestDetails = {
        endpoint: probe.endpoint,
      };
    }

    if (config.name === 'OpenSearch (Thai Gov)') {
      const probe = getSearchProviderProbe();

      requestConfig = {
        ...config,
        url: probe.url,
        headers: probe.headers,
        expectedStatus: probe.expectedStatus,
        acceptableStatuses: probe.acceptableStatuses,
        timeout: probe.timeout || config.timeout,
        validateResponse: probe.validateResponse,
      };
      requestDetails = { provider: probe.provider };
    }

    // Check if service is HTTP-based
    if (requestConfig.url.startsWith('http://') || requestConfig.url.startsWith('https://')) {
      const response = await axios({
        method: requestConfig.method || 'GET',
        url: requestConfig.url,
        timeout: requestConfig.timeout || 5000,
        headers: requestConfig.headers,
        validateStatus: () => true, // Accept any status
      });
      
      const responseTime = Date.now() - startCheck;
      const expectedStatuses = requestConfig.acceptableStatuses?.length
        ? requestConfig.acceptableStatuses
        : [requestConfig.expectedStatus || 200];
      const statusMatches = expectedStatuses.includes(response.status);
      
      let validResponse = true;
      if (requestConfig.validateResponse && response.data) {
        validResponse = requestConfig.validateResponse(response.data);
      }
      
      const isHealthy = statusMatches && validResponse;
      
      return {
        service: config.name,
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        lastCheck: new Date().toISOString(),
        message: isHealthy ? 'OK' : `Unexpected status: ${response.status}`,
        details: {
          ...requestDetails,
          status: response.status,
          statusText: response.statusText,
        },
      };
    }
    
    // Redis health check
    if (config.name === 'Redis') {
      try {
        const redisClient = await getRedisClient();
        await redisClient.ping();
      } catch {
        // Fall through to the passive snapshot below so cooldown/disconnected states remain visible.
      }

      const redisHealth = getRedisHealthSnapshot();
      const responseTime = Date.now() - startCheck;
      const status = !redisHealth.configured
        ? HealthStatus.UNKNOWN
        : redisHealth.ready
        ? HealthStatus.HEALTHY
        : redisHealth.status === 'connecting' || redisHealth.status === 'reconnecting' || redisHealth.status === 'cooldown'
        ? HealthStatus.DEGRADED
        : HealthStatus.UNHEALTHY;

      return {
        service: config.name,
        status,
        responseTime,
        lastCheck: new Date().toISOString(),
        message: !redisHealth.configured ? 'Redis not configured' : redisHealth.status,
        details: redisHealth,
      };
    }

    // Database health check
    if (config.name === 'Database') {
      try {
        await pingDatabase();
        const responseTime = Date.now() - startCheck;
        return {
          service: config.name,
          status: HealthStatus.HEALTHY,
          responseTime,
          lastCheck: new Date().toISOString(),
          message: 'OK',
        };
      } catch (dbErr: any) {
        return {
          service: config.name,
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startCheck,
          lastCheck: new Date().toISOString(),
          message: dbErr.message || 'DB ping failed',
        };
      }
    }

    // Unknown service type
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
  const results = await Promise.all(
    HEALTH_CHECKS.map(async (config) => {
      if (useCache) {
        const cached = getCachedResult(config.name);
        if (cached) {
          return cached;
        }
      }

      const result = await checkService(config);
      healthCache.set(config.name, result);
      return result;
    })
  );
  
  // Determine overall status
  // Critical services failing → UNHEALTHY; optional services failing → DEGRADED only
  const criticalConfigs = HEALTH_CHECKS.filter(c => c.critical !== false);
  const criticalNames = new Set(criticalConfigs.map(c => c.name));
  const criticalResults = results.filter(r => criticalNames.has(r.service));
  const optionalResults = results.filter(r => !criticalNames.has(r.service));

  const hasCriticalUnhealthy = criticalResults.some(r => r.status === HealthStatus.UNHEALTHY);
  const hasAnyDegraded = results.some(r => r.status === HealthStatus.DEGRADED);
  const hasOptionalUnhealthy = optionalResults.some(r => r.status === HealthStatus.UNHEALTHY);
  const hasUnknown = results.every(r => r.status === HealthStatus.UNKNOWN);

  let overallStatus = HealthStatus.HEALTHY;
  if (hasCriticalUnhealthy) {
    overallStatus = HealthStatus.UNHEALTHY;
  } else if (hasAnyDegraded || hasOptionalUnhealthy) {
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
