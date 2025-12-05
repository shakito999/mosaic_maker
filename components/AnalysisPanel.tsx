import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AnalysisData } from '../types';

interface AnalysisPanelProps {
  data: AnalysisData | null;
  isLoading: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800 p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mb-4"></div>
        <p className="text-slate-400 text-sm animate-pulse">Analyzing flow logic and calculating material distribution...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
          </svg>
        </div>
        <p className="text-slate-400 text-sm">Generate a blueprint to unlock the material analysis.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 h-full">
      <h3 className="text-sm font-bold text-slate-300 tracking-widest mb-6 flex items-center gap-2">
        <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
        MATERIAL ANALYSIS
      </h3>

      <div className="flex flex-col gap-6">
        
        {/* Dimension Context */}
        {data.dimensions && (
            <div className="bg-slate-800/30 p-2 rounded text-center border border-slate-700/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Project Size</span>
                <p className="text-slate-300 font-serif">
                    {data.dimensions.width} {data.dimensions.unit} × {data.dimensions.height} {data.dimensions.unit}
                </p>
            </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                <span className="text-slate-400 text-xs uppercase block mb-1">Complexity</span>
                <div className="flex items-end gap-1">
                    <span className="text-2xl font-serif text-amber-400">{data.complexityScore}</span>
                    <span className="text-slate-500 text-sm mb-1">/10</span>
                </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                <span className="text-slate-400 text-xs uppercase block mb-1">Est. Tesserae</span>
                <div className="flex items-end gap-1">
                    <span className="text-2xl font-serif text-white">{data.estimatedTesseraeCount.toLocaleString()}</span>
                    <span className="text-slate-500 text-sm mb-1">pcs</span>
                </div>
            </div>
        </div>

        {/* Chart */}
        <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                data={data.materials}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="percentage"
                stroke="none"
                >
                {data.materials.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                    itemStyle={{ color: '#f1f5f9' }}
                />
                <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                />
            </PieChart>
            </ResponsiveContainer>
        </div>

        <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Palette Breakdown</p>
            {data.materials.map((m, i) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: m.color}}></div>
                        <span className="text-slate-300">{m.name}</span>
                    </div>
                    <span className="font-mono text-slate-400">{m.percentage}%</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;