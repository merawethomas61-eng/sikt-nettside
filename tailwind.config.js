/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './DashboardHome.tsx',
    './CodeIntegrationStep.tsx',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'DM Sans', 'sans-serif'],
        display: ['Georgia', 'Times New Roman', 'serif'],
        script: ['Georgia', 'serif'],
      },
      // Handbook-omlegging: den gamle lilla merkevaren er erstattet med portalens
      // varm-nøytrale grønn. Vi remapper Tailwinds `violet`/`indigo` til grønne toner
      // slik at alle eksisterende `violet-*`/`indigo-*`-klasser blir grønne automatisk.
      colors: {
        violet: {
          50: '#F3FBF6', 100: '#E8F1EB', 200: '#D6EEDF', 300: '#7CBE9F', 400: '#52A447',
          500: '#2E9E6B', 600: '#15795A', 700: '#15795A', 800: '#115C45', 900: '#0C4836', 950: '#08301F',
        },
        indigo: {
          50: '#F3FBF6', 100: '#E8F1EB', 200: '#D6EEDF', 300: '#7CBE9F', 400: '#3FA37D',
          500: '#2E9E6B', 600: '#15795A', 700: '#12674D', 800: '#115C45', 900: '#0C4836', 950: '#08301F',
        },
      },
    },
  },
  plugins: [],
}
