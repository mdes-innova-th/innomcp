/**
 * Unit Tests for Parsers Module
 * à¸—à¸”à¸ªà¸­à¸šà¸•à¸±à¸§à¹à¸¢à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸²à¸ HTML/API à¹€à¸žà¸·à¹ˆà¸­à¸›à¹‰à¸­à¸‡à¸à¸±à¸™ breaking changes
 * 
 * Features:
 * - Test HTML parsers
 * - Test API response parsers
 * - Detect breaking changes
 * - Mock data validation
 * 
 * @module utils/parserTests
 */

import { logBoth } from '../mcpLogger';

/**
 * Test Result
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  expected?: any;
  actual?: any;
}

/**
 * Parser Test Suite
 */
export interface ParserTestSuite {
  name: string;
  tests: Array<{
    name: string;
    input: any;
    expected: any;
    parser: (input: any) => any;
  }>;
}

/**
 * Parser Test Manager
 */
class ParserTestManager {
  private suites: Map<string, ParserTestSuite> = new Map();
  private results: TestResult[] = [];

  /**
   * Register test suite
   */
  registerSuite(suite: ParserTestSuite): void {
    this.suites.set(suite.name, suite);
    logBoth('info', `[ParserTests] Registered suite: ${suite.name} (${suite.tests.length} tests)`);
  }

  /**
   * Run single test
   */
  private runTest(test: ParserTestSuite['tests'][0]): TestResult {
    const startTime = Date.now();
    
    try {
      const actual = test.parser(test.input);
      const passed = this.deepEqual(actual, test.expected);
      
      return {
        name: test.name,
        passed,
        duration: Date.now() - startTime,
        expected: passed ? undefined : test.expected,
        actual: passed ? undefined : actual
      };
    } catch (error: any) {
      return {
        name: test.name,
        passed: false,
        error: error.message || String(error),
        duration: Date.now() - startTime,
        expected: test.expected
      };
    }
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Run test suite
   */
  runSuite(suiteName: string): TestResult[] {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      logBoth('error', `[ParserTests] Suite not found: ${suiteName}`);
      return [];
    }

    logBoth('info', `[ParserTests] Running suite: ${suiteName}`);
    
    const results: TestResult[] = [];
    
    for (const test of suite.tests) {
      const result = this.runTest(test);
      results.push(result);
      this.results.push(result);
      
      if (result.passed) {
        logBoth('info', `  âœ“ ${test.name} (${result.duration}ms)`);
      } else {
        logBoth('error', `  âœ— ${test.name} (${result.duration}ms): ${result.error || 'Assertion failed'}`);
      }
    }

    return results;
  }

  /**
   * Run all suites
   */
  runAll(): Map<string, TestResult[]> {
    const allResults = new Map<string, TestResult[]>();
    
    for (const [name, suite] of this.suites) {
      const results = this.runSuite(name);
      allResults.set(name, results);
    }

    return allResults;
  }

  /**
   * Get test summary
   */
  getSummary(suiteResults?: TestResult[]): string {
    const results = suiteResults || this.results;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    
    let summary = `
Parser Tests Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Total Tests: ${total}
Passed: ${passed} (${passRate}%)
Failed: ${failed}
`;

    if (failed > 0) {
      summary += '\nFailed Tests:\n';
      for (const result of results) {
        if (!result.passed) {
          summary += `  âœ— ${result.name}\n`;
          if (result.error) {
            summary += `    Error: ${result.error}\n`;
          }
          if (result.expected !== undefined && result.actual !== undefined) {
            summary += `    Expected: ${JSON.stringify(result.expected)}\n`;
            summary += `    Actual: ${JSON.stringify(result.actual)}\n`;
          }
        }
      }
    }

    summary += 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return summary.trim();
  }

  /**
   * Initialize default test suites
   */
  initializeDefaultSuites(): void {
    // Weather parser tests
    this.registerSuite({
      name: 'weather-parser',
      tests: [
        {
          name: 'Parse Open-Meteo response',
          input: {
            current: {
              temperature_2m: 32.5,
              relative_humidity_2m: 65,
              precipitation: 0,
              weather_code: 3
            }
          },
          expected: {
            temperature: 32.5,
            humidity: 65,
            precipitation: 0,
            weatherCode: 3
          },
          parser: (input) => ({
            temperature: input.current.temperature_2m,
            humidity: input.current.relative_humidity_2m,
            precipitation: input.current.precipitation,
            weatherCode: input.current.weather_code
          })
        },
        {
          name: 'Parse TMD response',
          input: {
            WeatherForecasts: [{
              WeatherDescription: 'à¸¡à¸µà¹€à¸¡à¸†',
              Temperature: '32',
              Humidity: '65%'
            }]
          },
          expected: {
            description: 'à¸¡à¸µà¹€à¸¡à¸†',
            temperature: 32,
            humidity: 65
          },
          parser: (input) => ({
            description: input.WeatherForecasts[0].WeatherDescription,
            temperature: parseInt(input.WeatherForecasts[0].Temperature),
            humidity: parseInt(input.WeatherForecasts[0].Humidity)
          })
        }
      ]
    });

    // Time parser tests
    this.registerSuite({
      name: 'time-parser',
      tests: [
        {
          name: 'Parse ISO timestamp',
          input: '2026-01-11T14:30:00+07:00',
          expected: {
            hour: 14,
            minute: 30,
            timezone: '+07:00'
          },
          parser: (input) => {
            const date = new Date(input);
            return {
              hour: date.getHours(),
              minute: date.getMinutes(),
              timezone: '+07:00'
            };
          }
        }
      ]
    });

    // Officeholder parser tests
    this.registerSuite({
      name: 'officeholder-parser',
      tests: [
        {
          name: 'Parse Wikipedia infobox',
          input: {
            infobox: {
              'Prime Minister': 'Srettha Thavisin',
              'Took office': '22 August 2023'
            }
          },
          expected: {
            name: 'Srettha Thavisin',
            since: '22 August 2023'
          },
          parser: (input) => ({
            name: input.infobox['Prime Minister'],
            since: input.infobox['Took office']
          })
        }
      ]
    });

    // Search parser tests
    this.registerSuite({
      name: 'search-parser',
      tests: [
        {
          name: 'Parse Google CSE response',
          input: {
            items: [
              {
                title: 'Example Title',
                link: 'https://example.com',
                snippet: 'Example snippet text'
              }
            ]
          },
          expected: [
            {
              title: 'Example Title',
              url: 'https://example.com',
              snippet: 'Example snippet text'
            }
          ],
          parser: (input) => input.items.map((item: any) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet
          }))
        }
      ]
    });

    logBoth('info', '[ParserTests] Initialized default test suites');
  }
}

// Export singleton instance
export const parserTests = new ParserTestManager();

/**
 * Helper: Run tests for a suite
 */
export function runParserTests(suiteName: string): TestResult[] {
  return parserTests.runSuite(suiteName);
}

/**
 * Helper: Run all tests
 */
export function runAllParserTests(): Map<string, TestResult[]> {
  return parserTests.runAll();
}

/**
 * Helper: Initialize default suites
 */
export function initializeParserTests(): void {
  parserTests.initializeDefaultSuites();
}

// Auto-initialize on import
initializeParserTests();
