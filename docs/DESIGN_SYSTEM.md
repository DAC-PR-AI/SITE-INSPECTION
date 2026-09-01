# DAC Joint Inspection & Key Handover — Design System Specification

This document details the official **Design Token & Reusable UI Component System** for the DAC Joint Inspection & Key Handover application.

> [!IMPORTANT]
> **STRICT DESIGN RULE**: All components MUST inherit the EXISTING application colors, background gradients, and construction/blueprint visual language. Do NOT introduce new color themes or redesign the brand identity.

---

## 1. Baseline Design System Inspection

### 1.1 Current Background Colors
- **Primary Body Background**: `#f8fafc` (slate-50) with radial glows (`rgba(219, 234, 254, 0.4)` & `rgba(236, 253, 245, 0.3)`) and a fixed 48px × 48px grid overlay (`#e2e8f0`).
- **Dark Technical Blueprint Surface**: `#0f172a` (`--blueprint` / slate-900) and `#020617` (`--blueprint-deep` / slate-950) with 16px/80px white grid overlays.
- **Dark HUD Overlay Surface**: `#060c1a` (deep slate/navy) with glowing ambient spheres.

### 1.2 Current Card Colors
- **Standard Card**: `#ffffff` (`--paper-raised` / `bg-white`) with border `#e2e8f0` (`--line`) and radius `rounded-2xl` or `rounded-3xl`.
- **Glassmorphic Card**: `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(12px)` and `border: 1px solid rgba(226, 232, 240, 0.8)`.
- **Dark Technical Card**: `bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl`.

### 1.3 Current Text Colors
- **Primary Heading Text**: `#0b132b` (`--ink` / deep navy).
- **Secondary/Body Text**: `#475569` (`--ink-soft` / slate-600).
- **Muted Metadata/Caption**: `#64748b` (slate-500) / `#94a3b8` (slate-400).
- **Dark Mode / Contrast Text**: `#ffffff` (white) / `#f8fafc` (slate-50).

### 1.4 Current Border Colors
- **Default Border**: `#e2e8f0` (`--line` / `border-slate-200`).
- **Active/Focus Border**: `#3b82f6` (`--blue-500`) or `#2563eb` (`--blue-600`).
- **Dark Mode Border**: `border-slate-800` / `border-slate-700`.

### 1.5 Current Primary Colors
- **Primary Brand Blue**: `#2563eb` (`--blue-600`).
- **Primary Hover**: `#1d4ed8` (`--blue-700`).
- **Primary Ring/Focus**: `#3b82f6` (`--blue-500`) / `rgba(37, 99, 235, 0.2)`.

### 1.6 Current Accent Colors
- **Accent Orange**: `#f97316` (`--accent`).
- **Construction Gold/Amber**: `#f59e0b` (Amber 500) / `#fbbf24` (Amber 400).
- **Success Emerald**: `#10b981` (`--pass`) / `#059669` (`--pass-dark`).
- **Danger Rose**: `#ef4444` (`--fail`) / `#dc2626` (`--fail-dark`).

### 1.7 Existing Gradients
- **Primary CTA Gradient**: `bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600`.
- **Progress Bar Gradient**: `bg-gradient-to-r from-blue-600 via-amber-400 to-emerald-400`.
- **Brand Badge Gradient**: `bg-gradient-to-br from-amber-400 to-amber-600`.
- **Gold Baseline Rule Gradient**: `bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-500`.

### 1.8 Existing Button Styles
- **Primary**: `bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 px-4 py-2.5 transition-all`.
- **Secondary**: `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold px-4 py-2.5 transition-all`.
- **Danger**: `bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 px-4 py-2.5 transition-all`.
- **Ghost**: `hover:bg-slate-100 text-slate-600 rounded-xl px-3 py-2 transition-all`.

### 1.9 Existing Typography
- **Display Headings**: `Space Grotesk`, `Plus Jakarta Sans` (`.font-display`).
- **Body Text**: `Plus Jakarta Sans`, `Inter` (`.font-body`).
- **Monospace / Technical**: `JetBrains Mono` (`.font-mono`).

### 1.10 Existing Shadows
- **xs**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- **sm**: `0 2px 8px -2px rgba(15, 23, 42, 0.06)`
- **md**: `0 10px 25px -5px rgba(15, 23, 42, 0.08)`
- **lg**: `0 20px 35px -10px rgba(15, 23, 42, 0.12)`
- **glow**: `0 0 25px rgba(37, 99, 235, 0.15)`

### 1.11 Existing Border Radius
- **Small (`rounded-lg`)**: 8px (Pills, small tags, tooltips).
- **Medium (`rounded-xl`)**: 12px (Buttons, inputs, dropdown items).
- **Large (`rounded-2xl` / `rounded-3xl`)**: 16px to 24px (Cards, modal dialogs, main containers).
- **Full (`rounded-full`)**: 9999px (Badges, step dots, user avatars).

### 1.12 Existing Responsive Behaviour
- **Mobile (< 640px)**: Single column stacked layout, touch-friendly target size (min 44px), scrollable tables, collapsable sidebars.
- **Tablet (640px – 1024px)**: 2-column grid system, visible metadata pills.
- **Desktop (>= 1024px)**: Full multi-column grid, sticky top bar navigation, side-by-side workflow stepper and inspection summary cards.

---

## 2. Reusable UI Components Architecture

All UI components are located in [`components/ui/`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/components/ui) and exported via [`components/ui/index.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/components/ui/index.js).

| Component | File Path | Description |
|---|---|---|
| **Button** | `components/ui/Button.jsx` | Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `gradient` |
| **Card** | `components/ui/Card.jsx` | Standard, glassmorphic, and dark blueprint card containers |
| **Badge** | `components/ui/Badge.jsx` | Generic badge with variants (`blue`, `amber`, `emerald`, `rose`, `slate`) |
| **StatusBadge** | `components/ui/StatusBadge.jsx` | Domain-specific status badges (`pass`, `fail`, `na`, `pending`, `completed`, `rejected`) |
| **Input** | `components/ui/Input.jsx` | Text/number/date input with error & icon support |
| **Select** | `components/ui/Select.jsx` | Styled select dropdown matching application design |
| **Modal** | `components/ui/Modal.jsx` | Accessible backdrop-blur modal dialog |
| **Drawer** | `components/ui/Drawer.jsx` | Side overlay drawer for mobile filters & details |
| **Table** | `components/ui/Table.jsx` | Responsive checklist & queue data table |
| **ProgressBar** | `components/ui/ProgressBar.jsx` | Animated gradient progress bar |
| **Tabs** | `components/ui/Tabs.jsx` | Tab navigation switcher |
| **PageHeader** | `components/ui/PageHeader.jsx` | Standardized header bar with logo, title, and action controls |
| **Sidebar** | `components/ui/Sidebar.jsx` | Navigation sidebar with collapsible menu items |
| **TopNavigation** | `components/ui/TopNavigation.jsx` | Glassmorphic top navigation bar |
| **EmptyState** | `components/ui/EmptyState.jsx` | Empty state placeholder with blueprint accents |
| **LoadingState** | `components/ui/LoadingState.jsx` | Skeleton / spinner loading state |
| **ErrorState** | `components/ui/ErrorState.jsx` | Error banner & recovery callout |
| **ConfirmationDialog** | `components/ui/ConfirmationDialog.jsx` | Confirm/Cancel prompt modal for destructive actions |
