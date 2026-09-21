/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0E14',
          2: '#121620',
          3: '#181D2A',
        },
        line: '#232838',
        signal: {
          DEFAULT: '#5B5FEF',
          bright: '#7C80FF',
        },
        volt: '#C9FF3D',
        text: {
          DEFAULT: '#E7E9EE',
          muted: '#8B93A7',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      backgroundImage: {
        'grid-fade': 'linear-gradient(to bottom, rgba(11,14,20,0) 0%, #0B0E14 85%)',
      },
    },
  },
  plugins: [],
}
