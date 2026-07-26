---
name: AbangBus Core
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#404752'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707783'
  outline-variant: '#c0c7d4'
  surface-tint: '#0060a8'
  primary: '#005ea4'
  on-primary: '#ffffff'
  primary-container: '#0077ce'
  on-primary-container: '#fdfcff'
  inverse-primary: '#a2c9ff'
  secondary: '#006e1c'
  on-secondary: '#ffffff'
  secondary-container: '#98f994'
  on-secondary-container: '#0c7521'
  tertiary: '#755700'
  on-tertiary: '#ffffff'
  tertiary-container: '#946f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#a2c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004881'
  secondary-fixed: '#98f994'
  secondary-fixed-dim: '#7ddc7a'
  on-secondary-fixed: '#002204'
  on-secondary-fixed-variant: '#005313'
  tertiary-fixed: '#ffdf9e'
  tertiary-fixed-dim: '#fabd00'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5b4300'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.1px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  margin-mobile: 16px
  margin-desktop: 48px
  gutter: 16px
---

## Brand & Style
The design system is built on the pillars of **Reliability, Speed, and Community**. It targets daily commuters who require immediate, glanceable information to navigate their urban environment. The visual direction follows a **Modern Corporate** aesthetic, heavily influenced by Material Design 3 principles but refined with a bespoke startup polish.

The system prioritizes functional clarity over decorative flair. It employs a high-contrast interface with generous whitespace to ensure readability in outdoor environments (glare/sunlight). The emotional response should be one of "calm efficiency"—reducing the friction and anxiety associated with public transit through precise, stable UI elements and logical information architecture.

## Colors
The color palette is functionally driven, mapping directly to real-time status updates and transit logic.

- **Primary (Blue):** Used for primary actions, active route paths, and branding elements. It signifies the core reliability of the service.
- **Secondary (Green):** Specifically reserved for positive status indicators like "Arriving Soon," "On Time," or "Seats Available."
- **Tertiary (Amber):** Used for "Moderate" delays, high-traffic warnings, and points of interest.
- **Error (Red):** Used for "Far" status, cancelled routes, or critical system alerts.
- **Surface & Background:** A cool-toned off-white (#F8FAFC) reduces eye strain and provides a clean canvas for pure white (#FFFFFF) cards to sit upon, creating subtle layered depth.

## Typography
This design system utilizes **Inter** for its exceptional legibility and neutral, systematic tone. The type scale is optimized for high-density information displays.

- **Display & Headlines:** Use semi-bold to bold weights with slight negative letter-spacing to create a strong visual anchor for route numbers and bus stop names.
- **Body Text:** Standard weight for descriptions and community comments.
- **Labels:** Medium weights are used for metadata (e.g., "5 mins away," "Bus Plate No") to ensure they remain readable at smaller sizes.
- **Accessibility:** Ensure all color/text combinations meet WCAG AA standards, particularly for the Amber accent which should use dark text.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a base-4 tracking system.

- **Mobile:** 4-column grid with 16px side margins. Core interaction happens in the "Thumb Zone" (bottom 60% of the screen).
- **Tablet/Desktop:** 12-column grid with a max-width container of 1200px. Side panels are used for list views while the map remains the primary background element.
- **Spacing Rhythm:** Use 16px (`md`) for standard padding within cards and 8px (`sm`) for grouping related text elements. Large 24px (`lg`) gaps should separate distinct sections or functional groups.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Ambient Shadows** rather than harsh outlines.

- **Level 0 (Background):** #F8FAFC - The base map or background.
- **Level 1 (Cards/Surface):** #FFFFFF - Primary content containers. Features a soft, highly diffused shadow (0px 4px 20px rgba(0,0,0,0.05)).
- **Level 2 (Active/Floating):** Used for the Floating Action Button (FAB) and active search bars. Features a slightly more pronounced shadow to indicate interactability (0px 8px 24px rgba(0,0,0,0.08)).
- **Level 3 (Bottom Sheets/Modals):** Overlays use a backdrop blur (20px) on a semi-transparent scrim to maintain context of the map underneath while focusing the user's attention.

## Shapes
The shape language is friendly and modern. A **Rounded (0.5rem base)** approach is used for most UI elements, while larger containers like cards and bottom sheets utilize the `rounded-xl` (1.5rem/24px) token to create a soft, approachable feel.

- **Buttons:** Fully rounded (pill-shaped) for primary actions.
- **Cards:** 16px to 20px corner radius.
- **Input Fields:** 12px corner radius for a "contained" look.
- **Status Pills:** Fully rounded to distinguish them from clickable buttons.

## Components
- **Search Bar:** Large, elevated white surface with a 24px radius. Includes a leading "search" icon and a trailing "filter" or "profile" icon.
- **Bus Status Cards:** White background, 20px radius. Use a vertical color-coded bar (4px width) on the left edge to denote status (Green/Amber/Red) at a glance.
- **Buttons:** 
  - *Primary:* Blue background, white text, pill-shaped. 
  - *Secondary:* Light blue tint (#E3F2FD) with blue text.
- **Bottom Sheets:** Rounded top corners (24px). Used for detailed bus stop info or route planning. Must include a visible "grab handle" at the top center.
- **Status Chips:** Small, semi-transparent backgrounds with high-contrast text (e.g., Light green background with dark green text) to display "On Time" or "Low Occupancy."
- **Bottom Navigation:** Fixed to the bottom. Uses active state indicators (a colored pill behind the icon) consistent with Material You.
- **Live Indicators:** A pulsing dot animation in the secondary (Green) color to indicate real-time GPS tracking is active.