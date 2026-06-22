const express = require('express');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.static('public'));

// GET all questions (with answers for frontend checking)
app.get('/api/questions', (req, res) => {
  const questions = JSON.parse(fs.readFileSync('questions.json'));
  const safeQuestions = questions.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options,
    answer: q.answer
  }));
  res.json(safeQuestions);
});

// POST to check final score
app.post('/api/submit', (req, res) => {
  const { answers } = req.body;
  const questions = JSON.parse(fs.readFileSync('questions.json'));

  let score = 0;
  const results = questions.map(q => {
    const userAnswer = answers[q.id];
    const isCorrect = userAnswer === q.answer;
    if (isCorrect) score++;
    return {
      id: q.id,
      question: q.question,
      userAnswer,
      correctAnswer: q.answer,
      isCorrect
    };
  });

  res.json({ score, total: questions.length, results });
});

app.listen(PORT, () => {
  console.log(`Quiz app running at http://localhost:${PORT}`);
});