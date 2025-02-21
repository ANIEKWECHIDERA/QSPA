import React, { useState, useEffect } from "react";

const QspaDemo = () => {
  const [username, setUsername] = useState("");
  const [examCode, setExamCode] = useState("");
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (started) {
      fetch(
        `https://quizapi.io/api/v1/questions?apiKey=${
          import.meta.env.VITE_API_KEY
        }&limit=10`
      )
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setQuestions(data);
          } else {
            alert("Failed to load questions. Please try again later.");
          }
        })
        .catch(() => alert("Error fetching questions."));
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
          className="border p-2 mb-2 rounded"
        />
        <input
          placeholder="Enter Exam Code"
          value={examCode}
          onChange={(e) => setExamCode(e.target.value)}
          className="border p-2 mb-2 rounded"
        />
        <button
          onClick={handleStart}
          className="bg-blue-500 text-white p-2 rounded my-6"
        >
          Start Exam
        </button>
      </div>
    );
  }

  return (
    <div className=" bg-blue-50">
      <div className="flex justify-between mb-6 bg-amber-50 py-6 px-4">
        <h1>Exam</h1>
        <div>
          Time Left: {Math.floor(timeLeft / 60)}:{timeLeft % 60}
        </div>
      </div>

      {submitted ? (
        <div className=" p-4">
          <h2>Exam Completed</h2>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-white p-2 rounded my-6"
          >
            Take Another Exam
          </button>
        </div>
      ) : questions.length > 0 ? (
        <div>
          <div className="p-4">
            <h2>Question {currentQuestionIndex + 1}</h2>
            <p className="my-6">{questions[currentQuestionIndex]?.question}</p>
            {questions[currentQuestionIndex]?.answers &&
              Object.values(questions[currentQuestionIndex].answers).map(
                (option, index) =>
                  option && (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(option)}
                      className="block p-2 my-4 rounded bg-blue-100"
                    >
                      ({index + 1}) {option}
                    </button>
                  )
              )}
          </div>

          <div className="flex justify-between p-4">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="bg-gray-500 text-white p-2 rounded w-[82px]"
            >
              Previous
            </button>
            <button
              disabled={currentQuestionIndex === questions.length - 1}
              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              className="bg-blue-500 text-white p-2 rounded w-[82px]"
            >
              Next
            </button>
          </div>

          {currentQuestionIndex === questions.length - 1 && (
            <button
              onClick={handleSubmit}
              className="bg-red-500 text-white p-2 mt-4 rounded ml-4 w-[82px]"
            >
              Submit
            </button>
          )}
        </div>
      ) : (
        <p>Loading questions...</p>
      )}
    </div>
  );
};

export default QspaDemo;
