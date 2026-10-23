import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

/** App icon names mapped to SF Symbols (iOS) and Material Symbols (Android, future). */
const MAP = {
  home: ['house.fill', 'home'],
  camera: ['camera.fill', 'photo_camera'],
  scan: ['doc.viewfinder', 'document_scanner'],
  list: ['list.bullet.rectangle', 'receipt_long'],
  chart: ['chart.bar.xaxis', 'bar_chart'],
  pie: ['chart.pie.fill', 'pie_chart'],
  report: ['doc.text.fill', 'description'],
  settings: ['gearshape.fill', 'settings'],
  photo: ['photo.on.rectangle', 'photo_library'],
  pdf: ['doc.richtext', 'picture_as_pdf'],
  pencil: ['square.and.pencil', 'edit'],
  plus: ['plus', 'add'],
  'plus-circle': ['plus.circle.fill', 'add_circle'],
  check: ['checkmark', 'check'],
  'check-circle': ['checkmark.circle.fill', 'check_circle'],
  x: ['xmark', 'close'],
  'x-circle': ['xmark.circle.fill', 'cancel'],
  'chevron-right': ['chevron.right', 'chevron_right'],
  'chevron-down': ['chevron.down', 'expand_more'],
  'chevron-left': ['chevron.left', 'chevron_left'],
  alert: ['exclamationmark.triangle.fill', 'warning'],
  info: ['info.circle.fill', 'info'],
  inbox: ['tray.fill', 'inbox'],
  income: ['arrow.down.left.circle.fill', 'south_west'],
  expense: ['arrow.up.right.circle.fill', 'north_east'],
  wallet: ['wallet.bifold.fill', 'account_balance_wallet'],
  budget: ['gauge.with.dots.needle.33percent', 'speed'],
  clock: ['clock.fill', 'schedule'],
  tag: ['tag.fill', 'sell'],
  users: ['person.2.fill', 'group'],
  user: ['person.crop.circle.fill', 'account_circle'],
  lock: ['lock.fill', 'lock'],
  faceid: ['faceid', 'face'],
  globe: ['globe', 'language'],
  moon: ['moon.fill', 'dark_mode'],
  sheet: ['tablecells.fill', 'table_chart'],
  sync: ['arrow.triangle.2.circlepath', 'sync'],
  link: ['link', 'link'],
  share: ['square.and.arrow.up', 'ios_share'],
  download: ['arrow.down.doc.fill', 'download'],
  trash: ['trash.fill', 'delete'],
  search: ['magnifyingglass', 'search'],
  filter: ['line.3.horizontal.decrease.circle', 'filter_list'],
  building: ['building.2.fill', 'apartment'],
  cart: ['cart.fill', 'shopping_cart'],
  scale: ['scalemass.fill', 'scale'],
  sparkles: ['sparkles', 'auto_awesome'],
  shield: ['checkmark.shield.fill', 'verified_user'],
  history: ['clock.arrow.circlepath', 'history'],
  upload: ['icloud.and.arrow.up.fill', 'cloud_upload'],
  offline: ['wifi.slash', 'wifi_off'],
  trending: ['chart.line.uptrend.xyaxis', 'trending_up'],
  folder: ['folder.fill', 'folder'],
  key: ['key.fill', 'key'],
  swap: ['arrow.left.arrow.right', 'swap_horiz'],
  logout: ['rectangle.portrait.and.arrow.right', 'logout'],
  bolt: ['bolt.fill', 'bolt'],
  doc: ['doc.fill', 'draft'],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const [ios, android] = MAP[name];
  return (
    <SymbolView
      name={{ ios, android }}
      size={size}
      tintColor={color}
      weight="semibold"
      accessibilityElementsHidden
      importantForAccessibility="no"
      fallback={<View style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: color, opacity: 0.35 }} />}
    />
  );
}
