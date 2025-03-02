import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import QspaDemo from "./Page/QspaDemo";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<QspaDemo />} />
      <Route
        path="/start-exam"
        element={<QspaDemo startExamDirectly={true} />}
      />
    </Routes>
  </BrowserRouter>
);

export default App;
