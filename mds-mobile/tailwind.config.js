/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [
    // Import the shared web config
    require('../mds-frontend/tailwind.config.js')
  ],
}
