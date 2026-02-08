# Panduan Styling UI/UX

- App Full One Screen, Match Screen Machine User, No Overflow No Main scrollbar. ( main scrollbar only applied on mobile view)
- responsive design ( desktop first but mobile friendly, PS: you may need to create compact mode as mobile view require spesific breakpoint or font size )
- Main Header space between [ Logo + App Name ] [ Navigation Menu ] [ toggle theme]
- If there are many screen content / section, put them on sidebar menu ( can nested menu ).
- Sidebar menu default show, have toggle show/hide on top ( not hamburger on main header ).
- Primary Color : #3A4DFF
- Privacy Color : #00E5C0 
- Any hover & active state at 'text link' or 'icon link' no background, use glow shadow with current color ( thicker ).
- have toggle icon dark/light theme ( no border )
- header fixed top, footer fixed bottom
- footer py-1 can be named as mini footer credit or info 
- any card content has no border but shadow applied
- use lucid-react icon
- use motion effect for smooth transition

Dokumen ini merangkum gaya visual dan pola UI/UX yang digunakan di proyek OctWa, agar bisa dipakai ulang saat membangun proyek baru dengan tampilan yang konsisten.

## 1. Stack Styling
- Tailwind CSS dengan CSS variables sebagai design tokens.
- Shadcn UI style: new-york.
- Tema light/dark berbasis class `.dark` dan `.light`.
- Font default: Fira Code, monospace.

## 2. Design Tokens (Warna)

### 2.1. Base Theme Tokens (CSS Variables)
Tersimpan di `src/index.css` pada `:root` (light) dan `.dark`.

**Light**
- `--background: 0 0% 100%`
- `--foreground: 0 0% 3.9%`
- `--card: 0 0% 100%`
- `--card-foreground: 0 0% 3.9%`
- `--popover: 0 0% 100%`
- `--popover-foreground: 0 0% 3.9%`
- `--primary: 234 100% 61%`
- `--primary-foreground: 0 0% 100%`
- `--secondary: 220 14% 93%`
- `--secondary-foreground: 0 0% 9%`
- `--muted: 220 14% 93%`
- `--muted-foreground: 0 0% 45.1%`
- `--accent: 220 14% 80%`
- `--accent-foreground: 0 0% 9%`
- `--destructive: 0 84.2% 60.2%`
- `--destructive-foreground: 0 0% 98%`
- `--border: 220 13% 82%`
- `--input: 220 13% 82%`
- `--ring: 0 0% 3.9%`

**Dark**
- `--background: 0 0% 10.2%`
- `--foreground: 0 0% 90%`
- `--card: 0 0% 12%`
- `--card-foreground: 0 0% 90%`
- `--popover: 0 0% 12%`
- `--popover-foreground: 0 0% 90%`
- `--primary: 234 100% 61%`
- `--primary-foreground: 0 0% 100%`
- `--secondary: 0 0% 16%`
- `--secondary-foreground: 0 0% 90%`
- `--muted: 0 0% 16%`
- `--muted-foreground: 0 0% 55%`
- `--accent: 0 0% 16%`
- `--accent-foreground: 0 0% 90%`
- `--destructive: 0 62.8% 30.6%`
- `--destructive-foreground: 0 0% 90%`
- `--border: 0 0% 22%`
- `--input: 0 0% 22%`
- `--ring: 240 91% 60%`

Catatan:
- Token warna digunakan melalui Tailwind seperti `bg-background`, `text-foreground`, `border-border`, `ring-ring`.

### 2.2. Private Mode Tokens
Private mode menggunakan aksen utama **#00E5C0**.

CSS variables:
- `--private-primary: 170 100% 45%`
- `--private-primary-foreground: 0 0% 100%`

Utility classes:
- `.private-mode` → override `--primary` dan `--primary-foreground`
- `.private-accent` → text `hsl(170 100% 45%)`
- `.private-bg` → background `hsl(170 100% 45%)`
- `.private-bg-subtle` → `hsl(170 100% 45% / 0.1)`
- `.private-border` → `hsl(170 100% 45% / 0.3)`
- `.private-text` → text `hsl(170 100% 45%)`
- `.btn-private` → tombol private utama
- `.btn-private-outline` → outline private
- `.badge-private` → badge private
- `.tabs-private` → tabs private

## 3. Tipografi
- Font global: `Fira Code`, monospace.
- Heading: `font-semibold` + `tracking-tight`.
- Body line-height: `1.6`.
- Ukuran font banyak memakai `text-sm` sampai `text-lg` untuk UI padat.

## 4. Radius & Border
- Semua elemen secara default **tanpa rounded** (radius 0).
- Pengecualian: `.rounded-full`, spinner, animasi, dan logo.
- Border konsisten dengan `border-width: 1px`.

## 5. Buttons (Shadcn + Tailwind)
Variant dari `Button`:
- `default`: `bg-primary text-primary-foreground`
- `outline`: `border border-input bg-background`
- `secondary`: `bg-secondary`
- `destructive`: `bg-destructive`
- `link`: `text-primary`

Ukuran `Button`:
- `default`: `h-9 px-4 py-2`
- `sm`: `h-8 px-3 text-xs`
- `lg`: `h-10 px-8`
- `icon`: `h-9 w-9`

## 6. Interaksi & Aksesibilitas
- Fokus visible: `ring` atau outline yang jelas.
- Scrollbar tetap terlihat di area scroll agar tidak menabrak border.

## 7. Animasi
Tailwind animation yang digunakan:
- `accordion-down` dan `accordion-up`.
- Transisi mode: `modeSwitch`, `modeSwitchToPrivate`, `modeSwitchToPublic`.

## 8. Prinsip Gaya Utama
- **Sharp edges**: tidak memakai rounded kecuali elemen khusus.
- **Monospace aesthetic**: font Fira Code untuk seluruh UI.