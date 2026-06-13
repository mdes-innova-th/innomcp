<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-51 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":57,"completion_tokens":2190,"total_tokens":2247,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1730,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T05:27:58.168Z -->
import type { Request, Response, NextFunction } from 'express';

export const makeReq = (overrides: Partial<Request> = {}): Request => {
  const baseReq = {
    method: 'GET',
    url: '/',
    originalUrl: '/',
    path: '/',
    headers: {},
    params: {},
    query: {},
    body: {},
    cookies: {},
    signedCookies: {},
    app: {},
    res: {},
    get: jest.fn((header: string) => (baseReq.headers as Record<string, string>)[header.toLowerCase()]),
    header: jest.fn((header: string) => (baseReq.headers as Record<string, string>)[header.toLowerCase()]),
  };

  return { ...baseReq, ...overrides } as unknown as Request;
};

export const makeRes = (): Response => {
  const res: Record<string, any> = {
    locals: {},
    headersSent: false,
    statusCode: 200,
    get: jest.fn(),
    set: jest.fn(),
  };

  const chainableMethods = [
    'status',
    'json',
    'send',
    'end',
    'set',
    'header',
    'setHeader',
    'type',
    'cookie',
    'clearCookie',
    'redirect',
    'render',
    'format',
    'attachment',
    'download',
    'links',
    'location',
    'vary',
    'append',
  ];

  chainableMethods.forEach((method) => {
    res[method] = jest.fn().mockImplementation(function (this: any) {
      if (method === 'status' && arguments.length > 0) {
        res.statusCode = arguments[0];
      }
      return this;
    }.bind(res));
  });

  return res as unknown as Response;
};

export const makeNext = (): NextFunction => {
  return jest.fn() as unknown as NextFunction;
};
