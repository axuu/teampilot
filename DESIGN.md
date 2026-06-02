---
name: Pine Design System
product:
  name: Pine
  chineseName: 迎客松
  direction: 温润效率工作台
version: 1.1
updated: 2026-06-02
colors:
  brand:
    base: "#5D9FB6"
    hover: "#3F7F92"
    soft: "#EAF5F7"
    border: "#CFE6EC"
  background:
    gradientStart: "#DCEAED"
    gradientMid: "#E9EEED"
    gradientEnd: "#F3EFED"
    pageSoft: "#F8F8F7"
    contentCard: "rgba(255,255,255,0.95)"
    contentFallback: "#FFFFFF"
    tableHeader: "#FAF9F8"
  text:
    primary: "#2E3333"
    secondary: "#6C7374"
    weak: "#B3B7B9"
    disabled: "#D0D1D1"
    inverse: "#FFFFFF"
  border:
    default: "#E6E4E4"
    subtle: "#E6E4E4"
  danger:
    text: "#FF4242"
    soft: "#FFF1F0"
    border: "#FFD8D6"
typography:
  fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', sans-serif"
  sizes:
    helper:
      px: 12
      use: "weak hints, error text, loading copy, timestamps"
    compact:
      px: 13
      use: "field labels, small buttons, tags, table helper text"
    body:
      px: 14
      use: "default body, form controls, table cells, page titles in list pages"
    sectionTitle:
      px: 16
      weight: 600
      use: "important section titles"
    detailTitle:
      px: 20
      weight: 700
      letterSpacing: -0.3px
      use: "detail page title"
rounded:
  small:
    px: 5
    use: "inputs, selects, select menus, buttons, checkboxes, tags/badges, small tooltips"
  medium:
    px: 10
    use: "small panels, empty-state boxes, medium dialogs"
  large:
    px: 20
    use: "content card, table region, large cards, large tooltips, large dialogs, chat containers"
  full:
    value: "999px"
    use: "avatars, nav pills, suggestion pills"
spacing:
  frame:
    contentCardMargin: 16
    contentCardPadding: 24
    titleToDivider: 16
    dividerToContent: 20
    largeSectionGap: 32
  controls:
    labelToControl: 6
    filterItemGap: 14
    filterActionGap: 14
    formColumnGap: 14
    formRowGap: 18
    buttonGap: 8
  widths:
    short: 96
    medium: 220
    mediumLong: 320
    long: 520
  table:
    rowHeight: 44
    cellPaddingX: 16
components:
  shell:
    background: "linear-gradient(180deg, #DCEAED 0%, #E9EEED 52%, #F3EFED 100%)"
    contentCardBackground: "rgba(255,255,255,0.95)"
    contentCardRadius: 20
    contentCardShadow: "0 16px 42px rgba(46, 51, 51, 0.08)"
  buttons:
    heightDefault: 32
    radius: 5
    maxPrimaryPerGroup: 1
    primary:
      background: "#5D9FB6"
      hover: "#3F7F92"
      text: "#FFFFFF"
    secondary:
      background: "#FFFFFF"
      border: "#5D9FB6"
      text: "#5D9FB6"
    text:
      text: "#5D9FB6"
      underline: false
    dangerIcon:
      size: 32
      icon: "trash"
      text: "#FF4242"
  table:
    radius: 20
    headerHeight: 44
    rowHeight: 44
    headerBackground: "#FAF9F8"
    border: "#E6E4E4"
    actionColumn:
      sticky: right
      align: left
  dialogs:
    useDrawer: false
    medium:
      maxWidth: 520
      radius: 10
    large:
      maxWidth: 760
      radius: 20
    shadow: "0 16px 42px rgba(46, 51, 51, 0.10)"
---

# Pine Design System

## Overview

Pine MUST feel like a warm, efficient operations workspace: professional, clear, reliable, and quietly branded.

Pine is not a marketing site. Pages MUST prioritize scanning, filtering, editing, saving, and repeated operational work. The visual system SHOULD keep the outer frame warm and soft while keeping business content restrained and readable.

## Colors

The brand color MUST be `#5D9FB6`.

Primary actions, links, text buttons, focus accents, navigation active hints, and section markers MUST use the registered brand color. Hover states SHOULD use `#3F7F92`.

The full-screen app background MUST use:
```css
linear-gradient(180deg, #DCEAED 0%, #E9EEED 52%, #F3EFED 100%)
```

The right content card MUST use `rgba(255,255,255,0.95)` with `#FFFFFF` as fallback.
Main text MUST use `#2E3333`. Secondary text MUST use `#6C7374`. Weak text, placeholder text, timestamps, and low-priority hints SHOULD use `#B3B7B9`. Disabled text MUST use `#D0D1D1`.
Borders and dividers MUST use `#E6E4E4`. Table headers MUST use `#FAF9F8`. Soft page backgrounds and small empty-state panels SHOULD use `#F8F8F7`.

## Typography & Document Body

The font family MUST be:
```css
-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif
```

Default body, form controls, and table cells MUST use `14px`.
Detail page titles MUST use `20px / 700` with `letter-spacing: -0.3px`. Important section titles SHOULD use `16px / 600`. Field labels, small buttons, tags, and compact helper text MAY use `13px`. Error text, timestamps, weak hints, and loading copy MAY use `12px`.

### Document Typography (doc-body)
For text-heavy areas (e.g. summaries, AI reviews), use the `doc-body` typography system to ensure readable layouts:
- **Container**: `max-width: 680px` to prevent line length fatigue.
- **Meta Info**: `14px`, `text-primary`, `line-height: 1.6`, stacked with `margin-bottom: 2px`.
- **Chapter Headings**: `14px / 700`, `text-primary`, `margin: 24px 0 8px 0`. Must feature a `3px * 14px` brand color vertical bar on the left. The bar MUST be negatively indented (`margin-left: -11px`, `padding-left: 11px`) so that the text of the heading naturally aligns on the X-axis with the paragraph text below, while the vertical bar hangs in the left margin.
- **Paragraphs**: `14px`, `text-primary`, `line-height: 1.75`. `margin-bottom: 10px`.
- **Ordered Lists**: Same font size and line-height as paragraphs. List items (`li`) MUST have `margin-bottom: 0` so the line-height controls vertical rhythm perfectly.
- **Action Links**: `13px` brand color text button, `margin-top: 10px` following a text block. No underline by default (shows on hover).

## Layout & Navigation

The global layout MUST use a two-layer structure:
1. Background canvas: full-screen gradient layer.
2. Content card: right-side white workspace card floating above the canvas.

### Sidebar Navigation
The left navigation MUST sit directly on the background canvas and SHOULD remain transparent or nearly transparent. It MUST NOT become a separate solid white sidebar.
- **Active state**: Full-rounded pill (`border-radius: 999px`) with `rgba(255,255,255,0.75)` background, `text-primary`, `font-weight: 700`.
- **Hover state**: `rgba(255,255,255,0.5)` background.
- **Spacing**: `gap: 6px` between items, `padding: 8px 14px`.

### Content Card Layout
- margin: `16px`
- padding: `24px`
- radius: `20px`
- background: `rgba(255,255,255,0.95)`
- shadow: `0 16px 42px rgba(46, 51, 51, 0.08)`

List pages MUST show the page title at the top. Detail pages MUST show breadcrumb navigation above the detail title.

### Responsive Breakpoints
- `≥ 1024px`: Normal table/layout.
- `768px ~ 1024px`: Tables receive a `min-width` (e.g. `760px`) and the parent container gets `overflow-x: auto` for horizontal scrolling.
- `< 768px`: Table structures are hidden and gracefully fallback to a mobile-friendly Card List view.

## Elevation, Depth & Shapes

Small components MUST use `5px` radius (inputs, selects, buttons, checkboxes, tags/status badges).
Small panels and empty-state boxes MUST use `10px` radius.
Large regions MUST use `20px` radius (right content card, tables, chat containers).
Avatars, nav pills, and suggestion pills MUST use full radius (`999px`).

## Components

### Buttons
Default button height MUST be `32px`. Button radius MUST be `5px`.
Each action group MUST contain at most one primary button.

### Tables & Columns
Table regions MUST use `20px` radius and `1px #E6E4E4` border. Header height and row height MUST be `44px`. Cell horizontal padding MUST be `16px`. Header background MUST be `#FAF9F8`.

**Action Column**: MUST be sticky on the right and left-aligned. The width MUST NOT be hard-coded to a static small value (like `96px`), but MUST be dynamically sized or sized according to the actual buttons and text lengths to ensure buttons never wrap. Button groups within the action column must force `white-space: nowrap`.

### Status Badges
Status badges MUST use `5px` radius (small component size). They MUST NOT use a prepended dot character (`●`).
For consistency in lists, badges of the same category MUST share a `min-width` (e.g. `56px`) and use `justify-content: center` to keep text perfectly centered.

### Forms & Dropdowns
Form labels MUST sit above controls. Label-to-control spacing MUST be `6px`. Field horizontal gap MUST be `14px`. Field row gap SHOULD be `18px`.

**Dropdowns**: Avoid native `<select>` dropdowns. Use custom dropdown menus (`min-width: 100%`, absolute positioned). The dropdown options container MUST use `display: flex; flex-direction: column; gap: 2px;` to prevent the hover backgrounds of adjacent options from sticking together. Active options should display a checkmark and use `brand-soft` background.
Filter controls MUST wrap naturally.

Control width tokens MUST be used:
- short: `96px`
- medium: `220px`
- medium-long: `320px`
- long: `520px`

### AI Assistant Chat UI
The AI Assistant page uses a specialized layout:
- **Container**: `max-width: 800px`, `height: calc(100vh - 180px)`, `radius-large` (20px), `bg-content-card`, `border-default`.
- **Message List**: Flex column, `gap: 24px`, scrolling vertically.
- **AI Bubbles**: `bg-brand-soft` background, `brand-border` border, `text-primary`.
- **AI Avatar**: A small champagne-gold robot SVG (`peeking-robot`) absolutely positioned at the top-left of the AI bubble (`top: -15px`, `left: 18px`). Hovers `-2px` on the Y-axis when hovering the parent row.
- **User Bubbles**: `bg-page-soft` background, `border-default` border. Justified to `flex-end`.
- **Timestamps**: Displayed directly below bubbles. `12px`, `text-weak`.
- **Suggestions (Pills)**: `radius-full` (999px), `bg-content-card`, `text-secondary`, `border-default`. Hover state turns `bg-brand-soft` and `brand-hover` text.
- **Input Bar**: `padding: 16px 24px`, top border.
- **Input Box**: `bg-page-soft`, `14px`, `radius-small` (5px), `padding: 12px 16px`. Focus state shifts background to `bg-content-card` (white) with `brand-base` border.
- **Send Button**: `bg-brand-base`, white icon, `radius-small` (5px). **Crucially: The send button height MUST be strictly aligned and identical to the input box height.**

## Do's and Don'ts

### Do's
MUST use registered colors, typography, radius, spacing, shadows, and component rules.
MUST keep Pine high-density but not crowded.
MUST use the brand color for orientation and action, not decoration.
SHOULD keep list pages efficient and scan-friendly.

### Don'ts
NEVER use unregistered arbitrary font sizes, colors, radius, or spacing values.
NEVER use inline style to control core layout parameters.
NEVER put cards inside cards unless necessary.
NEVER use drawers or side sheets.
NEVER use marketing-page hero layouts inside the workspace.
