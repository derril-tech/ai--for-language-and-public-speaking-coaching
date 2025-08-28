import { test, expect } from '@playwright/test';

test.describe('Chaos Engineering - AI Coaching Platform', () => {
  const BASE_URL = 'http://localhost:3000';
  const API_BASE_URL = 'http://localhost:3001';

  test('GPU node failure recovery', async ({ page }) => {
    // Simulate GPU node failure during ASR processing
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'GPU Failure Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');
    
    // Upload audio
    const audioBuffer = Buffer.from('mock audio data for GPU failure test');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-audio.wav',
      mimeType: 'audio/wav',
      buffer: audioBuffer
    });
    
    // Start processing
    await page.click('text=Start Processing');
    await page.waitForSelector('text=Processing started');
    
    // Simulate GPU failure by blocking ASR worker requests
    await page.route('**/asr-worker/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'GPU node unavailable' })
      });
    });
    
    // Wait for failure detection
    await page.waitForSelector('text=Processing failed', { timeout: 30000 });
    
    // Verify error message
    await expect(page.locator('.error-message')).toContainText('GPU node unavailable');
    
    // Restore GPU service
    await page.unroute('**/asr-worker/**');
    
    // Retry processing
    await page.click('text=Retry Processing');
    await page.waitForSelector('text=Processing resumed', { timeout: 10000 });
    
    // Wait for completion
    await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
    
    // Verify successful recovery
    await expect(page.locator('.session-status')).toContainText('completed');
    await expect(page.locator('.transcript')).toBeVisible();
  });

  test('S3 storage failure handling', async ({ page }) => {
    // Simulate S3 storage failure during file upload
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'S3 Failure Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');
    
    // Simulate S3 failure during upload
    await page.route('**/upload/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'S3 service unavailable' })
      });
    });
    
    // Try to upload file
    const audioBuffer = Buffer.from('mock audio data for S3 failure test');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-audio.wav',
      mimeType: 'audio/wav',
      buffer: audioBuffer
    });
    
    // Wait for upload failure
    await page.waitForSelector('text=Upload failed', { timeout: 10000 });
    
    // Verify error message
    await expect(page.locator('.error-message')).toContainText('S3 service unavailable');
    
    // Restore S3 service
    await page.unroute('**/upload/**');
    
    // Retry upload
    await page.click('text=Retry Upload');
    await page.waitForSelector('text=Upload successful', { timeout: 10000 });
    
    // Continue with processing
    await page.click('text=Start Processing');
    await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
  });

  test('Database connection failure recovery', async ({ page }) => {
    // Simulate database connection failure
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Simulate database failure
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' })
      });
    });
    
    // Try to create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'DB Failure Test');
    await page.click('button[type="submit"]');
    
    // Wait for database error
    await page.waitForSelector('text=Database connection failed', { timeout: 10000 });
    
    // Verify error handling
    await expect(page.locator('.error-message')).toContainText('Database connection failed');
    
    // Restore database connection
    await page.unroute('**/api/**');
    
    // Retry session creation
    await page.click('text=Retry');
    await page.waitForSelector('text=Session created', { timeout: 10000 });
  });

  test('NATS message broker failure', async ({ page }) => {
    // Simulate NATS message broker failure
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'NATS Failure Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');
    
    // Upload audio
    const audioBuffer = Buffer.from('mock audio data for NATS failure test');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-audio.wav',
      mimeType: 'audio/wav',
      buffer: audioBuffer
    });
    
    // Simulate NATS failure during processing
    await page.route('**/nats/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'NATS broker unavailable' })
      });
    });
    
    // Start processing
    await page.click('text=Start Processing');
    
    // Wait for NATS failure
    await page.waitForSelector('text=Message broker unavailable', { timeout: 30000 });
    
    // Verify error message
    await expect(page.locator('.error-message')).toContainText('NATS broker unavailable');
    
    // Restore NATS service
    await page.unroute('**/nats/**');
    
    // Retry processing
    await page.click('text=Retry Processing');
    await page.waitForSelector('text=Processing resumed', { timeout: 10000 });
    
    // Wait for completion
    await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
  });

  test('Redis cache failure handling', async ({ page }) => {
    // Simulate Redis cache failure
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Simulate Redis failure
    await page.route('**/cache/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Redis cache unavailable' })
      });
    });
    
    // Try to access cached data
    await page.click('text=Recent Sessions');
    
    // Wait for cache failure
    await page.waitForSelector('text=Cache unavailable', { timeout: 10000 });
    
    // Verify fallback to database
    await expect(page.locator('.fallback-message')).toContainText('Loading from database');
    
    // Restore Redis service
    await page.unroute('**/cache/**');
    
    // Verify cache recovery
    await page.reload();
    await expect(page.locator('.cache-status')).toContainText('Connected');
  });

  test('Worker service failure recovery', async ({ page }) => {
    // Test failure of individual worker services
    const workers = ['asr', 'prosody', 'fluency', 'scoring', 'drill', 'clip', 'report'];
    
    for (const worker of workers) {
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      // Create session
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `${worker} Worker Failure Test`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Session created');
      
      // Upload audio
      const audioBuffer = Buffer.from(`mock audio data for ${worker} worker failure test`);
      await page.setInputFiles('input[type="file"]', {
        name: 'test-audio.wav',
        mimeType: 'audio/wav',
        buffer: audioBuffer
      });
      
      // Simulate specific worker failure
      await page.route(`**/${worker}-worker/**`, route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: `${worker} worker unavailable` })
        });
      });
      
      // Start processing
      await page.click('text=Start Processing');
      
      // Wait for worker failure
      await page.waitForSelector(`text=${worker} worker unavailable`, { timeout: 30000 });
      
      // Verify error message
      await expect(page.locator('.error-message')).toContainText(`${worker} worker unavailable`);
      
      // Restore worker service
      await page.unroute(`**/${worker}-worker/**`);
      
      // Retry processing
      await page.click('text=Retry Processing');
      await page.waitForSelector('text=Processing resumed', { timeout: 10000 });
      
      // Wait for completion
      await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
      
      // Verify successful recovery
      await expect(page.locator('.session-status')).toContainText('completed');
    }
  });

  test('Network partition recovery', async ({ page }) => {
    // Simulate network partition between services
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'Network Partition Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');
    
    // Upload audio
    const audioBuffer = Buffer.from('mock audio data for network partition test');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-audio.wav',
      mimeType: 'audio/wav',
      buffer: audioBuffer
    });
    
    // Start processing
    await page.click('text=Start Processing');
    await page.waitForSelector('text=Processing started');
    
    // Simulate network partition by blocking inter-service communication
    await page.route('**/workers/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Network partition detected' })
      });
    });
    
    // Wait for partition detection
    await page.waitForSelector('text=Network partition detected', { timeout: 30000 });
    
    // Verify circuit breaker activation
    await expect(page.locator('.circuit-breaker')).toContainText('Open');
    
    // Restore network connectivity
    await page.unroute('**/workers/**');
    
    // Wait for circuit breaker to close
    await page.waitForSelector('text=Circuit breaker closed', { timeout: 30000 });
    
    // Retry processing
    await page.click('text=Retry Processing');
    await page.waitForSelector('text=Processing resumed', { timeout: 10000 });
    
    // Wait for completion
    await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
  });

  test('Memory leak detection', async ({ page }) => {
    // Monitor memory usage during repeated operations
    const memorySnapshots: number[] = [];
    
    // Take initial memory snapshot
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    memorySnapshots.push(initialMemory);
    
    // Perform repeated operations to detect memory leaks
    for (let i = 0; i < 20; i++) {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      // Create session
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `Memory Leak Test ${i}`);
      await page.click('button[type="submit"]');
      
      // Upload and process audio
      const audioBuffer = Buffer.from(`mock audio data ${i}`);
      await page.setInputFiles('input[type="file"]', {
        name: `test-${i}.wav`,
        mimeType: 'audio/wav',
        buffer: audioBuffer
      });
      
      await page.click('text=Start Processing');
      await page.waitForSelector('text=Processing Complete', { timeout: 30000 });
      
      // Navigate to different pages to test cleanup
      await page.click('text=Dashboard');
      await page.click('text=Drills');
      await page.click('text=Sessions');
      
      // Take memory snapshot every 5 iterations
      if (i % 5 === 0) {
        const currentMemory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return 0;
        });
        memorySnapshots.push(currentMemory);
      }
    }
    
    // Analyze memory growth
    const maxMemory = Math.max(...memorySnapshots);
    const memoryGrowth = maxMemory - initialMemory;
    const growthPercentage = (memoryGrowth / initialMemory) * 100;
    
    console.log(`Memory leak test results:`);
    console.log(`Initial memory: ${initialMemory} bytes`);
    console.log(`Maximum memory: ${maxMemory} bytes`);
    console.log(`Memory growth: ${memoryGrowth} bytes`);
    console.log(`Growth percentage: ${growthPercentage.toFixed(2)}%`);
    
    // Verify no significant memory leak (less than 20% growth)
    expect(growthPercentage).toBeLessThan(20);
  });

  test('Graceful degradation under load', async ({ page }) => {
    // Test system behavior under extreme load
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Simulate high load by making many concurrent requests
    const concurrentRequests = 50;
    const requests: Promise<any>[] = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(
        page.evaluate(async (index) => {
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Load Test ${index}`,
              description: `Concurrent load test ${index}`,
              language: 'en',
              duration: 60
            })
          });
          return response.status;
        }, i)
      );
    }
    
    // Wait for all requests to complete
    const responses = await Promise.all(requests);
    
    // Analyze response patterns
    const successfulRequests = responses.filter(status => status === 201).length;
    const rateLimitedRequests = responses.filter(status => status === 429).length;
    const serverErrors = responses.filter(status => status >= 500).length;
    
    console.log(`Graceful degradation test results:`);
    console.log(`Total requests: ${concurrentRequests}`);
    console.log(`Successful: ${successfulRequests}`);
    console.log(`Rate limited: ${rateLimitedRequests}`);
    console.log(`Server errors: ${serverErrors}`);
    
    // Verify graceful degradation
    expect(serverErrors).toBeLessThan(concurrentRequests * 0.1); // Less than 10% server errors
    expect(successfulRequests + rateLimitedRequests).toBeGreaterThan(concurrentRequests * 0.8); // Most requests handled
  });

  test('Data consistency under failures', async ({ page }) => {
    // Test data consistency during various failure scenarios
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'Data Consistency Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');
    
    const sessionId = await page.locator('.session-id').textContent();
    
    // Upload audio
    const audioBuffer = Buffer.from('mock audio data for consistency test');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-audio.wav',
      mimeType: 'audio/wav',
      buffer: audioBuffer
    });
    
    // Start processing
    await page.click('text=Start Processing');
    await page.waitForSelector('text=Processing started');
    
    // Simulate intermittent failures during processing
    let failureCount = 0;
    await page.route('**/workers/**', route => {
      failureCount++;
      if (failureCount % 3 === 0) { // Fail every 3rd request
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Intermittent failure' })
        });
      } else {
        route.continue();
      }
    });
    
    // Wait for processing to complete despite failures
    await page.waitForSelector('text=Processing Complete', { timeout: 120000 });
    
    // Verify data consistency
    await expect(page.locator('.session-status')).toContainText('completed');
    await expect(page.locator('.transcript')).toBeVisible();
    await expect(page.locator('.metrics')).toBeVisible();
    
    // Check that session data is consistent across different views
    await page.click('text=Dashboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate back to session
    await page.click(`text=${sessionId}`);
    await expect(page.locator('.session-status')).toContainText('completed');
    await expect(page.locator('.transcript')).toBeVisible();
  });
});
