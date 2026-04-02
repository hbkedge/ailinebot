/**
 * AI Smart Customer Service - Admin Dashboard Logic
 * Created by Antigravity AI
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbxWA3boRKaltkq0bOb2YLNi3Cy1txtl7gupu9TbkwosOgk_11SerCk9yt1r6x5DynfPvQ/exec";

let state = {
    currentSection: 'dashboard',
    stats: {},
    faqs: [],
    conversations: [],
    tickets: [],
    activeUserId: null,
    loading: false
};

// --- Initialization ---
window.onload = function () {
    lucide.createIcons();
    loadDashboard();
};

// --- Router ---
function showSection(sectionId) {
    // UI Update
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));

    document.getElementById(`section-${sectionId}`).classList.add('active');
    document.querySelector(`[data-nav="${sectionId}"]`).classList.add('active');

    document.getElementById('section-title').innerText = getSectionName(sectionId);
    state.currentSection = sectionId;

    // Data Load
    if (sectionId === 'dashboard') loadDashboard();
    if (sectionId === 'faq') loadFaqs();
    if (sectionId === 'conversations') loadConversations();
    if (sectionId === 'tickets') loadTickets();
    if (sectionId === 'settings') loadSettings();
}

function getSectionName(id) {
    const names = {
        dashboard: '數據總覽',
        faq: 'FAQ 管理',
        conversations: '對話追蹤',
        tickets: '工單中心',
        settings: '系統設定'
    };
    return names[id] || id;
}

// --- Data Fetching ---
async function apiCall(action, method = 'GET', data = {}) {
    try {
        let response;
        if (method === 'GET') {
            const query = new URLSearchParams({ action, ...data }).toString();
            response = await fetch(`${GAS_URL}?${query}`);
        } else {
            response = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action, data })
            });
        }
        console.log(`API Call: ${action}`, data);
        return await response.json();
    } catch (err) {
        console.error("API Call Error:", err);
        return { success: false, message: "Network error: " + err.message };
    }
}

// --- Dashboard Logic ---
async function loadDashboard() {
    const res = await apiCall('dashboard_stats');
    if (res.success) {
        state.stats = res.data;
        document.getElementById('stat-users').innerText = res.data.totalUsers;
        document.getElementById('stat-conversations').innerText = res.data.totalConversations;
        document.getElementById('stat-hitrate').innerText = (res.data.faqHitRate * 100).toFixed(0) + '%';
        document.getElementById('stat-tickets').innerText = res.data.activeTickets;
    }

    const topFaqRes = await apiCall('report_top_faq');
    if (topFaqRes.success) {
        const container = document.getElementById('top-faq-list');
        container.innerHTML = "";
        topFaqRes.data.forEach(faq => {
            const row = document.createElement('div');
            row.className = "flex items-center justify-between p-4 bg-gray-50 rounded-2xl";
            row.innerHTML = `
                <div class="flex items-center space-x-4">
                    <span class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-blue-600 shadow-sm">${faq.hit_count}</span>
                    <span class="text-sm font-medium text-gray-700">${faq.question}</span>
                </div>
                <div class="text-[10px] uppercase font-bold text-gray-400">${faq.category}</div>
            `;
            container.appendChild(row);
        });
    }
}

// --- FAQ Logic ---
async function loadFaqs() {
    const res = await apiCall('faq_list');
    if (res.success) {
        state.faqs = res.data.items;
        renderFaqTable(res.data.items);
    }
}

function renderFaqTable(items) {
    const tbody = document.getElementById('faq-table-body');
    tbody.innerHTML = "";
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50/50 transition-all";
        tr.innerHTML = `
            <td class="px-6 py-4"><span class="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg uppercase">${item.category}</span></td>
            <td class="px-6 py-4">
                <div class="text-sm font-bold text-gray-800">${item.question}</div>
                <div class="text-[10px] text-gray-400 mt-1">${item.keywords}</div>
            </td>
            <td class="px-6 py-4 w-1/3"><p class="text-xs text-gray-600 line-clamp-2">${item.answer}</p></td>
            <td class="px-6 py-4"><span class="text-xs font-mono text-gray-400">${item.priority}</span></td>
            <td class="px-6 py-4 text-xs">
                ${item.enabled === 'Y' ?
                '<span class="text-green-500 font-bold">啟用中</span>' :
                '<span class="text-gray-400 font-bold">已停用</span>'}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center space-x-2">
                    <button onclick="editFaq('${item.id}')" class="p-2 bg-white text-blue-600 rounded-lg shadow-sm border border-gray-100 hover:bg-blue-50 transition-all">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteFaq('${item.id}')" class="p-2 bg-white text-red-500 rounded-lg shadow-sm border border-gray-100 hover:bg-red-50 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function editFaq(faqId) {
    const faq = state.faqs.find(f => f.id === faqId);
    if (!faq) return;
    openFaqModal(faqId);
}

// FAQ Modal
function openFaqModal(faqId = null) {
    const modal = document.getElementById('faq-modal');
    modal.classList.remove('hidden');
    document.getElementById('faq-modal-title').innerText = faqId ? "編輯 FAQ" : "新增 FAQ";

    if (faqId) {
        const faq = state.faqs.find(f => f.id === faqId);
        document.getElementById('modal-faq-id').value = faq.id;
        document.getElementById('modal-faq-category').value = faq.category;
        document.getElementById('modal-faq-priority').value = faq.priority;
        document.getElementById('modal-faq-question').value = faq.question;
        document.getElementById('modal-faq-keywords').value = faq.keywords;
        document.getElementById('modal-faq-answer').value = faq.answer;
    } else {
        document.getElementById('modal-faq-id').value = "";
        document.getElementById('modal-faq-question').value = "";
        document.getElementById('modal-faq-keywords').value = "";
        document.getElementById('modal-faq-answer').value = "";
    }
}

function closeFaqModal() {
    document.getElementById('faq-modal').classList.add('hidden');
}

async function saveFaq() {
    const id = document.getElementById('modal-faq-id').value;
    const data = {
        category: document.getElementById('modal-faq-category').value,
        priority: Number(document.getElementById('modal-faq-priority').value),
        question: document.getElementById('modal-faq-question').value,
        keywords: document.getElementById('modal-faq-keywords').value,
        answer: document.getElementById('modal-faq-answer').value
    };

    const action = id ? 'faq_update' : 'faq_create';
    if (id) data.faqId = id;

    const res = await apiCall(action, 'POST', data);
    if (res.success) {
        closeFaqModal();
        loadFaqs();
    } else {
        alert("儲存失敗: " + res.message);
    }
}

async function deleteFaq(faqId) {
    if (!confirm("確定要刪除/停用此 FAQ 嗎？")) return;
    const res = await apiCall('faq_delete', 'POST', { faqId });
    if (res.success) loadFaqs();
}

// --- Conversations Logic ---
async function loadConversations() {
    const res = await apiCall('member_list');
    if (res.success) {
        const container = document.getElementById('user-msg-list');
        container.innerHTML = "";
        res.data.items.forEach(user => {
            const di = document.createElement('div');
            di.className = `p-5 cursor-pointer hover:bg-blue-50 transition-all ${state.activeUserId === user.line_user_id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`;
            di.onclick = () => loadUserDetail(user.line_user_id, user.display_name);
            di.innerHTML = `
                <div class="flex items-center space-x-3">
                    <img src="${user.picture_url || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full">
                    <div class="flex-1 overflow-hidden">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-gray-800 text-sm truncate">${user.display_name}</span>
                            <span class="text-[10px] text-gray-400">${formatDate(user.last_seen_at || user.created_at)}</span>
                        </div>
                        <div class="text-xs text-gray-400 truncate">${user.last_intent || '無最近意圖'}</div>
                    </div>
                </div>
            `;
            container.appendChild(di);
        });
    }
}

async function loadUserDetail(lineUserId, name) {
    state.activeUserId = lineUserId;
    document.getElementById('viewer-name').innerText = name;
    document.getElementById('viewer-id').innerText = lineUserId;
    loadConversations(); // Refresh list to show active highlight

    const res = await apiCall('conversation_detail', 'GET', { lineUserId });
    if (res.success) {
        const body = document.getElementById('chat-viewer-body');
        body.innerHTML = "";
        res.data.reverse().forEach(msg => {
            const div = document.createElement('div');
            div.className = `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `
                <div class="max-w-[70%] p-4 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-100'}">
                    <p>${msg.message_text}</p>
                    <div class="mt-2 flex items-center justify-between text-[10px] opacity-60">
                        <span>${msg.role === 'user' ? '客戶' : '系統'}</span>
                        <span>${formatDateFull(msg.created_at)}</span>
                    </div>
                </div>
            `;
            body.appendChild(div);
        });
        body.scrollTop = body.scrollHeight;
    }
}

// --- Tickets Logic ---
async function loadTickets() {
    const res = await apiCall('ticket_list');
    if (res.success) {
        const container = document.getElementById('ticket-list');
        container.innerHTML = "";
        state.tickets = res.data.items;

        res.data.items.forEach(t => {
            const card = document.createElement('div');
            card.className = "glass-card p-6 rounded-3xl flex items-center justify-between transition-all hover:shadow-md";
            card.innerHTML = `
                <div class="flex items-center space-x-6 flex-1">
                    <div class="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                        <i data-lucide="ticket" class="w-6 h-6"></i>
                    </div>
                    <div class="space-y-1">
                        <div class="flex items-center space-x-2">
                             <span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase">${t.id}</span>
                             <span class="font-bold text-gray-800">${t.summary}</span>
                        </div>
                        <div class="text-xs text-gray-400">
                             使用者: <span class="text-gray-600">${t.line_user_id}</span> • 建立時間: ${formatDateFull(t.created_at)}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-bold text-gray-400 uppercase mb-1">優先級</span>
                        <span class="text-xs font-bold ${getPriorityColor(t.priority)}">${t.priority}</span>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-bold text-gray-400 uppercase mb-1">狀態</span>
                        <select onchange="updateTicketStatus('${t.id}', this.value)" class="text-xs font-bold bg-white border border-gray-100 rounded-lg px-2 py-1 outline-none">
                            <option value="open" ${t.status === 'open' ? 'selected' : ''}>處理中</option>
                            <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>已解決</option>
                            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>已關閉</option>
                        </select>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();
    }
}

async function updateTicketStatus(ticketId, status) {
    await apiCall('ticket_update_status', 'POST', { ticketId, status });
    loadTickets();
}

function getPriorityColor(p) {
    if (p === 'urgent') return 'text-red-500';
    if (p === 'high') return 'text-orange-500';
    return 'text-blue-500';
}

// --- Utils ---
function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateFull(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString();
}

// --- Settings Logic ---
async function loadSettings() {
    console.log("Loading settings...");
    const res = await apiCall('settings_list');
    const promptsRes = await apiCall('prompt_list');

    if (res.success) {
        document.getElementById('set-gemini-key').value = res.data.gemini_api_key || "";
        document.getElementById('set-line-token').value = res.data.line_access_token || "";
    }

    if (promptsRes.success) {
        const prompt = promptsRes.data.find(p => p.prompt_name === 'customer_service_system');
        if (prompt) {
            document.getElementById('set-prompt').value = prompt.content;
        }
    }
}

async function saveAllSettings() {
    const geminiKey = document.getElementById('set-gemini-key').value;
    const lineToken = document.getElementById('set-line-token').value;
    const promptContent = document.getElementById('set-prompt').value;

    const settingsRes = await apiCall('settings_update', 'POST', {
        gemini_api_key: geminiKey,
        line_access_token: lineToken
    });

    const promptRes = await apiCall('prompt_update', 'POST', {
        promptName: 'customer_service_system',
        content: promptContent
    });

    if (settingsRes.success && promptRes.success) {
        alert("設定儲存成功！");
    } else {
        alert("部分設定儲存失敗。");
    }
}

// Explicitly bind to window to avoid issues with modules or scope
window.showSection = showSection;
window.editFaq = editFaq;
window.deleteFaq = deleteFaq;
window.openFaqModal = openFaqModal;
window.closeFaqModal = closeFaqModal;
window.saveFaq = saveFaq;
window.updateTicketStatus = updateTicketStatus;
window.saveAllSettings = saveAllSettings;
