/**
 * GET /api/atlas/generate/[jobId] — Poll generation status
 * 
 * Check the status of an async classroom generation job.
 * 
 * AGPL-3.0 License: This file is part of the OpenMAIC microservice.
 */

import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAtlasAuth } from '@/lib/server/atlas-auth';

// Reference to the job store from the main route
// In production, use a shared database
interface JobStatus {
  status: 'pending' | 'generating' | 'completed' | 'failed';
  result?: {
    classroomId: string;
    slideCount: number;
    quizCount: number;
    assets: string[];
  };
  error?: string;
}

// Import the job store from the main route (in production, use proper storage)
// This is a workaround for the MVP
let jobStore: Map<string, JobStatus>;

try {
  // Dynamic import to avoid circular dependency issues
  const generateRoute = require('../route');
  jobStore = generateRoute.jobStore || new Map();
} catch {
  jobStore = new Map();
}

export const GET = withAtlasAuth(async (
  request: NextRequest,
  user
): Promise<NextResponse> => {
  const jobId = request.url.split('/').pop();
  
  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'Missing job ID' },
      { status: 400 }
    );
  }

  const job = jobStore.get(jobId);
  
  if (!job) {
    return NextResponse.json(
      { success: false, error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    jobId,
    status: job.status,
    ...(job.result && { result: job.result }),
    ...(job.error && { error: job.error }),
  });
});
