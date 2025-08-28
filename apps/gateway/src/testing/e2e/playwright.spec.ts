import { test, expect } from '@playwright/test';

test.describe('AI Coaching Platform E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
  });

  test('Complete user workflow: record → analyze → review', async ({ page }) => {
    // 1. Landing page and navigation
    await expect(page).toHaveTitle(/AI Coaching/);
    await expect(page.locator('h1')).toContainText('AI-Powered Language Coaching');
    
    // Click on "Get Started" or "Sign In"
    await page.click('text=Get Started');
    
    // 2. Authentication flow
    await expect(page).toHaveURL(/.*auth.*/);
    
    // Fill in login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // 3. Dashboard navigation
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Navigate to recorder
    await page.click('text=New Session');
    await expect(page).toHaveURL(/.*recorder.*/);
    
    // 4. Recording setup
    await expect(page.locator('h2')).toContainText('Audio Recorder');
    
    // Test microphone
    await page.click('text=Test Mic');
    await expect(page.locator('text=Microphone Tested')).toBeVisible();
    
    // Check audio level meter
    const audioLevel = page.locator('.audio-level-meter');
    await expect(audioLevel).toBeVisible();
    
    // 5. Start recording
    await page.click('text=Start Recording');
    await expect(page.locator('text=Recording in progress')).toBeVisible();
    
    // Wait for recording timer to show
    const recordingTimer = page.locator('.recording-timer');
    await expect(recordingTimer).toBeVisible();
    
    // Simulate 2 minutes of recording
    await page.waitForTimeout(2000); // Reduced for testing
    
    // Stop recording
    await page.click('text=Stop Recording');
    await expect(page.locator('text=Your recording has been saved')).toBeVisible();
    
    // 6. Session processing
    await expect(page).toHaveURL(/.*session.*/);
    await expect(page.locator('text=Processing your session')).toBeVisible();
    
    // Wait for processing to complete
    await page.waitForSelector('text=Processing Complete', { timeout: 30000 });
    
    // 7. Session workspace
    await expect(page.locator('h2')).toContainText('Session Analysis');
    
    // Check transcript
    const transcript = page.locator('.transcript-section');
    await expect(transcript).toBeVisible();
    await expect(transcript).toContainText('Hello'); // Basic transcript content
    
    // Check timeline charts
    const timeline = page.locator('.timeline-charts');
    await expect(timeline).toBeVisible();
    
    // Check WPM chart
    const wpmChart = page.locator('.wpm-chart');
    await expect(wpmChart).toBeVisible();
    
    // Check pitch chart
    const pitchChart = page.locator('.pitch-chart');
    await expect(pitchChart).toBeVisible();
    
    // 8. Speech analysis panels
    const scoresPanel = page.locator('.speech-scores');
    await expect(scoresPanel).toBeVisible();
    
    const fluencyPanel = page.locator('.fluency-analysis');
    await expect(fluencyPanel).toBeVisible();
    
    // 9. Accept grammar suggestions
    const suggestions = page.locator('.grammar-suggestions');
    if (await suggestions.isVisible()) {
      const firstSuggestion = page.locator('.suggestion-item').first();
      await firstSuggestion.click();
      await page.click('text=Accept');
      await expect(page.locator('text=Suggestion applied')).toBeVisible();
    }
    
    // 10. Generate clips
    await page.click('text=Create Clip');
    await expect(page.locator('text=Clip Creation')).toBeVisible();
    
    // Set clip parameters
    await page.fill('input[name="startTime"]', '10');
    await page.fill('input[name="endTime"]', '30');
    await page.fill('input[name="title"]', 'Test Clip');
    await page.click('text=Generate Clip');
    
    // Wait for clip generation
    await page.waitForSelector('text=Clip ready', { timeout: 30000 });
    
    // 11. Export report
    await page.click('text=Export Report');
    await expect(page.locator('text=Report Generation')).toBeVisible();
    
    // Select PDF format
    await page.click('input[value="pdf"]');
    await page.click('text=Generate Report');
    
    // Wait for report generation
    await page.waitForSelector('text=Report ready', { timeout: 30000 });
    
    // Download report
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download Report');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    
    // 12. Navigate to dashboard
    await page.click('text=Dashboard');
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Check that session appears in recent sessions
    const recentSessions = page.locator('.recent-sessions');
    await expect(recentSessions).toContainText('Test Session');
    
    // 13. Check progress metrics
    const progressMetrics = page.locator('.progress-metrics');
    await expect(progressMetrics).toBeVisible();
    
    // Check WPM trend
    const wpmTrend = page.locator('.wpm-trend');
    await expect(wpmTrend).toBeVisible();
    
    // Check improvement indicators
    const improvementIndicators = page.locator('.improvement-indicators');
    await expect(improvementIndicators).toBeVisible();
  });

  test('Drills and practice exercises', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/auth');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Navigate to drills
    await page.click('text=Drills');
    await expect(page).toHaveURL(/.*drills.*/);
    
    // Check available drill types
    const drillTypes = page.locator('.drill-type');
    await expect(drillTypes).toHaveCount(5); // minimal pairs, pacing, shadowing, articulation, breathing
    
    // Start a minimal pairs drill
    await page.click('text=Minimal Pairs');
    await expect(page.locator('text=Minimal Pairs Practice')).toBeVisible();
    
    // Complete drill steps
    const drillSteps = page.locator('.drill-step');
    const stepCount = await drillSteps.count();
    
    for (let i = 0; i < Math.min(stepCount, 3); i++) {
      const currentStep = drillSteps.nth(i);
      await currentStep.click();
      
      // Listen to audio
      await page.click('text=Play Audio');
      await page.waitForTimeout(1000);
      
      // Record response
      await page.click('text=Start Recording');
      await page.waitForTimeout(2000);
      await page.click('text=Stop Recording');
      
      // Submit answer
      await page.click('text=Submit');
      await page.waitForTimeout(500);
    }
    
    // Check drill completion
    await expect(page.locator('text=Drill Complete')).toBeVisible();
    
    // Check score
    const score = page.locator('.drill-score');
    await expect(score).toBeVisible();
    expect(parseInt(await score.textContent())).toBeGreaterThan(0);
  });

  test('Real-time metrics and WebSocket communication', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/auth');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Start a new session
    await page.click('text=New Session');
    
    // Test microphone
    await page.click('text=Test Mic');
    await expect(page.locator('text=Microphone Tested')).toBeVisible();
    
    // Start recording
    await page.click('text=Start Recording');
    
    // Check real-time metrics
    const realtimeMetrics = page.locator('.realtime-metrics');
    await expect(realtimeMetrics).toBeVisible();
    
    // Check audio level updates
    const audioLevel = page.locator('.audio-level');
    await expect(audioLevel).toBeVisible();
    
    // Simulate speaking (audio level changes)
    await page.waitForTimeout(3000);
    
    // Check that metrics are updating
    const wpmDisplay = page.locator('.realtime-wpm');
    await expect(wpmDisplay).toBeVisible();
    
    // Stop recording
    await page.click('text=Stop Recording');
    
    // Check WebSocket connection status
    const wsStatus = page.locator('.websocket-status');
    await expect(wsStatus).toContainText('Connected');
  });

  test('Error handling and edge cases', async ({ page }) => {
    // Test without microphone permission
    await page.goto('http://localhost:3000');
    await page.click('text=Get Started');
    
    // Mock denied microphone permission
    await page.route('**/getUserMedia', route => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Permission denied' })
      });
    });
    
    await page.click('text=Test Mic');
    await expect(page.locator('text=Unable to access microphone')).toBeVisible();
    
    // Test network disconnection
    await page.route('**/*', route => {
      route.abort();
    });
    
    await page.click('text=New Session');
    await expect(page.locator('text=Connection error')).toBeVisible();
    
    // Restore network
    await page.unroute('**/*');
    
    // Test invalid file upload
    await page.goto('http://localhost:3000/dashboard');
    await page.click('text=Upload File');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('invalid file content')
    });
    
    await expect(page.locator('text=Invalid file type')).toBeVisible();
  });

  test('Responsive design and accessibility', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');
    
    // Check mobile navigation
    const mobileMenu = page.locator('.mobile-menu');
    await expect(mobileMenu).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    // Check tablet layout
    const tabletLayout = page.locator('.tablet-layout');
    await expect(tabletLayout).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    
    // Check desktop layout
    const desktopLayout = page.locator('.desktop-layout');
    await expect(desktopLayout).toBeVisible();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Test screen reader compatibility
    const ariaLabels = page.locator('[aria-label]');
    await expect(ariaLabels).toHaveCount(5); // Minimum required ARIA labels
    
    // Test color contrast
    const textElements = page.locator('p, h1, h2, h3, h4, h5, h6');
    await expect(textElements).toHaveCount(10); // Ensure sufficient text elements
  });

  test('Performance and load testing', async ({ page }) => {
    // Test page load performance
    const startTime = Date.now();
    await page.goto('http://localhost:3000');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    // Test dashboard load with multiple sessions
    await page.goto('http://localhost:3000/dashboard');
    
    // Check for performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });
    
    expect(performanceMetrics.domContentLoaded).toBeLessThan(1000);
    expect(performanceMetrics.loadComplete).toBeLessThan(2000);
    
    // Test concurrent operations
    await page.goto('http://localhost:3000/recorder');
    
    // Start multiple operations simultaneously
    await Promise.all([
      page.click('text=Test Mic'),
      page.click('text=Start Recording'),
      page.click('text=Settings')
    ]);
    
    // Should handle concurrent operations gracefully
    await expect(page.locator('.error-message')).not.toBeVisible();
  });
});
