import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

// pages
import { Home, About, Projects, Contact } from "./pages";

// components
import { Navbar } from "./components";
import { ThemeProvider } from "./context/ThemeContext";

// app
const App = () => {
  return (
    <ThemeProvider>
      <main className="bg-slate-300/20 dusk:bg-[#17131f] transition-colors duration-500 h-full">
      {/* routes */}
      <Router>
        {/* navbar */}
        <Navbar />

        {/* other routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>

        {/* TODO: footer */}
      </Router>
      </main>
    </ThemeProvider>
  );
};

export default App;
