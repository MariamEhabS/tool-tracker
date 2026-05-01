# Taliho V3 Frontend

A modern construction management platform frontend featuring QR code integration, PDF document handling, and seamless Procore connectivity.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License and Contact](#license-and-contact)

---

## Project Overview

Taliho is a construction industry software platform that bridges the gap between physical job sites and digital documentation. The platform enables construction teams to:

- **Generate and manage QR codes** for equipment, documents, locations, and project resources
- **View and organize PDF documents** directly in the browser with full navigation and zoom controls
- **Integrate with Procore** to sync tools, drawings, inspections, and other construction management data
- **Organize resources** into projects, groups, and hierarchical folder structures
- **Track scans and activity** for compliance and audit purposes

### Tech Stack

| Category      | Technology                   |
| ------------- | ---------------------------- |
| Framework     | React 19 + TypeScript        |
| Build Tool    | Vite 6                       |
| Routing       | TanStack Router (file-based) |
| Server State  | TanStack Query v5            |
| Client State  | Redux Toolkit                |
| Styling       | Tailwind CSS v4              |
| PDF Rendering | PDF.js (pdfjs-dist)          |
| Forms         | React Hook Form + Zod        |
| HTTP Client   | Axios                        |
| Testing       | Vitest + Playwright          |

---

## Workspace Note

For Taliho workspace orchestration (deploy profiles, branch-target deploy, and git sync/merge flows), run commands from root `C:\Projects\Taliho Web App` using the root `package.json` scripts. This frontend repository keeps service-local scripts only.

## Prerequisites

Ensure you have the following installed:

| Tool    | Minimum Version | Recommended Version |
| ------- | --------------- | ------------------- |
| Node.js | 18.x            | 20.x or higher      |
| npm     | 9.x             | 10.x or higher      |
| Git     | 2.x             | Latest              |

**Optional but recommended:**

- VS Code with the following extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd taliho-v3-frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Environment Configuration](#environment-configuration) for details).

### 4. Verify Installation

```bash
npm run dev
```

The application should now be running at `http://localhost:5173`.

---

## Development

### Starting the Development Server

```bash
npm run dev
```

This starts the Vite development server with hot module replacement (HMR) on port 5173.

### Available Scripts

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `npm run dev`      | Start development server            |
| `npm run build`    | TypeScript check + production build |
| `npm run start`    | Serve production build locally      |
| `npm run preview`  | Preview production build            |
| `npm run lint`     | Run ESLint                          |
| `npm run lint:fix` | Fix ESLint issues automatically     |
| `npm run format`   | Format code with Prettier           |

### Build Process

To create a production build:

```bash
npm run build
```

This will:

1. Run TypeScript type checking
2. Bundle the application with Vite
3. Output optimized assets to the `dist/` directory

### Code Quality

Before committing, ensure your code passes linting and formatting:

```bash
npm run lint
npm run format
```

---

## Project Structure

```
taliho-v3-frontend/
├── dist/                    # Production build output
├── e2e/                     # End-to-end tests (Playwright)
│   ├── fixtures/            # Test data and custom fixtures
│   ├── pages/               # Page Object Models
│   ├── tests/               # Test specifications
│   └── utils/               # Test utilities
├── nginx/                   # Nginx configuration for deployment
├── public/                  # Static assets
├── src/
│   ├── __tests__/           # Unit tests
│   ├── api/
│   │   ├── endpoints/       # API endpoint modules
│   │   │   ├── qr-codes.ts  # QR code operations
│   │   │   ├── qr-style.ts  # QR styling configuration
│   │   │   ├── document.ts  # Document upload/management
│   │   │   ├── print.ts     # PDF generation (Letter, Avery, Zebra)
│   │   │   ├── procore.ts   # Procore integration
│   │   │   └── ...          # Other API modules
│   │   └── index.ts         # Axios client configuration
│   ├── assets/              # Images, fonts, and other assets
│   ├── components/
│   │   ├── combobox/        # Searchable dropdown components
│   │   ├── dashboard/       # Dashboard components
│   │   ├── layout/          # Sidebar, AuthLayout, etc.
│   │   ├── loader/          # Loading spinners and skeletons
│   │   ├── modal/           # Modal dialogs
│   │   ├── qr/              # QR code components
│   │   ├── table/           # Data table components
│   │   ├── ui/              # Base UI components
│   │   ├── upload/          # File upload components
│   │   ├── PdfViewer.tsx    # Inline PDF viewer
│   │   └── pdf-opener.tsx   # PDF opening logic
│   ├── hooks/               # Custom React hooks
│   ├── middleware/          # Route guards and auth
│   ├── providers/           # Context providers
│   ├── routes/              # File-based routing (TanStack Router)
│   ├── store/               # Redux store and slices
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── main.tsx             # Application entry point
├── .env.example             # Environment variable template
├── CLAUDE.md                # Development guidance
├── Dockerfile               # Container configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration
└── vitest.config.ts         # Unit test configuration
```

---

## Key Features

### QR Code Management

- **Multiple QR Types**: File, folder, URL, static, and Procore-integrated codes
- **Custom Styling**: Configure colors, shapes, logos, and error correction levels
- **Bulk Operations**: Create, delete, and assign QR codes in batches with real-time progress
- **Password Protection**: Optional time-based and weekday-specific passwords
- **Scan Analytics**: Track scan counts and activity

**Supported QR Code Types:**

```
file           - Link to documents
folder         - Link to folder hierarchies
url            - Redirect to external links
static         - Fixed content codes
procore-tool   - Procore tool integration
procore-location - Procore location data
procore-drawing-code - Procore drawing references
```

### PDF Document Handling

- **Inline Viewing**: Full-featured PDF viewer with page navigation
- **Zoom Controls**: Pinch-to-zoom on mobile, button controls on desktop
- **Keyboard Shortcuts**: Arrow keys, space bar, and escape for navigation
- **Print Generation**: Letter, Avery labels, and Zebra printer formats
- **Multi-part Upload**: Large file support with progress tracking

### Procore Integration

16+ Procore tools supported including:

- Inspections
- Punch Lists
- Forms
- Drawings
- RFIs
- Submittals
- Observations
- Daily Logs
- Photos
- Documents
- Specifications
- Meetings
- Change Events
- Correspondence
- Coordination Issues
- And more...

### Resource Organization

- **Projects**: Top-level organizational units linked to Procore projects
- **Groups**: User-permissioned resource collections
- **Folders**: Hierarchical document organization
- **Equipment & Arrangements**: Legacy grouping (backward compatible)

### Mobile-First Design

- Touch gesture support (pinch-to-zoom, swipe navigation)
- Responsive layouts optimized for field use
- Mobile-optimized QR scanning interface
- Offline-capable architecture

---

## Environment Configuration

Create a `.env` file in the project root with the following variables:

### Required Variables

```env
# Backend API
VITE_BACKEND_URL=http://localhost:4000
VITE_TALIHO_API_KEY=your-api-key

# Procore Integration
VITE_PROCORE_BASE_URL=https://sandbox.procore.com
VITE_ENVIRONMENT=development
```

### Optional Variables

```env
# Error Tracking
VITE_ROLLBAR_ACCESS_TOKEN=your-rollbar-token

# Stripe Billing (for subscription features)
VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER=prod_xxx
VITE_STRIPE_PRODUCT_ID_STANDARD=prod_xxx
VITE_STRIPE_PRODUCT_ID_PROFESSIONAL=prod_xxx
VITE_STRIPE_PRODUCT_ID_BUSINESS=prod_xxx
VITE_STRIPE_PRICE_STANDARD_MONTHLY=price_xxx
VITE_STRIPE_PRICE_STANDARD_ANNUAL=price_xxx
VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxx
VITE_STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_xxx
VITE_STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
VITE_STRIPE_PRICE_BUSINESS_ANNUAL=price_xxx
VITE_STRIPE_STORAGE_ADDON_PRICE=10

# Dev Server Port (default: 5173)
PORT=5173
```

### Environment-Specific Configuration

| Environment | `VITE_PROCORE_BASE_URL`       | `VITE_ENVIRONMENT` |
| ----------- | ----------------------------- | ------------------ |
| Development | `https://sandbox.procore.com` | `development`      |
| Production  | `https://app.procore.com`     | `production`       |

---

## Deployment

### Docker Deployment (Recommended)

Build the Docker image:

```bash
docker build -t taliho-frontend .
```

Run the container:

```bash
docker run -p 80:80 taliho-frontend
```

### Manual Deployment

1. **Build the production bundle:**

   ```bash
   npm run build
   ```

2. **Deploy the `dist/` directory** to your hosting provider (AWS S3, Vercel, Netlify, etc.)

3. **Configure your web server** for SPA routing (all routes should serve `index.html`)

### Nginx Configuration

The `nginx/` directory contains production-ready Nginx configuration for:

- Serving static assets with proper cache headers
- SPA routing (history API fallback)
- Gzip compression for text assets
- Security headers

Example nginx configuration snippet:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Production Checklist

- [ ] Set `VITE_ENVIRONMENT=production`
- [ ] Configure `VITE_PROCORE_BASE_URL` for production Procore
- [ ] Set up Rollbar error tracking
- [ ] Configure Stripe with production keys
- [ ] Enable HTTPS
- [ ] Set appropriate CORS headers on backend

---

## Testing

### Unit Tests (Vitest)

```bash
# Run unit tests
npm run test

# Run with interactive UI
npm run test:ui

# Run with coverage report
npm run test:coverage
```

### End-to-End Tests (Playwright)

```bash
# Run mock-based E2E suite (headless)
npm run test:e2e

# Run real-backend E2E suite (requires seeded/running backend env)
npm run test:e2e:real-backend

# Run with interactive UI mode
npm run test:e2e:ui

# Run with visible browsers
npm run test:e2e:headed

# View HTML test report
npm run test:report
```

`npm run test:e2e` excludes `e2e/tests/real-backend/**` by design.
Use `npm run test:e2e:real-backend` or `./scripts/run-integration-local.{ps1,sh}` for integration coverage against a real backend.

**Tested Devices:**

- iPhone 14 Pro (Safari)
- Pixel 7 (Chrome)

### Visual Regression Tests (Percy)

```bash
npm run test:visual
```

Percy captures screenshots at mobile viewport widths (375px, 393px, 412px) to ensure visual consistency.

### Test Organization

```
e2e/
├── tests/
│   ├── categories.spec.ts      # Category management tests
│   ├── create-flows.spec.ts    # QR creation workflows
│   ├── files-folders.spec.ts   # Document management
│   ├── infrastructure.spec.ts  # Core infrastructure tests
│   ├── password.spec.ts        # Password protection tests
│   ├── qr-entry.spec.ts        # QR scanning entry points
│   └── tools/                  # Procore tool-specific tests
├── pages/                      # Page Object Models
├── fixtures/                   # Test data and fixtures
└── utils/                      # Test utilities
```

---

## Contributing

### Code Style Guidelines

- Follow existing TypeScript patterns and conventions
- Use functional components with hooks
- Prefer TanStack Query for server state management
- Use Redux Toolkit for complex client-side state
- Follow the established component directory structure
- Write meaningful commit messages

### Development Workflow

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Run quality checks**:

   ```bash
   npm run lint
   npm run format
   npm run test
   ```

4. **Commit your changes** with a descriptive message

5. **Push and create a pull request**

### Pull Request Guidelines

- Provide a clear description of changes
- Reference any related issues
- Ensure all tests pass
- Request review from appropriate team members
- Address review feedback promptly

---

## Troubleshooting

### Common Issues

#### Development server not starting

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

#### TypeScript errors after pulling changes

```bash
# TanStack Router generates types on dev server start
npm run dev

# Or manually regenerate
npx tsr generate
```

#### PDF viewer not loading documents

- Ensure the PDF.js worker is properly configured in Vite
- Check browser console for CORS errors
- Verify the document URL is accessible and valid
- Check that signed URLs haven't expired (default: 50 minutes)

#### QR code images not displaying

- Check S3 signed URL expiration
- Verify `VITE_BACKEND_URL` is correctly configured
- Ensure API authentication token is valid
- Check network tab for failed image requests

#### Procore integration issues

- Verify `VITE_PROCORE_BASE_URL` matches your Procore environment (sandbox vs production)
- Ensure the Procore iframe helpers are loading correctly
- Check OAuth token validity and refresh flow
- Verify company has proper Procore permissions

#### Build failures

```bash
# Clear all caches and rebuild
rm -rf node_modules dist
npm install
npm run build
```

#### Authentication issues

- Clear localStorage (`accessToken` and `token` keys)
- Check that the backend is running and accessible
- Verify API key is correctly configured

### Getting Help

1. Check the browser console for error messages
2. Review the [CLAUDE.md](./CLAUDE.md) file for detailed development guidance
3. Check existing issues in the repository
4. Contact the development team

---

## License and Contact

### License

This is proprietary software. All rights reserved. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.

### Contact

For support or inquiries:

- **Technical Issues**: Open an issue in the repository
- **Bug Reports**: Include browser version, steps to reproduce, and relevant console logs
- **Feature Requests**: Describe the use case and proposed solution
- **General Inquiries**: Contact the Taliho development team

---

## Additional Resources

- [CLAUDE.md](./CLAUDE.md) - Comprehensive development guidance and architecture details
- [.env.example](./.env.example) - Environment variable template with descriptions
- [Vite Documentation](https://vitejs.dev/)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/)
- [PDF.js](https://mozilla.github.io/pdf.js/)
- [Procore API Documentation](https://developers.procore.com/)
