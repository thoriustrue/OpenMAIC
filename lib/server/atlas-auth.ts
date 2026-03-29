/**
 * AtlasLMS Authentication Bridge for OpenMAIC
 * 
 * This module validates Firebase Auth tokens from Atlas LMS
 * and extracts user context for OpenMAIC sessions.
 * 
 * AGPL-3.0 License: This file is part of the OpenMAIC microservice.
 * The main AtlasLMS codebase remains proprietary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (only once)
const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (getApps().length === 0) {
  initializeApp({
    credential: cert(firebaseAdminConfig),
  });
}

export interface AtlasUserContext {
  uid: string;
  email: string | null;
  role: 'learner' | 'instructor' | 'admin';
  providerId?: string;
  organisationId?: string;
  courseId?: string;
  displayName?: string;
  photoURL?: string;
}

/**
 * Verify Atlas LMS Firebase Auth token
 * Expects: Authorization: Bearer <firebase_id_token>
 */
export async function verifyAtlasAuth(request: NextRequest): Promise<AtlasUserContext | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    
    // Extract Atlas-specific claims
    const role = (decoded.role as AtlasUserContext['role']) || 'learner';
    
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      role,
      providerId: decoded.provider_id as string | undefined,
      organisationId: decoded.organisation_id as string | undefined,
      courseId: decoded.course_id as string | undefined,
      displayName: decoded.name as string | undefined,
      photoURL: decoded.picture as string | undefined,
    };
  } catch (error) {
    console.error('Firebase Auth verification failed:', error);
    return null;
  }
}

/**
 * Middleware wrapper for API routes requiring Atlas auth
 */
export function withAtlasAuth(
  handler: (req: NextRequest, user: AtlasUserContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const user = await verifyAtlasAuth(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    return handler(request, user);
  };
}

/**
 * Generate a session token for OpenMAIC internal use
 * This creates a temporary access code compatible with OpenMAIC's existing auth
 */
export function generateOpenMAICSession(user: AtlasUserContext): string {
  // Create a signed session token that OpenMAIC can verify
  const sessionData = {
    uid: user.uid,
    email: user.email,
    role: user.role,
    providerId: user.providerId,
    organisationId: user.organisationId,
    courseId: user.courseId,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
  };
  
  // Simple base64 encoding (in production, use JWT signing)
  return Buffer.from(JSON.stringify(sessionData)).toString('base64url');
}

/**
 * Verify an OpenMAIC session token
 */
export function verifyOpenMAICSession(token: string): AtlasUserContext | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role,
      providerId: decoded.providerId,
      organisationId: decoded.organisationId,
      courseId: decoded.courseId,
    };
  } catch {
    return null;
  }
}
