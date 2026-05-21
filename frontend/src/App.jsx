import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "./context/Web3Context";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";

// Layouts
import MainLayout from "./layouts/MainLayout";
import LandingLayout from "./layouts/LandingLayout";

// Pages
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import CreateProject from "./pages/CreateProject";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectManage from "./pages/ProjectManage";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import Activity from "./pages/Activity";
import Guide from "./pages/Guide";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Web3Provider>
      <ToastProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              {/* Full-width layout for landing */}
              <Route element={<LandingLayout />}>
                <Route path="/landing" element={<Landing />} />
              </Route>

              {/* Main contained layout */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/about" element={<About />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/profile/:address" element={<Profile />} />
                <Route path="/project/:address" element={<ProjectDetail />} />
                <Route path="/project/:address/manage" element={<ProjectManage />} />
                <Route path="/create" element={<CreateProject />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </Web3Provider>
  );
}
