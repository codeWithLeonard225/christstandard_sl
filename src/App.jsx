import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminPanel from "./Component/Admin/AdminPanel";
import LoginPage from "./Component/Admin/LoginPage";
import FeesDashboard from "./Component/Dashboard/FeesDsahboard";
import { AuthProvider } from "./Component/Security/AuthContext";
import ProtectedRoute from "./Component/Security/ProtectedRoute";
import TeacherGradesPage from "./Component/TeacherAssignment/TeacherPupilsPage";
import PupilsDashboard from "./Component/PupilsPage/PupilsDashboard";
import FeesPanel from "./Component/Admin/FeesPanel";
import Testing from "./Component/Admin/Testing";
import Home from "./Component/Web/Pages/Home";
import About from "./Component/Web/Pages/About";
import Programs from "./Component/Web/Pages/Programs";
import Gallery from "./Component/Web/Pages/Gallery";
import ContactUsPage from "./Component/Web/Pages/ContactUsPage";
import Developer from "./Component/Dashboard/Developer";
import PupilUpdate from "./Component/TeacherAssignment/PupilUpdate";

function App() {
  return (
    <AuthProvider>
      <Router>

        <Routes>
          <Route path="/" element={< Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/gallery" element={<Gallery />} />
           <Route path="/contact" element={<ContactUsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/PupilsDashboard"
            element={
              <ProtectedRoute role="pupil">
                <PupilsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/special"
            element={
              <ProtectedRoute role="admin">
                <Developer />
              </ProtectedRoute>
            }
          />
            <Route
            path="/registra"
            element={
              <ProtectedRoute role="admin">
                <FeesPanel />
              </ProtectedRoute>
            }
          />
            <Route
            path="/class"
            element={
              <ProtectedRoute role="teacher">
                <PupilUpdate/>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjectTeacher"
            element={
              <ProtectedRoute role="teacher">
                <TeacherGradesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ceo"
            element={
              <ProtectedRoute role="ceo">
                <Developer />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
    
  );
}

export default App;
