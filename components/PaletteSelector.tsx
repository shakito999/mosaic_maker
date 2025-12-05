import React from 'react';
import { MosaicStyle, PaletteOption } from '../types';

interface PaletteSelectorProps {
  selectedStyle: MosaicStyle;
  onSelect: (style: MosaicStyle) => void;
}

const PALETTES: PaletteOption[] = [
  {
    id: MosaicStyle.ROMAN_CLASSIC,
    name: 'Roman Classic',
    description: 'Earth tones, terracotta, ochre, and limestone. Traditional andamento.',
    colors: ['#8B4513', '#D2691E', '#F5DEB3']
  },
  {
    id: MosaicStyle.NATURAL_STONE,
    name: 'Marble & Slate',
    description: 'High contrast greyscale using black and white marble.',
    colors: ['#1a1a1a', '#777777', '#f0f0f0']
  },
  {
    id: MosaicStyle.BYZANTINE_ICON,
    name: 'Byzantine Gold',
    description: 'Rich reds, deep blues, and gold leaf accents. Spiritual aesthetic.',
    colors: ['#FFD700', '#800020', '#000080']
  },
  {
    id: MosaicStyle.MODERN_ABSTRACT,
    name: 'Modern Glass',
    description: 'Vibrant Smalti glass with dynamic, energetic flow.',
    colors: ['#FF00FF', '#00FFFF', '#FFFF00']
  }
];

const PaletteSelector: React.FC<PaletteSelectorProps> = ({ selectedStyle, onSelect }) => {
  return (
    <div className="w-full">
      <h3 className="text-sm font-bold text-amber-500 tracking-widest mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
        SELECT TILE PALETTE
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PALETTES.map((palette) => (
          <button
            key={palette.id}
            onClick={() => onSelect(palette.id)}
            className={`
              relative p-4 rounded-lg border-2 text-left transition-all duration-300 group
              ${selectedStyle === palette.id 
                ? 'border-amber-400 bg-slate-800 shadow-[0_0_15px_rgba(251,191,36,0.2)]' 
                : 'border-slate-700 bg-slate-900 hover:border-slate-500'}
            `}
          >
            <div className="flex gap-2 mb-3">
              {palette.colors.map((color, i) => (
                <div 
                  key={i} 
                  className="w-4 h-4 rounded-full shadow-sm border border-white/10" 
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <h4 className={`font-serif text-lg mb-1 ${selectedStyle === palette.id ? 'text-amber-400' : 'text-slate-200'}`}>
              {palette.name}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {palette.description}
            </p>
            
            {selectedStyle === palette.id && (
              <div className="absolute top-2 right-2 text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaletteSelector;
