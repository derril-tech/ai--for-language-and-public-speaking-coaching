#!/usr/bin/env python3
"""
Drill Worker - Speech Practice Exercise Generation
Generates minimal pairs, pacing exercises, and shadowing drills for speech improvement.
"""

import asyncio
import json
import logging
import os
import random
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
app = FastAPI(title="Drill Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None

# Minimal pairs data
MINIMAL_PAIRS = {
    "p_b": [
        ("pat", "bat"), ("pin", "bin"), ("pack", "back"), ("pie", "buy"),
        ("park", "bark"), ("pale", "bale"), ("pest", "best"), ("pump", "bump")
    ],
    "t_d": [
        ("time", "dime"), ("town", "down"), ("team", "deem"), ("tie", "die"),
        ("tall", "doll"), ("tank", "dank"), ("tide", "died"), ("tone", "done")
    ],
    "k_g": [
        ("cap", "gap"), ("cold", "gold"), ("coat", "goat"), ("cane", "gain"),
        ("call", "gall"), ("cave", "gave"), ("came", "game"), ("cow", "go")
    ],
    "f_v": [
        ("fan", "van"), ("fine", "vine"), ("fat", "vat"), ("feel", "veal"),
        ("fear", "veer"), ("fool", "vool"), ("fade", "vade"), ("fame", "vame")
    ],
    "s_z": [
        ("sip", "zip"), ("sue", "zoo"), ("sink", "zinc"), ("sip", "zip"),
        ("sow", "zoe"), ("sip", "zip"), ("sip", "zip"), ("sip", "zip")
    ],
    "sh_ch": [
        ("ship", "chip"), ("sheep", "cheap"), ("shoe", "chew"), ("shop", "chop"),
        ("share", "chair"), ("shirt", "chirp"), ("shut", "chut"), ("shy", "chai")
    ],
    "l_r": [
        ("light", "right"), ("low", "row"), ("lead", "read"), ("lake", "rake"),
        ("lip", "rip"), ("lock", "rock"), ("lamp", "ramp"), ("lent", "rent")
    ],
    "w_r": [
        ("wet", "red"), ("wine", "rhine"), ("wade", "raid"), ("wail", "rail"),
        ("wake", "rake"), ("wane", "rain"), ("waste", "raced"), ("wax", "racks")
    ]
}

# Pacing exercise texts
PACING_TEXTS = [
    "The quick brown fox jumps over the lazy dog. Practice speaking each word clearly and deliberately.",
    "Public speaking is a skill that improves with practice. Focus on your breathing and pace.",
    "Confidence comes from preparation and practice. Take your time and enunciate clearly.",
    "Effective communication requires clear articulation and appropriate pacing.",
    "Practice makes perfect. Slow down and focus on each syllable.",
    "The art of public speaking involves both content and delivery.",
    "Your voice is your instrument. Learn to control it with precision.",
    "Great speakers are made, not born. Dedication and practice lead to improvement."
]

# Shadowing exercise texts
SHADOWING_TEXTS = [
    "Welcome to our presentation on effective communication techniques.",
    "Today we will explore the fundamentals of public speaking.",
    "The key to success is preparation and confident delivery.",
    "Let me share with you some valuable insights on presentation skills.",
    "Thank you for joining us for this important discussion.",
    "I appreciate the opportunity to speak with you today.",
    "Our goal is to help you become a more effective communicator.",
    "Remember that practice and feedback are essential for improvement."
]

class DrillRequest(BaseModel):
    session_id: str
    drill_types: List[str] = ["minimal_pairs", "pacing", "shadowing"]
    difficulty: str = "intermediate"
    target_duration: int = 300  # seconds

class DrillResponse(BaseModel):
    session_id: str
    task_id: str
    status: str
    message: str

def generate_minimal_pairs_drill(difficulty: str = "intermediate") -> Dict[str, Any]:
    """Generate minimal pairs drill"""
    try:
        # Select difficulty-appropriate pairs
        if difficulty == "beginner":
            selected_pairs = ["p_b", "t_d", "k_g"]
        elif difficulty == "intermediate":
            selected_pairs = ["p_b", "t_d", "k_g", "f_v", "s_z"]
        else:  # advanced
            selected_pairs = list(MINIMAL_PAIRS.keys())
        
        # Select random pairs
        pair_type = random.choice(selected_pairs)
        pairs = MINIMAL_PAIRS[pair_type]
        selected_pairs_list = random.sample(pairs, min(4, len(pairs)))
        
        drill = {
            "id": f"minimal_pairs_{uuid.uuid4().hex[:8]}",
            "type": "minimal_pairs",
            "title": f"{pair_type.upper()} Minimal Pairs",
            "description": f"Practice distinguishing between /{pair_type.split('_')[0]}/ and /{pair_type.split('_')[1]}/ sounds",
            "pairs": [
                {
                    "word1": pair[0],
                    "word2": pair[1],
                    "audio_url1": f"/audio/minimal_pairs/{pair[0]}.mp3",
                    "audio_url2": f"/audio/minimal_pairs/{pair[1]}.mp3"
                }
                for pair in selected_pairs_list
            ],
            "difficulty": difficulty,
            "estimated_duration": 180,
            "instructions": "Listen to each pair and practice saying both words clearly. Focus on the sound difference."
        }
        
        return drill
    except Exception as e:
        logger.error(f"Minimal pairs drill generation failed: {e}")
        return {}

def generate_pacing_drill(difficulty: str = "intermediate") -> Dict[str, Any]:
    """Generate pacing drill"""
    try:
        # Select text based on difficulty
        if difficulty == "beginner":
            text = PACING_TEXTS[0]
            target_wpm = 100
            metronome_bpm = 60
        elif difficulty == "intermediate":
            text = random.choice(PACING_TEXTS[1:4])
            target_wpm = 120
            metronome_bpm = 80
        else:  # advanced
            text = random.choice(PACING_TEXTS[4:])
            target_wpm = 140
            metronome_bpm = 100
        
        drill = {
            "id": f"pacing_{uuid.uuid4().hex[:8]}",
            "type": "pacing",
            "title": "Pacing Practice",
            "description": f"Practice speaking at {target_wpm} words per minute with metronome guidance",
            "text": text,
            "target_wpm": target_wpm,
            "metronome_bpm": metronome_bpm,
            "difficulty": difficulty,
            "estimated_duration": 240,
            "instructions": f"Read the text aloud while following the {metronome_bpm} BPM metronome. Aim for {target_wpm} words per minute."
        }
        
        return drill
    except Exception as e:
        logger.error(f"Pacing drill generation failed: {e}")
        return {}

def generate_shadowing_drill(difficulty: str = "intermediate") -> Dict[str, Any]:
    """Generate shadowing drill"""
    try:
        # Select text based on difficulty
        if difficulty == "beginner":
            text = SHADOWING_TEXTS[0]
            delay = 1.0
        elif difficulty == "intermediate":
            text = random.choice(SHADOWING_TEXTS[1:4])
            delay = 0.5
        else:  # advanced
            text = random.choice(SHADOWING_TEXTS[4:])
            delay = 0.2
        
        drill = {
            "id": f"shadowing_{uuid.uuid4().hex[:8]}",
            "type": "shadowing",
            "title": "Shadowing Exercise",
            "description": f"Repeat after the audio with {delay}s delay",
            "text": text,
            "audio_url": f"/audio/shadowing/{uuid.uuid4().hex[:8]}.mp3",
            "delay_seconds": delay,
            "difficulty": difficulty,
            "estimated_duration": 180,
            "instructions": f"Listen to the audio and repeat the text with a {delay}-second delay. Focus on matching pronunciation and intonation."
        }
        
        return drill
    except Exception as e:
        logger.error(f"Shadowing drill generation failed: {e}")
        return {}

def generate_articulation_drill(difficulty: str = "intermediate") -> Dict[str, Any]:
    """Generate articulation drill"""
    try:
        # Tongue twisters based on difficulty
        tongue_twisters = {
            "beginner": [
                "Peter Piper picked a peck of pickled peppers.",
                "She sells seashells by the seashore.",
                "How much wood would a woodchuck chuck?"
            ],
            "intermediate": [
                "The sixth sick sheik's sixth sheep's sick.",
                "A proper copper coffee pot.",
                "Red lorry, yellow lorry, red lorry, yellow lorry."
            ],
            "advanced": [
                "The thirty-three thieves thought that they thrilled the throne throughout Thursday.",
                "Betty Botter bought some butter but she said the butter's bitter.",
                "Fuzzy Wuzzy was a bear. Fuzzy Wuzzy had no hair."
            ]
        }
        
        selected_twisters = tongue_twisters.get(difficulty, tongue_twisters["intermediate"])
        text = random.choice(selected_twisters)
        
        drill = {
            "id": f"articulation_{uuid.uuid4().hex[:8]}",
            "type": "articulation",
            "title": "Articulation Practice",
            "description": "Practice clear articulation with tongue twisters",
            "text": text,
            "difficulty": difficulty,
            "estimated_duration": 120,
            "instructions": "Say the tongue twister slowly at first, then gradually increase speed while maintaining clarity."
        }
        
        return drill
    except Exception as e:
        logger.error(f"Articulation drill generation failed: {e}")
        return {}

def generate_breathing_drill(difficulty: str = "intermediate") -> Dict[str, Any]:
    """Generate breathing exercise"""
    try:
        breathing_patterns = {
            "beginner": {
                "inhale": 4,
                "hold": 4,
                "exhale": 6,
                "cycles": 5
            },
            "intermediate": {
                "inhale": 4,
                "hold": 7,
                "exhale": 8,
                "cycles": 7
            },
            "advanced": {
                "inhale": 4,
                "hold": 7,
                "exhale": 8,
                "hold_empty": 4,
                "cycles": 10
            }
        }
        
        pattern = breathing_patterns.get(difficulty, breathing_patterns["intermediate"])
        
        drill = {
            "id": f"breathing_{uuid.uuid4().hex[:8]}",
            "type": "breathing",
            "title": "Breathing Exercise",
            "description": "Practice diaphragmatic breathing for better voice control",
            "pattern": pattern,
            "difficulty": difficulty,
            "estimated_duration": 180,
            "instructions": f"Follow the breathing pattern: Inhale for {pattern['inhale']}s, hold for {pattern['hold']}s, exhale for {pattern['exhale']}s. Repeat {pattern['cycles']} times."
        }
        
        return drill
    except Exception as e:
        logger.error(f"Breathing drill generation failed: {e}")
        return {}

def analyze_drill_needs(scoring_data: Dict[str, Any], fluency_data: Dict[str, Any]) -> List[str]:
    """Analyze speech data to determine which drills would be most beneficial"""
    try:
        recommended_drills = []
        
        # Check clarity issues
        clarity_score = scoring_data.get("rubric_scores", {}).get("clarity", {}).get("score", 5)
        if clarity_score < 6:
            recommended_drills.append("minimal_pairs")
            recommended_drills.append("articulation")
        
        # Check pace issues
        pace_score = scoring_data.get("rubric_scores", {}).get("pace", {}).get("score", 5)
        if pace_score < 6:
            recommended_drills.append("pacing")
        
        # Check volume issues
        volume_score = scoring_data.get("rubric_scores", {}).get("volume", {}).get("score", 5)
        if volume_score < 6:
            recommended_drills.append("breathing")
        
        # Check fluency issues
        filler_rate = fluency_data.get("filler_words", {}).get("filler_word_rate", 0)
        if filler_rate > 0.05:
            recommended_drills.append("pacing")
        
        # Always include at least one drill
        if not recommended_drills:
            recommended_drills = ["minimal_pairs", "pacing"]
        
        return recommended_drills[:3]  # Limit to 3 drills
        
    except Exception as e:
        logger.error(f"Drill needs analysis failed: {e}")
        return ["minimal_pairs", "pacing"]

async def generate_drills(session_id: str, drill_types: List[str], difficulty: str = "intermediate") -> Dict[str, Any]:
    """Generate comprehensive drill set for speech improvement"""
    try:
        # Get scoring and fluency data for personalized recommendations
        scoring_data = await redis_client.get(f"scoring:{session_id}")
        fluency_data = await redis_client.get(f"fluency:{session_id}")
        
        # Analyze needs if data available
        if scoring_data and fluency_data:
            scoring = json.loads(scoring_data)
            fluency = json.loads(fluency_data)
            recommended_types = analyze_drill_needs(scoring, fluency)
            
            # Combine requested and recommended types
            final_types = list(set(drill_types + recommended_types))[:4]  # Max 4 drills
        else:
            final_types = drill_types[:3]
        
        drills = []
        total_duration = 0
        
        # Generate drills for each type
        for drill_type in final_types:
            if drill_type == "minimal_pairs":
                drill = generate_minimal_pairs_drill(difficulty)
            elif drill_type == "pacing":
                drill = generate_pacing_drill(difficulty)
            elif drill_type == "shadowing":
                drill = generate_shadowing_drill(difficulty)
            elif drill_type == "articulation":
                drill = generate_articulation_drill(difficulty)
            elif drill_type == "breathing":
                drill = generate_breathing_drill(difficulty)
            else:
                continue
            
            if drill:
                drills.append(drill)
                total_duration += drill.get("estimated_duration", 180)
        
        # Generate recommendations
        recommendations = []
        for drill in drills:
            recommendations.append({
                "drill_id": drill["id"],
                "reason": f"Targeted practice for {drill['type']} improvement",
                "priority": "high" if drill["difficulty"] == "beginner" else "medium"
            })
        
        drill_set = {
            "session_id": session_id,
            "drills": drills,
            "recommendations": recommendations,
            "total_duration": total_duration,
            "difficulty": difficulty,
            "generated_at": asyncio.get_event_loop().time()
        }
        
        logger.info(f"Generated {len(drills)} drills for session {session_id}")
        return drill_set
        
    except Exception as e:
        logger.error(f"Drill generation failed: {e}")
        raise

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish drill generation result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "drills_generated",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("drill.done", json.dumps(message).encode())
        logger.info(f"Published drill result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish drill result: {e}")

async def process_drill_task(request: DrillRequest):
    """Background task to process drill generation"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"drill_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "message": "Generating personalized drills..."
        }))
        
        # Generate drills
        result = await generate_drills(
            request.session_id,
            request.drill_types,
            request.difficulty
        )
        
        # Store result in Redis
        await redis_client.set(f"drills:{request.session_id}", json.dumps(result))
        
        # Update task status
        await redis_client.set(f"drill_task:{task_id}", json.dumps({
            "status": "completed",
            "session_id": request.session_id,
            "message": "Drills generated successfully",
            "result": result
        }))
        
        # Publish result to NATS
        await publish_result(request.session_id, result)
        
        logger.info(f"Drill task completed for session: {request.session_id}")
        
    except Exception as e:
        logger.error(f"Drill task failed for session {request.session_id}: {e}")
        
        # Update task status
        await redis_client.set(f"drill_task:{task_id}", json.dumps({
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

@app.post("/generate", response_model=DrillResponse)
async def generate_drills_endpoint(request: DrillRequest, background_tasks: BackgroundTasks):
    """Generate drills endpoint"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_drill_task, request)
        
        return DrillResponse(
            session_id=request.session_id,
            task_id=task_id,
            status="accepted",
            message="Drill generation started"
        )
        
    except Exception as e:
        logger.error(f"Failed to start drill generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of drill generation task"""
    try:
        task_data = await redis_client.get(f"drill_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/drills/{session_id}")
async def get_drills(session_id: str):
    """Get drills for session"""
    try:
        drills_data = await redis_client.get(f"drills:{session_id}")
        if drills_data:
            return json.loads(drills_data)
        else:
            raise HTTPException(status_code=404, detail="Drills not found")
    except Exception as e:
        logger.error(f"Failed to get drills: {e}")
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
    uvicorn.run(app, host="0.0.0.0", port=8005)
