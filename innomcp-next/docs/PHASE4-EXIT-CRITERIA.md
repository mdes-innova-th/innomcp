# Phase 4 Exit Criteria

## 1. Playwright loads app, 0 console errors

**English:** Playwright loads the application and there are zero console errors.  
**ไทย:** Playwright โหลดแอปพลิเคชันและไม่มีข้อผิดพลาดในคอนโซล (console errors) เลย

**Command (คำสั่ง):**  

npx playwright test --grep "should load without console errors"

Or, in a Playwright test file:

test('should load without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/');
  expect(errors.length).toBe(0);
});


**Expected Result (ผลลัพธ์ที่คาดหวัง):**  
**English:** The application loads successfully. No console errors appear in the browser developer tools or in Playwright's console monitoring. The test passes.  
**ไทย:** แอปพลิเคชันโหลดสำเร็จ ไม่มีข้อผิดพลาดในคอนโซลปรากฏในเครื่องมือนักพัฒนาของเบราว์เซอร์หรือในการตรวจสอบคอนโซลของ Playwright การทดสอบผ่าน

---

## 2. Three columns visible at 1440px viewport

**English:** At a viewport width of 1440px, three columns are visible in the main layout.  
**ไทย:** ที่ขนาด viewport กว้าง 1440px จะมองเห็นสามคอลัมน์ในเลย์เอาต์หลัก

**Command (คำสั��ง):**  

npx playwright test --grep "three columns should be visible at 1440px"

Or, in a Playwright test:

test('three columns visible at 1440px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Assume each column has a data-testid or class like .column
  const columns = page.locator('[data-testid="column"]');
  await expect(columns).toHaveCount(3);
  // Also verify they are visible
  for (let i = 0; i < 3; i++) {
    await expect(columns.nth(i)).toBeVisible();
  }
});


**Expected Result (ผลลัพธ์ที่คาดหวัง):**  
**English:** Three columns are displayed side by side. All columns are visible within the viewport without horizontal scrolling. The test passes.  
**ไทย:** แสดงสามคอลัมน์เรียงกันในแนวนอน ทุกคอลัมน์มองเห็นได้ภายใน viewport โดยไม่ต้องเลื่อนแนวนอน การทดสอบผ่าน

---

## 3. MDESBrandHeader at `top=0` after scrolling

**English:** When the user scrolls down, the MDESBrandHeader element becomes sticky and its `top` CSS property is `0`.  
**ไทย:** เมื่อผู้ใช้เลื่อนห��้าลง องค์ประกอบ MDESBrandHeader จะติดอยู่ด้านบน (sticky) และค่า CSS `top` เป็น `0`

**Command (คำสั่ง):**  

npx playwright test --grep "MDESBrandHeader should become sticky at top 0 after scroll"

Or, in a Playwright test:

test('MDESBrandHeader sticky after scroll', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('[data-testid="MDESBrandHeader"]');
  // Scroll down by 1000px
  await page.evaluate(() => window.scrollBy(0, 1000));
  // Wait for scroll to settle
  await page.waitForTimeout(500);
  const topValue = await header.evaluate(el => window.getComputedStyle(el).top);
  expect(topValue).toBe('0px');
});


**Expected Result (ผลลัพธ์ที่คาดหวัง):**  
**English:** After scrolling down, the MDESBrandHeader remains fixed at the top of the viewport with `top: 0`. The header does not scroll away. The test passes.  
**ไทย:** หลังจากเลื่อนลง  MDESBrandHeader จะตรึงอยู่ที่ด้านบนของ viewport ด้วยค่า `top: 0` ส่วนหัวไม่เลื่อนตามไป การทดสอบผ่าน

---

## 4. PanelErrorBoundary: force error in ManusWorkspacePanel → boundary shows, page doesn't blank

**English:** Simulate an error in the `ManusWorkspacePanel` component. The `PanelErrorBoundary` should catch the error, display a fallback UI (e.g., an error message and a retry button), and the rest of the page should remain functional (no blank screen).  
**ไทย:** จำลองข้อผิดพลาดในคอมโพเนนต์ `ManusWorkspacePanel` `PanelErrorBoundary` ควรจับข้อผิดพลาด แสดง UI สำรอง (เช่น ข้อความแสดงข้อผิดพลาดและปุ่มลองใหม่) และส่วนอื่น ๆ ของหน้ายังคงทำงานได้ (ไม่มีหน้าจอว่างเปล่า)

**Command (คำสั่ง):**  

npx playwright test --grep "PanelErrorBoundary should handle error in ManusWorkspacePanel"

Or, in a Playwright test (using a mechanism to trigger an error, e.g., via URL query parameter or internal state):

test('error in ManusWorkspacePanel displays boundary fallback and page not blank', async ({ page }) => {
  await page.goto('/?forceError=true');  // hypothetical trigger
  // Or use page.evaluate to throw an error inside the component
  // Wait for error boundary to render
  await page.waitForSelector('[data-testid="error-boundary-fallback"]');
  // Verify fallback is visible
  await expect(page.locator('[data-testid="error-boundary-fallback"]')).toBeVisible();
  // Verify that other parts of the page (e.g., header, other panels) are still visible
  await expect(page.locator('[data-testid="MDESBrandHeader"]')).toBeVisible();
  // Verify no blank page (i.e., page body has content)
  const bodyChildren = await page.evaluate(() => document.body.children.length);
  expect(bodyChildren).toBeGreaterThan(0);
});


**Expected Result (ผลลัพธ์ที่คาดหวัง):**  
**English:** The error boundary catches the error. A fallback UI (e.g., “Something went wrong” with a retry button) appears in place of the panel. The page does not become blank; the header, sidebar, and other areas remain visible and interactive. The test passes.  
**ไทย:** Error boundary จับข้อผิดพลาดได้ UI สำรอง (เช่น “เกิดข้อผิดพลาด” พร้อมปุ่มลองใหม่) ปรากฏแทนที่ panel หน้ายังไม่ว่างเปล่า ส่วนหัว แถบข้าง และพื้นที่อื่น ๆ ยังคงมองเห็นแล���ใช้งานได้ การทดสอบผ่าน

---

## 5. AgentStepsView: WS agent_step event → step row appears

**English:** When a WebSocket message with event type `agent_step` is received, the `AgentStepsView` component reacts by rendering a new step row in the step list.  
**ไทย:** เมื่อได้รับข้อความ WebSocket ที่มี event type `agent_step` คอมโพเนนต์ `AgentStepsView` จะตอบสนองโดยแสดงแถวขั้นตอนใหม่ในรายการขั้นตอน

**Command (คำสั่ง):**  

npx playwright test --grep "AgentStepsView should add step row on agent_step event"

Or, in a Playwright test:

test('agent_step event adds a step row', async ({ page }) => {
  await page.goto('/');
  // Simulate the WebSocket event via page.evaluate or via the app's event bus
  await page.evaluate(() => {
    // Assuming the app exposes a global event dispatcher or internal WebSocket mock
    window.__dispatchWebSocketEvent({ type: 'agent_step', data: { step: 1, description: 'Processing...' } });
  });
  // Wait for the step row to appear
  await page.waitForSelector('[data-testid="agent-step-row"]');
  const stepRows = page.locator('[data-testid="agent-step-row"]');
  await expect(stepRows).toHaveCount(1);
  // Optionally verify content
  await expect(stepRows.first()).toContainText('Processing...');
});


**Expected Result (ผลลัพธ์ที่คาดหวัง):**  
**English:** After the WebSocket `agent_step` event is dispatched, a new row representing the step appears in the `AgentStepsView` component. The row is visible and contains relevant step information (e.g., step number, description). The test passes.  
**ไทย:** หลังจากส่งเหตุการณ์ WebSocket `agent_step` แถวใหม่ที่แสดงถึงขั้นตอนนั้นจะปรากฏในคอมโพเนนต์ `AgentStepsView` แถวสามารถมองเห็นได้และมีข้อมูลขั้นตอนที่เกี่ยวข้อง (เช่น หมายเลขขั้นตอน, คำอธิบาย) การทดสอบผ่าน