```md
# INNOMCP Settings & Common Components Reference  
_เอกสารอ้างอิงคอมโพเนนต์การตั้งค่าและคอมโพเนนต์ทั่วไปของ INNOMCP_

This reference covers all reusable components in the **settings** and **common** directories of `innomcp-next/src/app/components/`. Each component is documented with its purpose in English and Thai, key React props, and where it is used within the INNOMCP platform. UI strings are displayed in Thai, aligning with the Government AI platform requirement.  
_เอกสารนี้รวบรวมคอมโพเนนต์ที่ใช้ซ้ำได้ในไดเร็กทอรี settings และ common ของ `innomcp-next/src/app/components/` โดยระบุวัตถุประสงค์เป็นภาษาไทยและอังกฤษ พร็อพสำคัญ และตำแหน่งที่ใช้ในระบบ ข้อความ UI ทั้งหมดใช้ภาษาไทยตามข้อกำหนดของแพลตฟอร์ม AI ภาครัฐ_

---

| Component | Purpose (English / ภาษาไทย) | Key Props | Where Used |
|-----------|------------------------------|-----------|------------|
| **ProviderCard** | Displays a single AI provider (Ollama, OpenAI, etc.) with status and quick actions. _แสดงการ์ดผู้ให้บริการ AI (Ollama, OpenAI ฯลฯ) พร้อมสถานะและปุ่มดำเนินการด่วน_ | `provider` (Provider object), `onEdit`, `onDelete`, `isActive` | ProviderList, /settings/providers |
| **ProviderList** | Renders a responsive grid of ProviderCards, supports selection and empty state. _แสดงการ์ด ProviderCard แบบกริด ตอบสนองต่อขนาดหน้าจอ รองรับการเลือกและสถานะว่าง_ | `providers` (Provider[]), `onSelect`, `selectedProviderId`, `onAddNew` | /settings/providers page |
| **ProviderModal** | Modal for adding or editing a provider (endpoint, API key, model). _หน้าต่าง Modal สำหรับเพิ่มหรือแก้ไขผู้ให้บริการ (จุดเชื่อมต่อ, คีย์ API, รุ่น)_ | `isOpen`, `onClose`, `provider?`, `onSave`, `mode` ('add'|'edit') | ProviderList |
| **INNOMCPSettingsPanel** | Main settings container managing global preferences (language, theme, accessibility). _แผงควบคุมหลักสำหรับจัดการการตั้งค่าระบบ (ภาษา, ธีม, ความสามารถในการเข้าถึง)_ | `settings` (object), `onSave`, `showAdvanced`, `children` | /settings page |
| **ModelSettingsSidebar** | Sidebar that adjusts model-specific parameters (temperature, top_p, max_tokens) during chat. _แถบด้านข้างสำหรับปรับพารามิเตอร์ของโมเดล (อุณหภูมิ, top_p, จำนวนโทเค็นสูงสุด) ขณะสนทนา_ | `currentModel`, `parameters`, `onParameterChange`, `isOpen`, `onClose` | Chat interface (right sidebar) |
| **ARIALiveRegion** | Invisible live region for announcing dynamic content to screen readers (status updates, errors). _พื้นที่ live region ที่ซ่อนไว้สำหรับประกาศเนื้อหาที่เปลี่ยนแปลงให้โปรแกรมอ่านหน้าจอ (อัปเดตสถานะ, ข้อผิดพลาด)_ | `message`, `politeness` ('polite','assertive'), `clearOnUpdate` | Global (AppShell) |
| **ChatSkeleton** | Loading placeholder mimicking chat bubbles with shimmer animation. _โครงร่างแสดงระหว่างโหลด เลียนแบบฟองสนทนาพร้อมแอนิเมชันระยิบระยับ_ | `lines` (number), `messageCount`, `avatar?` | Chat list, history panel |
| **FocusManager** | Traps focus within a container (modal, dialog) for keyboard accessibility. _จัดการโฟกัสคีย์บอร์ดให้อยู่ภายในคอนเทนเนอร์ (Modal, Dialog) เพื่อการเข้าถึง_ | `children`, `autoFocus`, `returnFocusOnClose` | ProviderModal, CommandSearch, any overlay |
| **INNOMCPAppShell** | Root layout shell containing Sidebar, Topbar, main content area, and global UI elements. _โครงสร้างเลย์เอาต์หลัก ประกอบด้วยแถบด้านข้าง แถบด้านบน พื้นที่เนื้อหา และองค์ประกอบ UI ส่วนกลาง_ | `children`, `sidebarContent`, `topbarProps`, `offlineBanner` | Root layout (app/layout.tsx) |
| **INNOMCPChangelog** | Displays version history and update notes in a styled timeline. _แสดงประวัติเวอร์ชันและบันทึกการอัปเดตในรูปแบบไทม์ไลน์_ | `version`, `items` (ChangelogItem[]), `onClose` | /changelog page, popover in AppShell |
| **INNOMCPCommandSearch** | Command palette (⌘K) for quick navigation and actions (model switch, new chat). _ช่องค้นหาคำสั่ง (⌘K) สำหรับนำทางและดำเนินการด่วน (เปลี่ยนโมเดล, สร้างแชทใหม่)_ | `commands`, `onExecute`, `isOpen`, `onClose`, `placeholder` | AppShell (triggered globally) |
| **INNOMCPOfflineBanner** | Banner shown when the app loses connectivity, with retry and status info. _แถบแจ้งเตือนเมื่อแอปพลิเคชันขาดการเชื่อมต่อ พร้อมปุ่มลองใหม่และข้อมูลสถานะ_ | `isOffline`, `onReconnect`, `lastOnline` | AppShell (top of page) |
| **MDESBadges** | Government ministry badge (MDES) and version/status indicators. _ตราสัญลักษณ์กระทรวงดิจิทัลฯ (MDES) และตัวบ่งชี้เวอร์ชัน/สถานะ_ | `type` ('ministry','version','beta'), `count?` | Topbar, About dialog |
| **MDESEmptyStates** | Consistent empty state illustrations with title, description, and optional CTA. _ภาพประกอบสถานะว่างที่สม่ำเสมอ พร้อมหัวข้อ คำอธิบาย และปุ่มดำเนินการ (ไม่บังคับ)_ | `icon`, `title`, `description`, `action`, `actionLabel` | Any list or search result (chats, providers) |
| **MDESOnboarding** | Multi-step onboarding flow for first-time users, with progress indicator. _ขั้นตอนเริ่มต้นใช้งานหลายขั้นตอนสำหรับผู้ใช้ใหม่ พร้อมตัวบ่งชี้ความคืบหน้า_ | `steps` (Step[]), `onComplete`, `onSkip`, `isOpen` | First visit (triggered by user flag) |
| **MDESProductTour** | Interactive product tour highlighting key UI features step by step. _ทัวร์แนะนำผลิตภัณฑ์แบบโต้ตอบ เน้นฟีเจอร์ UI ทีละขั้นตอน_ | `tourSteps` (TourStep[]), `onFinish`, `isActive`, `onClose` | AppShell (triggered from help menu) |
| **MDESThemeProvider** | Applies and toggles between light/dark/system themes using CSS variables. _ใช้และสลับธีม light/dark ตามระบบโดยใช้ CSS variables_ | `theme`, `children`, `defaultTheme` | Root provider (wraps entire app) |
| **MDESToastSystem** | Toast notification system with queue management, auto-dismiss, and variants. _ระบบแจ้งเตือนแบบ Toast พร้อมจัดการคิว การปิดอัตโนมัติ และรูปแบบต่าง ๆ_ | `toasts` (Toast[]), `removeToast`, `position` | AppShell (bottom-right) |
| **SkipNavigation** | Hidden “skip to main content” link for keyboard and screen reader users. _ลิงก์ “ข้ามไปยังเนื้อหาหลัก” ที่ซ่อนไว้สำหรับผู้ใช้คีย์บอร์ดและโปรแกรมอ่านหน้าจอ_ | `targetId` (string), `text` (default: ‘ข้ามไปยังเนื้อหา’) | Top of every page (body first child) |
| **UserAvatar** | Displays user avatar with fallback initials, supports online status and menu trigger. _แสดงรูปประจำตัวผู้ใช้ พร้อมตัวอักษรย่อสำรอง รองรับสถานะออนไลน์และเมนู_ | `user`, `size` ('sm','md','lg'), `onClick`, `showStatus` | Topbar, Sidebar, Comment threads |

---

> **Note**: All components accept standard HTML attributes and additional `className`/`style` props for styling. They are built with TypeScript strict mode and Tailwind CSS, ensuring full accessibility (WCAG 2.1 AA) and Thai language support.  
_หมายเหตุ: คอมโพเนนต์ทั้งหมดรองรับแอตทริบิวต์ HTML มาตรฐาน และ props `className`/`style` สำหรับปรับแต่งลักษณะ สร้างด้วย TypeScript โหมดเข้มงวดและ Tailwind CSS รองรับการเข้าถึง (WCAG 2.1 AA) และภาษาไทยอย่างสมบูรณ์_