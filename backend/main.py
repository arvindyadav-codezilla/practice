from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import datetime
import asyncio
import os
import urllib.request
import urllib.parse
import random
import re
import xml.etree.ElementTree as ET
import html
from typing import Dict, Set, List
from dotenv import load_dotenv

# Load environment variables from .env file (git ignored)
load_dotenv()

app = FastAPI(title="Group Chat WebSocket Server with AI Agent")

# Allow CORS for local Next.js client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI Helper functions
def get_smart_fallback_response(prompt: str, history: List[dict]) -> str:
    prompt_lower = prompt.lower().strip()
    
    # Strip the trigger prefix
    for prefix in ["@nova", "@ai"]:
        if prompt_lower.startswith(prefix):
            prompt_lower = prompt_lower[len(prefix):].strip()
            
    if not prompt_lower or "help" in prompt_lower:
        return (
            "👋 Hi! I am **Nova AI**, your resident assistant.\n\n"
            "Here is what I can do locally:\n"
            "- `@nova joke` : Tell an awesome programmer joke.\n"
            "- `@nova quote` : Show an inspiring quote.\n"
            "- `@nova summarize` : Summarize the latest chat history in this room.\n"
            "- `@nova stats` : Check current chat statistics.\n"
            "- `@nova draw <prompt>` : Generate a cool AI image for free!\n\n"
            "💡 *Tip: To enable full conversational AI, start the server with the `GEMINI_API_KEY` environment variable.*"
        )
    elif "joke" in prompt_lower:
        jokes = [
            "Why do programmers wear glasses? Because they can't C#! 😂",
            "There are 10 types of people in this world: Those who understand binary, and those who don't.",
            "How many programmers does it take to change a light bulb? None, that's a hardware problem!",
            "['hip', 'hip'] (hip hip array!) 🤖",
            "A SQL query walks into a bar, walks up to two tables and asks, 'Can I join you?'"
        ]
        return random.choice(jokes)
    elif "quote" in prompt_lower:
        quotes = [
            "“Talk is cheap. Show me the code.” — Linus Torvalds",
            "“Programs must be written for people to read, and only incidentally for machines to execute.” — Harold Abelson",
            "“Simplicity is the ultimate sophistication.” — Leonardo da Vinci",
            "“The best way to predict the future is to invent it.” — Alan Kay"
        ]
        return random.choice(quotes)
    elif "stats" in prompt_lower:
        return (
            "📊 **Synapse Chat Stats:**\n"
            f"- Status: Active\n"
            f"- Engine: Python FastAPI WebSockets\n"
            f"- Context Retention: 20 messages limit"
        )
    elif "summarize" in prompt_lower:
        text_messages = [msg for msg in history if msg.get("type") == "message"]
        if not text_messages:
            return "📝 **Room Summary:** The chat just started. There are no messages to summarize yet!"
        
        summary = "📝 **Room Summary:**\n"
        summary += f"We have recorded {len(text_messages)} messages recently. "
        senders = list(set(msg.get("username", "Unknown") for msg in text_messages))
        summary += f"Contributors: {', '.join(senders)}.\n"
        summary += "Discussion highlights include:\n"
        for msg in text_messages[-4:]:
            summary += f"- **{msg['username']}** said: \"{msg['text']}\"\n"
        return summary
    else:
        return (
            f"🤖 I heard: *\"{prompt}\"*!\n\n"
            "To unlock full AI capabilities, set the `GEMINI_API_KEY` environment variable. "
            "Type `@nova help` to view local offline commands."
        )

async def generate_ai_response(prompt: str, history: List[dict]) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return get_smart_fallback_response(prompt, history)
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    # Format message history to give context to Gemini
    context = "You are Nova AI, an intelligent agent in a group chat room named Synapse. Keep responses concise (max 3 sentences), highly engaging, and use markdown. Here is the recent chat history for context:\n"
    for msg in history[-10:]:
        if msg.get("type") == "message":
            context += f"[{msg.get('username')}]: {msg.get('text')}\n"
            
    context += f"\nUser Prompt: {prompt}\nNova AI Reply:"
    
    data = {
        "contents": [{
            "parts": [{"text": context}]
        }]
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        
        # Call the API asynchronously to avoid blocking the main server thread
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, timeout=8).read())
        res_json = json.loads(response.decode("utf-8"))
        return res_json["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"Gemini API error: {e}")
        return f"Sorry, I hit an error connecting to Gemini: {str(e)}. Falling back:\n\n{get_smart_fallback_response(prompt, history)}"


class ChatManager:
    def __init__(self):
        # Maps room_name -> set of active WebSocket connections
        self.room_connections: Dict[str, Set[WebSocket]] = {}
        # Maps WebSocket -> username
        self.ws_to_user: Dict[WebSocket, str] = {}
        # Maps WebSocket -> room_name
        self.ws_to_room: Dict[WebSocket, str] = {}
        # Maps room_name -> List of chat history dicts (limited to 20)
        self.room_history: Dict[str, List[dict]] = {}
        # Maps room_name -> Dict[poll_id -> poll_details]
        self.room_polls: Dict[str, Dict[str, dict]] = {}
        # Maps room_name -> Dict[game_type -> game_data]
        self.room_games: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    async def disconnect(self, websocket: WebSocket):
        room = self.ws_to_room.get(websocket)
        username = self.ws_to_user.get(websocket)
        
        # Clean up mappings
        if websocket in self.ws_to_user:
            del self.ws_to_user[websocket]
        if websocket in self.ws_to_room:
            del self.ws_to_room[websocket]
            
        if room and room in self.room_connections:
            if websocket in self.room_connections[room]:
                self.room_connections[room].remove(websocket)
            if not self.room_connections[room]:
                del self.room_connections[room]
                # Keep history clean
                if room in self.room_history:
                    del self.room_history[room]
                if room in self.room_polls:
                    del self.room_polls[room]
                if room in self.room_games:
                    del self.room_games[room]
                
        # Notify remaining users in the room
        if room and username:
            system_msg = {
                "type": "system",
                "content": f"{username} left the chat.",
                "users": self.get_room_users(room),
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
            }
            self.save_to_history(room, system_msg)
            await self.broadcast_to_room(room, system_msg)

    async def join_room(self, room: str, username: str, websocket: WebSocket):
        self.ws_to_user[websocket] = username
        self.ws_to_room[websocket] = room
        
        if room not in self.room_connections:
            self.room_connections[room] = set()
        self.room_connections[room].add(websocket)
        
        # Send room history to the newly connected user first
        history = self.room_history.get(room, [])
        for msg in history:
            try:
                await websocket.send_json(msg)
            except Exception:
                pass
                
        # Send current games state
        room_state = self.room_games.get(room)
        if room_state:
            try:
                await websocket.send_json({
                    "type": "games_sync",
                    "synth": room_state.get("synth", [[0 for _ in range(8)] for _ in range(8)]),
                    "racer_snippet": room_state.get("racer", {}).get("snippet"),
                    "trivia_active": "trivia" in room_state
                })
            except Exception:
                pass
        
        system_msg = {
            "type": "system",
            "content": f"{username} joined the chat!",
            "users": self.get_room_users(room),
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
        self.save_to_history(room, system_msg)
        await self.broadcast_to_room(room, system_msg)

    def get_room_users(self, room: str) -> List[str]:
        # Always inject "Nova AI ✨" as a virtual room member
        users = ["Nova AI ✨"]
        if room in self.room_connections:
            users.extend([self.ws_to_user[ws] for ws in self.room_connections[room] if ws in self.ws_to_user])
        return users

    def save_to_history(self, room: str, msg: dict):
        if room not in self.room_history:
            self.room_history[room] = []
        self.room_history[room].append(msg)
        # Limit to 20 messages
        if len(self.room_history[room]) > 20:
            self.room_history[room].pop(0)

    async def broadcast_to_room(self, room: str, message: dict):
        if room in self.room_connections:
            for connection in list(self.room_connections[room]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def send_typing_status(self, room: str, username: str, is_typing: bool, sender_ws: WebSocket = None):
        if room in self.room_connections:
            for connection in self.room_connections[room]:
                if sender_ws is None or connection != sender_ws:
                    try:
                        await connection.send_json({
                            "type": "typing",
                            "username": username,
                            "isTyping": is_typing
                        })
                    except Exception:
                        pass

    async def handle_ai_agent(self, room: str, prompt: str):
        # Trigger typing indicator for Nova AI
        await self.send_typing_status(room, "Nova AI ✨", True)
        
        # Parse for draw/image generation command
        prompt_clean = prompt.strip()
        for prefix in ["@nova", "@ai"]:
            if prompt_clean.lower().startswith(prefix):
                prompt_clean = prompt_clean[len(prefix):].strip()
        
        prompt_clean_lower = prompt_clean.lower()
        is_draw = False
        draw_prompt = ""
        
        if prompt_clean_lower.startswith("draw ") or prompt_clean_lower.startswith("paint ") or prompt_clean_lower.startswith("generate image of "):
            is_draw = True
            if prompt_clean_lower.startswith("draw "):
                draw_prompt = prompt_clean[len("draw "):].strip()
            elif prompt_clean_lower.startswith("paint "):
                draw_prompt = prompt_clean[len("paint "):].strip()
            else:
                draw_prompt = prompt_clean[len("generate image of "):].strip()

        if is_draw and draw_prompt:
            # Generate AI Image using Pollinations.ai (free & no auth)
            encoded_prompt = urllib.parse.quote(draw_prompt)
            seed = random.randint(1, 999999)
            image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true&private=true&seed={seed}"
            
            # Simulate thinking delay
            await asyncio.sleep(1.5)
            await self.send_typing_status(room, "Nova AI ✨", False)
            
            ai_msg = {
                "type": "message",
                "username": "Nova AI ✨",
                "text": f"🎨 Here is your generated image for: **\"{draw_prompt}\"**",
                "mediaUrl": image_url,
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
            }
            self.save_to_history(room, ai_msg)
            await self.broadcast_to_room(room, ai_msg)
            return

        # Simulate thinking delay (and API call latency)
        history = self.room_history.get(room, [])
        ai_reply = await generate_ai_response(prompt, history)
        await asyncio.sleep(1.2)
        
        # Stop typing indicator
        await self.send_typing_status(room, "Nova AI ✨", False)
        
        # Broadcast AI message
        ai_msg = {
            "type": "message",
            "username": "Nova AI ✨",
            "text": ai_reply,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
        self.save_to_history(room, ai_msg)
        await self.broadcast_to_room(room, ai_msg)


manager = ChatManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            room = manager.ws_to_room.get(websocket)
            username = manager.ws_to_user.get(websocket)
            
            if msg_type == "join":
                room = message.get("room")
                username = message.get("username")
                if room and username:
                    await manager.join_room(room, username, websocket)
                    
            elif msg_type == "message":
                text = message.get("text")
                if room and username and text:
                    user_msg = {
                        "type": "message",
                        "username": username,
                        "text": text,
                        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                    }
                    manager.save_to_history(room, user_msg)
                    await manager.broadcast_to_room(room, user_msg)
                    
                    # Intercept message to see if it's addressing the AI agent
                    text_lower = text.lower().strip()
                    if text_lower.startswith("@nova") or text_lower.startswith("@ai"):
                        # Launch AI task in background to keep WebSocket loop responsive
                        asyncio.create_task(manager.handle_ai_agent(room, text))
                    
            elif msg_type == "typing":
                is_typing = message.get("isTyping", False)
                if room and username:
                    await manager.send_typing_status(room, username, is_typing, websocket)
                    
            elif msg_type == "draw":
                if room:
                    # Broadcast draw event to everyone except the sender
                    for connection in list(manager.room_connections.get(room, [])):
                        if connection != websocket:
                            try:
                                await connection.send_json(message)
                            except Exception:
                                pass
                                
            elif msg_type == "clear_canvas":
                if room:
                    await manager.broadcast_to_room(room, message)
                    
            elif msg_type == "poll":
                poll_id = message.get("pollId")
                question = message.get("question")
                options_input = message.get("options", [])
                if room and username and poll_id and question and options_input:
                    options = [{"option": opt, "votes": 0} for opt in options_input]
                    poll_msg = {
                        "type": "poll",
                        "username": username,
                        "pollId": poll_id,
                        "question": question,
                        "options": options,
                        "voters": {},
                        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                    }
                    if room not in manager.room_polls:
                        manager.room_polls[room] = {}
                    manager.room_polls[room][poll_id] = poll_msg
                    
                    manager.save_to_history(room, poll_msg)
                    await manager.broadcast_to_room(room, poll_msg)
                    
            elif msg_type == "vote":
                poll_id = message.get("pollId")
                option_chosen = message.get("option")
                if room and username and poll_id and option_chosen:
                    room_polls = manager.room_polls.get(room, {})
                    if poll_id in room_polls:
                        poll = room_polls[poll_id]
                        voters = poll.setdefault("voters", {})
                        
                        prev_vote = voters.get(username)
                        if prev_vote == option_chosen:
                            voters.pop(username)
                        else:
                            voters[username] = option_chosen
                            
                        for opt in poll["options"]:
                            opt["votes"] = sum(1 for user, chosen in voters.items() if chosen == opt["option"])
                            
                        # Update poll in history
                        history = manager.room_history.get(room, [])
                        for h_msg in history:
                            if h_msg.get("type") == "poll" and h_msg.get("pollId") == poll_id:
                                h_msg["options"] = poll["options"]
                                h_msg["voters"] = voters
                                
                        update_msg = {
                            "type": "poll_update",
                            "pollId": poll_id,
                            "options": poll["options"],
                            "voters": voters
                        }
                        await manager.broadcast_to_room(room, update_msg)
                        
            elif msg_type == "share_code":
                code_snippet = message.get("codeSnippet")
                code_language = message.get("codeLanguage")
                if room and username and code_snippet:
                    code_msg = {
                        "type": "share_code",
                        "username": username,
                        "codeLanguage": code_language or "html",
                        "codeSnippet": code_snippet,
                        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                    }
                    manager.save_to_history(room, code_msg)
                    await manager.broadcast_to_room(room, code_msg)
                    
            elif msg_type == "synth_toggle":
                row = message.get("row")
                col = message.get("col")
                if room and row is not None and col is not None:
                    room_state = manager.room_games.setdefault(room, {})
                    synth_grid = room_state.setdefault("synth", [[0 for _ in range(8)] for _ in range(8)])
                    synth_grid[row][col] = 1 if synth_grid[row][col] == 0 else 0
                    await manager.broadcast_to_room(room, {
                        "type": "synth_update",
                        "row": row,
                        "col": col,
                        "state": synth_grid[row][col]
                    })
                    
            elif msg_type == "racer_start":
                if room:
                    snippets = [
                        "def quick_sort(arr):\n    if len(arr) <= 1: return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quick_sort(left) + middle + quick_sort(right)",
                        "const binarySearch = (arr, val) => {\n  let start = 0, end = arr.length - 1;\n  while (start <= end) {\n    let mid = Math.floor((start + end) / 2);\n    if (arr[mid] === val) return mid;\n    if (arr[mid] < val) start = mid + 1;\n    else end = mid - 1;\n  }\n  return -1;\n};",
                        "async def fetch_data(url: str):\n    async with httpx.AsyncClient() as client:\n        response = await client.get(url)\n        response.raise_for_status()\n        return response.json()"
                    ]
                    selected = random.choice(snippets)
                    room_state = manager.room_games.setdefault(room, {})
                    room_state["racer"] = {
                        "snippet": selected,
                        "progress": {},
                        "finished": []
                    }
                    await manager.broadcast_to_room(room, {
                        "type": "racer_init",
                        "snippet": selected
                    })
                    
            elif msg_type == "racer_progress":
                percent = message.get("progress")
                wpm = message.get("wpm")
                if room and username and percent is not None:
                    room_state = manager.room_games.setdefault(room, {})
                    racer_data = room_state.setdefault("racer", {"progress": {}, "finished": []})
                    racer_data["progress"][username] = {"percent": percent, "wpm": wpm or 0}
                    await manager.broadcast_to_room(room, {
                        "type": "racer_update",
                        "progress": racer_data["progress"]
                    })
                    
            elif msg_type == "racer_finished":
                wpm = message.get("wpm")
                time_taken = message.get("time")
                if room and username and wpm is not None:
                    room_state = manager.room_games.setdefault(room, {})
                    racer_data = room_state.setdefault("racer", {"progress": {}, "finished": []})
                    if not any(f["username"] == username for f in racer_data["finished"]):
                        racer_data["finished"].append({
                            "username": username,
                            "wpm": wpm,
                            "time": time_taken
                        })
                    await manager.broadcast_to_room(room, {
                        "type": "racer_leaderboard",
                        "finished": racer_data["finished"]
                    })
                    
            elif msg_type == "trivia_start":
                if room:
                    selected_questions = random.sample(TRIVIA_BANK, min(len(TRIVIA_BANK), 5))
                    room_state = manager.room_games.setdefault(room, {})
                    room_state["trivia"] = {
                        "questions": selected_questions,
                        "currentIndex": 0,
                        "scores": {},
                        "answers_received": {}
                    }
                    await manager.broadcast_to_room(room, {
                        "type": "trivia_next",
                        "question": selected_questions[0]["question"],
                        "options": selected_questions[0]["options"],
                        "index": 0,
                        "total": len(selected_questions)
                    })
                    
            elif msg_type == "trivia_submit":
                idx = message.get("index")
                opt_idx = message.get("optionIndex")
                time_taken = message.get("timeTaken", 10.0)
                if room and username and idx is not None and opt_idx is not None:
                    room_state = manager.room_games.setdefault(room, {})
                    trivia = room_state.get("trivia")
                    if trivia and trivia["currentIndex"] == idx:
                        correct_idx = trivia["questions"][idx]["answerIndex"]
                        is_correct = (opt_idx == correct_idx)
                        scores = trivia.setdefault("scores", {})
                        if is_correct:
                            points = max(100, int((15.0 - time_taken) * 60))
                            scores[username] = scores.get(username, 0) + points
                        else:
                            scores[username] = scores.get(username, 0)
                        answers = trivia.setdefault("answers_received", {})
                        answers[username] = {"option": opt_idx, "correct": is_correct}
                        
            elif msg_type == "trivia_reveal_request":
                if room:
                    room_state = manager.room_games.setdefault(room, {})
                    trivia = room_state.get("trivia")
                    if trivia:
                        idx = trivia["currentIndex"]
                        correct_idx = trivia["questions"][idx]["answerIndex"]
                        await manager.broadcast_to_room(room, {
                            "type": "trivia_reveal",
                            "correctIndex": correct_idx,
                            "scores": trivia.get("scores", {})
                        })
                        
            elif msg_type == "trivia_next_request":
                if room:
                    room_state = manager.room_games.setdefault(room, {})
                    trivia = room_state.get("trivia")
                    if trivia:
                        next_idx = trivia["currentIndex"] + 1
                        trivia["currentIndex"] = next_idx
                        trivia["answers_received"] = {}
                        if next_idx < len(trivia["questions"]):
                            await manager.broadcast_to_room(room, {
                                "type": "trivia_next",
                                "question": trivia["questions"][next_idx]["question"],
                                "options": trivia["questions"][next_idx]["options"],
                                "index": next_idx,
                                "total": len(trivia["questions"])
                            })
                        else:
                            await manager.broadcast_to_room(room, {
                                "type": "trivia_end",
                                "scores": trivia.get("scores", {})
                            })
                            
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket exception: {e}")
        await manager.disconnect(websocket)

TRIVIA_BANK = [
    {"question": "Which of the following is NOT a JavaScript data type?", "options": ["Undefined", "Boolean", "Float", "Symbol"], "answerIndex": 2},
    {"question": "What is the time complexity of searching in a balanced Binary Search Tree?", "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "answerIndex": 1},
    {"question": "What does HTTP status code 403 represent?", "options": ["Bad Request", "Forbidden", "Unauthorized", "Not Found"], "answerIndex": 1},
    {"question": "Which HTTP method is typically used to update an entire resource?", "options": ["POST", "PATCH", "PUT", "DELETE"], "answerIndex": 2},
    {"question": "In React, what hook is used to perform side effects?", "options": ["useState", "useContext", "useEffect", "useReducer"], "answerIndex": 2}
]

cached_news_db: Dict[str, dict] = {}

def get_fallback_news():
    return [
        {
            "id": "fallback_1",
            "title": "Next-Gen AI Models Redefining Real-Time Web Apps",
            "link": "https://techcrunch.com",
            "description": "A new generation of small, highly efficient language models is enabling developers to run intelligent agents directly inside browser applications with minimal latency.",
            "imageUrl": "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop&q=60",
            "pubDate": "Mon, 20 Jul 2026 12:00:00 GMT",
            "likes": 12,
            "comments": []
        },
        {
            "id": "fallback_2",
            "title": "The Rise of Glassmorphic Interfaces in Modern Web Design",
            "link": "https://techcrunch.com",
            "description": "Designers are embracing glassmorphic cards, radial gradients, and subtle glow effects to make interactive interfaces feel premium and immersive.",
            "imageUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
            "pubDate": "Mon, 20 Jul 2026 10:30:00 GMT",
            "likes": 24,
            "comments": []
        }
    ]

def fetch_custom_news(q: str = "", category: str = "Technology", country: str = "US", language: str = "en"):
    global cached_news_db
    
    hl = language.strip().lower()
    gl = country.strip().upper()
    
    search_term = q.strip()
    if search_term:
        query = f"{search_term} {category}"
    else:
        query = category
        
    encoded_query = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl={hl}-{gl}&gl={gl}&ceid={gl}:{hl}"
    
    category_images_db = {
        "Technology": [
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=60"
        ],
        "Sports": [
            "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1471295263379-6cd96c1f03d2?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&auto=format&fit=crop&q=60"
        ],
        "Entertainment": [
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1496307653780-3aee7d846c7c?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=60"
        ],
        "Business": [
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1444653300606-167ebb7f90e6?w=600&auto=format&fit=crop&q=60"
        ],
        "Science": [
            "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60"
        ],
        "Health": [
            "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&auto=format&fit=crop&q=60"
        ],
        "Astrology": [
            "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1532960401447-7dd05bef20b0?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&auto=format&fit=crop&q=60"
        ],
        "World": [
            "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1508847154043-be12a62861c1?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60"
        ]
    }
    fallback_images = category_images_db.get(category, category_images_db["Technology"])

    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            xml_data = response.read()
        
        root = ET.fromstring(xml_data)
        news_items = []
        
        for idx, item in enumerate(root.findall('.//item')[:12]):
            title = item.find('title').text if item.find('title') is not None else ""
            link = item.find('link').text if item.find('link') is not None else ""
            
            clean_id = re.sub(r'\W+', '', title)[:20].lower()
            if not clean_id:
                clean_id = f"news_{random.randint(10000, 99999)}"
                
            if clean_id in cached_news_db:
                news_items.append(cached_news_db[clean_id])
                continue
                
            desc_element = item.find('description')
            description = ""
            if desc_element is not None and desc_element.text:
                description = re.sub('<[^<]+?>', '', desc_element.text)
                description = html.unescape(description)
                if description.startswith(title):
                    description = description[len(title):].strip()
                if len(description) > 150:
                    description = description[:147] + "..."
            
            image_url = ""
            media_content = item.find('{http://search.yahoo.com/mrss/}content')
            if media_content is not None:
                image_url = media_content.attrib.get('url', '')
                
            if not image_url:
                media_thumb = item.find('{http://search.yahoo.com/mrss/}thumbnail')
                if media_thumb is not None:
                    image_url = media_thumb.attrib.get('url', '')
                    
            if not image_url:
                enclosure = item.find('enclosure')
                if enclosure is not None:
                    enc_type = enclosure.attrib.get('type', '')
                    if 'image' in enc_type:
                        image_url = enclosure.attrib.get('url', '')
            
            if not image_url and desc_element is not None and desc_element.text:
                img_match = re.search(r'src="([^"]+)"', desc_element.text)
                if img_match:
                    image_url = img_match.group(1)
            
            if not image_url:
                image_url = fallback_images[idx % len(fallback_images)]
                
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
            
            new_item = {
                "id": clean_id,
                "title": title,
                "link": link,
                "description": description or "Read the full story on Google News.",
                "imageUrl": image_url,
                "pubDate": pub_date,
                "likes": random.randint(2, 28),
                "comments": []
            }
            
            cached_news_db[clean_id] = new_item
            news_items.append(new_item)
            
        return news_items
    except Exception as e:
        print(f"Error fetching custom news: {e}")
        fallback = get_fallback_news()
        for fb_item in fallback:
            if fb_item["id"] not in cached_news_db:
                cached_news_db[fb_item["id"]] = fb_item
        return fallback

@app.get("/api/news")
def get_news(q: str = "", category: str = "Technology", country: str = "US", language: str = "en"):
    return fetch_custom_news(q, category, country, language)

@app.get("/api/news/{news_id}")
def get_news_detail(news_id: str):
    global cached_news_db
    if news_id in cached_news_db:
        return cached_news_db[news_id]
    return {"status": "error", "message": "News item not found"}

@app.get("/api/news/{news_id}/summary")
async def get_news_summary(news_id: str):
    global cached_news_db
    if news_id not in cached_news_db:
        return {"status": "error", "message": "News item not found"}
        
    item = cached_news_db[news_id]
    title = item.get("title", "")
    description = item.get("description", "")
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "status": "ok",
            "summary": f"💡 **Offline Summary Mode (Set GEMINI_API_KEY to unlock AI):**\nThis article '{title}' reports: {description}"
        }
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    prompt = (
        f"Analyze this news article. Provide a concise, engaging summary in exactly 3 bullet points with emojis. "
        f"Format using Markdown.\n\n"
        f"Title: {title}\n"
        f"Description: {description}\n"
        f"Summary:"
    )
    
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, timeout=10).read())
        res_json = json.loads(response.decode("utf-8"))
        summary_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
        return {"status": "ok", "summary": summary_text}
    except Exception as e:
        print(f"Gemini Summary API error: {e}")
        return {
            "status": "ok",
            "summary": f"📋 **Summary:** {description}"
        }

@app.post("/api/news/{news_id}/like")
def like_news(news_id: str):
    global cached_news_db
    if news_id in cached_news_db:
        cached_news_db[news_id]["likes"] += 1
        return {"status": "ok", "likes": cached_news_db[news_id]["likes"]}
    return {"status": "error", "message": "News item not found"}

@app.post("/api/news/{news_id}/comment")
def comment_news(news_id: str, payload: dict):
    global cached_news_db
    comment_text = payload.get("text", "").strip()
    author = payload.get("username", "Anonymous").strip()
    if not comment_text:
        return {"status": "error", "message": "Comment text is empty"}
    if news_id in cached_news_db:
        comment = {
            "author": author,
            "text": comment_text,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
        cached_news_db[news_id]["comments"].append(comment)
        return {"status": "ok", "comment": comment}
    return {"status": "error", "message": "News item not found"}

@app.get("/")
def index():
    return {"status": "ok", "message": "Python-FastAPI Group Chat server is running with Nova AI."}
