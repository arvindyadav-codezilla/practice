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

# Platform-level TextMeBot key (user only provides their number)
PLATFORM_TEXTMEBOT_KEY = os.getenv("TEXTMEBOT_API_KEY", "")

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
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    medicalConditions: Optional[str] = None

class MealPlanRequest(BaseModel):
    goal: str         # e.g., "Lose Weight", "Build Muscle", "Maintain Fitness"
    dietType: str     # e.g., "Balanced", "High Protein", "Keto", "Vegan", "Vegetarian"
    calories: int     # e.g., 2000
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    medicalConditions: Optional[str] = None

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
    role: Optional[str] = "member"
    gymOwnerId: Optional[str] = None
    twilioAccountSid: Optional[str] = None
    twilioAuthToken: Optional[str] = None
    twilioSenderNumber: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    medicalConditions: Optional[str] = None
    isActive: Optional[bool] = None

class WhatsAppBriefRequest(BaseModel):
    userId: str
    workout: Optional[List[dict]] = None
    mealPlan: Optional[dict] = None

class AssignPlanRequest(BaseModel):
    memberId: str
    workoutPlan: Optional[List[dict]] = None
    dietPlan: Optional[dict] = None
    day: Optional[str] = "Monday"

class UpdateAttendanceRequest(BaseModel):
    memberId: str
    status: str  # 'present' or 'absent'
    date: Optional[str] = None

class SendCustomMessageRequest(BaseModel):
    memberId: str
    message: str

class CreateLeadRequest(BaseModel):
    gymOwnerId: str
    name: str
    phoneNumber: str

class UpdateLeadStatusRequest(BaseModel):
    leadId: str
    status: str # 'pending', 'converted', 'not_interested'

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
    
    Here is the member's specific body biometrics context to make it 100% personalized:
    - Age: {req.age or 'Not Specified'}
    - Height: {req.height or 'Not Specified'} cm
    - Weight: {req.weight or 'Not Specified'} kg
    - BMI: {req.bmi or 'Not Specified'}
    - Medical Conditions/Injuries: {req.medicalConditions or 'None'}
    
    CRITICAL INSTRUCTIONS FOR PERSONALIZATION:
    - You must tailor the exercise selections and intensities to match their biometrics. E.g., if weight/BMI is high, avoid joint-straining heavy jumps.
    - If they have any medical conditions or injuries (e.g. knee pain, lower back pain, shoulder injury), you MUST substitute any exercises that strain those areas and give specific recovery-friendly alternatives.
    
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
    
    Here is the member's specific body biometrics context to make it 100% personalized:
    - Age: {req.age or 'Not Specified'}
    - Height: {req.height or 'Not Specified'} cm
    - Weight: {req.weight or 'Not Specified'} kg
    - BMI: {req.bmi or 'Not Specified'}
    - Medical Conditions/Allergies/Injuries: {req.medicalConditions or 'None'}
    
    CRITICAL INSTRUCTIONS FOR PERSONALIZATION:
    - Tailor the meal descriptions, ingredients, macros (Carbs/Protein/Fat), and micros (Fiber/Vitamins) to fit their specific body weight and targets.
    - If they have any medical conditions or food allergies listed, customize the ingredients to avoid allergic foods and accommodate their specific nutritional health needs.
    
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
            "callmebot_key": req.callmebotKey,
            "role": req.role or "member",
            "gym_owner_id": req.gymOwnerId,
            "twilio_account_sid": req.twilioAccountSid,
            "twilio_auth_token": req.twilioAuthToken,
            "twilio_sender_number": req.twilioSenderNumber,
            "age": req.age,
            "height": req.height,
            "weight": req.weight,
            "bmi": req.bmi,
            "medical_conditions": req.medicalConditions
        }
        if req.isActive is not None:
            profile_data["is_active"] = req.isActive
            
        supabase.table("profiles").upsert(profile_data).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Helper: Twilio WhatsApp Dispatcher
def send_twilio_whatsapp(to_number: str, body: str, admin_id: Optional[str] = None) -> dict:
    account_sid = None
    auth_token = None
    from_number = None

    if admin_id and supabase:
        try:
            res = supabase.table("profiles").select("twilio_account_sid, twilio_auth_token, twilio_sender_number").eq("id", admin_id).execute()
            if res.data and len(res.data) > 0:
                p = res.data[0]
                account_sid = p.get("twilio_account_sid")
                auth_token = p.get("twilio_auth_token")
                from_number = p.get("twilio_sender_number")
        except Exception as e:
            print(f"Failed to load dynamic Twilio credentials for admin {admin_id}: {e}")

    # Fallback to system env
    if not account_sid:
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    if not auth_token:
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    if not from_number:
        from_number = os.getenv("TWILIO_SENDER_NUMBER", "whatsapp:+14155238886")

    if not account_sid or not auth_token or "your_twilio" in account_sid:
        print(f"[Twilio Mock] Send to {to_number} (From: {from_number}): {body}")
        return {"status": "mocked", "message": "Twilio not configured. Message logged to console."}
        
    to_formatted = to_number
    if not to_formatted.startswith("whatsapp:"):
        to_formatted = f"whatsapp:{to_formatted}"
        
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    data = {
        "From": from_number,
        "To": to_formatted,
        "Body": body
    }
    
    encoded_data = urllib.parse.urlencode(data).encode("utf-8")
    
    import base64
    auth_string = f"{account_sid}:{auth_token}"
    auth_bytes = auth_string.encode("utf-8")
    base64_auth = base64.b64encode(auth_bytes).decode("utf-8")
    
    headers = {
        "Authorization": f"Basic {base64_auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    try:
        import base64 as _b64
        req_obj = urllib.request.Request(url, data=encoded_data, headers=headers, method="POST")
        with urllib.request.urlopen(req_obj, timeout=15) as response:
            resp_body = response.read().decode("utf-8")
        print(f"[Twilio] Message sent successfully to {to_number}")
        return {"status": "success", "response": json.loads(resp_body)}
    except Exception as e:
        print(f"[Twilio] WhatsApp dispatch failed to {to_number}: {e}")
        return {"status": "error", "message": str(e)}

# HTTP POST Endpoint: Send WhatsApp Brief
@app.post("/api/send-whatsapp-brief")
async def send_whatsapp_brief(req: WhatsAppBriefRequest):
    if not supabase:
        return {"status": "error", "message": "Supabase client not initialized"}
    try:
        res = supabase.table("profiles").select("whatsapp_number", "callmebot_key", "username", "gym_owner_id").eq("id", req.userId).execute()
        if not res.data or len(res.data) == 0:
            return {"status": "error", "message": "User profile not found"}
            
        prof = res.data[0]
        phone = prof.get("whatsapp_number")
        uname = prof.get("username", "Athlete")
        gym_owner_id = prof.get("gym_owner_id")
        
        if not phone:
            return {"status": "error", "message": "WhatsApp number is not configured"}
            
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
            if req.mealPlan.get('Micros'):
                mic = req.mealPlan.get('Micros')
                msg += f"_Micros: Fiber: {mic.get('Fiber', 'N/A')}, Vitamin: {mic.get('Vitamin', 'N/A')}_\n"
                
        msg += "\nStay dedicated! 💪🔥"
        
        # Try Twilio first
        twilio_res = send_twilio_whatsapp(phone, msg, admin_id=gym_owner_id)
        if twilio_res.get("status") == "success":
            return {"status": "success", "provider": "twilio", "response": twilio_res}
            
        # TextMeBot fallback - use user's own key OR platform key from env
        user_key = prof.get("callmebot_key") or ""
        key = user_key if user_key else (f"textmebot:{PLATFORM_TEXTMEBOT_KEY}" if PLATFORM_TEXTMEBOT_KEY else "")
        
        if key:
            encoded_msg = urllib.parse.quote_plus(msg)
            encoded_phone = urllib.parse.quote_plus(str(phone).strip())
            
            if key.startswith("textmebot:"):
                real_key = key.replace("textmebot:", "").strip()
                bot_url = f"https://api.textmebot.com/send.php?recipient={encoded_phone}&apikey={real_key}&text={encoded_msg}"
            else:
                bot_url = f"https://api.callmebot.com/whatsapp.php?phone={encoded_phone}&text={encoded_msg}&apikey={key}"
            
            source = "user_key" if user_key else "platform_key"
            print(f"[TextMeBot] Dispatching to {phone} ({source}) via URL: {bot_url[:80]}...")
            req_bot = urllib.request.Request(bot_url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(req_bot, timeout=15) as bot_resp:
                    resp_data = bot_resp.read().decode('utf-8')
                print(f"[TextMeBot] Response: {resp_data[:200]}")
                return {"status": "success", "provider": f"textmebot_{source}", "response": resp_data}
            except Exception as bot_err:
                print(f"[TextMeBot] Error: {bot_err}")
                return {"status": "error", "message": f"TextMeBot failed: {str(bot_err)}"}
            
        return {"status": "warning", "provider": "mocked", "message": "No WhatsApp provider configured. Add TEXTMEBOT_API_KEY to server env.", "response": twilio_res}
    except Exception as e:
        print(f"Error dispatching WhatsApp brief: {e}")
        return {"status": "error", "message": str(e)}

# ADMIN ROUTES
@app.get("/api/admin/members/{admin_id}")
async def get_admin_members(admin_id: str):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        res = supabase.table("profiles").select("*").eq("gym_owner_id", admin_id).execute()
        return {"status": "success", "members": res.data or []}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/admin/attendance/{admin_id}")
async def get_admin_attendance(admin_id: str):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        import datetime
        today_str = datetime.date.today().isoformat()
        m_res = supabase.table("profiles").select("id, username").eq("gym_owner_id", admin_id).execute()
        members = m_res.data or []
        
        att_res = supabase.table("attendance").select("*").eq("date", today_str).execute()
        att_map = {row["member_id"]: row["status"] for row in (att_res.data or [])}
        
        result = []
        for m in members:
            result.append({
                "memberId": m["id"],
                "username": m["username"],
                "status": att_map.get(m["id"], "absent")
            })
        return {"status": "success", "attendance": result, "date": today_str}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/mark-attendance")
async def mark_attendance(req: UpdateAttendanceRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        import datetime
        date_str = req.date or datetime.date.today().isoformat()
        att_data = {
            "member_id": req.memberId,
            "date": date_str,
            "status": req.status,
            "marked_at": "now()"
        }
        supabase.table("attendance").upsert(att_data).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/assign-plan")
async def assign_plan(req: AssignPlanRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        # Fetch existing plan to perform merge
        existing_res = supabase.table("assigned_plans").select("*").eq("member_id", req.memberId).execute()
        existing_workout = {}
        existing_diet = {}
        
        if existing_res.data and len(existing_res.data) > 0:
            row = existing_res.data[0]
            existing_workout = row.get("workout_plan") or {}
            existing_diet = row.get("diet_plan") or {}
            
            # If they are stored as flat structures, migrate to dict format
            if not isinstance(existing_workout, dict):
                existing_workout = {"Monday": existing_workout}
            if not isinstance(existing_diet, dict):
                existing_diet = {"Monday": existing_diet}
                
        day = req.day or "Monday"
        existing_workout[day] = req.workoutPlan
        existing_diet[day] = req.dietPlan
        
        plan_data = {
            "member_id": req.memberId,
            "workout_plan": existing_workout,
            "diet_plan": existing_diet,
            "updated_at": "now()"
        }
        supabase.table("assigned_plans").upsert(plan_data).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/member/assigned-plan/{member_id}")
async def get_member_assigned_plan(member_id: str):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        res = supabase.table("assigned_plans").select("*").eq("member_id", member_id).execute()
        if res.data and len(res.data) > 0:
            return {"status": "success", "plan": res.data[0]}
        return {"status": "not_found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ToggleActiveRequest(BaseModel):
    userId: str
    isActive: bool

# SUPER ADMIN APIS
@app.get("/api/superadmin/gyms")
async def get_superadmin_gyms():
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        res = supabase.table("profiles").select("*").execute()
        profiles = res.data or []
        gym_owners = [p for p in profiles if p.get("role") == "admin"]
        gym_members = [p for p in profiles if p.get("role") == "member"]
        super_admins = [p for p in profiles if p.get("role") == "super_admin"]
        return {
            "status": "success", 
            "gymOwners": gym_owners, 
            "gymMembers": gym_members,
            "superAdmins": super_admins
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/superadmin/toggle-active")
async def superadmin_toggle_active(req: ToggleActiveRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        supabase.table("profiles").update({"is_active": req.isActive}).eq("id", req.userId).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# LEAD ENQUIRIES APIS
@app.get("/api/admin/leads/{admin_id}")
async def get_admin_leads(admin_id: str):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        res = supabase.table("leads").select("*").eq("gym_owner_id", admin_id).execute()
        return {"status": "success", "leads": res.data or []}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/leads")
async def create_lead(req: CreateLeadRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        lead_data = {
            "gym_owner_id": req.gymOwnerId,
            "name": req.name,
            "phone_number": req.phoneNumber,
            "status": "pending"
        }
        res = supabase.table("leads").insert(lead_data).execute()
        
        # Trigger an initial human-like greetings message!
        try:
            msg = f"Hi {req.name}! Raj here from the gym. Thanks for visiting us and checking out the packages today! Let me know if you have any questions or want to try out a free session. (You can reply 'stop' or 'not interested' at any time to opt-out of my check-ins!)"
            send_twilio_whatsapp(req.phoneNumber, msg, admin_id=req.gymOwnerId)
        except Exception as msg_err:
            print(f"Error sending welcome lead message: {msg_err}")
            
        return {"status": "success", "lead": res.data[0] if res.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/leads/update-status")
async def update_lead_status(req: UpdateLeadStatusRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        supabase.table("leads").update({"status": req.status}).eq("id", req.leadId).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class BroadcastRequest(BaseModel):
    gymOwnerId: str
    message: str

@app.get("/api/admin/analytics/{admin_id}")
async def get_admin_analytics(admin_id: str):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        # Fetch all profiles linked to this owner
        m_res = supabase.table("profiles").select("id").eq("gym_owner_id", admin_id).execute()
        member_ids = [m["id"] for m in (m_res.data or [])]
        
        if not member_ids:
            return {
                "status": "success",
                "peakHours": {},
                "weeklyAttendance": {}
            }
            
        # Fetch all attendance logs
        att_res = supabase.table("attendance").select("*").in_("member_id", member_ids).execute()
        logs = att_res.data or []
        
        # Group by hour
        peak_hours = {}
        for log in logs:
            marked_at = log.get("marked_at")
            if marked_at:
                try:
                    hour_str = marked_at.split("T")[1].split(":")[0]
                    hour_val = int(hour_str)
                    hour_val = (hour_val + 5) % 24 # shift for Indian Standard Time (+5:30 approx)
                    hour_label = f"{hour_val:02d}:00"
                    peak_hours[hour_label] = peak_hours.get(hour_label, 0) + 1
                except:
                    pass
                    
        # Group weekly attendance (past 7 dates)
        weekly_att = {}
        for log in logs:
            date_str = log.get("date")
            if date_str:
                weekly_att[date_str] = weekly_att.get(date_str, 0) + 1
                
        return {
            "status": "success",
            "peakHours": peak_hours,
            "weeklyAttendance": weekly_att
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/broadcast")
async def broadcast_announcement(req: BroadcastRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        m_res = supabase.table("profiles").select("whatsapp_number").eq("gym_owner_id", req.gymOwnerId).execute()
        members = m_res.data or []
        sent_count = 0
        for m in members:
            phone = m.get("whatsapp_number")
            if phone:
                try:
                    send_twilio_whatsapp(phone, req.message, admin_id=req.gymOwnerId)
                    sent_count += 1
                except Exception as sms_err:
                    print(f"Failed to send broadcast to {phone}: {sms_err}")
        return {"status": "success", "sentCount": sent_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/send-custom-whatsapp")
async def send_custom_whatsapp(req: SendCustomMessageRequest):
    if not supabase:
        return {"status": "error", "message": "Offline mode"}
    try:
        p_res = supabase.table("profiles").select("whatsapp_number, gym_owner_id, callmebot_key").eq("id", req.memberId).execute()
        if not p_res.data or len(p_res.data) == 0:
            return {"status": "error", "message": "Member not found"}
        phone = p_res.data[0].get("whatsapp_number")
        owner_id = p_res.data[0].get("gym_owner_id")
        bot_key = p_res.data[0].get("callmebot_key")
        if not phone:
            return {"status": "error", "message": "Member does not have a WhatsApp number configured"}
        
        # Try Twilio first
        twilio_res = send_twilio_whatsapp(phone, req.message, admin_id=owner_id)
        if twilio_res.get("status") == "success":
            return {"status": "success", "provider": "twilio", "detail": twilio_res}
        
        # Fallback: TextMeBot / CallMeBot
        if bot_key:
            encoded_msg = urllib.parse.quote_plus(req.message)
            if bot_key.startswith("textmebot:"):
                real_key = bot_key.replace("textmebot:", "").strip()
                bot_url = f"https://api.textmebot.com/send.php?recipient={phone}&apikey={real_key}&text={encoded_msg}"
            else:
                bot_url = f"https://api.callmebot.com/whatsapp.php?phone={phone}&text={encoded_msg}&apikey={bot_key}"
            bot_req = urllib.request.Request(bot_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(bot_req, timeout=10) as bot_resp:
                bot_data = bot_resp.read().decode("utf-8")
            return {"status": "success", "provider": "textmebot_fallback", "detail": bot_data}
        
        return {"status": "warning", "message": "Twilio not configured and no bot key found. Message not delivered.", "detail": twilio_res}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# TWILIO INBOUND INTERACTIVE WEBHOOK
from fastapi import Request
@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    if not supabase:
        return {"status": "error", "message": "Offline"}
    try:
        body_bytes = await request.body()
        body_str = body_bytes.decode("utf-8")
        params = urllib.parse.parse_qs(body_str)
        
        from_sender = params.get("From", [""])[0]
        message_body = params.get("Body", [""])[0]
        
        if not from_sender or not message_body:
            return {"status": "error", "message": "Invalid webhook payload"}
            
        clean_phone = from_sender.replace("whatsapp:", "").strip()
        
        prof_res = supabase.table("profiles").select("*").execute()
        profile = None
        if prof_res.data:
            for p in prof_res.data:
                db_phone = str(p.get("whatsapp_number", "")).strip()
                if db_phone and (clean_phone.endswith(db_phone) or db_phone.endswith(clean_phone)):
                    profile = p
                    break
                    
        if not profile:
            # Check if this phone number is registered in leads
            leads_res = supabase.table("leads").select("*").eq("status", "pending").execute()
            lead = None
            if leads_res.data:
                for l in leads_res.data:
                    db_phone = str(l.get("phone_number", "")).strip()
                    if db_phone and (clean_phone.endswith(db_phone) or db_phone.endswith(clean_phone)):
                        lead = l
                        break
            
            if lead:
                owner_active = True
                if lead.get("gym_owner_id"):
                    o_res = supabase.table("profiles").select("is_active").eq("id", lead["gym_owner_id"]).execute()
                    if o_res.data and len(o_res.data) > 0:
                        owner_active = o_res.data[0].get("is_active", True)
                if not owner_active:
                    return {"status": "gym_suspended", "message": "Gym owner's account is suspended."}

                clean_msg = message_body.strip().lower()
                if any(x in clean_msg for x in ["not interested", "no thanks", "stop", "don't message", "unsubscribed", "opt out", "no"]):
                    try:
                        supabase.table("leads").update({"status": "not_interested"}).eq("id", lead["id"]).execute()
                    except Exception as upd_err:
                        print(f"Failed to update lead status: {upd_err}")
                    reply = f"No problem at all, {lead['name']}! I've updated my system and you won't receive any more follow-up messages from us. Have a great day!"
                    send_twilio_whatsapp(clean_phone, reply, admin_id=lead["gym_owner_id"])
                    return {"status": "lead_opt_out", "reply": reply}
                
                # Chat with lead using Gemini Sales Persona
                prompt = f"""
                You are Raj, the warm, polite, and highly helpful Sales Manager at a premium Gym.
                You are currently chatting on WhatsApp with a prospective lead named {lead['name']} who visited the gym for an enquiry.
                
                Lead's WhatsApp message: "{message_body}"
                
                Respond to their question, package enquiry, or query about facilities in a highly natural, human-like, friendly manner (max 2-3 sentences).
                Do not sound like a machine. Avoid formal business structures. Be encouraging, warm, and offer a free trial session if they show interest.
                Keep it whatsapp friendly. Note: if they say they are not interested, they can just reply 'stop' or 'not interested' to opt-out.
                """
                reply = await fetch_gemini_api(prompt)
                if not reply:
                    reply = f"Hey {lead['name']}, let me know if you want to swing by for a free workout trial! Or reply with any questions about packages. I'm here to help! - Raj"
                
                send_twilio_whatsapp(clean_phone, reply, admin_id=lead["gym_owner_id"])
                return {"status": "lead_chat", "reply": reply}
                
            reply = "Welcome to FlexAI! Please register on our website: https://frontend-three-pied-13.vercel.app and update your WhatsApp number in your profile settings to start chatting with your AI Trainer."
            send_twilio_whatsapp(clean_phone, reply)
            return {"status": "unregistered"}
            
        user_id = profile["id"]
        username = profile["username"]

        if profile.get("is_active") is False:
            reply = "🚨 Your account is currently deactivated. Please contact support."
            send_twilio_whatsapp(clean_phone, reply, admin_id=profile.get("gym_owner_id"))
            return {"status": "suspended", "reply": reply}
            
        owner_active = True
        if profile.get("gym_owner_id"):
            o_res = supabase.table("profiles").select("is_active").eq("id", profile["gym_owner_id"]).execute()
            if o_res.data and len(o_res.data) > 0:
                owner_active = o_res.data[0].get("is_active", True)
                
        if not owner_active:
            reply = "🚨 Your gym's subscription is currently suspended. Please ask your trainer to contact support."
            send_twilio_whatsapp(clean_phone, reply, admin_id=profile.get("gym_owner_id"))
            return {"status": "suspended", "reply": reply}

        # Check for check-in keyword triggers
        clean_msg = message_body.strip().lower()
        if clean_msg in ["in", "checkin", "check in", "present", "gym", "gym checkin"]:
            import datetime
            today_str = datetime.date.today().isoformat()
            att_data = {
                "member_id": user_id,
                "date": today_str,
                "status": "present",
                "marked_at": "now()"
            }
            try:
                supabase.table("attendance").upsert(att_data).execute()
            except Exception as att_err:
                print(f"Attendance save error: {att_err}")
                
            assigned_plan = None
            try:
                plan_res = supabase.table("assigned_plans").select("*").eq("member_id", user_id).execute()
                if plan_res.data and len(plan_res.data) > 0:
                    assigned_plan = plan_res.data[0]
            except Exception as plan_err:
                print(f"Plan load error in check-in webhook: {plan_err}")
                
            reply = f"✅ *FlexAI Attendance Marked!*\n\nWelcome back, {username}! Your attendance for today has been logged.\n\n"
            if assigned_plan:
                import datetime
                current_day = datetime.datetime.now().strftime("%A") # e.g. "Monday"
                
                full_workout = assigned_plan.get("workout_plan", {})
                full_diet = assigned_plan.get("diet_plan", {})
                
                workout = []
                if isinstance(full_workout, dict):
                    workout = full_workout.get(current_day, [])
                else:
                    workout = full_workout # fallback for legacy list format
                    
                meal_plan = {}
                if isinstance(full_diet, dict):
                    meal_plan = full_diet.get(current_day, {})
                else:
                    meal_plan = full_diet # fallback for legacy flat dict
                    
                reply += f"🏋️ *TODAY'S WORKOUT PLAN ({current_day}):*\n"
                if not workout:
                    reply += "_No workout routine assigned for today. Enjoy your rest day or ask your trainer!_\n"
                else:
                    for idx, ex in enumerate(workout):
                        reply += f"{idx+1}. {ex.get('name')} ({ex.get('duration')}s active) - _Tip: {ex.get('tip')}_\n"
                
                reply += f"\n🥗 *TODAY'S DIET PLAN ({current_day}):*\n"
                if not meal_plan or (not meal_plan.get("Breakfast") and not meal_plan.get("Lunch")):
                    reply += "_No custom diet sheet preloaded for today. Stick to healthy choices or contact your trainer!_\n"
                else:
                    reply += f"🍳 Breakfast: {meal_plan.get('Breakfast', 'N/A')}\n"
                    reply += f"🥗 Lunch: {meal_plan.get('Lunch', 'N/A')}\n"
                    reply += f"🍎 Snack: {meal_plan.get('Snack', 'N/A')}\n"
                    reply += f"🥩 Dinner: {meal_plan.get('Dinner', 'N/A')}\n"
                    if meal_plan.get('Macros'):
                        mac = meal_plan.get('Macros')
                        reply += f"_Macros: Carbs: {mac.get('Carbs')}, Protein: {mac.get('Protein')}, Fat: {mac.get('Fat')}_\n"
                    if meal_plan.get('Micros'):
                        mic = meal_plan.get('Micros')
                        reply += f"_Micros: Fiber: {mic.get('Fiber', 'N/A')}, Vitamin: {mic.get('Vitamin', 'N/A')}_\n"
            else:
                reply += "Ask your trainer to assign you a customized plan for today, or reply with your queries to chat with your AI Gym Coach!"
                
            send_twilio_whatsapp(clean_phone, reply, admin_id=profile.get("gym_owner_id"))
            return {"status": "success", "checkin": True, "reply": reply}
            
        assigned_plan = None
        plan_res = supabase.table("assigned_plans").select("*").eq("member_id", user_id).execute()
        if plan_res.data and len(plan_res.data) > 0:
            assigned_plan = plan_res.data[0]
            
        trainer_pref = profile.get("goal", "Build Muscle")
        trainer = "Max"
        if "Yoga" in trainer_pref or "Mindfulness" in trainer_pref:
            trainer = "Serena"
        elif "HIIT" in trainer_pref or "Cardio" in trainer_pref:
            trainer = "Leo"
            
        trainer_info = TRAINER_PERSONAS.get(trainer, TRAINER_PERSONAS["Max"])
        
        history = []
        hist_res = supabase.table("whatsapp_chat_history").select("messages").eq("phone_number", clean_phone).execute()
        if hist_res.data and len(hist_res.data) > 0:
            history = hist_res.data[0].get("messages", [])
            
        history_text = ""
        for h in history[-8:]:
            role_name = "Member" if h.get("role") == "user" else "Coach"
            history_text += f"{role_name}: {h.get('content')}\n"
            
        prompt = f"""
        You are {trainer_info['name']}, the AI Gym Coach for the member {username}.
        Your coaching style is {trainer_info['style']}.
        
        Here is their detailed profile info:
        - Goal: {profile.get('goal', 'Fitness')}
        - Level: {profile.get('level', 'Intermediate')}
        - Equipment available: {profile.get('equipment', 'Full Gym')}
        - Age: {profile.get('age', 'Not specified')}
        - Height: {profile.get('height', 'Not specified')} cm
        - Weight: {profile.get('weight', 'Not specified')} kg
        - BMI: {profile.get('bmi', 'Not specified')}
        - Medical Conditions/Injuries: {profile.get('medical_conditions', 'None')}

        CRITICAL DIRECTION FOR PRIVATE COACH EMULATOR:
        - Act as their 1-on-1 private trainer who cares ONLY about their health, safety, and goals. 
        - Refer to their specific weight, height, or goals if they ask general fitness questions. E.g. give customized advice for their BMI category.
        - If they mention pain or ask about exercises, cross-reference their "Medical Conditions/Injuries" (e.g. {profile.get('medical_conditions', 'None')}) to tell them what to avoid or keep them safe.
        - Do not give generic copy-pasted responses. Speak directly to {username}.
        """
        if assigned_plan:
            import datetime
            current_day = datetime.datetime.now().strftime("%A")
            full_workout = assigned_plan.get("workout_plan", {})
            full_diet = assigned_plan.get("diet_plan", {})
            
            workout = []
            if isinstance(full_workout, dict):
                workout = full_workout.get(current_day, [])
            else:
                workout = full_workout
                
            meal_plan = {}
            if isinstance(full_diet, dict):
                meal_plan = full_diet.get(current_day, {})
            else:
                meal_plan = full_diet
                
            prompt += f"""
            Here is their ASSIGNED PLAN for today ({current_day}):
            - Workout exercises: {json.dumps(workout)}
            - Diet & Meals: {json.dumps(meal_plan)}
            """
        prompt += f"""
        Conversation History:
        {history_text}
        
        Member's new message on WhatsApp: "{message_body}"
        
        Provide a concise, helpful response (2 to 4 sentences max) in your signature personality.
        Explain exercises, correct their form, offer nutritional guidance (quantities, fiber, vitamins, macros), or motivate them. Do not use markdown headers, keep it whatsapp friendly (can use bold *text* and italic _text_).
        """
        
        reply = await fetch_gemini_api(prompt)
        if not reply:
            reply = "Let's keep pushing! Focus on your form and breath. Let me know if you need any workout or meal plan adjustments! 💪"
        else:
            reply = reply.replace('"', '').strip()
            
        history.append({"role": "user", "content": message_body})
        history.append({"role": "assistant", "content": reply})
        
        supabase.table("whatsapp_chat_history").upsert({
            "phone_number": clean_phone,
            "messages": history,
            "updated_at": "now()"
        }).execute()
        
        send_twilio_whatsapp(clean_phone, reply, admin_id=profile.get("gym_owner_id"))
        return {"status": "success", "reply": reply}
    except Exception as e:
        print(f"Error in WhatsApp webhook: {e}")
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
                        user_id = prof.get("id")
                        username = prof.get("username", "Athlete")
                        role = prof.get("role", "member")
                        
                        if phone and role == "member":
                            if prof.get("is_active") is False:
                                continue
                            owner_active = True
                            if prof.get("gym_owner_id"):
                                o_res = supabase.table("profiles").select("is_active").eq("id", prof["gym_owner_id"]).execute()
                                if o_res.data and len(o_res.data) > 0:
                                    owner_active = o_res.data[0].get("is_active", True)
                            if not owner_active:
                                continue

                            import datetime
                            today_str = datetime.date.today().isoformat()
                            
                            # Check attendance for today
                            att_res = supabase.table("attendance").select("status").eq("member_id", user_id).eq("date", today_str).execute()
                            is_absent = False
                            if att_res.data and len(att_res.data) > 0:
                                if att_res.data[0].get("status") == "absent":
                                    is_absent = True
                            
                            if is_absent:
                                trainer_pref = prof.get("goal", "Build Muscle")
                                trainer = "Max"
                                if "Yoga" in trainer_pref or "Mindfulness" in trainer_pref:
                                    trainer = "Serena"
                                elif "HIIT" in trainer_pref or "Cardio" in trainer_pref:
                                    trainer = "Leo"
                                    
                                trainer_info = TRAINER_PERSONAS.get(trainer, TRAINER_PERSONAS["Max"])
                                prompt = f"Write a short, powerful motivational message (1 to 2 sentences) from {trainer_info['name']} (style: {trainer_info['style']}) to a client named {username} who missed the gym today. Do not use headers. Keep it raw text."
                                mot_msg = await fetch_gemini_api(prompt)
                                if not mot_msg:
                                    mot_msg = f"Hey {username}, we missed you today! Rest up, but remember: consistency is key. Let's crush it tomorrow! - {trainer_info['name']} 💪"
                                send_twilio_whatsapp(phone, f"🚨 *Gym Alert* 🚨\n\n{mot_msg.strip()}", admin_id=prof.get("gym_owner_id"))
                            else:
                                plan_res = supabase.table("assigned_plans").select("*").eq("member_id", user_id).execute()
                                if plan_res.data and len(plan_res.data) > 0:
                                    plan = plan_res.data[0]
                                    workout = plan.get("workout_plan", [])
                                    meal_plan = plan.get("diet_plan", {})
                                    
                                    msg = f"⚡ *FlexAI Daily Gym Briefing* ⚡\n\nHello {username}!\nHere is your custom routine assigned by your trainer:\n\n"
                                    if workout:
                                        msg += "*🏋️ WORKOUT PLAN:*\n"
                                        for idx, ex in enumerate(workout):
                                            msg += f"{idx+1}. {ex.get('name')} ({ex.get('duration')}s active) - _Tip: {ex.get('tip')}_\n"
                                        msg += "\n"
                                    if meal_plan:
                                        msg += "*🥗 DIET PLAN:*\n"
                                        msg += f"🍳 Breakfast: {meal_plan.get('Breakfast', 'N/A')}\n"
                                        msg += f"🥗 Lunch: {meal_plan.get('Lunch', 'N/A')}\n"
                                        msg += f"🍎 Snack: {meal_plan.get('Snack', 'N/A')}\n"
                                        msg += f"🥩 Dinner: {meal_plan.get('Dinner', 'N/A')}\n"
                                        if meal_plan.get('Macros'):
                                            mac = meal_plan.get('Macros')
                                            msg += f"_Macros: Carbs: {mac.get('Carbs')}, Protein: {mac.get('Protein')}, Fat: {mac.get('Fat')}_\n"
                                        if meal_plan.get('Micros'):
                                            mic = meal_plan.get('Micros')
                                            msg += f"_Micros: Fiber: {mic.get('Fiber', 'N/A')}, Vitamin: {mic.get('Vitamin', 'N/A')}_\n"
                                    msg += "\nKeep pushing and stay dedicated! 💪🔥"
                                    send_twilio_whatsapp(phone, msg, admin_id=prof.get("gym_owner_id"))
                                else:
                                    msg = f"⚡ *FlexAI Daily Morning Reminder* ⚡\n\nRise and shine, {username}!\nTime to smash your daily workout. Open the app to launch your coaching player: https://frontend-three-pied-13.vercel.app 🏃🔥"
                                    send_twilio_whatsapp(phone, msg, admin_id=prof.get("gym_owner_id"))
            except Exception as e:
                print(f"Scheduler exception: {e}")
        await asyncio.sleep(86400) # Run once every 24 hours

async def daily_lead_followup_scheduler():
    await asyncio.sleep(20) # Startup offset to prevent dual lock
    while True:
        print("[Scheduler] Running automated sales lead follow-ups...")
        if supabase:
            try:
                res = supabase.table("leads").select("*").eq("status", "pending").execute()
                if res.data:
                    for lead in res.data:
                        owner_id = lead.get("gym_owner_id")
                        owner_active = True
                        if owner_id:
                            o_res = supabase.table("profiles").select("is_active").eq("id", owner_id).execute()
                            if o_res.data and len(o_res.data) > 0:
                                owner_active = o_res.data[0].get("is_active", True)
                        if not owner_active:
                            continue

                        name = lead.get("name")
                        phone = lead.get("phone_number")
                        
                        prompt = f"""
                        You are Raj, the warm, friendly, and highly polite Sales Manager at a premium Gym.
                        Write a short, hyper-natural follow-up WhatsApp message (1 to 2 sentences) to a prospect named {name} who recently visited the gym for an enquiry.
                        Keep it extremely casual, warm, and human-like. Avoid bot-like structures or standard sales copy. Ask if they have any questions or would like to book a free trial session this week.
                        Include a polite note that they can reply 'stop' or 'not interested' if they don't want to get further follow-ups.
                        """
                        followup_msg = await fetch_gemini_api(prompt)
                        if not followup_msg:
                            followup_msg = f"Hi {name}! Raj here from the gym. Just checking in to see if you had any questions about the membership plans we discussed? Let know if you want to drop by for a free trial workout! (Reply 'stop' if you wish to opt-out)"
                            
                        send_twilio_whatsapp(phone, followup_msg.strip(), admin_id=owner_id)
                        
                        # Update lead followup date
                        try:
                            supabase.table("leads").update({"last_followup_at": "now()"}).eq("id", lead["id"]).execute()
                        except Exception as upd_err:
                            print(f"Failed to save last followup date: {upd_err}")
            except Exception as e:
                print(f"Lead follow-up scheduler error: {e}")
        await asyncio.sleep(86400) # Run once every 24 hours

@app.on_event("startup")
async def start_scheduler():
    asyncio.create_task(daily_whatsapp_scheduler())
    asyncio.create_task(daily_lead_followup_scheduler())

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
