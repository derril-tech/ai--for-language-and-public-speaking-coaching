import { test, expect } from '@playwright/test';

test.describe('Security Testing - AI Coaching Platform', () => {
  const BASE_URL = 'http://localhost:3000';
  const API_BASE_URL = 'http://localhost:3001';

  test('Authentication bypass attempts', async ({ page }) => {
    // Test various authentication bypass techniques
    const bypassAttempts = [
      { path: '/dashboard', description: 'Direct dashboard access' },
      { path: '/sessions', description: 'Direct sessions access' },
      { path: '/api/sessions', description: 'Direct API access' },
      { path: '/admin', description: 'Admin panel access' },
      { path: '/api/users', description: 'User data access' }
    ];

    for (const attempt of bypassAttempts) {
      await page.goto(`${BASE_URL}${attempt.path}`);
      
      // Should redirect to login or return 401/403
      const currentUrl = page.url();
      const isRedirectedToLogin = currentUrl.includes('/auth') || currentUrl.includes('/login');
      const hasError = await page.locator('text=Unauthorized, text=Forbidden, text=401, text=403').count() > 0;
      
      expect(isRedirectedToLogin || hasError).toBeTruthy();
      console.log(`${attempt.description}: ${isRedirectedToLogin ? 'Redirected to login' : 'Blocked with error'}`);
    }
  });

  test('SQL injection prevention', async ({ page }) => {
    // Test SQL injection attempts in various input fields
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "1' OR '1' = '1' --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --"
    ];

    // Test session creation with SQL injection
    await page.click('text=New Session');
    
    for (const payload of sqlInjectionPayloads) {
      await page.fill('input[name="title"]', payload);
      await page.click('button[type="submit"]');
      
      // Should not crash or expose database errors
      const hasError = await page.locator('text=SQL, text=database, text=error').count() > 0;
      const hasGenericError = await page.locator('text=Invalid input, text=Bad request').count() > 0;
      
      expect(hasError).toBeFalsy(); // No SQL errors should be exposed
      expect(hasGenericError).toBeTruthy(); // Should show generic error
      
      console.log(`SQL injection test "${payload}": ${hasError ? 'FAILED' : 'PASSED'}`);
    }
  });

  test('XSS prevention', async ({ page }) => {
    // Test XSS attempts in various input fields
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<svg onload="alert(\'XSS\')">',
      '"><script>alert("XSS")</script>',
      '&#x3C;script&#x3E;alert("XSS")&#x3C;/script&#x3E;'
    ];

    // Test session creation with XSS
    await page.click('text=New Session');
    
    for (const payload of xssPayloads) {
      await page.fill('input[name="title"]', payload);
      await page.click('button[type="submit"]');
      
      // Wait for response
      await page.waitForTimeout(1000);
      
      // Check if script was executed (should not be)
      const hasAlert = await page.locator('text=alert').count() > 0;
      const hasScript = await page.locator('script').count() > 0;
      const hasExecutedScript = await page.evaluate(() => {
        return document.querySelector('script') !== null;
      });
      
      expect(hasAlert).toBeFalsy();
      expect(hasExecutedScript).toBeFalsy();
      
      console.log(`XSS test "${payload}": ${hasAlert || hasExecutedScript ? 'FAILED' : 'PASSED'}`);
    }
  });

  test('CSRF protection', async ({ page }) => {
    // Test CSRF token validation
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Create session to get CSRF token
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'CSRF Test');
    
    // Extract CSRF token
    const csrfToken = await page.locator('input[name="_csrf"]').getAttribute('value');
    
    // Test request without CSRF token
    const responseWithoutToken = await page.evaluate(async () => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'CSRF Test Without Token' })
      });
      return res.status;
    });
    
    // Test request with invalid CSRF token
    const responseWithInvalidToken = await page.evaluate(async () => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token'
        },
        body: JSON.stringify({ title: 'CSRF Test With Invalid Token' })
      });
      return res.status;
    });
    
    // Both should be rejected
    expect(responseWithoutToken).toBe(403);
    expect(responseWithInvalidToken).toBe(403);
    
    console.log('CSRF protection: PASSED');
  });

  test('File upload security', async ({ page }) => {
    // Test malicious file uploads
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'File Upload Security Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');

    const maliciousFiles = [
      { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>', type: 'application/x-php' },
      { name: 'malicious.js', content: 'alert("malicious");', type: 'application/javascript' },
      { name: 'malicious.exe', content: 'MZ\x90\x00', type: 'application/x-executable' },
      { name: 'malicious.bat', content: '@echo off\nnet user', type: 'application/x-bat' },
      { name: 'malicious.sh', content: '#!/bin/bash\nrm -rf /', type: 'application/x-sh' }
    ];

    for (const file of maliciousFiles) {
      // Create file buffer
      const fileBuffer = Buffer.from(file.content);
      
      await page.setInputFiles('input[type="file"]', {
        name: file.name,
        mimeType: file.type,
        buffer: fileBuffer
      });
      
      // Should reject malicious files
      const hasError = await page.locator('text=Invalid file type, text=File not allowed, text=Security error').count() > 0;
      const hasSuccess = await page.locator('text=Upload successful, text=File uploaded').count() > 0;
      
      expect(hasError).toBeTruthy();
      expect(hasSuccess).toBeFalsy();
      
      console.log(`File upload security test "${file.name}": ${hasError ? 'PASSED' : 'FAILED'}`);
    }
  });

  test('Rate limiting', async ({ page }) => {
    // Test rate limiting on various endpoints
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Test API rate limiting
    const rapidRequests = 150; // Exceed rate limit
    const requests: Promise<any>[] = [];

    for (let i = 0; i < rapidRequests; i++) {
      requests.push(
        page.evaluate(async () => {
          const response = await fetch('/api/sessions', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return response.status;
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedRequests = responses.filter(status => status === 429).length;
    const successfulRequests = responses.filter(status => status === 200).length;

    // Should have rate limiting
    expect(rateLimitedRequests).toBeGreaterThan(0);
    expect(successfulRequests).toBeLessThan(rapidRequests);

    console.log(`Rate limiting test: ${rateLimitedRequests} requests rate limited out of ${rapidRequests}`);
  });

  test('Input validation and sanitization', async ({ page }) => {
    // Test various input validation scenarios
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const invalidInputs = [
      { field: 'title', value: '', description: 'Empty title' },
      { field: 'title', value: 'a'.repeat(1000), description: 'Very long title' },
      { field: 'title', value: '   ', description: 'Whitespace only title' },
      { field: 'description', value: 'a'.repeat(10000), description: 'Very long description' },
      { field: 'email', value: 'invalid-email', description: 'Invalid email format' },
      { field: 'email', value: 'test@', description: 'Incomplete email' }
    ];

    await page.click('text=New Session');

    for (const input of invalidInputs) {
      if (input.field === 'title') {
        await page.fill('input[name="title"]', input.value);
      } else if (input.field === 'description') {
        await page.fill('textarea[name="description"]', input.value);
      } else if (input.field === 'email') {
        await page.fill('input[name="email"]', input.value);
      }

      await page.click('button[type="submit"]');
      
      // Should show validation error
      const hasValidationError = await page.locator('text=Invalid, text=Required, text=Error').count() > 0;
      const hasSuccess = await page.locator('text=Session created').count() > 0;
      
      expect(hasValidationError).toBeTruthy();
      expect(hasSuccess).toBeFalsy();
      
      console.log(`Input validation test "${input.description}": ${hasValidationError ? 'PASSED' : 'FAILED'}`);
    }
  });

  test('Session security', async ({ page, context }) => {
    // Test session security measures
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Get session cookie
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(cookie => cookie.name.includes('session') || cookie.name.includes('token'));

    // Test session in new context (should not work)
    const newContext = await context.browser().newContext();
    const newPage = await newContext.newPage();
    
    if (sessionCookie) {
      await newContext.addCookies([sessionCookie]);
    }
    
    await newPage.goto(`${BASE_URL}/dashboard`);
    
    // Should not have access
    const isRedirected = newPage.url().includes('/auth');
    const hasError = await newPage.locator('text=Unauthorized, text=Forbidden').count() > 0;
    
    expect(isRedirected || hasError).toBeTruthy();
    
    await newContext.close();
    console.log('Session security test: PASSED');
  });

  test('API key security', async ({ page }) => {
    // Test API key validation
    const invalidApiKeys = [
      '',
      'invalid-key',
      '1234567890',
      'api-key-without-proper-format',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
    ];

    for (const apiKey of invalidApiKeys) {
      const response = await page.evaluate(async (key) => {
        const res = await fetch('/api/sessions', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': key
          }
        });
        return res.status;
      }, apiKey);

      // Should reject invalid API keys
      expect(response).toBe(401);
      console.log(`API key security test "${apiKey}": ${response === 401 ? 'PASSED' : 'FAILED'}`);
    }
  });

  test('Content Security Policy', async ({ page }) => {
    // Test CSP headers
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Check CSP header
    const response = await page.goto(`${BASE_URL}/dashboard`);
    const cspHeader = response.headers()['content-security-policy'];
    
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain('default-src');
    expect(cspHeader).toContain('script-src');
    expect(cspHeader).toContain('style-src');
    
    console.log('Content Security Policy test: PASSED');
    console.log(`CSP Header: ${cspHeader}`);
  });

  test('HTTPS enforcement', async ({ page }) => {
    // Test HTTPS enforcement (if applicable)
    await page.goto(`http://localhost:3000/dashboard`);
    
    // Should redirect to HTTPS or show security warning
    const currentUrl = page.url();
    const isHttps = currentUrl.startsWith('https://');
    const hasSecurityWarning = await page.locator('text=Insecure, text=Security warning').count() > 0;
    
    // In development, HTTP might be allowed, but should still have security measures
    const hasSecurityHeaders = await page.evaluate(() => {
      return document.querySelector('meta[http-equiv="Content-Security-Policy"]') !== null;
    });
    
    expect(hasSecurityHeaders || isHttps || hasSecurityWarning).toBeTruthy();
    
    console.log('HTTPS enforcement test: PASSED');
  });

  test('Data exposure prevention', async ({ page }) => {
    // Test for sensitive data exposure
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Check page source for sensitive data
    const pageContent = await page.content();
    
    // Should not expose sensitive information
    const sensitivePatterns = [
      /password.*=.*['"][^'"]+['"]/i,
      /api.*key.*=.*['"][^'"]+['"]/i,
      /secret.*=.*['"][^'"]+['"]/i,
      /token.*=.*['"][^'"]+['"]/i,
      /database.*url/i,
      /connection.*string/i
    ];

    for (const pattern of sensitivePatterns) {
      const matches = pageContent.match(pattern);
      expect(matches).toBeNull();
    }

    // Check response headers for sensitive information
    const response = await page.goto(`${BASE_URL}/dashboard`);
    const headers = response.headers();
    
    // Should not expose server information
    expect(headers['server']).toBeUndefined();
    expect(headers['x-powered-by']).toBeUndefined();
    
    console.log('Data exposure prevention test: PASSED');
  });

  test('Privilege escalation prevention', async ({ page }) => {
    // Test privilege escalation attempts
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Try to access admin endpoints
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/sessions',
      '/api/admin/metrics',
      '/admin/dashboard',
      '/api/users/1/admin'
    ];

    for (const endpoint of adminEndpoints) {
      const response = await page.evaluate(async (url) => {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        return res.status;
      }, endpoint);

      // Should be forbidden
      expect(response).toBe(403);
      console.log(`Privilege escalation test "${endpoint}": ${response === 403 ? 'PASSED' : 'FAILED'}`);
    }
  });

  test('Logout security', async ({ page }) => {
    // Test logout functionality
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Perform logout
    await page.click('text=Logout');
    await page.waitForURL('**/auth');

    // Try to access protected page
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Should be redirected to login
    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth');
    
    console.log('Logout security test: PASSED');
  });
});
