import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  query: string;
  response: string;
  hasNWP: boolean;
  hasTMD: boolean;
  hasOpenMeteo: boolean;
  status: 'PASS' | 'FAIL' | 'ERROR';
  duration: number;
  timestamp: string;
}

const TEST_QUERIES = [
  'ตอนนี้ฝนตกไหม',
  'กรุงเทพฝนตกไหม',
  'พยากรณ์อากาศวันนี้',
  'สภาพอากาศกรุงเทพ',
  'อากาศเป็นอย่างไร'
];

const BACKEND_URL = 'http://localhost:3011';
const FRONTEND_URL = 'http://localhost:3000';

test.describe('Weather Query Auto-Test with NWP/TMD Verification', () => {
  let results: TestResult[] = [];
  
  test.beforeAll(async () => {
    console.log('\n='.repeat(70));
    console.log('🧪 Weather Query Auto-Test Started');
    console.log('='.repeat(70));
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log(`Backend: ${BACKEND_URL}`);
    console.log(`Total Queries: ${TEST_QUERIES.length}`);
    console.log(`Time: ${new Date().toISOString()}\n`);
  });

  for (const query of TEST_QUERIES) {
    test(`Weather Query: "${query}"`, async ({ page }) => {
      // Increase test timeout to 180 seconds (3 minutes)
      test.setTimeout(180000);
      test.slow(); // Triples the timeout
      
      const startTime = Date.now();
      
      console.log('\n' + '='.repeat(60));
      console.log(`🧪 Testing: ${query}`);
      console.log('='.repeat(60));

      try {
        // Navigate to frontend
        await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ Page loaded');

        // Wait for chat interface to be ready
        const inputField = page.locator('[data-testid="chat-input"]');
        await inputField.waitFor({ state: 'visible', timeout: 20000 });
        console.log('✅ Chat interface ready');

        // Type query and send
        await inputField.fill('');
        await inputField.fill(query);
        await page.waitForTimeout(300);
        await inputField.press('Enter');
        console.log(`📝 Sent: ${query}`);

        // Wait for response
        console.log('⏳ Waiting for response...');

        const aiMsgSel = '[data-testid="message-assistant"]';

        // Wait for AI message element to appear (up to 90s for weather pipeline)
        await page.locator(aiMsgSel).first().waitFor({ state: 'visible', timeout: 90000 });

        // Wait for streaming to stabilise: poll until text stops growing
        let responseText = '';
        let prevLen = 0;
        let stableHits = 0;
        for (let i = 0; i < 60; i++) {
          await page.waitForTimeout(1000);
          const msgs = page.locator(aiMsgSel);
          const count = await msgs.count();
          const text = (await msgs.nth(count - 1).textContent())?.trim() || '';
          if (text.length > 10 && text.length === prevLen) {
            stableHits++;
            if (stableHits >= 2) { responseText = text; break; }
          } else {
            stableHits = 0;
          }
          prevLen = text.length;
        }

        if (!responseText) {
          const msgs = page.locator(aiMsgSel);
          const count = await msgs.count();
          responseText = (await msgs.nth(count - 1).textContent())?.trim() || '';
        }

        if (!responseText) {
          throw new Error('No response received after 90 seconds');
        }

        const duration = Date.now() - startTime;
        
        console.log('\n' + '-'.repeat(60));
        console.log('Response:');
        console.log('-'.repeat(60));
        console.log(responseText.substring(0, 500));
        if (responseText.length > 500) {
          console.log(`... (${responseText.length - 500} more chars)`);
        }
        console.log('-'.repeat(60));

        // Analyze response
        const responseLower = responseText.toLowerCase();
        const hasNWP = /nwp|กรมอุตุฯ.*hpc|high.*performance.*computing/i.test(responseText);
        const hasTMD = /tmd|กรมอุตุนิยมวิทยา|กรมอุตุฯ/i.test(responseText);
        const hasPipeline = /weatherpipeline|weather\s*pipeline/i.test(responseText);
        const hasWeatherToken = /พยากรณ์อากาศ|พยากรณ์|สภาพอากาศ|อากาศ/.test(responseText);
        const hasOpenMeteo = /open-meteo|openweather/i.test(responseLower);

        let status: 'PASS' | 'FAIL' | 'ERROR' = 'FAIL';
        if (hasNWP || hasTMD || hasPipeline || hasWeatherToken) {
          status = 'PASS';
          console.log('\n✅ PASS: NWP/TMD or weather route detected!');
        } else if (hasOpenMeteo) {
          console.log('\n❌ FAIL: Open-Meteo/OpenWeather detected');
        } else {
          console.log('\n⚠️  UNKNOWN: No weather source detected');
        }

        console.log(`   - NWP: ${hasNWP ? '✅' : '❌'}`);
        console.log(`   - TMD: ${hasTMD ? '✅' : '❌'}`);
        console.log(`   - Open-Meteo: ${hasOpenMeteo ? '❌ (found)' : '✅ (not found)'}`);
        console.log(`   - Duration: ${duration}ms`);

        // Store result
        const result: TestResult = {
          query,
          response: responseText,
          hasNWP,
          hasTMD,
          hasOpenMeteo,
          status,
          duration,
          timestamp: new Date().toISOString()
        };
        results.push(result);

        // Assert for test framework
        expect(hasNWP || hasTMD || hasPipeline || hasWeatherToken).toBeTruthy();

      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`\n❌ ERROR: ${error}`);
        
        // Take screenshot on error (check if page is still open)
        try {
          if (!page.isClosed()) {
            const screenshotPath = path.join(__dirname, `../../screenshots/error-${Date.now()}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);
          } else {
            console.log('⚠️  Page already closed, cannot take screenshot');
          }
        } catch (screenshotError) {
          console.log(`⚠️  Could not take screenshot: ${screenshotError}`);
        }

        const result: TestResult = {
          query,
          response: `ERROR: ${error}`,
          hasNWP: false,
          hasTMD: false,
          hasOpenMeteo: false,
          status: 'ERROR',
          duration,
          timestamp: new Date().toISOString()
        };
        results.push(result);

        throw error;
      }
    });
  }

  test.afterAll(async () => {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Summary');
    console.log('='.repeat(70));

    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const errorCount = results.filter(r => r.status === 'ERROR').length;

    console.log(`Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount} | Error: ${errorCount}`);

    // Save results
    const resultsPath = path.join(__dirname, '../../playwright-weather-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);

    // Generate TODO list based on failures
    const todos = [];
    let todoId = 1;

    if (errorCount > 0) {
      todos.push({
        id: todoId++,
        title: 'Fix Frontend Automation Errors',
        description: `${errorCount}/${results.length} tests had errors. Check: 1) Frontend selectors 2) Page load timing 3) Screenshots for debugging`,
        status: 'not-started'
      });
    }

    if (failCount > 0 || (passCount === 0 && errorCount === 0)) {
      const failedQueries = results.filter(r => r.status === 'FAIL').map(r => r.query);
      todos.push({
        id: todoId++,
        title: 'Fix Weather Tool Selection',
        description: `${failCount}/${results.length} queries not using NWP/TMD. Failed queries: ${failedQueries.join(', ')}. Check: 1) Cache bypass 2) Priority boost 3) Tool selection logs`,
        status: 'not-started'
      });
    }

    if (results.some(r => r.hasOpenMeteo)) {
      todos.push({
        id: todoId++,
        title: 'Block Open-Meteo/OpenWeather Fallback',
        description: 'Old weather APIs still being used. Check fallback logic and error handling.',
        status: 'not-started'
      });
    }

    if (results.some(r => !r.hasNWP && !r.hasTMD && r.status !== 'ERROR')) {
      todos.push({
        id: todoId++,
        title: 'Verify AI Uses Selected Tools',
        description: 'Tools may be selected but AI not calling them or not including results in response.',
        status: 'not-started'
      });
    }

    // Save TODOs
    if (todos.length > 0) {
      const todosPath = path.join(__dirname, '../../playwright-todos.json');
      fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2));
      console.log(`\n📋 TODOs (${todos.length} items):`);
      todos.forEach(todo => {
        console.log(`  ${todo.id}. ${todo.title}`);
        console.log(`     → ${todo.description}`);
      });
      console.log(`\n💾 TODOs saved to: ${todosPath}`);
    } else {
      console.log('\n✅ All tests passed! No TODOs needed.');
    }

    // Display failed queries
    if (failCount > 0 || errorCount > 0) {
      console.log(`\n❌ Failed/Error Queries:`);
      results.filter(r => r.status !== 'PASS').forEach(r => {
        console.log(`  - ${r.query} [${r.status}]`);
      });
    }
  });
});
