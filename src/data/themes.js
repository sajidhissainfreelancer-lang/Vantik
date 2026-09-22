// Swatches are just for the admin picker preview chips — the real colors
// live in src/styles/themes.css. Keep `id` in sync with the [data-theme]
// selectors there.
export const THEMES = [
  { id: 'futuristic', name: 'Futuristic', desc: 'Deep space navy with neon indigo + volt accents.', swatches: ['#0B0E14', '#5B5FEF', '#C9FF3D'] },
  { id: 'minimalism', name: 'Minimalism', desc: 'Near-white, generous space, almost no color.', swatches: ['#FAFAF9', '#161614', '#787874'] },
  { id: 'maximalism', name: 'Maximalism', desc: 'Clashing neon on near-black, turned up to 11.', swatches: ['#0A0814', '#FF0080', '#00FFC8'] },
  { id: 'vector-art', name: 'Vector Art', desc: 'Flat bold shapes, hard shadows, primary colors.', swatches: ['#F8F8FA', '#FF5A1F', '#1450FF'] },
  { id: 'collage-art', name: 'Collage Art', desc: 'Warm paper tones with a cut-and-paste feel.', swatches: ['#FAF4E6', '#BE3C28', '#D2A014'] },
  { id: 'retro', name: 'Retro', desc: '70s sepia and burnt orange, warm and analog.', swatches: ['#241814', '#E67828', '#DCBE3C'] },
  { id: 'pop-art', name: 'Pop Art', desc: 'Comic-book primaries, hard black outlines.', swatches: ['#FFFFFF', '#E61428', '#145ADC'] },
  { id: 'glassmorphism', name: 'Glassmorphism', desc: 'Frosted translucent panels over a blue glow.', swatches: ['#12162E', '#7890FF', '#FFFFFF'] },
  { id: 'neumorphism', name: 'Neumorphism', desc: 'Soft grey, extruded shadows, gentle depth.', swatches: ['#E1E5EB', '#5A6EE6', '#FFFFFF'] },
  { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon magenta and cyan, scanlines, dark alley.', swatches: ['#06040C', '#FF00AA', '#00FFDC'] },
  { id: 'clay', name: 'Clay Style', desc: 'Soft pastel claymorphism, big rounded corners.', swatches: ['#FFF0EB', '#FF8C6E', '#8CC8AA'] },
  { id: 'pixel-art', name: 'Pixel Art', desc: 'Chunky pixels, zero radius, retro-game font.', swatches: ['#14141E', '#FF5050', '#5ADC78'] },
  { id: 'editorial', name: 'Editorial', desc: 'Magazine serif headlines, cream, hairline rules.', swatches: ['#FAF8F4', '#96141E', '#1A1614'] },
  { id: 'y2k', name: 'Y2K', desc: 'Chrome gradients, bubble shapes, hot pink + cyan.', swatches: ['#F5F6FA', '#FF3CBE', '#3CDCFF'] },
  { id: 'swiss', name: 'Swiss Design', desc: 'Strict grid, red accent, bold grotesque type.', swatches: ['#FFFFFF', '#DC1414', '#0F0F0F'] },
  { id: 'surreal', name: 'Surreal Design', desc: 'Dreamlike duotone, orange and violet on ink.', swatches: ['#160E1E', '#FF6E3C', '#965AFF'] },
  { id: 'bohemian', name: 'Bohemian', desc: 'Earthy terracotta and olive, textured and warm.', swatches: ['#281E18', '#C8643C', '#96A05A'] },
  { id: 'victorian', name: 'Victorian', desc: 'Deep maroon and gold, ornate double borders.', swatches: ['#180E10', '#96141E', '#C8A53C'] },
  { id: 'graffiti', name: 'Graffiti', desc: 'Concrete grey with spray-paint red and green.', swatches: ['#121214', '#FF3C28', '#3CFF78'] },
  { id: 'aurora', name: 'Aurora', desc: 'Night sky with drifting teal and violet glow.', swatches: ['#080C14', '#3CDCB4', '#9678FF'] },
  { id: 'handwritten', name: 'Handwritten', desc: 'Warm paper, cursive headings, ink-blue accent.', swatches: ['#FCF8F0', '#2846A0', '#B43C3C'] },
  { id: 'liquid-glass', name: 'Liquid Glass', desc: 'Frosted glass over flowing color blobs.', swatches: ['#080E1E', '#82AAFF', '#FFFFFF'] },
]

export const DEFAULT_THEME = 'futuristic'
export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0]
