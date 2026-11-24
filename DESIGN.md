# Design System & Token Tokens

This document defines the strict UI boundaries for the application. The AI must reference these theme names via Tailwind/NativeWind utility classes instead of hardcoding raw values.

## 1. Typography System
Map these strictly to text sizing classes:
- **Title**: `text-[20px] leading-[22px] font-bold` (Headers)
- **Subtitle**: `text-[16px] font-medium` (Section headings)
- **Subtext**: `text-[14px] font-normal` (Captions/Labels)
- **Paragraph**: `text-[13px] leading-[15px] font-normal` (Body copy)

## 2. Color System
Use these exact naming conventions for background (`bg-`), text (`text-`), and border (`border-`) classes:
- **Dark mode Green Black**: Main dark theme background container.
- **Background dark mode and letters**: Dark theme card backgrounds / secondary text.
- **Letters and Icons**: Primary high-contrast light text on dark backgrounds.
- **Dark Mode Green bar**: Dark mode borders, inner containers, navigation bars.
- **Main theme**: Primary brand color accent (solid mint/green).
- **Light Green**: Secondary brand accent / success states.
- **Background Green White and Letters**: Primary light mode layout background.
- **Light Blue button**: Low-emphasis interactive background.
- **Blue Button**: Standard interactive background.
- **Ocean Blue Button**: High-emphasis primary action buttons.
- **Text color for Light BG**: Primary high-contrast text for light layouts.
- **Shade of Text in Light bg**: Secondary low-contrast text for light layouts.
- **Alternative Accent** (`#0068FF`): Vibrant blue for links, focus states, or alternative actions.

## 3. Gradients & Charts
- **gradiant main theme**: Primary background / header gradient.
- **Button grad**: Action button gradient.
- **MAIN THEME GRAD / MAIN CRUVED GRAD**: Complex background shapes / curved hero sections.
- **BarCharts / Todays_Barchart**: Data visualization fills only.

## 4. Implementation Rules
1. **Never Hardcode Values**: Do not write raw hex codes or pixel numbers directly in components.
2. **Strict Mode Separation**: Never place light mode text tokens on dark mode backgrounds. Maintain perfect accessibility contrast.
3. **Typography Constraint**: Every text element MUST match exactly one of the four defined tokens (Title, Subtitle, Subtext, Paragraph). No exceptions.