#!/usr/bin/env python3
"""
ASR Worker - Speech Recognition using WhisperX
Handles audio transcription with word-level timestamps and language detection.
"""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
import uuid

import whisperx
import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as redis
from nats.aio.client import Client as NATS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="ASR Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BATCH_SIZE = 16

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None
whisper_model = None

class AudioProcessingRequest(BaseModel):
    session_id: str
    audio_url: str
    language: Optional[str] = None
    vad_enabled: bool = True
    word_timestamps: bool = True

class AudioProcessingResponse(BaseModel):
    session_id: str
    task_id: str
    status: str
    message: str

async def load_whisper_model():
    """Load WhisperX model globally"""
    global whisper_model
    try:
        logger.info(f"Loading WhisperX model: {MODEL_SIZE} on {DEVICE}")
        whisper_model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type="float16" if DEVICE == "cuda" else "float32")
        logger.info("WhisperX model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load WhisperX model: {e}")
        raise

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

async def detect_language(audio_path: str) -> str:
    """Detect language of audio using WhisperX"""
    try:
        # Load audio
        audio = whisperx.load_audio(audio_path)
        
        # Detect language
        result = whisper_model.transcribe(audio, language=None)
        detected_language = result["language"]
        
        logger.info(f"Detected language: {detected_language}")
        return detected_language
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        return "en"  # Default to English

async def transcribe_audio(audio_path: str, language: str, vad_enabled: bool = True, word_timestamps: bool = True) -> Dict[str, Any]:
    """Transcribe audio using WhisperX with optional VAD and word timestamps"""
    try:
        # Load audio
        audio = whisperx.load_audio(audio_path)
        
        # Transcribe with specified language
        result = whisper_model.transcribe(audio, language=language, batch_size=BATCH_SIZE)
        
        # Apply VAD if enabled
        if vad_enabled:
            logger.info("Applying Voice Activity Detection")
            model_a, metadata = whisperx.DiarizationPipeline(use_auth_token=None, device=DEVICE)
            diarize_segments = model_a(audio, min_speakers=1, max_speakers=1)
            result = whisperx.assign_word_speakers(diarize_segments, result)
        
        # Align timestamps if word timestamps requested
        if word_timestamps:
            logger.info("Aligning word-level timestamps")
            model_a, metadata = whisperx.load_align_model(language_code=language, device=DEVICE)
            result = whisperx.align(result["segments"], model_a, metadata, audio, DEVICE, return_char_alignments=False)
        
        # Extract word-level information
        words = []
        if word_timestamps and "segments" in result:
            for segment in result["segments"]:
                if "words" in segment:
                    for word_info in segment["words"]:
                        words.append({
                            "word": word_info["word"],
                            "start": word_info["start"],
                            "end": word_info["end"],
                            "confidence": word_info.get("score", 0.0)
                        })
        
        # Prepare response
        transcript_data = {
            "text": result["text"],
            "language": language,
            "duration": len(audio) / 16000,  # Assuming 16kHz sample rate
            "confidence": result.get("confidence", 0.0),
            "words": words,
            "segments": result.get("segments", []),
            "filler_words": extract_filler_words(words),
        }
        
        logger.info(f"Transcription completed: {len(transcript_data['text'])} characters")
        return transcript_data
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise

def extract_filler_words(words: list) -> list:
    """Extract common filler words from transcript"""
    filler_words = ["um", "uh", "ah", "er", "like", "you know", "sort of", "kind of"]
    found_fillers = []
    
    for word_info in words:
        word = word_info["word"].lower().strip()
        if word in filler_words:
            found_fillers.append(word)
    
    return found_fillers

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish transcription result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "asr_completed",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("asr.done", json.dumps(message).encode())
        logger.info(f"Published ASR result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish ASR result: {e}")

async def process_audio_task(request: AudioProcessingRequest):
    """Background task to process audio transcription"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"asr_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "message": "Downloading audio..."
        }))
        
        # Download audio
        audio_path = await download_audio(request.audio_url)
        
        try:
            # Update status
            await redis_client.set(f"asr_task:{task_id}", json.dumps({
                "status": "processing",
                "session_id": request.session_id,
                "message": "Detecting language..."
            }))
            
            # Detect language if not provided
            language = request.language
            if not language:
                language = await detect_language(audio_path)
            
            # Update status
            await redis_client.set(f"asr_task:{task_id}", json.dumps({
                "status": "processing",
                "session_id": request.session_id,
                "message": "Transcribing audio..."
            }))
            
            # Transcribe audio
            result = await transcribe_audio(
                audio_path, 
                language, 
                request.vad_enabled, 
                request.word_timestamps
            )
            
            # Store result in Redis
            await redis_client.set(f"transcript:{request.session_id}", json.dumps(result))
            
            # Update task status
            await redis_client.set(f"asr_task:{task_id}", json.dumps({
                "status": "completed",
                "session_id": request.session_id,
                "message": "Transcription completed",
                "result": result
            }))
            
            # Publish result to NATS
            await publish_result(request.session_id, result)
            
            logger.info(f"ASR task completed for session: {request.session_id}")
            
        finally:
            # Clean up temporary file
            if os.path.exists(audio_path):
                os.unlink(audio_path)
                
    except Exception as e:
        logger.error(f"ASR task failed for session {request.session_id}: {e}")
        
        # Update task status
        await redis_client.set(f"asr_task:{task_id}", json.dumps({
            "status": "failed",
            "session_id": request.session_id,
            "message": str(e)
        }))

@app.on_event("startup")
async def startup_event():
    """Initialize connections and load model on startup"""
    global redis_client, nats_client
    
    # Connect to Redis
    redis_client = redis.from_url(REDIS_URL)
    await redis_client.ping()
    logger.info("Connected to Redis")
    
    # Connect to NATS
    nats_client = NATS()
    await nats_client.connect(NATS_URL)
    logger.info("Connected to NATS")
    
    # Load WhisperX model
    await load_whisper_model()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    if redis_client:
        await redis_client.close()
    if nats_client:
        await nats_client.close()

@app.post("/process", response_model=AudioProcessingResponse)
async def process_audio(request: AudioProcessingRequest, background_tasks: BackgroundTasks):
    """Process audio transcription request"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_audio_task, request)
        
        return AudioProcessingResponse(
            session_id=request.session_id,
            task_id=task_id,
            status="accepted",
            message="Audio processing started"
        )
        
    except Exception as e:
        logger.error(f"Failed to start audio processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of ASR processing task"""
    try:
        task_data = await redis_client.get(f"asr_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/transcript/{session_id}")
async def get_transcript(session_id: str):
    """Get transcription result for session"""
    try:
        transcript_data = await redis_client.get(f"transcript:{session_id}")
        if transcript_data:
            return json.loads(transcript_data)
        else:
            raise HTTPException(status_code=404, detail="Transcript not found")
    except Exception as e:
        logger.error(f"Failed to get transcript: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": whisper_model is not None,
        "device": DEVICE,
        "redis_connected": redis_client is not None,
        "nats_connected": nats_client is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
