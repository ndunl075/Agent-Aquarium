type Name = 'fish' | 'settings' | 'camera' | 'mini' | 'close' | 'arrow' | 'leaf' | 'check' | 'play' | 'moon' | 'link' | 'refresh' | 'shield';
const paths: Record<Name, string> = {
  fish: 'M5 12c4-7 11-7 16 0-5 7-12 7-16 0Zm0 0-4-5v10l4-5Zm11-1h.01M9 6l3-3 3 3',
  settings: 'm9 3-.8 3-2.8 1L3 5.7.8 9.5 3 12l-2.2 2.5L3 18.3 5.4 17l2.8 1 .8 3h6l.8-3 2.8-1 2.4 1.3 2.2-3.8L21 12l2.2-2.5L21 5.7 18.6 7l-2.8-1L15 3H9Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  camera: 'M8 6 10 3h4l2 3h5v14H3V6h5Zm8 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  mini: 'M3 3h18v18H3V3Zm8 10h7v5h-7v-5',
  close: 'm6 6 12 12M6 18 18 6', arrow: 'M5 12h14m-5-5 5 5-5 5',
  leaf: 'M20 3C8 2 2 9 7 16s15 3 13-13ZM5 21 17 7',
  check: 'm5 12 4 4L19 6', play: 'm8 4 12 8-12 8V4Z',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  link: 'm10 13 4-4m-7 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  refresh: 'M20 7a9 9 0 1 0 1 9M20 3v5h-5',
  shield: 'm12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Zm-4 9 3 3 5-6',
};
export function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
