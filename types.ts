export enum MosaicStyle {
  ROMAN_CLASSIC = 'ROMAN_CLASSIC',
  BYZANTINE_ICON = 'BYZANTINE_ICON',
  MODERN_ABSTRACT = 'MODERN_ABSTRACT',
  NATURAL_STONE = 'NATURAL_STONE'
}

export interface PaletteOption {
  id: MosaicStyle;
  name: string;
  description: string;
  colors: string[];
}

export interface PhysicalDimensions {
  width: number;
  height: number;
  unit: 'cm' | 'm' | 'in';
}

export interface AnalysisData {
  materials: { name: string; percentage: number; color: string }[];
  estimatedTesseraeCount: number;
  complexityScore: number;
  dimensions?: PhysicalDimensions;
}