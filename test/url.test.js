import { generateShortCode } from '../src/services/urlServices.js';
import { client } from '../src/services/redisService.js';
import request from 'supertest';
import app from '../src/app.js';


describe('generateShortCode', () => {
  it('should return a 6-character string', async () => {
    const code = await generateShortCode();
    expect(typeof code).toBe('string');
    expect(code).toHaveLength(6);
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

afterAll(async () => {
  await client.quit();
});