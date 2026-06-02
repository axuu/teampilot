// "Peeking robot" — champagne-gold mascot that pokes over the top-left of an AI bubble.
// Parent row uses `group`; the avatar lifts 2px on row hover. Decorative → aria-hidden.
export default function RobotAvatar({ className = "" }: { className?: string }) {
  return (
    <svg
      width="44"
      height="40"
      viewBox="0 0 44 40"
      fill="none"
      aria-hidden="true"
      className={`drop-shadow-[0_4px_8px_rgba(46,51,51,0.12)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5 ${className}`}
    >
      {/* antenna */}
      <line x1="22" y1="3" x2="22" y2="9" stroke="#C9A86A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="3" r="2.5" fill="#C9A86A" />
      {/* head */}
      <rect x="8" y="8" width="28" height="22" rx="9" fill="#E7D9B6" stroke="#C9A86A" strokeWidth="2" />
      {/* ears */}
      <rect x="4" y="14" width="4" height="9" rx="2" fill="#C9A86A" />
      <rect x="36" y="14" width="4" height="9" rx="2" fill="#C9A86A" />
      {/* face plate */}
      <rect x="13" y="13" width="18" height="12" rx="6" fill="#FFFFFF" />
      {/* eyes + smile */}
      <circle cx="18" cy="19" r="2" fill="#2C5B69" />
      <circle cx="26" cy="19" r="2" fill="#2C5B69" />
      <path d="M18.5 22.5q3.5 2 7 0" stroke="#2C5B69" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* little hands gripping the bubble edge */}
      <rect x="11" y="29" width="6" height="5" rx="2.5" fill="#C9A86A" />
      <rect x="27" y="29" width="6" height="5" rx="2.5" fill="#C9A86A" />
    </svg>
  );
}
