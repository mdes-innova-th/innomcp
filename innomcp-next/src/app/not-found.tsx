import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
          <span className="text-white font-bold text-xl">M</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">MDES INNOMCP</p>
          <p className="text-xs text-gray-400">กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม</p>
        </div>
      </div>

      {/* 404 Card */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <h1 className="text-6xl font-bold text-indigo-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          ไม่พบหน้าที่ต้องการ
        </h2>
        <p className="text-gray-500 mb-8">
          หน้าที่คุณต้องการอาจถูกย้ายหรือลบแล้ว
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-white font-medium transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          กลับหน้าหลัก
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400">
        © {new Date().getFullYear()} MDES Thailand — MCP Hub
      </p>
    </div>
  );
}