import { describe, it, expect } from '@jest/globals';
import logger, { logRequest, logOllamaRequest, logMCPRequest } from '../../src/utils/logger';

describe('Logger Utility', () => {
  it('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log info messages', () => {
    expect(() => {
      logger.info('Test info message');
    }).not.toThrow();
  });

  it('should log error messages', () => {
    expect(() => {
      logger.error('Test error message');
    }).not.toThrow();
  });

  it('should have logRequest helper', () => {
    expect(typeof logRequest).toBe('function');
  });

  it('should have logOllamaRequest helper', () => {
    expect(typeof logOllamaRequest).toBe('function');
  });

  it('should have logMCPRequest helper', () => {
    expect(typeof logMCPRequest).toBe('function');
  });
});
