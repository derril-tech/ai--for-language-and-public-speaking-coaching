# AI Coaching Platform - API Documentation

## Overview

The AI Coaching Platform provides a comprehensive REST API and WebSocket interface for speech analysis, coaching, and progress tracking. This document covers all available endpoints, request/response formats, and authentication methods.

## Base URL

- **Production**: `https://api.ai-coaching.com`
- **Staging**: `https://api-staging.ai-coaching.com`
- **Development**: `http://localhost:3001`

## Authentication

### JWT Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <jwt-token>
```

### API Key Authentication

For service-to-service communication, use API key authentication:

```http
X-API-Key: <api-key>
```

### Session Authentication

For WebSocket connections, use session-based authentication:

```javascript
const socket = io('wss://api.ai-coaching.com', {
  auth: {
    token: '<jwt-token>'
  }
});
```

## Common Response Formats

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2023-12-01T10:00:00Z",
    "requestId": "req_123456789"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2023-12-01T10:00:00Z",
    "requestId": "req_123456789"
  }
}
```

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "organizationId": "org_123" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "organizationId": "org_123",
      "createdAt": "2023-12-01T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### POST /auth/login

Authenticate user and receive access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### POST /auth/logout

Logout user and invalidate tokens.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Session Management

### POST /sessions

Create a new recording session.

**Request Body:**
```json
{
  "title": "Presentation Practice",
  "description": "Practicing for tomorrow's presentation",
  "type": "presentation", // "presentation", "interview", "conversation", "speech"
  "duration": 300, // Expected duration in seconds
  "settings": {
    "enableRealTimeProcessing": true,
    "enableProsodyAnalysis": true,
    "enableFluencyAnalysis": true,
    "enableScoring": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session_123",
      "title": "Presentation Practice",
      "description": "Practicing for tomorrow's presentation",
      "type": "presentation",
      "status": "created",
      "createdAt": "2023-12-01T10:00:00Z",
      "uploadUrl": "https://api.ai-coaching.com/sessions/session_123/upload",
      "websocketUrl": "wss://api.ai-coaching.com/sessions/session_123"
    }
  }
}
```

### GET /sessions

List user's sessions with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status (created, processing, completed, failed)
- `type`: Filter by session type
- `startDate`: Filter sessions created after this date
- `endDate`: Filter sessions created before this date

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_123",
        "title": "Presentation Practice",
        "type": "presentation",
        "status": "completed",
        "duration": 285,
        "createdAt": "2023-12-01T10:00:00Z",
        "completedAt": "2023-12-01T10:05:00Z",
        "score": 85.5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### GET /sessions/{sessionId}

Get detailed information about a specific session.

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session_123",
      "title": "Presentation Practice",
      "description": "Practicing for tomorrow's presentation",
      "type": "presentation",
      "status": "completed",
      "duration": 285,
      "createdAt": "2023-12-01T10:00:00Z",
      "completedAt": "2023-12-01T10:05:00Z",
      "mediaUrl": "https://cdn.ai-coaching.com/media/session_123.mp4",
      "transcript": {
        "text": "Good morning everyone...",
        "confidence": 0.95,
        "wordTimings": [
          {
            "word": "Good",
            "start": 0.0,
            "end": 0.3,
            "confidence": 0.98
          }
        ]
      },
      "metrics": {
        "wpm": 150,
        "pitch": {
          "mean": 120,
          "std": 15,
          "range": [100, 140]
        },
        "volume": {
          "mean": -20,
          "std": 5,
          "range": [-25, -15]
        },
        "pauses": [
          {
            "start": 2.5,
            "end": 3.2,
            "duration": 0.7
          }
        ]
      },
      "scores": {
        "overall": 85.5,
        "clarity": 88.0,
        "pace": 82.0,
        "engagement": 87.0,
        "confidence": 84.0
      },
      "fluency": {
        "fillerWords": [
          {
            "word": "um",
            "count": 3,
            "timestamps": [1.2, 4.5, 8.1]
          }
        ],
        "grammarErrors": [
          {
            "error": "Subject-verb agreement",
            "suggestion": "are -> is",
            "position": 15
          }
        ]
      }
    }
  }
}
```

### DELETE /sessions/{sessionId}

Delete a session and all associated data.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Session deleted successfully"
  }
}
```

## Media Upload

### POST /sessions/{sessionId}/upload

Upload media file for processing.

**Headers:**
```http
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>
```

**Form Data:**
- `file`: Audio/video file (MP3, WAV, MP4, WebM)
- `metadata`: JSON string with additional metadata

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_123",
    "status": "uploading",
    "progress": 0,
    "estimatedTime": 30
  }
}
```

### GET /sessions/{sessionId}/upload/{uploadId}/status

Get upload progress and status.

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_123",
    "status": "completed",
    "progress": 100,
    "fileSize": 10485760,
    "uploadedBytes": 10485760,
    "processingStatus": "queued"
  }
}
```

## Real-time Processing

### WebSocket Connection

Connect to real-time processing updates:

```javascript
const socket = io('wss://api.ai-coaching.com/sessions/session_123', {
  auth: {
    token: '<jwt-token>'
  }
});

// Listen for ASR tokens
socket.on('asr:token', (data) => {
  console.log('ASR Token:', data);
});

// Listen for metrics updates
socket.on('metrics:update', (data) => {
  console.log('Metrics Update:', data);
});

// Listen for processing status
socket.on('processing:status', (data) => {
  console.log('Processing Status:', data);
});
```

### WebSocket Events

#### asr:token
Real-time speech recognition tokens.

```json
{
  "type": "asr:token",
  "data": {
    "token": "Good",
    "confidence": 0.98,
    "start": 0.0,
    "end": 0.3,
    "isFinal": false
  }
}
```

#### metrics:update
Real-time metrics updates.

```json
{
  "type": "metrics:update",
  "data": {
    "timestamp": 2.5,
    "wpm": 145,
    "pitch": 125,
    "volume": -18,
    "pauses": [
      {
        "start": 2.0,
        "end": 2.5,
        "duration": 0.5
      }
    ]
  }
}
```

#### processing:status
Processing pipeline status updates.

```json
{
  "type": "processing:status",
  "data": {
    "stage": "prosody",
    "progress": 60,
    "estimatedTime": 30,
    "status": "processing"
  }
}
```

## Analysis Results

### GET /sessions/{sessionId}/transcript

Get session transcript with word-level timing.

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": {
      "text": "Good morning everyone, thank you for joining us today...",
      "confidence": 0.95,
      "language": "en",
      "wordTimings": [
        {
          "word": "Good",
          "start": 0.0,
          "end": 0.3,
          "confidence": 0.98
        },
        {
          "word": "morning",
          "start": 0.4,
          "end": 0.8,
          "confidence": 0.97
        }
      ],
      "segments": [
        {
          "start": 0.0,
          "end": 5.2,
          "text": "Good morning everyone, thank you for joining us today.",
          "confidence": 0.96
        }
      ]
    }
  }
}
```

### GET /sessions/{sessionId}/metrics

Get detailed metrics analysis.

**Query Parameters:**
- `granularity`: Data granularity (second, 5second, 10second, minute)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "summary": {
        "duration": 285,
        "wpm": 150,
        "totalPauses": 8,
        "pauseTime": 12.5,
        "fillerWords": 5
      },
      "timeline": [
        {
          "timestamp": 0,
          "wpm": 145,
          "pitch": 120,
          "volume": -20,
          "pauses": []
        },
        {
          "timestamp": 1,
          "wpm": 152,
          "pitch": 125,
          "volume": -18,
          "pauses": []
        }
      ],
      "pitch": {
        "mean": 120,
        "std": 15,
        "min": 100,
        "max": 140,
        "trend": "stable"
      },
      "volume": {
        "mean": -20,
        "std": 5,
        "min": -25,
        "max": -15,
        "trend": "increasing"
      },
      "pauses": [
        {
          "start": 2.5,
          "end": 3.2,
          "duration": 0.7,
          "type": "natural"
        }
      ]
    }
  }
}
```

### GET /sessions/{sessionId}/scores

Get detailed scoring analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "scores": {
      "overall": 85.5,
      "categories": {
        "clarity": {
          "score": 88.0,
          "weight": 0.25,
          "factors": {
            "pronunciation": 90,
            "articulation": 86,
            "volume": 88
          }
        },
        "pace": {
          "score": 82.0,
          "weight": 0.20,
          "factors": {
            "speed": 85,
            "rhythm": 80,
            "pauses": 81
          }
        },
        "engagement": {
          "score": 87.0,
          "weight": 0.25,
          "factors": {
            "enthusiasm": 89,
            "variety": 85,
            "connection": 87
          }
        },
        "confidence": {
          "score": 84.0,
          "weight": 0.30,
          "factors": {
            "posture": 86,
            "eyeContact": 82,
            "gestures": 84
          }
        }
      },
      "benchmarks": {
        "beginner": 60,
        "intermediate": 75,
        "advanced": 90,
        "expert": 95
      },
      "improvements": [
        {
          "category": "pace",
          "suggestion": "Slow down during key points",
          "impact": "high"
        }
      ]
    }
  }
}
```

### GET /sessions/{sessionId}/fluency

Get fluency analysis results.

**Response:**
```json
{
  "success": true,
  "data": {
    "fluency": {
      "fillerWords": [
        {
          "word": "um",
          "count": 3,
          "timestamps": [1.2, 4.5, 8.1],
          "frequency": 0.6
        },
        {
          "word": "uh",
          "count": 2,
          "timestamps": [12.3, 18.7],
          "frequency": 0.4
        }
      ],
      "grammarErrors": [
        {
          "error": "Subject-verb agreement",
          "suggestion": "are -> is",
          "position": 15,
          "severity": "medium"
        }
      ],
      "repetitions": [
        {
          "phrase": "you know",
          "count": 2,
          "timestamps": [25.1, 45.3]
        }
      ],
      "overallFluency": 87.5
    }
  }
}
```

## Drills and Practice

### GET /drills

Get personalized practice drills.

**Query Parameters:**
- `difficulty`: Drill difficulty (beginner, intermediate, advanced)
- `category`: Drill category (pronunciation, pace, confidence)
- `limit`: Number of drills to return

**Response:**
```json
{
  "success": true,
  "data": {
    "drills": [
      {
        "id": "drill_123",
        "title": "Minimal Pairs Practice",
        "description": "Practice distinguishing between similar sounds",
        "category": "pronunciation",
        "difficulty": "intermediate",
        "duration": 300,
        "exercises": [
          {
            "type": "minimal_pair",
            "word1": "ship",
            "word2": "sheep",
            "audioUrl": "https://cdn.ai-coaching.com/drills/drill_123/exercise_1.mp3"
          }
        ]
      }
    ]
  }
}
```

### POST /drills/{drillId}/start

Start a drill session.

**Response:**
```json
{
  "success": true,
  "data": {
    "drillSession": {
      "id": "drill_session_123",
      "drillId": "drill_123",
      "status": "active",
      "startedAt": "2023-12-01T10:00:00Z",
      "websocketUrl": "wss://api.ai-coaching.com/drills/drill_session_123"
    }
  }
}
```

### POST /drills/{drillId}/submit

Submit drill response for scoring.

**Request Body:**
```json
{
  "audioData": "base64-encoded-audio",
  "response": "ship",
  "exerciseIndex": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "feedback": "Good pronunciation! Try to emphasize the 'i' sound more.",
    "correctAnswer": "ship",
    "accuracy": 0.92
  }
}
```

## Clips and Sharing

### POST /sessions/{sessionId}/clips

Create a highlight clip from session.

**Request Body:**
```json
{
  "title": "Best Moment",
  "startTime": 45.0,
  "endTime": 75.0,
  "format": "mp4", // mp4, gif, webm
  "quality": "high", // low, medium, high
  "includeCaptions": true,
  "captionsStyle": "modern"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clip": {
      "id": "clip_123",
      "title": "Best Moment",
      "status": "processing",
      "estimatedTime": 60,
      "downloadUrl": null
    }
  }
}
```

### GET /sessions/{sessionId}/clips

List clips for a session.

**Response:**
```json
{
  "success": true,
  "data": {
    "clips": [
      {
        "id": "clip_123",
        "title": "Best Moment",
        "startTime": 45.0,
        "endTime": 75.0,
        "duration": 30.0,
        "format": "mp4",
        "status": "completed",
        "downloadUrl": "https://cdn.ai-coaching.com/clips/clip_123.mp4",
        "thumbnailUrl": "https://cdn.ai-coaching.com/clips/clip_123_thumb.jpg",
        "createdAt": "2023-12-01T10:30:00Z"
      }
    ]
  }
}
```

### GET /clips/{clipId}/status

Get clip processing status.

**Response:**
```json
{
  "success": true,
  "data": {
    "clip": {
      "id": "clip_123",
      "status": "completed",
      "progress": 100,
      "downloadUrl": "https://cdn.ai-coaching.com/clips/clip_123.mp4",
      "fileSize": 5242880
    }
  }
}
```

## Reports and Analytics

### GET /reports/sessions

Generate session report.

**Query Parameters:**
- `startDate`: Start date for report period
- `endDate`: End date for report period
- `format`: Report format (pdf, csv, json)

**Response:**
```json
{
  "success": true,
  "data": {
    "report": {
      "id": "report_123",
      "type": "sessions",
      "period": {
        "start": "2023-11-01T00:00:00Z",
        "end": "2023-11-30T23:59:59Z"
      },
      "summary": {
        "totalSessions": 25,
        "totalDuration": 7200,
        "averageScore": 82.5,
        "improvement": 5.2
      },
      "trends": {
        "scores": [
          {
            "date": "2023-11-01",
            "averageScore": 78.0
          }
        ],
        "duration": [
          {
            "date": "2023-11-01",
            "averageDuration": 280
          }
        ]
      },
      "downloadUrl": "https://cdn.ai-coaching.com/reports/report_123.pdf"
    }
  }
}
```

### GET /analytics/progress

Get user progress analytics.

**Query Parameters:**
- `period`: Analysis period (week, month, quarter, year)
- `metrics`: Comma-separated list of metrics to include

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "period": "month",
      "overallScore": {
        "current": 85.5,
        "previous": 80.3,
        "change": 5.2,
        "trend": "improving"
      },
      "categoryScores": {
        "clarity": {
          "current": 88.0,
          "previous": 82.0,
          "change": 6.0
        },
        "pace": {
          "current": 82.0,
          "previous": 78.0,
          "change": 4.0
        }
      },
      "practiceTime": {
        "total": 7200,
        "average": 240,
        "sessions": 30
      },
      "improvements": [
        {
          "category": "clarity",
          "improvement": 6.0,
          "sessions": 15
        }
      ]
    }
  }
}
```

## Search and Discovery

### GET /search/sessions

Search sessions by content and metadata.

**Query Parameters:**
- `q`: Search query
- `filters`: JSON string with filters
- `sort`: Sort order (relevance, date, score)
- `page`: Page number
- `limit`: Results per page

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "session_123",
        "title": "Presentation Practice",
        "type": "presentation",
        "score": 85.5,
        "duration": 285,
        "createdAt": "2023-12-01T10:00:00Z",
        "highlights": [
          {
            "text": "Good morning everyone",
            "start": 0.0,
            "end": 1.2
          }
        ],
        "relevance": 0.95
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

## User Management

### GET /user/profile

Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "organizationId": "org_123",
      "preferences": {
        "language": "en",
        "timezone": "America/New_York",
        "notifications": {
          "email": true,
          "push": false
        }
      },
      "stats": {
        "totalSessions": 45,
        "totalPracticeTime": 10800,
        "averageScore": 82.5,
        "streak": 7
      },
      "createdAt": "2023-01-01T00:00:00Z"
    }
  }
}
```

### PUT /user/profile

Update user profile.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "preferences": {
    "language": "en",
    "timezone": "America/New_York",
    "notifications": {
      "email": true,
      "push": true
    }
  }
}
```

### DELETE /user/account

Delete user account and all data.

**Request Body:**
```json
{
  "password": "securePassword123",
  "reason": "No longer needed"
}
```

## Organization Management

### GET /organizations

List user's organizations.

**Response:**
```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "id": "org_123",
        "name": "Acme Corp",
        "role": "admin",
        "memberCount": 25,
        "createdAt": "2023-01-01T00:00:00Z"
      }
    ]
  }
}
```

### GET /organizations/{orgId}/members

List organization members.

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "user_123",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "admin",
        "joinedAt": "2023-01-01T00:00:00Z"
      }
    ]
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `VALIDATION_ERROR` | Invalid request data |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `PROCESSING_ERROR` | Error during processing |
| `STORAGE_ERROR` | File storage error |
| `EXTERNAL_SERVICE_ERROR` | Third-party service error |

## Rate Limits

- **Authentication endpoints**: 10 requests per minute
- **Session creation**: 5 requests per minute
- **File uploads**: 3 requests per minute
- **General API**: 100 requests per minute
- **WebSocket connections**: 10 concurrent connections per user

## Webhooks

### POST /webhooks/session-completed

Webhook triggered when session processing is completed.

**Headers:**
```http
X-Webhook-Signature: <hmac-signature>
Content-Type: application/json
```

**Body:**
```json
{
  "event": "session.completed",
  "sessionId": "session_123",
  "userId": "user_123",
  "timestamp": "2023-12-01T10:05:00Z",
  "data": {
    "status": "completed",
    "score": 85.5,
    "duration": 285
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @ai-coaching/sdk
```

```javascript
import { AICoachingClient } from '@ai-coaching/sdk';

const client = new AICoachingClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.ai-coaching.com'
});

// Create session
const session = await client.sessions.create({
  title: 'Presentation Practice',
  type: 'presentation'
});

// Upload media
await client.sessions.upload(session.id, file);

// Get results
const results = await client.sessions.getResults(session.id);
```

### Python

```bash
pip install ai-coaching-sdk
```

```python
from ai_coaching import AICoachingClient

client = AICoachingClient(
    api_key='your-api-key',
    base_url='https://api.ai-coaching.com'
)

# Create session
session = client.sessions.create(
    title='Presentation Practice',
    type='presentation'
)

# Upload media
client.sessions.upload(session.id, file_path)

# Get results
results = client.sessions.get_results(session.id)
```

## Support

For API support and questions:

- **Documentation**: https://docs.ai-coaching.com/api
- **SDK Documentation**: https://docs.ai-coaching.com/sdk
- **API Status**: https://status.ai-coaching.com
- **Support Email**: api-support@ai-coaching.com
- **Developer Discord**: https://discord.gg/ai-coaching
