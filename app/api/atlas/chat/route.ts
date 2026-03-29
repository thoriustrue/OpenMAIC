/**
 * POST /api/atlas/chat — Multi-agent chat endpoint for Atlas LMS
 * 
 * Authenticated SSE streaming endpoint that wraps the core OpenMAIC
 * chat functionality with Atlas user context.
 * 
 * AGPL-3.0 License: This file is part of the OpenMAIC microservice.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAtlasAuth, type AtlasUserContext } from '@/lib/server/atlas-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('AtlasChat');

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    name: z.string().optional(),
  })),
  context: z.object({
    topic: z.string(),
    learningObjectives: z.array(z.string()).optional(),
    courseContent: z.string().optional(),
  }),
  config: z.object({
    agentMode: z.enum(['single', 'multi']).default('multi'),
    maxTurns: z.number().default(10),
    enableWhiteboard: z.boolean().default(true),
    language: z.string().default('en'),
  }).optional(),
});

/**
 * POST /api/atlas/chat
 * SSE streaming multi-agent discussion
 */
export async function POST(request: NextRequest): Promise<Response> {
  // Authenticate
  const user = await verifyAtlasAuth(request);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', errorCode: 'INVALID_TOKEN' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request', 
          errorCode: 'INVALID_REQUEST',
          details: parsed.error.issues 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, context, config } = parsed.data;

    // Set up SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            userId: user.uid,
            sessionStarted: new Date().toISOString(),
          })}\n\n`));

          // TODO: Integrate with core OpenMAIC director graph
          // For MVP: Simple single-agent response
          if (config?.agentMode === 'single') {
            await handleSingleAgentStream(
              controller,
              encoder,
              messages,
              context,
              user
            );
          } else {
            await handleMultiAgentStream(
              controller,
              encoder,
              messages,
              context,
              config,
              user
            );
          }

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
          })}\n\n`));
          
          controller.close();
        } catch (error) {
          log.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'Stream processing failed',
          })}\n\n`));
          controller.close();
        }
      },
      cancel() {
        log.info('Client disconnected');
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    log.error('Chat request failed:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', errorCode: 'INTERNAL_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Simple single-agent streaming (MVP fallback)
 */
async function handleSingleAgentStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  messages: Array<{ role: string; content: string }>,
  context: { topic: string; learningObjectives?: string[] },
  user: AtlasUserContext
): Promise<void> {
  // TODO: Integrate with OpenMAIC's actual generation pipeline
  // For MVP, send a placeholder response
  
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    type: 'agent_start',
    agent: 'tutor',
    name: 'AI Tutor',
  })}\n\n`));

  // Simulate streaming response
  const response = `I'm here to help you learn about "${context.topic}". ` +
    (context.learningObjectives?.length 
      ? `We'll focus on: ${context.learningObjectives.join(', ')}.` 
      : 'What would you like to explore?');

  // Stream tokens
  for (const word of response.split(' ')) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'token',
      content: word + ' ',
    })}\n\n`));
    await new Promise(r => setTimeout(r, 50)); // Simulate latency
  }

  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    type: 'agent_end',
  })}\n\n`));
}

/**
 * Multi-agent streaming via OpenMAIC director graph
 */
async function handleMultiAgentStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  messages: Array<{ role: string; content: string }>,
  context: { topic: string; learningObjectives?: string[]; courseContent?: string },
  config: { agentMode?: string; maxTurns?: number; enableWhiteboard?: boolean; language?: string } | undefined,
  user: AtlasUserContext
): Promise<void> {
  // TODO: Full integration with OpenMAIC's director graph
  // This requires importing and configuring the LangGraph orchestration
  
  log.info('Multi-agent mode requested (full integration pending)');
  
  // For MVP, fall back to single agent
  await handleSingleAgentStream(controller, encoder, messages, context, user);
}
