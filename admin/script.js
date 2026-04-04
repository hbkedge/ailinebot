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
    activeChat: [], // Track current active chat messages
    loading: false,
    ticketFilter: 'all',
    pollInterval: null
};

// --- Initialization ---
window.onload = function () {
    lucide.createIcons();
    loadDashboard();

    // Add reply listeners
    const replyInput = document.getElementById('admin-reply-input');
    if (replyInput) replyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAdminReply();
    });

    // Add input listeners
    const ticketSearch = document.getElementById('ticket-search');
    if (ticketSearch) ticketSearch.addEventListener('input', () => loadTickets());

    const faqSearch = document.getElementById('faq-search');
    if (faqSearch) faqSearch.addEventListener('input', () => renderFaqTable(state.faqs));
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
                    <button onclick="editFaq('${item.id}')" title="編輯" class="p-2 bg-white text-blue-600 rounded-lg shadow-sm border border-gray-100 hover:bg-blue-50 transition-all">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    ${item.enabled === 'Y' ? `
                    <button onclick="deleteFaq('${item.id}')" title="停用" class="p-2 bg-white text-red-500 rounded-lg shadow-sm border border-gray-100 hover:bg-red-50 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>` : `
                    <button onclick="enableFaq('${item.id}')" title="啟用" class="p-2 bg-white text-green-600 rounded-lg shadow-sm border border-gray-100 hover:bg-green-50 transition-all">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                    </button>`}
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
        console.error("Save FAQ Failure:", res);
    }
}

async function deleteFaq(faqId) {
    if (!confirm("確定要刪除/停用此 FAQ 嗎？")) return;
    const res = await apiCall('faq_delete', 'POST', { faqId });
    if (res.success) {
        loadFaqs();
    } else {
        alert("刪除失敗: " + res.message);
        console.error("Delete FAQ Failure:", res);
    }
}

async function enableFaq(faqId) {
    const res = await apiCall('faq_enable', 'POST', { faqId });
    if (res.success) {
        loadFaqs();
    } else {
        alert("啟用失敗: " + res.message);
        console.error("Enable FAQ Failure:", res);
    }
}

// --- Conversations Logic ---
async function loadConversations() {
    const res = await apiCall('member_list');
    if (res.success) {
        state.conversations = res.data.items; // Store it!
        const container = document.getElementById('user-msg-list');
        container.innerHTML = "";
        res.data.items.forEach(user => {
            const di = document.createElement('div');
            di.className = `p-5 cursor-pointer hover:bg-blue-50 transition-all ${state.activeUserId === user.line_user_id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`;
            di.onclick = () => loadUserDetail(user.line_user_id, user.display_name, user.mode, user.picture_url);
            di.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <img src="${user.picture_url || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full">
                        <span class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${user.mode === 'human' ? 'bg-orange-500' : 'bg-green-500'}"></span>
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-gray-800 text-sm truncate">${user.display_name}</span>
                            <span class="text-[10px] text-gray-400">${formatDate(user.last_seen_at || user.created_at || user.updated_at)}</span>
                        </div>
                        <div class="text-[10px] ${user.mode === 'human' ? 'text-orange-500' : 'text-gray-400'} truncate">${user.mode === 'human' ? '⚠️ 需要真人介入' : (user.last_intent || 'AI 監控中')}</div>
                    </div>
                </div>
            `;
            container.appendChild(di);
        });
    }
}

async function loadUserDetail(lineUserId, name, mode, avatar) {
    state.activeUserId = lineUserId;
    state.activeChat = []; // Reset active chat track

    // Update Header
    document.getElementById('viewer-name').innerText = name;
    document.getElementById('viewer-id').innerText = lineUserId.slice(-8) + '...';
    document.getElementById('chat-header-actions').classList.remove('hidden');

    const replyBar = document.getElementById('admin-reply-bar');
    if (replyBar) {
        replyBar.style.display = 'flex';
        replyBar.classList.remove('hidden');
    }

    const badge = document.getElementById('viewer-mode-badge');
    badge.innerText = mode === 'human' ? '真人服務中' : 'AI 防護中';
    badge.className = `px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${mode === 'human' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`;
    badge.classList.remove('hidden');

    if (avatar) {
        document.getElementById('viewer-avatar').innerHTML = `<img src="${avatar}" class="w-full h-full rounded-full object-cover">`;
    }

    loadConversations(); // Refresh list to show active highlight
    
    // Clear existing view
    document.getElementById('chat-viewer-body').innerHTML = "";

    // Start polling for this user
    if (state.pollInterval) clearInterval(state.pollInterval);
    pollActiveChat(); // Immediate load
    state.pollInterval = setInterval(pollActiveChat, 4000);
}

async function pollActiveChat() {
    if (!state.activeUserId) return;

    const res = await apiCall('conversation_detail', 'GET', { lineUserId: state.activeUserId });
    if (res.success) {
        const body = document.getElementById('chat-viewer-body');
        const messages = res.data.reverse(); // DB returns newest first, reverse for display
        
        let hasNew = false;
        messages.forEach(msg => {
            // Duplicate Check
            if (!state.activeChat.find(m => m.id === msg.id)) {
                state.activeChat.push(msg);
                renderMessage(body, msg);
                hasNew = true;
            }
        });

        if (state.activeChat.length === 0) {
            body.innerHTML = `<p class="text-center text-gray-400 py-10">尚無對話記錄</p>`;
        } else if (hasNew) {
            body.scrollTop = body.scrollHeight;
        }
    }
}

function renderMessage(container, msg) {
    const isUser = msg.role === 'user';
    const div = document.createElement('div');
    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
    
    // Role styling
    let roleLabel = 'BOT';
    let bubbleClass = 'bg-white text-gray-800 border border-gray-100 rounded-bl-none';
    
    if (isUser) {
        roleLabel = 'CLIENT';
        bubbleClass = 'bg-blue-600 text-white rounded-br-none';
    } else if (msg.role === 'agent') {
        roleLabel = 'ADMIN';
        bubbleClass = 'bg-blue-50 text-blue-800 border border-secondary rounded-bl-none';
    }

    div.innerHTML = `
        <div class="max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${bubbleClass}">
            <p class="whitespace-pre-wrap">${msg.message_text}</p>
            <div class="mt-1.5 flex items-center justify-between text-[9px] opacity-60">
                <span>${roleLabel}</span>
                <span>${formatDate(msg.created_at)}</span>
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function toggleUserMode() {
    if (!state.activeUserId) return;

    // Find current mode from state or list
    const user = state.conversations.find(u => u.line_user_id === state.activeUserId);
    const newMode = (user && user.mode === 'human') ? 'bot' : 'human';

    const res = await apiCall('handoff_toggle', 'POST', {
        lineUserId: state.activeUserId,
        mode: newMode
    });

    if (res.success) {
        // Success! Reload the list and detail
        const itemsRes = await apiCall('member_list');
        if (itemsRes.success) {
            state.conversations = itemsRes.data.items;
            const updatedUser = itemsRes.data.items.find(u => u.line_user_id === state.activeUserId);
            loadUserDetail(updatedUser.line_user_id, updatedUser.display_name, updatedUser.mode, updatedUser.picture_url);
        }
    } else {
        alert("切換失敗: " + res.message);
    }
}

async function sendAdminReply() {
    const input = document.getElementById('admin-reply-input');
    const text = input.value.trim();
    if (!text || !state.activeUserId) return;

    // Use push API
    const res = await apiCall('line_push_message', 'POST', {
        lineUserId: state.activeUserId,
        message: text
    });

    if (res.success) {
        input.value = "";
        // Refresh chat immediately to show the new message from DB logs
        pollActiveChat();
    } else {
        alert("發送回覆失敗: " + res.message);
    }
}

// --- Tickets Logic ---
async function loadTickets() {
    const list = document.getElementById('ticket-list');
    const badge = document.getElementById('badge-tickets');

    // 1. Fetch data with status filter
    const query = state.ticketFilter === 'all' ? {} : { status: state.ticketFilter };
    const res = await apiCall('ticket_list', 'GET', query);

    if (res.success) {
        state.tickets = res.data.items;

        // 2. Client-side Search Filtering
        const searchTerm = document.getElementById('ticket-search').value.toLowerCase();
        const filteredItems = state.tickets.filter(t =>
            (t.summary && t.summary.toLowerCase().includes(searchTerm)) ||
            (t.line_user_id && t.line_user_id.toLowerCase().includes(searchTerm)) ||
            (t.phone && t.phone.toString().includes(searchTerm))
        );

        // 3. Update Sidebar Badge (only counting 'open' tickets across all)
        const openRes = await apiCall('dashboard_stats');
        const openCount = openRes.success ? openRes.data.activeTickets : filteredItems.filter(t => t.status === 'open').length;
        if (openCount > 0) {
            badge.innerText = openCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (filteredItems.length === 0) {
            list.innerHTML = `<div class="text-center py-20 text-gray-400 text-sm">此分類下無工單記錄</div>`;
            return;
        }

        // 4. Render
        list.innerHTML = "";
        filteredItems.forEach(t => {
            const card = document.createElement('div');
            card.className = `glass-card p-6 rounded-3xl flex items-center justify-between border-l-4 transition-all hover:shadow-lg ${t.status === 'open' ? 'border-orange-500' : (t.status === 'resolved' ? 'border-green-500' : 'border-gray-300')}`;
            card.innerHTML = `
                <div class="flex items-center space-x-6 flex-1">
                    <div class="w-12 h-12 rounded-2xl ${t.status === 'open' ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'} flex items-center justify-center">
                        <i data-lucide="${t.status === 'open' ? 'clock-3' : 'check-circle'}" class="w-6 h-6"></i>
                    </div>
                    <div class="space-y-1">
                        <div class="flex items-center space-x-2">
                             <span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase">${t.category || '一般'}</span>
                             <h4 class="font-bold text-gray-800 text-lg">${t.summary}</h4>
                        </div>
                        <div class="text-xs text-gray-400 flex items-center space-x-4">
                             <span class="flex items-center"><i data-lucide="user" class="w-3 h-3 mr-1"></i> ${t.line_user_id.slice(-8)}...</span>
                             <span class="flex items-center"><i data-lucide="phone" class="w-3 h-3 mr-1"></i> ${t.phone || '未提供電話'}</span>
                             <span class="flex items-center"><i data-lucide="calendar" class="w-3 h-3 mr-1"></i> ${formatDate(t.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-bold text-gray-400 uppercase mb-1">狀態管理</span>
                        <select onchange="updateTicketStatus('${t.id}', this.value)" class="text-xs font-bold bg-white border border-gray-100 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="open" ${t.status === 'open' ? 'selected' : ''}>⏳ 處理中</option>
                            <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>✅ 已解決</option>
                            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>🔒 已關閉</option>
                        </select>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
        lucide.createIcons();
    }
}

function filterTickets(status) {
    state.ticketFilter = status;
    const tabs = ['all', 'open', 'resolved'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-ticket-${t}`);
        if (!btn) return;
        if (t === status) {
            btn.className = "px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white shadow-sm transition-all focus:outline-none";
        } else {
            btn.className = "px-5 py-2 text-xs font-bold rounded-xl text-gray-500 hover:bg-gray-50 transition-all focus:outline-none";
        }
    });
    loadTickets();
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
window.enableFaq = enableFaq;
window.openFaqModal = openFaqModal;
window.closeFaqModal = closeFaqModal;
window.saveFaq = saveFaq;
window.updateTicketStatus = updateTicketStatus;
window.filterTickets = filterTickets;
window.toggleUserMode = toggleUserMode;
window.sendAdminReply = sendAdminReply;
window.saveAllSettings = saveAllSettings;
