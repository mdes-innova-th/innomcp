"use client";

import React, { useState } from "react";

export default function TestSelectionPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTest = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3015"}/api/debug/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">🕵️ God-Tier Selection Debugger</h1>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 border border-gray-700">
          <label className="block text-gray-400 mb-2">Test Query</label>
          <div className="flex gap-4">
            <input
              type="text"
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. พรุ่งนี้ฝนตกไหม"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <button
              onClick={handleTest}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Testing..." : "Test Selection"}
            </button>
          </div>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </div>

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Summary Card */}
            <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Decision</h2>
              
              <div className="space-y-4">
                <div>
                  <span className="text-gray-400 block text-sm">Category</span>
                  <span className={`text-2xl font-bold ${getCategoryColor(result.router.category)}`}>
                    {result.router.category || "Unknown"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 block text-sm">Confidence</span>
                    <span className="text-lg font-mono text-green-400">
                      {(result.router.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-sm">Ambiguity</span>
                    <span className={`text-lg font-mono ${result.router.isAmbiguous ? 'text-red-400' : 'text-gray-500'}`}>
                      {result.router.isAmbiguous ? "YES" : "NO"}
                    </span>
                  </div>
                </div>

                <div>
                   <span className="text-gray-400 block text-sm">Latency</span>
                   <span className="text-yellow-400 font-mono">{result.router.latencyMs}ms</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-sm">Keywords</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.router.matchedKeywords?.length > 0 ? (
                      result.router.matchedKeywords.map((kw: string) => (
                        <span key={kw} className="bg-gray-700 text-xs px-2 py-1 rounded text-gray-300">
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-600 italic">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Reasoning Card */}
            <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Reasoning & details</h2>
              
              <div className="space-y-4 h-full"> 
                <div>
                   <span className="text-gray-400 block text-sm mb-1">Reasoning</span>
                   <p className="text-gray-300 text-sm italic bg-gray-900 p-3 rounded border border-gray-700">
                     "{result.router.reasoning || "No reasoning provided"}"
                   </p>
                </div>

                <div>
                   <span className="text-gray-400 block text-sm mb-1">Emotion</span>
                   <div className="flex items-center gap-2">
                      <span className="text-2xl">{getEmotionIcon(result.emotion?.emotion)}</span>
                      <span className="capitalize text-gray-300">{result.emotion?.emotion}</span>
                      <span className="text-xs text-gray-500">({(result.emotion?.confidence * 100).toFixed(0)}%)</span>
                   </div>
                </div>

                 <div>
                    <span className="text-gray-400 block text-sm mb-1">Scores</span>
                    <div className="text-xs font-mono text-gray-400">
                      Keyword: {result.router.keywordScore?.toFixed(2) ?? 'N/A'} | 
                      Semantic: {result.router.semanticScore?.toFixed(2) ?? 'N/A'}
                    </div>
                 </div>
              </div>
            </div>

            {/* Full JSON */}
            <div className="col-span-1 md:col-span-2 bg-gray-900 p-4 rounded border border-gray-800 overflow-x-auto">
               <h3 className="text-gray-500 text-xs uppercase mb-2">Raw Response</h3>
               <pre className="text-xs text-green-500 font-mono">
                 {JSON.stringify(result, null, 2)}
               </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getCategoryColor(category: string) {
  switch (category?.toLowerCase()) {
    case 'weather': return 'text-blue-400';
    case 'news': return 'text-purple-400';
    case 'crypto': return 'text-yellow-400';
    case 'general': return 'text-gray-400';
    default: return 'text-white';
  }
}

function getEmotionIcon(emotion: string) {
    const map: any = {
        neutral: "😐",
        happy: "😊",
        sad: "😢",
        angry: "😠",
        excited: "🤩",
        confused: "😕"
    };
    return map[emotion] || "😐";
}
