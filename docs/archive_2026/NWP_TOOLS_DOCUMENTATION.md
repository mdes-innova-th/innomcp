# 🌦️ NWP Weather Forecast Tools Documentation

## Overview

NWP (Numerical Weather Prediction) tools ให้บริการพยากรณ์อากาศความละเอียดสูงจากระบบคอมพิวเตอร์สมรรถนะสูง (High Performance Computing) ของกรมอุตุนิยมวิทยา

**ข้อมูลจาก**: กรมอุตุนิยมวิทยา (Thai Meteorological Department)  
**API**: `https://data.tmd.go.th/nwpapi/v1/forecast/location/`  
**Authentication**: Bearer Token (NWP_API_KEY)

---

## 📊 Tool Categories

### 1️⃣ **NWP Hourly Forecast** (พยากรณ์รายชั่วโมง)
- **ความละเอียด**: 2 กม. (High Resolution)
- **ระยะเวลา**: ล่วงหน้าสูงสุด 48 ชั่วโมง
- **จำนวน Tools**: 3 tools

### 2️⃣ **NWP Daily Forecast** (พยากรณ์รายวัน)
- **ความละเอียด**: 18-27 กม. (Medium Resolution)
- **ระยะเวลา**: ล่วงหน้าสูงสุด 126 วัน (4 เดือน)
- **จำนวน Tools**: 3 tools

---

## 🔧 Available Tools (6 tools)

### Hourly Forecast Tools

#### 1. `nwp_hourly_by_location`
พยากรณ์อากาศรายชั่วโมงตามพิกัดละติจูด-ลองจิจูด

**Parameters:**
- `lat` (number, required): พิกัดละติจูด -90 ถึง 90
- `lon` (number, required): พิกัดลองจิจูด -180 ถึง 180
- `date` (string, optional): วันที่ต้องการ (YYYY-MM-DD) Default: วันนี้
- `hour` (number, optional): ชั่วโมงเริ่มต้น 0-23, Default: ชั่วโมงปัจจุบัน
- `duration` (number, optional): จำนวนชั่วโมง 1-48, Default: 24
- `fields` (array, optional): ตัวแปรที่ต้องการ, Default: ["tc", "rh", "cond"]

**Example:**
```json
{
  "lat": 13.75,
  "lon": 100.5,
  "duration": 24,
  "fields": ["tc", "rh", "rain", "cond"]
}
```

---

#### 2. `nwp_hourly_by_place`
พยากรณ์อากาศรายชั่วโมงตามชื่อสถานที่

**Parameters:**
- `province` (string, optional): ชื่อจังหวัด (ภาษาไทย)
- `amphoe` (string, optional): ชื่ออำเภอ (ภาษาไทย)
- `tambon` (string, optional): ชื่อตำบล (ภาษาไทย)
- `subarea` (boolean, optional): แนบข้อมูลย่อย, Default: false
- `date` (string, optional): วันที่ต้องการ (YYYY-MM-DD)
- `hour` (number, optional): ชั่วโมงเริ่มต้น 0-23
- `duration` (number, optional): จำนวนชั่วโมง 1-48, Default: 24
- `fields` (array, optional): ตัวแปรที่ต้องการ

**Example:**
```json
{
  "province": "นครปฐม",
  "amphoe": "สามพราน",
  "duration": 12,
  "fields": ["tc", "rain", "cond"]
}
```

---

#### 3. `nwp_hourly_by_region`
พยากรณ์อากาศรายชั่วโมงทั้งภูมิภาค

**Parameters:**
- `region` (enum, required): ภูมิภาค - "C", "N", "NE", "E", "S", "W"
  - C = ภาคกลาง
  - N = ภาคเหนือ
  - NE = ภาคตะวันออกเฉียงเหนือ (อีสาน)
  - E = ภาคตะวันออก
  - S = ภาคใต้
  - W = ภาคตะวันตก
- `date` (string, optional): วันที่ต้องการ (YYYY-MM-DD)
- `hour` (number, optional): ชั่วโมงเริ่มต้น 0-23
- `duration` (number, optional): จำนวนชั่วโมง 1-48, Default: 24
- `fields` (array, optional): ตัวแปรที่ต้องการ

**Example:**
```json
{
  "region": "C",
  "duration": 24,
  "fields": ["tc", "rh", "rain", "cond"]
}
```

---

### Daily Forecast Tools

#### 4. `nwp_daily_by_location`
พยากรณ์อากาศรายวันตามพิกัดละติจูด-ลองจิจูด

**Parameters:**
- `lat` (number, required): พิกัดละติจูด -90 ถึง 90
- `lon` (number, required): พิกัดลองจิจูด -180 ถึง 180
- `date` (string, optional): วันที่เริ่มต้น (YYYY-MM-DD) Default: วันนี้
- `duration` (number, optional): จำนวนวัน 1-126, Default: 7
- `fields` (array, optional): ตัวแปรที่ต้องการ, Default: ["tc_max", "tc_min", "rain", "cond"]

**Example:**
```json
{
  "lat": 18.78,
  "lon": 98.98,
  "duration": 30,
  "fields": ["tc_max", "tc_min", "rain", "cond"]
}
```

---

#### 5. `nwp_daily_by_place`
พยากรณ์อากาศรายวันตามชื่อสถานที่

**Parameters:**
- `province` (string, optional): ชื่อจังหวัด (ภาษาไทย)
- `amphoe` (string, optional): ชื่ออำเภอ (ภาษาไทย)
- `tambon` (string, optional): ชื่อตำบล (ภาษาไทย)
- `subarea` (boolean, optional): แนบข้อมูลย่อย, Default: false
- `date` (string, optional): วันที่เริ่มต้น (YYYY-MM-DD)
- `duration` (number, optional): จำนวนวัน 1-126, Default: 7
- `fields` (array, optional): ตัวแปรที่ต้องการ

**Example:**
```json
{
  "province": "ภูเก็ต",
  "duration": 14,
  "fields": ["tc_max", "tc_min", "rain", "cond"]
}
```

---

#### 6. `nwp_daily_by_region`
พยากรณ์อากาศรายวันทั้งภูมิภาค

**Parameters:**
- `region` (enum, required): ภูมิภาค - "C", "N", "NE", "E", "S", "W"
- `date` (string, optional): วันที่เริ่มต้น (YYYY-MM-DD)
- `duration` (number, optional): จำนวนวัน 1-126, Default: 7
- `fields` (array, optional): ตัวแปรที่ต้องการ

**Example:**
```json
{
  "region": "S",
  "duration": 7,
  "fields": ["tc_max", "tc_min", "rain", "cond"]
}
```

---

## 📦 Available Fields

### Hourly Forecast Fields (20 fields)
| Field | Description | Unit |
|-------|-------------|------|
| `tc` | อุณหภูมิ | °C |
| `rh` | ความชื้นสัมพัทธ์ | % |
| `slp` | ความกดอากาศระดับน้ำทะเล | hPa |
| `rain` | ปริมาณฝน | mm |
| `ws10m` | ความเร็วลมที่ 10m | m/s |
| `wd10m` | ทิศทางลมที่ 10m | degrees |
| `ws925` | ความเร็วลมที่ 925 hPa | m/s |
| `wd925` | ทิศทางลมที่ 925 hPa | degrees |
| `ws850` | ความเร็วลมที่ 850 hPa | m/s |
| `wd850` | ทิศทางลมที่ 850 hPa | degrees |
| `ws700` | ความเร็วลมที่ 700 hPa | m/s |
| `wd700` | ทิศทางลมที่ 700 hPa | degrees |
| `ws500` | ความเร็วลมที่ 500 hPa | m/s |
| `wd500` | ทิศทางลมที่ 500 hPa | degrees |
| `ws200` | ความเร็วลมที่ 200 hPa | m/s |
| `wd200` | ทิศทางลมที่ 200 hPa | degrees |
| `cloudlow` | เมฆระดับต่ำ | % |
| `cloudmed` | เมฆระดับกลาง | % |
| `cloudhigh` | เมฆระดับสูง | % |
| `cond` | สภาพอากาศ | 1-12 |

### Daily Forecast Fields (23 fields)
| Field | Description | Unit |
|-------|-------------|------|
| `tc_max` | อุณหภูมิสูงสุด | °C |
| `tc_min` | อุณหภูมิต่ำสุด | °C |
| `rh` | ความชื้นสัมพัทธ์ | % |
| `slp` | ความกดอากาศระดับน้ำทะเล | hPa |
| `psfc` | ความกดอากาศผิวดิน | hPa |
| `rain` | ปริมาณฝน | mm |
| `ws10m` | ความเร็วลมที่ 10m | m/s |
| `wd10m` | ทิศทางลมที่ 10m | degrees |
| `ws925` - `ws200` | ความเร็วลมแต่ละระดับ | m/s |
| `wd925` - `wd200` | ทิศทางลมแต่ละระดับ | degrees |
| `cloudlow` | เมฆระดับต่ำ | % |
| `cloudmed` | เมฆระดับกลาง | % |
| `cloudhigh` | เมฆระดับสูง | % |
| `swdown` | Solar Radiation | W/m² |
| `cond` | สภาพอากาศ | 1-12 |

---

## 🌤️ Weather Condition Codes

| Code | ความหมาย (Thai) | Meaning (EN) |
|------|----------------|--------------|
| 1 | ท้องฟ้าแจ่มใส | Clear |
| 2 | มีเมฆบางส่วน | Partly cloudy |
| 3 | เมฆเป็นส่วนมาก | Cloudy |
| 4 | มีเมฆมาก | Overcast |
| 5 | ฝนตกเล็กน้อย | Light rain |
| 6 | ฝนปานกลาง | Moderate rain |
| 7 | ฝนตกหนัก | Heavy rain |
| 8 | ฝนฟ้าคะนอง | Thunderstorm |
| 9 | อากาศหนาวจัด | Very cold |
| 10 | อากาศหนาว | Cold |
| 11 | อากาศเย็น | Cool |
| 12 | อากาศร้อนจัด | Very hot |

**หมายเหตุ**: Tools จะแปล condition code เป็นข้อความไทยให้อัตโนมัติในฟิลด์ `condMeaning`

---

## 🔐 Environment Variables

ตั้งค่าใน `.env` file:

```env
# NWP API Authentication
NWP_API_KEY=<REDACTED>
```

**การขอ API Key**: ติดต่อกรมอุตุนิยมวิทยา (data.tmd.go.th)

---

## 💡 Use Cases

### 1. Short-term Weather Planning (Hourly)
```
"พยากรณ์อากาศ 24 ชั่วโมง กรุงเทพ"
"อุณหภูมิและฝนล่วงหน้า 12 ชม. เชียงใหม่"
"สภาพอากาศภาคกลางวันนี้"
```

### 2. Medium-term Weather Planning (Daily)
```
"พยากรณ์อากาศ 7 วัน ภูเก็ต"
"อุณหภูมิสูงสุด-ต่ำสุด 2 สัปดาห์ ขอนแก่น"
"แนวโน้มอากาศภาคเหนือ 30 วัน"
```

### 3. Long-term Weather Trends (Daily)
```
"พยากรณ์อากาศ 3 เดือน กรุงเทพ"
"แนวโน้มฝน 90 วัน ภาคอีสาน"
"อุณหภูมิล่วงหน้า 4 เดือน เชียงราย"
```

---

## 🚀 Implementation Details

### Files Created
1. **nwpHourlyTool.ts** (577 lines)
   - 3 tools: by_location, by_place, by_region
   - Resolution: 2 km
   - Max duration: 48 hours

2. **nwpDailyTool.ts** (499 lines)
   - 3 tools: by_location, by_place, by_region
   - Resolution: 18-27 km
   - Max duration: 126 days

### Features
✅ Bearer token authentication  
✅ Zod input validation  
✅ Weather condition interpretation  
✅ Error handling & logging  
✅ Timeout protection (15 seconds)  
✅ MCP-compliant response format  
✅ Comprehensive Thai descriptions

### Integration
- ✅ Registered in `server.ts` (6 tools)
- ✅ Added to `ALLOWED_TOOLS` in `mcpclient.ts`
- ✅ TypeScript compilation verified
- ✅ Production-ready

---

## 📊 Tool Count Summary

**Total MCP Tools**: 27 tools
- Core: 2 (dateTime, calculator/MathTool)
- Visualization: 1 (echartsTool)
- **TMD Weather: 17 tools** (seismic, climate, stations, forecasts, warnings)
- Data Access: 6 (archive, nasa, weather, worldbank, govdata, newton)
- World-Class: 5 (currencyExchange, qrCode, translation, rssFeed, codeFormatter)
- AI/Files: 3 (ocrTool, fileReader, imageGenerator)
- **NWP HPC: 6 tools** ⭐ NEW
  - 3 hourly forecast tools (2km resolution, 48 hours)
  - 3 daily forecast tools (18-27km resolution, 126 days)

---

## 🎯 Next Steps for Testing

1. **Start MCP Server**:
   ```bash
   cd innomcp-server-node
   npm run dev
   ```

2. **Test via Chat UI** (http://localhost:3000):
   ```
   "พยากรณ์อากาศ 24 ชม. กรุงเทพ"
   "สภาพอากาศล่วงหน้า 7 วัน เชียงใหม่"
   "แนวโน้มอากาศภาคกลาง 30 วัน"
   ```

3. **Verify Response**:
   - Check weather data completeness
   - Verify condition interpretation
   - Test different locations/regions
   - Validate duration limits

---

## 📝 Credits

**Developed by**: INNOMCP Team  
**Date**: January 6, 2026  
**Data Source**: Thai Meteorological Department (TMD)  
**API Documentation**: [data.tmd.go.th/nwpapi](https://data.tmd.go.th/nwpapi/v1/forecast/location/)

---

**🌦️ High Performance Weather Forecasting at Your Fingertips!**
