# Environment Setup

## ⚠️ IMPORTANT: First Time Setup

If you just cloned this repository, you need to create your `.env` file:

```bash
# Copy the example file
cp .env.example .env
```

The `.env` file is **git-ignored** and will not be committed. This is for security since we're working on a public repository.

## What's in .env?

The `.env` file contains configuration for:
- Local development API URL
- Production API URLs for patient and staff portals

See `.env.example` for all available variables.

## Need Help?

See `.dev/ENVIRONMENT_VARIABLES.md` for complete documentation.
