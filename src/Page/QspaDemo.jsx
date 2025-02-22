import React, { useState, useEffect } from "react";
import { MdNavigateNext } from "react-icons/md";
import { BsStopwatchFill } from "react-icons/bs";

const QspaDemo = () => {
  const [username, setUsername] = useState("");
  const [examCode, setExamCode] = useState("");
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(5 * 60);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

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
            // console.log("Questions loaded:", data);
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

  const handleAnswerSelect = (optionKey) => {
    setAnswers({ ...answers, [currentQuestionIndex]: optionKey });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    let totalScore = 0;
    questions.forEach((question, index) => {
      const selectedAnswer = answers[index];
      if (
        selectedAnswer &&
        question.correct_answers[`${selectedAnswer}_correct`] === "true"
      ) {
        totalScore += 5;
      }
    });
    setScore(totalScore);
    setTimeLeft(-1);
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <input
          placeholder="Enter Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 mb-2 rounded w-3/4 sm:w-2/3 md:w-1/3"
        />
        <input
          placeholder="Enter Exam Code"
          value={examCode}
          onChange={(e) => setExamCode(e.target.value)}
          className="border p-2 mb-2 rounded w-3/4 sm:w-2/3 md:w-1/3"
        />
        <button
          onClick={handleStart}
          className="bg-green-500 text-white p-2 rounded w-3/4 sm:w-2/3 md:w-1/3 my-6"
        >
          Start Exam
        </button>
      </div>
    );
  }

  return (
    <div className=" bg-blue-50">
      <div className="flex justify-between items-center mb-6 bg-amber-50 py-6 px-4 h-full sticky top-0">
        <h1 className="text-sm xl:text-4xl font-bold">Programming Exam</h1>
        {!submitted && (
          <div className="hidden text-xl md:flex justify-between align-middle gap-4">
            {currentQuestionIndex + 1}/{questions.length}
          </div>
        )}

        <div
          className={`${
            timeLeft === -1 ? "hidden" : ""
          } xl:text-2xl flex justify-between align-middle gap-4`}
        >
          <BsStopwatchFill className="hidden md:block" />
          {timeLeft > 0
            ? `Time Left: ${Math.floor(timeLeft / 60)}:${timeLeft % 60}`
            : "Time's up!"}
        </div>
      </div>
      {!submitted && (
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 p-4">
          {questions.map((_, index) => (
            <button
              key={index}
              className={`p-2 rounded text-white ${
                answers[index] ? "bg-green-500" : "bg-gray-500"
              } ${
                currentQuestionIndex === index ? "ring-4 ring-emerald-200" : ""
              }`}
              onClick={() => setCurrentQuestionIndex(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
      {submitted ? (
        <div className=" p-4">
          <h2>Exam Completed</h2>
          <p>Your Score: {score}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-white p-2 rounded my-6"
          >
            Take Another Exam
          </button>
        </div>
      ) : questions.length > 0 ? (
        <div className="py-2 md:py-6 min-h-[500px] md:min-h-[700px]">
          <div className="p-4 md:min-h-[500px]">
            <h2 className="text-xl md:text-2xl ">
              Question {currentQuestionIndex + 1}
            </h2>
            <p className="my-4 md:my-6 md:text-xl">
              {questions[currentQuestionIndex]?.question}
            </p>
            {questions[currentQuestionIndex]?.answers &&
              Object.entries(questions[currentQuestionIndex].answers).map(
                ([key, option]) =>
                  option && (
                    <button
                      key={key}
                      onClick={() => handleAnswerSelect(key)}
                      className={`block p-2 my-4 rounded w-full text-left text-xs md:text-base ${
                        answers[currentQuestionIndex] === key
                          ? "bg-green-300"
                          : "bg-blue-100"
                      }`}
                    >
                      ({key.slice(7)}) {option}
                    </button>
                  )
              )}
          </div>

          <div className="flex justify-center md:justify-start gap-6 p-4">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className={`bg-blue-500 text-white p-2 rounded w-20 ${
                currentQuestionIndex === 0 ? "bg-gray-500 disabled" : ""
              }`}
            >
              <MdNavigateNext className="text-3xl rotate-180 mx-auto" />
            </button>
            <button
              disabled={currentQuestionIndex === questions.length - 1}
              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              className={`bg-blue-500 text-white p-2 rounded w-20 ${
                currentQuestionIndex === questions.length - 1
                  ? "bg-gray-500 disabled"
                  : ""
              }`}
            >
              <MdNavigateNext className="text-3xl mx-auto" />
            </button>
          </div>
          <div className="flex justify-center md:justify-start gap-6 p-4">
            <button
              onClick={() => {
                if (!window.confirm("Are you sure you want to Quit?")) return;
                window.location.reload();
              }}
              className="text-[#b8191994] p-2 mt-4 rounded w-20"
            >
              Quit
            </button>
            {currentQuestionIndex === questions.length - 1 && (
              <button
                onClick={handleSubmit}
                className="bg-green-500 text-white p-2 mt-4 rounded w-20"
              >
                Submit
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="p-4">Loading questions...</p>
      )}
    </div>
  );
};

export default QspaDemo;
