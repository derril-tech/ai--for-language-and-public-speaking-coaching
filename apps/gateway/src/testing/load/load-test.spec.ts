import { test, expect } from '@playwright/test';

test.describe('Load Testing - AI Coaching Platform', () => {
  const BASE_URL = 'http://localhost:3000';
  const API_BASE_URL = 'http://localhost:3001';

  test('Concurrent user sessions', async ({ browser }) => {
    // Test multiple users creating sessions simultaneously
    const userCount = 20;
    const contexts = [];
    const pages = [];
    
    // Create multiple browser contexts
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    const startTime = Date.now();
    
    // Login all users concurrently
    const loginPromises = pages.map(async (page, index) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[name="email"]', `user${index}@example.com`);
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    await Promise.all(loginPromises);
    
    // Create sessions concurrently
    const sessionPromises = pages.map(async (page, index) => {
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `Load Test Session ${index}`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Session created');
    });
    
    await Promise.all(sessionPromises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`Concurrent user sessions test:`);
    console.log(`Users: ${userCount}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per user: ${totalTime / userCount}ms`);
    
    // Verify all sessions were created successfully
    for (const page of pages) {
      await expect(page.locator('.session-status')).toContainText('created');
    }
    
    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });

  test('High-frequency API requests', async ({ page }) => {
    // Test rapid API requests to the same endpoint
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    const requestCount = 100;
    const requests: Promise<any>[] = [];
    const startTime = Date.now();
    
    // Make rapid requests to dashboard API
    for (let i = 0; i < requestCount; i++) {
      requests.push(
        page.evaluate(async () => {
          const response = await fetch('/api/dashboard', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return response.status;
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const successfulRequests = responses.filter(status => status === 200).length;
    const rateLimitedRequests = responses.filter(status => status === 429).length;
    const failedRequests = responses.filter(status => status >= 500).length;
    
    console.log(`High-frequency API requests test:`);
    console.log(`Requests: ${requestCount}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Requests per second: ${(requestCount / (totalTime / 1000)).toFixed(2)}`);
    console.log(`Successful: ${successfulRequests}`);
    console.log(`Rate limited: ${rateLimitedRequests}`);
    console.log(`Failed: ${failedRequests}`);
    
    // Verify most requests succeeded
    expect(successfulRequests + rateLimitedRequests).toBeGreaterThan(requestCount * 0.9);
    expect(failedRequests).toBeLessThan(requestCount * 0.1);
  });

  test('Large file uploads', async ({ page }) => {
    // Test uploading large audio files
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Create session
    await page.click('text=New Session');
    await page.fill('input[name="title"]', 'Large File Upload Test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Session created');
    
    // Generate large audio file (10MB)
    const largeAudioBuffer = Buffer.alloc(10 * 1024 * 1024, 'A');
    
    const startTime = Date.now();
    
    // Upload large file
    await page.setInputFiles('input[type="file"]', {
      name: 'large-audio.wav',
      mimeType: 'audio/wav',
      buffer: largeAudioBuffer
    });
    
    await page.waitForSelector('text=Upload complete', { timeout: 60000 });
    
    const endTime = Date.now();
    const uploadTime = endTime - startTime;
    
    console.log(`Large file upload test:`);
    console.log(`File size: 10MB`);
    console.log(`Upload time: ${uploadTime}ms`);
    console.log(`Upload speed: ${(10 / (uploadTime / 1000)).toFixed(2)}MB/s`);
    
    // Verify upload success
    await expect(page.locator('.upload-status')).toContainText('complete');
  });

  test('Concurrent file processing', async ({ browser }) => {
    // Test multiple files being processed simultaneously
    const fileCount = 10;
    const contexts = [];
    const pages = [];
    
    // Create multiple browser contexts
    for (let i = 0; i < fileCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    // Login all users
    const loginPromises = pages.map(async (page, index) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[name="email"]', `user${index}@example.com`);
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    await Promise.all(loginPromises);
    
    // Create sessions and upload files concurrently
    const processingPromises = pages.map(async (page, index) => {
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `Concurrent Processing ${index}`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Session created');
      
      const audioBuffer = Buffer.from(`mock audio data for concurrent processing ${index}`);
      await page.setInputFiles('input[type="file"]', {
        name: `test-${index}.wav`,
        mimeType: 'audio/wav',
        buffer: audioBuffer
      });
      
      await page.click('text=Start Processing');
    });
    
    const startTime = Date.now();
    await Promise.all(processingPromises);
    
    // Wait for all processing to complete
    const completionPromises = pages.map(async (page) => {
      await page.waitForSelector('text=Processing Complete', { timeout: 120000 });
    });
    
    await Promise.all(completionPromises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`Concurrent file processing test:`);
    console.log(`Files: ${fileCount}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per file: ${totalTime / fileCount}ms`);
    console.log(`Files per minute: ${(fileCount / (totalTime / 60000)).toFixed(2)}`);
    
    // Verify all processing completed successfully
    for (const page of pages) {
      await expect(page.locator('.session-status')).toContainText('completed');
    }
    
    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });

  test('WebSocket connection stress', async ({ browser }) => {
    // Test many concurrent WebSocket connections
    const connectionCount = 50;
    const contexts = [];
    const pages = [];
    
    // Create multiple browser contexts
    for (let i = 0; i < connectionCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    // Login all users
    const loginPromises = pages.map(async (page, index) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[name="email"]', `user${index}@example.com`);
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    await Promise.all(loginPromises);
    
    // Establish WebSocket connections
    const connectionPromises = pages.map(async (page) => {
      await page.waitForSelector('.websocket-status', { timeout: 10000 });
      await expect(page.locator('.websocket-status')).toContainText('Connected');
    });
    
    const startTime = Date.now();
    await Promise.all(connectionPromises);
    const endTime = Date.now();
    
    console.log(`WebSocket connection stress test:`);
    console.log(`Connections: ${connectionCount}`);
    console.log(`Connection time: ${endTime - startTime}ms`);
    
    // Send messages through all connections
    const messagePromises = pages.map(async (page, index) => {
      await page.evaluate(async (index) => {
        // Simulate sending a message through WebSocket
        const ws = new WebSocket('ws://localhost:3001/ws');
        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'test_message',
            data: `Test message ${index}`,
            timestamp: Date.now()
          }));
        };
      }, index);
    });
    
    await Promise.all(messagePromises);
    
    // Verify all connections are still active
    for (const page of pages) {
      await expect(page.locator('.websocket-status')).toContainText('Connected');
    }
    
    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });

  test('Database query performance', async ({ page }) => {
    // Test database performance under load
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    const queryCount = 100;
    const queries: Promise<any>[] = [];
    const startTime = Date.now();
    
    // Perform various database queries
    for (let i = 0; i < queryCount; i++) {
      queries.push(
        page.evaluate(async (index) => {
          const queries = [
            { url: '/api/sessions', method: 'GET' },
            { url: '/api/metrics', method: 'GET' },
            { url: '/api/transcripts', method: 'GET' },
            { url: '/api/dashboard', method: 'GET' }
          ];
          
          const query = queries[index % queries.length];
          const response = await fetch(query.url, {
            method: query.method,
            headers: { 'Content-Type': 'application/json' }
          });
          
          return {
            status: response.status,
            responseTime: Date.now(),
            query: query.url
          };
        }, i)
      );
    }
    
    const results = await Promise.all(queries);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const successfulQueries = results.filter(r => r.status === 200).length;
    const failedQueries = results.filter(r => r.status >= 500).length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    
    console.log(`Database query performance test:`);
    console.log(`Queries: ${queryCount}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Queries per second: ${(queryCount / (totalTime / 1000)).toFixed(2)}`);
    console.log(`Successful: ${successfulQueries}`);
    console.log(`Failed: ${failedQueries}`);
    console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
    
    // Verify performance meets requirements
    expect(successfulQueries).toBeGreaterThan(queryCount * 0.95);
    expect(avgResponseTime).toBeLessThan(1000); // Less than 1 second average
  });

  test('Memory usage under load', async ({ page }) => {
    // Monitor memory usage during sustained load
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    const memorySnapshots: number[] = [];
    const operationCount = 50;
    
    // Take initial memory snapshot
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    memorySnapshots.push(initialMemory);
    
    // Perform sustained operations
    for (let i = 0; i < operationCount; i++) {
      // Create session
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `Memory Load Test ${i}`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Session created');
      
      // Upload file
      const audioBuffer = Buffer.from(`mock audio data ${i}`);
      await page.setInputFiles('input[type="file"]', {
        name: `test-${i}.wav`,
        mimeType: 'audio/wav',
        buffer: audioBuffer
      });
      
      // Start processing
      await page.click('text=Start Processing');
      await page.waitForSelector('text=Processing Complete', { timeout: 30000 });
      
      // Navigate to different pages
      await page.click('text=Dashboard');
      await page.click('text=Sessions');
      await page.click('text=Drills');
      
      // Take memory snapshot every 10 operations
      if (i % 10 === 0) {
        const currentMemory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return 0;
        });
        memorySnapshots.push(currentMemory);
      }
    }
    
    // Analyze memory usage
    const maxMemory = Math.max(...memorySnapshots);
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory - initialMemory;
    const peakMemory = maxMemory - initialMemory;
    
    console.log(`Memory usage under load test:`);
    console.log(`Operations: ${operationCount}`);
    console.log(`Initial memory: ${initialMemory} bytes`);
    console.log(`Final memory: ${finalMemory} bytes`);
    console.log(`Peak memory: ${maxMemory} bytes`);
    console.log(`Memory growth: ${memoryGrowth} bytes`);
    console.log(`Peak growth: ${peakMemory} bytes`);
    
    // Verify memory usage is reasonable
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    expect(peakMemory).toBeLessThan(100 * 1024 * 1024); // Less than 100MB peak
  });

  test('CPU usage under load', async ({ page }) => {
    // Monitor CPU usage during intensive operations
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    const cpuSnapshots: number[] = [];
    const operationCount = 30;
    
    // Take initial CPU snapshot
    const initialCPU = await page.evaluate(() => {
      return performance.now();
    });
    
    // Perform CPU-intensive operations
    for (let i = 0; i < operationCount; i++) {
      const startTime = performance.now();
      
      // Create session
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `CPU Load Test ${i}`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Session created');
      
      // Upload and process large file
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024, 'A');
      await page.setInputFiles('input[type="file"]', {
        name: `large-${i}.wav`,
        mimeType: 'audio/wav',
        buffer: largeBuffer
      });
      
      await page.click('text=Start Processing');
      await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
      
      const endTime = performance.now();
      const operationTime = endTime - startTime;
      cpuSnapshots.push(operationTime);
      
      // Navigate and perform additional operations
      await page.click('text=Dashboard');
      await page.click('text=Sessions');
      await page.click('text=Drills');
    }
    
    // Analyze CPU usage
    const avgOperationTime = cpuSnapshots.reduce((sum, time) => sum + time, 0) / cpuSnapshots.length;
    const maxOperationTime = Math.max(...cpuSnapshots);
    const minOperationTime = Math.min(...cpuSnapshots);
    
    console.log(`CPU usage under load test:`);
    console.log(`Operations: ${operationCount}`);
    console.log(`Average operation time: ${avgOperationTime.toFixed(2)}ms`);
    console.log(`Min operation time: ${minOperationTime.toFixed(2)}ms`);
    console.log(`Max operation time: ${maxOperationTime.toFixed(2)}ms`);
    
    // Verify CPU performance is acceptable
    expect(avgOperationTime).toBeLessThan(30000); // Less than 30 seconds average
    expect(maxOperationTime).toBeLessThan(120000); // Less than 2 minutes max
  });

  test('Network bandwidth stress', async ({ page }) => {
    // Test network performance under high bandwidth usage
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    const fileCount = 20;
    const fileSize = 2 * 1024 * 1024; // 2MB files
    const totalData = fileCount * fileSize;
    
    const startTime = Date.now();
    
    // Upload multiple files concurrently
    const uploadPromises = [];
    
    for (let i = 0; i < fileCount; i++) {
      uploadPromises.push(
        page.evaluate(async (index, size) => {
          const buffer = new ArrayBuffer(size);
          const file = new File([buffer], `bandwidth-test-${index}.wav`, { type: 'audio/wav' });
          
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          return response.status;
        }, i, fileSize)
      );
    }
    
    const results = await Promise.all(uploadPromises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const successfulUploads = results.filter(status => status === 200).length;
    const bandwidth = (totalData / (totalTime / 1000)) / (1024 * 1024); // MB/s
    
    console.log(`Network bandwidth stress test:`);
    console.log(`Files: ${fileCount}`);
    console.log(`File size: ${fileSize / (1024 * 1024)}MB each`);
    console.log(`Total data: ${totalData / (1024 * 1024)}MB`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Bandwidth: ${bandwidth.toFixed(2)}MB/s`);
    console.log(`Successful uploads: ${successfulUploads}`);
    
    // Verify bandwidth performance
    expect(successfulUploads).toBeGreaterThan(fileCount * 0.9);
    expect(bandwidth).toBeGreaterThan(1); // At least 1MB/s
  });

  test('Concurrent user interactions', async ({ browser }) => {
    // Test multiple users interacting with the system simultaneously
    const userCount = 15;
    const contexts = [];
    const pages = [];
    
    // Create multiple browser contexts
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    // Login all users
    const loginPromises = pages.map(async (page, index) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[name="email"]', `user${index}@example.com`);
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    await Promise.all(loginPromises);
    
    // Perform various user interactions concurrently
    const interactionPromises = pages.map(async (page, index) => {
      // Create session
      await page.click('text=New Session');
      await page.fill('input[name="title"]', `Interaction Test ${index}`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Session created');
      
      // Upload file
      const audioBuffer = Buffer.from(`mock audio data ${index}`);
      await page.setInputFiles('input[type="file"]', {
        name: `test-${index}.wav`,
        mimeType: 'audio/wav',
        buffer: audioBuffer
      });
      
      // Start processing
      await page.click('text=Start Processing');
      await page.waitForSelector('text=Processing Complete', { timeout: 60000 });
      
      // Navigate to different sections
      await page.click('text=Dashboard');
      await page.click('text=Drills');
      await page.click('text=Sessions');
      await page.click('text=Reports');
      
      // Perform drill exercises
      await page.click('text=Start Drill');
      await page.waitForTimeout(5000);
      await page.click('text=Complete Drill');
      
      // View reports
      await page.click('text=Generate Report');
      await page.waitForSelector('text=Report Generated', { timeout: 30000 });
    });
    
    const startTime = Date.now();
    await Promise.all(interactionPromises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`Concurrent user interactions test:`);
    console.log(`Users: ${userCount}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per user: ${totalTime / userCount}ms`);
    console.log(`Interactions per minute: ${(userCount / (totalTime / 60000)).toFixed(2)}`);
    
    // Verify all interactions completed successfully
    for (const page of pages) {
      await expect(page.locator('.session-status')).toContainText('completed');
      await expect(page.locator('.drill-status')).toContainText('completed');
      await expect(page.locator('.report-status')).toContainText('generated');
    }
    
    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });
});
