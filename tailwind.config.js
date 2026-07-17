/** @type {import('tailwindcss').Config} */
module.exports = {
  // Specify the paths to all of your component files
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'green-black': '#081E15',      // Dark mode Green Black
        'dark-bg': '#0F2C20',          // Background dark mode and letters
        'light-letters': '#FFFFFF',    // Letters and Icons
        'green-bar': '#0C2B1F',        // Dark Mode Green bar
        'main-theme': '#0FB384',       // Main theme (solid mint/green)
        'light-green': '#E8F7F1',      // Light Green
        'green-white': '#F4FBF7',      // Background Green White and Letters
        'light-blue-btn': '#E0F2FE',   // Light Blue button
        'blue-btn': '#3B82F6',         // Blue Button
        'ocean-blue-btn': '#1D4ED8',   // Ocean Blue Button
        'light-bg-text': '#091E15',    // Text color for Light BG
        'light-bg-shade': '#6B7280',   // Shade of Text in Light bg
        'alt-accent': '#0068FF',       // Alternative Accent
      },
    },
  },
  plugins: [],
}
