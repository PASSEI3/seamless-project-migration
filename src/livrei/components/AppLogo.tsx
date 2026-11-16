import logo from '@/assets/livrei-icon.png.asset.json';

/** LIVREI app icon (books swapping), used wherever the brand mark appears. */
export function AppLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return <img src={logo.url} alt="LIVREI" className={`${className} rounded-[22%] object-cover`} />;
}
