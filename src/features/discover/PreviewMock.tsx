import type { CSSProperties, ReactNode } from "react";
import type { MantineColor } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingStore,
  IconCake,
  IconCheck,
  IconClock,
  IconCoin,
  IconMapPinFilled,
  IconMotorbike,
  IconPhone,
  IconPizza,
  IconStarFilled,
} from "@tabler/icons-react";
import type { MockVariant } from "./catalog";
import classes from "./PreviewMock.module.css";

/**
 * Illustrative miniature of a PLANNED screen: abstract shapes, placeholder lines and icons only — no names, numbers,
 * prices or real data. Purely decorative (aria-hidden); the card around it says it is an illustration.
 */

type Size = "lg" | "sm";

const accentVars = (color: MantineColor) =>
  ({
    "--accent": `var(--mantine-color-${color}-6)`,
    "--accent-strong": `var(--mantine-color-${color}-8)`,
    "--accent-soft": `var(--mantine-color-${color}-1)`,
    "--accent-faint": `var(--mantine-color-${color}-0)`,
  }) as CSSProperties;

/** A placeholder text line of the given width (%). */
const Line = ({ w, strong, accent }: { w: number; strong?: boolean; accent?: boolean }) => (
  <span className={classes.line} data-strong={strong || undefined} data-accent={accent || undefined} style={{ width: `${w}%` }} />
);

const Rows = ({ children }: { children: ReactNode }) => <div className={classes.rows}>{children}</div>;
const Row = ({ children }: { children: ReactNode }) => <div className={classes.row}>{children}</div>;

const count = (size: Size, large: number, small: number) => (size === "lg" ? large : small);

const LEVELS = [82, 64, 22, 71, 46];
const BARS = [42, 58, 50, 74, 62, 88, 70, 80];
const HBARS = [88, 70, 56, 41, 28];
const WIDTHS = [62, 48, 70, 54, 66, 44];

/** A deterministic 21×21 QR-like pattern (finder squares in three corners, noise elsewhere). */
const QR_CELLS = (() => {
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) => x < 7 && y < 7;
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      const corner = finder(x, y) || finder(20 - x, y) || finder(x, 20 - y);
      if (corner) {
        const cx = x > 10 ? 20 - x : x;
        const cy = y > 10 ? 20 - y : y;
        const ring = Math.max(Math.abs(cx - 3), Math.abs(cy - 3));
        if (ring === 3 || ring <= 1) cells.push([x, y]);
      } else if ((x * 7 + y * 13 + x * y) % 5 < 2) {
        cells.push([x, y]);
      }
    }
  }
  return cells;
})();

const variants: Record<MockVariant, (size: Size) => ReactNode> = {
  levels: (size) => (
    <Rows>
      {LEVELS.slice(0, count(size, 5, 3)).map((level, i) => (
        <Row key={i}>
          <span className={classes.square} />
          <Line w={22 + ((i * 9) % 16)} />
          <span className={classes.track}>
            <span className={classes.fill} data-low={level < 30 || undefined} style={{ width: `${level}%` }} />
          </span>
        </Row>
      ))}
    </Rows>
  ),
  alerts: (size) => (
    <Rows>
      {[0, 1, 2, 3].slice(0, count(size, 4, 2)).map((i) => (
        <Row key={i}>
          <span className={classes.iconDot} data-tone={i === 0 ? "danger" : undefined}>
            {i === 0 ? <IconAlertTriangle size={11} /> : <IconCheck size={11} />}
          </span>
          <Line w={30 + i * 8} strong={i === 0} />
          <span className={classes.spacer} />
          <span className={classes.pill} data-tone={i === 0 ? "danger" : "muted"} />
        </Row>
      ))}
    </Rows>
  ),
  breakdown: (size) => (
    <div className={classes.column}>
      <div className={classes.stack}>
        {[38, 26, 20, 16].map((width, i) => (
          <span key={i} style={{ width: `${width}%`, opacity: 1 - i * 0.22 }} />
        ))}
      </div>
      <Rows>
        {[0, 1, 2, 3].slice(0, count(size, 4, 2)).map((i) => (
          <Row key={i}>
            <span className={classes.legendDot} style={{ opacity: 1 - i * 0.22 }} />
            <Line w={34 + i * 6} />
            <span className={classes.spacer} />
            <Line w={14} strong />
          </Row>
        ))}
      </Rows>
    </div>
  ),
  contacts: (size) => (
    <Rows>
      {[0, 1, 2, 3].slice(0, count(size, 4, 2)).map((i) => (
        <Row key={i}>
          <span className={classes.avatar} data-shape="square">
            <IconBuildingStore size={12} />
          </span>
          <span className={classes.text}>
            <Line w={WIDTHS[i]} strong />
            <Line w={WIDTHS[i + 1] - 18} />
          </span>
          <span className={classes.iconDot}>
            <IconPhone size={11} />
          </span>
        </Row>
      ))}
    </Rows>
  ),
  orders: (size) => (
    <Rows>
      {[0, 1, 2, 3].slice(0, count(size, 4, 2)).map((i) => (
        <Row key={i}>
          <Line w={18} strong />
          <Line w={WIDTHS[i] - 10} />
          <span className={classes.spacer} />
          <span className={classes.pill} data-tone={i === 0 ? "accent" : i === 1 ? "soft" : "muted"} />
        </Row>
      ))}
    </Rows>
  ),
  hbars: (size) => (
    <Rows>
      {HBARS.slice(0, count(size, 5, 3)).map((width, i) => (
        <Row key={i}>
          <Line w={22} />
          <span className={classes.hbar} style={{ width: `${width * 0.7}%`, opacity: 1 - i * 0.14 }} />
        </Row>
      ))}
    </Rows>
  ),
  profile: (size) => (
    <div className={classes.column}>
      <Row>
        <span className={classes.avatar} data-shape="round" data-large={size === "lg" || undefined} />
        <span className={classes.text}>
          <Line w={56} strong />
          <Line w={38} />
        </span>
      </Row>
      <div className={classes.chips}>
        <span className={classes.pill} data-tone="soft" />
        <span className={classes.pill} data-tone="accent" />
        {size === "lg" ? <span className={classes.pill} data-tone="muted" /> : null}
      </div>
      {size === "lg" ? (
        <Rows>
          {[0, 1].map((i) => (
            <Row key={i}>
              <span className={classes.legendDot} />
              <Line w={52 - i * 12} />
            </Row>
          ))}
        </Rows>
      ) : null}
    </div>
  ),
  stamps: (size) => (
    <div className={classes.column}>
      <Line w={44} strong />
      <div className={classes.stamps} data-size={size}>
        {Array.from({ length: count(size, 10, 6) }, (_, i) => (
          <span key={i} data-on={i < count(size, 7, 4) || undefined}>
            {i < count(size, 7, 4) ? <IconStarFilled size={size === "lg" ? 12 : 9} /> : null}
          </span>
        ))}
      </div>
      {size === "lg" ? (
        <span className={classes.track}>
          <span className={classes.fill} style={{ width: "70%" }} />
        </span>
      ) : null}
    </div>
  ),
  giftcard: (size) => (
    <div className={classes.giftcard} data-size={size}>
      <span className={classes.giftIcon}>
        <IconPizza size={size === "lg" ? 22 : 15} />
      </span>
      <span className={classes.giftChip} />
      <span className={classes.giftLines}>
        <span />
        <span />
      </span>
    </div>
  ),
  messages: (size) => (
    <div className={classes.chat}>
      <span className={classes.bubble} data-side="in">
        <Line w={80} />
        {size === "lg" ? <Line w={56} /> : null}
      </span>
      <span className={classes.bubble} data-side="out">
        <Line w={84} accent />
        {size === "lg" ? <Line w={62} accent /> : null}
      </span>
      {size === "lg" ? (
        <span className={classes.bubble} data-side="in">
          <Line w={48} />
        </span>
      ) : null}
    </div>
  ),
  donut: (size) => (
    <div className={classes.split}>
      <svg viewBox="0 0 42 42" className={classes.donut}>
        {[
          [40, 0],
          [25, 40],
          [20, 65],
          [15, 85],
        ].map(([share, offset], i) => (
          <circle
            key={i}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            strokeWidth="6"
            stroke="var(--accent)"
            strokeOpacity={1 - i * 0.24}
            strokeDasharray={`${share - 1.5} ${100 - share + 1.5}`}
            strokeDashoffset={25 - offset}
          />
        ))}
      </svg>
      <Rows>
        {[0, 1, 2, 3].slice(0, count(size, 4, 2)).map((i) => (
          <Row key={i}>
            <span className={classes.legendDot} style={{ opacity: 1 - i * 0.24 }} />
            <Line w={70 - i * 10} />
          </Row>
        ))}
      </Rows>
    </div>
  ),
  celebration: (size) => (
    <div className={classes.celebration}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={classes.confetti} style={{ insetInlineStart: `${8 + i * 10}%`, top: `${12 + ((i * 37) % 60)}%`, rotate: `${i * 40}deg` }} />
      ))}
      <span className={classes.cake} data-size={size}>
        <IconCake size={size === "lg" ? 26 : 17} />
      </span>
      <span className={classes.text} style={{ width: "46%" }}>
        <Line w={90} strong />
        {size === "lg" ? <Line w={64} /> : null}
      </span>
    </div>
  ),
  pnl: (size) => (
    <div className={classes.chart}>
      <div className={classes.bars} data-grouped>
        {BARS.slice(0, count(size, 8, 6)).map((height, i) => (
          <span key={i} className={classes.group}>
            <span style={{ height: `${height}%` }} />
            <span data-tone="muted" style={{ height: `${height * 0.62}%` }} />
          </span>
        ))}
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={`${classes.overlay} ${classes.mirror}`}>
        <polyline points="2,30 16,26 30,28 44,18 58,22 72,12 86,16 98,8" fill="none" stroke="var(--ep-charcoal)" strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  ),
  forecast: () => (
    <div className={classes.chart}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={`${classes.fullSvg} ${classes.mirror}`}>
        <path d="M60,20 L72,15 L86,18 L98,10 L98,24 L86,30 L72,27 L60,26 Z" fill="var(--accent)" fillOpacity="0.14" />
        <polyline points="2,32 12,28 22,30 32,24 42,26 52,19 60,22" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points="60,22 72,21 86,24 98,17" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <line x1="60" y1="4" x2="60" y2="38" stroke="var(--ep-charcoal)" strokeOpacity="0.35" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  ),
  grouped: (size) => (
    <div className={classes.chart}>
      <div className={classes.bars} data-grouped>
        {BARS.slice(0, count(size, 5, 4)).map((height, i) => (
          <span key={i} className={classes.group}>
            <span style={{ height: `${height}%` }} />
            <span data-tone="soft" style={{ height: `${Math.max(24, height - 18 + (i % 2) * 22)}%` }} />
            <span data-tone="muted" style={{ height: `${Math.max(20, height - 30)}%` }} />
          </span>
        ))}
      </div>
    </div>
  ),
  highlights: (size) => (
    <Rows>
      {[0, 1, 2].slice(0, count(size, 3, 2)).map((i) => (
        <Row key={i}>
          <span className={classes.iconDot} data-tone={i === 1 ? "danger" : "positive"}>
            {i === 1 ? <IconArrowDownRight size={11} /> : <IconArrowUpRight size={11} />}
          </span>
          <span className={classes.text}>
            <Line w={70 - i * 12} strong />
            {size === "lg" ? <Line w={48 + i * 8} /> : null}
          </span>
        </Row>
      ))}
    </Rows>
  ),
  rings: (size) => (
    <div className={classes.rings}>
      {[72, 48, 88].slice(0, count(size, 3, 2)).map((progress, i) => (
        <span key={i} className={classes.ringItem}>
          <svg viewBox="0 0 36 36" className={classes.ring}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--ep-border)" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 88} 88`}
              transform="rotate(-90 18 18)"
            />
          </svg>
          {size === "lg" ? <Line w={70} /> : null}
        </span>
      ))}
    </div>
  ),
  kds: (size) => (
    <div className={classes.columns}>
      {[0, 1, 2].map((column) => (
        <div key={column} className={classes.kdsColumn}>
          <Line w={60} strong />
          {[0, 1].slice(0, column === 2 ? 1 : count(size, 2, 1)).map((ticket) => (
            <span key={ticket} className={classes.ticket} data-state={column === 2 ? "ready" : column === 0 && ticket === 1 ? "late" : undefined}>
              <span className={classes.ticketHead}>
                <Line w={40} strong />
                <IconClock size={10} />
              </span>
              <Line w={80} />
              {size === "lg" ? <Line w={56} /> : null}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
  floor: (size) => (
    <div className={classes.floor} data-size={size}>
      {["seated", "free", "bill", "free", "seated", "seated", "free", "bill"].slice(0, count(size, 8, 6)).map((state, i) => (
        <span key={i} className={classes.table} data-state={state} data-shape={i % 3 === 0 ? "round" : "square"} />
      ))}
    </div>
  ),
  schedule: (size) => (
    <div className={classes.schedule}>
      {Array.from({ length: count(size, 3, 2) }, (_, row) => (
        <div key={row} className={classes.scheduleRow}>
          <span className={classes.avatar} data-shape="round" />
          <span className={classes.week}>
            {[
              [0, 3],
              [4, 2],
            ].map(([start, length], i) => (
              <span key={i} className={classes.shift} style={{ insetInlineStart: `${((start + row) % 5) * 14}%`, width: `${length * 14 - 2}%`, opacity: 1 - i * 0.35 }} />
            ))}
          </span>
        </div>
      ))}
    </div>
  ),
  timeline: (size) => (
    <Rows>
      {[0, 1, 2].slice(0, count(size, 3, 2)).map((i) => (
        <Row key={i}>
          <span className={classes.iconDot}>
            <IconClock size={11} />
          </span>
          <span className={classes.track} data-thin>
            <span className={classes.segment} style={{ insetInlineStart: `${8 + i * 6}%`, width: `${62 - i * 9}%` }} />
          </span>
        </Row>
      ))}
    </Rows>
  ),
  drawer: (size) => (
    <Rows>
      {[0, 1, 2].slice(0, count(size, 3, 1)).map((i) => (
        <Row key={i}>
          <span className={classes.iconDot}>
            <IconCoin size={11} />
          </span>
          <Line w={30 + i * 8} />
          <span className={classes.spacer} />
          <Line w={14} />
        </Row>
      ))}
      <div className={classes.totalRow}>
        <Line w={26} strong />
        <span className={classes.spacer} />
        <span className={classes.iconDot} data-tone="positive">
          <IconCheck size={11} />
        </span>
      </div>
    </Rows>
  ),
  checklist: (size) => (
    <Rows>
      {[true, true, false, false].slice(0, count(size, 4, 3)).map((done, i) => (
        <Row key={i}>
          <span className={classes.checkbox} data-done={done || undefined}>
            {done ? <IconCheck size={10} stroke={3} /> : null}
          </span>
          <Line w={WIDTHS[i]} strong={!done} />
        </Row>
      ))}
    </Rows>
  ),
  drivers: (size) => (
    <Rows>
      {["away", "back", "away", "idle"].slice(0, count(size, 4, 2)).map((state, i) => (
        <Row key={i}>
          <span className={classes.avatar} data-shape="round">
            <IconMotorbike size={12} />
          </span>
          <Line w={WIDTHS[i] - 14} strong />
          <span className={classes.spacer} />
          <span className={classes.status} data-state={state} />
        </Row>
      ))}
    </Rows>
  ),
  map: (size) => (
    <div className={classes.map}>
      <svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" className={classes.fullSvg}>
        <rect width="100" height="56" fill="var(--accent-faint)" />
        {[14, 30, 46].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#fff" strokeWidth="3" />
        ))}
        {[18, 44, 70, 90].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="56" stroke="#fff" strokeWidth="3" />
        ))}
        <polyline points="18,46 18,30 44,30 44,14 70,14" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeDasharray="4 3" strokeLinecap="round" />
        <circle cx="44" cy="22" r="3.4" fill="var(--ep-charcoal)" />
      </svg>
      {/* Physical positions: the map drawing is not mirrored in Arabic, so its pins are not either. */}
      <span className={classes.pin} data-kind="store" style={{ left: "18%", top: "82%" }}>
        <IconBuildingStore size={size === "lg" ? 13 : 10} />
      </span>
      <span className={classes.pin} data-kind="home" style={{ left: "70%", top: "25%" }}>
        <IconMapPinFilled size={size === "lg" ? 15 : 11} />
      </span>
    </div>
  ),
  zones: () => (
    <div className={classes.map}>
      <svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" className={classes.fullSvg}>
        <rect width="100" height="56" fill="#F4F6F5" />
        <polygon points="30,6 62,4 70,26 48,36 26,28" fill="var(--accent)" fillOpacity="0.32" stroke="var(--accent)" strokeWidth="1" />
        <polygon points="62,4 94,10 96,40 70,26" fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="1" />
        <polygon points="26,28 48,36 70,26 96,40 88,54 20,54" fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="48" cy="20" r="3.4" fill="var(--ep-charcoal)" />
      </svg>
    </div>
  ),
  phone: (size) => (
    <div className={classes.phoneWrap}>
      <div className={classes.phone} data-size={size}>
        <Line w={52} strong />
        <div className={classes.tiles}>
          {[0, 1, 2, 3].slice(0, count(size, 4, 2)).map((i) => (
            <span key={i} className={classes.tile}>
              <IconPizza size={size === "lg" ? 16 : 11} />
            </span>
          ))}
        </div>
        <span className={classes.phoneButton} />
      </div>
    </div>
  ),
  qr: (size) => (
    <div className={classes.qrWrap}>
      <svg viewBox="0 0 21 21" className={classes.qr} data-size={size} shapeRendering="crispEdges">
        {QR_CELLS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--ep-charcoal)" />
        ))}
      </svg>
      <div className={classes.phone} data-size="sm">
        <Line w={60} strong />
        <div className={classes.tiles}>
          <span className={classes.tile}>
            <IconPizza size={11} />
          </span>
          <span className={classes.tile}>
            <IconPizza size={11} />
          </span>
        </div>
      </div>
    </div>
  ),
  board: (size) => (
    <div className={classes.columns}>
      {["preparing", "ready"].map((state) => (
        <div key={state} className={classes.boardColumn} data-state={state}>
          <Line w={50} strong />
          <div className={classes.boardTiles}>
            {Array.from({ length: count(size, state === "ready" ? 4 : 6, state === "ready" ? 2 : 3) }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

export const PreviewMock = ({ variant, color, size }: { variant: MockVariant; color: MantineColor; size: Size }) => (
  <div className={classes.frame} data-size={size} style={accentVars(color)} aria-hidden>
    <div className={classes.screen}>{variants[variant](size)}</div>
  </div>
);
