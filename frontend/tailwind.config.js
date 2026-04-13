/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        obsidian: {
          DEFAULT: '#050505',
          surface: '#0d0d0f',
          card: 'rgba(18,18,20,0.4)',
        },
      },
      backgroundImage: {
        'aurora-gradient': 'linear-gradient(to right, #06b6d4, #a855f7, #d946ef)',
      },
    },
  },
  plugins: [],
}
