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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
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
            path="/teacher"
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
                <FeesPanel />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
