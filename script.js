/**
 * AI Smart Customer Service - LIFF Frontend logic
 * Created by Antigravity AI
 */

// --- Configuration ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbxWA3boRKaltkq0bOb2YLNi3Cy1txtl7gupu9TbkwosOgk_11SerCk9yt1r6x5DynfPvQ/exec";
const LIFF_ID = "2009603120-IRZVrGzZ";

// --- State Management ---
let state = {
    user: null,
    settings: {},
    chat: [],
    lastChatId: "", // Track last seen message
    currentPage: "page-loading",
    loading: false,
    pollInterval: null
};

// --- Initialization ---
window.onload = function () {
    lucide.createIcons();
    initLiff();

    // Bind handoff button
    const handoffBtn = document.getElementById("btn-handoff");
    if (handoffBtn) {
        handoffBtn.onclick = handleHumanHandoff;
    }
};

async function handleHumanHandoff() {
    if (!state.user || state.loading) return;
    
    const confirmHandoff = confirm("即將為您轉接人工客服，轉接後 AI 將暫停自動回覆。確定要轉接嗎？");
    if (!confirmHandoff) return;

    state.loading = true;
    const res = await apiPost("handoff_toggle", {
        lineUserId: state.user.userId,
        mode: "human"
    });
    state.loading = false;

    if (res.success) {
        appendMessage("system", "✅ 已為您轉接真人客服。客服人員將儘快在此與您對話，請稍候。");
        // Update UI state
        const statusEl = document.querySelector(".text-green-500");
        if (statusEl) {
            statusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1"></span>真人服務中';
            statusEl.className = "flex items-center text-[10px] text-orange-500";
        }
    } else {
        alert("轉接失敗，請稍後再試。");
    }
}

async function initLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        const profile = await liff.getProfile();
        state.user = profile;

        // Update UI with profile
        document.getElementById("user-name").innerText = profile.displayName + " 👋";
        if (profile.pictureUrl) {
            document.getElementById("user-avatar").innerHTML = `<img src="${profile.pictureUrl}" class="w-full h-full object-cover">`;
        }

        // Bind member to backend
        await apiPost("member_bind", {
            lineUserId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
        });

        // Load settings
        const settingsRes = await apiGet("settings_list");
        if (settingsRes.success) {
            state.settings = settingsRes.data;
        }

        // Load Initial FAQs for Home
        loadHomeFaqs();

        // Finish Loading
        showPage("page-home");
    } catch (err) {
        console.error("LIFF Init Error:", err);
        // Better fallback for all environments to prevent stucking
        state.user = {
            userId: "U_GUEST_" + Math.floor(Math.random() * 100000),
            displayName: "访客用戶"
        };
        showPage("page-home");
        console.log("Using fallback guest user");
    } finally {
        const loader = document.getElementById("page-loading") || document.getElementById("loading-screen");
        if (loader) loader.classList.add("hidden");
    }
}

// --- Navigation ---
function showPage(pageId) {
    console.log("Switching to page:", pageId);
    // Hide all pages
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

    // Show target page
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add("active");
        state.currentPage = pageId;

        // Force scroll-to-top on all layers
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        target.scrollTop = 0;
    }

    // Auto-load data for specific pages
    if (pageId === 'page-faq') loadFullFaqs();
    if (pageId === 'page-home') loadHomeFaqs();
    
    // Polling Logic for Chat
    if (pageId === 'page-chat') {
        const msgContainer = document.getElementById("chat-messages");
        if (msgContainer) {
            msgContainer.innerHTML = ""; // Clear for fresh re-load from state/poll
            state.chat = []; // Clear local track
        }
        
        // Start polling if not already started
        if (!state.pollInterval) {
            state.pollInterval = setInterval(pollNewMessages, 2000);
            pollNewMessages(); // Initial immediate load
        }
    } else {
        // Stop polling if switching away from chat
        if (state.pollInterval) {
            clearInterval(state.pollInterval);
            state.pollInterval = null;
        }
    }

    // Update Bottom Nav UI
    updateBottomNav();
}

function updateBottomNav() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        const page = item.getAttribute("data-page");
        if (page === state.currentPage) {
            item.classList.add("bottom-nav-active");
        } else {
            item.classList.remove("bottom-nav-active");
        }
    });
}

// --- API Helpers ---
// --- API Helpers ---
async function apiCall(action, data = {}) {
    try {
        console.log(`[API Call] ${action}`, data);
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action, data })
        });
        const res = await response.json();
        console.log(`[API Response] ${action}`, res);
        return res;
    } catch (err) {
        console.error(`[API Error] ${action}`, err);
        return { success: false, message: "Network error" };
    }
}

// Alias for transition
const apiPost = apiCall;
const apiGet = apiCall;

// --- FAQ logic ---
async function loadHomeFaqs() {
    const res = await apiCall("faq_list", { pageSize: 3 });
    if (res.success && res.data && res.data.items) {
        const container = document.getElementById("home-faq-list");
        if (!container) return;
        container.innerHTML = "";
        res.data.items.forEach(faq => {
            const el = document.createElement("div");
            el.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group active:bg-slate-50";
            el.innerHTML = `
                <span class="text-sm font-medium text-slate-700">${faq.question}</span>
                <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-active:text-blue-500"></i>
            `;
            el.onclick = () => showFaqDetail(faq);
            container.appendChild(el);
        });
        lucide.createIcons();
    }
}

async function loadFullFaqs() {
    const searchInput = document.getElementById("faq-search");
    const search = searchInput ? searchInput.value : "";
    const res = await apiCall("faq_list", { keyword: search });
    if (res.success && res.data && res.data.items) {
        const container = document.getElementById("faq-list");
        if (!container) return;
        container.innerHTML = "";
        res.data.items.forEach(faq => {
            const el = document.createElement("div");
            el.className = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm";
            el.innerHTML = `
                <h3 class="font-bold text-slate-800 text-sm mb-2 flex items-start">
                    <span class="w-5 h-5 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center text-[10px] mr-2 mt-0.5 shrink-0">Q</span>
                    ${faq.question}
                </h3>
                <p class="text-slate-600 text-sm leading-relaxed">
                    ${faq.answer || "尚無答案"}
                </p>
                <div class="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                    <button class="text-blue-600 text-xs font-bold" onclick="askAbout('${faq.question}')">問更多對話 &rarr;</button>
                </div>
            `;
            container.appendChild(el);
        });
    }
}

document.getElementById("faq-search").oninput = loadFullFaqs;

function askAbout(question) {
    document.getElementById("chat-input").value = question;
    showPage("page-chat");
    handleSendChat();
}

// --- Chat logic ---
document.getElementById("chat-send").onclick = handleSendChat;
document.getElementById("chat-input").onkeypress = (e) => {
    if (e.key === "Enter") handleSendChat();
};

async function handleSendChat() {
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message || state.loading) return;

    input.value = "";
    state.loading = true;
    const container = document.getElementById("chat-messages");
    
    // UI Loading state
    document.getElementById("chat-loading").classList.remove("hidden");
    container.scrollTop = container.scrollHeight;

    const res = await apiCall("chat_send", {
        lineUserId: state.user ? state.user.userId : "GUEST_UNKNOWN",
        message: message
    });

    state.loading = false;
    document.getElementById("chat-loading").classList.add("hidden");

    if (res.success) {
        // Immediate polling to sync the view from DB
        await pollNewMessages();
    } else {
        alert("發送失敗，請檢查網路連線。");
    }
}

function appendMessage(role, text) {
    const container = document.getElementById("chat-messages");
    const msgDiv = document.createElement("div");

    if (role === "system") {
        msgDiv.className = "self-center my-4 px-6 py-2 bg-slate-200/50 rounded-full text-[10px] text-slate-500 font-medium max-w-[90%] text-center";
        msgDiv.innerText = text;
    } else {
        msgDiv.className = `chat-bubble chat-${role === "user" ? "user" : "bot text-sm"}`;
        msgDiv.innerText = text;
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// --- Ticket Logic ---
document.getElementById("contact-form").onsubmit = async (e) => {
    e.preventDefault();
    if (state.loading) return;

    const data = {
        lineUserId: state.user ? state.user.userId : "GUEST_FORM",
        category: document.getElementById("ticket-category").value,
        summary: document.getElementById("ticket-summary").value,
        phone: document.getElementById("ticket-phone").value,
        source: "liff_form"
    };

    if (!data.summary) {
        alert("請輸入問題描述");
        return;
    }

    state.loading = true;
    const res = await apiPost("ticket_create", data);
    state.loading = false;

    if (res.success) {
        alert("留言已成功送出！客服將盡快回覆。");
        showPage("page-home");
        // Reset form
        document.getElementById("contact-form").reset();
    } else {
        alert("送出失敗，請確認網路連線。");
    }
};

async function pollNewMessages() {
    if (!state.user || state.currentPage !== "page-chat") return;

    try {
        const res = await apiCall("conversation_detail", { lineUserId: state.user.userId });
        if (res.success && Array.isArray(res.data)) {
            const dbMessages = res.data.reverse(); // 將 DB 的「新到舊」轉為「舊到新」
            
            // 只有當訊息數目變動或最後一則 ID 不同時才重新渲染
            const lastDbMsg = dbMessages[dbMessages.length - 1];
            const lastStateMsg = state.chat[state.chat.length - 1];
            
            if (dbMessages.length !== state.chat.length || (lastDbMsg && lastStateMsg && lastDbMsg.id !== lastStateMsg.id)) {
                console.log("[Chat Sync] New messages found, re-rendering...");
                state.chat = dbMessages;
                renderChatList();
            }
        }
    } catch (err) {
        console.error("Poll error:", err);
    }
}

function renderChatList() {
    const container = document.getElementById("chat-messages");
    if (!container) return;
    
    container.innerHTML = "";
    state.chat.forEach(msg => {
        // 判斷角色類型：user 為右側，bot/agent 為左側
        const type = (msg.role === 'user') ? 'user' : 'bot';
        const displayRole = (msg.role === 'agent') ? '客服真人' : (msg.role === 'user' ? 'ME' : 'AI Assistant');
        
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement("div");
        
        if (type === "user") {
            div.className = "flex justify-end";
            div.innerHTML = `
                <div class="max-w-[80%] bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm">
                    <p class="text-sm leading-relaxed">${msg.message_text}</p>
                    <div class="flex items-center justify-end mt-1 opacity-50 text-[10px]">
                        <span>${time}</span>
                    </div>
                </div>
            `;
        } else {
            div.className = "flex justify-start";
            div.innerHTML = `
                <div class="max-w-[80%] bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                    <p class="text-sm text-slate-700 leading-relaxed">${msg.message_text}</p>
                    <div class="flex items-center justify-between mt-1 opacity-50 text-[10px] text-slate-400">
                        <span class="font-bold">${displayRole}</span>
                        <span>${time}</span>
                    </div>
                </div>
            `;
        }
        container.appendChild(div);
    });
    
    // 自動滾動到底部
    container.scrollTop = container.scrollHeight;
}

function showFaqDetail(faq) {
    alert(faq.answer);
}

// Global bind
window.showPage = showPage;
window.askAbout = askAbout;
window.handleSendChat = handleSendChat;
window.showFaqDetail = showFaqDetail;
