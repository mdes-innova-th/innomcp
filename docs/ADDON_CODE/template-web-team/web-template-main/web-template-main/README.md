# Modern Web Template

A comprehensive, production-ready web template built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components. Features a fully functional admin panel with beautiful UI components and a custom color scheme.

## 🎨 Color Scheme

This template uses a carefully crafted color palette:

- **Primary Green**: `#005D4B` - Main brand color, used for primary actions and sidebar
- **Accent Green**: `#00df83` - Highlights and call-to-action elements
- **Background**: `#f1f7f7` - Light, clean background color
- **Destructive Red**: `#ff3c40` - Error states and destructive actions

## ✨ Features

### 🔐 Authentication

- **Login Page** - Beautiful login form with email/password and social login options
- **Register Page** - Complete registration form with validation hints
- **Password Toggle** - Show/hide password functionality
- **Social Auth UI** - Ready-to-integrate Google and GitHub login buttons

### 🎯 Admin Panel

- **Dashboard** - Overview with statistics cards, charts placeholders, and recent orders table
- **User Management** - Complete CRUD interface for managing users with roles and status
- **Product Management** - Grid view of products with inventory tracking
- **Orders Management** - Track and manage customer orders
- **Analytics** - View key metrics and analytics
- **Content Management** - Manage pages, media, and content
- **Settings** - Comprehensive settings page with tabs for general, appearance, notifications, and security

### 🦶 Footer

- **Global Footer** - Appears on all pages automatically
- **Company Information** - About section with social media links
- **Quick Links** - Navigation to important pages
- **Contact Information** - Email, phone, and address
- **Legal Links** - Privacy policy, terms of service, etc.

### 🛠️ Technical Features

- **Next.js 16** with App Router and React Server Components
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **shadcn/ui** for beautiful, accessible components
- **Responsive Design** - Mobile-first approach with sidebar that adapts to screen size
- **Dark Mode Ready** - Theme switching capability built-in

### 🎨 UI Components

- Sidebar navigation with active states and badges
- Header with search and notifications
- Statistics cards with trend indicators
- Data tables with sorting and actions
- Modal dialogs for forms
- Toast notifications
- Dropdown menus
- Form components with validation ready

## 📦 Installation

1. Clone this repository:

```bash
git clone <repository-url>
cd web-template
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚀 Project Structure

```
web-template/
├── app/
│   ├── admin/              # Admin panel pages
│   │   ├── page.tsx        # Dashboard
│   │   ├── users/          # User management
│   │   ├── products/       # Product management
│   │   ├── orders/         # Order management
│   │   ├── analytics/      # Analytics
│   │   ├── content/        # Content management
│   │   └── settings/       # Settings page
│   ├── login/              # Login page
│   │   └── page.tsx
│   ├── register/           # Register page
│   │   └── page.tsx
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout (includes Footer)
│   └── globals.css         # Global styles and theme
├── components/
│   ├── admin/              # Admin-specific components
│   │   ├── admin-layout.tsx
│   │   ├── admin-sidebar.tsx
│   │   ├── admin-header.tsx
│   │   ├── stats-card.tsx
│   │   └── recent-orders.tsx
│   ├── footer.tsx          # Global footer component
│   └── ui/                 # shadcn/ui components (22+)
├── lib/
│   ├── utils.ts            # Utility functions
│   ├── types.ts            # TypeScript definitions
│   └── constants.ts        # App constants
├── docs/                   # Documentation
│   ├── QUICKSTART.md
│   ├── COMPONENTS.md
│   └── INTEGRATION.md
└── public/                 # Static assets
```

## 🎯 Usage

### Admin Panel Access

Navigate to `/admin` to access the admin panel. The sidebar provides navigation to:

- Dashboard (`/admin`)
- Users Management (`/admin/users`)
- Products Management (`/admin/products`)
- Orders (`/admin/orders`)
- Analytics (`/admin/analytics`)
- Content Management (`/admin/content`)
- Messages (`/admin/messages`)
- Notifications (`/admin/notifications`)
- Settings (`/admin/settings`)

### Customizing Colors

Edit the CSS variables in `app/globals.css` to customize the color scheme. The theme uses OKLCH color space for better color manipulation and consistency.

### Adding New Pages

1. Create a new folder in `app/admin/`
2. Add a `page.tsx` file
3. Wrap your content with `<AdminLayout>`
4. Update the sidebar navigation in `components/admin/admin-sidebar.tsx`

## 🔧 Customization

### Modifying the Color Theme

Colors are defined in `app/globals.css` using CSS variables. You can modify these values to match your brand:

```css
:root {
  --primary: oklch(0.38 0.1 168); /* #005D4B */
  --secondary: oklch(0.82 0.18 158); /* #00df83 */
  --destructive: oklch(0.62 0.25 25); /* #ff3c40 */
  --background: oklch(0.97 0.005 180); /* #f1f7f7 */
}
```

### Adding shadcn/ui Components

Install additional components as needed:

```bash
npx shadcn@latest add [component-name]
```

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🌐 Integration Ready

This template is designed to be easily integrated with various backend systems:

- **REST APIs** - Add API routes in `app/api/`
- **Database** - Install Prisma, Drizzle, or your preferred ORM
- **Authentication** - Integrate NextAuth.js or other auth solutions
- **State Management** - Add Zustand, Redux, or other state management libraries

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## 🎨 Design Philosophy

This template follows modern web design principles:

- **Clean and Minimal** - Focus on content, not clutter
- **Consistent** - Unified design language throughout
- **Accessible** - WCAG compliant components
- **Responsive** - Works on all screen sizes
- **Performance** - Optimized for speed and user experience

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
