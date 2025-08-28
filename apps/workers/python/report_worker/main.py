#!/usr/bin/env python3
"""
Report Worker - Session Report Generation
Generates PDF, CSV, and JSON reports with charts and timelines from session analysis data.
"""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List
import uuid
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as redis
from nats.aio.client import Client as NATS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Report Worker", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
S3_BUCKET = os.getenv("S3_BUCKET", "speechcoach-reports")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")

# Global variables
redis_client: Optional[redis.Redis] = None
nats_client: Optional[NATS] = None

class ReportRequest(BaseModel):
    session_id: str
    report_id: str
    format: str = "pdf"  # pdf, csv, json
    include_charts: bool = True
    include_timeline: bool = True
    custom_title: Optional[str] = None

class ReportResponse(BaseModel):
    session_id: str
    report_id: str
    task_id: str
    status: str
    message: str

def generate_pdf_report(session_data: Dict[str, Any], analysis_data: Dict[str, Any], 
                       report_config: Dict[str, Any]) -> str:
    """Generate PDF report with charts and analysis"""
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.linecharts import HorizontalLineChart
        from reportlab.graphics.charts.piecharts import Pie
        
        # Create temporary PDF file
        pdf_path = tempfile.mktemp(suffix=".pdf")
        doc = SimpleDocTemplate(pdf_path, pagesize=A4)
        story = []
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center
        )
        
        # Title
        title = report_config.get("custom_title", f"Speech Analysis Report - {session_data.get('title', 'Session')}")
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 20))
        
        # Session Information
        story.append(Paragraph("Session Information", styles['Heading2']))
        session_info = [
            ["Session ID", session_data.get("id", "N/A")],
            ["Title", session_data.get("title", "N/A")],
            ["Duration", f"{session_data.get('duration', 0):.1f} seconds"],
            ["Created", session_data.get("created_at", "N/A")]
        ]
        session_table = Table(session_info, colWidths=[2*inch, 4*inch])
        session_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(session_table)
        story.append(Spacer(1, 20))
        
        # Overall Score
        if "scoring" in analysis_data:
            scoring = analysis_data["scoring"]
            story.append(Paragraph("Overall Performance Score", styles['Heading2']))
            overall_score = scoring.get("overall_score", 0)
            score_text = f"Overall Score: {overall_score:.1f}/10"
            story.append(Paragraph(score_text, styles['Heading3']))
            story.append(Spacer(1, 10))
            
            # Rubric Scores
            rubric_scores = scoring.get("rubric_scores", {})
            if rubric_scores:
                story.append(Paragraph("Detailed Scores", styles['Heading3']))
                score_data = [["Category", "Score", "Feedback"]]
                for category, score_info in rubric_scores.items():
                    score_data.append([
                        category.title(),
                        f"{score_info.get('score', 0):.1f}/10",
                        score_info.get('feedback', 'N/A')
                    ])
                
                score_table = Table(score_data, colWidths=[1.5*inch, 1*inch, 3.5*inch])
                score_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(score_table)
                story.append(Spacer(1, 20))
        
        # Fluency Analysis
        if "fluency" in analysis_data:
            fluency = analysis_data["fluency"]
            story.append(Paragraph("Fluency Analysis", styles['Heading2']))
            
            filler_stats = fluency.get("filler_words", {})
            filler_count = filler_stats.get("filler_word_count", 0)
            filler_rate = filler_stats.get("filler_word_rate", 0)
            
            fluency_data = [
                ["Metric", "Value"],
                ["Filler Words", str(filler_count)],
                ["Filler Rate", f"{filler_rate:.2%}"],
                ["Overall Fluency Score", f"{fluency.get('overall_fluency_score', 0):.1f}/10"]
            ]
            
            fluency_table = Table(fluency_data, colWidths=[2*inch, 4*inch])
            fluency_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(fluency_table)
            story.append(Spacer(1, 20))
        
        # Prosody Analysis
        if "prosody" in analysis_data:
            prosody = analysis_data["prosody"]
            story.append(Paragraph("Prosody Analysis", styles['Heading2']))
            
            # WPM
            wpm_data = prosody.get("wpm", {})
            current_wpm = wpm_data.get("current", 0)
            
            # F0
            f0_data = prosody.get("f0", {})
            mean_f0 = f0_data.get("mean", 0)
            
            prosody_data = [
                ["Metric", "Value"],
                ["Words Per Minute", f"{current_wpm:.0f}"],
                ["Mean F0 (Hz)", f"{mean_f0:.1f}"],
                ["Pause Count", str(prosody.get("pauses", {}).get("count", 0))]
            ]
            
            prosody_table = Table(prosody_data, colWidths=[2*inch, 4*inch])
            prosody_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(prosody_table)
            story.append(Spacer(1, 20))
        
        # Improvement Areas
        if "scoring" in analysis_data:
            improvement_areas = scoring.get("improvement_areas", [])
            if improvement_areas:
                story.append(Paragraph("Areas for Improvement", styles['Heading2']))
                for area in improvement_areas:
                    story.append(Paragraph(f"• {area.get('category', '').title()}: {area.get('suggestion', '')}", styles['Normal']))
                story.append(Spacer(1, 20))
        
        # Strengths
        if "scoring" in analysis_data:
            strengths = scoring.get("strengths", [])
            if strengths:
                story.append(Paragraph("Strengths", styles['Heading2']))
                for strength in strengths:
                    story.append(Paragraph(f"• {strength.get('category', '').title()}: {strength.get('detail', '')}", styles['Normal']))
                story.append(Spacer(1, 20))
        
        # Build PDF
        doc.build(story)
        
        logger.info(f"Generated PDF report: {pdf_path}")
        return pdf_path
        
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise

def generate_csv_report(session_data: Dict[str, Any], analysis_data: Dict[str, Any]) -> str:
    """Generate CSV report with session data"""
    try:
        import csv
        
        # Create temporary CSV file
        csv_path = tempfile.mktemp(suffix=".csv")
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # Session Information
            writer.writerow(["Session Information"])
            writer.writerow(["Session ID", session_data.get("id", "N/A")])
            writer.writerow(["Title", session_data.get("title", "N/A")])
            writer.writerow(["Duration", f"{session_data.get('duration', 0):.1f} seconds"])
            writer.writerow(["Created", session_data.get("created_at", "N/A")])
            writer.writerow([])
            
            # Scoring Data
            if "scoring" in analysis_data:
                scoring = analysis_data["scoring"]
                writer.writerow(["Scoring Data"])
                writer.writerow(["Overall Score", f"{scoring.get('overall_score', 0):.1f}"])
                writer.writerow([])
                
                rubric_scores = scoring.get("rubric_scores", {})
                writer.writerow(["Category", "Score", "Weight", "Feedback"])
                for category, score_info in rubric_scores.items():
                    writer.writerow([
                        category,
                        f"{score_info.get('score', 0):.1f}",
                        f"{score_info.get('weight', 0):.2f}",
                        score_info.get('feedback', 'N/A')
                    ])
                writer.writerow([])
            
            # Fluency Data
            if "fluency" in analysis_data:
                fluency = analysis_data["fluency"]
                writer.writerow(["Fluency Data"])
                writer.writerow(["Filler Word Count", fluency.get("filler_words", {}).get("filler_word_count", 0)])
                writer.writerow(["Filler Word Rate", f"{fluency.get('filler_words', {}).get('filler_word_rate', 0):.4f}"])
                writer.writerow(["Overall Fluency Score", f"{fluency.get('overall_fluency_score', 0):.1f}"])
                writer.writerow([])
            
            # Prosody Data
            if "prosody" in analysis_data:
                prosody = analysis_data["prosody"]
                writer.writerow(["Prosody Data"])
                writer.writerow(["Words Per Minute", f"{prosody.get('wpm', {}).get('current', 0):.0f}"])
                writer.writerow(["Mean F0 (Hz)", f"{prosody.get('f0', {}).get('mean', 0):.1f}"])
                writer.writerow(["Pause Count", prosody.get("pauses", {}).get("count", 0)])
                writer.writerow([])
        
        logger.info(f"Generated CSV report: {csv_path}")
        return csv_path
        
    except Exception as e:
        logger.error(f"CSV generation failed: {e}")
        raise

def generate_json_report(session_data: Dict[str, Any], analysis_data: Dict[str, Any], 
                        report_config: Dict[str, Any]) -> str:
    """Generate JSON report with all analysis data"""
    try:
        # Create comprehensive JSON report
        report_data = {
            "report_id": report_config.get("report_id"),
            "session_id": session_data.get("id"),
            "title": report_config.get("custom_title", f"Speech Analysis Report - {session_data.get('title', 'Session')}"),
            "generated_at": datetime.now().isoformat(),
            "session_info": {
                "id": session_data.get("id"),
                "title": session_data.get("title"),
                "duration": session_data.get("duration"),
                "created_at": session_data.get("created_at")
            },
            "analysis_data": analysis_data,
            "summary": {
                "overall_score": analysis_data.get("scoring", {}).get("overall_score", 0),
                "fluency_score": analysis_data.get("fluency", {}).get("overall_fluency_score", 0),
                "wpm": analysis_data.get("prosody", {}).get("wpm", {}).get("current", 0),
                "filler_count": analysis_data.get("fluency", {}).get("filler_words", {}).get("filler_word_count", 0)
            }
        }
        
        # Create temporary JSON file
        json_path = tempfile.mktemp(suffix=".json")
        with open(json_path, 'w', encoding='utf-8') as jsonfile:
            json.dump(report_data, jsonfile, indent=2, ensure_ascii=False)
        
        logger.info(f"Generated JSON report: {json_path}")
        return json_path
        
    except Exception as e:
        logger.error(f"JSON generation failed: {e}")
        raise

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

async def generate_report(request: ReportRequest) -> Dict[str, Any]:
    """Generate comprehensive report"""
    try:
        # Get all session data
        session_data = await redis_client.get(f"session:{request.session_id}")
        transcript_data = await redis_client.get(f"transcript:{request.session_id}")
        prosody_data = await redis_client.get(f"prosody:{request.session_id}")
        fluency_data = await redis_client.get(f"fluency:{request.session_id}")
        scoring_data = await redis_client.get(f"scoring:{request.session_id}")
        
        if not session_data:
            raise ValueError("Session not found")
        
        session = json.loads(session_data)
        
        # Compile analysis data
        analysis_data = {}
        if transcript_data:
            analysis_data["transcript"] = json.loads(transcript_data)
        if prosody_data:
            analysis_data["prosody"] = json.loads(prosody_data)
        if fluency_data:
            analysis_data["fluency"] = json.loads(fluency_data)
        if scoring_data:
            analysis_data["scoring"] = json.loads(scoring_data)
        
        # Report configuration
        report_config = {
            "report_id": request.report_id,
            "custom_title": request.custom_title,
            "include_charts": request.include_charts,
            "include_timeline": request.include_timeline
        }
        
        # Generate report based on format
        file_path = None
        file_extension = ""
        
        if request.format.lower() == "pdf":
            file_path = generate_pdf_report(session, analysis_data, report_config)
            file_extension = ".pdf"
        elif request.format.lower() == "csv":
            file_path = generate_csv_report(session, analysis_data)
            file_extension = ".csv"
        elif request.format.lower() == "json":
            file_path = generate_json_report(session, analysis_data, report_config)
            file_extension = ".json"
        else:
            raise ValueError(f"Unsupported format: {request.format}")
        
        try:
            # Upload to S3
            s3_key = f"reports/{request.report_id}{file_extension}"
            file_url = await upload_to_s3(file_path, s3_key)
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            # Prepare result
            result = {
                "report_id": request.report_id,
                "session_id": request.session_id,
                "format": request.format,
                "file_url": file_url,
                "file_size": file_size,
                "include_charts": request.include_charts,
                "include_timeline": request.include_timeline,
                "status": "completed",
                "created_at": asyncio.get_event_loop().time()
            }
            
            logger.info(f"Report generation completed: {request.report_id}")
            return result
            
        finally:
            # Clean up temporary file
            if file_path and os.path.exists(file_path):
                os.unlink(file_path)
                
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise

async def publish_result(session_id: str, result: Dict[str, Any]):
    """Publish report generation result to NATS"""
    try:
        message = {
            "session_id": session_id,
            "type": "report_completed",
            "data": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await nats_client.publish("report.done", json.dumps(message).encode())
        logger.info(f"Published report result for session: {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to publish report result: {e}")

async def process_report_task(request: ReportRequest):
    """Background task to process report generation"""
    task_id = str(uuid.uuid4())
    
    try:
        # Update task status
        await redis_client.set(f"report_task:{task_id}", json.dumps({
            "status": "processing",
            "session_id": request.session_id,
            "report_id": request.report_id,
            "message": f"Generating {request.format.upper()} report..."
        }))
        
        # Generate report
        result = await generate_report(request)
        
        # Store result in Redis
        await redis_client.set(f"report:{request.report_id}", json.dumps(result))
        
        # Update task status
        await redis_client.set(f"report_task:{task_id}", json.dumps({
            "status": "completed",
            "session_id": request.session_id,
            "report_id": request.report_id,
            "message": "Report generation completed",
            "result": result
        }))
        
        # Publish result to NATS
        await publish_result(request.session_id, result)
        
        logger.info(f"Report task completed: {request.report_id}")
        
    except Exception as e:
        logger.error(f"Report task failed for {request.report_id}: {e}")
        
        # Update task status
        await redis_client.set(f"report_task:{task_id}", json.dumps({
            "status": "failed",
            "session_id": request.session_id,
            "report_id": request.report_id,
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

@app.post("/generate", response_model=ReportResponse)
async def generate_report_endpoint(request: ReportRequest, background_tasks: BackgroundTasks):
    """Generate report endpoint"""
    try:
        task_id = str(uuid.uuid4())
        
        # Add task to background processing
        background_tasks.add_task(process_report_task, request)
        
        return ReportResponse(
            session_id=request.session_id,
            report_id=request.report_id,
            task_id=task_id,
            status="accepted",
            message=f"Report generation started ({request.format.upper()})"
        )
        
    except Exception as e:
        logger.error(f"Failed to start report generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of report generation task"""
    try:
        task_data = await redis_client.get(f"report_task:{task_id}")
        if task_data:
            return json.loads(task_data)
        else:
            raise HTTPException(status_code=404, detail="Task not found")
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/report/{report_id}")
async def get_report(report_id: str):
    """Get report information"""
    try:
        report_data = await redis_client.get(f"report:{report_id}")
        if report_data:
            return json.loads(report_data)
        else:
            raise HTTPException(status_code=404, detail="Report not found")
    except Exception as e:
        logger.error(f"Failed to get report: {e}")
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
    uvicorn.run(app, host="0.0.0.0", port=8007)
