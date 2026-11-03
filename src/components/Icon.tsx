import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Ícones do design (design/Main.dc.html), traço de 1.8. */
const paths = {
  notes: ['M5 4h14v11l-5 5H5zM14 20v-5h5M8 9h8M8 13h4'],
  home: ['M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'],
  note: ['M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5'],
  book: ['M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10'],
  chart: ['M4 19V5M4 19h16M8 15l3-4 3 2 5-6'],
  sprout: ['M12 21v-9M12 12c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6zM12 14c0-3 2.2-5 6-5 0 3-2.2 5-6 5z'],
  pencil: ['M4 20l1-4L16 5l3 3L8 19zM14 7l3 3'],
  share: ['M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6'],
  bell: ['M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4'],
  plus: ['M12 5v14M5 12h14'],
  right: ['M9 5l7 7-7 7'],
  down: ['M7 10l5 5 5-5'],
  user: ['M4 20c0-4 4-6 8-6s8 2 8 6'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z'],
  news: ['M8 9h8M8 13h8M8 16h5'],
  search: ['M16 16l4 4'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  logo: ['M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM6 3v18M10 16c0-3 1.8-5 5-5 0 3-1.8 5-5 5zM12.5 16v-4'],
  sun: ['M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19'],
  cal: ['M8 3v4M16 3v4M4 10h16'],
  pin: ['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z'],
  lock: ['M8 11V8a4 4 0 0 1 8 0v3'],
  cloud: ['M8 2v1M2 8h1M3.8 3.8l.7.7M12.2 3.8l-.7.7', 'M8 20h9a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 13.5 3.3 3.3 0 0 0 8 20z'],
  x: ['M6 6l12 12M18 6L6 18'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  flag: ['M6 21V4M6 5h11l-2 4 2 4H6'],
  warn: ['M12 4l9 16H3zM12 10v4M12 17v.5'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z'],
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, color = '#000' }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths[name].map((d) => (
        <Path key={d} d={d} />
      ))}
      {name === 'pin' && <Circle cx={12} cy={10} r={2.5} />}
      {name === 'share' && (
        <>
          <Circle cx={6} cy={12} r={2.5} />
          <Circle cx={18} cy={6} r={2.5} />
          <Circle cx={18} cy={18} r={2.5} />
        </>
      )}
      {name === 'lock' && <Rect x={5} y={11} width={14} height={9} rx={2.5} />}
      {name === 'cloud' && <Circle cx={8} cy={8} r={3} />}
      {name === 'eye' && <Circle cx={12} cy={12} r={3} />}
      {name === 'cal' && <Rect x={4} y={5} width={16} height={15} rx={3} />}
      {name === 'camera' && <Circle cx={12} cy={13} r={3.5} />}
      {name === 'user' && <Circle cx={12} cy={8} r={4} />}
      {name === 'sun' && <Circle cx={12} cy={12} r={4} />}
      {name === 'search' && <Circle cx={11} cy={11} r={6} />}
      {name === 'news' && <Rect x={4} y={4} width={16} height={16} rx={3} />}
    </Svg>
  );
}
