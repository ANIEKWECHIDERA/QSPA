import React, { useState, useEffect } from "react";

const QspaDemo = () => {
  const [username, setUsername] = useState("");
  const [examCode, setExamCode] = useState("");
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (started) {
      // Fetch questions securely from API

      fetch(
        `https://quizapi.io/api/v1/questions?apiKey=${
          import.meta.env.VITE_API_KEY
        }&limit=10`
      )
        .then((res) => res.json())
        .then((data) => setQuestions(data.question, console.log(data)));
    }
  }, [started]);

  useEffect(() => {
    if (started && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      handleSubmit();
    }
  }, [timeLeft, started]);

  const handleStart = () => {
    if (username && examCode) {
      setStarted(true);
    }
  };

  const handleAnswerSelect = (option) => {
    setAnswers({ ...answers, [currentQuestionIndex]: option });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    // Send answers to backend for grading
    fetch("https://your-secure-backend.com/api/submit-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, examCode, answers }),
    })
      .then((res) => res.json())
      .then((data) => alert(`Your score: ${data.score}`));
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <input
          placeholder="Enter Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 mb-2"
        />
        <input
          placeholder="Enter Exam Code"
          value={examCode}
          onChange={(e) => setExamCode(e.target.value)}
          className="border p-2 mb-2"
        />
        <button onClick={handleStart} className="bg-blue-500 text-white p-2">
          Start Exam
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between">
        <h1>Exam</h1>
        <div>
          Time Left: {Math.floor(timeLeft / 60)}:{timeLeft % 60}
        </div>
      </div>

      {submitted ? (
        <div>
          <h2>Exam Completed</h2>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-white p-2"
          >
            Take Another Exam
          </button>
        </div>
      ) : (
        <div>
          <div>
            <h2>Question {currentQuestionIndex + 1}</h2>
            <p>{questions[currentQuestionIndex]?.question}</p>
            {questions[currentQuestionIndex]?.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className="block border p-2 m-2"
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="bg-gray-500 text-white p-2"
            >
              Previous
            </button>
            <button
              disabled={currentQuestionIndex === questions.length - 1}
              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              className="bg-blue-500 text-white p-2"
            >
              Next
            </button>
          </div>

          {currentQuestionIndex === questions.length - 1 && (
            <button
              onClick={handleSubmit}
              className="bg-red-500 text-white p-2 mt-4"
            >
              Submit Exam
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QspaDemo;
