// Legend definitions with clinical colors (softer for light mode)
export const LEGENDS = [
  { code: '✓', label: 'Caries-free', color: 'bg-white border-2 border-neutral-300 dark:border-neutral-500', textColor: 'text-neutral-600 dark:text-neutral-300' },
  { code: 'C', label: 'For Filling', color: 'bg-blue-100 border border-blue-400 dark:bg-blue-600 dark:border-blue-500', textColor: 'text-blue-700 dark:text-white' },
  { code: 'X', label: 'For Extraction', color: 'bg-red-100 border border-red-400 dark:bg-red-600 dark:border-red-500', textColor: 'text-red-700 dark:text-white' },
  { code: 'R', label: 'Root Fragment', color: 'bg-purple-100 border border-purple-400 dark:bg-purple-600 dark:border-purple-500', textColor: 'text-purple-700 dark:text-white' },
  { code: 'M', label: 'Missing', color: 'bg-neutral-200 border border-neutral-400 dark:bg-neutral-500 dark:border-neutral-400', textColor: 'text-neutral-700 dark:text-white' },
  { code: 'F', label: 'Filled', color: 'bg-green-100 border border-green-400 dark:bg-green-600 dark:border-green-500', textColor: 'text-green-700 dark:text-white' },
  { code: 'G', label: 'Gold Crown', color: 'bg-yellow-100 border border-yellow-400 dark:bg-yellow-500 dark:border-yellow-400', textColor: 'text-yellow-700 dark:text-neutral-900' },
  { code: 'J', label: 'Jacket Crown', color: 'bg-orange-100 border border-orange-400 dark:bg-orange-500 dark:border-orange-400', textColor: 'text-orange-700 dark:text-white' },
  { code: 'AB', label: 'Abutment', color: 'bg-teal-100 border border-teal-400 dark:bg-teal-600 dark:border-teal-500', textColor: 'text-teal-700 dark:text-white' },
  { code: 'P', label: 'Pontic', color: 'bg-cyan-100 border border-cyan-400 dark:bg-cyan-600 dark:border-cyan-500', textColor: 'text-cyan-700 dark:text-white' },
  { code: 'FX', label: 'Fixed Bridge', color: 'bg-indigo-100 border border-indigo-400 dark:bg-indigo-600 dark:border-indigo-500', textColor: 'text-indigo-700 dark:text-white' },
  { code: 'RD', label: 'Removable Denture', color: 'bg-amber-100 border border-amber-500 dark:bg-amber-700 dark:border-amber-600', textColor: 'text-amber-800 dark:text-white' },
  { code: 'FD', label: 'Full Denture', color: 'bg-neutral-300 border border-neutral-500 dark:bg-neutral-700 dark:border-neutral-600', textColor: 'text-neutral-800 dark:text-white' },
];

// FDI tooth numbering system (Universal Numbering)
export const TOOTH_LAYOUT = {
  upper: {
    right: [18, 17, 16, 15, 14, 13, 12, 11],
    left: [21, 22, 23, 24, 25, 26, 27, 28],
  },
  lower: {
    right: [48, 47, 46, 45, 44, 43, 42, 41],
    left: [31, 32, 33, 34, 35, 36, 37, 38],
  },
};

// Oral findings checklist
export const ORAL_FINDINGS = [
  'CALCULUS',
  'DEBRIS',
  'DENTAL CARIES',
  'DENTAL DEFORMITIES',
  'GINGIVITIS',
  'NICOTINE/TETRACYCLINE STAINS',
  'ORTHODONTIC APPLIANCE U/L',
  'PERIODONTAL POCKET',
];

// Helper function to get legend by code
export const getLegend = (code) => LEGENDS.find(l => l.code === code);

// Maps frontend short codes to backend DB enum values
export const CODE_TO_ENUM = {
  '✓': 'PRESENT',
  'C':  'DUE_FILLING_DECAYED',
  'X':  'DUE_EXTRACTION',
  'R':  'ROOT_FRAGMENT',
  'M':  'MISSING',
  'F':  'FILLED',
  'G':  'GOLD_CROWN',
  'J':  'JACKET_CROWN',
  'AB': 'ABUTMENT',
  'P':  'PONTIC',
  'FX': 'FIXED_BRIDGE',
  'RD': 'REMOVABLE_DENTURE',
  'FD': 'FULL_DENTURE',
};

// Maps backend DB enum values to frontend short codes
export const ENUM_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_ENUM).map(([code, enumVal]) => [enumVal, code])
);
