"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your_supabase")
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Types
interface Exercise {
  name: string;
  duration: number;
  rest: number;
  description: string;
  muscleGroup: string;
  tip: string;
}

interface ChatMessage {
  sender: "user" | "trainer" | "system";
  text: string;
  timestamp: string;
}

export default function FlexAIPortal() {
  // Authentication States
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Role & Admin States
  const [role, setRole] = useState<"member" | "admin" | "super_admin">("member");
  const [gymOwnerId, setGymOwnerId] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedMemberForPlan, setSelectedMemberForPlan] = useState<any>(null);
  const [builderDay, setBuilderDay] = useState("Monday");
  const [builderWorkout, setBuilderWorkout] = useState<Exercise[]>([]);
  const [builderMeal, setBuilderMeal] = useState<any>({
    Breakfast: "",
    Lunch: "",
    Snack: "",
    Dinner: "",
    Macros: { Carbs: "40%", Protein: "30%", Fat: "30%" },
    Micros: { Fiber: "25g", Vitamin: "Multivitamin" }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [customMsgModalOpen, setCustomMsgModalOpen] = useState(false);
  const [selectedMemberForMsg, setSelectedMemberForMsg] = useState<any>(null);
  const [customMsgText, setCustomMsgText] = useState("");
  const [generatingAiPlan, setGeneratingAiPlan] = useState(false);
  const [assignedPlan, setAssignedPlan] = useState<any>(null);

  // WhatsApp States
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [callmebotKey, setCallmebotKey] = useState("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioSenderNumber, setTwilioSenderNumber] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Biometrics States
  const [age, setAge] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [bmi, setBmi] = useState<number | "">("");
  const [medicalConditions, setMedicalConditions] = useState("");

  // Leads States
  const [leads, setLeads] = useState<any[]>([]);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [superPassInput, setSuperPassInput] = useState("");

  // Super Admin States
  const [globalGymOwners, setGlobalGymOwners] = useState<any[]>([]);
  const [globalGymMembers, setGlobalGymMembers] = useState<any[]>([]);
  const [superTab, setSuperTab] = useState<"owners" | "members">("owners");

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<"dashboard" | "workout" | "live" | "nutrition">("dashboard");
  const [adminTab, setAdminTab] = useState<"members" | "leads">("members");
  const [selectedTrainer, setSelectedTrainer] = useState<"Max" | "Serena" | "Leo">("Max");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isActiveAccount, setIsActiveAccount] = useState(true);

  // Analytics & Broadcast States
  const [analyticsData, setAnalyticsData] = useState<{ peakHours: any, weeklyAttendance: any }>({ peakHours: {}, weeklyAttendance: {} });
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // User Stats (Loaded from DB or Mocked)
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [streakCount, setStreakCount] = useState(5);

  // Workout Builder States
  const [workoutParams, setWorkoutParams] = useState({
    goal: "Build Muscle",
    level: "Intermediate",
    duration: 30,
    equipment: "Dumbbells",
  });
  const [workoutPlan, setWorkoutPlan] = useState<Exercise[] | null>(null);
  const [workoutGenerating, setWorkoutGenerating] = useState(false);

  // Live Workout Player States
  const [workoutActive, setWorkoutActive] = useState(false);
  const [workoutPaused, setWorkoutPaused] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0); 
  const [timerMode, setTimerMode] = useState<"exercise" | "rest" | "cooldown">("exercise");
  const [simulatedHeartRate, setSimulatedHeartRate] = useState(72);

  // Meal & Nutrition Planner States
  const [mealParams, setMealParams] = useState({
    goal: "Lose Weight",
    dietType: "Balanced",
    calories: 2000,
  });
  const [mealPlan, setMealPlan] = useState<any | null>(null);
  const [mealGenerating, setMealGenerating] = useState(false);

  // Chat & WebSocket States
  const [wsConnected, setWsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Timer Interval Reference
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Resolve URLs
  const getApiUrl = (path: string) => {
    if (typeof window === "undefined") return "";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.")) {
      return `http://${hostname}:8000${path}`;
    }
    // Use explicit API URL env var (HTTP, not WebSocket)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) return `${apiUrl}${path}`;
    return `https://synapse-chat-backend.onrender.com${path}`;
  };

  const getWsUrl = (path: string) => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000${path}`;
    }
    const envUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL;
    if (envUrl) {
      const wsBase = envUrl.replace("/ws", "");
      return `${wsBase}${path}`;
    }
    return `wss://synapse-chat-backend.onrender.com${path}`;
  };

  // Listen to Auth State Changes
  useEffect(() => {
    if (!supabase) return;

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id, session.user);
        fetchUserStats(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id, session.user);
        fetchUserStats(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Stats from Backend (which pulls from Supabase)
  const fetchUserStats = async (userId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/user-stats/${userId}`));
      if (res.ok) {
        const data = await res.json();
        setTotalWorkouts(data.totalWorkouts || 0);
        setCaloriesBurned(data.totalCalories || 0);
        setStreakCount(data.streak || 0);
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  // Fetch User Profile Settings from Backend
  const fetchUserProfile = async (userId: string, currentUser?: any) => {
    try {
      const res = await fetch(getApiUrl(`/api/profile/${userId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.profile) {
          const prof = data.profile;
          setIsActiveAccount(prof.is_active !== false);
          setUsername(prof.username || "");
          setWhatsappNumber(prof.whatsapp_number || "");
          setCallmebotKey(prof.callmebot_key || "");
          setRole(prof.role || "member");
          setGymOwnerId(prof.gym_owner_id || "");
          setTwilioAccountSid(prof.twilio_account_sid || "");
          setTwilioAuthToken(prof.twilio_auth_token || "");
          setTwilioSenderNumber(prof.twilio_sender_number || "");
          setAge(prof.age || "");
          setHeight(prof.height || "");
          setWeight(prof.weight || "");
          setBmi(prof.bmi || "");
          setMedicalConditions(prof.medical_conditions || "");
          setWorkoutParams({
            goal: prof.goal || "Build Muscle",
            level: prof.level || "Intermediate",
            duration: prof.duration || 30,
            equipment: prof.equipment || "Dumbbells",
          });
          if ((prof.role || "member") === "member") {
            fetchAssignedPlan(userId);
          }
        } else {
          // Profile not found in database: Auto-heal/create matching user metadata
          const activeUser = currentUser || user;
          const authRole = activeUser?.user_metadata?.role || "member";
          const signupName = activeUser?.user_metadata?.display_name || activeUser?.email?.split("@")[0] || "Athlete";
          console.log("No profile record found in public.profiles. Auto-creating with role:", authRole);
          try {
            await fetch(getApiUrl("/api/profile/update"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: userId,
                username: signupName,
                goal: "Build Muscle",
                level: "Intermediate",
                duration: 30,
                equipment: "Dumbbells",
                whatsappNumber: "",
                callmebotKey: "",
                role: authRole
              })
            });
            setRole(authRole);
            // Re-fetch now that profile is saved in DB
            setTimeout(() => fetchUserProfile(userId, activeUser), 200);
          } catch (createErr) {
            console.error("Auto-creation of profile failed:", createErr);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
  };

  // Update Profile Settings on Supabase
  const saveUserProfile = async (updatedParams: typeof workoutParams) => {
    if (!user) return;
    try {
      // Auto-calculate BMI
      let computedBmi = bmi;
      if (height && weight) {
        const hMeter = parseFloat(height.toString()) / 100;
        computedBmi = parseFloat((parseFloat(weight.toString()) / (hMeter * hMeter)).toFixed(1));
        setBmi(computedBmi);
      }

      const res = await fetch(getApiUrl("/api/profile/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          username: username || user.email?.split("@")[0] || "User",
          goal: updatedParams.goal,
          level: updatedParams.level,
          duration: updatedParams.duration,
          equipment: updatedParams.equipment,
          whatsappNumber: whatsappNumber,
          role: role,
          gymOwnerId: gymOwnerId,
          twilioAccountSid: twilioAccountSid,
          twilioAuthToken: twilioAuthToken,
          twilioSenderNumber: twilioSenderNumber,
          age: age ? parseInt(age.toString()) : null,
          height: height ? parseFloat(height.toString()) : null,
          weight: weight ? parseFloat(weight.toString()) : null,
          bmi: computedBmi ? parseFloat(computedBmi.toString()) : null,
          medicalConditions: medicalConditions
        }),
      });
      if (res.ok) {
        alert("Settings saved successfully!");
      }
    } catch (e) {
      console.error("Error saving profile:", e);
      alert("Failed to save settings.");
    }
  };

  // Dispatch Daily Workout/Diet Summary to WhatsApp
  const sendWhatsAppBrief = async () => {
    if (!user) return;
    if (!whatsappNumber) {
      alert("Please add your WhatsApp number in the Profile Settings section first (e.g. +919876543210)");
      return;
    }
    setSendingWhatsApp(true);
    try {
      const res = await fetch(getApiUrl("/api/send-whatsapp-brief"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          workout: workoutPlan || undefined,
          mealPlan: mealPlan || undefined
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("📲 Daily Briefing sent to your WhatsApp successfully!");
      } else {
        alert(`❌ Failed to send brief: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error sending brief. Please verify your backend server.");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Fetch Plan assigned by Gym Owner
  const fetchAssignedPlan = async (userId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/member/assigned-plan/${userId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.plan) {
          setAssignedPlan(data.plan);
          if (data.plan.workout_plan) {
            setWorkoutPlan(data.plan.workout_plan);
          }
          if (data.plan.diet_plan) {
            setMealPlan(data.plan.diet_plan);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching assigned plan:", e);
    }
  };

  // Fetch Members linked to Admin
  const fetchAdminMembers = async () => {
    if (!user) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/members/${user.id}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setMembers(data.members || []);
        }
      }
    } catch (e) {
      console.error("Error fetching members:", e);
    }
  };

  // Fetch Attendance logs for today
  const fetchAdminAttendance = async () => {
    if (!user) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/attendance/${user.id}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setAttendance(data.attendance || []);
        }
      }
    } catch (e) {
      console.error("Error fetching attendance:", e);
    }
  };

  // Fetch Enquiries / Leads
  const fetchAdminLeads = async () => {
    if (!user) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/leads/${user.id}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setLeads(data.leads || []);
        }
      }
    } catch (e) {
      console.error("Error fetching leads:", e);
    }
  };

  // Submit a Walk-in Sales Lead
  const submitNewLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leadName || !leadPhone) return;
    setSavingLead(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymOwnerId: user.id,
          name: leadName,
          phoneNumber: leadPhone
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          alert(`🎉 Lead ${leadName} registered successfully! Welcome greetings sent on WhatsApp.`);
          setLeadName("");
          setLeadPhone("");
          fetchAdminLeads();
        } else {
          alert("Error registering lead: " + data.message);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLead(false);
    }
  };

  // Update Lead Status (e.g. converted, not_interested)
  const toggleLeadStatus = async (leadId: string, status: string) => {
    try {
      const res = await fetch(getApiUrl("/api/admin/leads/update-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status
        })
      });
      if (res.ok) {
        fetchAdminLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Super Admin lists
  const fetchSuperAdminData = async () => {
    try {
      const res = await fetch(getApiUrl("/api/superadmin/gyms"));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setGlobalGymOwners(data.gymOwners || []);
          setGlobalGymMembers(data.gymMembers || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle active/inactive subscription status
  const toggleAccountActive = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(getApiUrl("/api/superadmin/toggle-active"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isActive: !currentStatus
        })
      });
      if (res.ok) {
        fetchSuperAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Gym Analytics
  const fetchAdminAnalytics = async () => {
    if (!user) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/analytics/${user.id}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setAnalyticsData({
            peakHours: data.peakHours || {},
            weeklyAttendance: data.weeklyAttendance || {}
          });
        }
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  // Trigger Bulk Broadcast Announcement
  const handleSendBroadcast = async () => {
    if (!user || !broadcastMsg) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/broadcast"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymOwnerId: user.id,
          message: `📢 *GYM BROADCAST* 📢\n\n${broadcastMsg}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Broadcast successfully dispatched to ${data.sentCount || 0} gym members!`);
        setBroadcastMsg("");
        setBroadcastModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingBroadcast(false);
    }
  };

  // AI Suggest Plan for Admin Builder
  const handleAiSuggestPlan = async () => {
    if (!selectedMemberForPlan) return;
    setGeneratingAiPlan(true);
    try {
      const wRes = await fetch(getApiUrl("/api/generate-workout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: selectedMemberForPlan.goal || "Build Muscle",
          level: selectedMemberForPlan.level || "Intermediate",
          duration: selectedMemberForPlan.duration || 30,
          equipment: selectedMemberForPlan.equipment || "Dumbbells",
          trainer: "Max",
          age: selectedMemberForPlan.age ? parseInt(selectedMemberForPlan.age.toString()) : null,
          height: selectedMemberForPlan.height ? parseFloat(selectedMemberForPlan.height.toString()) : null,
          weight: selectedMemberForPlan.weight ? parseFloat(selectedMemberForPlan.weight.toString()) : null,
          bmi: selectedMemberForPlan.bmi ? parseFloat(selectedMemberForPlan.bmi.toString()) : null,
          medicalConditions: selectedMemberForPlan.medical_conditions || null
        })
      });
      
      const mRes = await fetch(getApiUrl("/api/generate-meal-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: selectedMemberForPlan.goal || "Build Muscle",
          dietType: "High Protein",
          calories: 2000,
          age: selectedMemberForPlan.age ? parseInt(selectedMemberForPlan.age.toString()) : null,
          height: selectedMemberForPlan.height ? parseFloat(selectedMemberForPlan.height.toString()) : null,
          weight: selectedMemberForPlan.weight ? parseFloat(selectedMemberForPlan.weight.toString()) : null,
          bmi: selectedMemberForPlan.bmi ? parseFloat(selectedMemberForPlan.bmi.toString()) : null,
          medicalConditions: selectedMemberForPlan.medical_conditions || null
        })
      });
      
      if (wRes.ok && mRes.ok) {
        const wData = await wRes.json();
        const mData = await mRes.json();
        if (wData.workout) setBuilderWorkout(wData.workout);
        if (mData.mealPlan) {
          setBuilderMeal({
            Breakfast: mData.mealPlan.Breakfast || "",
            Lunch: mData.mealPlan.Lunch || "",
            Snack: mData.mealPlan.Snack || "",
            Dinner: mData.mealPlan.Dinner || "",
            Macros: mData.mealPlan.Macros || { Carbs: "40%", Protein: "30%", Fat: "30%" },
            Micros: mData.mealPlan.Micros || { Fiber: "25g", Vitamin: "Multivitamin" }
          });
        }
      }
    } catch (e) {
      console.error("Error generating plans via AI:", e);
      alert("AI Plan suggestion failed. Ensure your Gemini API Key is active.");
    } finally {
      setGeneratingAiPlan(false);
    }
  };

  // Save Assigned Plan to database
  const saveAssignedPlan = async () => {
    if (!selectedMemberForPlan) return;
    try {
      const res = await fetch(getApiUrl("/api/admin/assign-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberForPlan.id,
          workoutPlan: builderWorkout,
          dietPlan: builderMeal,
          day: builderDay
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert(`Successfully assigned ${builderDay}'s plan to ${selectedMemberForPlan.username}!`);
        setModalOpen(false);
      } else {
        alert("Failed to save plan: " + data.message);
      }
    } catch (e) {
      console.error("Error saving plan:", e);
    }
  };

  // Fetch existing member plan by day for editing
  const loadMemberPlan = async (member: any, day: string) => {
    setSelectedMemberForPlan(member);
    setBuilderDay(day);
    try {
      const res = await fetch(getApiUrl(`/api/member/assigned-plan/${member.id}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.plan) {
          const fullW = data.plan.workout_plan || {};
          const fullD = data.plan.diet_plan || {};
          
          let dayW = [];
          if (Array.isArray(fullW)) {
            dayW = fullW;
          } else {
            dayW = fullW[day] || [];
          }
          
          let dayD = { Breakfast: "", Lunch: "", Snack: "", Dinner: "", Macros: { Carbs: "45%", Protein: "30%", Fat: "25%" }, Micros: { Fiber: "25g", Vitamin: "Multivitamin" } };
          if (fullD && !fullD.Breakfast && !fullD.Lunch) {
            if (fullD[day]) {
              dayD = fullD[day];
            }
          } else if (fullD) {
            dayD = fullD;
          }
          
          setBuilderWorkout(dayW);
          setBuilderMeal(dayD);
          return;
        }
      }
      
      // Defaults if no plan found
      setBuilderWorkout([
        { name: "Push Ups", duration: 40, rest: 20, description: "Chest conditioning", muscleGroup: "Chest", tip: "Keep elbows tucked." },
        { name: "Squats", duration: 40, rest: 20, description: "Legs strength", muscleGroup: "Legs", tip: "Heels flat." }
      ]);
      setBuilderMeal({
        Breakfast: "Oatmeal with almonds & protein shake",
        Lunch: "Grilled chicken breast, quinoa & veggies",
        Snack: "Boiled eggs or berries",
        Dinner: "Fish or tofu steak, salad",
        Macros: { Carbs: "150g", Protein: "180g", Fat: "60g" },
        Micros: { Fiber: "35g", Vitamin: "Zinc & Multivitamin" }
      });
    } catch (e) {
      console.error("Error preloading plan:", e);
    }
  };

  // Toggle Member Attendance Status
  const toggleAttendance = async (memberId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "present" ? "absent" : "present";
    try {
      const res = await fetch(getApiUrl("/api/admin/mark-attendance"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          status: nextStatus
        })
      });
      if (res.ok) {
        fetchAdminAttendance();
      }
    } catch (e) {
      console.error("Failed to update attendance:", e);
    }
  };

  // Send WhatsApp notification/briefing to Member
  const dispatchPlanToMember = async (member: any) => {
    if (!member.whatsapp_number) {
      alert("This member does not have a WhatsApp number configured in their profile!");
      return;
    }
    try {
      const planRes = await fetch(getApiUrl(`/api/member/assigned-plan/${member.id}`));
      let workout = undefined;
      let mealPlan = undefined;
      if (planRes.ok) {
        const pData = await planRes.json();
        if (pData.status === "success" && pData.plan) {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const currentDay = days[new Date().getDay()];
          const fullW = pData.plan.workout_plan || {};
          const fullD = pData.plan.diet_plan || {};
          
          workout = Array.isArray(fullW) ? fullW : (fullW[currentDay] || []);
          if (fullD && !fullD.Breakfast && !fullD.Lunch) {
            mealPlan = fullD[currentDay] || {};
          } else {
            mealPlan = fullD;
          }
        }
      }
      
      const res = await fetch(getApiUrl("/api/send-whatsapp-brief"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          workout: workout,
          mealPlan: mealPlan
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert(`📲 Diet & workout plan successfully dispatched to ${member.username}'s WhatsApp!`);
      } else {
        alert(`❌ Failed to dispatch brief: ${data.message}`);
      }
    } catch (e) {
      console.error("Error dispatching member briefing:", e);
    }
  };

  // Send custom WhatsApp text notification to Client
  const sendAdminCustomMessage = async () => {
    if (!selectedMemberForMsg || !customMsgText) return;
    try {
      const res = await fetch(getApiUrl("/api/admin/send-custom-whatsapp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberForMsg.id,
          message: customMsgText
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert(`Custom message dispatched to ${selectedMemberForMsg.username}!`);
        setCustomMsgModalOpen(false);
        setCustomMsgText("");
      } else {
        alert("Failed to dispatch custom message: " + data.message);
      }
    } catch (e) {
      console.error("Custom message error:", e);
    }
  };

  // Effect to load admin resources
  useEffect(() => {
    if (user && role === "admin") {
      fetchAdminMembers();
      fetchAdminAttendance();
      fetchAdminLeads();
      fetchAdminAnalytics();
    } else if (user && role === "super_admin") {
      fetchSuperAdminData();
    }
  }, [user, role]);

  // Login Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase credentials not configured in env yet. Using offline mode.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        fetchUserProfile(data.user.id, data.user);
        fetchUserStats(data.user.id);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in");
    } finally {
      setAuthLoading(false);
    }
  };

  // Register Handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase credentials not configured. Using offline mode.");
      return;
    }
    if (role === "super_admin" && superPassInput !== "admin123") {
      alert("Invalid Super Admin access code.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            display_name: username || authEmail.split("@")[0],
            role: role
          }
        }
      });
      if (error) throw error;
      if (data.user) {
        // Automatically save initial profile with role mapping
        try {
          await fetch(getApiUrl("/api/profile/update"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: data.user.id,
              username: username || authEmail.split("@")[0],
              goal: "Build Muscle",
              level: "Intermediate",
              duration: 30,
              equipment: "Dumbbells",
              whatsappNumber: "",
              callmebotKey: "",
              role: role,
              gymOwnerId: role === "member" && gymOwnerId ? gymOwnerId : undefined
            })
          });
        } catch (profileErr) {
          console.error("Failed to save initial profile:", profileErr);
        }
      }
      alert("Registration successful! You can now Sign In.");
      setAuthMode("signin");
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign up");
    } finally {
      setAuthLoading(false);
    }
  };

  // Offline Bypass
  const handleSkipAuth = () => {
    setUser({
      id: "offline-user-uid-placeholder",
      email: "offline-gymmer@flexai.io",
      offline: true
    });
    setUsername("Guest Athlete");
    setTotalWorkouts(3);
    setCaloriesBurned(340);
    setStreakCount(5);
  };

  // Logout Handler
  const handleSignOut = async () => {
    if (supabase && !user?.offline) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setAuthEmail("");
    setAuthPassword("");
    setWorkoutPlan(null);
    setWorkoutActive(false);
  };

  // Helper: Text-to-speech
  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedTrainer === "Serena") {
      utterance.pitch = 1.15;
      utterance.rate = 0.8; 
    } else if (selectedTrainer === "Leo") {
      utterance.pitch = 1.05;
      utterance.rate = 1.25; 
    } else {
      utterance.pitch = 0.9;
      utterance.rate = 1.0; 
    }

    window.speechSynthesis.speak(utterance);
  };

  // Connect WebSocket
  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      const url = getWsUrl("/ws/live-coach");
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setErrorMsg(null);
        ws.send(JSON.stringify({
          type: "start",
          trainer: selectedTrainer
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "trainer_cue") {
          if (data.audioText) speak(data.audioText);
          setChatMessages((prev) => [
            ...prev,
            { sender: "trainer", text: data.cue, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        } else if (data.type === "message") {
          if (data.audioText) speak(data.audioText);
          setChatMessages((prev) => [
            ...prev,
            { sender: "trainer", text: data.message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        } else if (data.type === "system") {
          setChatMessages((prev) => [
            ...prev,
            { sender: "system", text: data.message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        }
      };

      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Send message
  const sendChatMessage = (messageText: string) => {
    const text = messageText || inputText;
    if (!text.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setInputText("");

    if (socketRef.current && wsConnected) {
      socketRef.current.send(JSON.stringify({
        type: "message",
        trainer: selectedTrainer,
        message: text
      }));
    } else {
      setTimeout(() => {
        let reply = "Keep pushing! Make every rep count.";
        if (selectedTrainer === "Serena") {
          reply = "Inhale peace, exhale tension. Let your alignment guide you.";
        } else if (selectedTrainer === "Leo") {
          reply = "Speed it up! Sweat is just fat crying! Let's go!";
        }
        setChatMessages((prev) => [
          ...prev,
          { sender: "trainer", text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        speak(reply);
      }, 700);
    }
  };

  // Simulated Heart Rate Tracker
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (workoutActive && !workoutPaused) {
      interval = setInterval(() => {
        const base = timerMode === "exercise" ? 142 : 108;
        const fluctuation = Math.floor(Math.random() * 12) - 6; 
        setSimulatedHeartRate(base + fluctuation);
      }, 2000);
    } else {
      setSimulatedHeartRate(74);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workoutActive, workoutPaused, timerMode]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const playTrainerIntro = (trainer: "Max" | "Serena" | "Leo") => {
    let introText = "";
    if (trainer === "Max") {
      introText = "Hey there! I am Max, your strength coach. Let's lift heavy, focus on your posture, and get stronger today. Keep pushing!";
    } else if (trainer === "Serena") {
      introText = "Welcome. I am Serena, your yoga guide. We will focus on smooth stretching, flow alignment, and peaceful breathing.";
    } else {
      introText = "Let's go! I am Leo, your HIIT specialist. Fast tempos, high speeds, and zero rest limits. Get ready to sweat!";
    }
    speak(introText);
  };

  // API Call: Generate Workout
  const fetchWorkout = async () => {
    setWorkoutGenerating(true);
    setErrorMsg(null);
    try {
      const response = await fetch(getApiUrl("/api/generate-workout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...workoutParams, trainer: selectedTrainer }),
      });
      if (!response.ok) throw new Error("Server returned an error");
      const data = await response.json();
      setWorkoutPlan(data.workout);
      
      // Save profile variables to Database
      saveUserProfile(workoutParams);
    } catch (err: any) {
      setErrorMsg("Failed to generate workout plan. Check backend server.");
      console.error(err);
    } finally {
      setWorkoutGenerating(false);
    }
  };

  // API Call: Generate Meal Plan
  const fetchMealPlan = async () => {
    setMealGenerating(true);
    setErrorMsg(null);
    try {
      const response = await fetch(getApiUrl("/api/generate-meal-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mealParams),
      });
      if (!response.ok) throw new Error("Meal plan API failed");
      const data = await response.json();
      setMealPlan(data.mealPlan);
    } catch (err) {
      setErrorMsg("Failed to generate meal plan. Using local presets.");
    } finally {
      setMealGenerating(false);
    }
  };

  // Live Workout Player control
  const startWorkoutSession = () => {
    if (!workoutPlan || workoutPlan.length === 0) return;
    
    connectWebSocket();
    setWorkoutActive(true);
    setWorkoutPaused(false);
    setCurrentExerciseIndex(0);
    setTimerMode("exercise");
    
    const firstEx = workoutPlan[0];
    setTimeLeft(firstEx.duration);
    setTotalDuration(firstEx.duration);
    
    setActiveTab("live");
    setChatMessages([
      { sender: "system", text: `Active session started with Coach ${selectedTrainer}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    setTimeout(() => {
      speak(`Starting session. First is ${firstEx.name}. Ready, set, go!`);
    }, 400);
  };

  const pauseWorkout = () => {
    setWorkoutPaused(!workoutPaused);
  };

  const skipExercise = () => {
    if (!workoutPlan) return;
    if (timerMode === "exercise") {
      if (currentExerciseIndex < workoutPlan.length - 1) {
        setTimerMode("rest");
        setTimeLeft(workoutPlan[currentExerciseIndex].rest);
        setTotalDuration(workoutPlan[currentExerciseIndex].rest);
        speak("Rest period. Recover now.");
      } else {
        endWorkoutSuccess();
      }
    } else {
      const nextIndex = currentExerciseIndex + 1;
      setCurrentExerciseIndex(nextIndex);
      setTimerMode("exercise");
      setTimeLeft(workoutPlan[nextIndex].duration);
      setTotalDuration(workoutPlan[nextIndex].duration);
      
      const nextEx = workoutPlan[nextIndex];
      speak(`Next up: ${nextEx.name}. Go!`);
      
      if (socketRef.current && wsConnected) {
        socketRef.current.send(JSON.stringify({
          type: "cue_request",
          trainer: selectedTrainer,
          exercise: nextEx.name,
          tip: nextEx.tip
        }));
      }
    }
  };

  const endWorkoutSuccess = async () => {
    setWorkoutActive(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    speak(`Workout completed! Spectacular effort with Coach ${selectedTrainer}. Maintain the consistency!`);
    setChatMessages((prev) => [
      ...prev,
      { sender: "system", text: "Workout completed!", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    // Save logs to Supabase DB via FastAPI
    if (user) {
      try {
        const estCalories = workoutPlan ? workoutPlan.length * 75 : 300;
        const totalSecs = workoutPlan ? workoutPlan.reduce((acc, curr) => acc + curr.duration + curr.rest, 0) : 1800;
        
        const res = await fetch(getApiUrl("/api/save-workout-log"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            trainer: selectedTrainer,
            duration: Math.ceil(totalSecs / 60),
            caloriesBurned: estCalories,
            workoutPlan: workoutPlan
          })
        });
        if (res.ok) {
          fetchUserStats(user.id);
        }
      } catch (e) {
        console.error("Error saving log:", e);
      }
    }
    
    alert("Workout finished! Awesome job!");
  };

  // Timer Tick
  useEffect(() => {
    if (workoutActive && !workoutPaused) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            
            if (timerMode === "exercise") {
              if (workoutPlan && currentExerciseIndex < workoutPlan.length - 1) {
                setTimerMode("rest");
                const restTime = workoutPlan[currentExerciseIndex].rest;
                setTotalDuration(restTime);
                speak("Time for a quick break.");
                return restTime;
              } else {
                endWorkoutSuccess();
                return 0;
              }
            } else {
              const nextIndex = currentExerciseIndex + 1;
              setCurrentExerciseIndex(nextIndex);
              setTimerMode("exercise");
              
              const nextEx = workoutPlan![nextIndex];
              setTotalDuration(nextEx.duration);
              speak(`Go! Next is ${nextEx.name}.`);
              
              if (socketRef.current && wsConnected) {
                socketRef.current.send(JSON.stringify({
                  type: "cue_request",
                  trainer: selectedTrainer,
                  exercise: nextEx.name,
                  tip: nextEx.tip
                }));
              }
              return nextEx.duration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [workoutActive, workoutPaused, timerMode, currentExerciseIndex, workoutPlan, wsConnected]);

  // Radius for SVG timer circle
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 ? circumference - (timeLeft / totalDuration) * circumference : 0;

  // Render Login Card if User is not logged in
  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050505 0%, #0f0f0f 50%, #0a0a14 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          width: "100%",
          maxWidth: "400px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "32px 24px",
          backdropFilter: "blur(20px)"
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{
              width: "60px", height: "60px",
              background: "linear-gradient(135deg, var(--primary), #00bcd4)",
              borderRadius: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.8rem",
              margin: "0 auto 14px"
            }}>⚡</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>FLEXAI Portal</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "6px" }}>
              AI-powered gym management & coaching platform
            </p>
          </div>

          {/* Auth Mode Tabs */}
          <div style={{
            display: "flex", gap: "4px",
            background: "rgba(255,255,255,0.03)",
            padding: "4px", borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: "20px"
          }}>
            <button
              type="button"
              style={{
                flex: 1, padding: "9px", fontSize: "0.8rem", fontWeight: 600,
                borderRadius: "9px", border: "none", cursor: "pointer",
                background: authMode === "signin" ? "var(--primary)" : "transparent",
                color: authMode === "signin" ? "#000" : "var(--text-muted)",
                transition: "all 0.2s ease"
              }}
              onClick={() => setAuthMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              style={{
                flex: 1, padding: "9px", fontSize: "0.8rem", fontWeight: 600,
                borderRadius: "9px", border: "none", cursor: "pointer",
                background: authMode === "signup" ? "var(--primary)" : "transparent",
                color: authMode === "signup" ? "#000" : "var(--text-muted)",
                transition: "all 0.2s ease"
              }}
              onClick={() => setAuthMode("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {authError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ff8888", padding: "10px 14px",
              borderRadius: "10px", fontSize: "0.78rem", marginBottom: "16px"
            }}>
              ❌ {authError}
            </div>
          )}

          <form onSubmit={authMode === "signin" ? handleSignIn : handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {authMode === "signup" && (
              <>
                {/* Name */}
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Name / Gym Brand</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rohan / Golden Gym"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>

                {/* Account Type - Card style selection */}
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", letterSpacing: "0.5px", textTransform: "uppercase" }}>I am a...</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      { key: "member" as const, icon: "🏋️", title: "Gym Member", sub: "Get personalized AI coaching & daily plans on WhatsApp" },
                      { key: "admin" as const, icon: "👑", title: "Gym Owner", sub: "Manage members, track attendance & automate coaching" },
                      { key: "super_admin" as const, icon: "🛡️", title: "Platform Admin", sub: "Full platform control across all gyms" },
                    ].map((opt) => (
                      <div
                        key={opt.key}
                        onClick={() => setRole(opt.key)}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "12px 14px",
                          borderRadius: "12px",
                          border: role === opt.key ? "2px solid var(--primary)" : "1px solid rgba(255,255,255,0.06)",
                          background: role === opt.key ? "rgba(0, 255, 170, 0.06)" : "rgba(255,255,255,0.02)",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div style={{
                          width: "36px", height: "36px",
                          borderRadius: "10px",
                          background: role === opt.key ? "rgba(0, 255, 170, 0.15)" : "rgba(255,255,255,0.04)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1.1rem", flexShrink: 0
                        }}>{opt.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: role === opt.key ? "var(--primary)" : "#fff" }}>{opt.title}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>{opt.sub}</div>
                        </div>
                        <div style={{
                          width: "18px", height: "18px", borderRadius: "50%",
                          border: role === opt.key ? "2px solid var(--primary)" : "2px solid rgba(255,255,255,0.15)",
                          background: role === opt.key ? "var(--primary)" : "transparent",
                          flexShrink: 0, position: "relative", transition: "all 0.2s ease"
                        }}>
                          {role === opt.key && <div style={{ position: "absolute", inset: "3px", borderRadius: "50%", background: "#000" }}></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gym Trainer Code for Members */}
                {role === "member" && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Gym Trainer Code <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(Optional)</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Paste Trainer ID here to link your account"
                      value={gymOwnerId}
                      onChange={(e) => setGymOwnerId(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                )}

                {/* Super Admin Access Code */}
                {role === "super_admin" && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#f59e0b", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>⚠️ Platform Passkey Required</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter Super Admin Access Code"
                      value={superPassInput}
                      onChange={(e) => setSuperPassInput(e.target.value)}
                      required
                      style={{ width: "100%", boxSizing: "border-box", border: "1px solid rgba(245,158,11,0.3)" }}
                    />
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {/* Submit */}
            <button
              className="btn"
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "0.9rem",
                fontWeight: 700,
                borderRadius: "12px",
                marginTop: "4px",
                background: authLoading ? "rgba(0,255,170,0.4)" : "var(--primary)",
                color: "#000",
                boxShadow: "0 4px 20px rgba(0, 255, 170, 0.2)"
              }}
            >
              {authLoading ? "Connecting..." : authMode === "signin" ? "🔓 Sign In" : `✅ Create ${role === "admin" ? "Gym Owner" : role === "super_admin" ? "Admin" : "Member"} Account`}
            </button>
          </form>

          {/* Offline Mode */}
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}></div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}></div>
            </div>
            <button
              type="button"
              onClick={handleSkipAuth}
              style={{
                width: "100%", padding: "11px",
                fontSize: "0.82rem", fontWeight: 600,
                borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)", color: "var(--text-muted)",
                cursor: "pointer"
              }}
            >
              🏃 Try Offline Demo Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isActiveAccount && role !== "super_admin") {
    return (
      <div className="auth-card-wrapper" style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#0b0c10" }}>
        <div className="glass-panel" style={{ maxWidth: "480px", width: "100%", padding: "40px 20px", textAlign: "center", border: "1px solid #ff4444" }}>
          <span style={{ fontSize: "4rem" }}>🚫</span>
          <h1 style={{ fontSize: "1.8rem", color: "#ff8888", marginTop: "16px" }}>Account Suspended</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "16px 0", lineHeight: "1.5" }}>
            Your account or your linked gym's subscription is currently deactivated. Please contact your administrator or renew your subscription package to unlock access.
          </p>
          <button 
            className="btn btn-secondary" 
            style={{ width: "100%", borderRadius: "12px", border: "1px dashed var(--error)", color: "var(--error)", marginTop: "12px" }}
            onClick={handleSignOut}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (role === "admin") {
    return (
      <div className="app-container theme-Max">
        {/* Admin Desktop Header */}
        <header className="navbar">
          <div className="brand">
            <span className="brand-icon">👑</span>
            <span>FLEXAI // GYM OWNER PORTAL</span>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button 
              className="btn" 
              style={{ padding: "6px 12px", fontSize: "0.8rem", background: "var(--accent-orange)", color: "#000", border: "none" }}
              onClick={() => setBroadcastModalOpen(true)}
            >
              📢 Broadcast Alert
            </button>
            <div style={{ background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid var(--border-muted)" }}>
              🔑 Gym Trainer Code: <code style={{ color: "var(--accent-orange)", fontWeight: 700 }}>{user?.id}</code>
            </div>
            <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem", color: "var(--error)", border: "1px dashed var(--error)" }} onClick={handleSignOut}>
              Logout
            </button>
          </div>
        </header>

        {/* Admin Content Area */}
        <main className="main-content">
          {/* Quick Metrics */}
          <div className="grid-3" style={{ marginBottom: "20px" }}>
            <div className="glass-panel glow-primary" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem" }}>👥</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "6px" }}>{members.length}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Linked Members</div>
            </div>
            <div className="glass-panel" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem" }}>✅</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "6px" }}>{attendance.filter(a => a.status === "present").length}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Present Today</div>
            </div>
            <div className="glass-panel" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem" }}>❌</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "6px" }}>{attendance.filter(a => a.status === "absent").length}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Absent Today</div>
            </div>
          </div>

          {/* Admin Tab Switcher */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
            <button 
              className="btn" 
              style={{ padding: "8px 16px", fontSize: "0.85rem", background: adminTab === "members" ? "var(--primary)" : "transparent", color: adminTab === "members" ? "#000" : "var(--text-muted)", border: adminTab === "members" ? "none" : "1px solid var(--border-muted)" }}
              onClick={() => setAdminTab("members")}
            >
              🏋️ Linked Members & Attendance
            </button>
            <button 
              className="btn" 
              style={{ padding: "8px 16px", fontSize: "0.85rem", background: adminTab === "leads" ? "var(--primary)" : "transparent", color: adminTab === "leads" ? "#000" : "var(--text-muted)", border: adminTab === "leads" ? "none" : "1px solid var(--border-muted)" }}
              onClick={() => setAdminTab("leads")}
            >
              📊 Sales Leads & WhatsApp Follow-ups
            </button>
          </div>

          {adminTab === "members" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px" }}>
              {/* Column 1: Member Directory */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>🏋️ Gym Member Directory</h3>
                {members.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No members linked yet. Give your Trainer Code <code style={{ color: "var(--accent-orange)" }}>{user?.id}</code> to members during signup!
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-muted)", color: "var(--text-muted)" }}>
                          <th style={{ padding: "10px" }}>Username</th>
                          <th style={{ padding: "10px" }}>Goal</th>
                          <th style={{ padding: "10px" }}>WhatsApp</th>
                          <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                            <td style={{ padding: "12px 10px", fontWeight: 600 }}>{member.username}</td>
                            <td style={{ padding: "12px 10px" }}>{member.goal}</td>
                            <td style={{ padding: "12px 10px", color: member.whatsapp_number ? "var(--primary)" : "var(--error)" }}>
                              {member.whatsapp_number || "Not Configured"}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                <button 
                                  className="btn" 
                                  style={{ padding: "4px 8px", fontSize: "0.75rem", background: "var(--primary)", color: "#000" }}
                                  onClick={() => {
                                    loadMemberPlan(member, "Monday");
                                    setModalOpen(true);
                                  }}
                                >
                                  📋 Assign Plan
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  onClick={() => dispatchPlanToMember(member)}
                                >
                                  📲 WhatsApp Plan
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  onClick={() => {
                                    setSelectedMemberForMsg(member);
                                    setCustomMsgModalOpen(true);
                                  }}
                                >
                                  💬 Msg
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Column 2: Today's Attendance Sheet */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>📅 Attendance Checklist</h3>
                {members.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "10px" }}>
                    Link members to track attendance.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {members.map((member) => {
                      const attRecord = attendance.find(a => a.memberId === member.id);
                      const status = attRecord ? attRecord.status : "absent";
                      return (
                        <div 
                          key={member.id} 
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-muted)", borderRadius: "10px" }}
                        >
                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{member.username}</span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button 
                              className={`btn ${status === "present" ? "" : "btn-secondary"}`} 
                              style={{ 
                                padding: "4px 8px", 
                                fontSize: "0.75rem", 
                                background: status === "present" ? "var(--primary)" : "transparent",
                                color: status === "present" ? "#000" : "var(--text-muted)",
                                border: status === "present" ? "none" : "1px solid var(--border-muted)"
                              }}
                              onClick={() => toggleAttendance(member.id, status)}
                            >
                              ✔️ Present
                            </button>
                            <button 
                              className={`btn ${status === "absent" ? "" : "btn-secondary"}`}
                              style={{ 
                                padding: "4px 8px", 
                                fontSize: "0.75rem", 
                                background: status === "absent" ? "rgba(239, 68, 68, 0.2)" : "transparent",
                                color: status === "absent" ? "#ff8888" : "var(--text-muted)",
                                border: status === "absent" ? "1px solid #ff4444" : "1px solid var(--border-muted)"
                              }}
                              onClick={() => toggleAttendance(member.id, status)}
                            >
                              ❌ Absent
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Analytics Section */}
              <div className="glass-panel" style={{ marginTop: "24px", gridColumn: "span 2", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  📊 Gym Activity & Attendance Analytics
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  {/* Card 1: Peak Traffic Hours */}
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-muted)", padding: "16px", borderRadius: "12px" }}>
                    <h4 style={{ fontSize: "0.9rem", color: "var(--primary)", marginBottom: "12px" }}>🕒 Peak Check-in Hours (Traffic Slots)</h4>
                    {Object.keys(analyticsData.peakHours).length === 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
                        Waiting for member check-in history to map peak slots.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {Object.entries(analyticsData.peakHours).map(([hour, count]: any) => {
                          const maxCount = Math.max(...Object.values(analyticsData.peakHours) as number[]) || 1;
                          const pct = (count / maxCount) * 100;
                          return (
                            <div key={hour} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span style={{ fontSize: "0.8rem", width: "45px" }}>{hour}</span>
                              <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                                <div style={{ background: "var(--primary)", width: `${pct}%`, height: "100%", borderRadius: "6px", transition: "width 0.4s ease" }}></div>
                              </div>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>{count} scans</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Card 2: Weekly Active Trend */}
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-muted)", padding: "16px", borderRadius: "12px" }}>
                    <h4 style={{ fontSize: "0.9rem", color: "var(--accent-orange)", marginBottom: "12px" }}>📅 Daily Check-in Volume (Past 7 Days)</h4>
                    {Object.keys(analyticsData.weeklyAttendance).length === 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
                        No weekly logging activity found.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {Object.entries(analyticsData.weeklyAttendance).map(([date, count]: any) => {
                          const maxCount = Math.max(...Object.values(analyticsData.weeklyAttendance) as number[]) || 1;
                          const pct = (count / maxCount) * 100;
                          return (
                            <div key={date} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span style={{ fontSize: "0.8rem", width: "80px" }}>{date}</span>
                              <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                                <div style={{ background: "var(--accent-orange)", width: `${pct}%`, height: "100%", borderRadius: "6px", transition: "width 0.4s ease" }}></div>
                              </div>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>{count} scans</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminTab === "leads" && (
            <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "20px" }}>
              {/* Column 1: Add New Lead / Enquiry */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>📝 Register Walk-in Lead</h3>
                <form onSubmit={submitNewLead} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group">
                    <label>Lead / Prospect Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Amit Sharma"
                      className="form-input"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>WhatsApp Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. +919876543210"
                      className="form-input"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      required
                    />
                    <p style={{ color: "var(--text-dim)", fontSize: "0.7rem", marginTop: "4px" }}>
                      We will dynamically follow up with this prospect on this WhatsApp number using human-like messages.
                    </p>
                  </div>
                  <button className="btn" type="submit" disabled={savingLead} style={{ marginTop: "10px", width: "100%" }}>
                    {savingLead ? "Registering Prospect..." : "🚀 Register & Send WhatsApp Welcome"}
                  </button>
                </form>
              </div>

              {/* Column 2: Lead Pipeline Lists */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>📊 WhatsApp Follow-up Pipeline</h3>
                {leads.length === 0 ? (
                  <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No enquiries registered yet. Fill the form on the left to start follow-up sequences.
                  </div>
                ) : (
                  <div style={{ overflowY: "auto", maxHeight: "450px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {leads.map((l) => (
                      <div 
                        key={l.id} 
                        style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-muted)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "8px" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{l.name}</span>
                          <span 
                            style={{ 
                              fontSize: "0.7rem", 
                              fontWeight: 700,
                              textTransform: "uppercase", 
                              padding: "2px 8px", 
                              borderRadius: "10px", 
                              background: l.status === "converted" ? "rgba(34, 197, 94, 0.2)" : l.status === "not_interested" ? "rgba(239, 68, 68, 0.2)" : "rgba(234, 179, 8, 0.2)",
                              color: l.status === "converted" ? "#22c55e" : l.status === "not_interested" ? "#ff8888" : "#eab308"
                            }}
                          >
                            {l.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          📞 Phone: <code>{l.phone_number}</code>
                        </div>
                        {l.last_followup_at && (
                          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                            ⏰ Last Contact: {new Date(l.last_followup_at).toLocaleString()}
                          </div>
                        )}
                        
                        {l.status === "pending" && (
                          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                            <button 
                              className="btn" 
                              style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem", background: "var(--success)", color: "#000" }}
                              onClick={() => toggleLeadStatus(l.id, "converted")}
                            >
                              🤝 Converted
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem" }}
                              onClick={() => toggleLeadStatus(l.id, "not_interested")}
                            >
                              ❌ Unsubscribe
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Multi-Tenant WhatsApp Settings Card */}
          <div className="glass-panel" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>⚙️ Gym Multi-Tenant WhatsApp Settings</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "-6px" }}>
              Configure your gym's custom Twilio API parameters. This ensures all alerts and interactive messages are routed through your gym's branded WhatsApp phone number.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "8px" }}>
              <div className="form-group">
                <label>Twilio Account SID</label>
                <input 
                  type="text" 
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx" 
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Twilio Auth Token</label>
                <input 
                  type="password" 
                  placeholder="your_auth_token" 
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Twilio WhatsApp Sender Number</label>
                <input 
                  type="text" 
                  placeholder="whatsapp:+14155238886" 
                  value={twilioSenderNumber}
                  onChange={(e) => setTwilioSenderNumber(e.target.value)}
                />
              </div>
            </div>
            <button 
              className="btn" 
              style={{ width: "fit-content", alignSelf: "flex-end", marginTop: "10px", padding: "10px 24px" }}
              onClick={() => saveUserProfile(workoutParams)}
            >
              💾 Save Custom WhatsApp Keys
            </button>
          </div>
        </main>

        {/* Modal: Diet & Workout Plan Builder */}
        {modalOpen && selectedMemberForPlan && (
          <div className="modal-backdrop">
            <div className="glass-panel modal-content" style={{ maxWidth: "700px", width: "95%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
                <h3>Assign Workout & Diet: {selectedMemberForPlan.username}</h3>
                <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => setModalOpen(false)}>✕</button>
              </div>

              {/* AI Assistant suggest buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "10px" }}>
                <div>
                  <h4 style={{ fontSize: "0.9rem" }}>🤖 Gym AI Co-Pilot</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Uses Gemini to suggest custom plans matching member goals.</p>
                </div>
                <button className="btn" disabled={generatingAiPlan} onClick={handleAiSuggestPlan}>
                  {generatingAiPlan ? "Thinking..." : "💡 AI Generate Suggestion"}
                </button>
              </div>

              {/* Day Selector */}
              <div className="glass-panel" style={{ padding: "12px", display: "flex", gap: "16px", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>📅 Day of the Week:</span>
                <select 
                  className="form-input" 
                  style={{ maxWidth: "200px", padding: "6px", background: "var(--bg-dark)", border: "1px solid var(--border-muted)", color: "var(--text-main)", borderRadius: "8px" }}
                  value={builderDay}
                  onChange={(e) => {
                    const nextDay = e.target.value;
                    setBuilderDay(nextDay);
                    loadMemberPlan(selectedMemberForPlan, nextDay);
                  }}
                >
                  <option value="Monday">Monday (Chest)</option>
                  <option value="Tuesday">Tuesday (Back)</option>
                  <option value="Wednesday">Wednesday (Legs)</option>
                  <option value="Thursday">Thursday (Shoulders)</option>
                  <option value="Friday">Friday (Arms)</option>
                  <option value="Saturday">Saturday (Cardio/Abs)</option>
                  <option value="Sunday">Sunday (Rest)</option>
                </select>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  (Changing the day preloads the workout & diet routines for that specific day)
                </span>
              </div>

              {/* Builder Content Tabs / Inputs */}
              <div>
                <h4 style={{ marginBottom: "10px" }}>🏋️ Workout Routine Details</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {builderWorkout.map((ex, idx) => (
                    <div key={idx} className="glass-panel" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input 
                          type="text" 
                          placeholder="Exercise Name" 
                          className="form-input" 
                          style={{ flex: 2 }}
                          value={ex.name} 
                          onChange={(e) => {
                            const newW = [...builderWorkout];
                            newW[idx].name = e.target.value;
                            setBuilderWorkout(newW);
                          }}
                        />
                        <input 
                          type="number" 
                          placeholder="Active (s)" 
                          className="form-input" 
                          style={{ flex: 1 }}
                          value={ex.duration}
                          onChange={(e) => {
                            const newW = [...builderWorkout];
                            newW[idx].duration = parseInt(e.target.value) || 30;
                            setBuilderWorkout(newW);
                          }}
                        />
                        <input 
                          type="number" 
                          placeholder="Rest (s)" 
                          className="form-input" 
                          style={{ flex: 1 }}
                          value={ex.rest}
                          onChange={(e) => {
                            const newW = [...builderWorkout];
                            newW[idx].rest = parseInt(e.target.value) || 15;
                            setBuilderWorkout(newW);
                          }}
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Coaching Tip / Advice" 
                        className="form-input"
                        value={ex.tip} 
                        onChange={(e) => {
                          const newW = [...builderWorkout];
                          newW[idx].tip = e.target.value;
                          setBuilderWorkout(newW);
                        }}
                      />
                    </div>
                  ))}
                  <button 
                    className="btn btn-secondary" 
                    style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: "0.8rem" }}
                    onClick={() => setBuilderWorkout([...builderWorkout, { name: "", duration: 30, rest: 15, description: "", muscleGroup: "", tip: "" }])}
                  >
                    ➕ Add Exercise
                  </button>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: "10px" }}>🥗 Diet & Meal Plan Details</h4>
                <div className="grid-2" style={{ gap: "10px" }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Breakfast</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={builderMeal.Breakfast} 
                      onChange={(e) => setBuilderMeal({ ...builderMeal, Breakfast: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Lunch</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={builderMeal.Lunch} 
                      onChange={(e) => setBuilderMeal({ ...builderMeal, Lunch: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Snack</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={builderMeal.Snack} 
                      onChange={(e) => setBuilderMeal({ ...builderMeal, Snack: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Dinner</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={builderMeal.Dinner} 
                      onChange={(e) => setBuilderMeal({ ...builderMeal, Dinner: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: "10px", marginTop: "10px" }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Macros (Carbs, Protein, Fat)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. C: 150g, P: 180g, F: 60g"
                      value={builderMeal.Macros?.Protein ? `Carbs: ${builderMeal.Macros.Carbs}, Protein: ${builderMeal.Macros.Protein}, Fat: ${builderMeal.Macros.Fat}` : builderMeal.Macros} 
                      onChange={(e) => setBuilderMeal({ ...builderMeal, Macros: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Micros (Fiber, Vitamins)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Fiber: 30g, Multivitamin"
                      value={builderMeal.Micros?.Fiber ? `Fiber: ${builderMeal.Micros.Fiber}, Vitamin: ${builderMeal.Micros.Vitamin}` : builderMeal.Micros} 
                      onChange={(e) => setBuilderMeal({ ...builderMeal, Micros: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--border-muted)", paddingTop: "14px", marginTop: "10px" }}>
                <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn" onClick={saveAssignedPlan}>💾 Save & Assign Plan</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Custom Text Message */}
        {customMsgModalOpen && selectedMemberForMsg && (
          <div className="modal-backdrop">
            <div className="glass-panel modal-content" style={{ maxWidth: "450px", width: "95%", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
                <h3>Send Custom Alert: {selectedMemberForMsg.username}</h3>
                <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => setCustomMsgModalOpen(false)}>✕</button>
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp Message Content</label>
                <textarea 
                  className="form-input" 
                  rows={4}
                  style={{ width: "100%", background: "rgba(0,0,0,0.2)", color: "#fff", resize: "none", padding: "10px" }}
                  placeholder="Hey, we missed you at the gym today! Consistency is what builds champion habits. Let us know if you face any issues."
                  value={customMsgText}
                  onChange={(e) => setCustomMsgText(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setCustomMsgModalOpen(false)}>Cancel</button>
                <button className="btn" onClick={sendAdminCustomMessage}>🚀 Send Notification</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Bulk Broadcast Announcement */}
        {broadcastModalOpen && (
          <div className="modal-backdrop">
            <div className="glass-panel modal-content" style={{ maxWidth: "500px", width: "95%", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
                <h3>📢 Broadcast Announcement to All Gym Members</h3>
                <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => setBroadcastModalOpen(false)}>✕</button>
              </div>
              <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid #eab308", color: "#f59e0b", padding: "10px", borderRadius: "8px", fontSize: "0.75rem" }}>
                ⚠️ <strong>Note:</strong> This will send a WhatsApp notification broadcast in parallel to all active gym members currently linked to your trainer code using your configured Twilio settings.
              </div>
              <div className="form-group">
                <label className="form-label">Broadcast Announcement Message</label>
                <textarea 
                  className="form-input" 
                  rows={4}
                  style={{ width: "100%", background: "rgba(0,0,0,0.2)", color: "#fff", resize: "none", padding: "10px" }}
                  placeholder="Type your general gym notice here... e.g. Gym will be closed this Friday morning for renovation work."
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setBroadcastModalOpen(false)}>Cancel</button>
                <button className="btn" style={{ background: "var(--accent-orange)", color: "#000" }} onClick={handleSendBroadcast} disabled={sendingBroadcast || !broadcastMsg}>
                  {sendingBroadcast ? "Sending Broadcast..." : "🚀 Send WhatsApp Broadcast"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (role === "super_admin") {
    return (
      <div className="app-container theme-Max" style={{ padding: "8px 10px", minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0a 0%, #121212 100%)" }}>
        {/* Super Admin Desktop Header */}
        <header className="navbar" style={{ padding: "10px 10px", margin: "0 0 16px 0", borderRadius: "12px", border: "1px solid var(--border-muted)" }}>
          <div className="brand" style={{ gap: "6px" }}>
            <span className="brand-icon">👑</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>FLEXAI // PLATFORM</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--error)", border: "1px dashed var(--error)", borderRadius: "8px" }} onClick={handleSignOut}>
              Logout
            </button>
          </div>
        </header>

        {/* Super Admin Content Area */}
        <main className="main-content" style={{ padding: 0 }}>
          {/* Quick Platform Metrics */}
          <div className="grid-3" style={{ marginBottom: "16px", gap: "8px" }}>
            <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "12px", border: "1px solid var(--border-muted)" }}>
              <div style={{ fontSize: "1.2rem" }}>🏢</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "2px", color: "var(--primary)" }}>{globalGymOwners.length}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Gym Owners</div>
            </div>
            <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "12px", border: "1px solid var(--border-muted)" }}>
              <div style={{ fontSize: "1.2rem" }}>👥</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "2px", color: "var(--accent-orange)" }}>{globalGymMembers.length}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Global Members</div>
            </div>
            <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "12px", border: "1px solid var(--border-muted)" }}>
              <div style={{ fontSize: "1.2rem" }}>🟢</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "2px", color: "#22c55e" }}>
                {globalGymOwners.filter(owner => owner.is_active !== false).length}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Active Gyms</div>
            </div>
          </div>

          {/* Sub-tab Switcher (Native Segmented Style) */}
          <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "10px", marginBottom: "16px", border: "1px solid var(--border-muted)" }}>
            <button 
              className="btn" 
              style={{ flex: 1, padding: "8px", fontSize: "0.75rem", borderRadius: "8px", background: superTab === "owners" ? "var(--primary)" : "transparent", color: superTab === "owners" ? "#000" : "var(--text-muted)", border: "none", transition: "all 0.2s ease" }}
              onClick={() => setSuperTab("owners")}
            >
              🏢 Gym Owners
            </button>
            <button 
              className="btn" 
              style={{ flex: 1, padding: "8px", fontSize: "0.75rem", borderRadius: "8px", background: superTab === "members" ? "var(--primary)" : "transparent", color: superTab === "members" ? "#000" : "var(--text-muted)", border: "none", transition: "all 0.2s ease" }}
              onClick={() => setSuperTab("members")}
            >
              👥 All Members
            </button>
          </div>

          {/* Tab 1: Manage Gym Owners */}
          {superTab === "owners" && (
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>🏢 Registered Gym Owners</h3>
                <button className="btn" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={fetchSuperAdminData}>
                  🔄 Refresh Directory
                </button>
              </div>

              {globalGymOwners.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  No Gym Owners registered yet on the platform.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {globalGymOwners.map((owner) => {
                    const hasTwilio = !!(owner.twilio_account_sid && owner.twilio_sender_number);
                    const linkedMembers = globalGymMembers.filter(m => m.gym_owner_id === owner.id).length;
                    const active = owner.is_active !== false;
                    return (
                      <div 
                        key={owner.id} 
                        style={{ 
                          background: "rgba(255,255,255,0.02)", 
                          border: "1px solid var(--border-muted)", 
                          borderRadius: "12px", 
                          padding: "10px 12px",
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "8px",
                          fontSize: "0.8rem"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff" }}>{owner.username}</span>
                          <span style={{ 
                            fontSize: "0.65rem", 
                            fontWeight: 700, 
                            padding: "2px 6px", 
                            borderRadius: "8px", 
                            background: active ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: active ? "#22c55e" : "#ff8888" 
                          }}>
                            {active ? "Active" : "Suspended"}
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", color: "var(--text-muted)", fontSize: "0.72rem" }}>
                          <div>🔑 Code: <code style={{ color: "var(--accent-orange)" }}>{owner.id.slice(0, 8)}...</code></div>
                          <div>👥 {linkedMembers} members</div>
                          <div style={{ color: hasTwilio ? "#22c55e" : "var(--text-dim)" }}>
                            {hasTwilio ? "💬 WhatsApp Setup: OK" : "💬 WhatsApp Setup: No"}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                          <button 
                            className="btn"
                            style={{ 
                              padding: "4px 8px", 
                              fontSize: "0.7rem", 
                              borderRadius: "8px",
                              background: active ? "rgba(239, 68, 68, 0.15)" : "var(--primary)", 
                              color: active ? "#ff8888" : "#000",
                              border: active ? "1px solid rgba(255, 68, 68, 0.3)" : "none",
                              width: "100%",
                              textAlign: "center"
                            }}
                            onClick={() => toggleAccountActive(owner.id, active)}
                          >
                            {active ? "🚫 Suspend Account" : "🟢 Reactivate Account"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Global Members Directory */}
          {superTab === "members" && (
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>👥 Platform Registered Members</h3>
                <button className="btn" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={fetchSuperAdminData}>
                  🔄 Refresh Directory
                </button>
              </div>

              {globalGymMembers.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  No Gym Members registered yet on the platform.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {globalGymMembers.map((member) => {
                    const active = member.is_active !== false;
                    const hasBio = !!(member.age || member.weight || member.height);
                    return (
                      <div 
                        key={member.id} 
                        style={{ 
                          background: "rgba(255,255,255,0.02)", 
                          border: "1px solid var(--border-muted)", 
                          borderRadius: "12px", 
                          padding: "10px 12px",
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "8px",
                          fontSize: "0.8rem"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff" }}>{member.username}</span>
                          <span style={{ 
                            fontSize: "0.65rem", 
                            fontWeight: 700, 
                            padding: "2px 6px", 
                            borderRadius: "8px", 
                            background: active ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: active ? "#22c55e" : "#ff8888" 
                          }}>
                            {active ? "Active" : "Suspended"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", color: "var(--text-muted)", fontSize: "0.72rem" }}>
                          <div>🎯 Goal: <span style={{ color: "#fff" }}>{member.goal}</span></div>
                          <div>📞 WhatsApp: <code>{member.whatsapp_number || "None"}</code></div>
                          {hasBio ? (
                            <div>🧬 Bio: {member.age} yrs / {member.height}cm / {member.weight}kg (BMI: {member.bmi})</div>
                          ) : (
                            <div style={{ color: "var(--text-dim)" }}>🧬 Bio: No biometrics configured</div>
                          )}
                          <div>🏢 Trainer ID: <code style={{ fontSize: "0.7rem" }}>{member.gym_owner_id ? member.gym_owner_id.slice(0, 8) + "..." : "Direct"}</code></div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                          <button 
                            className="btn"
                            style={{ 
                              padding: "4px 8px", 
                              fontSize: "0.7rem", 
                              borderRadius: "8px",
                              background: active ? "rgba(239, 68, 68, 0.15)" : "var(--primary)", 
                              color: active ? "#ff8888" : "#000",
                              border: active ? "1px solid rgba(255, 68, 68, 0.3)" : "none",
                              width: "100%",
                              textAlign: "center"
                            }}
                            onClick={() => toggleAccountActive(member.id, active)}
                          >
                            {active ? "🚫 Deactivate Member" : "🟢 Activate Member"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className={`app-container theme-${selectedTrainer}`}>
      {/* Desktop Header */}
      <header className="navbar">
        <div className="brand" onClick={() => setActiveTab("dashboard")} style={{ cursor: "pointer" }}>
          <span className="brand-icon">⚡</span>
          <span>FLEXAI // {username || "ATHLETE"}</span>
        </div>
        
        <nav className="nav-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "workout" ? "active" : ""}`}
            onClick={() => setActiveTab("workout")}
          >
            Workout Builder
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "live" ? "active" : ""}`}
            onClick={() => {
              if (!workoutActive && !workoutPlan) {
                alert("Please build and generate a workout plan first!");
              } else {
                setActiveTab("live");
              }
            }}
          >
            {workoutActive ? "🔴 Live Player" : "Live Player"}
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "nutrition" ? "active" : ""}`}
            onClick={() => setActiveTab("nutrition")}
          >
            Nutrition Planner
          </button>
        </nav>

        {/* Global toggles / stats */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button 
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "8px" }}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Muted"}
          </button>
          <button 
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "8px", border: "1px dashed var(--error)", color: "var(--error)" }}
            onClick={handleSignOut}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <main className="main-content">
        {errorMsg && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--error)",
            color: "#ff8888",
            padding: "12px 16px",
            borderRadius: "14px",
            fontSize: "0.85rem"
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="glass-panel glow-primary" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Linked Trainer Panel */}
            {gymOwnerId && (
              <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid var(--primary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "6px" }}>🏫 Linked Gym Trainer</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Connected with Trainer Code: <code style={{ color: "var(--accent-orange)", fontWeight: 700 }}>{gymOwnerId}</code>. Ask coaching queries directly on WhatsApp!
                  </p>
                </div>
                <button 
                  className="btn" 
                  style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  onClick={async () => {
                    try {
                      const res = await fetch(getApiUrl("/api/admin/mark-attendance"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          memberId: user.id,
                          status: "present"
                        })
                      });
                      if (res.ok) {
                        alert("✅ Checked-in successfully today! Trainer notified.");
                      }
                    } catch (e) {
                      console.error("Check-in error:", e);
                    }
                  }}
                >
                  📝 Check-in Today
                </button>
              </div>
            )}

            <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "1.6rem" }}>Select Your AI Gym Coach</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Select a trainer card below. The interface theme, fonts, prompts, and spoken speech synthesis change immediately.
                </p>
              </div>
              {user?.offline && (
                <div style={{ background: "rgba(249, 115, 22, 0.1)", border: "1px solid var(--accent-orange)", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", color: "var(--accent-orange)", fontWeight: 700 }}>
                  🚨 Running in Offline Demo Mode
                </div>
              )}
            </div>

            {/* Trainer Cards */}
            <div className="grid-3">
              {/* Max */}
              <div 
                className={`trainer-card card-Max ${selectedTrainer === "Max" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Max")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-orange)" }}>
                  💪
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-orange)", color: "#000" }}>Strength</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Max</div>
                  <div className="trainer-specialty">Strength & Muscle Overload</div>
                  <p className="trainer-bio">
                    Dedicated strength specialist. Focuses on heavy weights, perfect range of motion, and high-energy encouragement.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.8rem", borderRadius: "10px", padding: "8px" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Max"); }}
                  >
                    🗣️ Hear Intro
                  </button>
                </div>
              </div>

              {/* Serena */}
              <div 
                className={`trainer-card card-Serena ${selectedTrainer === "Serena" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Serena")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-violet)" }}>
                  🧘
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-violet)", color: "#000" }}>Yoga/Core</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Serena</div>
                  <div className="trainer-specialty">Yoga Flow & Mobility</div>
                  <p className="trainer-bio">
                    Breath-focused mindfulness guide. Emphasizes core integration, functional flexibility, and joint longevity.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.8rem", borderRadius: "10px", padding: "8px" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Serena"); }}
                  >
                    🗣️ Hear Intro
                  </button>
                </div>
              </div>

              {/* Leo */}
              <div 
                className={`trainer-card card-Leo ${selectedTrainer === "Leo" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Leo")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-pink)" }}>
                  ⚡
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-pink)", color: "#000" }}>HIIT</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Leo</div>
                  <div className="trainer-specialty">HIIT & Metabolic Conditioning</div>
                  <p className="trainer-bio">
                    Relentless high-speed trainer. Promotes explosive movements, agility loops, and sweating to exhaustion.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.8rem", borderRadius: "10px", padding: "8px" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Leo"); }}
                  >
                    🗣️ Hear Intro
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid-3" style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "20px" }}>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                <span style={{ fontSize: "1.5rem" }}>🏋️</span>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, margin: "6px 0" }}>{totalWorkouts}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Sessions Completed</div>
              </div>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                <span style={{ fontSize: "1.5rem" }}>🔥</span>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, margin: "6px 0" }}>{caloriesBurned} kcal</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Est. Calories Burned</div>
              </div>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                <span style={{ fontSize: "1.5rem" }}>⚡</span>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, margin: "6px 0" }}>{streakCount} Days</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Consistency Streak</div>
              </div>
            </div>

            {/* Profile Settings Card */}
            <div className="glass-panel" style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "12px" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "14px" }}>🔧 Custom Profile Parameters</h3>
              
              <div className="grid-2" style={{ gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">WhatsApp Contact Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. +919876543210"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                  <p style={{ color: "var(--text-dim)", fontSize: "0.7rem", marginTop: "4px" }}>
                    Required to receive daily briefings and text messages.
                  </p>
                </div>

                <div style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(0,255,170,0.05)", border: "1px solid rgba(0,255,170,0.15)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700, marginBottom: "4px" }}>✅ WhatsApp Integration Active</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Messages are sent via platform's TextMeBot account. Just add your number above and save.</div>
                </div>
              </div>

              {/* Biometrics Settings Row */}
              <div style={{ marginTop: "14px", borderTop: "1px dashed var(--border-muted)", paddingTop: "14px" }}>
                <h4 style={{ fontSize: "0.9rem", marginBottom: "10px", color: "var(--primary)" }}>🧬 Personal Biometrics (AI Coach Context)</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Age (years)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 25"
                      value={age}
                      onChange={(e) => setAge(e.target.value === "" ? "" : parseInt(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Height (cm)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 175"
                      value={height}
                      onChange={(e) => setHeight(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Weight (kg)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 70"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>Medical Conditions / Food Allergies / Injuries</label>
                  <textarea 
                    className="form-input" 
                    placeholder="e.g. Lower back pain, peanut allergy, bad left knee"
                    style={{ minHeight: "60px", resize: "vertical", fontFamily: "inherit", padding: "8px", background: "var(--bg-dark)", border: "1px solid var(--border-muted)", color: "var(--text-main)", borderRadius: "8px" }}
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                  />
                  <p style={{ color: "var(--text-dim)", fontSize: "0.7rem", marginTop: "4px" }}>
                    Your AI Coach will cross-reference this to exclude unsafe exercises and customize diets.
                  </p>
                </div>
              </div>

              <button 
                className="btn" 
                style={{ padding: "8px 14px", fontSize: "0.8rem", borderRadius: "10px", marginTop: "14px", width: "100%" }}
                onClick={() => saveUserProfile(workoutParams)}
              >
                Save Profile Settings
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Workout Builder */}
        {activeTab === "workout" && (
          <div className="grid-2">
            {/* Left Parameters */}
            <div className="glass-panel glow-primary" style={{ height: "fit-content" }}>
              {assignedPlan && (
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--primary)", padding: "10px", borderRadius: "10px", marginBottom: "16px" }}>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>✨ Gym Plan Preloaded</span>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Your personal trainer has preloaded a customized routine for you. You can launch it in the Player tab!</p>
                </div>
              )}

              <h2 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Configure Your AI Routine</h2>
              
              <div className="form-group">
                <label className="form-label">Active Goal</label>
                <select 
                  className="form-select"
                  value={workoutParams.goal}
                  onChange={(e) => setWorkoutParams({...workoutParams, goal: e.target.value})}
                >
                  <option value="Build Muscle">💪 Build Muscle & Strength</option>
                  <option value="Lose Weight">🔥 Lose Weight (HIIT Cardio)</option>
                  <option value="Flexibility">🧘 Yoga & Core Mobility</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Fitness Level</label>
                <select 
                  className="form-select"
                  value={workoutParams.level}
                  onChange={(e) => setWorkoutParams({...workoutParams, level: e.target.value})}
                >
                  <option value="Beginner">Beginner (Perfecting form)</option>
                  <option value="Intermediate">Intermediate (Standard splits)</option>
                  <option value="Advanced">Advanced (High reps, low rest)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Workout Duration (Minutes)</label>
                <select 
                  className="form-select"
                  value={workoutParams.duration}
                  onChange={(e) => setWorkoutParams({...workoutParams, duration: parseInt(e.target.value)})}
                >
                  <option value={15}>15 Mins (Express Blast)</option>
                  <option value={30}>30 Mins (Recommended)</option>
                  <option value={45}>45 Mins (Full Session)</option>
                  <option value={60}>60 Mins (Elite Conditioning)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Available Equipment</label>
                <select 
                  className="form-select"
                  value={workoutParams.equipment}
                  onChange={(e) => setWorkoutParams({...workoutParams, equipment: e.target.value})}
                >
                  <option value="Bodyweight Only">🏃 Bodyweight Only (No Gear)</option>
                  <option value="Dumbbells">🏋️ Dumbbells</option>
                  <option value="Full Gym">🏬 Full Gym Infrastructure</option>
                </select>
              </div>

              <button 
                className="btn" 
                style={{ width: "100%", marginTop: "8px" }}
                disabled={workoutGenerating}
                onClick={fetchWorkout}
              >
                {workoutGenerating ? "🤖 Generating Plan..." : `Generate Plan with Coach ${selectedTrainer}`}
              </button>
            </div>

            {/* Right Display */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Today's Training Sheet</h3>
                {workoutPlan && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                    onClick={sendWhatsAppBrief}
                    disabled={sendingWhatsApp}
                  >
                    {sendingWhatsApp ? "Sending..." : "📲 Send to WhatsApp"}
                  </button>
                )}
              </div>

              {workoutPlan ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {workoutPlan.map((ex, idx) => (
                    <div key={idx} className="exercise-row">
                      <div className="exercise-number">{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{ex.name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>
                          ⏱️ {ex.duration}s active / {ex.rest}s rest • Muscle: {ex.muscleGroup}
                        </div>
                        <p style={{ fontSize: "0.75rem", marginTop: "4px", color: "var(--text-dim)", fontStyle: "italic" }}>
                          💡 Tip: {ex.tip}
                        </p>
                      </div>
                    </div>
                  ))}

                  <button 
                    className="btn" 
                    style={{ width: "100%", marginTop: "10px", fontSize: "0.9rem" }}
                    onClick={startWorkoutSession}
                  >
                    🚀 Start Session in Live Player
                  </button>
                </div>
              ) : (
                <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No routine loaded. Adjust parameters and click "Generate Plan" to fetch workouts from Gemini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Live Player */}
        {activeTab === "live" && (
          <div className="grid-2">
            {/* Player Panel */}
            <div className="glass-panel glow-primary" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", position: "relative" }}>
              
              {/* Beating heart rate simulator */}
              <div className="pulse-heart-rate">
                💓 <span style={{ color: "var(--accent-pink)" }}>{simulatedHeartRate}</span> <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>BPM</span>
              </div>

              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "1.4rem" }}>
                  {timerMode === "exercise" ? "🏋️ WORKOUT ACTION" : timerMode === "rest" ? "🧘 BREATHING REST" : "🏆 COOLDOWN COMPLETE"}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Coached by FlexAI Coach {selectedTrainer}
                </p>
              </div>

              {/* Responsive SVG Circular Player */}
              <div className="circular-player-wrapper">
                <svg width="220" height="220" className="circular-player">
                  <circle cx="110" cy="110" r={radius} className="circle-bg" />
                  <circle 
                    cx="110" 
                    cy="110" 
                    r={radius} 
                    className="circle-progress" 
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className="timer-center-text">
                  <span className="timer-seconds">{timeLeft}</span>
                  <span className="timer-label">seconds left</span>
                </div>
              </div>

              {workoutPlan && workoutPlan[currentExerciseIndex] && (
                <div style={{ textAlign: "center", maxWidth: "80%", margin: "0 auto" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                    {workoutPlan[currentExerciseIndex].name}
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "6px" }}>
                    {workoutPlan[currentExerciseIndex].description}
                  </p>
                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "8px", marginTop: "10px", border: "1px solid var(--border-muted)", fontSize: "0.75rem", fontStyle: "italic", color: "var(--primary)" }}>
                    💡 Tip: {workoutPlan[currentExerciseIndex].tip}
                  </div>
                </div>
              )}

              {/* Controls */}
              <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "320px", marginTop: "10px" }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={pauseWorkout}
                >
                  {workoutPaused ? "▶️ Resume" : "⏸️ Pause"}
                </button>
                <button 
                  className="btn" 
                  style={{ flex: 1, background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ff4444", color: "#ff8888" }}
                  onClick={() => {
                    setWorkoutActive(false);
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  }}
                >
                  ⏹️ Stop
                </button>
              </div>
            </div>

            {/* Chat Panel */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", height: "550px" }}>
              <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem" }}>💬 Live Interactive Coach</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>
                    Ask about posture, form, pain, or complain to receive motivation.
                  </p>
                </div>
                <span className={`status-dot ${wsConnected ? "online" : "offline"}`} />
              </div>

              {/* Chat Thread */}
              <div className="coach-chat-thread">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`coach-chat-bubble ${msg.sender}`}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "2px" }}>
                      {msg.sender === "user" ? "You" : msg.sender === "trainer" ? selectedTrainer : "System"}
                    </div>
                    <div>{msg.text}</div>
                    <span className="coach-chat-timestamp">{msg.timestamp}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Form */}
              <div className="coach-chat-input-area">
                <input 
                  type="text" 
                  className="coach-chat-input"
                  placeholder={`Ask Coach ${selectedTrainer}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChatMessage("");
                  }}
                />
                <button 
                  className="btn"
                  style={{ borderRadius: "10px", padding: "8px 14px", fontSize: "0.8rem" }}
                  onClick={() => sendChatMessage("")}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Nutrition Planner */}
        {activeTab === "nutrition" && (
          <div className="grid-2">
            {/* Input Configurator */}
            <div className="glass-panel glow-primary" style={{ height: "fit-content" }}>
              {assignedPlan && (
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--primary)", padding: "10px", borderRadius: "10px", marginBottom: "16px" }}>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>✨ Diet Plan Preloaded</span>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Your personal trainer has preloaded a customized diet plan for you. Check details on the right!</p>
                </div>
              )}

              <h2 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>AI Meal Plan Config</h2>

              <div className="form-group">
                <label className="form-label">Fitness Goal</label>
                <select 
                  className="form-select"
                  value={mealParams.goal}
                  onChange={(e) => setMealParams({...mealParams, goal: e.target.value})}
                >
                  <option value="Lose Weight">📉 Weight Loss / Shred</option>
                  <option value="Build Muscle">📈 Lean Bulk / Muscle Gain</option>
                  <option value="Maintain Fitness">⚖️ Maintenance / Performance</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Dietary Style</label>
                <select 
                  className="form-select"
                  value={mealParams.dietType}
                  onChange={(e) => setMealParams({...mealParams, dietType: e.target.value})}
                >
                  <option value="Balanced">Balanced (Clean eating)</option>
                  <option value="High Protein">High Protein / Low Carb</option>
                  <option value="Vegan">Vegan (100% Plant-based)</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Keto">Ketogenic (Low Carb, High Fat)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Calories: {mealParams.calories} kcal</label>
                <input 
                  type="range" 
                  min="1200" 
                  max="4000" 
                  step="100"
                  style={{
                    accentColor: "var(--primary)",
                    margin: "8px 0"
                  }}
                  value={mealParams.calories}
                  onChange={(e) => setMealParams({...mealParams, calories: parseInt(e.target.value)})}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  <span>1200 kcal</span>
                  <span>4000 kcal</span>
                </div>
              </div>

              <button 
                className="btn" 
                style={{ width: "100%", marginTop: "10px" }}
                onClick={fetchMealPlan}
                disabled={mealGenerating}
              >
                {mealGenerating ? "🤖 Planning Meals..." : "Generate Meal Plan with Gemini"}
              </button>
            </div>

            {/* Display Output */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Today's Diet Sheet</h3>
                {mealPlan && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                    onClick={sendWhatsAppBrief}
                    disabled={sendingWhatsApp}
                  >
                    {sendingWhatsApp ? "Sending..." : "📲 Send to WhatsApp"}
                  </button>
                )}
              </div>

              {!mealPlan ? (
                <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No meal schedule preloaded. Select details and generate your plan to request meal slots from AI.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Macros breakdown */}
                  <div className="macros-container">
                    <div className="macro-chip">
                      <div className="macro-val">{mealPlan.Macros?.Carbs || "45%"}</div>
                      <div className="macro-lbl">Carbs</div>
                    </div>
                    <div className="macro-chip" style={{ borderLeft: "1px solid var(--border-muted)" }}>
                      <div className="macro-val">{mealPlan.Macros?.Protein || "30%"}</div>
                      <div className="macro-lbl">Protein</div>
                    </div>
                    <div className="macro-chip" style={{ borderLeft: "1px solid var(--border-muted)" }}>
                      <div className="macro-val">{mealPlan.Macros?.Fat || "25%"}</div>
                      <div className="macro-lbl">Fat</div>
                    </div>
                  </div>

                  {mealPlan.Micros && (
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border-muted)", fontSize: "0.8rem", display: "flex", gap: "14px" }}>
                      <div>🧬 <strong>Fiber:</strong> {mealPlan.Micros.Fiber || "N/A"}</div>
                      <div>💊 <strong>Vitamin:</strong> {mealPlan.Micros.Vitamin || "N/A"}</div>
                    </div>
                  )}

                  {/* Meals display */}
                  <div className="meal-card" style={{ borderLeftColor: "var(--primary)" }}>
                    <div className="meal-time" style={{ color: "var(--primary)" }}>Breakfast</div>
                    <div className="meal-name">{mealPlan.Breakfast}</div>
                  </div>

                  <div className="meal-card" style={{ borderLeftColor: "var(--accent-orange)" }}>
                    <div className="meal-time" style={{ color: "var(--accent-orange)" }}>Lunch</div>
                    <div className="meal-name">{mealPlan.Lunch}</div>
                  </div>

                  <div className="meal-card" style={{ borderLeftColor: "var(--accent-pink)" }}>
                    <div className="meal-time" style={{ color: "var(--accent-pink)" }}>Snack</div>
                    <div className="meal-name">{mealPlan.Snack}</div>
                  </div>

                  <div className="meal-card" style={{ borderLeftColor: "var(--accent-violet)" }}>
                    <div className="meal-time" style={{ color: "var(--accent-violet)" }}>Dinner</div>
                    <div className="meal-name">{mealPlan.Dinner}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (PWA Essential) */}
      <nav className="mobile-nav-bar">
        <button 
          className={`mobile-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <span className="mobile-tab-btn-icon">🧘</span>
          <span>Coaches</span>
        </button>
        
        <button 
          className={`mobile-tab-btn ${activeTab === "workout" ? "active" : ""}`}
          onClick={() => setActiveTab("workout")}
        >
          <span className="mobile-tab-btn-icon">📋</span>
          <span>Builder</span>
        </button>
        
        <button 
          className={`mobile-tab-btn ${activeTab === "live" ? "active" : ""}`}
          onClick={() => {
            if (!workoutActive && !workoutPlan) {
              alert("Please generate a workout plan first!");
            } else {
              setActiveTab("live");
            }
          }}
        >
          <span className="mobile-tab-btn-icon">{workoutActive ? "🔴" : "⏱️"}</span>
          <span>{workoutActive ? "Live Session" : "Player"}</span>
        </button>
        
        <button 
          className={`mobile-tab-btn ${activeTab === "nutrition" ? "active" : ""}`}
          onClick={() => setActiveTab("nutrition")}
        >
          <span className="mobile-tab-btn-icon">🥗</span>
          <span>Diet</span>
        </button>
      </nav>
    </div>
  );
}
