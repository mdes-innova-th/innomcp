/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        flip: "flip 1.2s cubic-bezier(0.455, 0.030, 0.515, 0.955) infinite",
        wave: "wave 1.2s ease-in-out infinite",
        "bounce-delay-1": "bounce 1s infinite 0.15s",
        "bounce-delay-2": "bounce 1s infinite 0.3s",
      },
      keyframes: {
        flip: {
          "0%, 100%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(180deg)" },
        },
        wave: {
          "0%, 40%, 100%": {
            transform: "scaleY(0.4)",
            transformOrigin: "bottom",
          },
          "20%": {
            transform: "scaleY(1)",
            transformOrigin: "bottom",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
