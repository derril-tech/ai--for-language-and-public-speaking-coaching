from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import redis
import nats
import json
import asyncio
import logging
from datetime import datetime
import uuid
import os
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Search Worker", version="1.0.0")

# Redis connection
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True
)

# NATS connection
nats_client = None

# Load sentence transformer model
model = None

class SearchRequest(BaseModel):
    session_id: str
    query: str
    limit: int = 10
    threshold: float = 0.5

class EmbeddingRequest(BaseModel):
    session_id: str
    text: str
    metadata: Optional[Dict[str, Any]] = None

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    query: str
    total: int
    processing_time: float

class EmbeddingResponse(BaseModel):
    session_id: str
    embedding: List[float]
    metadata: Dict[str, Any]

async def connect_nats():
    """Connect to NATS server"""
    global nats_client
    try:
        nats_client = await nats.connect(os.getenv("NATS_URL", "nats://localhost:4222"))
        logger.info("Connected to NATS")
    except Exception as e:
        logger.error(f"Failed to connect to NATS: {e}")

def load_embedding_model():
    """Load the sentence transformer model"""
    global model
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("Loaded embedding model")
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialize connections and models on startup"""
    await connect_nats()
    load_embedding_model()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    if nats_client:
        await nats_client.close()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "model_loaded": model is not None,
        "nats_connected": nats_client is not None
    }

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    """Create embeddings for text"""
    if not model:
        raise HTTPException(status_code=503, detail="Embedding model not loaded")
    
    try:
        # Generate embedding
        embedding = model.encode(request.text).tolist()
        
        # Store in Redis
        embedding_key = f"embedding:{request.session_id}"
        embedding_data = {
            "embedding": embedding,
            "text": request.text,
            "metadata": request.metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }
        redis_client.setex(embedding_key, 3600, json.dumps(embedding_data))
        
        return EmbeddingResponse(
            session_id=request.session_id,
            embedding=embedding,
            metadata=embedding_data["metadata"]
        )
    except Exception as e:
        logger.error(f"Error creating embedding: {e}")
        raise HTTPException(status_code=500, detail="Failed to create embedding")

@app.post("/search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    """Perform semantic search"""
    if not model:
        raise HTTPException(status_code=503, detail="Embedding model not loaded")
    
    start_time = datetime.utcnow()
    
    try:
        # Generate query embedding
        query_embedding = model.encode(request.query)
        
        # Get all embeddings from Redis
        embeddings = []
        for key in redis_client.scan_iter("embedding:*"):
            embedding_data = redis_client.get(key)
            if embedding_data:
                data = json.loads(embedding_data)
                embeddings.append({
                    "key": key,
                    "embedding": data["embedding"],
                    "text": data["text"],
                    "metadata": data["metadata"]
                })
        
        if not embeddings:
            return SearchResponse(
                results=[],
                query=request.query,
                total=0,
                processing_time=0.0
            )
        
        # Calculate similarities
        embedding_vectors = np.array([e["embedding"] for e in embeddings])
        similarities = cosine_similarity([query_embedding], embedding_vectors)[0]
        
        # Filter and sort results
        results = []
        for i, similarity in enumerate(similarities):
            if similarity >= request.threshold:
                results.append({
                    "session_id": embeddings[i]["key"].split(":")[1],
                    "text": embeddings[i]["text"],
                    "similarity": float(similarity),
                    "metadata": embeddings[i]["metadata"]
                })
        
        # Sort by similarity and limit results
        results.sort(key=lambda x: x["similarity"], reverse=True)
        results = results[:request.limit]
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return SearchResponse(
            results=results,
            query=request.query,
            total=len(results),
            processing_time=processing_time
        )
    except Exception as e:
        logger.error(f"Error performing search: {e}")
        raise HTTPException(status_code=500, detail="Failed to perform search")

@app.post("/build-index")
async def build_index(background_tasks: BackgroundTasks, session_id: str):
    """Build search index for a session"""
    task_id = str(uuid.uuid4())
    
    # Store task status
    redis_client.setex(f"search_task:{task_id}", 3600, json.dumps({
        "status": "processing",
        "session_id": session_id,
        "created_at": datetime.utcnow().isoformat()
    }))
    
    # Start background task
    background_tasks.add_task(build_index_task, task_id, session_id)
    
    return {"task_id": task_id, "status": "processing"}

async def build_index_task(task_id: str, session_id: str):
    """Background task to build search index"""
    try:
        # Get session data from Redis
        session_data = redis_client.get(f"session:{session_id}")
        if not session_data:
            raise Exception("Session not found")
        
        session = json.loads(session_data)
        
        # Get transcript
        transcript_data = redis_client.get(f"transcript:{session_id}")
        if transcript_data:
            transcript = json.loads(transcript_data)
            
            # Create embeddings for transcript segments
            if "segments" in transcript:
                for i, segment in enumerate(transcript["segments"]):
                    text = segment.get("text", "")
                    if text.strip():
                        embedding = model.encode(text).tolist()
                        embedding_data = {
                            "embedding": embedding,
                            "text": text,
                            "metadata": {
                                "type": "transcript_segment",
                                "segment_index": i,
                                "start_time": segment.get("start", 0),
                                "end_time": segment.get("end", 0)
                            },
                            "created_at": datetime.utcnow().isoformat()
                        }
                        redis_client.setex(
                            f"embedding:{session_id}:segment:{i}",
                            86400,  # 24 hours
                            json.dumps(embedding_data)
                        )
        
        # Get fluency data for searchable content
        fluency_data = redis_client.get(f"fluency:{session_id}")
        if fluency_data:
            fluency = json.loads(fluency_data)
            
            # Create embeddings for key insights
            insights = []
            if "filler_words" in fluency:
                insights.append(f"Filler words detected: {', '.join(fluency['filler_words'])}")
            if "grammar_errors" in fluency:
                insights.append(f"Grammar issues: {len(fluency['grammar_errors'])} found")
            if "vocabulary_diversity" in fluency:
                insights.append(f"Vocabulary diversity: {fluency['vocabulary_diversity']['ttr']:.2f}")
            
            for i, insight in enumerate(insights):
                embedding = model.encode(insight).tolist()
                embedding_data = {
                    "embedding": embedding,
                    "text": insight,
                    "metadata": {
                        "type": "fluency_insight",
                        "insight_index": i
                    },
                    "created_at": datetime.utcnow().isoformat()
                }
                redis_client.setex(
                    f"embedding:{session_id}:insight:{i}",
                    86400,
                    json.dumps(embedding_data)
                )
        
        # Update task status
        redis_client.setex(f"search_task:{task_id}", 3600, json.dumps({
            "status": "completed",
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat()
        }))
        
        # Publish completion event
        if nats_client:
            await nats_client.publish(
                "search.done",
                json.dumps({
                    "session_id": session_id,
                    "task_id": task_id,
                    "status": "completed",
                    "timestamp": datetime.utcnow().isoformat()
                }).encode()
            )
        
        logger.info(f"Search index built for session {session_id}")
        
    except Exception as e:
        logger.error(f"Error building search index: {e}")
        
        # Update task status
        redis_client.setex(f"search_task:{task_id}", 3600, json.dumps({
            "status": "failed",
            "session_id": session_id,
            "error": str(e),
            "created_at": datetime.utcnow().isoformat(),
            "failed_at": datetime.utcnow().isoformat()
        }))
        
        # Publish failure event
        if nats_client:
            await nats_client.publish(
                "search.done",
                json.dumps({
                    "session_id": session_id,
                    "task_id": task_id,
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                }).encode()
            )

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get task status"""
    task_data = redis_client.get(f"search_task:{task_id}")
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return json.loads(task_data)

@app.get("/suggestions")
async def get_search_suggestions(query: str, limit: int = 5):
    """Get search suggestions based on query"""
    if not model:
        raise HTTPException(status_code=503, detail="Embedding model not loaded")
    
    try:
        # Generate query embedding
        query_embedding = model.encode(query)
        
        # Get recent embeddings
        suggestions = []
        for key in redis_client.scan_iter("embedding:*"):
            embedding_data = redis_client.get(key)
            if embedding_data:
                data = json.loads(embedding_data)
                similarity = cosine_similarity([query_embedding], [data["embedding"]])[0][0]
                
                if similarity > 0.3:  # Lower threshold for suggestions
                    suggestions.append({
                        "text": data["text"][:100] + "..." if len(data["text"]) > 100 else data["text"],
                        "similarity": float(similarity),
                        "metadata": data["metadata"]
                    })
        
        # Sort and limit
        suggestions.sort(key=lambda x: x["similarity"], reverse=True)
        return suggestions[:limit]
        
    except Exception as e:
        logger.error(f"Error getting suggestions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get suggestions")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
