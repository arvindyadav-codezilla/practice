from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import urllib.request
import urllib.parse
from typing import Dict, List, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase: Optional[Client] = None

if supabase_url and supabase_key and "your_supabase" not in supabase_url:
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("Supabase client initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")

app = FastAPI(title="FlexAI Backend - AI Gym Trainer & Live Coach API")

# Configure CORS for Next.js Vercel deployment or local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas for Requests
class WorkoutRequest(BaseModel):
    goal: str         # e.g., "Build Muscle", "Lose Weight", "Flexibility", "HIIT Cardio"
    level: str        # e.g., "Beginner", "Intermediate", "Advanced"
    duration: int     # e.g., 15, 30, 45, 60 minutes
    equipment: str    # e.g., "Bodyweight Only", "Dumbbells", "Full Gym"
    trainer: str      # e.g., "Max", "Serena", "Leo"

class MealPlanRequest(BaseModel):
    goal: str         # e.g., "Lose Weight", "Build Muscle", "Maintain Fitness"
    dietType: str     # e.g., "Balanced", "High Protein", "Keto", "Vegan", "Vegetarian"
    calories: int     # e.g., 2000

class SaveWorkoutLogRequest(BaseModel):
    userId: str
    trainer: str
    duration: int
    caloriesBurned: int
    workoutPlan: Optional[List[dict]] = None

class ProfileUpdateRequest(BaseModel):
    userId: str
    username: str
    goal: str
    level: str
    duration: int
    equipment: str
    whatsappNumber: Optional[str] = None
    callmebotKey: Optional[str] = None

class WhatsAppBriefRequest(BaseModel):
    userId: str
    workout: Optional[List[dict]] = None
    mealPlan: Optional[dict] = None

# Trainer Persona Prompts & Details
TRAINER_PERSONAS = {
    "Max": {
        "name": "Max (Strength Coach)",
        "style": "high energy, focused on form, progressive overload, weight training, and mental toughness",
        "voice": "strong, encouraging, direct, and energetic",
        "outro": "Keep pushing! No pain, no gains!",
        "bg_color": "var(--accent-orange)"
    },
    "Serena": {
        "name": "Serena (Yoga & Mindfulness Guide)",
        "style": "calm, breath-oriented, flexibility, core strength, and mind-body harmony",
        "voice": "peaceful, smooth, encouraging, and focused on breathing",
        "outro": "Breathe deep and find your alignment. Namaste.",
        "bg_color": "var(--accent-violet)"
    },
    "Leo": {
        "name": "Leo (HIIT & Cardio Specialist)",
        "style": "intense, fast-paced, high speed, dynamic movement, and fat burn",
        "voice": "extremely rapid, relentless, motivating, and count-down heavy",
        "outro": "Sweat is just fat crying! Time to dominate!",
        "bg_color": "var(--accent-pink)"
    }
}

# PRE-DEFINED OFFLINE FALLBACKS (In case GEMINI_API_KEY is not set)
OFFLINE_WORKOUTS = {
    "Build Muscle": {
        "Dumbbells": [
            {"name": "Warm-up Arm Circles", "duration": 45, "rest": 15, "description": "Rotate arms clockwise and counterclockwise to warm up shoulder joints.", "muscleGroup": "Shoulders", "tip": "Keep your core tight and maintain a steady breath."},
            {"name": "Dumbbell Goblet Squats", "duration": 45, "rest": 20, "description": "Hold one dumbbell vertically at chest height, squat down till hips are below knees, then push back up.", "muscleGroup": "Quads/Glutes", "tip": "Drive through your heels and squeeze your glutes at the top."},
            {"name": "Dumbbell Floor Press", "duration": 45, "rest": 20, "description": "Lie flat on your back, press dumbbells up from chest level, keep elbows at 45 degrees.", "muscleGroup": "Chest/Triceps", "tip": "Keep your lower back flat on the ground and control the descent."},
            {"name": "Dumbbell Bent-Over Row", "duration": 45, "rest": 20, "description": "Hinge forward at hips, back flat, pull dumbbells up to lower ribs squeezing shoulder blades.", "muscleGroup": "Back/Biceps", "tip": "Pull with your elbows, not your hands. Keep your neck neutral."},
            {"name": "Dumbbell Shoulder Press", "duration": 40, "rest": 20, "description": "Stand tall, press dumbbells up from shoulder level until arms are fully locked.", "muscleGroup": "Shoulders", "tip": "Avoid arching your lower back by bracing your abs."},
            {"name": "Dumbbell Hammer Curls", "duration": 40, "rest": 15, "description": "Hold dumbbells with palms facing each other, curl up towards shoulders.", "muscleGroup": "Biceps/Forearms", "tip": "Keep elbows locked to your ribs, don't swing your torso."}
        ],
        "Bodyweight Only": [
            {"name": "Jumping Jacks Warm-up", "duration": 45, "rest": 15, "description": "Jump out spreading arms and legs, then jump back to starting position.", "muscleGroup": "Full Body", "tip": "Stay light on your toes and establish a fast rhythm."},
            {"name": "Temp Push-Ups", "duration": 45, "rest": 20, "description": "Perform standard push-ups with a 3-second descent to maximize muscle tension.", "muscleGroup": "Chest/Triceps", "tip": "Maintain a straight line from your head to your heels."},
            {"name": "Bodyweight Squats", "duration": 45, "rest": 20, "description": "Lower your hips down and back, knees tracking over toes, keep chest tall.", "muscleGroup": "Legs", "tip": "Sit deep into the squat and keep your heels planted on the floor."},
            {"name": "Prone Cobra Holds", "duration": 40, "rest": 20, "description": "Lie on belly, lift chest and arms, squeeze shoulder blades together and hold.", "muscleGroup": "Upper Back", "tip": "Squeeze your back muscles hard and keep your neck straight."},
            {"name": "Plank Shoulder Taps", "duration": 45, "rest": 15, "description": "In a high plank, tap opposite shoulder with hand without rocking your hips.", "muscleGroup": "Core", "tip": "Keep your hips perfectly level. Squeeze your quads and abs."}
        ]
    },
    "Lose Weight": {
        "Bodyweight Only": [
            {"name": "High Knees Cardio", "duration": 40, "rest": 15, "description": "Run in place bringing knees up to hip height dynamically.", "muscleGroup": "Cardio", "tip": "Pump your arms and keep your chest lifted high."},
            {"name": "Burpees", "duration": 45, "rest": 20, "description": "Drop into a squat, jump feet back to plank, push up, jump feet forward, jump up.", "muscleGroup": "Full Body", "tip": "Pace yourself but keep moving. Land flat-footed on the jump."},
            {"name": "Mountain Climbers", "duration": 45, "rest": 15, "description": "In high plank position, drive knees to chest rapidly as if running.", "muscleGroup": "Core/Cardio", "tip": "Keep your hips low and shoulders stacked over wrists."},
            {"name": "Alternating Jump Lunges", "duration": 40, "rest": 20, "description": "Lunge forward, then explode upward switching feet in mid-air to land in opposite lunge.", "muscleGroup": "Legs/Cardio", "tip": "Soft landings are key. Protect your knees by keeping them at 90 degrees."},
            {"name": "Plank Jacks", "duration": 45, "rest": 15, "description": "In elbow plank, jump feet out and in repeatedly.", "muscleGroup": "Core/Cardio", "tip": "Keep your core active and don't let your lower back sag."}
        ]
    },
    "Flexibility": {
        "Bodyweight Only": [
            {"name": "Cat-Cow Stretch", "duration": 50, "rest": 10, "description": "On all fours, alternate between arching and rounding your back, synchronizing with breath.", "muscleGroup": "Spine/Back", "tip": "Inhale as you look up (Cow), exhale as you tuck chin to chest (Cat)."},
            {"name": "Downward Facing Dog", "duration": 45, "rest": 15, "description": "Form an inverted 'V' shape, push hips back, press heels toward floor, relax neck.", "muscleGroup": "Hamstrings/Shoulders", "tip": "Press down firmly through your fingers and lift your tailbone up."},
            {"name": "Cobra Stretch", "duration": 45, "rest": 15, "description": "Lie on belly, press hands down to lift chest, roll shoulders back and down.", "muscleGroup": "Abs/Lower Back", "tip": "Keep your shoulders away from your ears. Open up your collarbone."},
            {"name": "Runner's Lunge Stretch", "duration": 45, "rest": 10, "description": "Step right leg forward, sink hips low, hold. Switch sides halfway.", "muscleGroup": "Hip Flexors", "tip": "Keep the back leg active and breathe into the tightness in your hips."},
            {"name": "Child's Pose", "duration": 60, "rest": 10, "description": "Sit hips back on heels, reach arms forward, rest forehead on the mat.", "muscleGroup": "Recovery", "tip": "Let your body sink completely into the floor. Melt all tension away."}
        ]
    }
}

OFFLINE_MEALS = {
    "Balanced": {
        "Breakfast": "Avocado Toast with 2 Poached Eggs, spinach, and cherry tomatoes. (400 kcal)",
        "Lunch": "Grilled Chicken Quinoa Bowl with roasted bell peppers, cucumbers, and olive oil dressing. (650 kcal)",
        "Snack": "Greek Yogurt with a handful of blueberries and honey. (220 kcal)",
        "Dinner": "Baked Salmon with sweet potato mash and steamed broccoli. (580 kcal)",
        "Macros": {"Carbs": "160g", "Protein": "140g", "Fat": "65g"},
        "Shopping": ["Chicken breast", "Eggs", "Salmon fillet", "Quinoa", "Avocado", "Sweet potatoes", "Spinach", "Greek yogurt", "Broccoli"]
    },
    "High Protein": {
        "Breakfast": "Egg White Omelette (4 whites, 1 whole) with sliced turkey breast and mushrooms. (380 kcal)",
        "Lunch": "Tuna Salad Salad with mixed greens, boiled egg whites, and light olive oil dressing. (550 kcal)",
        "Snack": "Whey protein shake with unsweetened almond milk and a banana. (250 kcal)",
        "Dinner": "Lean Beef Stir-fry with mixed vegetables, garlic ginger sauce, and jasmine rice. (720 kcal)",
        "Macros": {"Carbs": "140g", "Protein": "190g", "Fat": "50g"},
        "Shopping": ["Egg whites", "Turkey breast", "Canned tuna", "Lean ground beef", "Whey protein", "Jasmine rice", "Mixed greens", "Bananas"]
    },
    "Vegan": {
        "Breakfast": "Tofu Scramble with nutritional yeast, spinach, bell peppers, and whole grain toast. (350 kcal)",
        "Lunch": "Lentil Salad with roasted pumpkin, kale, cherry tomatoes, and tahini dressing. (580 kcal)",
        "Snack": "Apple slices with 2 tablespoons of almond butter. (250 kcal)",
        "Dinner": "Chickpea and Sweet Potato Curry cooked in light coconut milk, served with brown rice. (670 kcal)",
        "Macros": {"Carbs": "220g", "Protein": "80g", "Fat": "60g"},
        "Shopping": ["Firm tofu", "Canned chickpeas", "Brown lentils", "Brown rice", "Sweet potatoes", "Tahini", "Almond butter", "Spinach", "Kale"]
    }
}

# Helper: Call Gemini REST API
async def fetch_gemini_api(prompt: str) -> Optional[str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        # Standard urllib sync request wrapped in executor (avoid blocking)
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, timeout=10).read())
        res_json = json.loads(response.decode("utf-8"))
        # Parse return text from Gemini JSON format
        candidate = res_json.get("candidates", [])[0]
        text_content = candidate.get("content", {}).get("parts", [])[0].get("text", "")
        return text_content
    except Exception as e:
        print(f"Gemini API Exception in Gym Trainer: {e}")
        return None

# HTTP POST Endpoint: Generate Workout
@app.post("/api/generate-workout")
async def generate_workout(req: WorkoutRequest):
    # Select trainer details
    trainer_details = TRAINER_PERSONAS.get(req.trainer, TRAINER_PERSONAS["Max"])
    
    prompt = f"""
    Generate a dynamic workout plan for a user whose goal is '{req.goal}', fitness level is '{req.level}', 
    available equipment is '{req.equipment}', and target session length is {req.duration} minutes.
    The plan is coached by {trainer_details['name']}, who speaks in a style that is {trainer_details['style']}.
    
    You MUST respond with a JSON array containing exactly 5-6 exercises.
    Format your response EXACTLY like this JSON schema:
    [
      {{
        "name": "Exercise Name",
        "duration": 45, // duration in seconds
        "rest": 15, // rest time in seconds
        "description": "Short explanation of how to perform the exercise.",
        "muscleGroup": "Target Muscle Group",
        "tip": "A custom tip written in the coaching voice of {req.trainer} ({trainer_details['voice']}). Keep it short and motivating."
      }}
    ]
    Return ONLY the raw JSON array. Do not include markdown wraps or triple backticks.
    """
    
    ai_response = await fetch_gemini_api(prompt)
    
    if ai_response:
        try:
            # Strip potential markdown formatting if Gemini didn't obey instructions
            cleaned = ai_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            workout_list = json.loads(cleaned)
            return {"source": "AI (Gemini)", "workout": workout_list}
        except Exception:
            pass # fallback if parsing failed

    # LOCAL OFFLINE FALLBACK ENGINE
    # Try to find matching fallback
    fallback_goal = req.goal if req.goal in OFFLINE_WORKOUTS else "Build Muscle"
    fallback_equip = req.equipment if req.equipment in OFFLINE_WORKOUTS[fallback_goal] else "Bodyweight Only"
    
    exercises = OFFLINE_WORKOUTS[fallback_goal][fallback_equip]
    
    # Adjust tips for the specific trainer selected
    personalized_exercises = []
    for ex in exercises:
        ex_copy = ex.copy()
        if req.trainer == "Serena":
            ex_copy["tip"] = f"[Serena] Focus on your inhale and exhale. Maintain a slow, aligned movement."
        elif req.trainer == "Leo":
            ex_copy["tip"] = f"[Leo] Speed it up! Push your limit! Let's go, 3-2-1 power!"
        else:
            ex_copy["tip"] = f"[Max] Keep your back straight, squeeze the muscle, and pull hard!"
        personalized_exercises.append(ex_copy)
        
    return {"source": "Offline Database", "workout": personalized_exercises}

# HTTP POST Endpoint: Generate Meal Plan
@app.post("/api/generate-meal-plan")
async def generate_meal_plan(req: MealPlanRequest):
    prompt = f"""
    Create a personalized meal plan for a goal of '{req.goal}', diet type is '{req.dietType}', 
    and target calories of {req.calories} kcal.
    
    Respond in JSON format with the following schema:
    {{
      "Breakfast": "Detailed description of breakfast",
      "Lunch": "Detailed description of lunch",
      "Snack": "Detailed description of snack",
      "Dinner": "Detailed description of dinner",
      "Macros": {{
        "Carbs": "grams",
        "Protein": "grams",
        "Fat": "grams"
      }},
      "Shopping": ["item 1", "item 2", "item 3", "item 4"]
    }}
    Return ONLY raw JSON. No markdown wrappers.
    """
    
    ai_response = await fetch_gemini_api(prompt)
    if ai_response:
        try:
            cleaned = ai_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            meal_plan = json.loads(cleaned)
            return {"source": "AI (Gemini)", "mealPlan": meal_plan}
        except Exception:
            pass

    # Fallback to local
    fallback_diet = req.dietType if req.dietType in OFFLINE_MEALS else "Balanced"
    return {"source": "Offline Database", "mealPlan": OFFLINE_MEALS[fallback_diet]}

# HTTP POST Endpoint: Save Workout Log
@app.post("/api/save-workout-log")
async def save_workout_log(req: SaveWorkoutLogRequest):
    if not supabase:
        return {"status": "success", "message": "Supabase client not initialized (Offline mode)"}
    try:
        log_data = {
            "user_id": req.userId,
            "trainer": req.trainer,
            "duration": req.duration,
            "calories_burned": req.caloriesBurned,
            "workout_plan": req.workoutPlan
        }
        supabase.table("workout_logs").insert(log_data).execute()
        
        # Update streak in profiles
        profile_res = supabase.table("profiles").select("streak_count").eq("id", req.userId).execute()
        if profile_res.data and len(profile_res.data) > 0:
            current_streak = profile_res.data[0].get("streak_count", 0)
            new_streak = current_streak + 1
            supabase.table("profiles").update({"streak_count": new_streak}).eq("id", req.userId).execute()
            return {"status": "success", "streak": new_streak}
        else:
            supabase.table("profiles").insert({"id": req.userId, "streak_count": 1}).execute()
            return {"status": "success", "streak": 1}
    except Exception as e:
        print(f"Error saving workout log to Supabase: {e}")
        return {"status": "error", "message": str(e)}

# HTTP GET Endpoint: Get User Stats
@app.get("/api/user-stats/{user_id}")
async def get_user_stats(user_id: str):
    if not supabase:
        return {
            "status": "success",
            "totalWorkouts": 3,
            "totalCalories": 320,
            "streak": 5,
            "message": "Offline Mode fallback"
        }
    try:
        profile_res = supabase.table("profiles").select("streak_count").eq("id", user_id).execute()
        streak = profile_res.data[0].get("streak_count", 0) if (profile_res.data and len(profile_res.data) > 0) else 0
        
        logs_res = supabase.table("workout_logs").select("duration", "calories_burned").eq("user_id", user_id).execute()
        total_workouts = len(logs_res.data) if (logs_res.data and isinstance(logs_res.data, list)) else 0
        total_calories = sum(log.get("calories_burned", 0) for log in logs_res.data) if logs_res.data else 0
        
        return {
            "status": "success",
            "totalWorkouts": total_workouts,
            "totalCalories": total_calories,
            "streak": streak
        }
    except Exception as e:
        print(f"Error fetching user stats: {e}")
        return {
            "status": "error",
            "totalWorkouts": 0,
            "totalCalories": 0,
            "streak": 0,
            "message": str(e)
        }

# HTTP GET Endpoint: Get Profile
@app.get("/api/profile/{user_id}")
async def get_profile(user_id: str):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if res.data and len(res.data) > 0:
            return {"status": "success", "profile": res.data[0]}
        return {"status": "not_found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# HTTP POST Endpoint: Update Profile
@app.post("/api/profile/update")
async def update_profile(req: ProfileUpdateRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        profile_data = {
            "id": req.userId,
            "username": req.username,
            "goal": req.goal,
            "level": req.level,
            "duration": req.duration,
            "equipment": req.equipment,
            "whatsapp_number": req.whatsappNumber,
            "callmebot_key": req.callmebotKey
        }
        supabase.table("profiles").upsert(profile_data).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# HTTP POST Endpoint: Send WhatsApp Brief
@app.post("/api/send-whatsapp-brief")
async def send_whatsapp_brief(req: WhatsAppBriefRequest):
    if not supabase:
        return {"status": "error", "message": "Supabase client not initialized"}
    try:
        res = supabase.table("profiles").select("whatsapp_number", "callmebot_key", "username").eq("id", req.userId).execute()
        if not res.data or len(res.data) == 0:
            return {"status": "error", "message": "User profile not found"}
            
        prof = res.data[0]
        phone = prof.get("whatsapp_number")
        key = prof.get("callmebot_key")
        uname = prof.get("username", "Athlete")
        
        if not phone or not key:
            return {"status": "error", "message": "WhatsApp number or CallMeBot API key is not configured"}
            
        msg = f"⚡ *FlexAI Daily Athlete Briefing* ⚡\n\nHello {uname}!\nHere is your plan for today:\n\n"
        
        if req.workout:
            msg += "*🏋️ WORKOUT ROUTINE:*\n"
            for idx, ex in enumerate(req.workout):
                msg += f"{idx+1}. {ex.get('name')} ({ex.get('duration')}s active) - _Tip: {ex.get('tip')}_\n"
            msg += "\n"
            
        if req.mealPlan:
            msg += "*🥗 DIET PLAN:*\n"
            msg += f"🍳 Breakfast: {req.mealPlan.get('Breakfast', 'N/A')}\n"
            msg += f"🥗 Lunch: {req.mealPlan.get('Lunch', 'N/A')}\n"
            msg += f"🍎 Snack: {req.mealPlan.get('Snack', 'N/A')}\n"
            msg += f"🥩 Dinner: {req.mealPlan.get('Dinner', 'N/A')}\n"
            if req.mealPlan.get('Macros'):
                mac = req.mealPlan.get('Macros')
                msg += f"_Macros: Carbs: {mac.get('Carbs')}, Protein: {mac.get('Protein')}, Fat: {mac.get('Fat')}_\n"
                
        msg += "\nStay dedicated! 💪🔥"
        
        encoded_msg = urllib.parse.quote_plus(msg)
        url = f"https://api.callmebot.com/whatsapp.php?phone={phone}&text={encoded_msg}&apikey={key}"
        
        req_bot = urllib.request.Request(
            url, 
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req_bot, timeout=10) as response:
            resp_data = response.read().decode('utf-8')
            
        return {"status": "success", "response": resp_data}
    except Exception as e:
        print(f"Error dispatching WhatsApp brief: {e}")
        return {"status": "error", "message": str(e)}

# Background Automated WhatsApp Daily Scheduler
import asyncio

async def daily_whatsapp_scheduler():
    await asyncio.sleep(10) # Initial startup delay
    while True:
        print("[Scheduler] Running automated daily WhatsApp briefings...")
        if supabase:
            try:
                res = supabase.table("profiles").select("*").execute()
                if res.data:
                    for prof in res.data:
                        phone = prof.get("whatsapp_number")
                        key = prof.get("callmebot_key")
                        if phone and key:
                            msg = f"⚡ *FlexAI Daily Morning Reminder* ⚡\n\nRise and shine, {prof.get('username', 'Athlete')}!\nTime to smash your daily workout today.\nOpen the FlexAI app to launch your coaching player: https://frontend-three-pied-13.vercel.app 🏃🔥"
                            encoded_msg = urllib.parse.quote_plus(msg)
                            url = f"https://api.callmebot.com/whatsapp.php?phone={phone}&text={encoded_msg}&apikey={key}"
                            req_bot = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                            try:
                                with urllib.request.urlopen(req_bot, timeout=10) as r:
                                    r.read()
                            except Exception as inner:
                                print(f"Failed to send scheduler alert to {phone}: {inner}")
            except Exception as e:
                print(f"Scheduler exception: {e}")
        await asyncio.sleep(86400) # Run once every 24 hours

@app.on_event("startup")
async def start_scheduler():
    asyncio.create_task(daily_whatsapp_scheduler())

# WebSocket Connection Manager for live interactive coaching
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/live-coach")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Store trainer context for this session
    current_trainer = "Max"
    workout_history = []
    
    try:
        # Send welcome message
        await manager.send_personal_message({
            "type": "system",
            "message": "Connected to FlexAI Live Coach. Ready for your session."
        }, websocket)
        
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
            except Exception:
                await manager.send_personal_message({
                    "type": "system",
                    "message": "Error: Invalid JSON format."
                }, websocket)
                continue
                
            event_type = event.get("type")
            
            if event_type == "start":
                # User starts workout
                current_trainer = event.get("trainer", "Max")
                trainer_info = TRAINER_PERSONAS.get(current_trainer, TRAINER_PERSONAS["Max"])
                welcome_cue = f"Welcome! I am {trainer_info['name']}. Let's begin our session today. {trainer_info['outro']}"
                
                await manager.send_personal_message({
                    "type": "trainer_cue",
                    "trainer": current_trainer,
                    "cue": welcome_cue,
                    "audioText": welcome_cue
                }, websocket)
                
            elif event_type == "cue_request":
                # Triggered when an exercise starts
                current_trainer = event.get("trainer", "Max")
                exercise_name = event.get("exercise", "Next exercise")
                tip = event.get("tip", "Stay focused.")
                
                cue_message = f"Next exercise: {exercise_name}. Remember: {tip}"
                await manager.send_personal_message({
                    "type": "trainer_cue",
                    "trainer": current_trainer,
                    "cue": cue_message,
                    "audioText": cue_message
                }, websocket)
                
            elif event_type == "message":
                # User asks a coaching query or complains
                user_msg = event.get("message", "").strip()
                current_trainer = event.get("trainer", "Max")
                trainer_info = TRAINER_PERSONAS.get(current_trainer, TRAINER_PERSONAS["Max"])
                
                # Formulate a prompt for Gemini
                prompt = f"""
                You are {trainer_info['name']}. Your coaching style is {trainer_info['style']}.
                Your voice is {trainer_info['voice']}.
                The user is in the middle of a live workout and says/complains: "{user_msg}".
                Give them a short, highly tailored response (1 to 2 sentences max) in your signature personality.
                Explain what adjustment they should make or provide a blast of motivation.
                """
                
                response_text = await fetch_gemini_api(prompt)
                
                # fallback text if Gemini fails
                if not response_text:
                    if "tired" in user_msg.lower() or "exhausted" in user_msg.lower():
                        if current_trainer == "Serena":
                            response_text = "It is okay to rest. Listen to your body, breathe slowly, and regain your focus."
                        elif current_trainer == "Leo":
                            response_text = "Tired is just a feeling! Push through it! You have 10 seconds left, give me everything!"
                        else:
                            response_text = "Embrace the burn! This is where strength is built. Take a deep breath and complete the set."
                    elif "hurt" in user_msg.lower() or "pain" in user_msg.lower():
                        response_text = "Safety first. If you feel sharp pain, stop immediately, reduce the weight, or shift to a lighter stretch."
                    else:
                        if current_trainer == "Serena":
                            response_text = "Relax your shoulders, focus on your breath, and stay fully in this present moment."
                        elif current_trainer == "Leo":
                            response_text = "Let's keep the intensity high! No slacking, keep moving!"
                        else:
                            response_text = "Focus on the contraction! Make every single rep count!"
                else:
                    # Strip quotes if Gemini added them
                    response_text = response_text.replace('"', '').strip()
                    
                await manager.send_personal_message({
                    "type": "message",
                    "trainer": current_trainer,
                    "sender": "trainer",
                    "message": response_text,
                    "audioText": response_text
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS Exception: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
