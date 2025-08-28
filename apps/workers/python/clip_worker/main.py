#!/usr/bin/env python3
"""
Clip Worker - Video Processing and Clip Generation
Handles ffmpeg operations for video trimming, caption generation, and thumbnail creation.
"""

import asyncio
import json
import logging
import os
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List
import uuid

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as redis
from nats.aio.client import Client as NATS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Clip Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
S3_BUCKET = os.getenv("S3_BUCKET", "speechcoach-clips")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None

class ClipRequest(BaseModel):
    session_id: str
    clip_id: str
    start_time: float
    end_time: float
    title: Optional[str] = None
    description: Optional[str] = None
    aspect_ratio: str = "16:9"
    include_captions: bool = True
    include_thumbnail: bool = True

class ClipResponse(BaseModel):
    session_id: str
    clip_id: str
    task_id: str
    status: str
    message: str

async def download_video(video_url: str) -> str:
    """Download video file from URL to temporary file"""
    import requests
    
    try:
        response = requests.get(video_url, stream=True)
        response.raise_for_status()
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_path = temp_file.name
        temp_file.close()
        
        # Write video data
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Downloaded video to: {temp_path}")
        return temp_path
    except Exception as e:
        logger.error(f"Failed to download video: {e}")
        raise

def get_video_info(video_path: str) -> Dict[str, Any]:
    """Get video information using ffprobe"""
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        info = json.loads(result.stdout)
        
        # Extract relevant information
        format_info = info.get("format", {})
        video_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
        
        return {
            "duration": float(format_info.get("duration", 0)),
            "width": int(video_stream.get("width", 1920)),
            "height": int(video_stream.get("height", 1080)),
            "fps": eval(video_stream.get("r_frame_rate", "30/1")),
            "bitrate": int(format_info.get("bit_rate", 0))
        }
    except Exception as e:
        logger.error(f"Failed to get video info: {e}")
        return {"duration": 0, "width": 1920, "height": 1080, "fps": 30, "bitrate": 0}

def create_clip(video_path: str, start_time: float, end_time: float, output_path: str, 
               aspect_ratio: str = "16:9", include_captions: bool = True) -> bool:
    """Create video clip using ffmpeg"""
    try:
        # Calculate duration
        duration = end_time - start_time
        
        # Base ffmpeg command
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-ss", str(start_time),
            "-t", str(duration),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-crf", "23"
        ]
        
        # Handle aspect ratio
        if aspect_ratio == "16:9":
            cmd.extend(["-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"])
        elif aspect_ratio == "9:16":
            cmd.extend(["-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"])
        elif aspect_ratio == "1:1":
            cmd.extend(["-vf", "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2"])
        
        # Add output path
        cmd.append(output_path)
        
        # Run ffmpeg command
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        logger.info(f"Created clip: {output_path}")
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg error: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"Failed to create clip: {e}")
        return False

def generate_captions(transcript_data: Dict[str, Any], start_time: float, end_time: float) -> List[Dict[str, Any]]:
    """Generate captions for the clip time range"""
    try:
        words = transcript_data.get("words", [])
        captions = []
        
        # Filter words within the clip time range
        clip_words = [word for word in words if start_time <= word.get("start", 0) <= end_time]
        
        if not clip_words:
            return captions
        
        # Group words into caption segments
        current_caption = {
            "start": clip_words[0]["start"] - start_time,
            "end": clip_words[0]["end"] - start_time,
            "text": clip_words[0]["word"]
        }
        
        for word in clip_words[1:]:
            word_start = word["start"] - start_time
            word_end = word["end"] - start_time
            
            # If gap is small, add to current caption
            if word_start - current_caption["end"] < 0.5:
                current_caption["end"] = word_end
                current_caption["text"] += " " + word["word"]
            else:
                # Start new caption
                captions.append(current_caption)
                current_caption = {
                    "start": word_start,
                    "end": word_end,
                    "text": word["word"]
                }
        
        # Add final caption
        captions.append(current_caption)
        
        return captions
        
    except Exception as e:
        logger.error(f"Failed to generate captions: {e}")
        return []

def create_captioned_clip(video_path: str, captions: List[Dict[str, Any]], output_path: str) -> bool:
    """Create video clip with burned-in captions"""
    try:
        if not captions:
            return create_clip(video_path, 0, 10, output_path)
        
        # Create SRT subtitle file
        srt_path = tempfile.mktemp(suffix=".srt")
        with open(srt_path, 'w') as f:
            for i, caption in enumerate(captions, 1):
                start_time = format_time(caption["start"])
                end_time = format_time(caption["end"])
                f.write(f"{i}\n")
                f.write(f"{start_time} --> {end_time}\n")
                f.write(f"{caption['text']}\n\n")
        
        # FFmpeg command with subtitles
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-vf", f"subtitles={srt_path}:force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H000000,Bold=1'",
            "-c:a", "copy",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # Clean up SRT file
        os.unlink(srt_path)
        
        logger.info(f"Created captioned clip: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create captioned clip: {e}")
        return False

def format_time(seconds: float) -> str:
    """Format seconds to SRT time format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millisecs = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"

def create_thumbnail(video_path: str, output_path: str, time_offset: float = 1.0) -> bool:
    """Create thumbnail from video"""
    try:
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-ss", str(time_offset),
            "-vframes", "1",
            "-q:v", "2",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        logger.info(f"Created thumbnail: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create thumbnail: {e}")
        return False

async def upload_to_s3(file_path: str, s3_key: str) -> str:
    """Upload file to S3-compatible storage"""
    try:
        import boto3
        from botocore.config import Config
        
        # Configure S3 client
        s3_client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=os.getenv("S3_ACCESS_KEY", "minioadmin"),
            aws_secret_access_key=os.getenv("S3_SECRET_KEY", "minioadmin"),
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
        
        # Upload file
        s3_client.upload_file(file_path, S3_BUCKET, s3_key)
        
        # Generate presigned URL
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )
        
        logger.info(f"Uploaded to S3: {s3_key}")
        return url
        
    except Exception as e:
        logger.error(f"Failed to upload to S3: {e}")
        raise

async def process_clip(request: ClipRequest) -> Dict[str, Any]:
    """Process video clip creation"""
    try:
        # Get session data
        session_data = await redis_client.get(f"session:{request.session_id}")
        transcript_data = await redis_client.get(f"transcript:{request.session_id}")
        
        if not session_data:
            raise ValueError("Session not found")
        
        session = json.loads(session_data)
        transcript = json.loads(transcript_data) if transcript_data else {}
        
        # Download original video
        video_url = session.get("video_url")
        if not video_url:
            raise ValueError("No video URL found")
        
        video_path = await download_video(video_url)
        
        try:
            # Get video info
            video_info = get_video_info(video_path)
            
            # Create temporary output paths
            clip_path = tempfile.mktemp(suffix=".mp4")
            thumbnail_path = tempfile.mktemp(suffix=".jpg")
            
            # Create clip
            clip_success = create_clip(
                video_path,
                request.start_time,
                request.end_time,
                clip_path,
                request.aspect_ratio,
                request.include_captions
            )
            
            if not clip_success:
                raise Exception("Failed to create clip")
            
            # Generate captions if requested
            captions = []
            if request.include_captions and transcript:
                captions = generate_captions(transcript, request.start_time, request.end_time)
            
            # Create thumbnail if requested
            thumbnail_url = None
            if request.include_thumbnail:
                thumbnail_success = create_thumbnail(clip_path, thumbnail_path, 1.0)
                if thumbnail_success:
                    thumbnail_key = f"thumbnails/{request.clip_id}.jpg"
                    thumbnail_url = await upload_to_s3(thumbnail_path, thumbnail_key)
            
            # Upload clip to S3
            clip_key = f"clips/{request.clip_id}.mp4"
            clip_url = await upload_to_s3(clip_path, clip_key)
            
            # Prepare result
            result = {
                "clip_id": request.clip_id,
                "session_id": request.session_id,
                "title": request.title or f"Clip {request.clip_id}",
                "description": request.description,
                "start_time": request.start_time,
                "end_time": request.end_time,
                "duration": request.end_time - request.start_time,
                "video_url": clip_url,
                "thumbnail_url": thumbnail_url,
                "captions": captions,
                "aspect_ratio": request.aspect_ratio,
                "status": "completed",
                "created_at": asyncio.get_event_loop().time()
            }
            
            logger.info(f"Clip processing completed: {request.clip_id}")
            return result
            
        finally:
            # Clean up temporary files
            for temp_file in [video_path, clip_path, thumbnail_path]:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
                    
    except Exception as e:
        logger.error(f"Clip processing failed: {e}")
        raise

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish clip processing result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "clip_completed",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("clip.done", json.dumps(message).encode())
        logger.info(f"Published clip result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish clip result: {e}")

async def process_clip_task(request: ClipRequest):
    """Background task to process clip creation"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"clip_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "clip_id": request.clip_id,
            "message": "Processing video clip..."
        }))
        
        # Process clip
        result = await process_clip(request)
        
        # Store result in Redis
        await redis_client.set(f"clip:{request.clip_id}", json.dumps(result))
        
        # Update task status
        await redis_client.set(f"clip_task:{task_id}", json.dumps({
            "status": "completed",
            "session_id": request.session_id,
            "clip_id": request.clip_id,
            "message": "Clip processing completed",
            "result": result
        }))
        
        # Publish result to NATS
        await publish_result(request.session_id, result)
        
        logger.info(f"Clip task completed: {request.clip_id}")
        
    except Exception as e:
        logger.error(f"Clip task failed for {request.clip_id}: {e}")
        
        # Update task status
        await redis_client.set(f"clip_task:{task_id}", json.dumps({
            "status": "failed",
            "session_id": request.session_id,
            "clip_id": request.clip_id,
            "message": str(e)
        }))

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup"""
    global redis_client, nats_client
    
    # Connect to Redis
    redis_client = redis.from_url(REDIS_URL)
    await redis_client.ping()
    logger.info("Connected to Redis")
    
    # Connect to NATS
    nats_client = NATS()
    await nats_client.connect(NATS_URL)
    logger.info("Connected to NATS")
    
    # Check ffmpeg availability
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        logger.info("FFmpeg is available")
    except Exception as e:
        logger.error(f"FFmpeg not available: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    if redis_client:
        await redis_client.close()
    if nats_client:
        await nats_client.close()

@app.post("/create", response_model=ClipResponse)
async def create_clip_endpoint(request: ClipRequest, background_tasks: BackgroundTasks):
    """Create clip endpoint"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_clip_task, request)
        
        return ClipResponse(
            session_id=request.session_id,
            clip_id=request.clip_id,
            task_id=task_id,
            status="accepted",
            message="Clip creation started"
        )
        
    except Exception as e:
        logger.error(f"Failed to start clip creation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of clip processing task"""
    try:
        task_data = await redis_client.get(f"clip_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/clip/{clip_id}")
async def get_clip(clip_id: str):
    """Get clip information"""
    try:
        clip_data = await redis_client.get(f"clip:{clip_id}")
        if clip_data:
            return json.loads(clip_data)
        else:
            raise HTTPException(status_code=404, detail="Clip not found")
    except Exception as e:
        logger.error(f"Failed to get clip: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "redis_connected": redis_client is not None,
        "nats_connected": nats_client is not None,
        "ffmpeg_available": True  # Simplified check
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
