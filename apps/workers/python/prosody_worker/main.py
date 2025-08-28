#!/usr/bin/env python3
"""
Prosody Worker - Speech Prosody Analysis
Analyzes F0, RMS, jitter, shimmer, pauses, and WPM using Parselmouth and librosa.
"""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List
import uuid

import numpy as np
import librosa
import parselmouth
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as redis
from nats.aio.client import Client as NATS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Prosody Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
SAMPLE_RATE = 16000
FRAME_LENGTH = 0.025  # 25ms frames
HOP_LENGTH = 0.010    # 10ms hop

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None

class ProsodyAnalysisRequest(BaseModel):
    session_id: str
    audio_url: str
    transcript_data: Optional[Dict[str, Any]] = None

class ProsodyAnalysisResponse(BaseModel):
    session_id: str
    task_id: str
    status: str
    message: str

async def download_audio(audio_url: str) -> str:
    """Download audio file from URL to temporary file"""
    import requests
    
    try:
        response = requests.get(audio_url, stream=True)
        response.raise_for_status()
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_path = temp_file.name
        temp_file.close()
        
        # Write audio data
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Downloaded audio to: {temp_path}")
        return temp_path
    except Exception as e:
        logger.error(f"Failed to download audio: {e}")
        raise

def analyze_f0(audio_path: str) -> Dict[str, Any]:
    """Analyze fundamental frequency (F0) using Parselmouth"""
    try:
        # Load audio with Parselmouth
        sound = parselmouth.Sound(audio_path)
        
        # Extract pitch
        pitch = sound.to_pitch()
        f0_values = pitch.selected_array['frequency']
        f0_times = pitch.xs()
        
        # Filter out unvoiced segments (F0 = 0)
        voiced_mask = f0_values > 0
        voiced_f0 = f0_values[voiced_mask]
        voiced_times = f0_times[voiced_mask]
        
        if len(voiced_f0) == 0:
            return {
                "mean": 0.0,
                "std": 0.0,
                "min": 0.0,
                "max": 0.0,
                "timeline": []
            }
        
        # Calculate statistics
        f0_stats = {
            "mean": float(np.mean(voiced_f0)),
            "std": float(np.std(voiced_f0)),
            "min": float(np.min(voiced_f0)),
            "max": float(np.max(voiced_f0)),
            "timeline": [
                {"timestamp": float(t), "value": float(f0)}
                for t, f0 in zip(voiced_times, voiced_f0)
            ]
        }
        
        logger.info(f"F0 analysis completed: mean={f0_stats['mean']:.1f}Hz")
        return f0_stats
        
    except Exception as e:
        logger.error(f"F0 analysis failed: {e}")
        raise

def analyze_rms(audio_path: str) -> Dict[str, Any]:
    """Analyze Root Mean Square (RMS) energy"""
    try:
        # Load audio with librosa
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
        
        # Calculate RMS energy
        frame_length = int(FRAME_LENGTH * sr)
        hop_length = int(HOP_LENGTH * sr)
        
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
        
        # Convert to dB
        rms_db = 20 * np.log10(rms + 1e-10)
        
        rms_stats = {
            "mean": float(np.mean(rms_db)),
            "std": float(np.std(rms_db)),
            "min": float(np.min(rms_db)),
            "max": float(np.max(rms_db)),
            "timeline": [
                {"timestamp": float(t), "value": float(rms_val)}
                for t, rms_val in zip(times, rms_db)
            ]
        }
        
        logger.info(f"RMS analysis completed: mean={rms_stats['mean']:.1f}dB")
        return rms_stats
        
    except Exception as e:
        logger.error(f"RMS analysis failed: {e}")
        raise

def analyze_jitter_shimmer(audio_path: str) -> Dict[str, Any]:
    """Analyze jitter and shimmer using Parselmouth"""
    try:
        # Load audio with Parselmouth
        sound = parselmouth.Sound(audio_path)
        
        # Extract pitch
        pitch = sound.to_pitch()
        
        # Calculate jitter (local)
        point_process = parselmouth.praat.call(sound, "To PointProcess (periodic, cc)...", 75, 600)
        jitter_local = parselmouth.praat.call(point_process, "Get jitter (local)...", 0, 0, 0.0001, 0.02, 1.3)
        
        # Calculate shimmer (local)
        shimmer_local = parselmouth.praat.call(point_process, "Get shimmer (local)...", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        
        jitter_shimmer_stats = {
            "jitter_local": float(jitter_local),
            "shimmer_local": float(shimmer_local),
            "jitter_rap": float(parselmouth.praat.call(point_process, "Get jitter (rap)...", 0, 0, 0.0001, 0.02, 1.3)),
            "jitter_ppq5": float(parselmouth.praat.call(point_process, "Get jitter (ppq5)...", 0, 0, 0.0001, 0.02, 1.3)),
            "shimmer_apq3": float(parselmouth.praat.call(point_process, "Get shimmer (apq3)...", 0, 0, 0.0001, 0.02, 1.3, 1.6)),
            "shimmer_apq5": float(parselmouth.praat.call(point_process, "Get shimmer (apq5)...", 0, 0, 0.0001, 0.02, 1.3, 1.6)),
        }
        
        logger.info(f"Jitter/Shimmer analysis completed: jitter={jitter_shimmer_stats['jitter_local']:.3f}, shimmer={jitter_shimmer_stats['shimmer_local']:.3f}")
        return jitter_shimmer_stats
        
    except Exception as e:
        logger.error(f"Jitter/Shimmer analysis failed: {e}")
        return {
            "jitter_local": 0.0,
            "shimmer_local": 0.0,
            "jitter_rap": 0.0,
            "jitter_ppq5": 0.0,
            "shimmer_apq3": 0.0,
            "shimmer_apq5": 0.0,
        }

def analyze_pauses(audio_path: str, transcript_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analyze pauses in speech"""
    try:
        # Load audio with librosa
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
        
        # Calculate RMS energy
        frame_length = int(FRAME_LENGTH * sr)
        hop_length = int(HOP_LENGTH * sr)
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
        
        # Define pause threshold (adjust based on your needs)
        pause_threshold = np.percentile(rms, 20)
        
        # Find pause segments
        pause_mask = rms < pause_threshold
        pause_segments = []
        
        # Group consecutive pause frames
        in_pause = False
        pause_start = 0
        
        for i, is_pause in enumerate(pause_mask):
            if is_pause and not in_pause:
                pause_start = times[i]
                in_pause = True
            elif not is_pause and in_pause:
                pause_duration = times[i] - pause_start
                if pause_duration > 0.1:  # Minimum pause duration (100ms)
                    pause_segments.append({
                        "start": float(pause_start),
                        "end": float(times[i]),
                        "duration": float(pause_duration)
                    })
                in_pause = False
        
        # Handle case where audio ends with a pause
        if in_pause:
            pause_duration = times[-1] - pause_start
            if pause_duration > 0.1:
                pause_segments.append({
                    "start": float(pause_start),
                    "end": float(times[-1]),
                    "duration": float(pause_duration)
                })
        
        pause_stats = {
            "count": len(pause_segments),
            "total_duration": sum(p["duration"] for p in pause_segments),
            "average_duration": np.mean([p["duration"] for p in pause_segments]) if pause_segments else 0.0,
            "segments": pause_segments
        }
        
        logger.info(f"Pause analysis completed: {pause_stats['count']} pauses, total duration={pause_stats['total_duration']:.2f}s")
        return pause_stats
        
    except Exception as e:
        logger.error(f"Pause analysis failed: {e}")
        raise

def calculate_wpm(transcript_data: Dict[str, Any], audio_duration: float) -> Dict[str, Any]:
    """Calculate Words Per Minute (WPM)"""
    try:
        if not transcript_data or "text" not in transcript_data:
            return {"current": 0, "average": 0, "timeline": []}
        
        text = transcript_data["text"]
        words = text.split()
        word_count = len(words)
        
        # Calculate WPM
        wpm = (word_count / audio_duration) * 60 if audio_duration > 0 else 0
        
        # Create timeline (simplified - could be more sophisticated)
        timeline = [
            {"timestamp": 0.0, "value": wpm},
            {"timestamp": audio_duration / 2, "value": wpm},
            {"timestamp": audio_duration, "value": wpm}
        ]
        
        wpm_stats = {
            "current": float(wpm),
            "average": float(wpm),
            "timeline": timeline
        }
        
        logger.info(f"WPM calculation completed: {wpm:.1f} WPM")
        return wpm_stats
        
    except Exception as e:
        logger.error(f"WPM calculation failed: {e}")
        return {"current": 0, "average": 0, "timeline": []}

async def analyze_prosody(audio_path: str, transcript_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Perform comprehensive prosody analysis"""
    try:
        # Load audio to get duration
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
        audio_duration = len(y) / sr
        
        # Perform all analyses
        f0_stats = analyze_f0(audio_path)
        rms_stats = analyze_rms(audio_path)
        jitter_shimmer_stats = analyze_jitter_shimmer(audio_path)
        pause_stats = analyze_pauses(audio_path, transcript_data)
        wpm_stats = calculate_wpm(transcript_data, audio_duration)
        
        # Combine all results
        prosody_data = {
            "f0": f0_stats,
            "rms": rms_stats,
            "jitter_shimmer": jitter_shimmer_stats,
            "pauses": pause_stats,
            "wpm": wpm_stats,
            "audio_duration": audio_duration,
            "analysis_timestamp": asyncio.get_event_loop().time()
        }
        
        logger.info("Prosody analysis completed successfully")
        return prosody_data
        
    except Exception as e:
        logger.error(f"Prosody analysis failed: {e}")
        raise

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish prosody analysis result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "prosody_completed",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("prosody.done", json.dumps(message).encode())
        logger.info(f"Published prosody result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish prosody result: {e}")

async def process_prosody_task(request: ProsodyAnalysisRequest):
    """Background task to process prosody analysis"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"prosody_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "message": "Downloading audio..."
        }))
        
        # Download audio
        audio_path = await download_audio(request.audio_url)
        
        try:
            # Update status
            await redis_client.set(f"prosody_task:{task_id}", json.dumps({
                "status": "processing",
                "session_id": request.session_id,
                "message": "Analyzing prosody features..."
            }))
            
            # Perform prosody analysis
            result = await analyze_prosody(audio_path, request.transcript_data)
            
            # Store result in Redis
            await redis_client.set(f"prosody:{request.session_id}", json.dumps(result))
            
            # Update task status
            await redis_client.set(f"prosody_task:{task_id}", json.dumps({
                "status": "completed",
                "session_id": request.session_id,
                "message": "Prosody analysis completed",
                "result": result
            }))
            
            # Publish result to NATS
            await publish_result(request.session_id, result)
            
            logger.info(f"Prosody task completed for session: {request.session_id}")
            
        finally:
            # Clean up temporary file
            if os.path.exists(audio_path):
                os.unlink(audio_path)
                
    except Exception as e:
        logger.error(f"Prosody task failed for session {request.session_id}: {e}")
        
        # Update task status
        await redis_client.set(f"prosody_task:{task_id}", json.dumps({
            "status": "failed",
            "session_id": request.session_id,
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

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    if redis_client:
        await redis_client.close()
    if nats_client:
        await nats_client.close()

@app.post("/process", response_model=ProsodyAnalysisResponse)
async def process_prosody(request: ProsodyAnalysisRequest, background_tasks: BackgroundTasks):
    """Process prosody analysis request"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_prosody_task, request)
        
        return ProsodyAnalysisResponse(
            session_id=request.session_id,
            task_id=task_id,
            status="accepted",
            message="Prosody analysis started"
        )
        
    except Exception as e:
        logger.error(f"Failed to start prosody analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of prosody processing task"""
    try:
        task_data = await redis_client.get(f"prosody_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prosody/{session_id}")
async def get_prosody(session_id: str):
    """Get prosody analysis result for session"""
    try:
        prosody_data = await redis_client.get(f"prosody:{session_id}")
        if prosody_data:
            return json.loads(prosody_data)
        else:
            raise HTTPException(status_code=404, detail="Prosody analysis not found")
    except Exception as e:
        logger.error(f"Failed to get prosody analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "redis_connected": redis_client is not None,
        "nats_connected": nats_client is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
