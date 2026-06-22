
let questions = [];
let currentIndex = 0;
let score = 0;
let answers = {};
let skipped = {};
let pendingQuestions = [];
let isReviewingPending = false;
let timerInterval = null;
let totalTimeLeft = 15 * 60; // 15 minutes in seconds

async function startQuiz() {
  const res = await fetch('/api/questions');
  questions = await res.json();
  currentIndex = 0;
  score = 0;
  answers = {};
  skipped = {};
  pendingQuestions = [];
  isReviewingPending = false;
  totalTimeLeft = 15 * 60;

  showScreen('quizScreen');
  startGlobalTimer();
  loadQuestion();
}

// GLOBAL TIMER — runs for whole quiz
function startGlobalTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    totalTimeLeft--;

    const minutes = Math.floor(totalTimeLeft / 60);
    const seconds = totalTimeLeft % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const timerEl = document.getElementById('timerText');
    const timerBox = document.getElementById('globalTimer');

    if (timerEl) timerEl.textContent = display;

    // color changes
    if (totalTimeLeft <= 60) {
      timerBox.className = 'global-timer danger';
    } else if (totalTimeLeft <= 3 * 60) {
      timerBox.className = 'global-timer warning';
    }

    // time is up
    if (totalTimeLeft <= 0) {
      clearInterval(timerInterval);
      showResults();
    }
  }, 1000);
}

function loadQuestion() {
  const q = isReviewingPending
    ? pendingQuestions[currentIndex]
    : questions[currentIndex];

  const total = isReviewingPending
    ? pendingQuestions.length
    : questions.length;

  const current = currentIndex + 1;

  document.getElementById('questionCount').textContent = isReviewingPending
    ? `Review ${current} of ${total}`
    : `Question ${current} of ${total}`;

  document.getElementById('questionNum').textContent = isReviewingPending
    ? `🔁 R${current}`
    : `Q${current}`;

  document.getElementById('scoreTracker').textContent = `⭐ ${score}`;
  document.getElementById('progressFill').style.width = `${(current / total) * 100}%`;
  document.getElementById('questionText').textContent = q.question;

  // Next button always active
  document.getElementById('nextBtn').disabled = false;

  // hide skip button during review
  const skipBtn = document.getElementById('skipBtn');
  skipBtn.disabled = false;
  skipBtn.style.display = isReviewingPending ? 'none' : 'inline-block';
  skipBtn.textContent = 'Do Later ⏭️';

  // render options
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  q.options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = option;
    btn.onclick = () => selectAnswer(option, q.id);
    grid.appendChild(btn);
  });
}

function selectAnswer(selected, questionId) {
  answers[questionId] = selected;
  disableOptions();

  const q = isReviewingPending
    ? pendingQuestions[currentIndex]
    : questions[currentIndex];

  const correctAnswer = q.answer.trim();
  const selectedTrimmed = selected.trim();

  document.querySelectorAll('.option-btn').forEach(btn => {
    const btnText = btn.textContent.trim();
    if (btnText === correctAnswer) {
      btn.classList.add('correct');
    } else if (btnText === selectedTrimmed) {
      btn.classList.add('wrong');
    }
  });

  if (selectedTrimmed === correctAnswer) {
    score++;
    document.getElementById('scoreTracker').textContent = `⭐ ${score}`;
  }

  // disable skip after answering
  document.getElementById('skipBtn').disabled = true;
}

function skipQuestion() {
  const q = questions[currentIndex];

  // save to pending if not already saved
  if (!pendingQuestions.find(p => p.id === q.id)) {
    pendingQuestions.push(q);
  }

  // show feedback
  const skipBtn = document.getElementById('skipBtn');
  skipBtn.textContent = '✓ Saved for later';
  skipBtn.disabled = true;

  // auto move to next after short delay
  setTimeout(() => {
    nextQuestion();
  }, 600);
}

function highlightCorrect(q) {
  document.querySelectorAll('.option-btn').forEach(btn => {
    if (btn.textContent.trim() === q.answer.trim()) {
      btn.classList.add('correct');
    } else {
      btn.classList.add('skipped');
    }
  });
}

function disableOptions() {
  document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
}

function nextQuestion() {
  currentIndex++;

  if (isReviewingPending) {
    if (currentIndex < pendingQuestions.length) {
      loadQuestion();
    } else {
      showResults();
    }
  } else {
    if (currentIndex < questions.length) {
      loadQuestion();
    } else {
      if (pendingQuestions.length > 0) {
        startPendingReview();
      } else {
        showResults();
      }
    }
  }
}

function startPendingReview() {
  isReviewingPending = true;
  currentIndex = 0;

  // show banner
  const existingBanner = document.getElementById('reviewBanner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'reviewBanner';
  banner.style.cssText = `
    background: rgba(108,99,255,0.15);
    border: 1px solid rgba(108,99,255,0.3);
    border-radius: 10px;
    padding: 0.6rem 1rem;
    text-align: center;
    font-size: 0.85rem;
    color: #6C63FF;
    margin-bottom: 1rem;
    font-weight: 600;
  `;
  banner.textContent = `🔁 Now answering ${pendingQuestions.length} saved question(s)!`;

  const quizScreen = document.getElementById('quizScreen');
  quizScreen.insertBefore(banner, quizScreen.firstChild);

  loadQuestion();
}

async function showResults() {
  clearInterval(timerInterval);

  const banner = document.getElementById('reviewBanner');
  if (banner) banner.remove();

  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });
  const data = await res.json();

  const skippedCount = Object.keys(skipped).length;
  const correctCount = data.score;
  const wrongCount = data.total - correctCount - skippedCount;

  showScreen('resultScreen');

  const percent = (data.score / data.total) * 100;
  let emoji, title, msg;

  if (percent === 100)    { emoji = '🏆'; title = 'Perfect Score!';  msg = 'Outstanding! You nailed every question!'; }
  else if (percent >= 70) { emoji = '🎉'; title = 'Great Job!';      msg = 'You have strong tech knowledge!'; }
  else if (percent >= 50) { emoji = '👍'; title = 'Good Effort!';    msg = 'Keep practicing and you will ace it!'; }
  else                    { emoji = '📚'; title = 'Keep Learning!';  msg = 'Review the topics and try again!'; }

  document.getElementById('resultEmoji').textContent = emoji;
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('finalScore').textContent = data.score;
  document.getElementById('resultMsg').textContent = msg;
  document.getElementById('correctCount').textContent = correctCount;
  document.getElementById('wrongCount').textContent = wrongCount < 0 ? 0 : wrongCount;
  document.getElementById('skipCount').textContent = skippedCount;

  const list = document.getElementById('resultsList');
  list.innerHTML = '';
  data.results.forEach(r => {
    const isSkipped = skipped[r.id];
    const div = document.createElement('div');
    div.className = `result-item ${isSkipped ? 'skipped' : r.isCorrect ? 'correct' : 'wrong'}`;
    div.innerHTML = `
      <p class="r-question">
        ${isSkipped ? '⏭️' : r.isCorrect ? '✅' : '❌'} ${r.question}
      </p>
      ${isSkipped
        ? `<p class="r-answer">Skipped &nbsp;·&nbsp; Correct: <span class="correct-ans">${r.correctAnswer}</span></p>`
        : r.isCorrect
          ? `<p class="r-answer">Your answer: <span class="correct-ans">${r.userAnswer}</span></p>`
          : `<p class="r-answer">Your answer: <span class="wrong-ans">${r.userAnswer || 'None'}</span> &nbsp;·&nbsp; Correct: <span class="correct-ans">${r.correctAnswer}</span></p>`
      }
    `;
    list.appendChild(div);
  });
}

function restartQuiz() {
  isReviewingPending = false;
  pendingQuestions = [];
  showScreen('startScreen');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}