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
    currentPage: "page-loading",
    loading: false
};

// --- Initialization ---
window.onload = function () {
    lucide.createIcons();
    initLiff();
};

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
    // Hide all pages
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    // Show target page
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add("active");
        state.currentPage = pageId;
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Update Bottom Nav
    updateBottomNav();

    // If chat page, focus and scroll
    if (pageId === "page-chat") {
        const msgContainer = document.getElementById("chat-messages");
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }
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
async function apiPost(action, data) {
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ action, data })
        });
        return await response.json();
    } catch (err) {
        console.error("API POST Error:", err);
        return { success: false, message: "Network error" };
    }
}

async function apiGet(action, params = {}) {
    try {
        const query = new URLSearchParams({ action, ...params }).toString();
        const response = await fetch(`${GAS_URL}?${query}`);
        return await response.json();
    } catch (err) {
        console.error("API GET Error:", err);
        return { success: false, message: "Network error" };
    }
}

// --- FAQ logic ---
async function loadHomeFaqs() {
    const res = await apiGet("faq_list", { pageSize: 3 });
    if (res.success && res.data.items) {
        const container = document.getElementById("home-faq-list");
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
    const search = document.getElementById("faq-search").value;
    const res = await apiGet("faq_list", { keyword: search });
    if (res.success && res.data.items) {
        const container = document.getElementById("faq-list");
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
                    ${faq.answer}
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
    appendMessage("user", message);

    state.loading = true;
    document.getElementById("chat-loading").classList.remove("hidden");
    const container = document.getElementById("chat-messages");
    container.scrollTop = container.scrollHeight;

    const res = await apiPost("chat_send", {
        lineUserId: state.user ? state.user.userId : "GUEST_UNKNOWN",
        message: message
    });

    state.loading = false;
    document.getElementById("chat-loading").classList.add("hidden");

    if (res.success) {
        const answer = res.data.answer || res.data.reply || "我現在不知道該怎麼回答。";
        appendMessage("bot", answer);
        if (res.data.handoff) {
            appendMessage("system", "💡 轉接中：AI 小助手似乎回不了這題，已為您標註客服，如需立即處理可點擊「轉人工」。");
        }
    } else {
        appendMessage("bot", "抱歉，我現在有點不舒服（連線異常），請稍後再試。");
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

function showFaqDetail(faq) {
    alert(faq.answer);
}

// Global bind
window.showPage = showPage;
window.askAbout = askAbout;
window.handleSendChat = handleSendChat;
window.showFaqDetail = showFaqDetail;
