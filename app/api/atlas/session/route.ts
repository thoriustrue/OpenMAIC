/**
 * POST /api/atlas/session — Create OpenMAIC session from Atlas LMS
 * 
 * Authenticates Atlas users and creates a session compatible with OpenMAIC.
 * Returns session token and WebSocket/SSE endpoint for real-time interaction.
 * 
 * AGPL-3.0 License: This file is part of the OpenMAIC microservice.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAtlasAuth, generateOpenMAICSession, type AtlasUserContext } from '@/lib/server/atlas-auth';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

const CreateSessionSchema = z.object({
  classroomId: z.string().optional(),
  topic: z.string().min(1).max(500),
  language: z.string().default('en'),
  agentMode: z.enum(['single', 'multi']).default('multi'),
  context: z.object({
    courseId: z.string().optional(),
    lessonId: z.string().optional(),
    moduleId: z.string().optional(),
    learningObjectives: z.array(z.string()).optional(),
  }).optional(),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>;

export interface SessionResponse {
  success: true;
  sessionId: string;
  sessionToken: string;
  chatEndpoint: string;
  classroomEndpoint: string | null;
  expiresAt: string;
  config: {
    topic: string;
    language: string;
    agentMode: 'single' | 'multi';
  };
}

/**
 * POST /api/atlas/session
 * Create a new AI classroom session for an authenticated Atlas user
 */
export const POST = withAtlasAuth(async (
  request: NextRequest,
  user: AtlasUserContext
): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const parsed = CreateSessionSchema.safeParse(body);

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

    const { classroomId, topic, language, agentMode, context } = parsed.data;

    // Generate session
    const sessionId = nanoid(16);
    const sessionToken = generateOpenMAICSession({
      ...user,
      courseId: context?.courseId || user.courseId,
    });

    // Build response
    const response: SessionResponse = {
      success: true,
      sessionId,
      sessionToken,
      chatEndpoint: `/api/atlas/chat?session=${sessionId}`,
      classroomEndpoint: classroomId ? `/classroom/${classroomId}?atlas_session=${sessionId}` : null,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      config: {
        topic,
        language,
        agentMode,
      },
    };

    // TODO: Store session in database if DATABASE_URL configured
    // For MVP, session is stateless (token contains all data)

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Session creation failed:', error);
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
 * GET /api/atlas/session
 * Validate a session token (health check endpoint)
 */
export const GET = withAtlasAuth(async (
  request: NextRequest,
  user: AtlasUserContext
): Promise<NextResponse> => {
  return NextResponse.json({
    success: true,
    user: {
      uid: user.uid,
      email: user.email,
      role: user.role,
      providerId: user.providerId,
      organisationId: user.organisationId,
    },
  });
});
