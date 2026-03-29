# OpenMAIC Microservice for Atlas LMS

This directory contains the **OpenMAIC microservice** — an AGPL-3.0 licensed AI classroom platform that runs as a separate service alongside the proprietary Atlas LMS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Atlas LMS (Proprietary)                                        │
│  • Firebase Auth                                                │
│  • PostgreSQL / Firestore                                      │
│  • Next.js 14 App Router                                        │
└──────────────┬──────────────────────────────────────────────────┘
               │ JWT Bearer Token
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenMAIC Microservice (AGPL-3.0)                               │
│  • /api/atlas/session   — Create AI sessions                   │
│  • /api/atlas/chat      — Multi-agent SSE streaming            │
│  • /api/atlas/generate  — Classroom generation jobs            │
│  • /classroom/[id]      — Interactive classroom player         │
│  • LangGraph orchestration                                      │
│  • Canvas-based slide renderer                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/server/atlas-auth.ts` | Firebase Auth verification for Atlas JWT tokens |
| `app/api/atlas/session/route.ts` | Session creation endpoint |
| `app/api/atlas/chat/route.ts` | SSE streaming chat endpoint |
| `app/api/atlas/generate/route.ts` | Async classroom generation |
| `.env.atlas` | Environment template for Atlas integration |

## Quick Start

1. **Install dependencies:**
```bash
cd services/openmaic
pnpm install
```

2. **Configure environment:**
```bash
cp .env.atlas .env.local
# Edit .env.local with your Firebase credentials
```

3. **Run development server:**
```bash
pnpm dev
# Runs on http://localhost:3001
```

4. **Configure Atlas LMS:**
Add to Atlas `.env.local`:
```
NEXT_PUBLIC_OPENMAIC_URL=http://localhost:3001
```

## Atlas LMS Integration

The Atlas LMS communicates with OpenMAIC via the client in `src/lib/openmaic/client.ts`:

```typescript
import { createOpenMAICSession, generateOpenMAICClassroom } from '@/lib/openmaic/client';

// Create a live AI session
const session = await createOpenMAICSession('Security Guard Procedures', {
  context: { courseId: 'abc-123', learningObjectives: ['...'] }
});

// Generate a classroom from course content
const job = await generateOpenMAICClassroom({
  title: 'PSiRA Grade E Fundamentals',
  content: courseContent,
  options: { enableSlides: true, enableQuiz: true }
});
```

## License Separation

- **Atlas LMS**: Proprietary / Commercial (separate repository)
- **OpenMAIC Microservice**: AGPL-3.0 (this directory)

This separation ensures AGPL compliance while keeping the main LMS codebase proprietary. Commercial licensing for OpenMAIC can be pursued later from Tsinghua University (`thu_maic@tsinghua.edu.cn`).

## Deployment

### Option 1: Vercel (Recommended for MVP)

Deploy as a separate Vercel project:

```bash
cd services/openmaic
vercel --prod
```

Set environment variables in Vercel dashboard.

### Option 2: Firebase App Hosting (Separate Service)

Add `apphosting.yaml` for Firebase deployment:

```yaml
# services/openmaic/apphosting.yaml
runConfig:
  concurrency: 80
  cpu: 2
  memoryMiB: 2048
  port: 3000
  maxInstances: 50
  minInstances: 1
```

### Option 3: Docker

```bash
docker build -t atlas-openmaic .
docker run -p 3001:3000 --env-file .env.local atlas-openmaic
```

## Security

- All endpoints require valid Firebase Auth JWT from Atlas
- Session tokens expire after 1 hour
- CORS restricted to Atlas LMS origin
- No shared database (stateless by default)

## Future Commercial Licensing

To remove AGPL restrictions, contact:
- Email: thu_maic@tsinghua.edu.cn
- Subject: Atlas LMS Commercial License Inquiry

This allows integrating OpenMAIC code directly into Atlas LMS if desired.
