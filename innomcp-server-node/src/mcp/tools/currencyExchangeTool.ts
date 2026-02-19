import { z } from "zod";
import axios from "axios";

/**
 * Currency Exchange Tool
 * Converts between currency codes using real-time exchange rates
 * API: exchangerate-api.com (free tier: 1500 requests/month)
 */

const API_BASE = "https://api.exchangerate-api.com/v4/latest";

// Popular currency codes
const POPULAR_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "THB", "AUD", "CAD", "CHF", "HKD",
  "SGD", "SEK", "KRW", "NOK", "NZD", "INR", "MXN", "ZAR", "BRL", "RUB"
];

export const currencyExchangeToolSchema = z.object({
  amount: z.number().describe("จำนวนเงินที่ต้องการแปลง"),
  fromCurrency: z.string().describe(`สกุลเงินต้นทาง (เช่น USD, EUR, THB). รองรับ: ${POPULAR_CURRENCIES.join(", ")}`),
  toCurrency: z.string().describe(`สกุลเงินปลายทาง (เช่น THB, USD, JPY). รองรับ: ${POPULAR_CURRENCIES.join(", ")}`),
});

export type CurrencyExchangeInput = z.infer<typeof currencyExchangeToolSchema>;

export const currencyExchangeTool = {
  name: "currencyExchangeTool",
  description: `
หน้าที่: แปลงสกุลเงินระหว่างประเทศด้วยอัตราแลกเปลี่ยนแบบ real-time
ใช้เมื่อ:
- ต้องการแปลงสกุลเงิน เช่น "แปลง 100 USD เป็น THB"
- ตรวจสอบอัตราแลกเปลี่ยนปัจจุบัน
- คำนวณราคาสินค้าข้ามประเทศ
- วางแผนการเดินทางต่างประเทศ

รองรับสกุลเงิน: USD, EUR, GBP, JPY, CNY, THB, AUD, CAD และอื่นๆ 160+ สกุล

ตัวอย่าง:
- "แปลง 100 USD เป็น THB"
- "100 เหรียญสหรัฐเป็นเงินไทยเท่าไร"
- "1000 บาทไทยเป็นเยนญี่ปุ่นได้กี่เยน"
- "อัตราแลกเปลี่ยน EUR ต่อ THB วันนี้"
`,
  inputSchema: currencyExchangeToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = currencyExchangeToolSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }

    const input = parsed.data;
    
    try {
      const { amount, fromCurrency, toCurrency } = input;
      
      // Validate amount
      if (amount <= 0) {
        throw new Error("จำนวนเงินต้องมากกว่า 0");
      }

      // Normalize currency codes (uppercase)
      const from = fromCurrency.toUpperCase();
      const to = toCurrency.toUpperCase();

      // Validate currency codes
      if (from.length !== 3 || to.length !== 3) {
        throw new Error("รหัสสกุลเงินต้องเป็น 3 ตัวอักษร เช่น USD, THB, EUR");
      }

      // Fetch exchange rates from API
      const response = await axios.get(`${API_BASE}/${from}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'INNOMCP/1.0'
        }
      });

      if (!response.data || !response.data.rates) {
        throw new Error("ไม่สามารถดึงข้อมูลอัตราแลกเปลี่ยนได้");
      }

      const rates = response.data.rates;
      const exchangeRate = rates[to];

      if (!exchangeRate) {
        throw new Error(`ไม่พบอัตราแลกเปลี่ยนสำหรับ ${to}`);
      }

      // Calculate converted amount
      const convertedAmount = amount * exchangeRate;

      const result = {
        amount,
        fromCurrency: from,
        toCurrency: to,
        convertedAmount: parseFloat(convertedAmount.toFixed(2)),
        exchangeRate: parseFloat(exchangeRate.toFixed(6)),
        timestamp: new Date().toISOString(),
        success: true
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการแปลงสกุลเงิน";
      
      const errorResult = {
        amount: input.amount,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        convertedAmount: 0,
        exchangeRate: 0,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMessage
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResult, null, 2)
          }
        ]
      };
    }
  }
};

export default currencyExchangeTool;
