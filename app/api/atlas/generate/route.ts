/**
 * POST /api/atlas/generate — Generate AI classroom from Atlas course content
 * 
 * Async job endpoint that triggers OpenMAIC's classroom generation pipeline
 * with Atlas-specific context (course materials, learning objectives).
 * 
 * AGPL-3.0 License: This file is part of the OpenMAIC microservice.
 */

import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { withAtlasAuth, type AtlasUserContext } from '@/lib/server/atlas-auth';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('AtlasGenerate');

const GenerateRequestSchema = z.object({
  // Source content from Atlas
  courseId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  
  // Direct content input
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  content: z.string().max(50000).optional(), // Course content text
  pdfUrl: z.string().url().optional(), // Firebase Storage URL to PDF
  
  // Learning configuration
  learningObjectives: z.array(z.string().max(500)).max(10).optional(),
  targetAudience: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  estimatedDuration: z.number().min(5).max(180).default(30), // minutes
  
  // Generation options
  options: z.object({
    enableSlides: z.boolean().default(true),
    enableQuiz: z.boolean().default(true),
    enableInteractive: z.boolean().default(true),
    enablePBL: z.boolean().default(false), // Project-based learning
    enableTTS: z.boolean().default(false),
    enableWebSearch: z.boolean().default(false),
    agentMode: z.enum(['single', 'multi']).default('multi'),
    language: z.string().default('en'),
  }).optional(),
});

export type GenerateClassroomRequest = z.infer<typeof GenerateRequestSchema>;

export interface GenerateJobResponse {
  success: true;
  jobId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  pollUrl: string;
  estimatedSeconds: number;
}

// In-memory job store (replace with database for production)
const jobStore = new Map<string, {
  status: GenerateJobResponse['status'];
  result?: {
    classroomId: string;
    slideCount: number;
    quizCount: number;
    assets: string[];
  };
  error?: string;
}>();

/**
 * POST /api/atlas/generate
 * Submit a classroom generation job
 */
export const POST = withAtlasAuth(async (
  request: NextRequest,
  user: AtlasUserContext
): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request', 
          errorCode: 'INVALID_REQUEST',
          details: parsed.error.issues 
        },
        { status: 400 }
      );
    }

    const { title, description, content, pdfUrl, learningObjectives, options } = parsed.data;

    // Create job
    const jobId = nanoid(12);
    jobStore.set(jobId, { status: 'pending' });

    const baseUrl = new URL(request.url).origin;
    const pollUrl = `${baseUrl}/api/atlas/generate/${jobId}`;

    // Start async generation (fire-and-forget)
    // Note: Using Promise.resolve() to avoid blocking the response
    Promise.resolve().then(() => runGenerationJob(jobId, parsed.data, user));

    const response: GenerateJobResponse = {
      success: true,
      jobId,
      status: 'pending',
      pollUrl,
      estimatedSeconds: 120, // 2 minutes for typical generation
    };

    return NextResponse.json(response, { status: 202 });

  } catch (error) {
    log.error('Generation request failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal error', 
        errorCode: 'INTERNAL_ERROR' 
      },
      { status: 500 }
    );
  }
});

/**
 * Async generation job runner
 */
async function runGenerationJob(
  jobId: string,
  request: GenerateClassroomRequest,
  user: AtlasUserContext
): Promise<void> {
  try {
    log.info(`Starting generation job ${jobId} for user ${user.uid}`);
    jobStore.set(jobId, { status: 'generating' });

    // TODO: Integrate with OpenMAIC's actual generation pipeline
    // For MVP: Simulate generation with delay
    
    // Phase 1: Content analysis
    await new Promise(r => setTimeout(r, 5000));
    
    // Phase 2: Outline generation
    await new Promise(r => setTimeout(r, 8000));
    
    // Phase 3: Scene generation
    await new Promise(r => setTimeout(r, 15000));
    
    // Phase 4: Asset generation (if enabled)
    if (request.options?.enableTTS) {
      await new Promise(r => setTimeout(r, 10000));
    }

    // Mock result
    const classroomId = nanoid(10);
    jobStore.set(jobId, {
      status: 'completed',
      result: {
        classroomId,
        slideCount: 8,
        quizCount: request.options?.enableQuiz ? 3 : 0,
        assets: [],
      },
    });

    log.info(`Generation job ${jobId} completed`);

  } catch (error) {
    log.error(`Generation job ${jobId} failed:`, error);
    jobStore.set(jobId, { 
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
