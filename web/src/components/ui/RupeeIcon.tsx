/* Indian rupee sign in the same 24px stroke style as the Feather icons (react-icons/fi has no rupee). */
export function RupeeIcon(props: { size?: number }) {
  const size = props.size ?? 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12M6 9h12M9 4c3.5 0 6 1.6 6 5s-2.5 5-6 5H7l8 7" />
    </svg>
  );
}
