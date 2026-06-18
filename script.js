// script.js - Event Clock Functionality

(function() {
    "use strict";

    // ----- DOM refs -----
    const timerDisplay = document.getElementById('timer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const stopAlarmBtn = document.getElementById('stopAlarmBtn');
    const workDurationInput = document.getElementById('workDuration');
    const alarmSoundSelect = document.getElementById('alarmSound');
    const eventNameInput = document.getElementById('eventNameInput');
    const addEventBtn = document.getElementById('addEventBtn');
    const eventList = document.getElementById('eventList');

    // ----- State -----
    let timerInterval = null;
    let isRunning = false;

    // Time in seconds
    let totalSeconds = 25 * 60;      // default 25 min
    let remainingSeconds = totalSeconds;

    // Event store: array of { id, name, durationSeconds, createdAt }
    let events = [];
    let nextEventId = 1;

    // Alarm audio context (web audio)
    let audioCtx = null;
    let alarmOscillator = null;
    let alarmGainNode = null;
    let isAlarmPlaying = false;

    // ----- Helper: format time MM:SS -----
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ----- Update display & document title -----
    function updateDisplay() {
        timerDisplay.textContent = formatTime(remainingSeconds);
        document.title = `⏱ ${formatTime(remainingSeconds)} · Event Clock`;
    }

    // ----- Stop alarm sound -----
    function stopAlarmSound() {
        if (audioCtx && alarmOscillator) {
            try {
                alarmOscillator.stop();
                alarmOscillator.disconnect();
                alarmGainNode.disconnect();
            } catch (_) { /* ignore */ }
        }
        isAlarmPlaying = false;
        audioCtx = null;
        alarmOscillator = null;
        alarmGainNode = null;
    }

    // ----- Play alarm sound (web audio) -----
    function playAlarmSound() {
        if (isAlarmPlaying) return;
        try {
            stopAlarmSound(); // clean previous
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            alarmOscillator = audioCtx.createOscillator();
            alarmGainNode = audioCtx.createGain();
            alarmOscillator.type = 'square';
            alarmOscillator.frequency.value = 720;
            alarmGainNode.gain.value = 0.28;
            alarmOscillator.connect(alarmGainNode);
            alarmGainNode.connect(audioCtx.destination);

            // mod for "alarm" effect: frequency wobble
            const now = audioCtx.currentTime;
            alarmOscillator.frequency.setValueAtTime(720, now);
            alarmOscillator.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            alarmOscillator.frequency.exponentialRampToValueAtTime(640, now + 0.3);
            // repeat via timeout
            alarmOscillator.start(now);
            isAlarmPlaying = true;

            // Auto stop after 6 seconds (safety)
            setTimeout(() => {
                if (isAlarmPlaying) stopAlarmSound();
            }, 7000);
        } catch (e) {
            console.warn('Alarm could not be played:', e);
        }
    }

    // ----- Timer logic -----
    function tick() {
        if (remainingSeconds <= 0) {
            // timer finished
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false;
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            // Play alarm
            playAlarmSound();
            updateDisplay();
            return;
        }

        remainingSeconds--;
        updateDisplay();

        // if remaining is 0, next tick will trigger finish
        if (remainingSeconds === 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false;
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            playAlarmSound();
            updateDisplay();
        }
    }

    function startTimer() {
        if (timerInterval) return;
        if (remainingSeconds <= 0) {
            remainingSeconds = totalSeconds;
            updateDisplay();
        }
        isRunning = true;
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        timerInterval = setInterval(tick, 1000);
    }

    function pauseTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isRunning = false;
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    function resetTimer() {
        pauseTimer();
        stopAlarmSound();
        remainingSeconds = totalSeconds;
        updateDisplay();
        isRunning = false;
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    // ----- Toggle play/pause -----
    function togglePlayPause() {
        if (isAlarmPlaying) stopAlarmSound();

        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    }

    // ----- Load total duration from input -----
    function loadDurationFromInput() {
        let val = parseInt(workDurationInput.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 120) val = 120;
        workDurationInput.value = val;
        totalSeconds = val * 60;
        if (!isRunning) {
            if (remainingSeconds === 0 || remainingSeconds === totalSeconds) {
                remainingSeconds = totalSeconds;
            } else {
                if (remainingSeconds > totalSeconds) remainingSeconds = totalSeconds;
            }
            updateDisplay();
        }
    }

    // ----- Events (named) -----
    function renderEvents() {
        eventList.innerHTML = '';
        if (events.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty-events';
            empty.innerHTML = '<i class="fas fa-calendar-plus"></i> No events yet — add one!';
            eventList.appendChild(empty);
            return;
        }

        const sorted = [...events].sort((a, b) => a.id - b.id);
        for (const ev of sorted) {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'event-name';
            nameSpan.innerHTML = `<i class="fas fa-circle-check"></i> ${escapeHtml(ev.name)}`;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'event-time';
            timeSpan.textContent = formatTime(ev.durationSeconds);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'event-actions';

            // Play button (set timer to this event's duration)
            const playBtn = document.createElement('button');
            playBtn.className = 'play-btn';
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.title = 'Set timer to this event duration';
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isRunning) pauseTimer();
                if (isAlarmPlaying) stopAlarmSound();
                totalSeconds = ev.durationSeconds;
                remainingSeconds = totalSeconds;
                workDurationInput.value = Math.floor(totalSeconds / 60);
                updateDisplay();
            });

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
            delBtn.title = 'Remove event';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                events = events.filter(e => e.id !== ev.id);
                renderEvents();
            });

            actionsDiv.appendChild(playBtn);
            actionsDiv.appendChild(delBtn);

            li.appendChild(nameSpan);
            li.appendChild(timeSpan);
            li.appendChild(actionsDiv);
            eventList.appendChild(li);
        }
    }

    // Simple escape
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function addEvent() {
        const name = eventNameInput.value.trim();
        if (name === '') {
            alert('Please enter an event name.');
            return;
        }

        const duration = totalSeconds;

        events.push({
            id: nextEventId++,
            name: name,
            durationSeconds: duration,
            createdAt: Date.now()
        });

        eventNameInput.value = '';
        renderEvents();
    }

    // ----- Alarm stop button -----
    function handleStopAlarm() {
        stopAlarmSound();
        if (remainingSeconds === 0 && !isRunning) {
            remainingSeconds = totalSeconds;
            updateDisplay();
        }
    }

    // ----- Reset button override (also stop alarm) -----
    function handleReset() {
        stopAlarmSound();
        resetTimer();
    }

    // ----- Input: duration change -----
    workDurationInput.addEventListener('change', function() {
        loadDurationFromInput();
    });

    // ----- Init -----
    function init() {
        // default events
        events.push({
            id: nextEventId++,
            name: 'Focus session',
            durationSeconds: 25 * 60,
            createdAt: Date.now()
        });
        events.push({
            id: nextEventId++,
            name: 'Quick task',
            durationSeconds: 15 * 60,
            createdAt: Date.now()
        });
        renderEvents();

        totalSeconds = 25 * 60;
        remainingSeconds = totalSeconds;
        updateDisplay();

        // Event listeners
        playPauseBtn.addEventListener('click', togglePlayPause);
        resetBtn.addEventListener('click', handleReset);
        stopAlarmBtn.addEventListener('click', handleStopAlarm);
        addEventBtn.addEventListener('click', addEvent);
        eventNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addEvent();
        });

        // audio context unlock (required by chrome)
        document.addEventListener('click', function unlockAudio() {
            if (audioCtx === null) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    if (ctx.state === 'suspended') ctx.resume();
                } catch (_) {}
            }
        }, { once: true });
    }

    init();
})();
