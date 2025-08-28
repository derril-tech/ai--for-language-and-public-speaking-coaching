#!/usr/bin/env python3
"""
Fluency Worker - Speech Fluency Analysis
Analyzes filler words, grammar errors, vocabulary diversity, and sentence complexity.
"""

import asyncio
import json
import logging
import os
import re
from typing import Dict, Any, Optional, List
import uuid

import spacy
from language_tool_python import LanguageTool
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as redis
from nats.aio.client import Client as NATS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Fluency Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None
nlp = None
language_tool = None

class FluencyAnalysisRequest(BaseModel):
    session_id: str
    transcript_data: Dict[str, Any]
    language: str = "en"

class FluencyAnalysisResponse(BaseModel):
    session_id: str
    task_id: str
    status: str
    message: str

def load_nlp_model(language: str = "en"):
    """Load spaCy model for text processing"""
    global nlp
    try:
        if language == "en":
            nlp = spacy.load("en_core_web_sm")
        else:
            # Default to English if language not supported
            nlp = spacy.load("en_core_web_sm")
        logger.info(f"Loaded spaCy model for language: {language}")
    except OSError:
        logger.warning("spaCy model not found, downloading...")
        spacy.cli.download("en_core_web_sm")
        nlp = spacy.load("en_core_web_sm")

def load_language_tool():
    """Load LanguageTool for grammar checking"""
    global language_tool
    try:
        language_tool = LanguageTool('en-US')
        logger.info("Loaded LanguageTool")
    except Exception as e:
        logger.error(f"Failed to load LanguageTool: {e}")
        language_tool = None

def detect_filler_words(text: str, words: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Detect filler words in speech"""
    # Common filler words and phrases
    filler_patterns = [
        r'\b(um|uh|ah|er|erm)\b',
        r'\b(like|you know|sort of|kind of)\b',
        r'\b(well|so|basically|actually|literally)\b',
        r'\b(i mean|i guess|i think|i suppose)\b',
        r'\b(right|okay|ok|yeah|yep)\b'
    ]
    
    filler_words = []
    filler_positions = []
    
    # Find filler words in text
    for pattern in filler_patterns:
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            filler_word = match.group()
            start_pos = match.start()
            filler_words.append(filler_word)
            filler_positions.append(start_pos)
    
    # Map filler words to timestamps if available
    filler_with_timestamps = []
    if words:
        for filler_word in filler_words:
            # Find corresponding word in words list
            for word_info in words:
                if word_info["word"].lower() == filler_word:
                    filler_with_timestamps.append({
                        "word": filler_word,
                        "start": word_info["start"],
                        "end": word_info["end"],
                        "confidence": word_info.get("confidence", 0.0)
                    })
                    break
    
    filler_stats = {
        "filler_word_count": len(filler_words),
        "filler_word_rate": len(filler_words) / len(text.split()) if text.split() else 0,
        "filler_words": filler_words,
        "filler_positions": filler_with_timestamps
    }
    
    logger.info(f"Detected {len(filler_words)} filler words")
    return filler_stats

def analyze_grammar(text: str) -> Dict[str, Any]:
    """Analyze grammar errors using LanguageTool"""
    if not language_tool:
        return {"grammar_errors": [], "error_count": 0}
    
    try:
        # Check grammar
        matches = language_tool.check(text)
        
        grammar_errors = []
        for match in matches:
            error_info = {
                "type": match.ruleId,
                "message": match.message,
                "context": match.context,
                "offset": match.offset,
                "error_length": match.errorLength,
                "replacements": match.replacements[:3] if match.replacements else []
            }
            grammar_errors.append(error_info)
        
        # Group errors by type
        error_types = {}
        for error in grammar_errors:
            error_type = error["type"]
            if error_type not in error_types:
                error_types[error_type] = []
            error_types[error_type].append(error)
        
        grammar_stats = {
            "grammar_errors": grammar_errors,
            "error_count": len(grammar_errors),
            "error_types": error_types,
            "error_rate": len(grammar_errors) / len(text.split()) if text.split() else 0
        }
        
        logger.info(f"Found {len(grammar_errors)} grammar errors")
        return grammar_stats
        
    except Exception as e:
        logger.error(f"Grammar analysis failed: {e}")
        return {"grammar_errors": [], "error_count": 0}

def analyze_vocabulary_diversity(text: str) -> Dict[str, Any]:
    """Analyze vocabulary diversity using Type-Token Ratio (TTR)"""
    if not nlp:
        return {"type_token_ratio": 0.0, "unique_words": 0, "total_words": 0}
    
    try:
        # Process text with spaCy
        doc = nlp(text)
        
        # Get tokens (words)
        tokens = [token.text.lower() for token in doc if token.is_alpha and not token.is_stop]
        
        # Calculate TTR
        unique_words = len(set(tokens))
        total_words = len(tokens)
        ttr = unique_words / total_words if total_words > 0 else 0.0
        
        # Calculate additional diversity metrics
        word_freq = {}
        for token in tokens:
            word_freq[token] = word_freq.get(token, 0) + 1
        
        # Most common words
        most_common = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
        
        vocabulary_stats = {
            "type_token_ratio": ttr,
            "unique_words": unique_words,
            "total_words": total_words,
            "lexical_diversity": ttr,
            "most_common_words": [{"word": word, "count": count} for word, count in most_common],
            "vocabulary_richness": "high" if ttr > 0.7 else "medium" if ttr > 0.5 else "low"
        }
        
        logger.info(f"Vocabulary analysis: TTR={ttr:.3f}, unique={unique_words}, total={total_words}")
        return vocabulary_stats
        
    except Exception as e:
        logger.error(f"Vocabulary analysis failed: {e}")
        return {"type_token_ratio": 0.0, "unique_words": 0, "total_words": 0}

def analyze_sentence_complexity(text: str) -> Dict[str, Any]:
    """Analyze sentence complexity"""
    if not nlp:
        return {"average_length": 0, "complex_sentences": 0, "simple_sentences": 0}
    
    try:
        # Process text with spaCy
        doc = nlp(text)
        
        # Get sentences
        sentences = list(doc.sents)
        
        sentence_lengths = []
        complex_sentences = 0
        simple_sentences = 0
        
        for sentence in sentences:
            # Count words in sentence
            word_count = len([token for token in sentence if token.is_alpha])
            sentence_lengths.append(word_count)
            
            # Determine complexity (simplified heuristic)
            if word_count > 15:
                complex_sentences += 1
            else:
                simple_sentences += 1
        
        avg_length = sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0
        
        complexity_stats = {
            "average_length": avg_length,
            "complex_sentences": complex_sentences,
            "simple_sentences": simple_sentences,
            "sentence_count": len(sentences),
            "sentence_lengths": sentence_lengths,
            "complexity_ratio": complex_sentences / len(sentences) if sentences else 0
        }
        
        logger.info(f"Sentence complexity: avg_length={avg_length:.1f}, complex={complex_sentences}, simple={simple_sentences}")
        return complexity_stats
        
    except Exception as e:
        logger.error(f"Sentence complexity analysis failed: {e}")
        return {"average_length": 0, "complex_sentences": 0, "simple_sentences": 0}

def analyze_speech_patterns(text: str, words: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze speech patterns and disfluencies"""
    patterns = {
        "repetitions": 0,
        "self_corrections": 0,
        "incomplete_sentences": 0,
        "run_on_sentences": 0
    }
    
    # Detect repetitions
    word_list = [word_info["word"].lower() for word_info in words]
    for i in range(len(word_list) - 1):
        if word_list[i] == word_list[i + 1]:
            patterns["repetitions"] += 1
    
    # Detect self-corrections (simplified)
    correction_indicators = ["i mean", "that is", "actually", "let me rephrase"]
    for indicator in correction_indicators:
        if indicator in text.lower():
            patterns["self_corrections"] += 1
    
    # Detect incomplete sentences (ending with prepositions, etc.)
    incomplete_endings = ["of", "in", "at", "to", "for", "with", "by"]
    sentences = text.split('.')
    for sentence in sentences:
        sentence = sentence.strip()
        if sentence and any(sentence.lower().endswith(f" {ending}") for ending in incomplete_endings):
            patterns["incomplete_sentences"] += 1
    
    logger.info(f"Speech patterns: repetitions={patterns['repetitions']}, corrections={patterns['self_corrections']}")
    return patterns

async def analyze_fluency(transcript_data: Dict[str, Any], language: str = "en") -> Dict[str, Any]:
    """Perform comprehensive fluency analysis"""
    try:
        text = transcript_data.get("text", "")
        words = transcript_data.get("words", [])
        
        if not text:
            return {"error": "No transcript text provided"}
        
        # Perform all analyses
        filler_stats = detect_filler_words(text, words)
        grammar_stats = analyze_grammar(text)
        vocabulary_stats = analyze_vocabulary_diversity(text)
        complexity_stats = analyze_sentence_complexity(text)
        pattern_stats = analyze_speech_patterns(text, words)
        
        # Combine all results
        fluency_data = {
            "filler_words": filler_stats,
            "grammar_errors": grammar_stats,
            "vocabulary_diversity": vocabulary_stats,
            "sentence_complexity": complexity_stats,
            "speech_patterns": pattern_stats,
            "overall_fluency_score": calculate_fluency_score(
                filler_stats, grammar_stats, vocabulary_stats, complexity_stats, pattern_stats
            ),
            "analysis_timestamp": asyncio.get_event_loop().time()
        }
        
        logger.info("Fluency analysis completed successfully")
        return fluency_data
        
    except Exception as e:
        logger.error(f"Fluency analysis failed: {e}")
        raise

def calculate_fluency_score(filler_stats: Dict, grammar_stats: Dict, vocabulary_stats: Dict, 
                          complexity_stats: Dict, pattern_stats: Dict) -> float:
    """Calculate overall fluency score (0-10)"""
    score = 10.0
    
    # Deduct for filler words
    filler_rate = filler_stats.get("filler_word_rate", 0)
    if filler_rate > 0.1:
        score -= 2.0
    elif filler_rate > 0.05:
        score -= 1.0
    
    # Deduct for grammar errors
    error_rate = grammar_stats.get("error_rate", 0)
    if error_rate > 0.1:
        score -= 2.0
    elif error_rate > 0.05:
        score -= 1.0
    
    # Deduct for speech patterns
    repetitions = pattern_stats.get("repetitions", 0)
    corrections = pattern_stats.get("self_corrections", 0)
    score -= min(2.0, (repetitions + corrections) * 0.5)
    
    # Bonus for vocabulary diversity
    ttr = vocabulary_stats.get("type_token_ratio", 0)
    if ttr > 0.7:
        score += 0.5
    elif ttr < 0.4:
        score -= 0.5
    
    return max(0.0, min(10.0, score))

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish fluency analysis result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "fluency_completed",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("fluency.done", json.dumps(message).encode())
        logger.info(f"Published fluency result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish fluency result: {e}")

async def process_fluency_task(request: FluencyAnalysisRequest):
    """Background task to process fluency analysis"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"fluency_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "message": "Analyzing fluency features..."
        }))
        
        # Perform fluency analysis
        result = await analyze_fluency(request.transcript_data, request.language)
        
        # Store result in Redis
        await redis_client.set(f"fluency:{request.session_id}", json.dumps(result))
        
        # Update task status
        await redis_client.set(f"fluency_task:{task_id}", json.dumps({
            "status": "completed",
            "session_id": request.session_id,
            "message": "Fluency analysis completed",
            "result": result
        }))
        
        # Publish result to NATS
        await publish_result(request.session_id, result)
        
        logger.info(f"Fluency task completed for session: {request.session_id}")
        
    except Exception as e:
        logger.error(f"Fluency task failed for session {request.session_id}: {e}")
        
        # Update task status
        await redis_client.set(f"fluency_task:{task_id}", json.dumps({
            "status": "failed",
            "session_id": request.session_id,
            "message": str(e)
        }))

@app.on_event("startup")
async def startup_event():
    """Initialize connections and models on startup"""
    global redis_client, nats_client
    
    # Connect to Redis
    redis_client = redis.from_url(REDIS_URL)
    await redis_client.ping()
    logger.info("Connected to Redis")
    
    # Connect to NATS
    nats_client = NATS()
    await nats_client.connect(NATS_URL)
    logger.info("Connected to NATS")
    
    # Load NLP models
    load_nlp_model()
    load_language_tool()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    if redis_client:
        await redis_client.close()
    if nats_client:
        await nats_client.close()

@app.post("/process", response_model=FluencyAnalysisResponse)
async def process_fluency(request: FluencyAnalysisRequest, background_tasks: BackgroundTasks):
    """Process fluency analysis request"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_fluency_task, request)
        
        return FluencyAnalysisResponse(
            session_id=request.session_id,
            task_id=task_id,
            status="accepted",
            message="Fluency analysis started"
        )
        
    except Exception as e:
        logger.error(f"Failed to start fluency analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of fluency processing task"""
    try:
        task_data = await redis_client.get(f"fluency_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fluency/{session_id}")
async def get_fluency(session_id: str):
    """Get fluency analysis result for session"""
    try:
        fluency_data = await redis_client.get(f"fluency:{session_id}")
        if fluency_data:
            return json.loads(fluency_data)
        else:
            raise HTTPException(status_code=404, detail="Fluency analysis not found")
    except Exception as e:
        logger.error(f"Failed to get fluency analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "spacy_loaded": nlp is not None,
        "language_tool_loaded": language_tool is not None,
        "redis_connected": redis_client is not None,
        "nats_connected": nats_client is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
