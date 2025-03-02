const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
require("dotenv").config();

admin.initializeApp();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "https://qsdpa.netlify.app");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// Auth middleware
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// Generate and send exam code after verification
app.post("/generateExamCode", async (req, res) => {
  const userId = req.user.uid;
  const email = req.user.email;

  try {
    // Generate exam code
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store exam code in Firestore
    await admin.firestore().doc(`examCodes/${code}`).set({
      email,
      userId,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });

    // Generate email verification link
    const actionCodeSettings = {
      url: `${process.env.APP_URL || `http://localhost:5173`}/start-exam`, // Replace with your app URL (e.g., http://localhost:5173 or deployment URL)
      handleCodeInApp: false,
    };
    const verificationLink = await admin
      .auth()
      .generateEmailVerificationLink(email, actionCodeSettings);
    const userRecord = await admin.auth().getUser(userId);
    const studentName = userRecord.displayName || email.split("@")[0];
    // Send custom email with verification link and exam code
    await transporter.sendMail({
      from: "QSPA Team <your-gmail@gmail.com>", // Replace with your Gmail
      to: email,
      subject: "Verify Your Email",
      text: `Hello ${studentName},\n\nThank you for signing up with for this exam!\n\nPlease verify your email by clicking this link: ${verificationLink}\n\nYour unique exam code is: ${code}\n\nUse this code after verification to start your exam. The code expires in 24 hours.\n\nBest regards,\nQSPA Team`,
      html: `<p>Hello ${studentName},</p><p>Thank you for signing up with QSPA Exam Platform!</p><p>Please verify your email by clicking this link: <a href="${verificationLink}">Verify Email</a></p><p>Your unique exam code is: <strong>${code}</strong></p><p>Use this code after verification to start your exam. The code expires in 24 hours.</p><p>Best regards,<br>QSPA Team</p>`,
    });

    // console.log(`Exam code and verification email sent to ${email}: ${code}`);
    return res.status(200).json({ code });
  } catch (error) {
    console.error("Generate code error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate code or send email" });
  }
});

// Start Exam
app.post("/startExam", async (req, res) => {
  const { examId = "exam1", code } = req.body;
  const userId = req.user.uid;

  try {
    const codeRef = admin.firestore().doc(`examCodes/${code}`);
    const codeDoc = await codeRef.get();
    if (
      !codeDoc.exists ||
      codeDoc.data().used ||
      codeDoc.data().expiresAt < Date.now() ||
      codeDoc.data().userId !== userId
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const attemptRef = admin
      .firestore()
      .doc(`users/${userId}/attempts/${examId}`);
    const attempt = await attemptRef.get();
    if (attempt.exists && attempt.data().completedAt) {
      return res.status(403).json({ error: "Exam already completed" });
    }

    const examRef = admin.firestore().doc(`exams/${examId}`);
    let exam = await examRef.get();
    const duration = 60 * 1000;
    if (!exam.exists) {
      const response = await fetch(
        `https://quizapi.io/api/v1/questions?apiKey=${process.env.QUIZ_API_KEY}&limit=10`
      );
      if (!response.ok)
        return res.status(500).json({ error: "Failed to fetch questions" });
      const questions = await response.json();
      await examRef.set({ startTime: Date.now(), duration, questions });
      exam = await examRef.get();
    }

    const sessionToken = uuidv4();
    const questions = exam.data().questions.map((q, index) => ({
      id: index,
      question: q.question,
      answers: q.answers,
    }));

    await attemptRef.set({
      startTime: Date.now(),
      sessionToken,
      answers: {},
      questions,
      examCode: code,
      duration, // Store duration in attempt
    });

    const sessionRef = admin.firestore().doc(`sessions/${userId}`);
    await sessionRef.set({
      sessionToken,
      lastActive: Date.now(),
      deviceInfo: req.headers["user-agent"] || "Unknown",
    });

    return res.status(200).json({ sessionToken, questions });
  } catch (error) {
    console.error("StartExam error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
// Fetch Next Question
app.get("/nextQuestion/:examId", async (req, res) => {
  const { examId } = req.params;
  const { sessionToken } = req.query;
  const userId = req.user.uid;

  try {
    const attemptRef = admin
      .firestore()
      .doc(`users/${userId}/attempts/${examId}`);
    const attempt = await attemptRef.get();
    if (
      !attempt.exists ||
      attempt.data().sessionToken !== sessionToken ||
      attempt.data().completedAt
    ) {
      return res.status(403).json({ error: "Invalid session" });
    }
    const currentIndex = Object.keys(attempt.data().answers || {}).length;
    const questions = attempt.data().questions;
    if (currentIndex >= questions.length) {
      return res.json({ done: true });
    }
    const q = questions[currentIndex];
    return res.json({ id: q.id, question: q.question, answers: q.answers });
  } catch (error) {
    console.error("NextQuestion error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Submit Answer
app.post("/submitAnswer/:examId", async (req, res) => {
  const { examId } = req.params;
  const { sessionToken, answer, questionIndex } = req.body;
  const userId = req.user.uid;

  const attemptRef = admin
    .firestore()
    .doc(`users/${userId}/attempts/${examId}`);
  const attempt = await attemptRef.get();
  if (!attempt.exists || attempt.data().sessionToken !== sessionToken) {
    return res.status(403).json({ error: "Invalid session" });
  }

  await attemptRef.update({
    [`answers.${questionIndex}`]: answer,
  });
  return res.json({ success: true });
});

// Finish Exam
app.post("/finishExam/:examId", async (req, res) => {
  const { examId } = req.params;
  const { sessionToken } = req.body;
  const userId = req.user.uid;
  const email = req.user.email; // Declare email here, outside try-catch

  try {
    const attemptRef = admin
      .firestore()
      .doc(`users/${userId}/attempts/${examId}`);
    const attempt = await attemptRef.get();
    if (!attempt.exists || attempt.data().sessionToken !== sessionToken) {
      return res.status(403).json({ error: "Invalid session" });
    }

    const exam = await admin.firestore().doc(`exams/${examId}`).get();
    const questions = exam.data().questions;
    const answers = attempt.data().answers || {};
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] && q.correct_answers[`${answers[i]}_correct`] === "true") {
        score += 10;
      }
    });

    await attemptRef.update({
      score,
      completedAt: Date.now(),
      sessionToken: null,
    });
    const codeRef = admin
      .firestore()
      .doc(`examCodes/${attempt.data().examCode}`);
    await codeRef.update({ used: true });

    const userRecord = await admin.auth().getUser(userId);
    const studentName = userRecord.displayName || email.split("@")[0];

    await transporter.sendMail({
      from: "QSPA Team <your-gmail@gmail.com>", // Replace with your Gmail
      to: email,
      subject: "Your Exam Results",
      text: `Hello ${studentName},\n\nYour exam has been completed. Your score is ${score} out of ${
        questions.length * 10
      }.\n\nThank you for writing this exam!\n\nBest regards,\nQSPA Team`,
      html: `<p>Hello ${studentName},</p><p>Your exam has been completed. Your score is <strong>${score}</strong> out of ${
        questions.length * 10
      }.</p><p>Thank you for writing this exam!</p><p>Best regards,<br>QSPA Team</p>`,
    });

    return res.json({ score, total: questions.length * 10 });
  } catch (error) {
    console.error("FinishExam error:", error);
    // Optionally send an email on failure if desired
    await transporter.sendMail({
      from: "QSPA Team <your-gmail@gmail.com>",
      to: email, //
      subject: "Exam Submission Error",
      text: `Hello,\n\nThere was an error submitting your exam. Please contact support.\n\nError: ${error.message}\n\nBest regards,\nQSPA Team`,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
});

exports.api = functions.https.onRequest(app);
