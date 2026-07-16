from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import datetime
import asyncio
import os
import urllib.request
import random
from typing import Dict, Set, List

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
            "- `@nova stats` : Check current chat statistics.\n\n"
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
                    
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket exception: {e}")
        await manager.disconnect(websocket)

@app.get("/")
def index():
    return {"status": "ok", "message": "Python-FastAPI Group Chat server is running with Nova AI."}
