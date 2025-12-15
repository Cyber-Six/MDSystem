# MDSystem - Medical Data Management System

A comprehensive medical data management platform built with **React 19** (frontend) and **Node.js/Express** (backend), designed for the TIP (Technological Institute of the Philippines) ecosystem. The system provides secure patient portals, staff management, and medical consultation features across multiple subdomains.

---

## 🏥 Overview

**MDSystem** is a multi-portal healthcare management platform that serves three distinct user groups:
- **Patient Portal** (`www.mdsystemtip.space`) - Medical records, appointments, e-consultation
- **Staff Portal** (`staff.mdsystemtip.space`) - Administrative and medical staff interface  
- **Medical Portal** (`medic.mdsystemtip.space`) - Advanced medical professional tools

---

## 📁 Repository Structure

```
MDSystem/
├── Backend/                 # Node.js/Express API server
│   ├── config/              # Database, JWT, Redis, security configs
│   ├── routes/              # API route handlers
│   │   ├── auth/            # Authentication endpoints
│   │   ├── patient/         # Patient data & consent management
│   │   └── utils/           # Utility routes (portal detection, auth sessions)
│   ├── services/            # Email service, reCAPTCHA validation
│   └── server.js            # Main server entry point
│
├── mdsystem-frontend/       # React 19 + Vite frontend
│   ├── .dev/                # Development documentation
│   ├── scripts/             # Build & automation scripts
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── config/          # App configuration + auto-generated API docs
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── modules/         # Feature modules (auth, dashboard)
│   │   ├── pages/           # Page components
│   │   ├── routes/          # Route configuration
│   │   ├── services/        # API handlers, token management
│   │   └── styles/          # Global CSS & design system
│   └── public/              # Static assets
│
├── LICENSE                  # Project license
└── README.md                # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **PostgreSQL** 14+ (for backend database)
- **Redis** 6+ (for session management)

### Backend Setup

```bash
cd Backend
npm install

# Configure environment
cp config/config.json.example config/config.json
# Edit config.json with your database credentials

# Start development server
npm start                    # Production mode
npm run dev                  # Development mode with nodemon
```

**Backend runs on:** `http://localhost:3001`

### Frontend Setup

```bash
cd mdsystem-frontend
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API URLs and Google Sheets URL

# Fetch API documentation from Google Sheets
npm run fetch-config

# Start development server
npm run dev
```

**Frontend runs on:** `http://localhost:5173`

---

## 🌐 Domain Architecture

### Production Domains
- **Patient Portal:** `https://www.mdsystemtip.space`
- **Staff Portal:** `https://staff.mdsystemtip.space`  
- **Medical Portal:** `https://medic.mdsystemtip.space`

### Subdomain-Based Routing
The application automatically detects the subdomain and adjusts:
- API base URL routing
- User interface theme/branding
- Available features and permissions
- Role-based access control

---

## 🔑 Key Features

### Authentication & Security
- **JWT-based authentication** with access + refresh tokens
- **Email verification** with OTP (6-digit codes)
- **Two-Factor Authentication (2FA)** via email
- **Google reCAPTCHA v3** integration
- **Token refresh queue** - prevents race conditions on concurrent 401s
- **Secure password reset** with UUID-based reset links
- **Role-based access control** (student, employee, staff, admin)

### Frontend Highlights
- ⚡ **Lightning-fast** with Vite + React 19
- 🎨 **Tailwind CSS v4** with custom design system
- 🔄 **Automatic token refresh** with request queuing
- 🔔 **Global banner notifications** for error/success messages
- 📱 **Responsive design** - mobile-first approach
- 🎯 **Portal auto-detection** from subdomain
- 📊 **Google Sheets integration** for API documentation

### Backend Capabilities
- **RESTful API** with Express.js
- **PostgreSQL database** with parameterized queries
- **Redis caching** for session management
- **Email service** with worker queue (Bull)
- **Rate limiting** to prevent abuse
- **CORS configuration** for multi-subdomain support
- **Security middleware** (Helmet, HPP, XSS protection)

---

## 📚 Documentation

### Frontend Documentation
Located in `mdsystem-frontend/.dev/`:
- **[ENVIRONMENT_VARIABLES.md](mdsystem-frontend/.dev/ENVIRONMENT_VARIABLES.md)** - Complete environment setup guide
- **[SHEETS_INTEGRATION_GUIDE.md](mdsystem-frontend/.dev/SHEETS_INTEGRATION_GUIDE.md)** - Google Sheets API docs integration
- **[CSS_GUIDELINES.md](mdsystem-frontend/.dev/CSS_GUIDELINES.md)** - Design system and styling conventions
- **[copilot-context.md](mdsystem-frontend/.dev/copilot-context.md)** - AI Copilot integration guide
- **[file_structure.md](mdsystem-frontend/.dev/file_structure.md)** - Complete file structure reference
- **[token-refresh-mechanism.md](mdsystem-frontend/.dev/token-refresh-mechanism.md)** - Token management details
- **[login-integration-notes.md](mdsystem-frontend/.dev/login-integration-notes.md)** - Login flow implementation

### Generated Documentation
- **[src/config/generated/api-endpoints.json](mdsystem-frontend/src/config/generated/api-endpoints.json)** - Auto-generated from Google Sheets
  - Run `npm run fetch-config` to update

---

## 🛠️ Development Workflow

### Frontend Development
```bash
cd mdsystem-frontend

npm run dev              # Start dev server (auto-fetches Google Sheets)
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run fetch-config     # Manually fetch Google Sheets data
```

### Backend Development
```bash
cd Backend

npm start                # Production server
npm run dev              # Dev server with auto-reload (nodemon)
npm test                 # Run tests (if configured)
```

### Environment Variables

**Frontend (`.env.local`):**
```env
VITE_API_URL=http://localhost:3001
VITE_PATIENT_API_URL=https://www.mdsystemtip.space
VITE_STAFF_API_URL=https://staff.mdsystemtip.space
ENDPOINTS_SHEET_URL=https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
```

**Backend (`config/config.json`):**
```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "mdsystem",
    "user": "postgres",
    "password": "your_password"
  },
  "jwt": {
    "accessTokenSecret": "your_access_secret",
    "refreshTokenSecret": "your_refresh_secret"
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}
```

---

## 🧪 Testing

### Frontend Testing
```bash
cd mdsystem-frontend
npm run lint             # Code quality checks
```

### Backend Testing
```bash
cd Backend
npm test                 # Run test suite (configure as needed)
```

---

## 📦 Deployment

### Frontend (Vite Build)
```bash
cd mdsystem-frontend
npm run build            # Creates optimized build in dist/
```

Deploy the `dist/` folder to your hosting service (Vercel, Netlify, etc.).

### Backend (Node.js Server)
```bash
cd Backend
npm start                # Production mode

# Or use PM2 for process management:
pm2 start server.js --name mdsystem-backend
pm2 startup              # Auto-start on reboot
pm2 save
```

### Nginx Configuration (Multi-subdomain)
```nginx
# Patient Portal (www)
server {
    server_name www.mdsystemtip.space;
    location / {
        proxy_pass http://localhost:5173;  # Frontend
    }
    location /api {
        proxy_pass http://localhost:3001;  # Backend
    }
}

# Staff Portal
server {
    server_name staff.mdsystemtip.space;
    location / {
        proxy_pass http://localhost:5173;  # Same frontend (detects subdomain)
    }
    location /api {
        proxy_pass http://localhost:3001;  # Backend
    }
}
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Coding Standards
- Follow **ESLint** rules (run `npm run lint`)
- Use **CSS Modules** for component-scoped styles
- Write **descriptive commit messages**
- Document new features in `.dev/` folder

---

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

**Project Owner:** K1taru  
**Institution:** Technological Institute of the Philippines (TIP)

### Contact
- **Email:** jennifer.enriquez@tip.edu.ph, allegofg.cpe@tip.edu.ph
- **Repository:** https://github.com/K1taru/MDSystem

---

## 🙏 Acknowledgments

- **React Team** - For React 19 with improved performance
- **Vite Team** - For the blazing-fast build tool
- **Tailwind CSS** - For the utility-first CSS framework
- **TIP Community** - For testing and feedback

---

## 📝 Changelog

### Latest Updates
- ✅ **Google Sheets Integration** - Auto-generate API docs from spreadsheets
- ✅ **Tailwind CSS v4** - Modern design system implementation
- ✅ **Auth Page Redesign** - Fullscreen landing with sliding panel
- ✅ **Token Refresh Queue** - Prevents duplicate refresh requests
- ✅ **Global Banner System** - User-friendly error/success notifications
- ✅ **Multi-subdomain Support** - Patient, Staff, Medical portals

---

<div align="center">

**Built with ❤️ for the TIP Healthcare Community**

[Report Bug](https://github.com/K1taru/MDSystem/issues) · [Request Feature](https://github.com/K1taru/MDSystem/issues) · [Documentation](mdsystem-frontend/.dev/)

</div>