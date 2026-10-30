import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";
import { brand, surfaces } from "./tokens";

/** Brand yellow: shade 6 is the exact brand colour; shade 7 is its hover/pressed state. */
const brandYellow: MantineColorsTuple = [
  "#FFFAE5",
  "#FFF3C2",
  "#FEEA94",
  "#FCDF62",
  "#FAD53E",
  "#F8CE2F",
  brand.yellow,
  "#DCB21A",
  "#C29C10",
  "#A68404",
];

/** Brand charcoal: shade 9 is the exact brand colour (sidebar, strong text). */
const charcoal: MantineColorsTuple = [
  "#F5F4F4",
  "#E6E4E4",
  "#CBC8C8",
  "#ADA9AA",
  "#938E8F",
  "#7A7475",
  "#5F595A",
  "#463F41",
  "#332D2E",
  brand.charcoal,
];

const fontFamily = 'Tajawal, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 6,
  colors: { brand: brandYellow, charcoal },
  black: brand.charcoal,
  // Dark text on yellow, white text on charcoal.
  autoContrast: true,
  fontFamily,
  headings: { fontFamily, fontWeight: "700" },
  defaultRadius: "md",
  radius: { xs: "4px", sm: "8px", md: "10px", lg: "14px", xl: "20px" },
  cursorType: "pointer",
  respectReducedMotion: true,
  components: {
    Card: { defaultProps: { radius: "lg", withBorder: true } },
    Paper: { defaultProps: { radius: "lg" } },
    Badge: { defaultProps: { radius: "sm" } },
  },
});

/** App-level CSS variables (`--ep-*`) for layout surfaces that Mantine has no token for. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--ep-yellow": brand.yellow,
    "--ep-charcoal": brand.charcoal,
    "--ep-canvas": surfaces.canvas,
    "--ep-card": surfaces.card,
    "--ep-muted": surfaces.muted,
    "--ep-border": surfaces.border,
  },
  light: {},
  dark: {},
});
