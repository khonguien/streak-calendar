// --- STATE GLOBAL ---
let usersList = ["Khoi Nguyen", "Khách"]; 
let currentUser = "Khoi Nguyen";
let currentSelectedDay = new Date().getDate();
let tasksData = {};
let waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: new Date().toDateString() };

// TÍNH NĂNG MỚI: DANH SÁCH GỢI Ý MẶC ĐỊNH
const defaultSuggestedTasks = [
    "💧 Uống đủ 2L nước",
    "🚫 Không uống đồ ngọt",
    "🚶 Đi đủ 7000 bước"
];

// --- HÀM AN TOÀN ---
function safeParse(key, defaultVal) {
    try { const val = localStorage.getItem(key); return val ? JSON.parse(val) : defaultVal; } 
    catch(e) { return defaultVal; }
}

// --- KHỞI TẠO USER ---
function initAuth() {
    usersList = safeParse('appUsersList', ["Khoi Nguyen", "Khách"]);
    currentUser = localStorage.getItem('appCurrentUser') || usersList[0];
    saveAuth();
    renderUserDropdown();
    loadAllUserData();
    renderSuggestedTasks(); // Render các nút bấm gợi ý
}

function saveAuth() {
    localStorage.setItem('appUsersList', JSON.stringify(usersList));
    localStorage.setItem('appCurrentUser', currentUser);
}

function renderUserDropdown() {
    const select = document.getElementById('userSelect');
    select.innerHTML = '';
    usersList.forEach(user => {
        select.innerHTML += `<option value="${user}" ${user === currentUser ? 'selected' : ''}>${user}</option>`;
    });
    select.innerHTML += `<option value="ADD_NEW">➕ Thêm User mới...</option>`;
    document.getElementById("userNameDisplay").textContent = currentUser;
}

function handleUserChange() {
    const select = document.getElementById('userSelect');
    if (select.value === "ADD_NEW") {
        const newName = prompt("Nhập tên người dùng mới:");
        if (newName && newName.trim() !== "" && !usersList.includes(newName.trim())) {
            usersList.push(newName.trim());
            currentUser = newName.trim();
            saveAuth();
        } 
    } else {
        currentUser = select.value;
        saveAuth();
    }
    renderUserDropdown();
    loadAllUserData();
}

function deleteCurrentUser() {
    if (usersList.length <= 1) return alert("Không thể xóa user cuối cùng!");
    if (confirm(`Xóa vĩnh viễn [${currentUser}] khỏi hệ thống? (Task trên lịch vẫn được giữ)`)) {
        localStorage.removeItem(`${currentUser}_waterTrackerApp`);
        usersList = usersList.filter(u => u !== currentUser);
        currentUser = usersList[0]; 
        saveAuth();
        renderUserDropdown();
        loadAllUserData();
    }
}

function loadAllUserData() {
    tasksData = safeParse(`global_calendarTasks_v2`, {});
    renderCalendar();
    renderTasks(currentSelectedDay);
    
    // Load Water
    const today = new Date().toDateString();
    waterData = safeParse(`${currentUser}_waterTrackerApp`, { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: today });
    
    if (waterData.lastDate !== today) {
        waterData.consumedLiters = 0; waterData.history = []; waterData.lastDate = today;
        saveWaterData();
    }
    
    if (waterData.goalLiters > 0) {
        document.getElementById('goalText').textContent = waterData.goalLiters.toFixed(1);
        document.getElementById('btnBottleVol').textContent = waterData.bottleVolLiters * 1000;
        updateWaterUI(); renderWaterHistory();
        showWaterScreen('screen-tracker');
    } else {
        showWaterScreen('screen-goal');
    }
}

// --- LỊCH & TASKS ---
function saveCalendarTasks() {
    localStorage.setItem(`global_calendarTasks_v2`, JSON.stringify(tasksData));
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = ''; 
    for(let i = 22; i <= 28; i++) calendarGrid.innerHTML += `<div class="day muted">${i}</div>`;
    for(let i = 1; i <= 31; i++) {
        let activeClass = (i === currentSelectedDay) ? "active" : "";
        calendarGrid.innerHTML += `<div class="day ${activeClass}" onclick="selectDay(this, ${i})">${i}</div>`;
    }
}

function selectDay(element, dayNumber) {
    currentSelectedDay = dayNumber; 
    document.querySelectorAll('.day').forEach(d => d.classList.remove('active'));
    element.classList.add('active');
    renderTasks(dayNumber);
}

function renderProgressBars(tasks) {
    const container = document.getElementById('progressBarsContainer');
    container.innerHTML = "";
    if (tasks.length === 0) return;

    const colors = ['#3498db', '#af52de', '#ff9500', '#2ecc71', '#e74c3c'];
    usersList.forEach((user, index) => {
        const uTasks = tasks.filter(t => t.owner === user);
        if (uTasks.length === 0) return;
        const done = uTasks.filter(t => t.completed).length;
        const percent = Math.round((done / uTasks.length) * 100);
        
        container.innerHTML += `
            <div class="user-progress-item">
                <div class="user-progress-label"><span>${user}</span><span>${percent}%</span></div>
                <div class="user-progress-track"><div class="user-progress-fill" style="width: ${percent}%; background-color: ${colors[index % colors.length]}"></div></div>
            </div>`;
    });
}

function renderTasks(dayNumber) {
    if (!tasksData[dayNumber]) tasksData[dayNumber] = [];
    const tasks = tasksData[dayNumber];
    renderProgressBars(tasks);

    const taskList = document.getElementById('taskList');
    taskList.innerHTML = ""; 

    if (tasks.length === 0) {
        taskList.innerHTML = `<div class="task-item empty"><div class="task-content"><p class="task-title" style="color: var(--text-muted); font-size: 15px;">Chưa có công việc nào.</p></div></div>`;
        return;
    }

    tasks.forEach((task, index) => {
        const isChecked = task.completed ? "checked" : "";
        const opacity = (task.owner === currentUser) ? "1" : "0.5";
        const delBtn = (task.owner === currentUser) ? `<button class="delete-btn" onclick="deleteTask(${dayNumber}, ${index})">✕</button>` : "";

        taskList.innerHTML += `
            <div class="task-item ${task.color}" style="opacity: ${opacity}">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="${task.id}" ${isChecked} onchange="toggleTask(${dayNumber}, ${index})">
                </div>
                <div class="task-content">
                    <div class="task-info"><label for="${task.id}" class="task-title">${task.title}</label></div>
                    ${delBtn}
                </div>
            </div>`;
    });
}

function toggleTask(dayNumber, taskIndex) {
    tasksData[dayNumber][taskIndex].completed = !tasksData[dayNumber][taskIndex].completed;
    saveCalendarTasks();
    renderTasks(dayNumber); 
}

// Hàm cốt lõi để thêm task (được dùng chung)
function addSpecificTask(titleText) {
    if (!tasksData[currentSelectedDay]) tasksData[currentSelectedDay] = [];
    tasksData[currentSelectedDay].push({ 
        id: "t_" + Date.now(), 
        color: "blue", 
        title: `${titleText} của ${currentUser}`, 
        owner: currentUser, 
        completed: false 
    });
    saveCalendarTasks(); 
    renderTasks(currentSelectedDay); 
}

function addTask() {
    try {
        const inputField = document.getElementById('newTaskInput');
        const title = inputField.value.trim(); 
        if (title === "") return; 
        addSpecificTask(title);
        inputField.value = ""; 
    } catch (error) {
        console.error("Lỗi khi thêm Task:", error);
    }
}

function handleKeyPress(event) { 
    if (event.key === "Enter" || event.keyCode === 13) {
        event.preventDefault(); 
        addTask(); 
    }
}

function deleteTask(dayNumber, taskIndex) {
    tasksData[dayNumber].splice(taskIndex, 1);
    saveCalendarTasks(); 
    renderTasks(dayNumber);
}

// TÍNH NĂNG MỚI: RENDER NÚT GỢI Ý
function renderSuggestedTasks() {
    const container = document.getElementById('suggestedTasksContainer');
    if (!container) return;
    container.innerHTML = '';
    
    defaultSuggestedTasks.forEach(taskStr => {
        const btn = document.createElement('button');
        btn.className = 'suggested-task-btn';
        btn.textContent = "+ " + taskStr;
        // Bấm vào là gán tên gợi ý vào hàm addSpecificTask
        btn.onclick = () => addSpecificTask(taskStr);
        container.appendChild(btn);
    });
}

// --- WATER TRACKER ---
function toggleWaterModal() { document.getElementById('waterModalOverlay').classList.toggle('open'); }
function showWaterScreen(id) { document.querySelectorAll('.water-screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function saveWaterData() { localStorage.setItem(`${currentUser}_waterTrackerApp`, JSON.stringify(waterData)); }

function calculateGoal() {
    const weight = parseFloat(document.getElementById('weightInput').value);
    if (isNaN(weight) || weight <= 0) { document.getElementById('weightError').style.display = 'block'; return; }
    document.getElementById('weightError').style.display = 'none';

    const minL = weight * 0.03; const maxL = weight * 0.04;
    document.getElementById('waterRecommendationText').innerHTML = `💡 Cần uống từ <b>${minL.toFixed(1)}L - ${maxL.toFixed(1)}L</b> mỗi ngày.`;

    const select = document.getElementById('goalSelect'); select.innerHTML = ''; 
    for (let i = Math.ceil(minL * 10); i <= Math.floor(maxL * 10); i++) select.innerHTML += `<option value="${(i / 10).toFixed(1)}">${(i / 10).toFixed(1)} L</option>`;
    document.getElementById('goalSelectionArea').style.display = 'block';
}

function goToScreenBottle() {
    waterData.goalLiters = parseFloat(document.getElementById('goalSelect').value);
    saveWaterData(); showWaterScreen('screen-bottle');
}

function goToScreenTracker() {
    const bottleMl = parseInt(document.getElementById('bottleInput').value);
    if (isNaN(bottleMl) || bottleMl <= 0) { document.getElementById('bottleError').style.display = 'block'; return; }
    document.getElementById('bottleError').style.display = 'none';
    waterData.bottleVolLiters = bottleMl / 1000; saveWaterData();
    document.getElementById('btnBottleVol').textContent = bottleMl;
    document.getElementById('goalText').textContent = waterData.goalLiters.toFixed(1);
    updateWaterUI(); showWaterScreen('screen-tracker');
}

function addBottle() {
    waterData.consumedLiters += waterData.bottleVolLiters;
    const now = new Date(); const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    waterData.history.unshift({ text: `💦 Đã uống ${waterData.bottleVolLiters * 1000}ml`, time: time });
    saveWaterData(); updateWaterUI(); renderWaterHistory();
}

function updateWaterUI() {
    document.getElementById('consumedText').textContent = waterData.consumedLiters.toFixed(2);
    let p = (waterData.consumedLiters / waterData.goalLiters) * 100;
    document.getElementById('progressBar').style.width = Math.min(p, 100) + '%';
    document.getElementById('progressBar').style.backgroundColor = (p >= 100) ? '#2ecc71' : 'var(--water-primary)'; 
}

function renderWaterHistory() {
    const container = document.getElementById('historyContainer'), list = document.getElementById('historyList');
    if (waterData.history.length === 0) return container.style.display = 'none';
    container.style.display = 'block'; list.innerHTML = waterData.history.map(i => `<li><span>${i.text}</span> <span class="time-badge">${i.time}</span></li>`).join('');
}

function resetWaterApp() {
    if(confirm(`Cài đặt lại app nước của [${currentUser}]?`)) { 
        localStorage.removeItem(`${currentUser}_waterTrackerApp`); 
        waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: new Date().toDateString() };
        document.getElementById('goalSelectionArea').style.display = 'none';
        showWaterScreen('screen-goal');
    }
}

window.onload = initAuth;