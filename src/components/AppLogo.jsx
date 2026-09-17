export default function AppLogo({ className = "" }) {
  return (
    <svg
      viewBox="0 0 480 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M240 40L40 120v240l200 80 200-80V120L240 40z"
        fill="#F59E0B"
        stroke="#1E3A5F"
        strokeWidth="24"
      />
      <path d="M240 40v160l200-80" fill="#FB923C" stroke="#1E3A5F" strokeWidth="24" />
      <path d="M240 200L40 120v240l200 80" fill="#EA580C" stroke="#1E3A5F" strokeWidth="24" />
      <path
        d="M240 180v120m0 0l-40-40m40 40l40-40"
        stroke="#1E3A5F"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
