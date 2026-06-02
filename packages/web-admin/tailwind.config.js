/** Pine Design System — TeamPilot. Tokens mirror DESIGN.md; keep both web packages in sync. */
const pine = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#5D9FB6", hover: "#3F7F92", soft: "#EAF5F7", border: "#CFE6EC", ink: "#2C5B69" },
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
        menu: "0 8px 24px rgba(46,51,51,0.12)",
      },
      backgroundImage: { canvas: "linear-gradient(180deg,#DCEAED 0%,#E9EEED 52%,#F3EFED 100%)" },
      zIndex: { dropdown: "30", sticky: "40", backdrop: "50", modal: "60", toast: "70", tooltip: "80" },
      maxWidth: { doc: "680px", chat: "800px" },
      transitionTimingFunction: { "out-quart": "cubic-bezier(0.25,1,0.5,1)" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.985)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
        "toast-in": { from: { opacity: "0", transform: "translate(-50%,-10px)" }, to: { opacity: "1", transform: "translate(-50%,0)" } },
        "menu-in": { from: { opacity: "0", transform: "translateY(-4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in .2s cubic-bezier(0.25,1,0.5,1)",
        "pop-in": "pop-in .24s cubic-bezier(0.25,1,0.5,1)",
        "toast-in": "toast-in .24s cubic-bezier(0.25,1,0.5,1)",
        "menu-in": "menu-in .14s cubic-bezier(0.25,1,0.5,1)",
      },
    },
  },
  plugins: [],
};
export default pine;
