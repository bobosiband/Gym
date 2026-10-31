import type { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Minimal `APIGatewayProxyEventV2` builder for handler tests.
 * The real event is huge; only the fields the handlers actually
 * read are set here.
 */
export function postEvent(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): APIGatewayProxyEventV2 {
  return baseEvent('POST', path, headers, {
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function getEvent(
  path: string,
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
  pathParameters: Record<string, string> = {}
): APIGatewayProxyEventV2 {
  return baseEvent('GET', path, headers, { queryStringParameters: query, pathParameters });
}

function baseEvent(
  method: 'GET' | 'POST' | 'OPTIONS',
  path: string,
  headers: Record<string, string>,
  overrides: Partial<APIGatewayProxyEventV2>
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: { 'content-type': 'application/json', ...headers },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'test.gym.local',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'req-test',
      routeKey: `${method} ${path}`,
      stage: 'test',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}
