#!/usr/bin/env python3
"""
Scoring Worker - Speech Performance Scoring
Combines ASR, prosody, and fluency data to generate comprehensive speech scores.
"""

import asyncio
import json
import logging
import os
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
app = FastAPI(title="Scoring Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None

# Default scoring rubric weights
DEFAULT_RUBRIC_WEIGHTS = {
    "clarity": 0.25,
    "pace": 0.20,
    "volume": 0.15,
    "engagement": 0.20,
    "structure": 0.20
}

class ScoringRequest(BaseModel):
    session_id: str
    rubric_weights: Optional[Dict[str, float]] = None
    include_uncertainty: bool = True

class ScoringResponse(BaseModel):
    session_id: str
    task_id: str
    status: str
    message: str

def calculate_clarity_score(transcript_data: Dict[str, Any], prosody_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate clarity score based on pronunciation and articulation"""
    try:
        # Base score from transcript confidence
        confidence = transcript_data.get("confidence", 0.5)
        base_score = confidence * 10
        
        # Adjust based on filler words
        filler_rate = prosody_data.get("filler_words", {}).get("filler_word_rate", 0)
        filler_penalty = min(2.0, filler_rate * 20)
        
        # Adjust based on speech patterns
        speech_patterns = prosody_data.get("speech_patterns", {})
        repetition_penalty = min(1.0, speech_patterns.get("repetitions", 0) * 0.5)
        
        clarity_score = max(0, min(10, base_score - filler_penalty - repetition_penalty))
        
        return {
            "score": clarity_score,
            "weight": DEFAULT_RUBRIC_WEIGHTS["clarity"],
            "feedback": generate_clarity_feedback(clarity_score, filler_rate, speech_patterns),
            "confidence": confidence,
            "factors": {
                "transcript_confidence": confidence,
                "filler_word_rate": filler_rate,
                "repetitions": speech_patterns.get("repetitions", 0)
            }
        }
    except Exception as e:
        logger.error(f"Clarity score calculation failed: {e}")
        return {"score": 5.0, "weight": DEFAULT_RUBRIC_WEIGHTS["clarity"], "feedback": "Unable to assess clarity"}

def calculate_pace_score(prosody_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate pace score based on WPM and pause analysis"""
    try:
        wpm_data = prosody_data.get("wpm", {})
        pause_data = prosody_data.get("pauses", {})
        
        current_wpm = wpm_data.get("current", 120)
        average_wpm = wpm_data.get("average", 120)
        
        # Ideal WPM range: 120-150
        if 120 <= current_wpm <= 150:
            pace_score = 9.0
        elif 100 <= current_wpm < 120:
            pace_score = 7.0
        elif 150 < current_wpm <= 180:
            pace_score = 6.0
        elif current_wpm < 100:
            pace_score = 4.0
        else:
            pace_score = 3.0
        
        # Adjust for pause usage
        pause_count = pause_data.get("count", 0)
        pause_duration = pause_data.get("total_duration", 0)
        
        # Bonus for strategic pauses
        if 0.5 <= pause_duration <= 2.0:
            pace_score += 0.5
        elif pause_duration > 4.0:
            pace_score -= 1.0
        
        pace_score = max(0, min(10, pace_score))
        
        return {
            "score": pace_score,
            "weight": DEFAULT_RUBRIC_WEIGHTS["pace"],
            "feedback": generate_pace_feedback(pace_score, current_wpm, pause_data),
            "wpm": current_wpm,
            "factors": {
                "words_per_minute": current_wpm,
                "pause_count": pause_count,
                "pause_duration": pause_duration
            }
        }
    except Exception as e:
        logger.error(f"Pace score calculation failed: {e}")
        return {"score": 5.0, "weight": DEFAULT_RUBRIC_WEIGHTS["pace"], "feedback": "Unable to assess pace"}

def calculate_volume_score(prosody_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate volume score based on RMS energy analysis"""
    try:
        rms_data = prosody_data.get("rms", {})
        
        mean_rms = rms_data.get("mean", -20)
        std_rms = rms_data.get("std", 2.0)
        
        # Ideal RMS range: -18 to -12 dB
        if -18 <= mean_rms <= -12:
            volume_score = 9.0
        elif -20 <= mean_rms < -18:
            volume_score = 7.0
        elif -12 < mean_rms <= -10:
            volume_score = 6.0
        elif mean_rms < -20:
            volume_score = 4.0
        else:
            volume_score = 3.0
        
        # Penalty for high variability
        if std_rms > 3.0:
            volume_score -= 1.0
        
        volume_score = max(0, min(10, volume_score))
        
        return {
            "score": volume_score,
            "weight": DEFAULT_RUBRIC_WEIGHTS["volume"],
            "feedback": generate_volume_feedback(volume_score, mean_rms, std_rms),
            "mean_rms": mean_rms,
            "factors": {
                "mean_volume": mean_rms,
                "volume_variability": std_rms
            }
        }
    except Exception as e:
        logger.error(f"Volume score calculation failed: {e}")
        return {"score": 5.0, "weight": DEFAULT_RUBRIC_WEIGHTS["volume"], "feedback": "Unable to assess volume"}

def calculate_engagement_score(prosody_data: Dict[str, Any], fluency_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate engagement score based on prosody and fluency"""
    try:
        # F0 variation indicates engagement
        f0_data = prosody_data.get("f0", {})
        f0_std = f0_data.get("std", 0)
        
        # Vocabulary diversity
        vocab_data = fluency_data.get("vocabulary_diversity", {})
        ttr = vocab_data.get("type_token_ratio", 0.5)
        
        # Base score from F0 variation
        if f0_std > 20:
            engagement_score = 8.0
        elif f0_std > 15:
            engagement_score = 7.0
        elif f0_std > 10:
            engagement_score = 6.0
        else:
            engagement_score = 4.0
        
        # Bonus for vocabulary diversity
        if ttr > 0.7:
            engagement_score += 1.0
        elif ttr < 0.4:
            engagement_score -= 1.0
        
        engagement_score = max(0, min(10, engagement_score))
        
        return {
            "score": engagement_score,
            "weight": DEFAULT_RUBRIC_WEIGHTS["engagement"],
            "feedback": generate_engagement_feedback(engagement_score, f0_std, ttr),
            "f0_variation": f0_std,
            "factors": {
                "pitch_variation": f0_std,
                "vocabulary_diversity": ttr
            }
        }
    except Exception as e:
        logger.error(f"Engagement score calculation failed: {e}")
        return {"score": 5.0, "weight": DEFAULT_RUBRIC_WEIGHTS["engagement"], "feedback": "Unable to assess engagement"}

def calculate_structure_score(fluency_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate structure score based on sentence complexity and grammar"""
    try:
        # Grammar errors
        grammar_data = fluency_data.get("grammar_errors", {})
        error_rate = grammar_data.get("error_rate", 0)
        
        # Sentence complexity
        complexity_data = fluency_data.get("sentence_complexity", {})
        avg_length = complexity_data.get("average_length", 10)
        complexity_ratio = complexity_data.get("complexity_ratio", 0.3)
        
        # Base score from grammar
        if error_rate < 0.02:
            structure_score = 8.0
        elif error_rate < 0.05:
            structure_score = 6.0
        elif error_rate < 0.1:
            structure_score = 4.0
        else:
            structure_score = 2.0
        
        # Bonus for sentence variety
        if 0.3 <= complexity_ratio <= 0.7:
            structure_score += 1.0
        
        # Bonus for appropriate sentence length
        if 8 <= avg_length <= 20:
            structure_score += 0.5
        
        structure_score = max(0, min(10, structure_score))
        
        return {
            "score": structure_score,
            "weight": DEFAULT_RUBRIC_WEIGHTS["structure"],
            "feedback": generate_structure_feedback(structure_score, error_rate, complexity_data),
            "error_rate": error_rate,
            "factors": {
                "grammar_error_rate": error_rate,
                "sentence_complexity": complexity_ratio,
                "average_sentence_length": avg_length
            }
        }
    except Exception as e:
        logger.error(f"Structure score calculation failed: {e}")
        return {"score": 5.0, "weight": DEFAULT_RUBRIC_WEIGHTS["structure"], "feedback": "Unable to assess structure"}

def generate_clarity_feedback(score: float, filler_rate: float, patterns: Dict[str, Any]) -> str:
    """Generate feedback for clarity score"""
    if score >= 8.0:
        return "Excellent articulation and clear pronunciation"
    elif score >= 6.0:
        return "Good clarity with minor areas for improvement"
    elif score >= 4.0:
        return "Some pronunciation issues; consider slowing down"
    else:
        return "Significant clarity issues; focus on articulation and reducing filler words"

def generate_pace_feedback(score: float, wpm: float, pause_data: Dict[str, Any]) -> str:
    """Generate feedback for pace score"""
    if score >= 8.0:
        return "Excellent pacing with good use of pauses"
    elif score >= 6.0:
        return "Good pace; consider adding more strategic pauses"
    elif score >= 4.0:
        if wpm > 150:
            return "Speaking too fast; slow down and add pauses"
        else:
            return "Speaking too slowly; increase pace slightly"
    else:
        return "Pace needs significant improvement; practice with metronome"

def generate_volume_feedback(score: float, mean_rms: float, std_rms: float) -> str:
    """Generate feedback for volume score"""
    if score >= 8.0:
        return "Excellent volume control and consistency"
    elif score >= 6.0:
        return "Good volume; minor variations noted"
    elif score >= 4.0:
        if mean_rms < -20:
            return "Volume too low; speak louder"
        else:
            return "Volume too high; moderate your voice"
    else:
        return "Volume control needs improvement; practice projection"

def generate_engagement_feedback(score: float, f0_std: float, ttr: float) -> str:
    """Generate feedback for engagement score"""
    if score >= 8.0:
        return "Excellent vocal variety and engaging delivery"
    elif score >= 6.0:
        return "Good engagement; add more vocal variety"
    elif score >= 4.0:
        return "Limited vocal variety; practice pitch changes"
    else:
        return "Needs more vocal engagement; work on pitch variation"

def generate_structure_feedback(score: float, error_rate: float, complexity_data: Dict[str, Any]) -> str:
    """Generate feedback for structure score"""
    if score >= 8.0:
        return "Excellent sentence structure and grammar"
    elif score >= 6.0:
        return "Good structure with minor grammar issues"
    elif score >= 4.0:
        return "Some structural issues; review grammar and organization"
    else:
        return "Significant structural problems; focus on grammar and sentence variety"

def calculate_uncertainty_bands(scores: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate uncertainty bands for scores"""
    try:
        uncertainties = {}
        for category, score_data in scores.items():
            score = score_data["score"]
            
            # Base uncertainty based on score confidence
            base_uncertainty = 0.5
            
            # Additional uncertainty for extreme scores
            if score < 3 or score > 8:
                base_uncertainty += 0.3
            
            # Uncertainty based on factors
            factors = score_data.get("factors", {})
            if "transcript_confidence" in factors:
                confidence = factors["transcript_confidence"]
                base_uncertainty += (1.0 - confidence) * 0.5
            
            uncertainty = min(1.5, base_uncertainty)
            
            uncertainties[category] = {
                "lower": max(0, score - uncertainty),
                "upper": min(10, score + uncertainty),
                "uncertainty": uncertainty
            }
        
        return uncertainties
    except Exception as e:
        logger.error(f"Uncertainty calculation failed: {e}")
        return {}

def calculate_overall_score(scores: Dict[str, Dict[str, Any]], weights: Dict[str, float]) -> float:
    """Calculate weighted overall score"""
    try:
        total_score = 0.0
        total_weight = 0.0
        
        for category, score_data in scores.items():
            weight = weights.get(category, score_data.get("weight", 0))
            score = score_data.get("score", 0)
            
            total_score += score * weight
            total_weight += weight
        
        return total_score / total_weight if total_weight > 0 else 0.0
    except Exception as e:
        logger.error(f"Overall score calculation failed: {e}")
        return 0.0

async def analyze_speech_performance(session_id: str, weights: Optional[Dict[str, float]] = None, 
                                   include_uncertainty: bool = True) -> Dict[str, Any]:
    """Perform comprehensive speech performance analysis"""
    try:
        # Get data from Redis
        transcript_data = await redis_client.get(f"transcript:{session_id}")
        prosody_data = await redis_client.get(f"prosody:{session_id}")
        fluency_data = await redis_client.get(f"fluency:{session_id}")
        
        if not transcript_data or not prosody_data or not fluency_data:
            raise ValueError("Missing required analysis data")
        
        transcript = json.loads(transcript_data)
        prosody = json.loads(prosody_data)
        fluency = json.loads(fluency_data)
        
        # Use default weights if not provided
        rubric_weights = weights or DEFAULT_RUBRIC_WEIGHTS
        
        # Calculate individual scores
        scores = {
            "clarity": calculate_clarity_score(transcript, prosody),
            "pace": calculate_pace_score(prosody),
            "volume": calculate_volume_score(prosody),
            "engagement": calculate_engagement_score(prosody, fluency),
            "structure": calculate_structure_score(fluency)
        }
        
        # Calculate overall score
        overall_score = calculate_overall_score(scores, rubric_weights)
        
        # Calculate uncertainty bands if requested
        uncertainty_bands = {}
        if include_uncertainty:
            uncertainty_bands = calculate_uncertainty_bands(scores)
        
        # Generate improvement areas and strengths
        improvement_areas = []
        strengths = []
        
        for category, score_data in scores.items():
            score = score_data["score"]
            if score < 6.0:
                improvement_areas.append({
                    "category": category,
                    "suggestion": score_data["feedback"]
                })
            elif score >= 8.0:
                strengths.append({
                    "category": category,
                    "detail": score_data["feedback"]
                })
        
        # Prepare final result
        scoring_result = {
            "overall_score": overall_score,
            "confidence": transcript.get("confidence", 0.5),
            "rubric_scores": scores,
            "uncertainty_bands": uncertainty_bands,
            "improvement_areas": improvement_areas,
            "strengths": strengths,
            "rubric_weights": rubric_weights,
            "analysis_timestamp": asyncio.get_event_loop().time()
        }
        
        logger.info(f"Scoring analysis completed: overall_score={overall_score:.1f}")
        return scoring_result
        
    except Exception as e:
        logger.error(f"Speech performance analysis failed: {e}")
        raise

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish scoring result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "scoring_completed",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("scoring.done", json.dumps(message).encode())
        logger.info(f"Published scoring result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish scoring result: {e}")

async def process_scoring_task(request: ScoringRequest):
    """Background task to process scoring analysis"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"scoring_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "message": "Analyzing speech performance..."
        }))
        
        # Perform scoring analysis
        result = await analyze_speech_performance(
            request.session_id, 
            request.rubric_weights, 
            request.include_uncertainty
        )
        
        # Store result in Redis
        await redis_client.set(f"scoring:{request.session_id}", json.dumps(result))
        
        # Update task status
        await redis_client.set(f"scoring_task:{task_id}", json.dumps({
            "status": "completed",
            "session_id": request.session_id,
            "message": "Scoring analysis completed",
            "result": result
        }))
        
        # Publish result to NATS
        await publish_result(request.session_id, result)
        
        logger.info(f"Scoring task completed for session: {request.session_id}")
        
    except Exception as e:
        logger.error(f"Scoring task failed for session {request.session_id}: {e}")
        
        # Update task status
        await redis_client.set(f"scoring_task:{task_id}", json.dumps({
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

@app.post("/process", response_model=ScoringResponse)
async def process_scoring(request: ScoringRequest, background_tasks: BackgroundTasks):
    """Process scoring analysis request"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_scoring_task, request)
        
        return ScoringResponse(
            session_id=request.session_id,
            task_id=task_id,
            status="accepted",
            message="Scoring analysis started"
        )
        
    except Exception as e:
        logger.error(f"Failed to start scoring analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of scoring processing task"""
    try:
        task_data = await redis_client.get(f"scoring_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scoring/{session_id}")
async def get_scoring(session_id: str):
    """Get scoring analysis result for session"""
    try:
        scoring_data = await redis_client.get(f"scoring:{session_id}")
        if scoring_data:
            return json.loads(scoring_data)
        else:
            raise HTTPException(status_code=404, detail="Scoring analysis not found")
    except Exception as e:
        logger.error(f"Failed to get scoring analysis: {e}")
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
    uvicorn.run(app, host="0.0.0.0", port=8004)
