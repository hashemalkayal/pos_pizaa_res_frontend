import { ActionIcon, Button, createTheme, rem, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";
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

/**
 * Action sizes (opt-in, so other screens keep Mantine's scale): one standard for action buttons across the POS.
 *   <Button size="action">          40px — primary and secondary actions (checkout, confirm, add, cancel…)
 *   <Button size="action-compact">  34px — inline and secondary actions (clear, quick amounts, change…)
 *   <ActionIcon size="action">      36px — icon-only actions (edit, remove…)
 */
export const ACTION_SIZES = { button: 40, compactButton: 34, icon: 36 } as const;

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
    Button: Button.extend({
      vars: (_theme, props) => {
        if (props.size === "action") return { root: { "--button-height": rem(ACTION_SIZES.button), "--button-padding-x": rem(18), "--button-fz": rem(15) } };
        if (props.size === "action-compact") return { root: { "--button-height": rem(ACTION_SIZES.compactButton), "--button-padding-x": rem(12), "--button-fz": rem(14) } };
        return { root: {} };
      },
    }),
    ActionIcon: ActionIcon.extend({
      vars: (_theme, props) => (props.size === "action" ? { root: { "--ai-size": rem(ACTION_SIZES.icon) } } : { root: {} }),
    }),
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
