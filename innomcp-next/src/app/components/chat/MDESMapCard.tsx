'use client';

import { useState, useCallback } from 'react';

interface GeoData {
  name: string; // ชื่อจังหวัด/อำเภอ/ตำบล
  type: 'province' | 'district' | 'subdistrict' | 'poi';
  region?: string; // ภาค (เหนือ/กลาง/ตะวันออกเฉียงเหนือ/ใต้/ออก/ตะวันตก)
  population?: number;
  area?: number; // ตารางกิโลเมตร
  latitude?: number;
  longitude?: number;
  stats?: Record<string, string | number>;
}

interface MDESMapCardProps {
  data: GeoData;
  className?: string;
}

const typeBadgeMap: Record<GeoData['type'], { label: string; color: string }> = {
  province: { label: 'จังหวัด', color: 'bg-blue-100 text-blue-800' },
  district: { label: 'อำเภอ', color: 'bg-green-100 text-green-800' },
  subdistrict: { label: 'ตำบล', color: 'bg-purple-100 text-purple-800' },
  poi: { label: 'สถานที่', color: 'bg-orange-100 text-orange-800' },
};

export default function MDESMapCard({ data, className = '' }: MDESMapCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('คัดลอกไม่สำเร็จ:', err);
    }
  }, []);

  const badge = typeBadgeMap[data.type];

  return (
    <div
      className={`bg-white shadow-md rounded-xl border border-gray-200 p-4 md:p-6 w-full max-w-md ${className}`}
      // Thai font rendering optimization – uses common Thai-optimized font stack
      style={{ fontFamily: '"Noto Sans Thai", Sarabun, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 leading-snug">
          {data.name}
        </h3>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">ประชากร</p>
          <p className="text-sm font-semibold text-gray-800">
            {data.population?.toLocaleString('th-TH') ?? 'ไม่มีข้อมูล'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">พื้นที่</p>
          <p className="text-sm font-semibold text-gray-800">
            {data.area ? `${data.area.toLocaleString('th-TH')} ตร.กม.` : 'ไม่มีข้อมูล'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-1">ภาค</p>
          <p className="text-sm font-semibold text-gray-800">
            {data.region || 'ไม่ระบุภาค'}
          </p>
        </div>
      </div>

      {/* Coordinates */}
      {(data.latitude !== undefined || data.longitude !== undefined) && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">พิกัดทางภูมิศาสตร์</h4>
          <div className="flex flex-col space-y-2">
            {data.latitude !== undefined && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">ละติจูด</span>
                  <code className="text-sm font-mono text-gray-800">
                    {data.latitude.toFixed(6)}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(data.latitude!.toFixed(6), 'lat')}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1 transition-colors"
                  aria-label={`คัดลอกละติจูด ${data.latitude.toFixed(6)}`}
                >
                  {copiedField === 'lat' ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
                </button>
              </div>
            )}
            {data.longitude !== undefined && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">ลองจิจูด</span>
                  <code className="text-sm font-mono text-gray-800">
                    {data.longitude.toFixed(6)}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(data.longitude!.toFixed(6), 'lng')}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1 transition-colors"
                  aria-label={`คัดลอกลองจิจูด ${data.longitude.toFixed(6)}`}
                >
                  {copiedField === 'lng' ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link to Google Maps */}
      {data.latitude !== undefined && data.longitude !== undefined && (
        <div className="mb-4">
          <a
            href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            เปิดใน Google Maps
          </a>
        </div>
      )}

      {/* Stats Table */}
      {data.stats && Object.keys(data.stats).length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">ข้อมูลเพิ่มเติม</h4>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หัวข้อ</th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ค่า</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(data.stats).map(([key, value]) => (
                  <tr key={key}>
                    <td className="px-4 py-2 text-sm text-gray-700">{key}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                      {typeof value === 'number' ? value.toLocaleString('th-TH') : value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}