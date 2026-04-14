// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBBk5N2H_z6pLOM-YB9_nKWUBn0qox9N0o",
    authDomain: "teamtracker-edeee.firebaseapp.com",
    databaseURL: "https://teamtracker-edeee-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "teamtracker-edeee",
    storageBucket: "teamtracker-edeee.firebasestorage.app",
    messagingSenderId: "424800634605",
    appId: "1:424800634605:web:6e613bdfa5f3d7e2886ee4"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE GLOBAL ---
let usersList = ["Khoi Nguyen", "Khách"]; 
let currentUser = localStorage.getItem('appCurrentUser') || "Khoi Nguyen";
let currentSelectedDay = new Date().getDate();
let tasksData = {};
let waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: new Date().toDateString() };

// Danh sách gợi ý với placeholder {goal}
const defaultSuggestedTasks = [
    "💧 Uống đủ {goal}L nước",
    "🚫 Không uống đồ ngọt",
    "🕗 Không ăn sau 20H",
    "🏋️‍♂️ Tập Gym > 1H",
    "🏃‍♂️ Vận động > 30P"
];

// --- KHỞI TẠO & ĐỒNG BỘ REAL-TIME ---
function initAuth() {
    // 1. Đồng bộ danh sách User từ Global
    db.ref('appUsersList').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) usersList = data;
        else db.ref('appUsersList').set(usersList);
        renderUserDropdown();
    });

    // 2. Đồng bộ Tasks từ Global
    db.ref('global_calendarTasks_v2').on('value', (snapshot) => {
        tasksData = snapshot.val() || {};
        renderCalendar();
        renderTasks(currentSelectedDay);
        calculateStreak(); // Tính streak mỗi khi task thay đổi
    });

    loadWaterData();
}

// --- QUẢN LÝ USER ---
function renderUserDropdown() {
    const select = document.getElementById('userSelect');
    if (!select) return;
    select.innerHTML = usersList.map(u => 
        `<option value="${u}" ${u === currentUser ? 'selected' : ''}>${u}</option>`
    ).join('') + `<option value="ADD_NEW">➕ Thêm User mới...</option>`;
    document.getElementById("userNameDisplay").textContent = currentUser;
}

function handleUserChange() {
    const select = document.getElementById('userSelect');
    if (select.value === "ADD_NEW") {
        const name = prompt("Tên user mới:");
        if (name && !usersList.includes(name.trim())) {
            usersList.push(name.trim());
            db.ref('appUsersList').set(usersList);
            currentUser = name.trim();
        }
    } else {
        currentUser = select.value;
    }
    localStorage.setItem('appCurrentUser', currentUser);
    renderUserDropdown();
    loadWaterData();
}

// --- QUẢN LÝ LỊCH & TASKS ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="weekday">S</div><div class="weekday">M</div><div class="weekday">T</div><div class="weekday">W</div><div class="weekday">T</div><div class="weekday">F</div><div class="weekday">S</div>';
    
    // Mặc định hiển thị ngày từ 22-28 (theo style cũ của bạn) và 1-31
    for(let i = 22; i <= 28; i++) grid.innerHTML += `<div class="day muted">${i}</div>`;
    for(let i = 1; i <= 31; i++) {
        grid.innerHTML += `<div class="day ${i === currentSelectedDay ? "active" : ""}" onclick="selectDay(this, ${i})">${i}</div>`;
    }
}

function selectDay(el, num) {
    currentSelectedDay = num;
    document.querySelectorAll('.day').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
    renderTasks(num);
}

function renderTasks(day) {
    const list = document.getElementById('taskList');
    const dayData = tasksData[day] || {};
    const tasksArr = Object.values(dayData);
    
    renderProgressBars(tasksArr);
    list.innerHTML = tasksArr.length ? "" : "<p style='color:gray;text-align:center;padding:20px;'>Chưa có công việc nào.</p>";

    for (let key in dayData) {
        const t = dayData[key];
        const isOwner = t.owner === currentUser;
        list.innerHTML += `
            <div class="task-item blue" style="opacity: ${isOwner ? 1 : 0.5}">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask(${day}, '${key}')">
                <div class="task-content">
                    <span class="task-title">${t.title}</span>
                    ${isOwner ? `<button class="delete-btn" onclick="deleteTask(${day}, '${key}')">✕</button>` : ''}
                </div>
            </div>`;
    }
}

function renderSuggestedTasks() {
    const c = document.getElementById('suggestedTasksContainer');
    if (!c) return;

    // Lấy goal từ waterData, nếu chưa có (0) thì để mặc định là 2
    const currentGoal = (waterData && waterData.goalLiters > 0) ? waterData.goalLiters.toFixed(1) : "2";

    c.innerHTML = defaultSuggestedTasks.map(t => {
        const finalStr = t.replace("{goal}", currentGoal);
        return `<button class="suggested-task-btn" onclick="addSpecificTask('${finalStr}')">+ ${finalStr}</button>`;
    }).join('');
}

function addSpecificTask(txt) {
    const newTask = { 
        id: Date.now(), 
        title: txt, 
        owner: currentUser, 
        completed: false, 
        color: "blue" 
    };
    db.ref(`global_calendarTasks_v2/${currentSelectedDay}`).push(newTask);
}

function addTask() {
    const inp = document.getElementById('newTaskInput');
    if (inp.value.trim()) { 
        addSpecificTask(inp.value.trim()); 
        inp.value = ""; 
    }
}

function toggleTask(day, key) {
    const currentStatus = tasksData[day][key].completed;
    db.ref(`global_calendarTasks_v2/${day}/${key}`).update({ completed: !currentStatus });
}

function deleteTask(day, key) {
    if(confirm("Xóa công việc này?")) db.ref(`global_calendarTasks_v2/${day}/${key}`).remove();
}

// --- STREAK LOGIC ---
function calculateStreak() {
    const today = new Date().getDate();
    let streak = 0;
    
    // Kiểm tra từ hôm nay ngược về đầu tháng
    for (let d = today; d >= 1; d--) {
        const dayTasks = Object.values(tasksData[d] || {});
        const myTasks = dayTasks.filter(t => t.owner === currentUser);
        
        if (myTasks.length > 0) {
            const allDone = myTasks.every(t => t.completed);
            if (allDone) {
                streak++;
            } else {
                if (d !== today) break; // Đứt chuỗi nếu ngày quá khứ chưa xong
            }
        } else {
            if (d !== today) break; // Đứt chuỗi nếu ngày quá khứ không có task
        }
    }
    renderStreak(streak);
}

function renderStreak(count) {
    const div = document.getElementById('streakDisplay');
    if (!div) return;
    if (count < 3) { div.innerHTML = ""; return; } // Chỉ hiện từ 3 ngày trở lên
    
    let emoji = "🌱";
    if (count >= 7) emoji = "🔥";
    if (count >= 15) emoji = "💥";
    if (count >= 30) emoji = "👑";

    div.innerHTML = `<span class="flame-icon">${emoji}</span><span class="streak-count">${count}</span>`;
}

// --- WATER TRACKER ---
function loadWaterData() {
    db.ref(`waterData/${currentUser}`).on('value', (snapshot) => {
        const data = snapshot.val();
        const today = new Date().toDateString();
        
        if (data) {
            waterData = data;
            if (waterData.lastDate !== today) {
                waterData.consumedLiters = 0; 
                waterData.history = []; 
                waterData.lastDate = today;
                db.ref(`waterData/${currentUser}`).set(waterData);
            }
        } else {
            waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: today };
        }
        
        updateWaterUI();
        renderSuggestedTasks(); // Cập nhật lại số lít trong nút gợi ý
    });
}

function addBottle() {
    waterData.consumedLiters += waterData.bottleVolLiters;
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if(!waterData.history) waterData.history = [];
    waterData.history.unshift({ text: `+${(waterData.bottleVolLiters*1000).toFixed(0)}ml`, time });
    db.ref(`waterData/${currentUser}`).set(waterData);
}

function updateWaterUI() {
    const p = (waterData.consumedLiters / waterData.goalLiters) * 100 || 0;
    if(document.getElementById('consumedText')) {
        document.getElementById('consumedText').textContent = waterData.consumedLiters.toFixed(2);
        document.getElementById('goalText').textContent = waterData.goalLiters.toFixed(1);
        document.getElementById('progressBar').style.width = Math.min(p, 100) + '%';
        document.getElementById('btnBottleVol').textContent = (waterData.bottleVolLiters * 1000).toFixed(0);
        
        const list = document.getElementById('historyList');
        list.innerHTML = (waterData.history || []).map(h => `<li><span>${h.text}</span><span class="time-badge">${h.time}</span></li>`).join('');
        document.getElementById('historyContainer').style.display = (waterData.history?.length > 0) ? 'block' : 'none';
        
        // Điều hướng màn hình nước
        if (waterData.goalLiters <= 0) showWaterScreen('screen-goal');
        else if (waterData.bottleVolLiters <= 0) showWaterScreen('screen-bottle');
        else showWaterScreen('screen-tracker');
    }
}

function calculateGoal() {
    const w = parseFloat(document.getElementById('weightInput').value);
    if (w > 0) {
        const min = w * 0.03, max = w * 0.04;
        document.getElementById('waterRecommendationText').innerHTML = `💡 Cần uống <b>${min.toFixed(1)}L - ${max.toFixed(1)}L</b>/ngày.`;
        const sel = document.getElementById('goalSelect'); sel.innerHTML = "";
        for (let i = Math.ceil(min*10); i <= Math.floor(max*10); i++) {
            sel.innerHTML += `<option value="${i/10}">${i/10}L</option>`;
        }
        document.getElementById('goalSelectionArea').style.display = 'block';
    } else {
        document.getElementById('weightError').style.display = 'block';
    }
}

function goToScreenBottle() { 
    waterData.goalLiters = parseFloat(document.getElementById('goalSelect').value); 
    db.ref(`waterData/${currentUser}`).set(waterData); 
}

function goToScreenTracker() { 
    const ml = parseInt(document.getElementById('bottleInput').value); 
    if (ml > 0) { 
        waterData.bottleVolLiters = ml/1000; 
        db.ref(`waterData/${currentUser}`).set(waterData); 
    } else {
        document.getElementById('bottleError').style.display = 'block';
    }
}

// --- UI HELPERS ---
function toggleWaterModal() { document.getElementById('waterModalOverlay').classList.toggle('open'); }

function showWaterScreen(id) { 
    document.querySelectorAll('.water-screen').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}

function handleKeyPress(e) { if (e.key === "Enter") addTask(); }

function renderProgressBars(arr) {
    const c = document.getElementById('progressBarsContainer');
    if(!c) return;
    c.innerHTML = "";
    const colors = ['#3498db', '#af52de', '#ff9500', '#2ecc71', '#e74c3c'];
    usersList.forEach((u, i) => {
        const mine = arr.filter(t => t.owner === u);
        if (!mine.length) return;
        const p = Math.round((mine.filter(t => t.completed).length / mine.length) * 100);
        c.innerHTML += `
            <div class="user-progress-item">
                <div class="user-progress-label"><span>${u}</span><span>${p}%</span></div>
                <div class="user-progress-track"><div class="user-progress-fill" style="width:${p}%;background:${colors[i%colors.length]}"></div></div>
            </div>`;
    });
}

function resetWaterApp() { 
    if(confirm("Xóa cài đặt nước của User này?")) {
        db.ref(`waterData/${currentUser}`).remove(); 
    }
}

function deleteCurrentUser() { 
    if(usersList.length > 1 && confirm("Xóa vĩnh viễn User này khỏi hệ thống?")) { 
        db.ref(`waterData/${currentUser}`).remove(); 
        const newList = usersList.filter(u => u !== currentUser); 
        db.ref('appUsersList').set(newList); 
        currentUser = newList[0]; 
        localStorage.setItem('appCurrentUser', currentUser); 
    } 
}

window.onload = initAuth;