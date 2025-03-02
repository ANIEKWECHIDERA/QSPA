import React, { useState, useEffect } from "react";
import { MdNavigateNext } from "react-icons/md";
import { BsStopwatchFill } from "react-icons/bs";
import { auth, db, doc } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";

const QspaDemo = ({ startExamDirectly = false }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [examCode, setExamCode] = useState("");
  const [user, setUser] = useState(null);
  const [started, setStarted] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [showTimer, setShowTimer] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u && u.emailVerified) {
        setUser(u);
        setExamCode(""); // Clear examCode on every verified login
        const attemptRef = doc(db, `users/${u.uid}/attempts/exam1`);
        onSnapshot(attemptRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.completedAt) {
              setStarted(false);
              setExamCode(""); // Clear again for completed exam
              navigate("/start-exam");
            } else if (data.sessionToken && !data.completedAt) {
              setStarted(true);
              setSessionToken(data.sessionToken);
              setQuestions(data.questions || []);
              setAnswers(data.answers || {});
              const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
              const remaining = 5 * 60 - elapsed;
              if (remaining > 0) setTimeLeft(remaining);
              else onTimeout();
              navigate("/start-exam");
            } else {
              setStarted(false);
              setExamCode(""); // Clear for no active exam
              navigate("/start-exam");
            }
          } else {
            setStarted(false);
            setExamCode(""); // Clear for no exam data
            navigate("/start-exam");
          }
        });
      } else {
        setUser(null);
        setStarted(false);
        setExamCode(""); // Clear on sign-out or unverified
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // useEffect(() => {
  //   if (auth.currentUser && !started && !submitted) {
  //     const attemptRef = doc(
  //       db,
  //       `users/${auth.currentUser.uid}/attempts/exam1`
  //     );

  //     onSnapshot(attemptRef, (docSnap) => {
  //       if (docSnap.exists()) {
  //         const data = docSnap.data();
  //         if (data.sessionToken && !data.completedAt) {
  //           setSessionToken(data.sessionToken);
  //           setQuestions(data.questions || []);
  //           setAnswers(data.answers || {});
  //           setStarted(true);
  //           const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
  //           const remaining = 5 * 60 - elapsed;
  //           if (remaining > 0) setTimeLeft(remaining);
  //           else onTimeout();
  //         }
  //       }
  //     });
  //   }
  // }, [auth.currentUser]);

  useEffect(() => {
    if (started && !submitted && auth.currentUser) {
      const attemptRef = doc(
        db,
        `users/${auth.currentUser.uid}/attempts/exam1`
      );
      let timerId;

      const unsubscribe = onSnapshot(
        attemptRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.startTime && data.duration) {
              const updateTimer = () => {
                const elapsed = Math.floor(
                  (Date.now() - data.startTime) / 1000
                );
                const remaining = Math.floor(data.duration / 1000) - elapsed; // Convert duration to seconds
                if (remaining > 0) {
                  setTimeLeft(remaining);
                } else if (!submitted) {
                  setSubmitted(true);
                  onTimeout();
                }
              };
              updateTimer();
              if (!timerId) {
                // Only set interval if not already running
                timerId = setInterval(updateTimer, 1000);
              }
              setAnswers(data.answers || {});
            }
          }
        },
        (error) => {
          console.error("Firestore listener error:", error);
          Swal.fire({
            title: "Error",
            text: "Failed to load exam data: " + error.message,
            icon: "error",
            confirmButtonColor: "#10B981",
            background: "#EFF6FF",
          });
        }
      );

      return () => {
        clearInterval(timerId);
        unsubscribe();
      };
    }
  }, [started, submitted]);

  // Dedicated onTimeout function with hand-holding
  const onTimeout = async () => {
    setLoading(true);
    try {
      // Step 1: Check if user is still authenticated
      if (!auth.currentUser) {
        throw new Error("User session expired or signed out.");
      }

      // Step 2: Get the auth token
      const idToken = await auth.currentUser.getIdToken();

      // Step 3: Submit the exam to the backend
      const response = await fetch(
        process.env.VITE_APP_API_URL ||
          `http://localhost:5001/qspa-a4f23/us-central1/api/finishExam/exam1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionToken }),
        }
      );

      // Step 4: Check response and get score
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Timeout submission failed");
      }
      const { score, total } = await response.json();

      // Step 5: Update state before sign-out
      setScore(score);
      setShowTimer(false);

      // Step 6: Show result to user
      await Swal.fire({
        title: "Time's Up!",
        text: `Exam submitted due to timeout. Your score: ${score}/${total}`,
        icon: "info",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });

      // Step 7: Sign out and redirect
      await signOut(auth);
      localStorage.clear();
      navigate("/");
    } catch (e) {
      console.error("Timeout error:", e);
      Swal.fire({
        title: "Error",
        text: "Failed to submit on timeout: " + e.message,
        icon: "error",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (started && !submitted && sessionToken) {
      const fetchNextQuestion = async () => {
        setLoading(true);
        try {
          const idToken = await auth.currentUser.getIdToken();
          const response = await fetch(
            process.env.VITE_APP_API_URL ||
              `http://localhost:5001/qspa-a4f23/us-central1/api/nextQuestion/exam1?sessionToken=${sessionToken}`,
            { headers: { Authorization: `Bearer ${idToken}` } }
          );
          if (!response.ok)
            throw new Error((await response.json()).error || "Fetch failed");
          const data = await response.json();
          if (data.done) {
            setSubmitted(true);
          } else {
            setQuestions((prev) => [...prev, data]);
          }
        } catch (e) {
          Swal.fire({
            title: "Error",
            text: "Error fetching question: " + e.message,
            icon: "error",
            confirmButtonColor: "#10B981",
            background: "#EFF6FF",
          });
        } finally {
          setLoading(false);
        }
      };
      if (currentQuestionIndex >= questions.length) fetchNextQuestion();
    }
  }, [started, currentQuestionIndex, sessionToken, submitted]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      if (!user.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email before logging in.");
      }
      Swal.fire({
        title: "Success",
        text: "Logged in successfully!",
        icon: "success",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
      // Redirect handled by onAuthStateChanged
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: e.message,
        icon: "error",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const response = await fetch(
        process.env.VITE_APP_API_URL ||
          "http://localhost:5001/qspa-a4f23/us-central1/api/generateExamCode",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Failed to generate code"
        );
      const { code } = await response.json();
      Swal.fire({
        title: "Success",
        html: `A verification email with your exam code <strong>${code}</strong> has been sent to ${email}.<br>Click the link in your email to verify and proceed.`,
        icon: "success",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: "Signup failed: " + e.message,
        icon: "error",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!examCode.trim()) {
      return Swal.fire({
        title: "Error",
        text: "Please enter an exam code",
        icon: "error",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    }
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(
        process.env.VITE_APP_API_URL ||
          "http://localhost:5001/qspa-a4f23/us-central1/api/startExam",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ examId: "exam1", code: examCode }),
        }
      );
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to start exam");
      }
      const data = await response.json();
      console.log("Start exam response:", data);
      setSessionToken(data.sessionToken);
      setQuestions(data.questions); // Load all questions
      setStarted(true);
      // Swal.fire({
      //   title: "Success",
      //   text: "Exam started!",
      //   icon: "success",
      //   confirmButtonColor: "#10B981",
      //   background: "#EFF6FF",
      // });
    } catch (e) {
      console.error("Start exam error:", e);
      Swal.fire({
        title: "Error",
        text: "Error starting exam: " + e.message,
        icon: "error",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = async (optionKey) => {
    setAnswers({ ...answers, [currentQuestionIndex]: optionKey });
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      await fetch(
        process.env.VITE_APP_API_URL ||
          `http://localhost:5001/qspa-a4f23/us-central1/api/submitAnswer/exam1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionToken,
            answer: optionKey,
            questionIndex: currentQuestionIndex,
          }),
        }
      );
    } catch (e) {
      Swal.fire("Error", "Error submitting answer: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(
        process.env.VITE_APP_API_URL ||
          `http://localhost:5001/qspa-a4f23/us-central1/api/finishExam/exam1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionToken }),
        }
      );
      if (!response.ok)
        throw new Error((await response.json()).error || "Submit failed");
      const { score, total } = await response.json();

      setScore(score);
      setSubmitted(true);
      setShowTimer(false);

      await Swal.fire({
        title: "Success",
        text: `Exam completed! Your score: ${score}/${total}`,
        icon: "success",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });

      await signOut(auth);
      localStorage.clear();
      navigate("/");
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: "Error submitting exam: " + e.message,
        icon: "error",
        confirmButtonColor: "#10B981",
        background: "#EFF6FF",
      });
    } finally {
      setLoading(false);
    }
  };

  // const handleTimeOut = async () => {
  //   setSubmitted(true);
  //   await handleSubmit(); // This will sign out via handleSubmit
  // };

  const handleQuit = async () => {
    if (window.confirm("Are you sure you want to quit?")) {
      setLoading(true);
      try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch(
          process.env.VITE_APP_API_URL ||
            `http://localhost:5001/qspa-a4f23/us-central1/api/finishExam/exam1`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionToken }),
          }
        );
        if (!response.ok)
          throw new Error((await response.json()).error || "Quit failed");
        const { score, total } = await response.json();

        // Sign out before showing result
        await signOut(auth);
        localStorage.clear(); // Clear site data
        setScore(score);
        setSubmitted(true);
        setShowTimer(false);

        Swal.fire({
          title: "Exam Ended",
          text: `You quit the exam. Your score: ${score}/${total}`,
          icon: "info",
          confirmButtonColor: "#10B981",
          background: "#EFF6FF",
        }).then(() => {
          navigate("/");
        });
      } catch (e) {
        Swal.fire({
          title: "Error",
          text: "Error quitting exam: " + e.message,
          icon: "error",
          confirmButtonColor: "#10B981",
          background: "#EFF6FF",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  if (!user) {
    return (
      <div className="bg-blue-50 flex flex-col items-center justify-center h-screen">
        {loading ? (
          <div className="fixed inset-0 flex items-center justify-center  bg-opacity-50">
            <div role="status" className="flex flex-col items-center">
              <svg
                aria-hidden="true"
                className="w-8 h-8 text-blue-100 animate-spin fill-green-500" // Blue base, green fill
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border p-2 mb-2 rounded w-3/4 sm:w-2/3 md:w-1/3"
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-2 mb-2 rounded w-3/4 sm:w-2/3 md:w-1/3"
            />
            <button
              onClick={handleLogin}
              className="bg-green-500 text-white p-2 rounded w-3/4 sm:w-2/3 md:w-1/3 my-2"
            >
              Login
            </button>
            <button
              onClick={handleSignup}
              className="bg-blue-500 text-white p-2 rounded w-3/4 sm:w-2/3 md:w-1/3 my-2"
            >
              Signup
            </button>
          </>
        )}
      </div>
    );
  }

  if (!started) {
    return (
      <div className="bg-blue-50 flex flex-col items-center justify-center h-screen">
        {loading ? (
          <div className="fixed inset-0 flex items-center justify-center  bg-opacity-50">
            <div role="status" className="flex flex-col items-center">
              <svg
                aria-hidden="true"
                className="w-8 h-8 text-blue-100 animate-spin fill-green-500" // Blue base, green fill
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-start w-full">
              <input
                placeholder="Enter Exam Code"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                className="border p-2 mb-2 rounded w-3/4 sm:w-2/3 md:w-1/3"
                autoComplete="off"
              />
            </div>

            <button
              onClick={handleStart}
              className="bg-green-500 text-white p-2 rounded w-3/4 sm:w-2/3 md:w-1/3 my-6"
            >
              Start Exam
            </button>
            <button
              onClick={async () => {
                await signOut(auth);
                localStorage.clear();
                navigate("/");
              }}
              className="absolute top-4 right-4 text-white bg-red-500 py-1 px-2 rounded text-sm sm:text-base"
            >
              Logout
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-blue-50">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center  bg-opacity-50">
          <div role="status" className="flex flex-col items-center">
            <svg
              aria-hidden="true"
              className="w-8 h-8 text-blue-100 animate-spin  fill-green-500"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6 bg-amber-50 py-6 px-4 sticky top-0">
        <h1 className="text-sm xl:text-4xl font-bold">Programming Exam</h1>
        {!submitted && (
          <div
            className={`hidden ${
              questions.length === 0 ? "md:hidden" : ""
            } text-xl md:flex justify-between align-middle gap-4`}
          >
            {currentQuestionIndex + 1}/{questions.length}
          </div>
        )}
        <div
          className={`${
            showTimer === false ? "hidden" : ""
          } xl:text-2xl flex justify-between align-middle gap-4`}
        >
          <BsStopwatchFill className="hidden md:block" />
          {timeLeft > 0
            ? questions.length === 0
              ? "Time Left: --:--"
              : `Time Left: ${Math.floor(timeLeft / 60)}:${String(
                  timeLeft % 60
                ).padStart(2, "0")}`
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
        <div className="p-4">
          <h2>Exam Completed</h2>
          <p>Your Score: {score}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-white p-2 rounded my-6"
          >
            End Exam
          </button>
        </div>
      ) : questions.length > 0 ? (
        <div className="py-2 md:py-6 min-h-[500px] md:min-h-[700px]">
          <div className="p-4 md:min-h-[500px]">
            <h2 className="text-xl md:text-2xl">
              Question {currentQuestionIndex + 1}
            </h2>
            <p className="my-4 md:my-6 md:text-xl">
              {questions[currentQuestionIndex]?.question}
            </p>
            {questions[currentQuestionIndex]?.answers &&
              Object.entries(questions[currentQuestionIndex].answers)
                .filter(([_, option]) => option)
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .map(
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
              className="text-[#b8191994] p-2 mt-4 rounded w-20"
              onClick={handleQuit}
            >
              Quit
            </button>
            {currentQuestionIndex === questions.length - 1 && (
              <button
                onClick={handleSubmit}
                className="text-green-500 p-2 mt-4 rounded w-20"
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
