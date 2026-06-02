/** Pine Design System — TeamPilot (H5). Tokens mirror web-admin/tailwind.config.js + DESIGN.md. */
const pine = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#5D9FB6", hover: "#3F7F92", soft: "#EAF5F7", border: "#CFE6EC" },
        ink: { DEFAULT: "#2E3333", soft: "#6C7374", weak: "#B3B7B9", disabled: "#D0D1D1" },
        line: "#E6E4E4",
        surface: { DEFAULT: "#FFFFFF", card: "rgba(255,255,255,0.95)", soft: "#F8F8F7", head: "#FAF9F8" },
        danger: { DEFAULT: "#FF4242", soft: "#FFF1F0", border: "#FFD8D6" },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Segoe UI"', "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.6" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["20px", { lineHeight: "1.4", letterSpacing: "-0.3px" }],
      },
      borderRadius: { none: "0", sm: "5px", DEFAULT: "5px", md: "10px", lg: "20px", xl: "20px", full: "999px" },
      boxShadow: {
        card: "0 16px 42px rgba(46,51,51,0.08)",
        dialog: "0 16px 42px rgba(46,51,51,0.10)",
      },
      backgroundImage: { canvas: "linear-gradient(180deg,#DCEAED 0%,#E9EEED 52%,#F3EFED 100%)" },
      transitionTimingFunction: { "out-quart": "cubic-bezier(0.25,1,0.5,1)" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.985)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in .2s cubic-bezier(0.25,1,0.5,1)",
        "pop-in": "pop-in .24s cubic-bezier(0.25,1,0.5,1)",
      },
    },
  },
  plugins: [],
};
export default pine;
